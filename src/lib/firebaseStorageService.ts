import { supabase, isSupabaseConfigured } from './supabase';

export const CHRONICLE_MEDIA_BUCKET = 'chronicle-media';

export class FirebaseStorageService {
  /**
   * Helper to parse a public URL or relative path and extract the storage path within the bucket
   */
  static extractStoragePath(urlOrPath: string): string | null {
    if (!urlOrPath || typeof urlOrPath !== 'string') return null;
    const trimmed = urlOrPath.trim();
    if (trimmed.startsWith('campaigns/')) return trimmed;

    // Check Supabase public URL pattern
    const supaMarker = `/${CHRONICLE_MEDIA_BUCKET}/`;
    const supaIdx = trimmed.indexOf(supaMarker);
    if (supaIdx !== -1) {
      const rawPath = trimmed.slice(supaIdx + supaMarker.length);
      return rawPath.split('?')[0];
    }

    return null;
  }

  /**
   * Physically deletes a single media file from the Supabase storage bucket
   */
  static async deleteMedia(urlOrPath: string): Promise<boolean> {
    if (!urlOrPath) return false;
    const path = this.extractStoragePath(urlOrPath);
    if (!path) return false;

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.storage
          .from(CHRONICLE_MEDIA_BUCKET)
          .remove([path]);
        if (error) {
          console.warn(`[Supabase Storage] Failed to delete ${path}:`, error.message);
          return false;
        }
        return true;
      } catch (err) {
        console.warn(`[Supabase Storage] Delete exception for ${path}:`, err);
        return false;
      }
    }
    return true;
  }

  /**
   * Batch deletes multiple media files from the storage bucket
   */
  static async deleteMultipleMedia(urlsOrPaths: (string | undefined | null)[]): Promise<boolean> {
    const validPaths = (urlsOrPaths || [])
      .filter((u): u is string => Boolean(u && typeof u === 'string'))
      .map((u) => this.extractStoragePath(u))
      .filter((p): p is string => Boolean(p));

    if (validPaths.length === 0) return true;

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.storage
          .from(CHRONICLE_MEDIA_BUCKET)
          .remove(validPaths);
        if (error) {
          console.warn('[Supabase Storage] Batch remove error:', error.message);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('[Supabase Storage] Batch delete exception:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Uploads an image or audio file to Supabase Storage (bucket: chronicle-media).
   */
  static async uploadMedia(
    campaignCode: string,
    folder: 'entities' | 'maps' | 'scrapbook' | 'audio' | 'general' | 'images',
    filename: string,
    input: File | Blob | string
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

    return fallbackValue;
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

export const MediaStorageService = FirebaseStorageService;
