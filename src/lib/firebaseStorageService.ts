import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { supabase, isSupabaseConfigured } from './supabase';

export const CHRONICLE_MEDIA_BUCKET = 'chronicle-media';

export class FirebaseStorageService {
  /**
   * Uploads an image or audio file to Storage under the campaign folder.
   * Prioritizes Supabase Storage (bucket: chronicle-media) if configured.
   * Falls back to Firebase Storage or original input data.
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

    // 1. PRIMARY STORAGE: Supabase Storage (bucket chronicle-media)
    if (isSupabaseConfigured()) {
      try {
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
            console.warn('[Supabase Storage] Upload warning for bucket chronicle-media:', uploadError.message);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from(CHRONICLE_MEDIA_BUCKET)
              .getPublicUrl(storagePath);

            if (publicUrlData?.publicUrl) {
              console.log(`[Supabase Storage] Uploaded ${storagePath} -> ${publicUrlData.publicUrl}`);
              return publicUrlData.publicUrl;
            }
          }
        }
      } catch (supaErr) {
        console.warn('[Supabase Storage] Upload exception:', supaErr);
      }
    }

    // 2. SECONDARY STORAGE: Firebase Storage fallback
    const uploadFirebaseTask = async (): Promise<string> => {
      const storageRef = ref(storage, storagePath);

      if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          await uploadString(storageRef, input, 'data_url');
        } else {
          return input;
        }
      } else {
        await uploadBytes(storageRef, input);
      }

      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`[Firebase Storage] Uploaded ${folder}/${uniqueName} -> ${downloadUrl}`);
      return downloadUrl;
    };

    // Fast timeout fallback to prevent UI freeze if storage rules are locked
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(fallbackValue);
      }, 3500);
    });

    try {
      return await Promise.race([uploadFirebaseTask(), timeoutPromise]);
    } catch {
      return fallbackValue;
    }
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
