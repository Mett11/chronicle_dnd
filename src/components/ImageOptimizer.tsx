import React, { useState, useEffect } from 'react';
import { ImageIcon, Zap, Check, X, Loader2 } from 'lucide-react';
import { Portal } from './Portal';
import { optimizeImage, formatImageBytes } from '../lib/imageOptimizer';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  optimizedBase64: string | null;
  optimizedSize: number;
  isProcessing: boolean;
}

interface ImageOptimizerModalProps {
  files: File[];
  onConfirm: (optimizedBase64List: string[]) => void;
  onCancel: () => void;
}

export function ImageOptimizerModal({ files, onConfirm, onCancel }: ImageOptimizerModalProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  useEffect(() => {
    if (files.length > 0) {
      const initialImages = files.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        originalSize: file.size,
        optimizedBase64: null,
        optimizedSize: 0,
        isProcessing: false,
      }));
      setImages(initialImages);
    }
  }, [files]);

  const optimizeSingleImage = async (item: ImageItem): Promise<ImageItem> => {
    try {
      const result = await optimizeImage(item.file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.78,
      });

      return {
        ...item,
        optimizedBase64: result.dataUrl,
        optimizedSize: result.optimizedSize,
        isProcessing: false,
      };
    } catch (err) {
      console.warn('Image optimization error:', err);
      return { ...item, isProcessing: false };
    }
  };

 const optimizeAll = async () => {
 setIsProcessingAll(true);
 
 // Set all to processing
 setImages(prev => prev.map(img => ({ ...img, isProcessing: true })));

 const optimizedImages = await Promise.all(
 images.map(img => optimizeSingleImage(img))
 );

 setImages(optimizedImages);
 setIsProcessingAll(false);
 };

 const handleConfirm = () => {
 const validImages = images
 .filter(img => img.optimizedBase64)
 .map(img => img.optimizedBase64 as string);
 
 if (validImages.length > 0) {
 onConfirm(validImages);
 }
 };

 const totalOriginal = images.reduce((acc, img) => acc + img.originalSize, 0);
 const totalOptimized = images.reduce((acc, img) => acc + img.optimizedSize, 0);
 const allOptimized = images.length > 0 && images.every(img => img.optimizedBase64 !== null);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-surface-0/70 backdrop-blur-md">
        <div className="rounded-2xl max-w-3xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col bg-surface-1 border border-surface-3 shadow-2xl overflow-hidden shrink-0 text-content-1">
          <div className="flex-shrink-0 flex items-center justify-between border-b border-surface-3 p-4 sm:p-5 bg-surface-2/40">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-primary" />
              <h3 className="font-semibold text-content-1 uppercase text-xs sm:text-sm tracking-wider">
                Ottimizza Media
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map(img => (
                <div key={img.id} className="bg-surface-2/60 border border-surface-3 rounded-xl overflow-hidden flex flex-col">
                  <div className="aspect-video bg-surface-0/60 relative flex items-center justify-center p-2">
                    <img src={img.optimizedBase64 || img.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    {img.isProcessing && (
                      <div className="absolute inset-0 bg-surface-0/80 flex items-center justify-center">
                        <Loader2 size={24} className="text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-surface-2 text-[10px] uppercase font-bold tracking-wider grid grid-cols-2 gap-2 text-center border-t border-surface-3">
                    <div>
                      <p className="text-content-3 mb-0.5">Prima</p>
                      <p className="text-red-400 font-mono">{formatImageBytes(img.originalSize)}</p>
                    </div>
                    <div>
                      <p className="text-primary mb-0.5">Dopo (WebP)</p>
                      <p className="text-emerald-400 font-mono">
                        {img.optimizedSize > 0 ? formatImageBytes(img.optimizedSize) : '---'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!allOptimized && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={optimizeAll}
                  disabled={isProcessingAll}
                  className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAll ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {isProcessingAll ? 'Ottimizzazione in corso...' : `Ottimizza ${images.length > 1 ? 'Tutte le' : "l'"} Immagini`}
                </button>
              </div>
            )}

            {allOptimized && images.length > 1 && (
              <div className="bg-primary/10 border border-primary/20 p-3.5 rounded-xl text-center">
                <p className="text-[11px] text-primary font-bold uppercase tracking-wider">
                  Risparmio Totale Spazio
                </p>
                <p className="text-xs font-mono text-emerald-400 mt-1">
                  {formatImageBytes(totalOriginal)} ➔ {formatImageBytes(totalOptimized)} 
                  <span className="text-content-3 ml-2 font-normal">
                    (-{Math.round((1 - totalOptimized / totalOriginal) * 100)}%)
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 p-4 sm:p-5 border-t border-surface-3 bg-surface-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!allOptimized}
              className="bg-primary hover:bg-primary-hover text-surface-0 px-5 py-2 rounded-xl font-semibold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              Conferma Upload
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
