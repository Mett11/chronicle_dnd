/**
 * Utility functions for OpenRouter model sanitization and validation
 */

export function cleanOpenRouterModelId(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input.trim();
  // Strip quotes and markdown backticks
  cleaned = cleaned.replace(/^[`"'\[{\(\s]+|[`"'\]}\)\s]+$/g, '').trim();
  // Strip URL hostnames & paths: https://openrouter.ai/models/... or openrouter.ai/...
  cleaned = cleaned.replace(/^https?:\/\/openrouter\.ai\/models\//i, '');
  cleaned = cleaned.replace(/^https?:\/\/openrouter\.ai\//i, '');
  cleaned = cleaned.replace(/^openrouter\.ai\/models\//i, '');
  cleaned = cleaned.replace(/^openrouter\.ai\//i, '');
  // Strip 'models/' or 'model:' prefixes
  cleaned = cleaned.replace(/^models\//i, '');
  cleaned = cleaned.replace(/^model[:=]\s*/i, '');
  // Strip leading/trailing slashes
  cleaned = cleaned.replace(/^\/+|\/+$/g, '').trim();
  return cleaned;
}

export interface OpenRouterCatalogItem {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  isFree?: boolean;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
}

export const CURATED_OPENROUTER_MODELS: {
  id: string;
  name: string;
  badge: string;
  category: 'free' | 'popular' | 'reasoning';
  desc: string;
}[] = [
  // --- Modelli Gratuiti Attivi (:free) ---
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Auto-Router (:free)',
    badge: 'Router Auto',
    category: 'free',
    desc: 'Instrada automaticamente la richiesta verso il miglior modello gratuito disponibile in quel momento.',
  },
  {
    id: 'qwen/qwen3.8-27b:free',
    name: 'Qwen 3.8 27B (:free)',
    badge: 'Qwen 3.8',
    category: 'free',
    desc: 'Modello gratuito ad alte prestazioni con ottima capacità di comprensione del contesto e dell\'italiano.',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B IT (:free)',
    badge: 'Gemma 4',
    category: 'free',
    desc: 'Modello open-weights di Google per deduzioni e consultazioni veloci.',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google Gemma 4 26B A4B (:free)',
    badge: 'Gemma 4 A4B',
    category: 'free',
    desc: 'Architettura ottimizzata per risposte snelle sulle cronache.',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA Nemotron 3.5 Lightning (:free)',
    badge: 'NVIDIA Free',
    category: 'free',
    desc: 'Elaborazione ultra rapida a bassissima latenza per risposte immediate.',
  },
  {
    id: 'nex-agi/nex-n2.5-pro:free',
    name: 'Nex-N2.5 Pro (:free)',
    badge: 'Nex Pro Free',
    category: 'free',
    desc: 'Modello generativo ad ampio spettro con buone capacità di sintesi.',
  },
  {
    id: 'nex-agi/nex-n2.5-mini:free',
    name: 'Nex-N2.5 Mini (:free)',
    badge: 'Nex Mini Free',
    category: 'free',
    desc: 'Versione leggera e reattiva per consultazioni rapide.',
  },
  {
    id: 'z-ai/glm-5.2:free',
    name: 'GLM 5.2 (:free)',
    badge: 'GLM Free',
    category: 'free',
    desc: 'Modello versatile per riepiloghi e interrogazioni testuali.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Meta Llama 3.3 70B (:free)',
    badge: 'Llama 3.3 Free',
    category: 'free',
    desc: 'Modello ad alte prestazioni gratuito per estrazione e deduzione logica.',
  },

  // --- Modelli Standard con Credito (Priorità / Niente code) ---
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Meta Llama 3.3 70B',
    badge: 'Priorità Alta',
    category: 'popular',
    desc: 'Massima velocità e zero code pubbliche se hai credito sul tuo account OpenRouter.',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    badge: 'Narrativa Top',
    category: 'popular',
    desc: 'Il punto di riferimento assoluto per coerenza narrativa, stile epico e analisi trame.',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    badge: 'Economico & Rapido',
    category: 'popular',
    desc: 'Costo minimo per milione di token, velocità fulminea e grande accuratezza.',
  },
];
