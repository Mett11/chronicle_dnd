import React, { useRef, useState } from 'react';
import { Loader2, Sparkles, ScanText, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';

declare const puter: any;

interface OcrButtonProps {
  onScanComplete: (text: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function OcrButton({
  onScanComplete,
  label = 'Scannerizza / Trascrivi con OCR',
  className = '',
  compact = false,
}: OcrButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [engineUsedNotice, setEngineUsedNotice] = useState<string | null>(null);

  // Helper to convert File to Base64 Data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to safely extract text from Puter.js OCR result
  const extractPuterOcrText = (res: any): string => {
    if (!res) return '';
    if (typeof res === 'string') return res;
    if (typeof res.text === 'string') return res.text;
    if (Array.isArray(res)) {
      return res.map((r: any) => (typeof r === 'string' ? r : r?.text || '')).join('\n');
    }
    if (res.pages && Array.isArray(res.pages)) {
      return res.pages.map((p: any) => p?.text || '').join('\n');
    }
    return '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatus('idle');
    setErrorMessage(null);
    setEngineUsedNotice(null);

    try {
      const dataUrl = await fileToDataUrl(file);

      // 1. Primary Engine: Server Gemini Vision Cascade (gemini-2.5-flash -> gemini-2.0-flash)
      let serverText = '';
      let shouldTryPuterFallback = false;

      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        const responseText = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(responseText);
        } catch {
          // parse failed
        }

        if (response.ok && data?.text) {
          serverText = data.text;
        } else {
          shouldTryPuterFallback = true;
          console.warn('[OCR Server Warning] Server OCR response not ok, preparing Puter fallback:', data?.error || response.status);
        }
      } catch (netErr) {
        shouldTryPuterFallback = true;
        console.warn('[OCR Server Network Error] Falling back to Puter.js OCR:', netErr);
      }

      // If Server Gemini succeeded:
      if (serverText.trim()) {
        onScanComplete(serverText);
        setScanStatus('success');
        setTimeout(() => setScanStatus('idle'), 3000);
        return;
      }

      // 2. Client Fallback: Puter.js OCR (Mistral OCR / AWS Textract - No Server Quota Limits)
      if (shouldTryPuterFallback || !serverText.trim()) {
        if (typeof puter !== 'undefined' && puter?.ai?.img2txt) {
          console.log('[OCR Fallback] Executing Puter.js img2txt (Mistral / Textract)...');
          try {
            // First try with Mistral OCR for rich handwriting/document structuring
            let puterRes: any = null;
            try {
              puterRes = await puter.ai.img2txt(dataUrl, { model: 'mistral' });
            } catch {
              puterRes = await puter.ai.img2txt(dataUrl);
            }

            const puterText = extractPuterOcrText(puterRes);
            if (puterText.trim()) {
              onScanComplete(puterText);
              setScanStatus('success');
              setEngineUsedNotice('Trascritto con il motore OCR di riserva (Mistral OCR).');
              setTimeout(() => setEngineUsedNotice(null), 4500);
              setTimeout(() => setScanStatus('idle'), 3000);
              return;
            }
          } catch (puterErr: any) {
            console.warn('[Puter OCR Error]:', puterErr);
          }
        }
      }

      throw new Error('Nessun testo leggibile rilevato dall\'immagine. Prova con una foto più nitida o ravvicinata.');
    } catch (err: any) {
      console.error('OCR error:', err);
      setErrorMessage(err?.message || 'Impossibile elaborare l\'immagine. Riprova più tardi.');
      setScanStatus('error');
      setTimeout(() => setScanStatus('idle'), 5000);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="ocr-file-upload"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isScanning}
        title="Carica o scatta una foto di appunti cartacei per trascriverli automaticamente con l'AI"
        className={`group relative flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
          compact
            ? 'px-2.5 py-1.5 text-xs rounded-lg'
            : 'px-3.5 py-2 text-xs rounded-xl'
        } ${
          scanStatus === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            : scanStatus === 'error'
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
            : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 shadow-xs'
        } ${className}`}
      >
        {isScanning ? (
          <>
            <Loader2 size={compact ? 13 : 15} className="animate-spin text-primary shrink-0" />
            <span className="font-semibold text-primary">Trascrizione AI in corso...</span>
          </>
        ) : scanStatus === 'success' ? (
          <>
            <CheckCircle2 size={compact ? 13 : 15} className="text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-400">Trascritto!</span>
          </>
        ) : scanStatus === 'error' ? (
          <>
            <AlertCircle size={compact ? 13 : 15} className="text-rose-400 shrink-0" />
            <span className="font-semibold text-rose-400">Errore OCR</span>
          </>
        ) : (
          <>
            <ScanText size={compact ? 13 : 15} className="text-primary group-hover:scale-110 transition-transform shrink-0" />
            <span>{label}</span>
            <Sparkles size={11} className="text-amber-400 animate-pulse shrink-0" />
          </>
        )}
      </button>

      {engineUsedNotice && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-surface-1 border border-amber-500/40 text-amber-300 text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-1.5 font-medium">
          <Cpu size={12} className="text-amber-400 shrink-0" />
          <span>{engineUsedNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-surface-1 border border-rose-500/40 text-rose-300 text-[11px] p-2 rounded-lg shadow-xl whitespace-nowrap">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
