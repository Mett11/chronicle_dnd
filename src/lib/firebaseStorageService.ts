import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export class FirebaseStorageService {
  /**
   * Uploads an image or audio file to Firebase Storage under the campaign folder.
   * Accepts a File, Blob, or Base64 Data URL string.
   * Includes a fast timeout (3.5s) to fallback smoothly if browser CORS or network blocks Firebase Storage.
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

    const uploadTask = async (): Promise<string> => {
      const sanitizedCode = (campaignCode || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const storagePath = `campaigns/${sanitizedCode}/${folder}/${uniqueName}`;
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

    // 3.5 second timeout to prevent hanging on CORS or rule errors
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        console.warn(`[Firebase Storage] Upload timed out for ${folder}/${filename}, falling back.`);
        resolve(fallbackValue);
      }, 3500);
    });

    try {
      return await Promise.race([uploadTask(), timeoutPromise]);
    } catch (error) {
      console.warn('[Firebase Storage] Upload error, falling back to original data:', error);
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
