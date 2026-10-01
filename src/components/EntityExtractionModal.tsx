import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Check,
  X,
  Users,
  Ghost,
  MapPin,
  Tag,
  Shield,
  BookOpen,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  Info,
  Key,
  ChevronDown,
  Cpu,
  Zap,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Entity } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { cleanOpenRouterModelId } from '../lib/openrouterUtils';
import { UserPreferencesService } from '../lib/userPreferencesService';
import { LlmCatalogModal, LlmProviderType } from './OpenRouterCatalogModal';
import { Portal } from './Portal';
import {
  findOrphanMentions,
  extractAllMentions,
  normalizeMentionKey,
  OrphanMentionInfo,
} from '../lib/mentionUtils';

export interface ExtractedEntityItem {
  id: string; // temp id for UI selection
  name: string;
  type: Entity['type'];
  description: string;
  status?: Entity['status'];
  location?: string;
  aliases?: string[];
  selected: boolean;
  isPartyMember?: boolean;
  matchedPlayerName?: string;
  convertedToParty?: boolean;
}

interface EntityExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  onApplied: (newEntitiesCreated: Entity[], updatedTextWithMentions?: string) => void;
}

const TYPE_CONFIG: Record<
  Entity['type'],
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }
> = {
  npc: { label: 'PNG / Alleato', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  place: { label: 'Luogo / Mappa', icon: MapPin, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/25' },
  monster: { label: 'Mostro / Nemico', icon: Ghost, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25' },
  item: { label: 'Oggetto Magico', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  faction: { label: 'Fazione / Ordine', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25' },
  quest: { label: 'Quest / Missione', icon: Tag, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25' },
};

export function EntityExtractionModal({
  isOpen,
  onClose,
  rawText,
  onApplied,
}: EntityExtractionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ExtractedEntityItem[]>([]);
  const [existingDetected, setExistingDetected] = useState<string[]>([]);
  const [autoTagInText, setAutoTagInText] = useState(true);
  const [hasScanned, setHasScanned] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const currentRequestIdRef = React.useRef<number>(0);
  const timeoutIdRef = React.useRef<any>(null);
  const lastProcessedTextRef = React.useRef<string>('');

  const cancelAnalysis = React.useCallback((isClosing = false) => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentRequestIdRef.current += 1;
    setIsLoading(false);
    if (!isClosing) {
      setErrorMessage('Analisi annullata dall\'utente.');
    }
  }, []);

  const handleCloseModal = React.useCallback(() => {
    cancelAnalysis(true);
    onClose();
  }, [cancelAnalysis, onClose]);

  // Handle ESC key to cancel & close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCloseModal]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // When isOpen changes or rawText changes: reset state, NEVER AUTO-START!
  React.useEffect(() => {
    if (isOpen) {
      if (rawText !== lastProcessedTextRef.current) {
        cancelAnalysis(true);
        lastProcessedTextRef.current = rawText;
        setItems([]);
        setExistingDetected([]);
        setErrorMessage(null);
        setHasScanned(false);
      }
    } else {
      cancelAnalysis(true);
    }
  }, [isOpen, rawText, cancelAnalysis]);

  const [provider, setProvider] = useState<LlmProviderType>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.extractorProvider) return prefs.ai.extractorProvider as LlmProviderType;
    try {
      const saved = localStorage.getItem('chronicle_extraction_provider') as LlmProviderType;
      if (saved) return saved;
    } catch {}
    return 'gemini';
  });

  const [geminiModel, setGeminiModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.extractorGeminiModel) return prefs.ai.extractorGeminiModel;
    try {
      const saved = localStorage.getItem('chronicle_extraction_gemini_model') || localStorage.getItem('chronicle_oracle_gemini_model');
      if (saved) return saved;
    } catch {}
    return 'gemini-flash-latest';
  });

  const [cloudflareModel, setCloudflareModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.extractorCloudflareModel) return prefs.ai.extractorCloudflareModel;
    try {
      const saved = localStorage.getItem('chronicle_extraction_cloudflare_model') || localStorage.getItem('chronicle_oracle_cloudflare_model');
      if (saved) return saved;
    } catch {}
    return '@cf/meta/llama-3.3-70b-instruct-fp8';
  });

  const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.extractorOpenrouterModel) return cleanOpenRouterModelId(prefs.ai.extractorOpenrouterModel);
    try {
      const saved = localStorage.getItem('chronicle_extraction_openrouter_model') || localStorage.getItem('chronicle_oracle_openrouter_model');
      if (saved) return cleanOpenRouterModelId(saved);
    } catch {}
    return 'openrouter/free';
  });

  // Listen to preferences update
  useEffect(() => {
    const handlePrefsUpdate = (e: any) => {
      const p = e?.detail?.preferences?.ai;
      if (p) {
        if (p.extractorProvider) setProvider(p.extractorProvider as LlmProviderType);
        if (p.extractorGeminiModel) setGeminiModel(p.extractorGeminiModel);
        if (p.extractorOpenrouterModel) setOpenrouterModel(cleanOpenRouterModelId(p.extractorOpenrouterModel));
        if (p.extractorCloudflareModel) setCloudflareModel(p.extractorCloudflareModel);
      }
    };
    window.addEventListener('chronicle_user_preferences_updated', handlePrefsUpdate);
    return () => window.removeEventListener('chronicle_user_preferences_updated', handlePrefsUpdate);
  }, []);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  const activeModelId = useMemo(() => {
    if (provider === 'openrouter') return openrouterModel;
    return geminiModel;
  }, [provider, openrouterModel, geminiModel]);

  // Deterministically compute all mentions and orphan mentions present in rawText
  const allMentions = useMemo(() => {
    return extractAllMentions(rawText);
  }, [rawText]);

  const orphanMentions = useMemo(() => {
    const existingEntities = CampaignManager.getEntities();
    const players = CampaignManager.getStoredPlayers();
    return findOrphanMentions(rawText, existingEntities, players);
  }, [rawText]);

  const unhandledOrphans = useMemo(() => {
    const itemNorms = new Set(items.map((i) => normalizeMentionKey(i.name)));
    return orphanMentions.filter((o) => !itemNorms.has(o.normalized));
  }, [orphanMentions, items]);

  const [draftingOrphans, setDraftingOrphans] = useState<Record<string, boolean>>({});
  const [isDraftingAllOrphans, setIsDraftingAllOrphans] = useState(false);

  // Client-side fallback API key (stored in localStorage for static deploys like Cloudflare)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('chronicle_gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Helper to draft a single entity card from an orphan mention
  const draftSingleOrphanCore = async (orphan: OrphanMentionInfo, signal?: AbortSignal): Promise<ExtractedEntityItem | null> => {
    const keys = await ApiKeyManager.getDecryptedKeys();
    const campKeys = await ApiKeyManager.preloadCampaignKeys();
    const persKeys = await ApiKeyManager.preloadPersonalKeys();

    const activeCustomKey = customApiKey.trim();
    const geminiKey = activeCustomKey || keys.geminiKey || campKeys.geminiKey || persKeys.geminiKey;
    const openrouterKey = keys.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey;
    const cfAccountId = keys.cloudflareAccountId || campKeys.cloudflareAccountId || persKeys.cloudflareAccountId;
    const cfToken = keys.cloudflareApiToken || campKeys.cloudflareApiToken || persKeys.cloudflareApiToken;

    // 1. Try server endpoint first
    try {
      const res = await fetch('/api/ai/draft-entity-from-mention', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(activeCustomKey ? { 'x-custom-api-key': activeCustomKey } : {}),
        },
        body: JSON.stringify({
          mentionName: orphan.name,
          snippets: orphan.snippets,
          fullText: rawText.slice(0, 10000),
          provider,
          model: activeModelId,
          geminiApiKey: geminiKey,
          openrouterApiKey: openrouterKey,
          cloudflareAccountId: cfAccountId,
          cloudflareApiToken: cfToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.entity) {
          const e = data.entity;
          const type = (['npc', 'place', 'monster', 'item', 'faction', 'quest'].includes(e.type) ? e.type : 'npc') as Entity['type'];
          return {
            id: `orphan_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: e.name || orphan.name,
            type,
            description: e.description || '',
            status: e.status || (type === 'quest' ? 'open' : 'alive'),
            location: e.location || '',
            aliases: Array.isArray(e.aliases) ? e.aliases : [],
            selected: true,
            isPartyMember: Boolean(e.isPartyMember),
          };
        }
      }
    } catch {}

    // 2. Direct client fallback with Gemini if available
    if (geminiKey && provider === 'gemini') {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const resp = await ai.models.generateContent({
          model: activeModelId || 'gemini-flash-latest',
          contents: [{
            role: 'user',
            parts: [{
              text: `Analizza l'entità "${orphan.name}" nel seguente contesto:\n${orphan.snippets.join('\n')}\nCrea un JSON con: name, type ('npc'|'place'|'monster'|'item'|'faction'|'quest'), description, status, location.`
            }]
          }],
          config: { responseMimeType: 'application/json', temperature: 0.1 }
        });
        const parsed = JSON.parse(resp.text || '{}');
        const type = (['npc', 'place', 'monster', 'item', 'faction', 'quest'].includes(parsed.type) ? parsed.type : 'npc') as Entity['type'];
        return {
          id: `orphan_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: parsed.name || orphan.name,
          type,
          description: parsed.description || '',
          status: parsed.status || (type === 'quest' ? 'open' : 'alive'),
          location: parsed.location || '',
          aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
          selected: true,
          isPartyMember: Boolean(parsed.isPartyMember),
        };
      } catch {}
    }

    // 3. Simple quick fallback
    return {
      id: `orphan_quick_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: orphan.name,
      type: 'npc',
      description: orphan.snippets.length > 0 ? orphan.snippets[0].replace(/\.\.\./g, '').trim() : '',
      status: 'alive',
      location: '',
      aliases: [],
      selected: true,
      isPartyMember: false,
    };
  };

  const handleDraftOrphan = async (orphan: OrphanMentionInfo) => {
    setDraftingOrphans((prev) => ({ ...prev, [orphan.name]: true }));
    try {
      const drafted = await draftSingleOrphanCore(orphan);
      if (drafted) {
        setItems((prev) => {
          const filtered = prev.filter((i) => normalizeMentionKey(i.name) !== orphan.normalized);
          return [drafted, ...filtered];
        });
        setHasScanned(true);
      }
    } finally {
      setDraftingOrphans((prev) => ({ ...prev, [orphan.name]: false }));
    }
  };

  const handleDraftAllOrphans = async () => {
    if (unhandledOrphans.length === 0) return;
    setIsDraftingAllOrphans(true);
    try {
      const newDrafted: ExtractedEntityItem[] = [];
      for (const orphan of unhandledOrphans) {
        setDraftingOrphans((prev) => ({ ...prev, [orphan.name]: true }));
        try {
          const item = await draftSingleOrphanCore(orphan);
          if (item) newDrafted.push(item);
        } finally {
          setDraftingOrphans((prev) => ({ ...prev, [orphan.name]: false }));
        }
      }
      if (newDrafted.length > 0) {
        setItems((prev) => {
          const existingNorms = new Set(newDrafted.map((d) => normalizeMentionKey(d.name)));
          const filtered = prev.filter((p) => !existingNorms.has(normalizeMentionKey(p.name)));
          return [...newDrafted, ...filtered];
        });
        setHasScanned(true);
      }
    } finally {
      setIsDraftingAllOrphans(false);
    }
  };

  const handleQuickAddOrphan = (orphan: OrphanMentionInfo) => {
    const newItem: ExtractedEntityItem = {
      id: `orphan_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: orphan.name,
      type: 'npc',
      description: orphan.snippets.length > 0 ? orphan.snippets[0].replace(/\.\.\./g, '').trim() : '',
      status: 'alive',
      location: '',
      aliases: [],
      selected: true,
      isPartyMember: false,
    };
    setItems((prev) => {
      const filtered = prev.filter((i) => normalizeMentionKey(i.name) !== orphan.normalized);
      return [newItem, ...filtered];
    });
    setHasScanned(true);
  };

  // Helper to parse and humanize raw Gemini errors (especially 429 Quota Exceeded and 503 Overload)
  const parseExtractionError = (raw: any): { title: string; message: string; retryDelay?: number; isQuota: boolean } => {
    let text = typeof raw === 'string' ? raw : raw?.message || 'Si è verificato un errore durante l\'analisi.';
    let isQuota = false;
    let retryDelay: number | undefined;

    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED' || parsed.isQuota) {
          isQuota = true;
          const msg = String(parsed.error.message || parsed.error);
          const delayMatch = msg.match(/retry in ([\d.]+)s/i);
          if (delayMatch) retryDelay = Math.ceil(parseFloat(delayMatch[1]));
          const modelMatch = msg.match(/model:\s*([a-zA-Z0-9.-]+)/);
          const modelName = modelMatch ? modelMatch[1] : '';

          return {
            title: 'Limite di Quota Gratuita Superato (429 Rate Limit)',
            message: `La chiave API ha esaurito il limite di richieste gratuite per ${modelName || 'il modello selezionato'} (Free Tier Google). ${
              retryDelay
                ? `Google richiede un'attesa di circa ${retryDelay} secondi prima di riprovare.`
                : 'Puoi riprovare tra circa 30 secondi, oppure rimuovere la chiave personale per usare il motore del Server.'
            }`,
            retryDelay,
            isQuota: true,
          };
        }
        text = parsed.error.message || (typeof parsed.error === 'string' ? parsed.error : text);
      }
    } catch {}

    if (text.includes('RESOURCE_EXHAUSTED') || text.includes('429') || text.toLowerCase().includes('quota exceeded') || text.includes('limit: 20')) {
      const delayMatch = text.match(/retry in ([\d.]+)s/i);
      if (delayMatch) retryDelay = Math.ceil(parseFloat(delayMatch[1]));
      return {
        title: 'Limite di Quota Gratuita Superato (429 Rate Limit)',
        message: `Hai superato il limite di richieste gratuite (Free Tier: 20 richieste) per questo modello su Google AI Studio. ${
          retryDelay
            ? `Google richiede un'attesa di circa ${retryDelay} secondi prima di riprovare.`
            : 'Riprova tra circa 30 secondi, oppure prova con il motore integrato del Server.'
        }`,
        retryDelay,
        isQuota: true,
      };
    }

    if (text.includes('503') || text.includes('overloaded') || text.includes('UNAVAILABLE')) {
      return {
        title: 'Servizio Gemini momentaneamente sovraccarico (503)',
        message: 'I server di Google Gemini sono attualmente ad alta richiesta. Clicca su Riprova per tentare con i modelli di riserva.',
        isQuota: false,
      };
    }

    return {
      title: 'Errore durante l\'analisi',
      message: text,
      isQuota: false,
    };
  };

  const extractWithClientGemini = async (apiKeyToUse: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    const existingEntities = CampaignManager.getEntities();
    const existingNames = existingEntities.map((e) => e.name);
    const players = CampaignManager.getStoredPlayers();
    const playerNames = players.map((p) => p.characterName);

    const cleanTextForAnalysis = rawText
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
      .replace(/@+/g, '');

    const knownEntitiesPrompt = existingNames.length > 0
      ? `Ecco le entità già registrate nel compendio/codex della campagna (NON estrarle MAI come newEntities): ${existingNames.slice(0, 300).join(', ')}.`
      : '';

    const knownPlayersPrompt = playerNames.length > 0
      ? `Ecco i Personaggi Giocanti (PG / membri del party avventurieri): ${playerNames.join(', ')}.`
      : '';

    const taggedOrphansPrompt = orphanMentions.length > 0
      ? `\n\nTAG ESPLICITI @ DELL'AUTORE DA INCLUDERE OBBLIGATORIAMENTE:\nL'autore ha contrassegnato con '@' i seguenti elementi chiave nel testo: ${orphanMentions.map((o) => o.name).join(', ')}.\nDEVI PRIORITARIAMENTE estrarre ciascuno di questi elementi in 'newEntities' deducendone la tipologia corretta (npc, monster, place, item, faction, quest) e la descrizione dal contesto!`
      : '';

    const systemInstruction = `Sei un assistente specializzato per Dungeon Master di D&D e giochi di ruolo fantasy.
Il tuo compito è analizzare la cronaca di una sessione di gioco ed estrarre con estrema precisione le entità del mondo fantasy: PNG (personaggi non giocanti del DM), Mostri/Nemici, Luoghi/Città/Dungeon/Istituzioni, Fazioni/Ordini/Gilde, Oggetti Magici/Reliquie e Missioni/Quest citati nel testo.

${knownEntitiesPrompt}
${knownPlayersPrompt}
${taggedOrphansPrompt}

REGOLE CRITICHE SUI NOMI E SULL'ESTRAZIONE:
1. NOMI COMPLETI E MAI TRONCATI: Estrai sempre il NOME COMPLETO E PROPRIO per esteso dell'entità, inclusi toponimi, sigle, titoli e complementi.
   - ESEMPI CORRETTI: "Accademia T.A.V.", "Porta Lumìnia", "Terra di Fiumi Spezzati", "Aula Magna", "Telonius", "Vhalheim".
2. TIPOLOGIE AMMESSE: 'type' deve essere uno tra: 'npc', 'monster', 'place', 'item', 'faction', 'quest'.
3. PERSONAGGI GIOCANTI / PARTY: Se un personaggio menzionato sembra essere un eroe/PG del party (anche se l'utente non lo ha ancora registrato), inseriscilo in 'newEntities' impostando 'isPartyMember': true.
4. ENTITÀ GIÀ REGISTRATE: Se un'entità è già presente nell'elenco fornito, NON inserirla in 'newEntities'; segnalala solo in 'existingDetected'.
5. QUALITÀ: Non inventare entità inesistenti. Non estrarre parole comuni isolate.
6. STRUTTURA:
   - 'name': Nome proprio completo e pulito.
   - 'type': 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest'.
   - 'description': Descrizione sintetica (2-4 frasi in italiano) basata ESCLUSIVAMENTE sui fatti accaduti in questa sessione.
   - 'status': 'alive' | 'dead' | 'open' | 'completed'.
   - 'location': Luogo in cui si trova, se specificato.
   - 'aliases': Eventuali soprannomi o acronimi.
   - 'isPartyMember': boolean opzionale (true se si tratta o sembra un Personaggio Giocante/Eroe del party).

Rispondi ESCLUSIVAMENTE in formato JSON valido conforme al seguente schema:
{
  "newEntities": [
    {
      "name": "string",
      "type": "npc" | "monster" | "place" | "item" | "faction" | "quest",
      "description": "string",
      "status": "alive" | "dead" | "open" | "completed",
      "location": "string",
      "aliases": ["string"],
      "isPartyMember": false
    }
  ],
  "existingDetected": ["string"]
}`;

    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
    ];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Analizza questa cronaca di sessione ed estrai con nomi completi le entità secondo le istruzioni:\n\n${cleanTextForAnalysis.slice(0, 40000)}`,
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const responseText = response.text || '';
        if (responseText.trim()) {
          let parsedJson: any = null;
          try {
            parsedJson = JSON.parse(responseText);
          } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedJson = JSON.parse(jsonMatch[0]);
            }
          }
          if (parsedJson) {
            return { ...parsedJson, model: modelName };
          }
        }
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') throw err;
        lastError = err;
        const status = err?.status || err?.statusCode;
        const msg = String(err?.message || err);
        const isTemporaryOverload =
          status === 503 ||
          status === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('overloaded') ||
          msg.includes('high demand') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('temporarily unavailable');

        console.warn(`Model ${modelName} failed (${status || 'err'}), trying next candidate:`, msg);
        if (isTemporaryOverload) {
          // Pause briefly unless aborted
          await new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
            const onAbort = () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            const timer = setTimeout(() => {
              signal?.removeEventListener('abort', onAbort);
              resolve(null);
            }, 1200);
          });
        }
      }
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw lastError || new Error('Nessun modello Gemini ha risposto correttamente.');
  };

  const extractWithClientOpenRouter = async (apiKeyToUse: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const existingEntities = CampaignManager.getEntities();
    const existingNames = existingEntities.map((e) => e.name);
    const players = CampaignManager.getStoredPlayers();
    const playerNames = players.map((p) => p.characterName);

    const cleanTextForAnalysis = rawText
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
      .replace(/@+/g, '');

    const taggedOrphansPrompt = orphanMentions.length > 0
      ? `Tag @ orfani prioritari da estrarre ed analizzare: ${orphanMentions.map((o) => o.name).join(', ')}.`
      : '';

    const systemInstruction = `Sei un assistente specializzato per Dungeon Master di D&D.
Analizza la cronaca di sessione ed estrai con estrema precisione SOLO le NUOVE entità (PNG, Mostri, Luoghi, Oggetti, Fazioni, Quest).
${taggedOrphansPrompt}
Entità già note: ${existingNames.slice(0, 300).join(', ')}.
PG del party: ${playerNames.join(', ')}.

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "newEntities": [
    {
      "name": "string",
      "type": "npc" | "monster" | "place" | "item" | "faction" | "quest",
      "description": "string",
      "status": "alive" | "dead" | "open" | "completed",
      "location": "string",
      "aliases": ["string"]
    }
  ],
  "existingDetected": ["string"]
}`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKeyToUse}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModelId || 'openrouter/free',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: cleanTextForAnalysis.slice(0, 30000) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const resData = await res.json().catch(() => ({}));
    const rawContent = resData.choices?.[0]?.message?.content || '';
    if (rawContent) {
      try { return { ...JSON.parse(rawContent), model: activeModelId }; } catch {}
      const m = rawContent.match(/\{[\s\S]*\}/);
      if (m) { try { return { ...JSON.parse(m[0]), model: activeModelId }; } catch {} }
    }
    throw new Error(resData?.error?.message || 'Errore nella risposta JSON da OpenRouter.');
  };

  const extractWithClientCloudflare = async (accountId: string, token: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const existingEntities = CampaignManager.getEntities();
    const existingNames = existingEntities.map((e) => e.name);
    const players = CampaignManager.getStoredPlayers();
    const playerNames = players.map((p) => p.characterName);

    const cleanTextForAnalysis = rawText
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
      .replace(/@+/g, '');

    const systemInstruction = `Sei un assistente per Dungeon Master di D&D.
Analizza la cronaca ed estrai le NUOVE entità in formato JSON (newEntities, existingDetected).
Entità già note: ${existingNames.slice(0, 300).join(', ')}.
PG party: ${playerNames.join(', ')}.`;

    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModelId || '@cf/meta/llama-3.3-70b-instruct-fp8',
        messages: [
          { role: 'system', content: `${systemInstruction}\n\nRispondi SOLO in formato JSON.` },
          { role: 'user', content: cleanTextForAnalysis.slice(0, 30000) },
        ],
        temperature: 0.1,
      }),
    });

    const resData = await res.json().catch(() => ({}));
    let answer = resData?.choices?.[0]?.message?.content || resData?.result?.response || '';
    if (typeof answer === 'object') answer = JSON.stringify(answer);
    if (answer) {
      try { return { ...JSON.parse(answer), model: activeModelId }; } catch {}
      const m = answer.match(/\{[\s\S]*\}/);
      if (m) { try { return { ...JSON.parse(m[0]), model: activeModelId }; } catch {} }
    }
    throw new Error(resData?.errors?.[0]?.message || 'Errore nella risposta JSON da Cloudflare Workers AI.');
  };

  const startAnalysis = async (forceServer = false) => {
    if (!rawText || !rawText.trim()) {
      setErrorMessage('Inserisci prima il testo della sessione nell\'editor.');
      return;
    }

    // Cancel any ongoing task first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const thisRequestId = ++currentRequestIdRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    // Safety timeout: 45 seconds max
    timeoutIdRef.current = setTimeout(() => {
      if (currentRequestIdRef.current === thisRequestId && !abortController.signal.aborted) {
        abortController.abort();
        setIsLoading(false);
        setErrorMessage('L\'analisi ha impiegato troppo tempo (timeout di sicurezza dopo 45s). Puoi riprovare o cambiare modello.');
      }
    }, 45000);

    const activeCustomKey = forceServer ? '' : customApiKey.trim();
    const keys = await ApiKeyManager.getDecryptedKeys();
    const campKeys = await ApiKeyManager.preloadCampaignKeys();
    const persKeys = await ApiKeyManager.preloadPersonalKeys();

    if (abortController.signal.aborted || thisRequestId !== currentRequestIdRef.current) return;

    const isMissingKey = provider === 'openrouter' && !keys.openrouterKey && !campKeys.openrouterKey && !persKeys.openrouterKey;

    if (isMissingKey) {
      setErrorMessage(`Credenziali per ${provider.toUpperCase()} non configurate nelle Impostazioni. Configura la chiave API prima di avviare l'analisi.`);
      setIsLoading(false);
      return;
    }

    if (provider === 'openrouter' && ApiKeyManager.isOpenRouterPaidBlocked()) {
      const isFree = activeModelId.endsWith(':free') || activeModelId.includes(':free') || activeModelId === 'openrouter/free';
      if (!isFree) {
        setErrorMessage(`Il modello OpenRouter "${activeModelId}" è a pagamento ed è bloccato dalla salvaguardia crediti. Seleziona un modello gratuito (:free) o sblocca i consumi nelle Impostazioni.`);
        setIsLoading(false);
        return;
      }
    }

    try {
      const existingEntities = CampaignManager.getEntities();
      const existingNames = existingEntities.map((e) => e.name);
      const players = CampaignManager.getStoredPlayers();
      const playerNames = players.map((p) => p.characterName);

      let data: any = null;

      // Helper for direct client execution fallback
      const executeDirectClientExtraction = async () => {
        if (provider === 'gemini') {
          const effectiveKey = activeCustomKey || keys.geminiKey || campKeys.geminiKey || persKeys.geminiKey;
          if (effectiveKey) return await extractWithClientGemini(effectiveKey, abortController.signal);
        } else if (provider === 'openrouter') {
          const effectiveOrKey = keys.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey;
          if (effectiveOrKey) return await extractWithClientOpenRouter(effectiveOrKey, abortController.signal);
        } else if (provider === 'cloudflare') {
          const cfId = keys.cloudflareAccountId || campKeys.cloudflareAccountId || persKeys.cloudflareAccountId;
          const cfToken = keys.cloudflareApiToken || campKeys.cloudflareApiToken || persKeys.cloudflareApiToken;
          if (cfId && cfToken) {
            return await extractWithClientCloudflare(cfId, cfToken, abortController.signal);
          }
        }
        throw new Error('Credenziali mancanti per l\'esecuzione diretta client.');
      };

      // 1. Try server-side endpoint first
      try {
        let response = await fetch('/api/ai/extract-entities', {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(activeCustomKey ? { 'x-custom-api-key': activeCustomKey } : {}),
          },
          body: JSON.stringify({
            text: rawText,
            existingEntityNames: existingNames,
            playerNames,
            provider,
            model: activeModelId,
            geminiApiKey: activeCustomKey || keys.geminiKey || campKeys.geminiKey || persKeys.geminiKey,
            openrouterApiKey: keys.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey,
            cloudflareAccountId: keys.cloudflareAccountId || campKeys.cloudflareAccountId || persKeys.cloudflareAccountId,
            cloudflareApiToken: keys.cloudflareApiToken || campKeys.cloudflareApiToken || persKeys.cloudflareApiToken,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await response.json().catch(() => null);
          }
        }
      } catch (fetchErr: any) {
        if (abortController.signal.aborted || thisRequestId !== currentRequestIdRef.current || fetchErr?.name === 'AbortError') {
          return;
        }
        // Silent fail over to direct client extraction below
      }

      if (abortController.signal.aborted || thisRequestId !== currentRequestIdRef.current) return;

      // 2. Seamless client fallback if server endpoint returned non-200 or 404 (static host like Cloudflare Pages)
      if (!data) {
        data = await executeDirectClientExtraction();
      }

      if (abortController.signal.aborted || thisRequestId !== currentRequestIdRef.current) return;

      if (!data) {
        throw new Error('Nessun dato restituito dall\'analisi.');
      }

      const normalizeStr = (s: string) => {
        if (!s) return '';
        return s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
      };

      const existingSet = new Set<string>();
      existingEntities.forEach((e) => {
        const norm = normalizeStr(e.name);
        if (norm) existingSet.add(norm);
        if (Array.isArray(e.aliases)) {
          e.aliases.forEach((a) => {
            const aNorm = normalizeStr(a);
            if (aNorm) existingSet.add(aNorm);
          });
        }
      });

      const playerNormMap = new Map<string, string>();
      players.forEach((p) => {
        if (p.characterName) {
          const norm = normalizeStr(p.characterName);
          if (norm) playerNormMap.set(norm, p.characterName);
        }
        if (Array.isArray(p.aliases)) {
          p.aliases.forEach((a) => {
            const aNorm = normalizeStr(a);
            if (aNorm) playerNormMap.set(aNorm, p.characterName);
          });
        }
      });

      const detectedExistingSet = new Set<string>(
        (Array.isArray(data.existingDetected) ? data.existingDetected : [])
          .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
      );

      const parsedItems: ExtractedEntityItem[] = [];

      (Array.isArray(data.newEntities) ? data.newEntities : []).forEach((ent: any, idx: number) => {
        if (!ent || !ent.name || typeof ent.name !== 'string') return;
        const rawName = ent.name.trim();
        const nameNorm = normalizeStr(rawName);
        if (!nameNorm) return;

        const aliases = Array.isArray(ent.aliases) ? ent.aliases : [];
        const aliasesNorm = aliases.map((a: string) => normalizeStr(a)).filter(Boolean);

        // Check if matches an existing compendium entity
        const matchesExisting = existingSet.has(nameNorm) || aliasesNorm.some((a: string) => existingSet.has(a));
        if (matchesExisting) {
          detectedExistingSet.add(rawName);
          return;
        }

        // Check if matches a Party Member
        const matchedPlayerName = playerNormMap.get(nameNorm) || aliasesNorm.map((a: string) => playerNormMap.get(a)).find(Boolean);
        const isPartyMember = Boolean(matchedPlayerName || ent.isPartyMember);

        const type = (['npc', 'place', 'monster', 'item', 'faction', 'quest'].includes(ent.type)
          ? ent.type
          : 'npc') as Entity['type'];

        let status: Entity['status'] = 'alive';
        if (type === 'quest') {
          status = ent.status === 'completed' ? 'completed' : 'open';
        } else {
          status = ent.status === 'dead' ? 'dead' : 'alive';
        }

        parsedItems.push({
          id: `extracted_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          name: rawName,
          type,
          description: ent.description?.trim() || '',
          status,
          location: ent.location || '',
          aliases,
          selected: true,
          isPartyMember,
          matchedPlayerName: matchedPlayerName || (isPartyMember ? rawName : undefined),
          convertedToParty: false,
        });
      });

      setItems(parsedItems);
      setExistingDetected(Array.from(detectedExistingSet));
      setModelUsed(data.model || 'Gemini');
      setHasScanned(true);
      setShowKeyInput(false);
    } catch (err: any) {
      if (abortController.signal.aborted || thisRequestId !== currentRequestIdRef.current || err?.name === 'AbortError') {
        return;
      }
      console.error('Extraction error:', err);
      setErrorMessage(err.message || 'Si è verificato un errore durante l\'analisi del testo.');
    } finally {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (thisRequestId === currentRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleConvertToParty = (item: ExtractedEntityItem) => {
    CampaignManager.addUnregisteredPlayer(item.name.trim());
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, convertedToParty: true, selected: false, isPartyMember: false }
          : i
      )
    );
    setExistingDetected((prev) =>
      prev.includes(item.name.trim()) ? prev : [...prev, item.name.trim()]
    );
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('chronicle_gemini_api_key', customApiKey.trim());
    } catch {}
    setErrorMessage(null);
    startAnalysis();
  };

  const handleRemoveApiKey = () => {
    try {
      localStorage.removeItem('chronicle_gemini_api_key');
    } catch {}
    setCustomApiKey('');
    setShowKeyInput(false);
    setErrorMessage(null);
    startAnalysis(true);
  };

  if (!isOpen) return null;

  const selectedCount = items.filter((i) => i.selected).length;

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems(items.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleToggleItem = (id: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));
  };

  const handleUpdateItem = (id: string, updates: Partial<ExtractedEntityItem>) => {
    setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const handleApply = () => {
    const toCreate = items.filter((i) => i.selected && i.name.trim());
    const createdList: Entity[] = [];

    toCreate.forEach((item) => {
      const defaultStatus: Entity['status'] = item.type === 'quest' ? 'open' : 'alive';
      const safeStatus: Entity['status'] =
        item.status && ['alive', 'dead', 'open', 'completed'].includes(item.status)
          ? item.status
          : defaultStatus;

      const newEnt = CampaignManager.addEntity({
        name: item.name.trim(),
        type: item.type,
        progressNote: item.description.trim(),
        status: safeStatus,
        location: item.location?.trim() || undefined,
        aliases: item.aliases && item.aliases.length > 0 ? item.aliases : undefined,
      });
      createdList.push(newEnt);
    });

    let updatedText = rawText;
    if (autoTagInText) {
      // Collect all entity and player names that should be tagged in the text:
      // 1. Newly created entities
      // 2. Existing entities detected by the IA analysis
      // 3. Registered codex entities mentioned in text
      // 4. Party adventurers mentioned in text
      const allNamesToTag = new Set<string>();

      createdList.forEach((ent) => {
        if (ent.name?.trim()) allNamesToTag.add(ent.name.trim());
      });

      (existingDetected || []).forEach((name) => {
        if (name?.trim()) allNamesToTag.add(name.trim());
      });

      const codexEntities = CampaignManager.getEntities();
      codexEntities.forEach((ent) => {
        if (ent.name?.trim()) {
          const clean = ent.name.trim();
          if (rawText.toLowerCase().includes(clean.toLowerCase())) {
            allNamesToTag.add(clean);
          }
        }
      });

      const players = CampaignManager.getPlayers();
      players.forEach((p) => {
        if (p.characterName?.trim()) {
          const clean = p.characterName.trim();
          if (rawText.toLowerCase().includes(clean.toLowerCase())) {
            allNamesToTag.add(clean);
          }
        }
      });

      // Sort entities by name length descending so compound names like "Porta Lumìnia" are tagged before single words like "Porta"
      const sortedNames = Array.from(allNamesToTag).sort((a, b) => b.length - a.length);

      sortedNames.forEach((cleanName) => {
        if (!cleanName) return;
        const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Check if name has spaces or special punctuation; if so, we tag as @[Full Name] or @FullName
        const tagFormat = cleanName.includes(' ') || cleanName.includes('.') ? `@[${cleanName}]` : `@${cleanName}`;

        // Replace occurrences not preceded by @ or [ and not followed by ]
        const regex = new RegExp(`(?<![@\\[\\w\u00C0-\u017F])(${escaped})(?![\\w\\]\u00C0-\u017F])`, 'gi');
        updatedText = updatedText.replace(regex, tagFormat);
      });

      // Cleanup any accidental double @@@ or @ @ artifacts
      updatedText = updatedText.replace(/@\s*@+/g, '@');
      // Normalize any @@[...] to @[...]
      updatedText = updatedText.replace(/@@\[(.*?)\]/g, '@[$1]');
    }

    onApplied(createdList, autoTagInText ? updatedText : undefined);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-fade-in">
        <div className="relative w-full max-w-4xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden my-auto text-content-1 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-2 bg-surface-1 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-base sm:text-lg text-content-1 flex items-center gap-2">
                  <span>Estrazione Entità con IA</span>
                  {modelUsed && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {modelUsed}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-content-3">
                  Rileva automaticamente nuovi personaggi, luoghi e oggetti dalla cronaca e genera le relative descrizioni.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-primary/40 text-xs font-mono transition-all cursor-pointer shadow-xs"
                title="Scegli Provider e Modello AI per l'estrazione"
              >
                {provider === 'openrouter' ? (
                  <Zap size={14} className="text-indigo-400 shrink-0" />
                ) : (
                  <Sparkles size={14} className="text-primary shrink-0" />
                )}
                <span className="font-bold text-content-1 truncate max-w-[120px] sm:max-w-[180px]">{activeModelId}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-1 text-content-3 border border-surface-3">
                  {provider}
                </span>
                <ChevronDown size={12} className="text-content-3 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
                title="Chiudi ed annulla"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {/* ORPHAN TAGS DETECTION & AI DRAFTING BAR */}
            {orphanMentions.length > 0 && !isLoading && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 animate-fade-in shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div className="space-y-0.5">
                    <h4 className="font-heading font-semibold text-xs sm:text-sm text-amber-300 flex items-center gap-2">
                      <Tag size={16} className="text-amber-400 shrink-0" />
                      <span>Tag @ Orfani Rilevati nella Cronaca ({orphanMentions.length})</span>
                    </h4>
                    <p className="text-[11px] text-content-3">
                      Elementi taggati con <code>@</code> che non hanno ancora una scheda nel Compendio. Puoi compilarli singolarmente o tutti insieme con l'IA.
                    </p>
                  </div>

                  {unhandledOrphans.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDraftAllOrphans}
                      disabled={isDraftingAllOrphans}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                    >
                      {isDraftingAllOrphans ? (
                        <Loader2 size={13} className="animate-spin text-amber-300" />
                      ) : (
                        <Sparkles size={13} className="text-amber-300" />
                      )}
                      <span>
                        {isDraftingAllOrphans
                          ? 'Compilazione in corso...'
                          : `Compila tutti con IA (${unhandledOrphans.length})`}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {orphanMentions.map((orphan) => {
                    const isDraftingThis = Boolean(draftingOrphans[orphan.name]);
                    const isAlreadyInItems = items.some(
                      (i) => normalizeMentionKey(i.name) === orphan.normalized
                    );

                    return (
                      <div
                        key={orphan.name}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all border ${
                          isAlreadyInItems
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-surface-2/80 border-surface-3 hover:border-amber-500/40 text-content-1'
                        }`}
                      >
                        <span className="font-semibold font-mono text-[11px]">
                          @{orphan.name}
                        </span>

                        {orphan.occurrences > 1 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-3 text-content-3 font-mono">
                            x{orphan.occurrences}
                          </span>
                        )}

                        {isAlreadyInItems ? (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                            <Check size={12} strokeWidth={3} /> In lista
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 pl-1 border-l border-surface-3/80">
                            <button
                              type="button"
                              onClick={() => handleDraftOrphan(orphan)}
                              disabled={isDraftingThis || isDraftingAllOrphans}
                              className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-amber-100 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              title="Compila automaticamente scheda e descrizione con l'IA"
                            >
                              {isDraftingThis ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Sparkles size={10} />
                              )}
                              <span>{isDraftingThis ? 'Elaboro...' : 'Compila con IA'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickAddOrphan(orphan)}
                              className="px-1.5 py-0.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-content-3 hover:text-content-1 text-[10px] transition-colors cursor-pointer"
                              title="Aggiungi manualmente alla lista"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="py-14 text-center space-y-5 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse shadow-sm">
                  <Loader2 size={28} className="animate-spin" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-heading font-semibold text-sm sm:text-base text-content-1">
                    Analisi della Cronaca in corso...
                  </h4>
                  <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
                    {provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} sta leggendo il testo della sessione, identificando figure chiave, toponimi e generando le schede contestualizzate.
                  </p>
                </div>
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => cancelAnalysis(false)}
                    className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-rose-500/15 border border-surface-3 hover:border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <X size={14} />
                    <span>Annulla Analisi</span>
                  </button>
                </div>
              </div>
            ) : errorMessage ? (
              (() => {
                const isUserCancelled = errorMessage.includes('annullata');
                if (isUserCancelled) {
                  return (
                    <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto my-8 animate-fade-in">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                        <AlertCircle size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-heading font-semibold text-sm text-content-1">
                          Analisi Annullata
                        </h4>
                        <p className="text-xs text-content-3">
                          L'elaborazione è stata interrotta. Puoi riavviarla in qualsiasi momento cliccando sul tasto sottostante.
                        </p>
                      </div>
                      <div className="pt-2 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startAnalysis()}
                          className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Sparkles size={14} />
                          <span>Riavvia Analisi</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Chiudi
                        </button>
                      </div>
                    </div>
                  );
                }
                const formattedErr = parseExtractionError(errorMessage);
                return (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-center space-y-4 max-w-xl mx-auto">
                    <AlertCircle size={28} className="mx-auto text-rose-400" />
                    <div className="space-y-1">
                      <h4 className="font-heading font-semibold text-sm text-rose-300">
                        {formattedErr.title}
                      </h4>
                      <p className="text-xs text-content-2 leading-relaxed">{formattedErr.message}</p>
                    </div>

                    {customApiKey && (
                      <div className="bg-surface-2/80 border border-surface-3 rounded-xl p-3 text-xs text-content-2 text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-content-1 flex items-center gap-1.5">
                            <Key size={13} className="text-primary" />
                            Chiave API personale attiva nel browser
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveApiKey}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                          >
                            Rimuovi chiave
                          </button>
                        </div>
                        <p className="text-[11px] text-content-3">
                          La quota gratuita per Gemini su Google AI Studio prevede un limite di 20 richieste al giorno per modello. Puoi rimuovere la chiave personale per usare il motore integrato del Server.
                        </p>
                        <button
                          type="button"
                          onClick={() => startAnalysis(true)}
                          className="w-full py-1.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Usa Motore Server
                        </button>
                      </div>
                    )}

                    {showKeyInput && !customApiKey && (
                      <form onSubmit={handleSaveApiKey} className="max-w-md mx-auto bg-surface-2/60 border border-surface-3 rounded-xl p-3.5 space-y-2.5 text-left">
                        <label className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                          <Key size={13} className="text-primary" />
                          <span>Chiave API Gemini personale (Opzionale)</span>
                        </label>
                        <input
                          type="password"
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full bg-surface-1 border border-surface-3 rounded-lg px-3 py-1.5 text-xs text-content-1 focus:border-primary outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!customApiKey.trim()}
                          className="w-full py-1.5 bg-primary hover:bg-primary-hover text-surface-0 text-xs font-semibold rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          Salva e Riprova
                        </button>
                      </form>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startAnalysis(false)}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-surface-0 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Sparkles size={13} /> Riprova Analisi
                      </button>
                      {!customApiKey && !showKeyInput && (
                        <button
                          type="button"
                          onClick={() => setShowKeyInput(true)}
                          className="px-3 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 border border-surface-3 cursor-pointer transition-colors"
                        >
                          <Key size={13} /> Inserisci Chiave API Personale
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : !hasScanned ? (
              <div className="py-8 sm:py-12 max-w-xl mx-auto text-center space-y-6 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto text-primary shadow-sm">
                  <Sparkles size={32} />
                </div>

                <div className="space-y-2">
                  <h4 className="font-heading font-bold text-lg text-content-1">
                    Estrazione Automatica Entità dalla Cronaca
                  </h4>
                  <p className="text-xs sm:text-sm text-content-3 leading-relaxed">
                    L'Intelligenza Artificiale analizzerà il testo di questa sessione per estrarre nuovi PNG, mostri, luoghi, oggetti magici, fazioni e quest, generando automaticamente schede e descrizioni coerenti.
                  </p>
                </div>

                {/* Text summary preview card */}
                <div className="bg-surface-2/70 border border-surface-3 rounded-xl p-3.5 text-left space-y-2 text-xs">
                  <div className="flex items-center justify-between text-content-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={14} className="text-primary" />
                      <span>Testo pronto per l'analisi</span>
                    </span>
                    <span className="font-mono text-[11px] text-content-3">
                      {rawText.trim().length} caratteri • ~{rawText.trim().split(/\s+/).filter(Boolean).length} parole
                    </span>
                  </div>
                  <div className="bg-surface-1/80 border border-surface-3/80 rounded-lg p-2.5 max-h-32 overflow-y-auto font-mono text-[11px] text-content-3 leading-relaxed whitespace-pre-wrap select-none custom-scrollbar">
                    {rawText.trim().slice(0, 600)}
                    {rawText.trim().length > 600 && '...'}
                  </div>
                </div>

                {/* Manual Start Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => startAnalysis()}
                    disabled={!rawText?.trim()}
                    className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-hover text-surface-0 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={16} />
                    <span>Avvia Analisi & Estrazione</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full sm:w-auto px-4 py-3 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            ) : items.length === 0 && hasScanned ? (
              <div className="py-10 text-center space-y-3 bg-surface-2/40 border border-surface-3 rounded-2xl p-6">
                <BookOpen size={32} className="mx-auto text-content-3 opacity-60" />
                <h4 className="font-heading font-semibold text-sm text-content-1">
                  Nessuna nuova entità rilevata
                </h4>
                <p className="text-xs text-content-3 max-w-md mx-auto">
                  I nomi identificati sono già registrati nel compendio oppure non ci sono ulteriori elementi da registrare.
                </p>
                {existingDetected.length > 0 && (
                  <div className="pt-2 max-w-lg mx-auto space-y-3 text-left bg-surface-1 border border-surface-3 rounded-xl p-3.5">
                    <span className="text-xs text-content-1 font-semibold flex items-center gap-1.5">
                      <Info size={14} className="text-primary shrink-0" />
                      <span>{existingDetected.length} entità del Codex rilevate nella cronaca:</span>
                    </span>
                    <p className="text-xs text-content-2 pl-5 font-mono">
                      {existingDetected.join(', ')}
                    </p>
                    <label className="flex items-center gap-2 text-xs text-content-2 cursor-pointer select-none pl-5 pt-1 border-t border-surface-3/60">
                      <input
                        type="checkbox"
                        checked={autoTagInText}
                        onChange={(e) => setAutoTagInText(e.target.checked)}
                        className="rounded text-primary focus:ring-primary/20 accent-primary"
                      />
                      <span>Marca automaticamente queste entità con @tag nel testo della sessione</span>
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => startAnalysis()}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer mt-2"
                >
                  <Sparkles size={13} className="text-primary" /> Riesegui Analisi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Control bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2/60 border border-surface-3 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      {items.every((i) => i.selected) ? (
                        <CheckSquare size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                      <span>
                        {items.every((i) => i.selected) ? 'Deseleziona tutti' : 'Seleziona tutti'}
                      </span>
                    </button>
                    <span className="text-xs text-content-3">
                      ({selectedCount} di {items.length} entità selezionate)
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-content-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoTagInText}
                      onChange={(e) => setAutoTagInText(e.target.checked)}
                      className="rounded border-surface-3 text-primary focus:ring-0 cursor-pointer"
                    />
                    <span>Formatta automaticamente con tag <strong className="text-primary">@Nome</strong> nel testo</span>
                  </label>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {items.map((item) => {
                    const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.npc;
                    const IconComponent = typeCfg.icon;

                    return (
                      <div
                        key={item.id}
                        className={`border rounded-xl p-4 transition-all duration-200 ${
                          item.selected
                            ? 'bg-surface-1 border-surface-3 shadow-xs'
                            : 'bg-surface-1/40 border-surface-2/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleItem(item.id)}
                            className="mt-1 text-content-3 hover:text-primary transition-colors cursor-pointer shrink-0"
                          >
                            {item.selected ? (
                              <div className="w-5 h-5 rounded bg-primary text-surface-0 flex items-center justify-center">
                                <Check size={13} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded border border-surface-3 bg-surface-2" />
                            )}
                          </button>

                          {/* Editable Entity Card */}
                          <div className="flex-1 min-w-0 space-y-2.5">
                            {/* Party Member Detection Banner */}
                            {item.convertedToParty ? (
                              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex items-center justify-between text-xs text-emerald-400 animate-fade-in">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Check size={14} /> Registrato come Membro del Party ({item.name})
                                </span>
                                <span className="text-[10px] text-emerald-400/80 font-mono">
                                  Verrà taggato con @{item.name} nel testo
                                </span>
                              </div>
                            ) : item.isPartyMember ? (
                              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2.5 space-y-2 text-xs animate-fade-in">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                                    <Users size={14} className="text-indigo-400 shrink-0" />
                                    <span>Questo personaggio potrebbe essere un PG del Party!</span>
                                  </span>
                                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                                    Eroe / PG
                                  </span>
                                </div>
                                <p className="text-content-3 text-[11px] leading-relaxed">
                                  Se <strong className="text-content-1">{item.name}</strong> fa parte del Party dei giocatori, puoi registrarlo subito come Membro del Party anziché aggiungerlo nel Compendio.
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleConvertToParty(item)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <Users size={13} /> Aggiungi al Party come PG
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItem(item.id, { isPartyMember: false })}
                                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-lg text-xs border border-surface-3 transition-colors cursor-pointer"
                                  >
                                    Mantieni come PNG Compendio
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              {/* Name Input */}
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, { name: e.target.value })
                                  }
                                  placeholder="Nome entità..."
                                  className="w-full bg-surface-2/80 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-content-1 outline-none"
                                />
                              </div>

                              {/* Type Selector & Status Selector */}
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${typeCfg.bg} ${typeCfg.color}`}>
                                    <IconComponent size={13} />
                                  </span>
                                  <select
                                    value={item.type}
                                    onChange={(e) => {
                                      const newType = e.target.value as Entity['type'];
                                      const newStatus: Entity['status'] = newType === 'quest' ? 'open' : 'alive';
                                      handleUpdateItem(item.id, {
                                        type: newType,
                                        status: newStatus,
                                      });
                                    }}
                                    className="bg-surface-2 border border-surface-3 focus:border-primary text-content-2 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                                  >
                                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                      <option key={key} value={key}>
                                        {cfg.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Status Selector */}
                                <select
                                  value={item.status || (item.type === 'quest' ? 'open' : 'alive')}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, {
                                      status: e.target.value as Entity['status'],
                                    })
                                  }
                                  className="bg-surface-2 border border-surface-3 focus:border-primary text-content-2 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                                >
                                  {item.type === 'quest' ? (
                                    <>
                                      <option value="open">In Corso (Open)</option>
                                      <option value="completed">Completata</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="alive">In Vita / Attivo</option>
                                      <option value="dead">Caduto / Distrutto</option>
                                    </>
                                  )}
                                </select>
                              </div>
                            </div>

                            {/* Description (Generated by Gemini, editable) */}
                            <div>
                              <label className="block text-[10px] font-medium text-content-3 mb-1 flex items-center justify-between">
                                <span>Descrizione compilata da Gemini:</span>
                                {item.location && (
                                  <span className="text-content-3 italic">
                                    Luogo: {item.location}
                                  </span>
                                )}
                              </label>
                              <textarea
                                rows={2}
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, { description: e.target.value })
                                }
                                placeholder="Descrizione contestuale dell'entità..."
                                className="w-full bg-surface-2/50 border border-surface-3 focus:border-primary rounded-lg p-2.5 text-xs text-content-2 outline-none font-body leading-relaxed resize-y"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Existing Entities Info footer */}
                {existingDetected.length > 0 && (
                  <div className="bg-surface-2/50 border border-surface-3 rounded-xl p-3 text-xs text-content-3 space-y-1">
                    <span className="font-semibold text-content-2 flex items-center gap-1">
                      <Info size={13} className="text-sky-400" /> Entità già esistenti rilevate nel testo:
                    </span>
                    <p className="leading-relaxed">
                      {existingDetected.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-surface-2 bg-surface-1 flex items-center justify-between gap-3 shrink-0">
            {isLoading ? (
              <>
                <div className="flex items-center gap-2 text-xs text-content-3">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span>Elaborazione in corso...</span>
                </div>
                <button
                  type="button"
                  onClick={() => cancelAnalysis(false)}
                  className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <X size={14} />
                  <span>Annulla Analisi</span>
                </button>
              </>
            ) : !hasScanned ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => startAnalysis()}
                  disabled={!rawText?.trim()}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-surface-0 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} />
                  <span>Avvia Estrazione Entità</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 rounded-xl transition-colors cursor-pointer"
                >
                  Chiudi
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startAnalysis()}
                    className="px-3.5 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    Rianalizza Testo
                  </button>

                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={selectedCount === 0 && (!autoTagInText || existingDetected.length === 0)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={14} />
                    <span>
                      {selectedCount > 0
                        ? `Crea ${selectedCount} Entità & Applica Tag`
                        : existingDetected.length > 0 && autoTagInText
                        ? `Applica Tag alle Entità Rilevate (${existingDetected.length})`
                        : 'Nessuna Entità Selezionata'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unified LLM Catalog Modal */}
      <LlmCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        activeProvider={provider}
        onSelectProvider={(p) => {
          setProvider(p);
          CampaignManager.saveUserPreferences({ aiProvider: p });
        }}
        currentModelId={activeModelId}
        onSelectModel={(selectedId, selectedProvider) => {
          const targetProv = selectedProvider || provider;
          setProvider(targetProv);
          if (targetProv === 'openrouter') {
            setOpenrouterModel(selectedId);
            CampaignManager.saveUserPreferences({ aiProvider: targetProv, extractionOpenrouterModel: selectedId });
          } else {
            setGeminiModel(selectedId);
            CampaignManager.saveUserPreferences({ aiProvider: targetProv, extractionGeminiModel: selectedId });
          }
          setIsCatalogModalOpen(false);
        }}
        isDm={CampaignManager.isCurrentUserDm()}
      />
    </Portal>
  );
}
