import React, { useState, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  Maximize2,
  Check,
  FileImage,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ImageOptimizerModal } from './ImageOptimizer';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { CampaignManager } from '../store/campaignStore';

interface SingleImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  aspectRatio?: 'video' | 'square' | 'banner' | 'auto';
  className?: string;
  previewHeightClass?: string;
  entityName?: string;
  entityType?: string;
  contextDescription?: string;
}

export function SingleImageUploader({
  value,
  onChange,
  label,
  placeholder = 'https://images.unsplash.com/... o carica da disco',
  helperText,
  aspectRatio = 'video',
  className = '',
  previewHeightClass = 'h-40',
  entityName = '',
  entityType = '',
  contextDescription = '',
}: SingleImageUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlDraft, setUrlDraft] = useState(value && !value.startsWith('data:') ? value : '');
  const [isDragging, setIsDragging] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleApplyUrl = async () => {
    const trimmed = urlDraft.trim();
    if (trimmed) {
      if (value && value !== trimmed) {
        const code = CampaignManager.getActiveCampaignCode() || 'default';
        try {
          const finalUrl = await FirebaseStorageService.replaceMedia({
            oldUrl: value,
            newFile: trimmed,
            campaignCode: code,
            folder: 'images',
          });
          onChange(finalUrl);
        } catch {
          onChange(trimmed);
        }
      } else {
        onChange(trimmed);
      }
    }
  };

  const handleKeyDownUrl = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyUrl();
    }
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFiles([files[0]]);
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleOptimizerConfirm = async (optimizedList: string[]) => {
    if (optimizedList.length > 0) {
      const raw = optimizedList[0];
      setIsUploadingImage(true);
      try {
        const code = CampaignManager.getActiveCampaignCode() || 'default';
        const finalCdnUrl = await FirebaseStorageService.replaceMedia({
          oldUrl: value,
          newFile: raw,
          campaignCode: code,
          folder: 'images',
          filenamePrefix: entityName ? entityName.replace(/\s+/g, '_').toLowerCase() : 'img',
        });
        if (finalCdnUrl) {
          onChange(finalCdnUrl);
        }
      } catch (err) {
        console.error('Errore durante la sostituzione dell\'immagine:', err);
      } finally {
        setIsUploadingImage(false);
      }
    }
    setPendingFiles([]);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      FirebaseStorageService.deleteMedia(value).catch((err) => {
        console.warn('[SingleImage] Error deleting media file:', err);
      });
    }
    onChange('');
    setUrlDraft('');
  };

  const aspectClass =
    aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'banner'
      ? 'aspect-[21/9]'
      : '';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-content-1/70 flex items-center gap-1.5">
            <ImageIcon size={13} className="text-primary" />
            <span>{label}</span>
          </label>
          {value && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-primary flex items-center gap-1">
                <Check size={11} /> Immagine Pronta
              </span>
            </div>
          )}
        </div>
      )}

      {/* Uploading indicator */}
      {isUploadingImage && (
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-surface-2 border border-primary/30 text-primary text-xs font-mono">
          <Loader2 size={13} className="animate-spin" />
          <span>Salvataggio su Cloud Storage in corso...</span>
        </div>
      )}

      {/* If Image is already set, show preview card with quick actions */}
      {value && value.trim() ? (
        <div className="relative group rounded-2xl overflow-hidden border border-[#222] bg-[#111] shadow-xl">
          <div className={`w-full ${previewHeightClass || aspectClass} bg-[#111] flex items-center justify-center relative overflow-hidden`}>
            <img
              src={value}
              alt="Anteprima"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Quick Actions Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#111] hover:bg-surface-0 text-content-1 text-xs font-semibold flex items-center gap-1.5 border border-[#222] shadow-lg cursor-pointer"
                title="Ingrandisci a tutto schermo"
              >
                <Maximize2 size={13} />
                <span>Ingrandisci</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-800 text-red-200 text-xs font-semibold flex items-center gap-1.5 border border-red-500/30 shadow-lg cursor-pointer"
                title="Rimuovi e cambia immagine"
              >
                <X size={13} />
                <span>Rimuovi</span>
              </button>
            </div>
          </div>

          <div className="px-3 py-2 bg-surface-0 border-t border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] font-mono text-content-1/50">
            <span className="truncate max-w-[240px]">
              {value.startsWith('data:') ? 'Immagine caricata da file locale' : value}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-400/80 flex items-center gap-1" title="La sostituzione o rimozione eliminerà definitivamente il file precedente dallo storage">
                <AlertTriangle size={11} /> La sostituzione elimina il file precedente
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="text-primary hover:underline font-bold text-[10px] uppercase cursor-pointer shrink-0"
              >
                Cambia
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dual Mode Selection: Upload Local File OR Direct URL Input */
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-3 space-y-3 shadow-md">
          {/* Switcher Tab */}
          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-surface-3">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-primary text-surface-0 shadow-md'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
              }`}
            >
              <Upload size={13} />
              <span>Carica da Locale</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-primary text-surface-0 shadow-md'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
              }`}
            >
              <LinkIcon size={13} />
              <span>Link URL Web</span>
            </button>
          </div>

          {activeTab === 'upload' ? (
            /* Drag & Drop / File Selector Area */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileChange(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-3 hover:border-primary/60 bg-surface-2/60 hover:bg-surface-2'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFileChange(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-surface-3 flex items-center justify-center text-primary">
                <FileImage size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-content-1">Trascina un file immagine qui o clicca per sfogliare</p>
                <p className="text-[10px] text-content-3 font-mono mt-0.5">Supporta PNG, JPG, WEBP, GIF (ottimizzazione rapida automatica)</p>
              </div>
            </div>
          ) : (
            /* Direct Web URL Form (using div to prevent invalid nested form elements) */
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder={placeholder}
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={handleKeyDownUrl}
                  className="flex-1 bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-xs text-content-1 placeholder-content-3/60 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  disabled={!urlDraft.trim()}
                  className="px-4 py-2 bg-primary disabled:opacity-40 hover:bg-primary text-surface-0 font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  Applica
                </button>
              </div>
              <p className="text-[10px] text-content-3 font-mono">
                Incolla l'indirizzo HTTP/HTTPS di un'immagine esterna (Pinterest, Unsplash, Imgur, ArtStation...)
              </p>
            </div>
          )}
        </div>
      )}

      {helperText && !value && (
        <p className="text-[10px] text-content-3 font-mono italic">{helperText}</p>
      )}

      {/* Optimizer Modal for local files */}
      {pendingFiles.length > 0 && (
        <ImageOptimizerModal
          files={pendingFiles}
          onConfirm={handleOptimizerConfirm}
          onCancel={() => setPendingFiles([])}
        />
      )}

      {/* Lightbox full-size preview */}
      {isLightboxOpen && value && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-surface-0/80 backdrop-blur-md"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white p-2 cursor-pointer"
            >
              <X size={24} />
            </button>
            {value && value.trim() ? (
              <img
                src={value}
                alt="Visualizzazione ingrandita"
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-surface-3"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
