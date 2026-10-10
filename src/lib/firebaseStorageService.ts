import { supabase, isSupabaseConfigured } from './supabase';

export const CHRONICLE_MEDIA_BUCKET = 'chronicle-media';

/**
 * Utility to decide between two image URLs.
 * Always prefers a valid HTTP/HTTPS CDN URL over a Base64 data string.
 */
export function pickBestImageUrl(urlA?: string | null, urlB?: string | null): string {
  const a = typeof urlA === 'string' ? urlA.trim() : '';
  const b = typeof urlB === 'string' ? urlB.trim() : '';
  if (!a) return b;
  if (!b) return a;

  const aIsHttp = a.startsWith('http://') || a.startsWith('https://');
  const bIsHttp = b.startsWith('http://') || b.startsWith('https://');

  if (aIsHttp && !bIsHttp) return a;
  if (bIsHttp && !aIsHttp) return b;

  return a;
}

export class SupabaseStorageService {
  /**
   * Helper to parse a public URL or relative path and extract the storage path within the bucket
   */
  static extractStoragePath(urlOrPath: string): { bucket: string; path: string } | null {
    if (!urlOrPath || typeof urlOrPath !== 'string') return null;
    const trimmed = urlOrPath.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;

    if (trimmed.startsWith('campaigns/')) {
      return { bucket: CHRONICLE_MEDIA_BUCKET, path: trimmed };
    }

    const knownBuckets = [CHRONICLE_MEDIA_BUCKET, 'campaign-assets', 'user-avatars', 'audio-logs'];
    for (const b of knownBuckets) {
      const marker = `/${b}/`;
      const idx = trimmed.indexOf(marker);
      if (idx !== -1) {
        const rawPath = trimmed.slice(idx + marker.length);
        const pathClean = rawPath.split('?')[0];
        try {
          return { bucket: b, path: decodeURIComponent(pathClean) };
        } catch {
          return { bucket: b, path: pathClean };
        }
      }
    }

    const match = trimmed.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/?#]+)\/([^?#]+)/);
    if (match) {
      const bucket = match[1];
      const rawPath = match[2];
      try {
        return { bucket, path: decodeURIComponent(rawPath) };
      } catch {
        return { bucket, path: rawPath };
      }
    }

    return null;
  }

  /**
   * Physically deletes a single media file from the Supabase storage bucket
   */
  static async deleteMedia(urlOrPath: string): Promise<boolean> {
    if (!urlOrPath) return false;
    const parsed = this.extractStoragePath(urlOrPath);
    if (!parsed) return false;

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.storage
          .from(parsed.bucket)
          .remove([parsed.path]);
        if (error) {
          console.warn(`[Supabase Storage] Failed to delete ${parsed.path} from ${parsed.bucket}:`, error.message);
          return false;
        }
        return true;
      } catch (err) {
        console.warn(`[Supabase Storage] Delete exception for ${parsed.path}:`, err);
        return false;
      }
    }
    return true;
  }

  /**
   * Batch deletes multiple media files from the storage bucket
   */
  static async deleteMultipleMedia(urlsOrPaths: (string | undefined | null)[]): Promise<boolean> {
    const parsedList = (urlsOrPaths || [])
      .filter((u): u is string => Boolean(u && typeof u === 'string'))
      .map((u) => this.extractStoragePath(u))
      .filter((p): p is { bucket: string; path: string } => Boolean(p));

    if (parsedList.length === 0) return true;

    if (isSupabaseConfigured()) {
      try {
        const bucketMap = new Map<string, string[]>();
        for (const item of parsedList) {
          const list = bucketMap.get(item.bucket) || [];
          if (!list.includes(item.path)) {
            list.push(item.path);
          }
          bucketMap.set(item.bucket, list);
        }

        let allOk = true;
        for (const [bucket, paths] of bucketMap.entries()) {
          const { error } = await supabase.storage.from(bucket).remove(paths);
          if (error) {
            console.warn(`[Supabase Storage] Batch remove error in ${bucket}:`, error.message);
            allOk = false;
          }
        }
        return allOk;
      } catch (err) {
        console.warn('[Supabase Storage] Batch delete exception:', err);
        return false;
      }
    }
    return true;
  }


  /**
   * Normalizes a storage file path or URL by stripping query parameters and decoding URI components.
   */
  static normalizeStoragePath(urlOrPath: string): string {
    if (!urlOrPath || typeof urlOrPath !== 'string') return '';
    const clean = urlOrPath.trim().split('?')[0];
    try {
      return decodeURIComponent(clean);
    } catch {
      return clean;
    }
  }

  /**
   * Pipeline replaceMedia: Uploads new file first and removes old file only after confirmed upload.
   * Prevents broken references if upload fails and avoids orphan files on success.
   */
  static async replaceMedia(options: {
    oldUrl?: string | null;
    newFile: File | Blob | string;
    campaignCode: string;
    bucket?: string;
    folder?: 'entities' | 'maps' | 'scrapbook' | 'audio' | 'general' | 'images';
    filenamePrefix?: string;
  }): Promise<string> {
    const {
      oldUrl,
      newFile,
      campaignCode,
      folder = 'images',
      filenamePrefix = 'media',
    } = options;

    if (!newFile) return oldUrl || '';

    // If new file is already an external HTTP URL and matches oldUrl, return it directly
    if (typeof newFile === 'string' && (newFile.startsWith('http://') || newFile.startsWith('https://'))) {
      if (oldUrl && oldUrl !== newFile) {
        // Option to clean old media if changed to external link
        this.deleteMedia(oldUrl).catch(() => {});
      }
      return newFile;
    }

    const filename = `${filenamePrefix}_${Date.now()}.png`;

    // 1. Upload new file first
    let newCdnUrl = '';
    try {
      newCdnUrl = await this.uploadMedia(campaignCode, folder, filename, newFile);
    } catch (err) {
      console.error('[replaceMedia] Upload of new file failed, preserving old file:', err);
      throw err;
    }

    if (!newCdnUrl || (!newCdnUrl.startsWith('http://') && !newCdnUrl.startsWith('https://'))) {
      console.warn('[replaceMedia] Upload returned empty or invalid URL, keeping old URL.');
      return oldUrl || '';
    }

    // 2. Delete old file ONLY after successful upload confirmation
    if (oldUrl && oldUrl !== newCdnUrl) {
      const normalizedOld = this.normalizeStoragePath(oldUrl);
      const normalizedNew = this.normalizeStoragePath(newCdnUrl);
      if (normalizedOld && normalizedOld !== normalizedNew) {
        this.deleteMedia(oldUrl).catch((err) => {
          console.warn('[replaceMedia] Non-fatal error removing previous orphan file:', err);
        });
      }
    }

    return newCdnUrl;
  }
  static async uploadMedia(
    campaignCode: string,
    folder: 'entities' | 'maps' | 'scrapbook' | 'audio' | 'general' | 'images',
    filename: string,
    input: File | Blob | string,
    bucketName: string = CHRONICLE_MEDIA_BUCKET
  ): Promise<string> {
    if (!input) return '';

    // If it's already an HTTP/HTTPS URL, return it directly
    if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
      return input;
    }

    const fallbackValue = typeof input === 'string' ? input : '';
    const sanitizedCode = (campaignCode || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const storagePath = `campaigns/${sanitizedCode}/${folder}/${uniqueName}`;

    // Supabase Storage (bucket chronicle-media)
    if (isSupabaseConfigured()) {
      let fileBlob: Blob | null = null;
      let mimeType = 'image/png';

      if (input instanceof File || input instanceof Blob) {
        fileBlob = input;
        mimeType = input.type || 'application/octet-stream';
      } else if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          const mimeMatch = input.match(/:(.*?);/);
          if (mimeMatch) mimeType = mimeMatch[1];
          fileBlob = this.dataURLtoBlob(input);
        } else if (input.startsWith('blob:')) {
          try {
            const resp = await fetch(input);
            fileBlob = await resp.blob();
            mimeType = fileBlob.type || 'image/png';
          } catch (e) {
            console.warn('[Supabase Storage] Failed fetching blob URL:', e);
          }
        }
      }

      if (fileBlob) {
        const { error: uploadError } = await supabase.storage
          .from(CHRONICLE_MEDIA_BUCKET)
          .upload(storagePath, fileBlob, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error('[Supabase Storage] Upload error:', uploadError.message);
          throw new Error(`Upload fallito su Supabase Storage: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from(CHRONICLE_MEDIA_BUCKET)
          .getPublicUrl(storagePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    }

    // If upload was not successful or not HTTP, do NOT return base64
    return '';
  }

  /**
   * Helper to convert Base64 Data URL to Blob for efficient upload
   */
  static dataURLtoBlob(dataUrl: string): Blob | null {
    try {
      const arr = dataUrl.split(',');
      if (arr.length < 2) return null;
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch {
      return null;
    }
  }
}

export const FirebaseStorageService = SupabaseStorageService;
export const MediaStorageService = SupabaseStorageService;

/**
 * Ensures that if a media value is a Base64 string, it is automatically uploaded
 * to Supabase Storage and converted into a permanent CDN HTTP URL.
 */
export async function ensureMediaUploaded(
  campaignCode: string,
  folder: 'entities' | 'maps' | 'scrapbook' | 'audio' | 'general' | 'images',
  urlOrBase64: string | undefined | null,
  filenamePrefix: string = 'media'
): Promise<string> {
  if (!urlOrBase64 || typeof urlOrBase64 !== 'string') return '';
  const trimmed = urlOrBase64.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    try {
      const code = campaignCode || 'DEFAULT';
      const cdnUrl = await SupabaseStorageService.uploadMedia(
        code,
        folder,
        `${filenamePrefix}_${Date.now()}.png`,
        trimmed
      );
      if (cdnUrl && (cdnUrl.startsWith('http://') || cdnUrl.startsWith('https://'))) {
        return cdnUrl;
      }
    } catch (err) {
      console.error('[ensureMediaUploaded] Failed uploading media:', err);
    }
  }
  return (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) ? '' : trimmed;
}
