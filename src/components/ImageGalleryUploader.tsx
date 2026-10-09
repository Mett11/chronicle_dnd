import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, X, Maximize2, Link as LinkIcon, Loader2, ChevronLeft, ChevronRight, Move } from 'lucide-react';
import { Portal } from './Portal';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { CampaignManager } from '../store/campaignStore';
import { ImageOptimizerModal } from './ImageOptimizer';

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

  const handleMoveImage = (index: number, direction: 'left' | 'right', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;
    onChange(newImages);
    if (lightboxIndex === index) {
      setLightboxIndex(targetIndex);
    }
  };

  const handleReorderImage = (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || fromIdx >= images.length || toIdx < 0 || toIdx >= images.length || fromIdx === toIdx) return;
    const copy = [...images];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    onChange(copy);
    if (lightboxIndex === fromIdx) {
      setLightboxIndex(toIdx);
    }
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
            key={`${imgSrc.slice(-20)}_${idx}`}
            draggable={!readOnly && images.length > 1}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', idx.toString());
            }}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
              if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                handleReorderImage(sourceIdx, idx);
              }
            }}
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

            {/* Position badge */}
            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-surface-0/80 text-[9px] font-mono font-bold text-content-2 border border-surface-3/50 backdrop-blur-xs shadow-xs">
              #{idx + 1}
            </span>

            {/* Overlay Hover */}
            <div className="absolute inset-0 bg-surface-0/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 backdrop-blur-xs">
              {/* Top controls: Reorder arrows */}
              {!readOnly && images.length > 1 ? (
                <div className="flex items-center justify-between w-full">
                  {idx > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => handleMoveImage(idx, 'left', e)}
                      className="p-1 rounded bg-surface-1 hover:bg-primary hover:text-surface-0 text-content-1 transition-colors shadow-xs cursor-pointer"
                      title="Sposta prima (a sinistra)"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  ) : <div />}
                  {idx < images.length - 1 ? (
                    <button
                      type="button"
                      onClick={(e) => handleMoveImage(idx, 'right', e)}
                      className="p-1 rounded bg-surface-1 hover:bg-primary hover:text-surface-0 text-content-1 transition-colors shadow-xs cursor-pointer"
                      title="Sposta dopo (a destra)"
                    >
                      <ChevronRight size={13} />
                    </button>
                  ) : <div />}
                </div>
              ) : <div />}

              {/* Bottom controls: Zoom and Delete */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="p-1 rounded bg-surface-1 text-content-1 shadow-xs">
                  <Maximize2 size={12} />
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveImage(idx, e)}
                    className="p-1 rounded bg-red-500/80 text-white hover:bg-red-600 transition-colors cursor-pointer"
                    title="Rimuovi immagine"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
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
                      if (cdnUrl && (cdnUrl.startsWith('http://') || cdnUrl.startsWith('https://'))) {
                        return cdnUrl;
                      }
                      return '';
                    } catch {
                      return '';
                    }
                  }
                  return b64.startsWith('http') ? b64 : '';
                })
              );
              const validUrls = uploadedUrls.filter((u): u is string => Boolean(u && (u.startsWith('http://') || u.startsWith('https://'))));
              if (validUrls.length > 0) {
                onChange([...images, ...validUrls]);
              }
            } catch (err) {
              console.warn('Errore upload galleria:', err);
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
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-surface-3 gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-primary">
                    Immagine {lightboxIndex + 1} di {images.length}
                  </span>
                  {!readOnly && images.length > 1 && (
                    <div className="flex items-center gap-1 bg-surface-1 border border-surface-3 rounded-lg p-0.5 text-xs font-mono">
                      <button
                        type="button"
                        disabled={lightboxIndex === 0}
                        onClick={() => handleMoveImage(lightboxIndex, 'left')}
                        className="px-2 py-1 rounded hover:bg-primary hover:text-surface-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit text-content-1 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Sposta immagine a sinistra"
                      >
                        <ChevronLeft size={13} />
                        <span className="hidden sm:inline">Prima</span>
                      </button>
                      <button
                        type="button"
                        disabled={lightboxIndex === images.length - 1}
                        onClick={() => handleMoveImage(lightboxIndex, 'right')}
                        className="px-2 py-1 rounded hover:bg-primary hover:text-surface-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit text-content-1 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Sposta immagine a destra"
                      >
                        <span className="hidden sm:inline">Dopo</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
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
