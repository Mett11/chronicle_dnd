import { ApiKeyManager } from './apiKeyManager';

export interface GeminiModelItem {
  id: string;
  name: string;
  description: string;
  contextLength?: number;
  isFree: boolean;
  badge?: string;
  provider: 'gemini';
}

const DEFAULT_FALLBACK_MODELS: GeminiModelItem[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Velocità eccezionale, contesto esteso di 1 Milione di token e alta aderenza alle istruzioni.',
    isFree: true,
    contextLength: 1048576,
    badge: 'Consigliato',
    provider: 'gemini',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Latenza ridotta all\'estremo per risposte istantanee.',
    isFree: true,
    contextLength: 1048576,
    badge: 'Iper-Veloce',
    provider: 'gemini',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Capacità multimodale e ragionamento avanzato per domande complesse.',
    isFree: true,
    contextLength: 1048576,
    provider: 'gemini',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    description: 'Alias sempre aggiornato all\'ultima versione stabile di Gemini Flash.',
    isFree: true,
    contextLength: 1048576,
    provider: 'gemini',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Modello ragionativo di fascia alta per analisi enciclopediche e sintesi articolate.',
    isFree: true,
    contextLength: 2097152,
    badge: 'Pro Reasoning',
    provider: 'gemini',
  },
];

let cachedModels: GeminiModelItem[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches available Gemini models dynamically from Google Gemini API or backend server endpoint.
 * Fallbacks to default known models if offline or no API key available.
 */
export async function fetchAvailableGeminiModels(apiKeyOverride?: string, forceRefresh = false): Promise<GeminiModelItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedModels && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedModels;
  }

  const keys = await ApiKeyManager.getDecryptedKeys();
  const apiKey = (
    apiKeyOverride ||
    keys.geminiKey ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('chronicle_gemini_api_key') || '' : '')
  ).trim();

  // 1. Try server endpoint first
  try {
    const res = await fetch(`/api/ai/gemini/models${forceRefresh ? '?t=' + now : ''}`);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.models) && data.models.length > 0) {
        const mapped = data.models.map((m: any) => formatGeminiModelItem(m));
        cachedModels = mapped;
        lastFetchTime = now;
        return mapped;
      }
    }
  } catch (err) {
    // Silent fail over to direct client fetch
  }

  // 2. Direct client-side fetch using Google API if key is available
  if (apiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.models) && data.models.length > 0) {
          const validModels = data.models
            .filter((m: any) => {
              const name = String(m.name || m.id || '').toLowerCase();
              const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
              const supportsGenerate = methods.length === 0 || methods.includes('generateContent');
              const isGeminiTextModel = name.includes('gemini') && !name.includes('embedding') && !name.includes('imagen') && !name.includes('aqa');
              return isGeminiTextModel && supportsGenerate;
            })
            .map((m: any) => formatGeminiModelItem(m));

          if (validModels.length > 0) {
            // Sort models so flash/3.8/lite appear at top
            validModels.sort((a: GeminiModelItem, b: GeminiModelItem) => {
              const getScore = (id: string) => {
                if (id.includes('3.8-flash')) return 100;
                if (id.includes('3.1-flash-lite')) return 90;
                if (id.includes('3.7-flash')) return 85;
                if (id.includes('flash-latest')) return 80;
                if (id.includes('flash')) return 70;
                if (id.includes('pro')) return 60;
                return 50;
              };
              return getScore(b.id) - getScore(a.id);
            });

            cachedModels = validModels;
            lastFetchTime = now;
            return validModels;
          }
        }
      }
    } catch (directErr) {
      console.warn('[GeminiModels] Direct client fetch failed:', directErr);
    }
  }

  return DEFAULT_FALLBACK_MODELS;
}

function formatGeminiModelItem(m: any): GeminiModelItem {
  const rawId = String(m.id || m.name || '').replace(/^models\//, '');
  const displayName = m.displayName || m.name || rawId;

  let badge: string | undefined = undefined;
  if (rawId.includes('3.8-flash') || rawId.includes('flash-latest')) badge = 'Consigliato';
  else if (rawId.includes('3.1-flash-lite')) badge = 'Iper-Veloce';
  else if (rawId.includes('pro')) badge = 'Pro Reasoning';

  let description = m.description || 'Modello Google Gemini ufficialmente supportato.';
  if (rawId.includes('3.8')) {
    description = 'Velocità eccezionale, contesto esteso di 1 Milione di token e alta aderenza alle istruzioni.';
  } else if (rawId.includes('flash-lite')) {
    description = 'Latenza ridotta all\'estremo per risposte ed estrazioni istantanee.';
  }

  const inputLimit = typeof m.inputTokenLimit === 'number' ? m.inputTokenLimit : rawId.includes('pro') ? 2097152 : 1048576;

  return {
    id: rawId,
    name: displayName,
    description,
    isFree: true,
    contextLength: inputLimit,
    badge,
    provider: 'gemini',
  };
}
