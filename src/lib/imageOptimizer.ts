/**
 * Image Optimization Utilities for Chronicle D&D
 * Compresses, resizes, and transcodes images (PNG, JPEG, WebP, GIF) client-side
 * to high-efficiency WebP format to prevent Firestore 1MB document quota overflow
 * and ensure blazing fast load times.
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0 (default 0.78)
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface ImageOptimizationResult {
  dataUrl: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
  width: number;
  height: number;
  format: string;
}

export const DEFAULT_IMAGE_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.78,
  format: 'image/webp',
};

export const AVATAR_IMAGE_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 320,
  maxHeight: 320,
  quality: 0.82,
  format: 'image/webp',
};

export const MAP_IMAGE_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  format: 'image/webp',
};

/**
 * Format bytes into human-readable text
 */
export function formatImageBytes(bytes: number, decimals = 1): string {
  if (!+bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const iGrade = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.min(iGrade, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Helper to calculate byte size of a base64 string
 */
export function getBase64ByteSize(base64String: string): number {
  if (!base64String) return 0;
  const base64Length = base64String.length - (base64String.indexOf(',') + 1);
  const padding = (base64String.match(/=/g) || []).length;
  return Math.max(0, Math.floor((base64Length * 3) / 4 - padding));
}

/**
 * Loads an image from a URL, Blob or Base64 string safely
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Impossibile caricare l\'immagine per l\'ottimizzazione.'));
    img.src = src;
  });
}

/**
 * Optimizes an image File, Blob, or base64 data URL using HTML5 Canvas & WebP compression.
 */
export async function optimizeImage(
  input: File | Blob | string,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };
  let originalSize = 0;
  let sourceUrl = '';
  let shouldRevokeUrl = false;

  if (typeof input === 'string') {
    sourceUrl = input;
    originalSize = input.startsWith('data:') ? getBase64ByteSize(input) : input.length;
  } else {
    originalSize = input.size;
    sourceUrl = URL.createObjectURL(input);
    shouldRevokeUrl = true;
  }

  try {
    const img = await loadImage(sourceUrl);

    let width = img.width;
    let height = img.height;

    // Calculate aspect ratio preserving dimensions
    if (width > height) {
      if (width > opts.maxWidth) {
        height = Math.round((height * opts.maxWidth) / width);
        width = opts.maxWidth;
      }
    } else {
      if (height > opts.maxHeight) {
        width = Math.round((width * opts.maxHeight) / height);
        height = opts.maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D context non disponibile.');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Try WebP first, fallback to JPEG if format not supported
    let format = opts.format;
    let dataUrl = canvas.toDataURL(format, opts.quality);

    // Some browsers fallback to PNG if WebP is unsupported
    if (format === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
      format = 'image/jpeg';
      dataUrl = canvas.toDataURL('image/jpeg', opts.quality);
    }

    const optimizedSize = getBase64ByteSize(dataUrl);
    const reductionPercentage = originalSize > 0
      ? Math.max(0, Math.round((1 - optimizedSize / originalSize) * 100))
      : 0;

    return {
      dataUrl,
      originalSize,
      optimizedSize,
      reductionPercentage,
      width,
      height,
      format,
    };
  } finally {
    if (shouldRevokeUrl && sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

/**
 * Creates an ultra-compact square avatar thumbnail (< 20 KB)
 */
export async function createAvatarThumbnail(
  input: File | Blob | string
): Promise<string> {
  const res = await optimizeImage(input, AVATAR_IMAGE_OPTIONS);
  return res.dataUrl;
}
