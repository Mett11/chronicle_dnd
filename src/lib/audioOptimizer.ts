/**
 * Audio Optimization Utilities for Chronicle D&D
 * Transcodes and compresses audio files (MP3, WAV, M4A, OGG, WebM) client-side
 * to high-efficiency voice-optimized Opus / WebM / MP4 format (20 - 32 kbps mono).
 */

export interface AudioOptimizationResult {
  dataUrl: string;
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  durationSeconds: number;
  reductionPercentage: number;
  mimeType: string;
}

export type AudioQualityPreset = 'low' | 'balanced' | 'high';

export const AUDIO_PRESETS: Record<AudioQualityPreset, { label: string; bitrate: number; sampleRate: number; description: string }> = {
  low: {
    label: 'Ultra Compatto (Voce)',
    bitrate: 20000, // 20 kbps
    sampleRate: 22050,
    description: 'Ideale per note vocali lunghe (~150 KB al minuto)',
  },
  balanced: {
    label: 'Bilanciato (Consigliato)',
    bitrate: 32000, // 32 kbps
    sampleRate: 24000,
    description: 'Perfetto equilibrio tra chiarezza vocale e peso (~240 KB al minuto)',
  },
  high: {
    label: 'Alta Fedeltà (Musica / Effetti)',
    bitrate: 48000, // 48 kbps
    sampleRate: 44100,
    description: 'Maggiore definizione per musiche d\'atmosfera (~360 KB al minuto)',
  },
};

/**
 * Format bytes into human-readable text
 */
export function formatAudioBytes(bytes: number, decimals = 1): string {
  if (!+bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const iGrade = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.min(iGrade, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Detect the best supported audio MIME type for MediaRecorder in the current browser.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
  ];

  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'audio/webm';
}

/**
 * Downmixes an AudioBuffer to mono Float32Array
 */
function downmixToMono(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const monoData = new Float32Array(length);

  if (numChannels === 1) {
    monoData.set(buffer.getChannelData(0));
    return monoData;
  }

  for (let c = 0; c < numChannels; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      monoData[i] += channelData[i] / numChannels;
    }
  }

  return monoData;
}

/**
 * Encodes raw audio buffer into lightweight 16-bit Mono PCM WAV format.
 * Acts as a 100% reliable synchronous backup in case browser MediaRecorder transcoding fails.
 */
export function encodeMonoWav(audioBuffer: AudioBuffer, targetSampleRate = 22050): Blob {
  const monoData = downmixToMono(audioBuffer);
  const srcSampleRate = audioBuffer.sampleRate;
  
  // Resample if needed
  let finalData: Float32Array;
  const finalSampleRate = targetSampleRate;

  if (srcSampleRate === targetSampleRate) {
    finalData = monoData;
  } else {
    const ratio = srcSampleRate / targetSampleRate;
    const newLength = Math.round(monoData.length / ratio);
    const res = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const lower = Math.floor(srcIdx);
      const upper = Math.min(lower + 1, monoData.length - 1);
      const frac = srcIdx - lower;
      res[i] = monoData[lower] * (1 - frac) + monoData[upper] * frac;
    }
    finalData = res;
  }

  const numSamples = finalData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
  view.setUint32(24, finalSampleRate, true); // SampleRate
  view.setUint32(28, finalSampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, finalData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Optimizes an audio file or Blob using client-side Web Audio & MediaRecorder.
 * Transcodes to ultra-efficient Opus/WebM at the given bitrate preset.
 */
export async function optimizeAudioFile(
  input: File | Blob | string,
  preset: AudioQualityPreset = 'balanced'
): Promise<AudioOptimizationResult> {
  const config = AUDIO_PRESETS[preset];
  const mimeType = getSupportedAudioMimeType();

  // 1. Get raw ArrayBuffer from input
  let arrayBuffer: ArrayBuffer;
  let originalSize = 0;

  if (typeof input === 'string') {
    // Base64 data URL
    const res = await fetch(input);
    const blob = await res.blob();
    originalSize = blob.size;
    arrayBuffer = await blob.arrayBuffer();
  } else {
    originalSize = input.size;
    arrayBuffer = await input.arrayBuffer();
  }

  // 2. Decode audio data via Web Audio API
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (decodeErr) {
    await audioCtx.close();
    throw new Error('Formato audio non supportato dal browser per la decodifica.');
  }

  const duration = audioBuffer.duration;

  // 3. Try high-speed re-encoding via MediaStreamDestination + MediaRecorder
  let optimizedBlob: Blob | null = null;

  try {
    const streamDest = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Create recorder
    const recorder = new MediaRecorder(streamDest.stream, {
      mimeType,
      audioBitsPerSecond: config.bitrate,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recordPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };
      recorder.onerror = (err) => reject(err);
    });

    // Speed up playback rendering if audio is long (up to 4x speed)
    const playbackRate = duration > 30 ? 4.0 : duration > 10 ? 2.0 : 1.0;
    source.playbackRate.value = playbackRate;

    source.connect(streamDest);
    recorder.start(100);
    source.start(0);

    const adjustedDurationMs = (duration / playbackRate) * 1000 + 300;

    // Stop after duration
    setTimeout(() => {
      if (recorder.state === 'recording') {
        try {
          source.stop();
          recorder.stop();
        } catch {}
      }
    }, adjustedDurationMs);

    optimizedBlob = await recordPromise;
  } catch (recErr) {
    console.warn('Fast MediaRecorder transcoding fallback to Mono PCM WAV:', recErr);
    optimizedBlob = encodeMonoWav(audioBuffer, config.sampleRate);
  } finally {
    try {
      await audioCtx.close();
    } catch {}
  }

  if (!optimizedBlob || optimizedBlob.size === 0) {
    optimizedBlob = encodeMonoWav(audioBuffer, config.sampleRate);
  }

  // 4. Check if re-encoding actually reduced the size. If original is already smaller, keep original.
  let finalBlob = optimizedBlob;
  let finalDataUrl = '';

  if (originalSize > 0 && finalBlob.size >= originalSize) {
    // Original is already lighter (e.g. ultra-short 1-2s mic recording or already Opus compressed)
    if (typeof input === 'string') {
      finalDataUrl = input;
      finalBlob = new Blob([arrayBuffer], { type: mimeType });
    } else {
      finalBlob = input;
      finalDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(input);
      });
    }
  } else {
    finalDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(finalBlob);
    });
  }

  const optimizedSize = finalBlob.size;
  const reductionPercentage = originalSize > 0 
    ? Math.max(0, Math.round((1 - optimizedSize / originalSize) * 100))
    : 0;

  return {
    dataUrl: finalDataUrl,
    blob: finalBlob,
    originalSize,
    optimizedSize,
    durationSeconds: Math.round(duration),
    reductionPercentage,
    mimeType: finalBlob.type || mimeType,
  };
}
