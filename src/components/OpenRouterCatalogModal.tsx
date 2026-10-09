import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Zap,
  Sparkles,
  Cpu,
  ExternalLink,
  Check,
  Star,
  Layers,
  RefreshCw,
  Key,
  ShieldAlert,
  Shield,
  Lock,
  Unlock,
  Edit3,
  Bookmark,
  Tag,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CURATED_OPENROUTER_MODELS,
  OpenRouterCatalogItem,
} from '../lib/openrouterUtils';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { fetchAvailableGeminiModels } from '../lib/geminiModels';
import { CampaignManager } from '../store/campaignStore';
import { Portal } from './Portal';

export type LlmProviderType = 'gemini' | 'openrouter';

export interface CatalogModelItem {
  id: string;
  name: string;
  description: string;
  isFree?: boolean;
  contextLength?: number;
  badge?: string;
  provider: LlmProviderType;
}

export interface LlmCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider?: LlmProviderType;
  onSelectProvider?: (provider: LlmProviderType) => void;
  currentModelId: string;
  onSelectModel: (modelId: string, provider?: LlmProviderType) => void;
  favoriteModelIds?: string[];
  onToggleFavorite?: (modelId: string) => void;
  isDm?: boolean;
}

export function LlmCatalogModal({
  isOpen,
  onClose,
  activeProvider = 'gemini',
  onSelectProvider,
  currentModelId,
  onSelectModel,
  favoriteModelIds: externalFavorites,
  onToggleFavorite: externalToggleFavorite,
  isDm,
}: LlmCatalogModalProps) {
  const userIsDm = isDm !== undefined ? isDm : CampaignManager.isCurrentUserDm();
  const [campaignAiConfig, setCampaignAiConfig] = useState(() => CampaignManager.getCampaignAiConfig());
  const allowedPartyModels = useMemo(() => campaignAiConfig.allowedPartyModels || [], [campaignAiConfig]);

  const [selectedProvider, setSelectedProvider] = useState<LlmProviderType>(
    activeProvider === 'openrouter' ? 'openrouter' : 'gemini'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'party' | 'free'>('party');
  const [customModelInput, setCustomModelInput] = useState('');

  // Live models cache per provider
  const [liveGeminiModels, setLiveGeminiModels] = useState<CatalogModelItem[]>([]);
  const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<CatalogModelItem[]>([]);

  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sync selected provider when prop changes
  useEffect(() => {
    if (activeProvider) {
      const safeProv = activeProvider === 'openrouter' ? 'openrouter' : 'gemini';
      setSelectedProvider(safeProv);
    }
  }, [activeProvider, isOpen]);

  // Sync campaign AI config updates
  useEffect(() => {
    if (isOpen) {
      setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleAiConfigUpdated = () => {
      setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
    };
    window.addEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_campaign_updated', handleAiConfigUpdated);
    return () => {
      window.removeEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_campaign_updated', handleAiConfigUpdated);
    };
  }, []);

  const handleTogglePartyModel = (modelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const current = campaignAiConfig.allowedPartyModels || [];
    const isAllowed = current.includes(modelId);
    const updated = isAllowed ? current.filter((id) => id !== modelId) : [...current, modelId];
    CampaignManager.setCampaignAiConfig({ allowedPartyModels: updated });
    setCampaignAiConfig((prev) => ({ ...prev, allowedPartyModels: updated }));
  };

  // Internal favorites state if external prop not provided
  const [internalFavorites, setInternalFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chronicle_favorite_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'openrouter/free',
    ];
  });

  // Persistent notes per favorite model
  const [favoriteNotes, setFavoriteNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('chronicle_favorite_model_notes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'gemini-flash-latest': 'Consigliato per interrogazioni generali & cronache',
      'openrouter/free': 'Ottimo per test veloci e dialoghi gratuiti',
    };
  });

  const [editingNoteModelId, setEditingNoteModelId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  const [blockedActionNotice, setBlockedActionNotice] = useState<{
    title: string;
    message: string;
    toSettings?: boolean;
    canUnblockOpenRouter?: boolean;
  } | null>(null);

  const [blockOpenRouterPaid, setBlockOpenRouterPaid] = useState<boolean>(() =>
    ApiKeyManager.isOpenRouterPaidBlocked()
  );

  useEffect(() => {
    const handleBlockPaidChanged = (e: any) => {
      if (typeof e?.detail === 'boolean') setBlockOpenRouterPaid(e.detail);
    };
    window.addEventListener('chronicle_openrouter_block_paid_changed', handleBlockPaidChanged);
    return () => {
      window.removeEventListener('chronicle_openrouter_block_paid_changed', handleBlockPaidChanged);
    };
  }, []);

  const handleOpenEditNote = (modelId: string, currentNote: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingNoteModelId(modelId);
    setEditingNoteText(currentNote || '');
  };

  const favorites = externalFavorites || internalFavorites;

  const handleSaveNote = (modelId: string, noteToSave: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const trimmed = noteToSave.trim();
    setFavoriteNotes((prev) => {
      const updated = { ...prev };
      if (!trimmed) {
        delete updated[modelId];
      } else {
        updated[modelId] = trimmed;
      }
      try {
        localStorage.setItem('chronicle_favorite_model_notes', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // If saving a non-empty note, ensure it is also in favorites
    if (trimmed && !favorites.includes(modelId)) {
      if (externalToggleFavorite) {
        externalToggleFavorite(modelId);
      }
      setInternalFavorites((prev) => {
        if (!prev.includes(modelId)) {
          const updated = [...prev, modelId];
          try {
            localStorage.setItem('chronicle_favorite_models', JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return prev;
      });
    }

    setEditingNoteModelId(null);
  };

  const toggleFavorite = (modelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (externalToggleFavorite) {
      externalToggleFavorite(modelId);
    }
    const isNowFavorite = !favorites.includes(modelId);
    setInternalFavorites((prev) => {
      const updated = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      try {
        localStorage.setItem('chronicle_favorite_models', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // If favoriting and no note exists yet, automatically open the inline note editor
    if (isNowFavorite && !favoriteNotes[modelId]) {
      setEditingNoteModelId(modelId);
      setEditingNoteText('');
    }
  };

  // API Keys status - Google Gemini is supported out of the box via server-side environment
  const keysConfig = ApiKeyManager.getKeys();
  const hasGeminiKey = true;
  const hasOpenRouterKey = Boolean(keysConfig.openrouterKey);

  const isCurrentProviderKeyMissing =
    (selectedProvider === 'openrouter' && !hasOpenRouterKey);

  // Default fallback models
  const defaultGeminiModels: CatalogModelItem[] = [
    {
      id: 'gemini-flash-latest',
      name: 'Gemini Flash Latest',
      description: 'Alias sempre aggiornato all\'ultima versione stabile di Gemini Flash.',
      isFree: true,
      contextLength: 1048576,
      badge: 'Consigliato',
      provider: 'gemini',
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      description: 'Velocità eccezionale, contesto esteso di 1 Milione di token e alta aderenza alle istruzioni.',
      isFree: true,
      contextLength: 1048576,
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
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro Preview',
      description: 'Modello ragionativo di fascia alta per analisi enciclopediche e sintesi articolate.',
      isFree: true,
      contextLength: 2097152,
      badge: 'Pro Reasoning',
      provider: 'gemini',
    },
  ];

  const fetchLiveModels = async (provider: LlmProviderType, force = false) => {
    setIsLoadingLive(true);
    setFetchError(null);
    try {
      if (provider === 'gemini') {
        const geminiModels = await fetchAvailableGeminiModels(keysConfig.geminiKey, force);
        if (geminiModels && geminiModels.length > 0) {
          setLiveGeminiModels(geminiModels);
        }
      } else if (provider === 'openrouter') {
        let loaded = false;
        try {
          const res = await fetch(`/api/ai/openrouter/models${force ? '?t=' + Date.now() : ''}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.models) && data.models.length > 0) {
              setLiveOpenRouterModels(
                data.models.map((m: any) => ({
                  id: m.id,
                  name: m.name || m.id,
                  description: m.description || '',
                  isFree: Boolean(m.isFree || m.id.endsWith(':free')),
                  contextLength: m.contextLength || 0,
                  provider: 'openrouter',
                }))
              );
              loaded = true;
            }
          }
        } catch {}

        if (!loaded && keysConfig.openrouterKey) {
          try {
            const directRes = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { Authorization: `Bearer ${keysConfig.openrouterKey.trim()}` },
            });
            if (directRes.ok) {
              const data = await directRes.json();
              if (Array.isArray(data?.data) && data.data.length > 0) {
                setLiveOpenRouterModels(
                  data.data.map((m: any) => ({
                    id: m.id,
                    name: m.name || m.id,
                    description: m.description || '',
                    isFree: Boolean(m.pricing?.prompt === '0' && m.pricing?.completion === '0') || m.id.endsWith(':free'),
                    contextLength: m.context_length || 0,
                    provider: 'openrouter',
                  }))
                );
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn(`[LlmCatalogModal] Fetch failed for ${provider}:`, err);
      setFetchError('Impossibile sincronizzare in tempo reale; visualizzo catalogo locale.');
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchLiveModels(selectedProvider);
  }, [isOpen, selectedProvider]);

  // Combined list for current provider
  const currentProviderModels = useMemo<CatalogModelItem[]>(() => {
    if (selectedProvider === 'gemini') {
      return liveGeminiModels.length > 0 ? liveGeminiModels : defaultGeminiModels;
    }
    // OpenRouter
    if (liveOpenRouterModels.length > 0) {
      return liveOpenRouterModels;
    }
    return CURATED_OPENROUTER_MODELS.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.desc,
      isFree: c.id.endsWith(':free'),
      contextLength: c.id.includes('70b') ? 131072 : c.id.includes('flash') ? 1048576 : 65536,
      provider: 'openrouter' as LlmProviderType,
    }));
  }, [selectedProvider, liveGeminiModels, liveOpenRouterModels]);

  const allKnownModels = useMemo<CatalogModelItem[]>(() => {
    const gem = liveGeminiModels.length > 0 ? liveGeminiModels : defaultGeminiModels;
    const or = liveOpenRouterModels.length > 0 ? liveOpenRouterModels : CURATED_OPENROUTER_MODELS.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.desc,
      isFree: c.id.endsWith(':free'),
      contextLength: c.id.includes('70b') ? 131072 : c.id.includes('flash') ? 1048576 : 65536,
      provider: 'openrouter' as LlmProviderType,
    }));
    return [...gem, ...or];
  }, [liveGeminiModels, liveOpenRouterModels]);

  // Filtered & sorted models list
  const filteredModels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Check if DM has explicitly customized allowed party models
    const hasCustomPartyModels = allowedPartyModels.length > 0;
    const defaultAllowedForProv = selectedProvider === 'gemini'
      ? ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.1-pro-preview']
      : ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free', 'google/gemini-2.0-flash-lite-001:free'];

    const activeAllowedSet = new Set<string>([
      ...allowedPartyModels,
      ...(hasCustomPartyModels ? [] : defaultAllowedForProv),
      ...(campaignAiConfig.oracleModel ? [campaignAiConfig.oracleModel] : []),
      ...(campaignAiConfig.modelId ? [campaignAiConfig.modelId] : []),
    ].filter(Boolean));

    // If player is NOT DM: ONLY show models allowed by the DM for the selected provider!
    if (!userIsDm) {
      const allowedList = allKnownModels.filter((m) => activeAllowedSet.has(m.id) && m.provider === selectedProvider);

      // Ensure any explicitly allowed model ID not present in known models is included
      const knownIds = new Set(allowedList.map((m) => m.id));
      activeAllowedSet.forEach((modelId) => {
        if (!knownIds.has(modelId)) {
          const isProbablyOpenRouter = modelId.includes('/') || modelId.includes(':');
          const itemProvider: LlmProviderType = isProbablyOpenRouter ? 'openrouter' : 'gemini';
          if (itemProvider === selectedProvider) {
            allowedList.push({
              id: modelId,
              name: modelId,
              description: 'Modello abilitato dal Dungeon Master per il tavolo',
              isFree: modelId.endsWith(':free') || itemProvider === 'gemini',
              provider: itemProvider,
            });
            knownIds.add(modelId);
          }
        }
      });

      return allowedList.filter((m) => {
        if (!q) return true;
        return (
          m.id.toLowerCase().includes(q) ||
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q))
        );
      });
    }

    // If user IS DM:
    let baseList = currentProviderModels;
    if (filterType === 'favorites') {
      baseList = allKnownModels.filter((m) => m.provider === selectedProvider);
    } else if (filterType === 'party') {
      const allowedForProv = allKnownModels.filter((m) => activeAllowedSet.has(m.id) && m.provider === selectedProvider);
      baseList = allowedForProv.length > 0 ? allowedForProv : currentProviderModels;
    }

    const filtered = baseList.filter((m) => {
      if (!m || !m.id) return false;
      const modelId = String(m.id);
      const isFree = Boolean(m.isFree || modelId.endsWith(':free'));
      const isFav = favorites.includes(modelId);
      const isParty = activeAllowedSet.has(modelId);

      if (filterType === 'favorites' && !isFav) return false;
      if (filterType === 'party' && !isParty) return false;
      if (filterType === 'free' && !isFree) return false;

      if (!q) return true;
      const name = String(m.name || '');
      const desc = String(m.description || '');
      const note = String(favoriteNotes[modelId] || '');
      return (
        modelId.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q)
      );
    });

    // Sort: party-enabled first, then favorites
    return filtered.sort((a, b) => {
      const aParty = allowedPartyModels.includes(a.id) ? 1 : 0;
      const bParty = allowedPartyModels.includes(b.id) ? 1 : 0;
      if (aParty !== bParty) return bParty - aParty;

      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return 0;
    });
  }, [userIsDm, allowedPartyModels, allKnownModels, currentProviderModels, filterType, searchQuery, favorites, favoriteNotes]);

  if (!isOpen) return null;

  const handleChooseModel = (modelId: string, providerToSelect?: LlmProviderType) => {
    const prov = providerToSelect || selectedProvider;
    if (onSelectProvider) {
      onSelectProvider(prov);
    }
    onSelectModel(modelId, prov);
    onClose();
  };

  const handleApplyCustomModel = () => {
    if (!customModelInput.trim()) return;
    const cleanId = customModelInput.trim();
    handleChooseModel(cleanId);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp text-content-1">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-surface-2 flex items-center justify-between bg-surface-1/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-xs transition-colors ${
                selectedProvider === 'gemini'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              }`}
            >
              {selectedProvider === 'gemini' ? (
                <Sparkles size={20} />
              ) : (
                <Zap size={20} />
              )}
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base text-content-1 flex items-center gap-2">
                {userIsDm ? 'Catalogo Modelli AI (Dungeon Master)' : 'Modelli Consigliati per il Party'}
              </h3>
              <p className="text-xs text-content-3">
                {userIsDm
                  ? 'Sfoglia i provider supportati (Gemini e OpenRouter) e seleziona i modelli abilitati per i giocatori'
                  : 'Scegli uno dei modelli approvati dal Dungeon Master per questa campagna'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Provider Tabs Switcher (Gemini & OpenRouter) */}
        <div className="px-3 pt-3 pb-2 border-b border-surface-2 bg-surface-0 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setSelectedProvider('gemini')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedProvider === 'gemini'
                ? 'bg-primary/15 border-primary text-primary shadow-xs font-bold'
                : 'bg-surface-1 border-surface-3 text-content-2 hover:bg-surface-2 hover:text-content-1'
            }`}
          >
            <Sparkles size={14} className={selectedProvider === 'gemini' ? 'text-primary' : ''} />
            <span>Google Gemini</span>
            {userIsDm && !hasGeminiKey && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-0.5 font-mono">
                <Lock size={9} /> Bloccato
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSelectedProvider('openrouter')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedProvider === 'openrouter'
                ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300 shadow-xs font-bold'
                : 'bg-surface-1 border-surface-3 text-content-2 hover:bg-surface-2 hover:text-content-1'
            }`}
          >
            <Zap size={14} className={selectedProvider === 'openrouter' ? 'text-indigo-400' : ''} />
            <span>OpenRouter</span>
            {userIsDm && !hasOpenRouterKey && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-0.5 font-mono">
                <Lock size={9} /> Bloccato
              </span>
            )}
          </button>
        </div>

        {/* API Key Status Notice Banner (Only for DM) */}
        {userIsDm && isCurrentProviderKeyMissing && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-3 shrink-0 shadow-sm animate-fadeIn">
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-content-1">
                  Modelli {selectedProvider.toUpperCase()} Bloccati
                </p>
                <p className="text-content-3 text-[11px] mt-0.5 leading-relaxed">
                  Inserisci la tua chiave API OpenRouter nelle Impostazioni per sbloccare e interrogare questi modelli.
                </p>
              </div>
            </div>
            <Link
              to="/settings"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Key size={12} />
              <span>Configura Chiave</span>
            </Link>
          </div>
        )}

        {/* Blocked Action Toast Notice */}
        {blockedActionNotice && (
          <div className="mx-3 mt-2.5 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3 shrink-0 shadow-md animate-fadeIn">
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldAlert size={17} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-content-1">{blockedActionNotice.title}</p>
                <p className="text-[11px] text-content-3 mt-0.5 leading-relaxed">{blockedActionNotice.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {blockedActionNotice.canUnblockOpenRouter && (
                <button
                  type="button"
                  onClick={() => {
                    ApiKeyManager.setOpenRouterPaidBlocked(false);
                    setBlockOpenRouterPaid(false);
                    setBlockedActionNotice(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Unlock size={11} />
                  <span>Sblocca Ora</span>
                </button>
              )}
              {blockedActionNotice.toSettings && (
                <Link
                  to="/settings"
                  onClick={onClose}
                  className="px-2.5 py-1 rounded-lg bg-red-500/25 hover:bg-red-500/35 text-red-200 border border-red-500/40 text-[10px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Key size={11} />
                  <span>Impostazioni</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setBlockedActionNotice(null)}
                className="p-1 rounded text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="p-3 border-b border-surface-2 bg-surface-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {/* Search box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cerca modelli ${selectedProvider}...`}
              className="w-full bg-surface-0 border border-surface-3 rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 placeholder:text-content-3/60 outline-none focus:border-primary"
            />
          </div>

           {/* Filter tabs and Refresh */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
            <div className="flex items-center gap-1 bg-surface-0 border border-surface-3 rounded-xl p-0.5 font-mono text-[11px]">
              {userIsDm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      filterType === 'all'
                        ? 'bg-surface-2 text-content-1 font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    Tutti ({currentProviderModels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('party')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      filterType === 'party'
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    <Users size={11} className="text-emerald-400" />
                    <span>Per il Party ({allowedPartyModels.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('favorites')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      filterType === 'favorites'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span>Preferiti ({favorites.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('free')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      filterType === 'free'
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    <Zap size={11} className="text-emerald-400" />
                    <span>Gratuiti</span>
                  </button>
                </>
              ) : (
                <div className="px-2.5 py-1 text-content-2 flex items-center gap-1.5 font-sans font-medium text-xs">
                  <Users size={12} className="text-primary" />
                  <span>Modelli abilitati dal DM ({filteredModels.length})</span>
                </div>
              )}
            </div>

            {/* OpenRouter persistent credit block toggle button (DM only) */}
            {userIsDm && selectedProvider === 'openrouter' && (
              <button
                type="button"
                onClick={() => {
                  const nextVal = !blockOpenRouterPaid;
                  ApiKeyManager.setOpenRouterPaidBlocked(nextVal);
                  setBlockOpenRouterPaid(nextVal);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  blockOpenRouterPaid
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
                }`}
                title={
                  blockOpenRouterPaid
                    ? 'Blocco crediti attivo (solo :free). Clicca per sbloccare i modelli a pagamento.'
                    : 'Consumo crediti abilitato. Clicca per bloccare i modelli a pagamento.'
                }
              >
                {blockOpenRouterPaid ? (
                  <>
                    <Lock size={11} className="text-amber-400" />
                    <span>Blocco Crediti: Attivo</span>
                  </>
                ) : (
                  <>
                    <Unlock size={11} className="text-purple-400" />
                    <span>A Credito: Sbloccato</span>
                  </>
                )}
              </button>
            )}

            {userIsDm && (
              <button
                type="button"
                onClick={() => fetchLiveModels(selectedProvider, true)}
                disabled={isLoadingLive}
                className="p-2 rounded-xl bg-surface-0 border border-surface-3 text-content-3 hover:text-primary transition-colors cursor-pointer"
                title="Sincronizza catalogo dal server"
              >
                <RefreshCw size={13} className={isLoadingLive ? 'animate-spin text-primary' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Model List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoadingLive && filteredModels.length === 0 && (
            <div className="p-8 text-center text-xs text-content-3 space-y-2">
              <RefreshCw size={20} className="animate-spin mx-auto text-primary" />
              <p>Caricamento modelli in corso per {selectedProvider.toUpperCase()}...</p>
            </div>
          )}

          {filteredModels.length === 0 && !isLoadingLive ? (
            <div className="p-8 text-center text-xs text-content-3 space-y-2">
              <p>
                {filterType === 'favorites'
                  ? 'Nessun modello tra i preferiti. Clicca sulla stella ★ per salvare i tuoi modelli preferiti!'
                  : `Nessun modello trovato per "${searchQuery}".`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="text-primary hover:underline text-xs"
              >
                Reimposta filtri di ricerca
              </button>
            </div>
          ) : (
            filteredModels.map((m) => {
              const isSelected = currentModelId === m.id;
              const isFav = favorites.includes(m.id);
              const customNote = favoriteNotes[m.id];
              const isEditingThisNote = editingNoteModelId === m.id;

              // Check if provider key is missing - Gemini is always available; OpenRouter checks key only for paid non-free models
              const isKeyMissing =
                m.provider === 'openrouter' && !hasOpenRouterKey && !m.isFree && !m.id.endsWith(':free');

              // Detect if OpenRouter paid model is blocked by user preference
              const isOrFree = Boolean(m.isFree || m.id.endsWith(':free'));
              const isOrPaidBlocked = m.provider === 'openrouter' && blockOpenRouterPaid && !isOrFree;

              const isBlocked = isKeyMissing || isOrPaidBlocked;
              const isFree = !isBlocked && Boolean(isOrFree || m.provider === 'gemini');

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isKeyMissing) {
                      setBlockedActionNotice({
                        title: `Chiave API per ${m.provider.toUpperCase()} Mancante`,
                        message: `Per sbloccare e selezionare "${m.name || m.id}", configura la tua chiave API per ${m.provider.toUpperCase()} nelle Impostazioni.`,
                        toSettings: true,
                      });
                      return;
                    }
                    if (isOrPaidBlocked) {
                      setBlockedActionNotice({
                        title: 'Modello OpenRouter a Consumo Bloccato',
                        message: `Il modello "${m.name || m.id}" consuma crediti a pagamento su OpenRouter ed è attualmente bloccato dalle tue impostazioni di protezione credito. Puoi sbloccarlo dall'interruttore in alto o nelle Impostazioni.`,
                        toSettings: false,
                        canUnblockOpenRouter: true,
                      });
                      return;
                    }
                    if (isBlocked) {
                      setBlockedActionNotice({
                        title: 'Modello Bloccato su Free Tier',
                        message: 'Questo modello richiede oltre 300 Neurons per richiesta ed è disattivato per proteggere la tua quota gratuita quotidiana di 10.000 Neurons. Aggiorna a Workers Paid nelle Impostazioni per sbloccarlo.',
                        toSettings: true,
                      });
                      return;
                    }
                    setBlockedActionNotice(null);
                    handleChooseModel(m.id, m.provider);
                  }}
                  className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-2 group ${
                    isBlocked
                      ? 'opacity-50 bg-surface-2/20 border-surface-3 cursor-not-allowed'
                      : isSelected
                      ? 'bg-primary/10 border-primary/50 shadow-xs cursor-pointer'
                      : isFav
                      ? 'bg-amber-500/5 border-amber-500/20 hover:bg-surface-2 cursor-pointer'
                      : 'bg-surface-0 hover:bg-surface-2 border-surface-2 hover:border-primary/30 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Favorite star button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isBlocked) return;
                            toggleFavorite(m.id, e);
                          }}
                          disabled={isBlocked}
                          className="p-1 rounded hover:bg-surface-3 transition-colors cursor-pointer text-amber-400 disabled:opacity-40"
                          title={isFav ? 'Rimuovi dai preferiti' : 'Salva tra i preferiti'}
                        >
                          <Star
                            size={14}
                            className={isFav ? 'fill-amber-400 text-amber-400' : 'text-content-3 hover:text-amber-400'}
                          />
                        </button>

                        <span className={`font-semibold text-xs text-content-1 group-hover:text-primary transition-colors ${isBlocked ? 'text-content-3/60' : ''}`}>
                          {m.name || m.id}
                        </span>

                        {m.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                            {m.badge}
                          </span>
                        )}

                        {/* DM Party Allowance toggle button OR Party approved badge */}
                        {userIsDm ? (
                          <button
                            type="button"
                            onClick={(e) => handleTogglePartyModel(m.id, e)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 transition-all cursor-pointer ${
                              allowedPartyModels.includes(m.id)
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 font-semibold'
                                : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1 hover:border-primary/40'
                            }`}
                            title={
                              allowedPartyModels.includes(m.id)
                                ? 'Modello abilitato per i giocatori del party (clicca per rimuovere)'
                                : 'Clicca per abilitare questo modello per i giocatori del party'
                            }
                          >
                            <Users size={11} className={allowedPartyModels.includes(m.id) ? 'text-emerald-400' : ''} />
                            <span>{allowedPartyModels.includes(m.id) ? 'Abilitato Party' : 'Abilita Party'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                            <Users size={10} /> Approvato Party
                          </span>
                        )}

                        {isKeyMissing ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1" title="Chiave API non configurata">
                            <Lock size={9} /> CHIAVE MANCANTE
                          </span>
                        ) : isOrPaidBlocked ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1" title="Modello a pagamento bloccato per salvaguardia crediti">
                            <Lock size={9} /> BLOCCATO (A CONSUMO)
                          </span>
                        ) : isBlocked ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1" title="Questo modello consuma troppi Neurons per il piano gratuito.">
                            🔒 BLOCCATO SU FREE TIER
                          </span>
                        ) : isFree ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Zap size={9} />
                            <span>GRATUITO</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            A Consumo
                          </span>
                        )}

                        {m.contextLength ? (
                          <span className="text-[10px] font-mono text-content-3 flex items-center gap-0.5">
                            <Layers size={10} />
                            {Math.round(m.contextLength / 1024)}k ctx
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] font-mono text-content-3 truncate pl-6">
                        {m.id}
                      </p>

                      {m.description && (
                        <p className="text-[11px] text-content-2 line-clamp-2 leading-snug pl-6">
                          {m.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {isKeyMissing ? (
                        <div className="text-[10px] text-red-400 font-bold border border-red-500/20 px-2 py-1 rounded-lg bg-red-500/5 flex items-center gap-1">
                          <Lock size={10} /> Bloccato
                        </div>
                      ) : isBlocked ? (
                        <div className="text-[10px] text-red-400 font-bold border border-red-500/20 px-2 py-1 rounded-lg bg-red-500/5">
                          🔒 Richiede Paid
                        </div>
                      ) : isSelected ? (
                        <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-surface-1 group-hover:bg-primary/20 text-content-3 group-hover:text-primary text-[11px] font-mono border border-surface-3 group-hover:border-primary/40 transition-colors"
                        >
                          Scegli
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Favorite Note Display & Inline Editor */}
                  {!isKeyMissing && (
                    <div className="pl-6 pt-1 border-t border-surface-2/40">
                      {customNote && !isEditingThisNote ? (
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 font-medium max-w-full">
                            <Bookmark size={11} className="text-amber-400 shrink-0" />
                            <span className="italic truncate">{customNote}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditNote(m.id, customNote, e)}
                            className="text-[10px] text-content-3 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Modifica nota d'uso"
                          >
                            <Edit3 size={10} />
                            <span>Modifica nota</span>
                          </button>
                        </div>
                      ) : isFav && !isEditingThisNote ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditNote(m.id, '', e)}
                          className="inline-flex items-center gap-1 text-[10px] text-content-3 hover:text-amber-300 transition-colors cursor-pointer"
                          title="Aggiungi una nota su quando usare questo modello"
                        >
                          <Tag size={10} />
                          <span>+ Aggiungi nota d'uso (es. perfetto per parlare, estrarre...)</span>
                        </button>
                      ) : null}

                      {/* Inline Note Editor */}
                      {isEditingThisNote && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 p-2.5 rounded-xl bg-surface-2 border border-primary/30 space-y-2 animate-fadeIn"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-content-1 flex items-center gap-1">
                              <Edit3 size={11} className="text-primary" />
                              Nota d'uso per questo modello:
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNoteModelId(null);
                              }}
                              className="text-[10px] text-content-3 hover:text-content-1 cursor-pointer"
                            >
                              Annulla
                            </button>
                          </div>

                          <input
                            type="text"
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            placeholder="es. Modello perfetto per parlare / per estrarre memorie..."
                            className="w-full bg-surface-0 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-content-1 outline-none focus:border-primary"
                            autoFocus
                          />

                          {/* Quick Suggestion Pills */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-content-3">Suggeriti:</span>
                            {[
                              '💬 Modello perfetto per parlare',
                              '📜 Modello perfetto per estrarre info dalle sessioni',
                              '⚡ Veloce & economico',
                              '🧠 Ottimo per lore e deduzioni',
                            ].map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNoteText(sug);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-surface-1 hover:bg-surface-3 border border-surface-3 text-content-2 hover:text-content-1 cursor-pointer transition-colors"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-surface-3/50">
                            {customNote ? (
                              <button
                                type="button"
                                onClick={(e) => handleSaveNote(m.id, '', e)}
                                className="text-[10px] text-error hover:underline cursor-pointer"
                              >
                                Elimina nota
                              </button>
                            ) : <div />}

                            <button
                              type="button"
                              onClick={(e) => handleSaveNote(m.id, editingNoteText, e)}
                              className="px-3 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Salva Nota
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Custom Model ID Entry (DM Only) */}
          {userIsDm && (
            <div className="p-3 bg-surface-0 border border-surface-3/80 rounded-xl space-y-2 mt-3">
              <label className="text-[11px] font-mono font-bold text-content-2 block">
                Altro Modello Custom ({selectedProvider.toUpperCase()}):
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder={
                    selectedProvider === 'gemini'
                      ? 'es. gemini-flash-latest o gemini-3.8-flash'
                      : 'es. meta-llama/llama-3.3-70b-instruct'
                  }
                  className="flex-1 bg-surface-1 border border-surface-3 rounded-lg px-3 py-1.5 text-xs font-mono text-content-1 outline-none focus:border-primary"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!customModelInput.trim()) return;
                      const cleanId = customModelInput.trim();
                      handleTogglePartyModel(cleanId);
                      setCustomModelInput('');
                    }}
                    disabled={!customModelInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 disabled:opacity-40 font-medium text-xs transition-colors cursor-pointer font-mono flex items-center gap-1.5"
                    title="Aggiungi o rimuovi questo modello per i giocatori del party"
                  >
                    <Users size={12} />
                    <span>Abilita Party</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomModel}
                    disabled={!customModelInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-medium text-xs transition-colors cursor-pointer font-mono"
                  >
                    Usa Come Attivo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface-0 border-t border-surface-2 flex items-center justify-between text-xs shrink-0">
          {userIsDm ? (
            <a
              href={
                selectedProvider === 'gemini'
                  ? 'https://ai.google.dev/gemini-api/docs/models/gemini'
                  : 'https://openrouter.ai/models'
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline font-mono text-[11px] transition-colors"
            >
              <span>Documentazione ufficiale {selectedProvider.toUpperCase()}</span>
              <ExternalLink size={12} />
            </a>
          ) : (
            <div className="text-[11px] text-content-3 font-mono">
              Seleziona un modello per consultare l'Archivio Arcano.
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 font-medium text-xs transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// Backwards compatibility export
export const OpenRouterCatalogModal = LlmCatalogModal;
