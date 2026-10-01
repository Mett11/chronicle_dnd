import { ImageOptimizerModal } from './ImageOptimizer';
import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, X, Maximize2, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Portal } from './Portal';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { CampaignManager } from '../store/campaignStore';

interface ImageGalleryUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
  maxImages?: number;
  readOnly?: boolean;
  entityName?: string;
  entityType?: string;
  contextDescription?: string;
}

export function ImageGalleryUploader({
  images = [],
  onChange,
  label = 'Immagini, Mappe & Illustrazioni',
  maxImages = 10,
  readOnly = false,
  entityName = '',
  entityType = '',
  contextDescription = '',
}: ImageGalleryUploaderProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    
    const availableSlots = maxImages - images.length;
    const filesToProcess = fileArray.slice(0, availableSlots);

    if (filesToProcess.length > 0) {
      setPendingFiles(filesToProcess);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    onChange([...images, urlInput.trim()]);
    setUrlInput('');
    setIsUrlInputOpen(false);
  };

  const handleKeyDownUrl = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUrl();
    }
  };

  const handleRemoveImage = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const removedUrl = images[indexToRemove];
    if (removedUrl) {
      FirebaseStorageService.deleteMedia(removedUrl).catch((err) => {
        console.warn('[ImageGallery] Error deleting media file:', err);
      });
    }
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-content-2 flex items-center gap-1.5">
            <ImageIcon size={13} className="text-primary" />
            {label}
            {images.length > 0 && (
              <span className="text-content-3 font-mono font-normal">
                ({images.length}/{maxImages})
              </span>
            )}
          </label>
          {!readOnly && images.length < maxImages && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsUrlInputOpen(!isUrlInputOpen)}
                className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
              >
                <LinkIcon size={11} /> {isUrlInputOpen ? 'Chiudi URL' : 'Link URL'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* URL Input Bar - Uses div with key handler instead of nested form */}
      {isUrlInputOpen && !readOnly && (
        <div className="flex gap-2 p-2 bg-surface-2 rounded-xl border border-surface-3">
          <input
            type="url"
            placeholder="Incolla l'URL diretto dell'immagine (es. https://...)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDownUrl}
            className="flex-1 bg-surface-0 border border-surface-3 focus:border-primary rounded-lg px-3 py-1.5 text-xs text-content-1 placeholder-content-3 outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="bg-primary hover:bg-primary text-surface-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Inserisci
          </button>
        </div>
      )}

      {/* Images Grid */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {images.map((imgSrc, idx) => (
          <div
            key={idx}
            onClick={() => setLightboxIndex(idx)}
            className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-2 border border-surface-3 hover:border-primary cursor-pointer transition-all shadow-md shrink-0"
          >
            <img
              src={imgSrc}
              alt={`Immagine ${idx + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback for broken image URLs
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Overlay Hover */}
            <div className="absolute inset-0 bg-surface-0/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-xs">
              <span className="p-1 rounded bg-surface-1 text-content-1 shadow">
                <Maximize2 size={13} />
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveImage(idx, e)}
                  className="p-1 rounded bg-red-500/80 text-white hover:bg-red-600 transition-colors cursor-pointer"
                  title="Rimuovi immagine"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Upload Button Box */}
        {!readOnly && images.length < maxImages && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shrink-0 ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-surface-3 hover:border-primary/60 bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Upload size={16} className="text-content-2 group-hover:text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-content-3 text-center px-1">
              Carica
            </span>
          </div>
        )}
      </div>

      {/* Uploading indicator */}
      {isUploading && (
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-surface-2 border border-primary/30 text-primary text-xs font-mono">
          <Loader2 size={13} className="animate-spin" />
          <span>Salvataggio su Cloud Storage in corso...</span>
        </div>
      )}

      {/* Optimizer Modal for local files */}
      {pendingFiles.length > 0 && (
        <ImageOptimizerModal
          files={pendingFiles}
          onCancel={() => setPendingFiles([])}
          onConfirm={async (optimizedB64s) => {
            setIsUploading(true);
            try {
              const code = CampaignManager.getActiveCampaignCode() || 'default';
              const uploadedUrls = await Promise.all(
                optimizedB64s.map(async (b64, idx) => {
                  if (b64.startsWith('data:')) {
                    try {
                      const cdnUrl = await FirebaseStorageService.uploadMedia(
                        code,
                        'images',
                        `gallery_${Date.now()}_${idx}.webp`,
                        b64
                      );
                      return cdnUrl || b64;
                    } catch {
                      return b64;
                    }
                  }
                  return b64;
                })
              );
              onChange([...images, ...uploadedUrls]);
            } catch (err) {
              console.warn('Errore upload galleria:', err);
              onChange([...images, ...optimizedB64s]);
            } finally {
              setIsUploading(false);
              setPendingFiles([]);
            }
          }}
        />
      )}

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-surface-0/80 backdrop-blur-md"
            onClick={() => setLightboxIndex(null)}
          >
            <div
              className="relative max-w-4xl max-h-[calc(100dvh-1.5rem)] my-auto bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden shadow-2xl flex flex-col shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-surface-3">
                <span className="text-xs font-mono font-bold text-primary">
                  Immagine {lightboxIndex + 1} di {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="text-content-2 hover:text-content-1 p-1 rounded-lg hover:bg-surface-3 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Image */}
              <div className="p-2 flex items-center justify-center bg-surface-0/90 overflow-auto max-h-[75dvh]">
                <img
                  src={images[lightboxIndex]}
                  alt="Visualizzazione ingrandita"
                  className="max-h-[70dvh] w-auto max-w-full object-contain rounded-lg shadow-xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Navigation Dots if multiple */}
              {images.length > 1 && (
                <div className="flex justify-center gap-2 p-3 bg-surface-2 border-t border-surface-3">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        lightboxIndex === i ? 'bg-primary scale-125' : 'bg-surface-4 hover:bg-content-3'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
