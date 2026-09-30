import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Save,
  Upload,
  AlertCircle,
  RefreshCw,
  X,
  Zap,
  ShieldCheck,
  Sparkles,
  Check,
  Loader2,
  Volume2,
} from 'lucide-react';
import { AudioLog } from '../types';
import { useAuth } from './AuthProvider';
import { Portal } from './Portal';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { CampaignManager } from '../store/campaignStore';
import {
  getSupportedAudioMimeType,
  formatAudioBytes,
  optimizeAudioFile,
  AudioQualityPreset,
  AUDIO_PRESETS,
  AudioOptimizationResult,
} from '../lib/audioOptimizer';

export interface AudioOptimizerModalProps {
  file: File;
  onConfirm: (result: { dataUrl: string; durationSeconds: number; title: string }) => void;
  onCancel: () => void;
}

export function AudioOptimizerModal({ file, onConfirm, onCancel }: AudioOptimizerModalProps) {
  const [preset, setPreset] = useState<AudioQualityPreset>('balanced');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AudioOptimizationResult | null>(null);
  const [title, setTitle] = useState(() => file.name.replace(/\.[^/.]+$/, ''));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleOptimize = async (selectedPreset = preset) => {
    setIsProcessing(true);
    setErrorMessage(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      const optResult = await optimizeAudioFile(file, selectedPreset);
      setResult(optResult);
    } catch (err: any) {
      console.error('Audio optimization error:', err);
      setErrorMessage(err?.message || 'Impossibile ottimizzare questo file audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    handleOptimize('balanced');
  }, [file]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleConfirm = () => {
    if (!result) return;
    onConfirm({
      dataUrl: result.dataUrl,
      durationSeconds: result.durationSeconds,
      title: title.trim() || file.name,
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-surface-0/80 backdrop-blur-md">
        <div className="rounded-2xl max-w-xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col bg-surface-1 border border-surface-3 shadow-2xl overflow-hidden shrink-0 text-content-1 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-surface-3 p-4 sm:p-5 bg-surface-2/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-content-1 uppercase text-xs sm:text-sm tracking-wider flex items-center gap-2">
                  <span>Ottimizzazione Audio Intelligente</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-normal">
                    Opus/WebM
                  </span>
                </h3>
                <p className="text-[11px] text-content-3">
                  Riduci drasticamente il peso per il Cloud preservando le voci
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-content-3 hover:text-content-1 p-1.5 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <X size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title & File Info */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-primary">
                Titolo della Registrazione
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome audio..."
                className="w-full bg-surface-0 border border-surface-3 rounded-xl px-3.5 py-2.5 text-xs text-content-1 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Quality Presets Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-content-3">
                  Profilo di Compressione
                </label>
                <span className="text-[10px] font-mono text-primary">Codec Opus 24-48 kHz Mono</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(Object.keys(AUDIO_PRESETS) as AudioQualityPreset[]).map((pKey) => {
                  const p = AUDIO_PRESETS[pKey];
                  const isSelected = preset === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setPreset(pKey);
                        handleOptimize(pKey);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-sm text-content-1'
                          : 'bg-surface-2/60 border-surface-3 hover:border-surface-4 text-content-2'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content-1">{p.label}</span>
                        {isSelected && <Sparkles size={13} className="text-primary shrink-0" />}
                      </div>
                      <p className="text-[10px] text-content-3 leading-snug">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comparison Box */}
            <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-surface-0/60 rounded-xl border border-surface-3/60">
                  <p className="text-[10px] uppercase font-bold text-content-3 mb-1">File Originale</p>
                  <p className="text-sm font-mono font-bold text-red-400">
                    {formatAudioBytes(file.size)}
                  </p>
                  <p className="text-[10px] text-content-3 mt-0.5 truncate">{file.type || 'audio/*'}</p>
                </div>

                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/30 relative overflow-hidden">
                  <p className="text-[10px] uppercase font-bold text-emerald-400 mb-1 flex items-center justify-center gap-1">
                    <ShieldCheck size={12} />
                    <span>Ottimizzato</span>
                  </p>
                  <p className="text-sm font-mono font-bold text-emerald-400">
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-1 text-xs">
                        <Loader2 size={13} className="animate-spin" /> Compressione...
                      </span>
                    ) : result ? (
                      formatAudioBytes(result.optimizedSize)
                    ) : (
                      '---'
                    )}
                  </p>
                  {result && !isProcessing && (
                    <p className="text-[10px] text-emerald-500/80 mt-0.5 font-bold font-mono">
                      -{result.reductionPercentage}% di spazio
                    </p>
                  )}
                </div>
              </div>

              {/* Space Savings Banner */}
              {result && !isProcessing && result.reductionPercentage > 0 && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-center flex items-center justify-center gap-2">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <p className="text-xs text-content-1 font-medium">
                    Risparmio del{' '}
                    <strong className="text-emerald-400 font-mono">-{result.reductionPercentage}%</strong>{' '}
                    di traffico Cloud e storage!
                  </p>
                </div>
              )}

              {/* Audio Preview Player */}
              {result && !isProcessing && (
                <div className="p-3.5 bg-surface-0/80 rounded-xl border border-surface-3 space-y-2">
                  <audio
                    ref={audioRef}
                    src={result.dataUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-surface-0 flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer shrink-0"
                      >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                      </button>
                      <div>
                        <p className="text-xs font-bold text-content-1 truncate max-w-[200px]">
                          {title || 'Audio Ottimizzato'}
                        </p>
                        <p className="text-[10px] font-mono text-content-3">
                          {formatSecs(currentTime)} / {formatSecs(result.durationSeconds)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOptimize()}
                      className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ricomprimi"
                    >
                      <RefreshCw size={11} />
                      <span>Riprova</span>
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={result.durationSeconds || 1}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-surface-3 bg-surface-1">
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
              disabled={isProcessing || !result}
              className="bg-primary hover:bg-primary text-surface-0 px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check size={14} />
              <span>
                Conferma e Salva ({result ? formatAudioBytes(result.optimizedSize) : '...'})
              </span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

interface AudioRecorderProps {
  onSave: (log: Omit<AudioLog, 'id' | 'createdAt'>) => void;
  onCancel?: () => void;
  loreDate?: string;
  associatedType?: 'session' | 'entity' | 'note' | 'general';
  associatedId?: string;
  defaultTitle?: string;
}

export function AudioRecorder({
  onSave,
  onCancel,
  loreDate,
  associatedType = 'general',
  associatedId,
  defaultTitle = 'Nota Vocale di Sessione',
}: AudioRecorderProps) {
  const { player } = useAuth();
  const [title, setTitle] = useState(defaultTitle);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSizeBytes, setAudioSizeBytes] = useState<number>(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File optimizer modal state
  const [fileToOptimize, setFileToOptimize] = useState<File | null>(null);
  const [isCompressingExisting, setIsCompressingExisting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Timer logic for recording
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      // 1. Request microphone with speech optimizations
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // 2. Select optimal voice-compressed MIME type
      const mimeType = getSupportedAudioMimeType();
      
      // 3. Configure lightweight speech bitrate (24 kbps)
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 24000, // 24 kbps = ~180 KB/min (voice optimized)
        });
      } catch (optErr) {
        // Fallback without bitrate constraints
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioSizeBytes(audioBlob.size);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
          setAudioDuration(recordingTime);
        };
        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setErrorMessage(
        'Impossibile accedere al microfono. Verifica i permessi del browser o carica direttamente un file audio.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
      setErrorMessage('Seleziona un file audio valido (MP3, WAV, M4A, OGG, WebM).');
      return;
    }

    // Trigger interactive Audio Optimizer modal
    setFileToOptimize(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [optimizationNote, setOptimizationNote] = useState<string | null>(null);

  const handleReOptimizeCurrentAudio = async () => {
    if (!audioUrl) return;
    setIsCompressingExisting(true);
    setOptimizationNote(null);
    try {
      const res = await optimizeAudioFile(audioUrl, 'low');
      if (res.optimizedSize < audioSizeBytes) {
        setAudioUrl(res.dataUrl);
        setAudioSizeBytes(res.optimizedSize);
        setAudioDuration(res.durationSeconds || audioDuration);
        setOptimizationNote(`Ottimizzato: risparmiato ${res.reductionPercentage}%`);
      } else {
        setOptimizationNote('Audio già al massimo livello di compressione (Opus 24 kbps).');
      }
    } catch (err) {
      console.error('Errore durante la compressione aggiuntiva:', err);
    } finally {
      setIsCompressingExisting(false);
    }
  };

  const togglePreview = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch(() => setIsPlayingPreview(false));
    }
  };

  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);

  const handleSave = async () => {
    if (!audioUrl) {
      setErrorMessage('Nessun audio registrato o caricato.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Inserisci un titolo per la registrazione.');
      return;
    }

    setIsUploadingToCloud(true);
    try {
      const code = CampaignManager.getActiveCampaignCode() || 'default';
      const cdnUrl = await FirebaseStorageService.uploadMedia(
        code,
        'audio',
        `${title.trim()}.webm`,
        audioUrl
      );

      onSave({
        title: title.trim(),
        audioUrl: cdnUrl || audioUrl,
        durationSeconds: audioDuration || recordingTime || 1,
        recordedBy: player?.characterName || 'Voce Ignota',
        loreDate,
        associatedType,
        associatedId,
      });
    } catch (err) {
      console.error('Errore caricamento audio su Firebase Storage:', err);
      // Fallback
      onSave({
        title: title.trim(),
        audioUrl,
        durationSeconds: audioDuration || recordingTime || 1,
        recordedBy: player?.characterName || 'Voce Ignota',
        loreDate,
        associatedType,
        associatedId,
      });
    } finally {
      setIsUploadingToCloud(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      <div className="border border-surface-3 rounded-2xl p-5 flex flex-col gap-4 text-content-1 max-w-lg w-full bg-surface-1 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 pb-3">
          <div className="flex items-center gap-2 text-primary">
            <Mic size={18} />
            <h3 className="font-semibold text-base text-content-1">Registra Diario Vocale / Memoria</h3>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
            Titolo della registrazione
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es: Rivelazione della Sfinge, Discorso del Barone..."
            className="w-full bg-surface-0 border border-surface-3 rounded-xl px-3 py-2 text-sm text-content-1 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Recording Stage */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-2/60 border border-surface-3 gap-3 relative overflow-hidden">
          {/* Live Audio Visualizer / Timer */}
          {isRecording ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-500 animate-pulse shadow-sm">
                <Mic size={28} />
              </div>
              <div className="flex items-center gap-2 text-red-500 font-mono font-bold text-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>REGISTRAZIONE IN CORSO: {formatTimer(recordingTime)}</span>
              </div>
              <p className="text-[11px] text-content-3">Cattura vocale compressa ad alta efficienza (~24 kbps Opus).</p>
            </div>
          ) : audioUrl ? (
            <div className="w-full flex flex-col items-center gap-3">
              <audio
                ref={previewAudioRef}
                src={audioUrl}
                onEnded={() => setIsPlayingPreview(false)}
              />
              <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-primary">
                <Mic size={20} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-content-1">Audio Pronto per il Salvataggio</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] font-mono text-content-3">
                    Durata: {formatTimer(audioDuration || recordingTime)}
                  </span>
                  {audioSizeBytes > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <ShieldCheck size={10} />
                      {formatAudioBytes(audioSizeBytes)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={togglePreview}
                  className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-surface-4 text-content-1 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isPlayingPreview ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlayingPreview ? 'Metti in Pausa' : 'Ascolta Anteprima'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReOptimizeCurrentAudio}
                  disabled={isCompressingExisting}
                  className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-primary/30"
                  title="Comprimi ulteriormente con profilo Ultra Compatto"
                >
                  <Zap size={13} className={isCompressingExisting ? 'animate-spin' : ''} />
                  <span>{isCompressingExisting ? 'Compressione...' : 'Ottimizza Spazio'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAudioUrl(null);
                    setIsPlayingPreview(false);
                    setAudioSizeBytes(0);
                    setOptimizationNote(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Rifai</span>
                </button>
              </div>

              {optimizationNote && (
                <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 text-center animate-in fade-in">
                  {optimizationNote}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-surface-3 flex items-center justify-center text-primary">
                <Mic size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-content-1">Inizia Registrazione Vocale</p>
                <p className="text-xs text-content-3 mt-0.5">
                  Cattura note a caldo, interpretazioni o carica file audio ottimizzati
                </p>
              </div>
            </div>
          )}

          {/* Action Controls */}
          <div className="flex items-center gap-3 mt-2">
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Square size={14} className="fill-white" />
                <span>Ferma Registrazione</span>
              </button>
            ) : (
              !audioUrl && (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary text-surface-0 font-bold text-xs flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Mic size={15} />
                    <span>Avvia Microfono</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-full bg-surface-3 hover:bg-surface-4 text-content-1 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-3"
                  >
                    <Upload size={14} />
                    <span>Carica File Audio</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </>
              )
            )}
          </div>
        </div>

        {/* Save Action Footer */}
        {audioUrl && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-xs font-semibold cursor-pointer"
              >
                Annulla
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isUploadingToCloud}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-surface-0 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform hover:scale-105 cursor-pointer"
            >
              {isUploadingToCloud ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Caricamento su Cloud...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Salva nel Diario della Campagna</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Audio Optimizer Modal (when uploading audio files) */}
      {fileToOptimize && (
        <AudioOptimizerModal
          file={fileToOptimize}
          onConfirm={({ dataUrl, durationSeconds, title: optTitle }) => {
            setAudioUrl(dataUrl);
            setAudioDuration(durationSeconds);
            setTitle(optTitle);
            // approximate base64 bytes
            const b64len = dataUrl.length - (dataUrl.indexOf(',') + 1);
            setAudioSizeBytes(Math.floor((b64len * 3) / 4));
            setFileToOptimize(null);
          }}
          onCancel={() => setFileToOptimize(null)}
        />
      )}
    </>
  );
}
