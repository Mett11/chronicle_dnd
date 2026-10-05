import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Trash2, Mic, Clock, Download } from 'lucide-react';
import { AudioLog } from '../types';

interface AudioPlayerProps {
 log: AudioLog;
 onDelete?: (id: string) => void;
 compact?: boolean;
}

export function AudioPlayer({ log, onDelete, compact = false }: AudioPlayerProps) {
 const [isPlaying, setIsPlaying] = useState(false);
 const [currentTime, setCurrentTime] = useState(0);
 const [duration, setDuration] = useState(log.durationSeconds || 0);
 const [isMuted, setIsMuted] = useState(false);
 const audioRef = useRef<HTMLAudioElement | null>(null);

 useEffect(() => {
 const audio = audioRef.current;
 if (!audio) return;

 const updateTime = () => setCurrentTime(audio.currentTime);
 const setAudioDuration = () => {
 if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
 setDuration(audio.duration);
 }
 };
 const onEnded = () => setIsPlaying(false);

 audio.addEventListener('timeupdate', updateTime);
 audio.addEventListener('loadedmetadata', setAudioDuration);
 audio.addEventListener('ended', onEnded);

 return () => {
 audio.removeEventListener('timeupdate', updateTime);
 audio.removeEventListener('loadedmetadata', setAudioDuration);
 audio.removeEventListener('ended', onEnded);
 };
 }, []);

 const togglePlay = () => {
 if (!audioRef.current) return;
 if (isPlaying) {
 audioRef.current.pause();
 setIsPlaying(false);
 } else {
 audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
 }
 };

 const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
 const time = Number(e.target.value);
 setCurrentTime(time);
 if (audioRef.current) {
 audioRef.current.currentTime = time;
 }
 };

 const formatTime = (secs: number) => {
 if (isNaN(secs) || !isFinite(secs)) return '0:00';
 const m = Math.floor(secs / 60);
 const s = Math.floor(secs % 60);
 return `${m}:${s < 10 ? '0' : ''}${s}`;
 };

 if (compact) {
 return (
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111] border border-surface-2 text-content-1 shadow-sm">
 <audio ref={audioRef} src={log.audioUrl && log.audioUrl.trim() ? log.audioUrl : undefined} preload="metadata" />
 <button
 type="button"
 onClick={togglePlay}
 className="w-7 h-7 rounded-full bg-primary text-surface-0 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
 >
 {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
 </button>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-content-1 truncate">{log.title}</p>
 <span className="text-[10px] font-mono text-content-1/50">{formatTime(currentTime)} / {formatTime(duration)}</span>
 </div>
 {onDelete && (
 <button
 type="button"
 onClick={() => onDelete(log.id)}
 className="text-content-1/30 hover:text-red-400 p-1 rounded transition-colors"
 >
 <Trash2 size={13} />
 </button>
 )}
 </div>
 );
 }

 return (
 <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#09090B] to-[#0a0a10] border border-surface-2 text-content-1 shadow-lg flex flex-col gap-2.5">
 <audio ref={audioRef} src={log.audioUrl && log.audioUrl.trim() ? log.audioUrl : undefined} preload="metadata" />

 {/* Header with Title & Metadata */}
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2 min-w-0">
 <div className="w-8 h-8 rounded-full bg-primary/15 border border-surface-3 flex items-center justify-center text-primary shrink-0">
 <Mic size={15} />
 </div>
 <div className="min-w-0">
 <h4 className="font-semibold text-sm text-content-1 truncate leading-tight">{log.title}</h4>
 <div className="flex items-center gap-2 text-[10px] font-mono text-content-1/50 mt-0.5">
 {log.recordedBy && <span>Voce: <strong className="text-content-1/80">{log.recordedBy}</strong></span>}
 {log.loreDate && <span className="text-primary">&bull; {log.loreDate}</span>}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-1 shrink-0">
 <a
 href={log.audioUrl}
 download={`${log.title.replace(/\s+/g, '_')}.webm`}
 className="p-1.5 rounded-lg text-content-1/40 hover:text-primary hover:bg-content-1/5 transition-colors"
 title="Scarica traccia audio"
 >
 <Download size={14} />
 </a>
 {onDelete && (
 <button
 type="button"
 onClick={() => onDelete(log.id)}
 className="p-1.5 rounded-lg text-content-1/40 hover:text-red-400 hover:bg-content-1/5 transition-colors"
 title="Elimina nota vocale"
 >
 <Trash2 size={14} />
 </button>
 )}
 </div>
 </div>

 {/* Waveform Equalizer Bars Animation when Playing */}
 <div className="flex items-center justify-between gap-1 h-5 px-1.5 bg-[#111] rounded-lg overflow-hidden">
 {Array.from({ length: 24 }).map((_, i) => {
 const delay = ((i % 6) * 0.15).toFixed(2);
 const duration = (0.7 + (i % 4) * 0.2).toFixed(2);
 return (
 <div
 key={i}
 className="w-1 bg-primary rounded-full sound-wave-bar"
 style={{
 height: isPlaying ? '90%' : '20%',
 opacity: isPlaying ? 0.9 : 0.25,
 animation: isPlaying ? `soundWave ${duration}s ease-in-out ${delay}s infinite alternate` : 'none',
 }}
 />
 );
 })}
 </div>

 {/* Controls & Progress Bar */}
 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={togglePlay}
 className="w-9 h-9 rounded-full bg-primary text-surface-0 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-sm shrink-0 font-bold"
 >
 {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
 </button>

 <div className="flex-1 flex flex-col gap-1">
 <input
 type="range"
 min="0"
 max={duration || 100}
 value={currentTime}
 onChange={handleSeek}
 className="w-full accent-[#2563EB] h-1.5 bg-content-1/10 rounded-lg cursor-pointer appearance-none"
 />
 <div className="flex items-center justify-between text-[10px] font-mono text-content-1/50">
 <span>{formatTime(currentTime)}</span>
 <span>{formatTime(duration)}</span>
 </div>
 </div>

 <button
 type="button"
 onClick={() => {
 if (audioRef.current) {
 audioRef.current.muted = !isMuted;
 setIsMuted(!isMuted);
 }
 }}
 className="text-content-1/40 hover:text-content-1 transition-colors p-1"
 >
 {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
 </button>
 </div>
 </div>
 );
}
