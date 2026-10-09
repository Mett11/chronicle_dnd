import { CloudSyncService } from '../lib/cloudSync';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Entity, Player } from '../types';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { UserPreferencesService } from '../lib/userPreferencesService';
import { ConfirmModal } from '../components/ConfirmModal';
import { LlmCatalogModal, LlmProviderType } from '../components/OpenRouterCatalogModal';
import { InterlocutorSelectorModal } from '../components/InterlocutorSelectorModal';
import {
  cleanOpenRouterModelId,
  CURATED_OPENROUTER_MODELS,
} from '../lib/openrouterUtils';
import {
  OracleService,
  OracleMessage,
  OracleSource,
  OracleError,
  OracleErrorDetails,
  AGENT_PERSONAS,
  AgentPersona,
  OracleEffortLevel,
  OracleEffortMode,
  EFFORT_PRESETS,
  detectSuggestedEffort,
} from '../lib/oracleService';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import {
  Sparkles,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  MessageSquarePlus,
  ExternalLink,
  BookOpen,
  Scroll,
  BookMarked,
  User,
  AlertTriangle,
  ServerCrash,
  Clock,
  Layers,
  Key,
  Lock,
  RotateCcw,
  X,
  Zap,
  Cpu,
  Search,
  Square,
  Star,
  Ghost,
  GraduationCap,
  Beer,
  Compass,
  Utensils,
  ChevronDown,
  SlidersHorizontal,
  Bot,
  Brain,
  ChevronUp,
  FileDown,
  Sliders,
  Gauge,
} from 'lucide-react';

interface DialogueBlock {
  name: string;
  action?: string;
  text: string;
}

function parseGroupDialogueLines(content: string): DialogueBlock[] {
  // Split the message content by any occurrence of "**Name**:" 
  // This handles multiple character interventions inline or separate by newline perfectly.
  const chunks = content.split(/(?=\s*\*\*[^*]+?\*\*\s*:)/);
  const blocks: DialogueBlock[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // 1. Match the speaker name: "**Name**:"
    const headerMatch = trimmed.match(/^\s*\*\*(.*?)\*\*\s*:\s*(.*)$/s);
    if (headerMatch) {
      const name = headerMatch[1].trim();
      const remaining = headerMatch[2].trim();
      let action = '';
      let text = remaining;

      // 2. Extract action if it starts the remaining text (supported: *[action]*, _[action]_, [action], *action*, _action_)
      const actionMatch = remaining.match(/^(?:[\*_]\s*\[(.*?)\]\s*[\*_]|\[(.*?)\]|[\*_](.*?)[\*_])\s*(.*)$/s);
      if (actionMatch) {
        action = (actionMatch[1] || actionMatch[2] || actionMatch[3] || '').trim();
        text = (actionMatch[4] || '').trim();
      }

      // Clean surrounding quotes from spoken text
      text = cleanQuotes(text);

      blocks.push({ name, action, text });
    } else {
      // Fallback for narration, general text or cut-off streams
      let text = trimmed;
      let action = '';

      // Check if the entire chunk is an action
      const actionMatch = trimmed.match(/^(?:[\*_]\s*\[(.*?)\]\s*[\*_]|\[(.*?)\]|[\*_](.*?)[\*_])$/s);
      if (actionMatch) {
        action = (actionMatch[1] || actionMatch[2] || actionMatch[3] || '').trim();
        text = '';
      }

      blocks.push({ name: '', action, text });
    }
  }

  return blocks;
}

function cleanQuotes(text: string): string {
  let cleaned = text.trim();
  if (!cleaned) return '';

  const matchingPairs = [
    ['"', '"'],
    ['“', '”'],
    ['«', '»'],
    ['\'', '\'']
  ];
  for (const [start, end] of matchingPairs) {
    if (cleaned.startsWith(start) && cleaned.endsWith(end)) {
      cleaned = cleaned.slice(start.length, -end.length).trim();
      return cleaned;
    }
  }

  // Clean unmatched single starting/ending quotes left by parsing/cuts
  if (cleaned.startsWith('"') || cleaned.startsWith('“') || cleaned.startsWith('«')) {
    cleaned = cleaned.slice(1).trim();
  }
  if (cleaned.endsWith('"') || cleaned.endsWith('”') || cleaned.endsWith('»')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  return cleaned;
}

const GEMINI_TEXT_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Consigliato',
    desc: 'Modello di riferimento veloce con ampia finestra di contesto per le cronache.',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Latest)',
    badge: 'Sempre Aggiornato',
    desc: 'Alias automatico all\'ultima versione Flash stabile per risposte immediate.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Rapido',
    desc: 'Bassa latenza e consumo ridotto di risorse per interrogazioni snelle.',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Flash',
    desc: 'Modello per consultazione e deduzione delle cronache di gioco.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Ragionamento Pro',
    desc: 'Capacità avanzata di correlazione tra segreti, trame e dettagli di campagna.',
  },
];

export function Oracle() {
  const { account, player } = useAuth();

  const [allPlayers, setAllPlayers] = useState<Player[]>(() => CampaignManager.getPlayers());

  useEffect(() => {
    const handlePlayersUpdate = () => {
      setAllPlayers(CampaignManager.getPlayers());
    };
    window.addEventListener('chronicle_campaign_updated', handlePlayersUpdate);
    window.addEventListener('chronicle_campaign_changed', handlePlayersUpdate);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handlePlayersUpdate);
      window.removeEventListener('chronicle_campaign_changed', handlePlayersUpdate);
    };
  }, []);

  const [actingPlayerId, setActingPlayerId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('chronicle_oracle_acting_player_id');
      if (saved) return saved;
    } catch {}
    return player?._id || '';
  });

  const effectivePlayer = useMemo<Player>(() => {
    if (actingPlayerId) {
      const found = allPlayers.find((p) => p._id === actingPlayerId);
      if (found) return found;
    }
    return (
      player || {
        _id: 'dm_user',
        characterName: 'Dungeon Master',
        isDm: true,
      }
    );
  }, [actingPlayerId, allPlayers, player]);

  const handleActingPlayerChange = (pId: string) => {
    setActingPlayerId(pId);
    try {
      localStorage.setItem('chronicle_oracle_acting_player_id', pId);
    } catch {}
  };

  // Provider: 'gemini' | 'openrouter'
  const [provider, setProvider] = useState<LlmProviderType>(() => {
    const campConf = CampaignManager.getCampaignAiConfig();
    if (campConf.provider === 'gemini' || campConf.provider === 'openrouter') {
      return campConf.provider as LlmProviderType;
    }
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.oracleProvider === 'gemini' || prefs.ai?.oracleProvider === 'openrouter') {
      return prefs.ai.oracleProvider as LlmProviderType;
    }
    try {
      const saved = localStorage.getItem('chronicle_oracle_provider') as LlmProviderType;
      if (saved === 'gemini' || saved === 'openrouter') return saved;
    } catch {}
    return 'gemini';
  });

  // Selected Player Character IDs for multi-PG chat simulation
  const [selectedPgIds, setSelectedPgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chronicle_oracle_selected_pg_ids');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Selected Codex Entity IDs for mixed multi-subject dialogue
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chronicle_oracle_selected_entity_ids');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // State to trigger automatic starter prompt when a new multi-subject dialogue is initialized
  const [autoStartData, setAutoStartData] = useState<{
    prompt: string;
    model?: string;
    provider?: LlmProviderType;
  } | null>(null);

  // Simulated real-time group chat typing states
  const [revealedBlocks, setRevealedBlocks] = useState<Record<string, number>>({});
  const [typingCharacter, setTypingCharacter] = useState<Record<string, string | null>>({});
  const typingTimersRef = useRef<Record<string, NodeJS.Timeout[]>>({});
  const renderedMessageIdsRef = useRef<Set<string>>(new Set());

  // Clean up typing timers on unmount
  useEffect(() => {
    return () => {
      Object.values(typingTimersRef.current).forEach((timers) => {
        timers.forEach(clearTimeout);
      });
    };
  }, []);

  // Persistent Selected PG & Entity IDs
  useEffect(() => {
    try {
      localStorage.setItem('chronicle_oracle_selected_pg_ids', JSON.stringify(selectedPgIds));
    } catch {}
  }, [selectedPgIds]);

  useEffect(() => {
    try {
      localStorage.setItem('chronicle_oracle_selected_entity_ids', JSON.stringify(selectedEntityIds));
    } catch {}
  }, [selectedEntityIds]);

  // Communicative Agent Persona State (Restored from localStorage)
  const [selectedPersonaId, setSelectedPersonaId] = useState<AgentPersona['id']>(() => {
    try {
      const saved = localStorage.getItem('chronicle_prismalink_persona') as AgentPersona['id'];
      if (saved && ['helpergeist', 'rosier', 'nemea', 'fenomeno', 'volantis'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'helpergeist';
  });

  // Query Param Deep-Linking for Codex Interrogations (?entityId=...)
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryEntityId = searchParams.get('entityId') || searchParams.get('entity');

  const [activeCodexEntity, setActiveCodexEntity] = useState<Entity | null>(() => {
    try {
      const allEnts = CampaignManager.getEntities();
      const targetId = queryEntityId || localStorage.getItem('chronicle_prismalink_codex_id');
      if (targetId && allEnts.length > 0) {
        const target = allEnts.find((e) => e._id === targetId);
        if (target) return target;
      }
    } catch {}
    return null;
  });

  // Keep activeCodexEntity synchronized with CampaignManager and URL / localStorage across navigations
  useEffect(() => {
    const syncEntity = () => {
      const allEnts = CampaignManager.getEntities();
      const targetId = queryEntityId || localStorage.getItem('chronicle_prismalink_codex_id');
      if (targetId && allEnts.length > 0) {
        const target = allEnts.find((e) => e._id === targetId);
        if (target) {
          setActiveCodexEntity((prev) => (prev?._id === target._id ? prev : target));
        }
      } else if (!targetId) {
        setActiveCodexEntity(null);
      }
    };

    syncEntity();
    window.addEventListener('chronicle_data_updated', syncEntity);
    window.addEventListener('chronicle_entities_updated', syncEntity);
    window.addEventListener('chronicle_campaign_changed', syncEntity);
    return () => {
      window.removeEventListener('chronicle_data_updated', syncEntity);
      window.removeEventListener('chronicle_entities_updated', syncEntity);
      window.removeEventListener('chronicle_campaign_changed', syncEntity);
    };
  }, [queryEntityId]);

  const handleClearCodexEntity = () => {
    setActiveCodexEntity(null);
    setSelectedPgIds([]);
    setSelectedEntityIds([]);
    try {
      localStorage.removeItem('chronicle_prismalink_codex_id');
    } catch {}
    navigate('/prismalink', { replace: true });
  };

  const handleSelectCodexEntity = (ent: Entity) => {
    setActiveCodexEntity(ent);
    setSelectedPgIds([]);
    setSelectedEntityIds([]);
    try {
      localStorage.setItem('chronicle_prismalink_codex_id', ent._id);
    } catch {}
    navigate(`/prismalink?entityId=${ent._id}`, { replace: true });
  };

  const handleSelectPersona = (personaId: AgentPersona['id']) => {
    setActiveCodexEntity(null);
    setSelectedPgIds([]);
    setSelectedEntityIds([]);
    try {
      localStorage.removeItem('chronicle_prismalink_codex_id');
      localStorage.setItem('chronicle_prismalink_persona', personaId);
    } catch {}
    setSelectedPersonaId(personaId);
    navigate('/prismalink', { replace: true });
  };

  const activePersona = useMemo(() => {
    const totalCount = (selectedPgIds?.length || 0) + (selectedEntityIds?.length || 0);
    if (totalCount >= 2) {
      const players = CampaignManager.getPlayers();
      const entities = CampaignManager.getEntities();
      
      const pgNames = (selectedPgIds || [])
        .map((id) => players.find((p) => p._id === id)?.characterName)
        .filter(Boolean);
        
      const entNames = (selectedEntityIds || [])
        .map((id) => entities.find((e) => e._id === id)?.name)
        .filter(Boolean);
        
      const allNames = [...pgNames, ...entNames];
      return {
        id: 'multi_subject' as any,
        name: `Dialogo: ${allNames.join(' + ')}`,
        roleTitle: `DIALETTICA TRA ${totalCount} SOGGETTI`,
        badge: 'Multi-Soggetto',
        description: `Conversazione e confronto in-character tra ${allNames.join(', ')}`,
        systemPrompt: '',
      };
    }
    if (activeCodexEntity) {
      return {
        id: 'codex_entity' as any,
        name: activeCodexEntity.name,
        roleTitle: `${activeCodexEntity.type.toUpperCase()} • Compendio`,
        badge: activeCodexEntity.aiConfig?.speechStyle ? 'Persona Codex' : 'Interrogazione',
        description: activeCodexEntity.aiConfig?.knowledgeScope || activeCodexEntity.progressNote || `Interrogazione diretta con ${activeCodexEntity.name}`,
        systemPrompt: '',
      };
    }
    return AGENT_PERSONAS.find((p) => p.id === selectedPersonaId) || AGENT_PERSONAS[0];
  }, [selectedPersonaId, activeCodexEntity, selectedPgIds, selectedEntityIds]);

  const aiCodexEntities = useMemo(() => {
    return CampaignManager.getEntities().filter((e) => e.aiConfig?.enabled);
  }, [activeCodexEntity]);

  const ATTITUDE_BADGES: Record<string, { label: string; className: string }> = {
    friendly: { label: '😊 Amichevole', className: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
    helpful: { label: '🤝 Disponibile', className: 'text-teal-400 bg-teal-500/15 border-teal-500/30' },
    neutral: { label: '😐 Neutrale', className: 'text-content-2 bg-surface-2 border-surface-3' },
    suspicious: { label: '🤨 Diffidente', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
    hostile: { label: '😡 Ostile', className: 'text-rose-400 bg-rose-500/15 border-rose-500/30' },
    fearful: { label: '😨 Timoroso', className: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
    devoted: { label: '👑 Devoto', className: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  };

  const activeRelationWithPlayer = useMemo(() => {
    if (!activeCodexEntity || !activeCodexEntity.aiConfig?.partyRelations) return null;
    const pRelations = activeCodexEntity.aiConfig.partyRelations;
    return (
      pRelations[effectivePlayer._id] ||
      Object.values(pRelations).find(
        (r) =>
          r.characterName &&
          effectivePlayer.characterName &&
          r.characterName.toLowerCase() === effectivePlayer.characterName.toLowerCase()
      ) ||
      null
    );
  }, [activeCodexEntity, effectivePlayer]);

  // Save selected persona
  useEffect(() => {
    try {
      localStorage.setItem('chronicle_prismalink_persona', selectedPersonaId);
    } catch {}
  }, [selectedPersonaId]);

  // Active campaign & account info
  const campaignMeta = CampaignManager.getCampaignMeta();
  const campaignCode = CampaignManager.getActiveCampaignCode();
  const activeCampaignCodeClean = (campaignCode || 'GLOBAL').trim().toUpperCase();

  // Gemini state
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    const campConf = CampaignManager.getCampaignAiConfig();
    if (campConf.provider === 'gemini' && campConf.oracleModel) {
      return campConf.oracleModel;
    }
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.oracleGeminiModel) return prefs.ai.oracleGeminiModel;
    try {
      const saved = localStorage.getItem('chronicle_oracle_gemini_model');
      if (saved) return saved;
    } catch {}
    return 'gemini-3.8-flash';
  });
  const [liveGeminiModels, setLiveGeminiModels] = useState<{ id: string; name: string; desc?: string; badge?: string }[]>(GEMINI_TEXT_MODELS);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<string[]>([]);
  const [customGeminiModel, setCustomGeminiModel] = useState<string>('');
  const [isCustomGemini, setIsCustomGemini] = useState(false);

  // Dynamic live fetch of Gemini models from backend
  useEffect(() => {
    let isCancelled = false;
    async function loadGeminiModels() {
      try {
        const keys = ApiKeyManager.getKeys();
        const queryParam = keys.geminiKey ? `?key=${encodeURIComponent(keys.geminiKey)}` : '';
        const res = await fetch(`/api/ai/gemini/models${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data?.models) && data.models.length > 0) {
            setLiveGeminiModels(
              data.models.map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
                badge: m.id.includes('lite') ? 'Ultra Rapido' : m.id.includes('pro') ? 'Pro' : 'Attivo',
                desc: m.description || '',
              }))
            );
          }
        }
      } catch (err) {
        console.warn('[Oracle] Errore recupero modelli Gemini dinamici:', err);
      }
    }
    loadGeminiModels();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Cloudflare Workers AI state
  const [cloudflareModel, setCloudflareModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.oracleCloudflareModel) return prefs.ai.oracleCloudflareModel;
    try {
      const saved = localStorage.getItem('chronicle_oracle_cloudflare_model');
      if (saved) return saved;
    } catch {}
    return '@cf/meta/llama-3.3-70b-instruct-fp8';
  });

  // OpenRouter state
  const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
    const campConf = CampaignManager.getCampaignAiConfig();
    if (campConf.provider === 'openrouter' && campConf.oracleModel) {
      return cleanOpenRouterModelId(campConf.oracleModel);
    }
    const prefs = UserPreferencesService.getLocalPreferences();
    if (prefs.ai?.oracleOpenrouterModel) return cleanOpenRouterModelId(prefs.ai.oracleOpenrouterModel);
    try {
      const saved = localStorage.getItem('chronicle_oracle_openrouter_model');
      if (saved) return cleanOpenRouterModelId(saved);
    } catch {}
    return 'openrouter/free';
  });

  // Listen to remote campaign AI config updates (from Master or Supabase)
  useEffect(() => {
    const handleAiConfigChange = () => {
      const campConf = CampaignManager.getCampaignAiConfig(activeCampaignCodeClean);
      if (campConf.provider) {
        setProvider(campConf.provider as LlmProviderType);
      }
      if (campConf.provider === 'openrouter' && campConf.oracleModel) {
        setOpenrouterModel(cleanOpenRouterModelId(campConf.oracleModel));
      } else if (campConf.provider === 'gemini' && campConf.oracleModel) {
        setGeminiModel(campConf.oracleModel);
      }
    };
    window.addEventListener('chronicle_ai_config_updated', handleAiConfigChange);
    return () => {
      window.removeEventListener('chronicle_ai_config_updated', handleAiConfigChange);
    };
  }, [activeCampaignCodeClean]);
  const [customOpenrouterModel, setCustomOpenrouterModel] = useState<string>('');
  const [isCustomOpenrouter, setIsCustomOpenrouter] = useState(false);
  const [isOpenRouterCatalogOpen, setIsOpenRouterCatalogOpen] = useState(false);
  const [isInterlocutorModalOpen, setIsInterlocutorModalOpen] = useState(false);
  const [isCopiedExport, setIsCopiedExport] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);

  const activePersonaIcon = useMemo(() => {
    const totalCount = (selectedPgIds?.length || 0) + (selectedEntityIds?.length || 0);
    if (totalCount >= 2) return Sparkles;
    if (activeCodexEntity) return Bot;
    switch (selectedPersonaId) {
      case 'rosier': return GraduationCap;
      case 'fenomeno': return Beer;
      default: return Ghost;
    }
  }, [selectedPersonaId, activeCodexEntity, selectedPgIds, selectedEntityIds]);

  // Export Chat to Clipboard formatted in Markdown
  const handleExportChatMarkdown = () => {
    if (messages.length === 0) return;
    const speakerTitle = activePersona.name;
    const campaignName = campaignMeta?.name || campaignCode || 'Campagna';
    const nowFormatted = new Date().toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let md = `# Trascrizione Sendipietra - ${speakerTitle}\n\n`;
    md += `- **Campagna:** ${campaignName}\n`;
    md += `- **Data & Ora:** ${nowFormatted}\n`;
    md += `- **Interlocutore:** ${speakerTitle} (${activePersona.roleTitle})\n`;
    md += `- **Motore AI:** ${provider === 'openrouter' ? `OpenRouter (${openrouterModel})` : `Google Gemini (${geminiModel})`}\n\n`;
    md += `---\n\n`;

    messages.forEach((msg) => {
      const isUser = msg.role === 'user';
      const senderName = isUser
        ? player?.characterName || (player?.isDm ? 'Dungeon Master' : 'Giocatore')
        : speakerTitle;

      md += `### ${senderName} [${msg.timestamp}]\n\n`;
      if (msg.thought) {
        md += `> 💭 *Riflessione Interiore:* ${msg.thought}\n\n`;
      }
      md += `${msg.content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        const sourcesList = msg.sources.map((s) => s.title).join(', ');
        md += `*Fonti & Riferimenti:* ${sourcesList}\n\n`;
      }
      md += `---\n\n`;
    });

    navigator.clipboard.writeText(md.trim());
    setIsCopiedExport(true);
    setTimeout(() => setIsCopiedExport(false), 2500);
  };

  // Persistent Favorite Models State
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chronicle_favorite_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['openrouter/free', 'qwen/qwen3.8-27b:free', 'google/gemma-4-31b-it:free', 'gemini-3.8-flash'];
  });

  const toggleFavoriteModel = (modelId: string) => {
    setFavoriteModelIds((prev) => {
      const updated = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      try {
        localStorage.setItem('chronicle_favorite_models', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const currentUserId = (account?.id || player?._id || 'guest').trim();

  const getScopedChatKey = (cCode: string, uId: string) =>
    `chronicle_oracle_chat_history_${cCode}_${uId}`;

  // Helper to load chat history for current user & campaign
  const loadChatHistoryForContext = (cCode: string, uId: string): OracleMessage[] => {
    try {
      const scopedKey = getScopedChatKey(cCode, uId);
      const saved = localStorage.getItem(scopedKey);
      if (saved) {
        return JSON.parse(saved);
      }
      // Migration from legacy global key if no scoped key exists yet
      const legacySaved = localStorage.getItem('chronicle_oracle_chat_history');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(scopedKey, legacySaved);
          localStorage.removeItem('chronicle_oracle_chat_history');
          return parsed;
        }
      }
    } catch {}
    return [];
  };

  const [messages, setMessages] = useState<OracleMessage[]>(() => {
    return loadChatHistoryForContext(activeCampaignCodeClean, currentUserId);
  });

  // Automatically reload messages when active campaign or user account changes
  useEffect(() => {
    const freshMessages = loadChatHistoryForContext(activeCampaignCodeClean, currentUserId);
    setMessages(freshMessages);
    setErrorDetails(null);
    setLastSubmittedQuery('');

    // Asynchronously hydrate from Cloud Firestore if local is empty or missing remote history
    CloudSyncService.fetchOracleChatFromCloud(activeCampaignCodeClean, currentUserId)
      .then((cloudMsgs) => {
        if (Array.isArray(cloudMsgs) && cloudMsgs.length > 0) {
          setMessages((prev) => {
            if (prev.length === 0 || cloudMsgs.length >= prev.length) {
              return cloudMsgs;
            }
            return prev;
          });
        }
      })
      .catch(() => {});

    // Clear active typing timers & animation refs
    Object.values(typingTimersRef.current).forEach((timers) => {
      timers.forEach(clearTimeout);
    });
    typingTimersRef.current = {};
    renderedMessageIdsRef.current.clear();
    freshMessages.forEach((m) => {
      if (m && m.id) renderedMessageIdsRef.current.add(m.id);
    });
    setRevealedBlocks({});
    setTypingCharacter({});
  }, [activeCampaignCodeClean, currentUserId]);

  // Filter selected PGs & Codex Entities so they never bleed across campaigns
  useEffect(() => {
    const allCampaignEntities = CampaignManager.getEntities();
    const allCampaignPlayers = CampaignManager.getPlayers();

    setSelectedPgIds((prev) => prev.filter((id) => allCampaignPlayers.some((p) => p._id === id)));
    setSelectedEntityIds((prev) => prev.filter((id) => allCampaignEntities.some((e) => e._id === id)));
  }, [activeCampaignCodeClean]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<OracleErrorDetails | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Persistent Effort Level Mode State ('auto' | 'brief' | 'balanced' | 'deep')
  const [effortMode, setEffortMode] = useState<OracleEffortMode>(() => {
    try {
      const saved = localStorage.getItem('chronicle_prismalink_effort_mode') as OracleEffortMode;
      if (saved && ['auto', 'brief', 'balanced', 'deep'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  const handleSelectEffortMode = (mode: OracleEffortMode) => {
    setEffortMode(mode);
    try {
      localStorage.setItem('chronicle_prismalink_effort_mode', mode);
    } catch {}
  };

  // Real-time suggested effort based on current question typing
  const suggestedEffort = useMemo(() => {
    return detectSuggestedEffort(inputPrompt);
  }, [inputPrompt]);

  // The actual effort level applied when submitting the query
  const effectiveEffort: OracleEffortLevel = useMemo(() => {
    if (effortMode === 'auto') return suggestedEffort;
    return effortMode;
  }, [effortMode, suggestedEffort]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check available API keys
  const [apiKeys, setApiKeys] = useState(() => ApiKeyManager.getKeys());

  useEffect(() => {
    const handleKeysUpdate = (e?: any) => {
      const updated = e?.detail || ApiKeyManager.getKeys();
      setApiKeys(updated);
    };

    ApiKeyManager.preloadAllKeys().then(handleKeysUpdate);

    window.addEventListener('chronicle_api_keys_updated', handleKeysUpdate);
    window.addEventListener('chronicle_campaign_keys_updated', handleKeysUpdate);
    window.addEventListener('chronicle_keys_preloaded', handleKeysUpdate);
    window.addEventListener('chronicle_key_mode_changed', handleKeysUpdate);

    return () => {
      window.removeEventListener('chronicle_api_keys_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_campaign_keys_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_keys_preloaded', handleKeysUpdate);
      window.removeEventListener('chronicle_key_mode_changed', handleKeysUpdate);
    };
  }, []);

  // Persist provider
  useEffect(() => {
    UserPreferencesService.saveAiPreferences({ oracleProvider: provider });
    try {
      localStorage.setItem('chronicle_oracle_provider', provider);
    } catch {}
  }, [provider]);

  // Persist Cloudflare model
  useEffect(() => {
    if (cloudflareModel) {
      UserPreferencesService.saveAiPreferences({ oracleCloudflareModel: cloudflareModel });
      try {
        localStorage.setItem('chronicle_oracle_cloudflare_model', cloudflareModel);
      } catch {}
    }
  }, [cloudflareModel]);

  // Persist OpenRouter model
  useEffect(() => {
    if (openrouterModel) {
      UserPreferencesService.saveAiPreferences({ oracleOpenrouterModel: openrouterModel });
      try {
        localStorage.setItem('chronicle_oracle_openrouter_model', openrouterModel);
      } catch {}
    }
  }, [openrouterModel]);

  // Persist Gemini model
  useEffect(() => {
    if (geminiModel) {
      UserPreferencesService.saveAiPreferences({ oracleGeminiModel: geminiModel, oracleModel: geminiModel });
      try {
        localStorage.setItem('chronicle_oracle_gemini_model', geminiModel);
      } catch {}
    }
  }, [geminiModel]);

  // Save chat history strictly to active campaign & user scoped key and Cloud Firestore
  useEffect(() => {
    try {
      const scopedKey = getScopedChatKey(activeCampaignCodeClean, currentUserId);
      localStorage.setItem(scopedKey, JSON.stringify(messages));
      CloudSyncService.saveOracleChatToCloud(activeCampaignCodeClean, currentUserId, messages);
    } catch {}
  }, [messages, activeCampaignCodeClean, currentUserId]);

  // Scroll to bottom on new message or during group typing simulation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, errorDetails, revealedBlocks, typingCharacter]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputPrompt]);

  const campKeysConfig = ApiKeyManager.getCampaignKeys();
  const persKeysConfig = ApiKeyManager.getPersonalKeys();

  const hasGeminiCredentials = Boolean(
    apiKeys.geminiKey || campKeysConfig.geminiKey || persKeysConfig.geminiKey || true
  );
  const hasCloudflareCredentials = Boolean(
    (apiKeys.cloudflareAccountId || campKeysConfig.cloudflareAccountId) &&
      (apiKeys.cloudflareApiToken || campKeysConfig.cloudflareApiToken)
  );
  const hasOpenRouterCredentials = Boolean(
    apiKeys.openrouterKey || campKeysConfig.openrouterKey || persKeysConfig.openrouterKey
  );

  const isCurrentProviderKeyMissing =
    provider === 'openrouter' && !hasOpenRouterCredentials;

  const activeModelId = useMemo(() => {
    if (provider === 'openrouter') {
      const target = isCustomOpenrouter && customOpenrouterModel.trim()
        ? customOpenrouterModel.trim()
        : openrouterModel;
      return cleanOpenRouterModelId(target) || 'openrouter/free';
    }
    return isCustomGemini && customGeminiModel.trim() ? customGeminiModel.trim() : geminiModel;
  }, [
    provider,
    isCustomOpenrouter,
    customOpenrouterModel,
    openrouterModel,
    isCustomGemini,
    customGeminiModel,
    geminiModel,
  ]);

  const handleStopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (
    textToSend?: string,
    overrideModel?: string,
    overrideProvider?: LlmProviderType,
    overridePgIds?: string[],
    overrideEntityIds?: string[]
  ) => {
    const query = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!query || isLoading || !player) return;

    const targetProvider = overrideProvider || provider;
    let targetModel = overrideModel;

    if (!targetModel) {
      if (targetProvider === 'openrouter') {
        const target = isCustomOpenrouter && customOpenrouterModel.trim() ? customOpenrouterModel.trim() : openrouterModel;
        targetModel = cleanOpenRouterModelId(target) || 'openrouter/free';
      } else {
        targetModel = isCustomGemini && customGeminiModel.trim() ? customGeminiModel.trim() : geminiModel;
      }
    }

    if (overrideProvider && overrideProvider !== provider) {
      setProvider(overrideProvider);
      try {
        localStorage.setItem('chronicle_oracle_provider', overrideProvider);
      } catch {}
    }

    if (overrideModel) {
      if (targetProvider === 'openrouter') {
        setOpenrouterModel(overrideModel);
        setIsCustomOpenrouter(false);
        try { localStorage.setItem('chronicle_oracle_openrouter_model', overrideModel); } catch {}
      } else {
        setGeminiModel(overrideModel);
        setIsCustomGemini(false);
        try { localStorage.setItem('chronicle_oracle_gemini_model', overrideModel); } catch {}
      }
    }

    // Protection check: OpenRouter credit-consuming models blocked
    if (targetProvider === 'openrouter' && ApiKeyManager.isOpenRouterPaidBlocked()) {
      const isFreeModel = targetModel.endsWith(':free') || targetModel.includes(':free') || targetModel === 'openrouter/free';
      if (!isFreeModel) {
        setErrorDetails({
          error: `Il modello OpenRouter "${targetModel}" è a pagamento ed è bloccato dalle tue impostazioni di salvaguardia crediti.`,
          errorTitle: 'Modello a Consumo Bloccato',
          errorType: 'quota',
          suggestedAction: 'Seleziona un modello gratuito (:free) nel catalogo oppure disattiva il blocco crediti nelle Impostazioni.',
          canRetry: false,
          provider: 'openrouter',
        });
        return;
      }
    }

    setErrorDetails(null);
    setLastSubmittedQuery(query);
    setInputPrompt('');

    const userMessage: OracleMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    // AbortController setup
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeModel = targetModel;
      const effectivePgIds = overridePgIds !== undefined ? overridePgIds : selectedPgIds;
      const effectiveEntityIds = overrideEntityIds !== undefined ? overrideEntityIds : selectedEntityIds;

      const totalCount = effectivePgIds.length + effectiveEntityIds.length;
      const result = await OracleService.queryOracle({
        question: query,
        currentUser: effectivePlayer,
        history: messages,
        provider: targetProvider,
        model: activeModel,
        personaPrompt: activePersona.systemPrompt,
        codexEntity: totalCount >= 2 ? undefined : (activeCodexEntity || undefined),
        effortLevel: effectiveEffort,
        abortSignal: controller.signal,
        selectedPgIds: totalCount >= 2 ? effectivePgIds : undefined,
        selectedEntityIds: totalCount >= 2 ? effectiveEntityIds : undefined,
      });

      const rawAnswer = result && typeof result.answer === 'string' ? result.answer : '';
      const answerText = rawAnswer.trim();
      if (!answerText) {
        throw new OracleError({
          error: 'Il Registratere ha restituito una risposta vuota o non valida.',
          errorTitle: 'Risposta Vuota',
          errorType: 'generic',
          suggestedAction: 'Riprova a porre il quesito.',
          canRetry: true,
          provider,
        });
      }

      // Extract referenced sources mentioned in text e.g. [Sessione X], [Codex: Y], [Calendario: Z], [Nota: W], [Personaggio: K]
      const detectedSources: OracleSource[] = [];

      // 1. Sessions
      const sessionMatches = answerText.match(/\[Sessione\s+(\d+)[^\]]*\]/gi);
      if (sessionMatches) {
        const sessions = CampaignManager.getSessions();
        sessionMatches.forEach((match) => {
          const numMatch = match.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            const found = sessions.find((s) => s.number === num);
            if (found && !detectedSources.some((s) => s.link === `/sessions?session=${found._id}`)) {
              detectedSources.push({
                type: 'session',
                title: `Sessione ${found.number}: ${found.title}`,
                subtitle: found.loreDate || found.date,
                link: `/sessions?session=${found._id}`,
              });
            }
          }
        });
      }

      // 2. Codex Entities (Brackets & Raw Context Tags)
      const codexMatches = answerText.match(/\[(?:Codex|FACTION|NPC|PLACE|ITEM|QUEST|LOCATION|ORGANIZATION|FAZIONE|LUOGO|OGGETTO):\s*([^\]]+)\]/gi);
      if (codexMatches) {
        const entities = CampaignManager.getEntities();
        codexMatches.forEach((match) => {
          const rawName = match.replace(/\[(?:Codex|FACTION|NPC|PLACE|ITEM|QUEST|LOCATION|ORGANIZATION|FAZIONE|LUOGO|OGGETTO):\s*/i, '').replace(/\]$/, '').trim();
          const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();

          const found = entities.find(
            (e) =>
              e.name.toLowerCase() === cleanName.toLowerCase() ||
              (e.aliases && e.aliases.some((a) => a.toLowerCase() === cleanName.toLowerCase())) ||
              (cleanName.length >= 3 && e.name.toLowerCase().includes(cleanName.toLowerCase())) ||
              (cleanName.length >= 3 && cleanName.toLowerCase().includes(e.name.toLowerCase()))
          );

          if (found && !detectedSources.some((s) => s.link === `/codex/${found.type}/${found._id}`)) {
            detectedSources.push({
              type: 'codex',
              title: found.name,
              subtitle: found.type.toUpperCase(),
              link: `/codex/${found.type}/${found._id}`,
            });
          } else if (!found && cleanName && !detectedSources.some((s) => s.title === cleanName)) {
            detectedSources.push({
              type: 'codex',
              title: cleanName,
              subtitle: 'COMPENDIO',
              link: '/codex',
            });
          }
        });
      }

      // 2b. Automatic Entity Scanner: match any mentioned entity names/aliases in answerText
      const allEntities = CampaignManager.getEntities();
      allEntities.forEach((ent) => {
        if (ent.name && ent.name.trim().length >= 3) {
          const cleanEntName = ent.name.trim();
          const escapedName = cleanEntName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
          if (regex.test(answerText)) {
            if (!detectedSources.some((s) => s.link === `/codex/${ent.type}/${ent._id}`)) {
              detectedSources.push({
                type: 'codex',
                title: ent.name,
                subtitle: ent.type.toUpperCase(),
                link: `/codex/${ent.type}/${ent._id}`,
              });
            }
          }
        }
      });

      // 3. Calendar & Lore Dates
      const calendarMatches = answerText.match(/\[Calendario:\s*([^\]]+)\]/gi);
      if (calendarMatches) {
        calendarMatches.forEach((match) => {
          const calStr = match.replace(/\[Calendario:\s*/i, '').replace(/\]$/, '').trim();
          if (calStr && !detectedSources.some((s) => s.title === calStr)) {
            detectedSources.push({
              type: 'calendar',
              title: calStr,
              subtitle: 'CALENDARIO LORE',
              link: '/calendar',
            });
          }
        });
      }

      // 4. Notes & Diary (Only in General Archivist mode, NEVER in NPC Sendipietra mode)
      if (!activeCodexEntity) {
        const noteMatches = answerText.match(/\[(?:Nota|Diario):\s*([^\]]+)\]/gi);
        if (noteMatches) {
          const notes = CampaignManager.getNotes();
          noteMatches.forEach((match) => {
            const noteTitle = match.replace(/\[(?:Nota|Diario):\s*/i, '').replace(/\]$/, '').trim();
            const found = notes.find((n) => n.title.toLowerCase().includes(noteTitle.toLowerCase()));
            if (found && !detectedSources.some((s) => s.link === `/notes?note=${found._id}`)) {
              detectedSources.push({
                type: 'note',
                title: found.title,
                subtitle: found.author?.characterName ? `Nota di ${found.author.characterName}` : 'DIARIO',
                link: `/notes?note=${found._id}`,
              });
            } else if (noteTitle && !detectedSources.some((s) => s.title === noteTitle)) {
              detectedSources.push({
                type: 'note',
                title: noteTitle,
                subtitle: 'DIARIO',
                link: '/notes',
              });
            }
          });
        }

        // 5. Characters & Sheets
        const charMatches = answerText.match(/\[(?:Personaggio|Scheda):\s*([^\]]+)\]/gi);
        if (charMatches) {
          charMatches.forEach((match) => {
            const charName = match.replace(/\[(?:Personaggio|Scheda):\s*/i, '').replace(/\]$/, '').trim();
            if (charName && !detectedSources.some((s) => s.title === charName)) {
              detectedSources.push({
                type: 'character',
                title: charName,
                subtitle: 'SCHEDA PARTY',
                link: '/character',
              });
            }
          });
        }
      }

      // 6. Merge consulted sources (especially directly linked sessions) from OracleService
      if (Array.isArray(result.sources)) {
        result.sources.forEach((src) => {
          if (!detectedSources.some((s) => s.link === src.link || (s.title === src.title && s.type === src.type))) {
            detectedSources.push(src);
          }
        });
      }

      // Clean up any inline citation tags from the message text so direct speech / narration isn't interrupted by ugly brackets
      const cleanContent = answerText
        .replace(/\[Sessione\s+(\d+)[^\]]*\]/gi, 'Sessione $1')
        .replace(/\[(?:Codex|FACTION|NPC|PLACE|ITEM|QUEST|LOCATION|ORGANIZATION|FAZIONE|LUOGO|OGGETTO|Nota|Diario|Personaggio|Scheda|Calendario):\s*([^\]]+)\]/gi, '$1')
        .replace(/\(Fonte:[^)]+\)/gi, '')
        .replace(/\(Fonti:[^)]+\)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const assistantMessage: OracleMessage = {
        id: `msg_assistant_${Date.now()}`,
        role: 'assistant',
        content: cleanContent || answerText,
        thought: result.thought,
        sources: detectedSources.length > 0 ? detectedSources : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: result.modelUsed,
        engine: result.engine,
      };

      setMessages([...newHistory, assistantMessage]);
    } catch (err: any) {
      if (err?.message?.includes('interrotta') || err?.details?.error?.includes('interrotta')) {
        console.log('Richiesta interrotta dall\'utente.');
      } else {
        console.error('Registratere Error:', err);
        if (err instanceof OracleError) {
          setErrorDetails(err.details);
        } else {
          setErrorDetails({
            error: err.message || 'Errore imprevisto durante la consultazione del Registratere.',
            errorTitle: 'Errore Invocazione Registratere',
            errorType: 'generic',
            suggestedAction: 'Riprova tra qualche istante.',
            canRetry: true,
            provider,
          });
        }
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Mark existing messages on mount so they do not replay typing animations
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chronicle_oracle_chat_history');
      if (saved) {
        const parsed: OracleMessage[] = JSON.parse(saved);
        parsed.forEach((m) => {
          if (m && m.id) {
            renderedMessageIdsRef.current.add(m.id);
          }
        });
      }
    } catch {}
  }, []);

  // Trigger group dialogue sequential typing animation
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && !isLoading) {
      if (!renderedMessageIdsRef.current.has(lastMsg.id)) {
        renderedMessageIdsRef.current.add(lastMsg.id);
        const dialogueBlocks = parseGroupDialogueLines(lastMsg.content);
        const isGroup = dialogueBlocks.some(b => b.name !== '');
        
        if (isGroup) {
          setRevealedBlocks(prev => ({ ...prev, [lastMsg.id]: 0 }));
          
          const timers: NodeJS.Timeout[] = [];
          typingTimersRef.current[lastMsg.id] = timers;

          const revealNext = (index: number) => {
            if (index >= dialogueBlocks.length) {
              setTypingCharacter(prev => ({ ...prev, [lastMsg.id]: null }));
              return;
            }

            const currentBlock = dialogueBlocks[index];
            setTypingCharacter(prev => ({ ...prev, [lastMsg.id]: currentBlock.name }));

            // More realistic typing speed: longer base delay and higher multiplier with a random variance
            const textLen = currentBlock.text?.length || 0;
            const baseTime = 3000; // Minimum 3 seconds for simulated reading/thinking/typing
            const proportionalTime = textLen * 25; // 25ms per character
            const randomVariance = Math.random() * 1200; // Up to 1.2s random pause
            const typingTime = Math.min(8000, Math.max(2500, baseTime + proportionalTime + randomVariance));

            const timer = setTimeout(() => {
              setRevealedBlocks(prev => ({ ...prev, [lastMsg.id]: index + 1 }));
              revealNext(index + 1);
            }, typingTime);

            timers.push(timer);
          };

          revealNext(0);
        }
      }
    }
  }, [messages, isLoading]);

  // Trigger automatic Icebreaker prompt on selection of 2+ group dialog participants
  useEffect(() => {
    if (autoStartData && (selectedPgIds.length + selectedEntityIds.length) >= 2 && !isLoading) {
      const targetProv = autoStartData.provider || provider;
      const keyMissing =
        (targetProv === 'gemini' && !hasGeminiCredentials) ||
        (targetProv === 'openrouter' && !hasOpenRouterCredentials);

      if (!keyMissing) {
        const dataToStart = autoStartData;
        setAutoStartData(null);
        setMessages([]);
        handleSendMessage(dataToStart.prompt, dataToStart.model, dataToStart.provider);
      }
    }
  }, [autoStartData, selectedPgIds, selectedEntityIds, isLoading, provider, hasGeminiCredentials, hasOpenRouterCredentials]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    // Clear any active typing timers
    Object.values(typingTimersRef.current).forEach((timers) => {
      timers.forEach(clearTimeout);
    });
    typingTimersRef.current = {};
    renderedMessageIdsRef.current.clear();
    setRevealedBlocks({});
    setTypingCharacter({});

    setMessages([]);
    try {
      const scopedKey = getScopedChatKey(activeCampaignCodeClean, currentUserId);
      localStorage.removeItem(scopedKey);
      localStorage.removeItem('chronicle_oracle_chat_history');
    } catch {}
    setErrorDetails(null);
    setLastSubmittedQuery('');
    setIsClearModalOpen(false);
  };

  // Pre-configured questions grounded in campaign tasks
  const sampleQuestions = useMemo(() => {
    if (player?.isDm) {
      return [
        'Cosa è accaduto nell\'ultima sessione registrata?',
        'Che relazioni ci sono tra le fazioni principali e i PNG del compendio?',
        'Elenca tutti gli eventi della linea temporale del calendario.',
        'Quali sono i compiti o le quest in sospeso per il party?',
      ];
    }
    return [
      'Cosa è successo di importante nelle ultime sessioni che ho giocato?',
      'Quali informazioni pubbliche o storie condivise abbiamo su questo luogo o PNG?',
      'Qual è il calendario corrente della campagna e le sue festività?',
      'Quali luoghi o PNG abbiamo incontrato finora?',
    ];
  }, [player]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-surface-0 text-content-1">
      {/* MOBILE COMPACT HEADER (lg:hidden) */}
      <div className="lg:hidden relative z-30 border-b border-surface-2 bg-surface-1/95 backdrop-blur-sm px-3 py-2 shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Active Persona Selector Trigger Button */}
          <button
            type="button"
            onClick={() => setIsInterlocutorModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-0 hover:bg-surface-2 border border-primary/40 hover:border-primary text-xs font-semibold text-content-1 transition-all cursor-pointer shadow-xs min-w-0"
            title="Tocca per cambiare l'interlocutore o cercare un PNG del Compendio"
          >
            {React.createElement(activePersonaIcon, { size: 15, className: "text-primary shrink-0" })}
            <span className="truncate font-bold text-xs">{activePersona.name}</span>
            <ChevronDown size={13} className="text-content-3 shrink-0" />
          </button>

          {/* Controls: Model Badge + Export MD + Clear */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsOpenRouterCatalogOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-0 hover:bg-surface-2 border border-surface-3 text-xs font-mono text-content-2 transition-all cursor-pointer max-w-[130px] truncate"
              title="Sfoglia e cambia Modello o Provider AI"
            >
              {provider === 'openrouter' ? (
                <Zap size={13} className="text-indigo-400 shrink-0" />
              ) : (
                <Sparkles size={13} className="text-primary shrink-0" />
              )}
              <span className="truncate text-[11px] font-semibold">{activeModelId}</span>
              <ChevronDown size={11} className="text-content-3 shrink-0" />
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleExportChatMarkdown}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isCopiedExport
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'border-surface-3 hover:bg-surface-2 text-content-2 hover:text-content-1'
                }`}
                title="Copia l'intera conversazione in Markdown negli appunti"
              >
                {isCopiedExport ? <Check size={14} className="text-emerald-400" /> : <FileDown size={14} />}
              </button>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 rounded-xl border border-surface-3 text-content-3 hover:text-error hover:bg-error/10 hover:border-error/30 transition-colors cursor-pointer"
                title="Azzera chat"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Mobile Model/Provider Popover */}
        {isMobileControlsOpen && (
          <div className="mt-2 p-3 rounded-xl bg-surface-0 border border-surface-3 space-y-2.5 animate-fadeIn relative z-40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-3 uppercase tracking-wider font-mono">
                Provider API:
              </span>
              <div className="flex items-center bg-surface-1 border border-surface-3 rounded-lg p-0.5 font-mono">
                <button
                  type="button"
                  onClick={() => setProvider('gemini')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    provider === 'gemini' ? 'bg-primary text-white' : 'text-content-3'
                  }`}
                >
                  Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('openrouter')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    provider === 'openrouter' ? 'bg-amber-500 text-white' : 'text-content-3'
                  }`}
                >
                  OpenRouter
                </button>
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-bold text-content-3 uppercase tracking-wider font-mono block">
                Modello Gemini:
              </span>
              <select
                value={isCustomGemini ? 'custom' : geminiModel}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomGemini(true);
                  } else {
                    setIsCustomGemini(false);
                    setGeminiModel(e.target.value);
                  }
                  setIsMobileControlsOpen(false);
                }}
                className="w-full min-w-0 truncate bg-surface-1 border border-surface-3 rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
              >
                {liveGeminiModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {favoriteModelIds.includes(m.id) ? '★ ' : ''}{m.name} {m.badge ? `(${m.badge})` : ''}
                  </option>
                ))}
                <option value="custom">Altro modello Gemini...</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP FULL STREAMLINED HEADER */}
      <div className="hidden lg:block relative z-30 border-b border-surface-2 bg-surface-1/95 backdrop-blur-sm px-6 py-2.5 shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          {/* Left: App Title & Interlocutor Selector Dropdown */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-cinzel font-bold tracking-wide text-content-1">
                    Sendipietra
                  </h1>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-surface-3 text-content-3">
                    {campaignMeta?.name || campaignCode || 'Campagna'}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-5 w-px bg-surface-3 shrink-0" />

            {/* Main Interlocutor Picker Button */}
            <button
              type="button"
              onClick={() => setIsInterlocutorModalOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-0 hover:bg-surface-2 border border-primary/40 hover:border-primary text-xs font-mono transition-all cursor-pointer shadow-xs group shrink-0"
              title="Clicca per cambiare interlocutore o cercare un PNG del Compendio"
            >
              {React.createElement(activePersonaIcon, { size: 15, className: "text-primary shrink-0" })}
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-content-1 group-hover:text-primary transition-colors truncate max-w-[180px]">
                    {activePersona.name}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                </div>
                <span className="text-[10px] text-content-3 block truncate max-w-[180px]">
                  {activePersona.roleTitle}
                </span>
              </div>
              <ChevronDown size={14} className="text-content-3 group-hover:text-content-1 shrink-0 ml-1" />
            </button>
          </div>

          {/* Right: Controls (Model Popover, Export MD, Clear) */}
          <div className="flex items-center gap-2.5 text-xs shrink-0">
            {/* Model & Provider Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpenRouterCatalogOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-0 hover:bg-surface-2 border border-surface-3 hover:border-primary/50 text-xs font-mono transition-all cursor-pointer shadow-xs group relative z-50"
                title="Sfoglia Catalogo Completo Modelli AI"
              >
                {provider === 'openrouter' ? (
                  <Zap size={13} className="text-indigo-400 shrink-0" />
                ) : (
                  <Sparkles size={13} className="text-primary shrink-0" />
                )}
                <span className="font-semibold text-content-1 group-hover:text-primary transition-colors max-w-[140px] truncate">
                  {favoriteModelIds.includes(activeModelId) ? '★ ' : ''}{activeModelId}
                </span>
                <span className="text-[9px] uppercase font-bold text-content-3">
                  {provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}
                </span>
                <ChevronDown size={12} className="text-content-3 group-hover:text-content-1 shrink-0 ml-0.5" />
              </button>
            </div>

            {/* Export Markdown Button */}
            <button
              type="button"
              onClick={handleExportChatMarkdown}
              disabled={messages.length === 0}
              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-mono cursor-pointer ${
                isCopiedExport
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                  : messages.length === 0
                  ? 'border-surface-3/40 text-content-3/40 cursor-not-allowed'
                  : 'bg-surface-0 hover:bg-surface-2 border-surface-3 text-content-2 hover:text-content-1'
              }`}
              title="Copia l'intera conversazione formattata in Markdown negli appunti"
            >
              {isCopiedExport ? <Check size={13} className="text-emerald-400" /> : <FileDown size={13} />}
              <span>{isCopiedExport ? 'Copiato!' : 'Esporta MD'}</span>
            </button>

            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 rounded-xl border border-surface-3 bg-surface-0 hover:bg-error/10 hover:border-error/30 text-content-3 hover:text-error transition-colors cursor-pointer"
                title="Azzera cronologia quesiti"
              >
                <Trash2 size={14} />
              </button>
            )}

            {/* Quick Link to Settings if keys missing */}
            {((provider === 'gemini' && !hasGeminiCredentials) ||
              (provider === 'openrouter' && !hasOpenRouterCredentials)) && (
              <Link
                to="/settings"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors font-semibold"
                title="Configura chiave API nelle Impostazioni"
              >
                <Key size={12} />
                <span className="hidden sm:inline">Configura Chiave</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-5 max-w-4xl mx-auto w-full">
        {/* Contextual Sub-Codex & Relationship Banner */}
        {activeCodexEntity && (
          <div className="p-3.5 rounded-xl bg-surface-1/90 border border-primary/30 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-2/60 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {activeCodexEntity.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-content-1 truncate">
                      {activeCodexEntity.name}
                    </h3>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3">
                      {activeCodexEntity.type.toUpperCase()}
                    </span>
                    {activeCodexEntity.status === 'dead' && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        💀 Deceduto (Eco/Spirito)
                      </span>
                    )}
                  </div>
                  {activeCodexEntity.location && (
                    <span className="text-[10px] text-content-3 block truncate">
                      📍 {activeCodexEntity.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Badges: Known sessions, entities, memories & beliefs */}
              <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-content-3 flex-wrap">
                {activeCodexEntity.aiConfig?.timelineMemories && activeCodexEntity.aiConfig.timelineMemories.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25" title="Memorie e svolte storiche ancorate al calendario di Lore">
                    ⏳ {activeCodexEntity.aiConfig.timelineMemories.length} Memorie Lore
                  </span>
                )}
                {activeCodexEntity.aiConfig?.evolvingBeliefs && activeCodexEntity.aiConfig.evolvingBeliefs.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25" title="Teorie e credenze evolutive">
                    💡 {activeCodexEntity.aiConfig.evolvingBeliefs.length} Teorie
                  </span>
                )}
                {(() => {
                  const worldArticles = CampaignManager.getWorldLoreArticles();
                  let count = 0;
                  worldArticles.forEach((art) => {
                    (art.bites || []).forEach((b) => {
                      if (b.knownBy?.some((k) => k.id === activeCodexEntity._id && k.type === 'entity')) {
                        count++;
                      }
                    });
                  });
                  if (count === 0) return null;
                  return (
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25" title="Nozioni e principi cosmologici custoditi">
                      🌐 {count} Nozioni Lore
                    </span>
                  );
                })()}
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-surface-3" title="Sessioni vissute o registrate nel sotto-codex">
                  📜 {activeCodexEntity.aiConfig?.knownSessionIds?.length || 0} Sessioni Note
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-surface-3" title="Entità e fazioni conosciute">
                  🧠 {activeCodexEntity.aiConfig?.knownEntityIds?.length || 0} Entità Collegate
                </span>
              </div>
            </div>

            {/* Present Status in Campaign */}
            {activeCodexEntity.aiConfig?.currentStatus && (
              <div className="flex items-start gap-2 text-[11px] bg-surface-0/60 p-2 rounded-lg border border-surface-3/50">
                <Clock size={13} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-content-1 mr-1">Nel Presente:</span>
                  <span className="text-content-2 italic">{activeCodexEntity.aiConfig.currentStatus}</span>
                </div>
              </div>
            )}

            {/* Relationship towards the currently acting character */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-content-3 font-semibold shrink-0">Rapporto con {effectivePlayer.characterName}:</span>
                {activeRelationWithPlayer ? (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border font-semibold truncate ${
                    ATTITUDE_BADGES[activeRelationWithPlayer.attitude || 'neutral']?.className || 'text-content-2 bg-surface-2 border-surface-3'
                  }`}>
                    {ATTITUDE_BADGES[activeRelationWithPlayer.attitude || 'neutral']?.label || 'Neutrale'}
                    {activeRelationWithPlayer.relationType ? ` • "${activeRelationWithPlayer.relationType}"` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-content-3 italic">
                    😐 Nessun rapporto pregresso (Neutrale)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[45vh] text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-surface-3 flex items-center justify-center text-primary shadow-md">
              {provider === 'openrouter' ? <Zap size={28} className="text-amber-400" /> : <Sparkles size={28} />}
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-cinzel font-bold text-content-1">
                Sendipietra delle Cronache
              </h2>
              <p className="text-xs text-content-3 leading-relaxed">
                Stai interrogando l'agente con il profilo <strong className="text-content-1">{activePersona.name}</strong> ({activePersona.roleTitle}).
              </p>
              <div className="p-3 bg-surface-1 border border-surface-3 rounded-xl text-[11px] text-content-2 text-left space-y-1">
                <span className="font-bold text-content-1 block">Tono e comportamento attivo:</span>
                <p className="italic text-content-3 leading-relaxed">"{activePersona.description}"</p>
              </div>
            </div>

            {/* Suggested Prompt Chips */}
            <div className="w-full max-w-lg pt-2">
              <p className="text-[11px] font-semibold text-content-3 uppercase tracking-wider mb-2 text-left">
                Quesiti suggeriti:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {sampleQuestions.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sq)}
                    className="p-2.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-surface-3 hover:border-primary/40 text-left text-xs text-content-2 hover:text-content-1 transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
                  >
                    <span>{sq}</span>
                    <Send size={12} className="text-content-3 group-hover:text-primary transition-colors shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            // Skip the hidden automatic icebreaker or continuation prompts completely so user never sees them in the chat
            if (isUser && (
              msg.content === 'Iniziate la conversazione tra di voi! Discutete liberamente della situazione corrente della campagna e dei vostri prossimi passi.' ||
              msg.content === 'Continuate la discussione da dove siete rimasti! Seguite il flusso naturale della conversazione e dei vostri pareri.'
            )) {
              return null;
            }

            const dialogueBlocks = !isUser ? parseGroupDialogueLines(msg.content) : [];
            const isGroupDialogue = !isUser && dialogueBlocks.some(b => b.name !== '');

            if (isGroupDialogue) {
              const visibleCount = revealedBlocks[msg.id] ?? dialogueBlocks.length;
              const visibleBlocks = dialogueBlocks.slice(0, visibleCount);
              const isTyping = typingCharacter[msg.id] !== undefined && typingCharacter[msg.id] !== null;
              const currentTypingName = typingCharacter[msg.id];
              const isLastMsg = msg.id === messages[messages.length - 1]?.id;

              return (
                <div key={msg.id} className="w-full space-y-4">
                  {/* System Header indicating dialogue or model used */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-content-3 border-b border-surface-2/40 pb-1.5 px-1">
                    <Sparkles size={11} className="text-amber-400" />
                    <span>Confronto Recitato</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-medium">{msg.modelUsed}</span>
                      </>
                    )}
                  </div>

                  {msg.thought && (
                    <div className="p-3 rounded-xl bg-surface-2/40 border border-surface-3 max-w-[90%] text-xs space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedThoughtIds((prev) =>
                            prev.includes(msg.id) ? prev.filter((i) => i !== msg.id) : [...prev, msg.id]
                          );
                        }}
                        className="flex items-center justify-between w-full text-left text-[11px] font-mono font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Brain size={12} className="shrink-0" />
                          <span>Riflessione Interiore dell&apos;Interlocutore</span>
                        </span>
                        {expandedThoughtIds.includes(msg.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {expandedThoughtIds.includes(msg.id) && (
                        <p className="text-[11px] font-serif italic text-content-2 leading-relaxed border-t border-surface-3/60 pt-1.5 whitespace-pre-wrap">
                          &ldquo;{msg.thought}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Render parsed dialogue bubbles styled like a group chat */}
                  <div className="space-y-4 pl-2 sm:pl-4">
                    {visibleBlocks.map((block, idx) => {
                      if (!block.name) {
                        // Narrator/General block
                        return (
                          <div key={idx} className="text-xs font-serif italic text-content-2 max-w-[85%] bg-surface-2/30 px-3 py-1.5 rounded-lg border border-surface-3/30">
                            {block.text}
                          </div>
                        );
                      }

                      // Try to match avatar from players or entities
                      const matchedPlayer = CampaignManager.getPlayers().find(
                        (p) => p.characterName?.toLowerCase() === block.name.toLowerCase()
                      );
                      const matchedEntity = CampaignManager.getEntities().find(
                        (e) => e.name?.toLowerCase() === block.name.toLowerCase()
                      );

                      const avatarUrl = matchedPlayer?.avatarUrl || (matchedEntity?.images && matchedEntity.images.length > 0 ? matchedEntity.images[0] : undefined);
                      let IconComp = matchedPlayer ? User : Ghost;

                      return (
                        <div key={idx} className="flex items-start gap-3 max-w-[95%] sm:max-w-[85%] animate-fadeIn">
                          {avatarUrl && avatarUrl.trim() ? (
                            <img
                              src={avatarUrl}
                              alt={block.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-primary/20 bg-surface-2 shadow-sm"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-surface-2 border border-surface-3/80 flex items-center justify-center text-content-3 shrink-0 shadow-sm">
                              <IconComp size={14} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-bold text-primary font-cinzel block mb-1">
                              {block.name}
                            </span>
                            <div className="bg-surface-1/90 border border-surface-3/70 rounded-2xl rounded-tl-xs p-3.5 shadow-2xs relative group/sub">
                              {block.action && (
                                <span className="text-[11px] text-primary/70 font-semibold italic block mb-1.5">
                                  [{block.action}]
                                </span>
                              )}
                              <p className="text-xs sm:text-sm text-content-1 leading-relaxed whitespace-pre-wrap">
                                {block.text}
                              </p>

                              {/* Clipboard copy button for this specific bubble */}
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(`${msg.id}_b${idx}`, `${block.name}: ${block.action ? `[${block.action}] ` : ''}${block.text}`)}
                                className="absolute top-2 right-2 p-1 rounded-md bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 opacity-0 group-hover/sub:opacity-100 transition-opacity cursor-pointer"
                                title="Copia battuta"
                              >
                                {copiedId === `${msg.id}_b${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Animated Typing Indicator for group chats */}
                    {isTyping && currentTypingName && (
                      <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[85%] animate-pulse">
                        {(() => {
                          const matchedPlayer = CampaignManager.getPlayers().find(
                            (p) => p.characterName?.toLowerCase() === currentTypingName.toLowerCase()
                          );
                          const matchedEntity = CampaignManager.getEntities().find(
                            (e) => e.name?.toLowerCase() === currentTypingName.toLowerCase()
                          );
                          const avatarUrl = matchedPlayer?.avatarUrl || (matchedEntity?.images && matchedEntity.images.length > 0 ? matchedEntity.images[0] : undefined);
                          const IconComp = matchedPlayer ? User : Ghost;

                          return (
                            <>
                              {avatarUrl && avatarUrl.trim() ? (
                                <img
                                  src={avatarUrl}
                                  alt={currentTypingName}
                                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-primary/20 bg-surface-2 shadow-sm animate-pulse"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-surface-2 border border-surface-3/80 flex items-center justify-center text-content-3 shrink-0 shadow-sm">
                                  <IconComp size={14} />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-primary font-cinzel block mb-1">
                                  {currentTypingName}
                                </span>
                                <div className="inline-flex items-center gap-1.5 bg-surface-1/90 border border-surface-3/70 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs">
                                  <span className="text-xs font-mono font-medium text-primary animate-pulse">sta scrivendo</span>
                                  <span className="flex gap-1 items-center ml-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1.4s_infinite_0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1.4s_infinite_200ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1.4s_infinite_400ms]" />
                                  </span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Continua la Discussione Action Button */}
                  {isLastMsg && visibleCount >= dialogueBlocks.length && !isLoading && (
                    <div className="flex justify-center pt-2 sm:pl-12 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => handleSendMessage("Continuate la discussione da dove siete rimasti! Seguite il flusso naturale della conversazione e dei vostri pareri.")}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover border border-primary/40 hover:border-primary text-xs font-semibold text-white transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        title="Fai proseguire la conversazione tra i soggetti selezionati nella stessa chat"
                      >
                        <MessageSquarePlus size={14} />
                        <span>Continua la Discussione</span>
                      </button>
                    </div>
                  )}

                  {/* Detected Referenced Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-3 border-t border-surface-2 space-y-1.5 max-w-[90%]">
                      <p className="text-[10px] font-mono font-semibold text-content-3 uppercase tracking-wider">
                        Fonti &amp; Riferimenti Trovati:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, idx) => {
                          let Icon = BookOpen;
                          if (src.type === 'session') Icon = BookOpen;
                          else if (src.type === 'note') Icon = Scroll;
                          else if (src.type === 'codex') Icon = BookMarked;
                          else if (src.type === 'character') Icon = User;
                          else if (src.type === 'calendar') Icon = Clock;

                          return (
                            <Link
                              key={idx}
                              to={src.link || '#'}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-surface-3 text-[11px] text-content-2 hover:text-content-1 transition-colors font-mono"
                            >
                              <Icon size={12} className="text-primary" />
                              <span>{src.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-2 ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Header label */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-content-3 px-1">
                  <span>{isUser ? player?.characterName || 'Avventuriero' : `Sendipietra (${activePersona.name})`}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                  {msg.modelUsed && (
                    <>
                      <span>•</span>
                      <span className="text-primary font-medium">{msg.modelUsed}</span>
                    </>
                  )}
                </div>

                {/* Bubble Container */}
                <div
                  className={`p-4 rounded-2xl max-w-full sm:max-w-[90%] shadow-sm relative group ${
                    isUser
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-surface-1 border border-surface-2 text-content-1 rounded-tl-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {msg.thought && (
                        <div className="p-2.5 rounded-xl bg-surface-2/70 border border-surface-3 text-xs space-y-1.5 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedThoughtIds((prev) =>
                                prev.includes(msg.id) ? prev.filter((i) => i !== msg.id) : [...prev, msg.id]
                              );
                            }}
                            className="flex items-center justify-between w-full text-left text-[11px] font-mono font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Brain size={12} className="shrink-0" />
                              <span>Riflessione Interiore dell&apos;Interlocutore</span>
                            </span>
                            {expandedThoughtIds.includes(msg.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {expandedThoughtIds.includes(msg.id) && (
                            <p className="text-[11px] font-serif italic text-content-2 leading-relaxed border-t border-surface-3/60 pt-1.5 whitespace-pre-wrap">
                              &ldquo;{msg.thought}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      <MarkdownRenderer
                        content={msg.content}
                        className="text-xs sm:text-sm leading-relaxed text-content-1"
                      />

                      {/* Detected Referenced Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-surface-2 space-y-1.5">
                          <p className="text-[10px] font-mono font-semibold text-content-3 uppercase tracking-wider">
                            Fonti &amp; Riferimenti Trovati:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, idx) => {
                              let Icon = BookOpen;
                              if (src.type === 'session') Icon = BookOpen;
                              else if (src.type === 'note') Icon = Scroll;
                              else if (src.type === 'codex') Icon = BookMarked;
                              else if (src.type === 'character') Icon = User;
                              else if (src.type === 'calendar') Icon = Clock;

                              return (
                                <Link
                                  key={idx}
                                  to={src.link || '#'}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-surface-3 text-[11px] text-content-2 hover:text-content-1 transition-colors font-mono"
                                >
                                  <Icon size={12} className="text-primary" />
                                  <span>{src.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Copy Button for Assistant */}
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="absolute top-2 right-2 p-1 rounded-md bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Copia testo"
                    >
                      {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator with Stop Option */}
        {isLoading && (
          <div className="flex flex-col items-start space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-[11px] font-mono text-content-3 px-1">
              <span>Sendipietra ({activePersona.name})</span>
              <span>•</span>
              <span className="text-primary font-medium animate-pulse">Generazione in corso...</span>
            </div>
            <div className="p-4 rounded-2xl bg-surface-1 border border-surface-2 text-content-1 rounded-tl-xs flex items-center justify-between gap-4 w-full max-w-md shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-content-1">{activePersona.name} sta elaborando la risposta...</p>
                  <p className="text-[11px] text-content-3 font-mono">Incrocio dati di sessione e compendio</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Error Card */}
        {errorDetails && (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 space-y-3 animate-fadeIn text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="font-bold text-sm text-red-300">
                  {errorDetails.errorTitle || 'Errore Consultazione Sendipietra'}
                </h3>
                <p className="text-xs text-red-200/90 leading-relaxed font-mono whitespace-pre-wrap">
                  {errorDetails.error}
                </p>
              </div>
            </div>

            {errorDetails.suggestedAction && (
              <div className="p-2.5 bg-red-900/30 rounded-xl text-xs text-red-200 border border-red-800/40 flex items-start gap-2">
                <span className="font-bold text-red-300 shrink-0">Consiglio:</span>
                <span>{errorDetails.suggestedAction}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-800/40">
              {errorDetails.canRetry !== false && lastSubmittedQuery && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(lastSubmittedQuery)}
                  className="px-3 py-1.5 rounded-xl bg-red-800/60 hover:bg-red-700/60 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Riprova Ora</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Bottom Input Console */}
      <div className="border-t border-surface-2 bg-surface-1/95 backdrop-blur-sm p-2 sm:p-4 shrink-0">
        <div className="max-w-4xl mx-auto w-full space-y-2">
          {/* EFFORT & VERBOSITY SLIDER TOOLBAR */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            {/* Segmented Effort Slider */}
            <div className="flex items-center gap-1 bg-surface-0/90 border border-surface-3 rounded-xl p-0.5 font-mono text-[11px] shadow-2xs">
              <span className="text-[10px] text-content-3 font-bold px-1.5 flex items-center gap-1 select-none">
                <Gauge size={12} className="text-primary" />
                <span className="hidden sm:inline uppercase tracking-wider">Impegno:</span>
              </span>

              {/* Scatto 0: AUTO */}
              <button
                type="button"
                onClick={() => handleSelectEffortMode('auto')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  effortMode === 'auto'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                }`}
                title="Rileva automaticamente l'impegno in base alla complessità del quesito"
              >
                <span>Auto</span>
                {effortMode === 'auto' && (
                  <span className="text-[9px] opacity-90 hidden xs:inline">
                    ({EFFORT_PRESETS[suggestedEffort].shortLabel})
                  </span>
                )}
              </button>

              {/* Scatto 1: RAPIDO */}
              <button
                type="button"
                onClick={() => handleSelectEffortMode('brief')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  effortMode === 'brief'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                }`}
                title="Risposta rapida (1-2 frasi) per saluti, conferme o scambi veloci"
              >
                <span>⚡</span>
                <span className="hidden xs:inline">Rapido</span>
              </button>

              {/* Scatto 2: NATURALE */}
              <button
                type="button"
                onClick={() => handleSelectEffortMode('balanced')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  effortMode === 'balanced'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                }`}
                title="Risposta naturale equilibrata (1-2 paragrafi)"
              >
                <span>⚖️</span>
                <span className="hidden xs:inline">Naturale</span>
              </button>

              {/* Scatto 3: APPROFONDITO */}
              <button
                type="button"
                onClick={() => handleSelectEffortMode('deep')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  effortMode === 'deep'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                }`}
                title="Ricostruzione cronologica e dettagliata con fatti e relazioni"
              >
                <span>📜</span>
                <span className="hidden xs:inline">Approfondito</span>
              </button>
            </div>

            {/* Smart Contextual Suggestion Feedback Pill */}
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-content-3 truncate">
              {effortMode === 'auto' ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-0 border border-surface-3/60 text-content-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Suggerito:</span>
                  <strong className="text-primary font-bold">{EFFORT_PRESETS[suggestedEffort].label}</strong>
                  <span className="text-[9px] text-content-3">(~{EFFORT_PRESETS[suggestedEffort].maxTokens} tok)</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectEffortMode('auto')}
                  className="hover:underline text-content-3 hover:text-primary cursor-pointer flex items-center gap-1"
                  title="Clicca per riattivare la calibrazione automatica"
                >
                  <span>Manuale: <strong>{EFFORT_PRESETS[effortMode].shortLabel}</strong></span>
                  <span className="text-primary text-[9px] underline">(Reimposta Auto)</span>
                </button>
              )}
            </div>
          </div>

          {isCurrentProviderKeyMissing && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-3 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <Lock size={15} className="text-red-400 shrink-0" />
                <span className="truncate">
                  Chiave API per <strong>{provider.toUpperCase()}</strong> non configurata. I modelli sono bloccati.
                </span>
              </div>
              <Link
                to="/settings"
                className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-[11px] font-bold shrink-0 flex items-center gap-1.5 transition-colors"
              >
                <Key size={12} />
                <span>Configura nelle Impostazioni</span>
              </Link>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-surface-0 border border-surface-3 rounded-2xl p-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isCurrentProviderKeyMissing
                  ? `Chiave API per ${provider.toUpperCase()} mancante. Configurala nelle Impostazioni per iniziare a chattare.`
                  : `Chiedi a ${activePersona.name} sulle sessioni, PNG o relazioni...`
              }
              rows={1}
              disabled={isLoading || isCurrentProviderKeyMissing}
              className="w-full bg-transparent text-xs sm:text-sm text-content-1 placeholder:text-content-3/60 resize-none outline-none px-2 py-1 custom-scrollbar max-h-44 disabled:opacity-50"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStopRequest}
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md cursor-pointer shrink-0 flex items-center gap-1"
                title="Interrompi richiesta"
              >
                <Square size={14} className="fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isCurrentProviderKeyMissing}
                className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-surface-3 text-white disabled:text-content-3 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-md"
                title={isCurrentProviderKeyMissing ? 'Chiave API mancante' : 'Invia quesito'}
              >
                <Send size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-content-3 px-1">
            <span className="hidden sm:inline">
              Invio: <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-surface-3">Enter</kbd> • Nuovo rigo: <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-surface-3">Shift + Enter</kbd>
            </span>
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={() => setIsInterlocutorModalOpen(true)}
                className="hover:underline cursor-pointer flex items-center gap-1 text-content-2"
              >
                <span>Profilo:</span> <strong className="text-primary">{activePersona.name}</strong>
              </button>
              <span>•</span>
              <span className="truncate max-w-[150px]">
                Modello: <strong className="text-primary">{activeModelId}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interlocutor Selector Modal */}
      <InterlocutorSelectorModal
        isOpen={isInterlocutorModalOpen}
        onClose={() => setIsInterlocutorModalOpen(false)}
        selectedPersonaId={selectedPersonaId}
        activeCodexEntity={activeCodexEntity}
        selectedPgIds={selectedPgIds}
        selectedEntityIds={selectedEntityIds}
        currentProvider={provider}
        currentModelId={activeModelId}
        onSelectProvider={(p) => {
          setProvider(p);
          try {
            localStorage.setItem('chronicle_oracle_provider', p);
          } catch {}
        }}
        onSelectModel={(id, prov) => {
          const targetProv = prov || provider;
          setProvider(targetProv);
          try {
            localStorage.setItem('chronicle_oracle_provider', targetProv);
          } catch {}
          if (targetProv === 'openrouter') {
            setOpenrouterModel(id);
            setIsCustomOpenrouter(false);
            try { localStorage.setItem('chronicle_oracle_openrouter_model', id); } catch {}
          } else {
            setGeminiModel(id);
            setIsCustomGemini(false);
            try { localStorage.setItem('chronicle_oracle_gemini_model', id); } catch {}
          }
        }}
        onSelectPersona={(personaId) => {
          setActiveCodexEntity(null);
          setSelectedPgIds([]);
          setSelectedEntityIds([]);
          setSelectedPersonaId(personaId as any);
          navigate('/prismalink', { replace: true });
        }}
        onSelectCodexEntity={(ent) => {
          setActiveCodexEntity(ent);
          setSelectedPgIds([]);
          setSelectedEntityIds([]);
          navigate(`/prismalink?entityId=${ent._id}`, { replace: true });
        }}
        onSelectMultiSubject={(pgIds, entityIds, chosenModel, chosenProvider) => {
          setSelectedPgIds(pgIds);
          setSelectedEntityIds(entityIds);
          setActiveCodexEntity(null);

          const targetProv = chosenProvider || provider;
          const targetMod = chosenModel || (targetProv === 'openrouter' ? openrouterModel : geminiModel);

          if (targetProv) {
            setProvider(targetProv);
            try { localStorage.setItem('chronicle_oracle_provider', targetProv); } catch {}
          }
          if (targetMod && targetProv) {
            if (targetProv === 'openrouter') {
              setOpenrouterModel(targetMod);
              setIsCustomOpenrouter(false);
              try { localStorage.setItem('chronicle_oracle_openrouter_model', targetMod); } catch {}
            } else {
              setGeminiModel(targetMod);
              setIsCustomGemini(false);
              try { localStorage.setItem('chronicle_oracle_gemini_model', targetMod); } catch {}
            }
          }

          setMessages([]);
          handleSendMessage(
            "Iniziate la conversazione tra di voi! Discutete liberamente della situazione corrente della campagna e dei vostri prossimi passi.",
            targetMod,
            targetProv,
            pgIds,
            entityIds
          );
          navigate('/prismalink', { replace: true });
        }}
      />

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onCancel={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
        title="Azzera Cronologia Sendipietra"
        message="Sei sicuro di voler azzerare l'intera cronologia di consultazione dell'agente per questa sessione?"
        confirmLabel="Azzera Cronologia"
        isDestructive={true}
      />

      {/* Unified Live LLM Catalog Modal (Gemini, Groq, OpenRouter) */}
      <LlmCatalogModal
        isOpen={isOpenRouterCatalogOpen}
        onClose={() => setIsOpenRouterCatalogOpen(false)}
        activeProvider={provider}
        onSelectProvider={(p) => {
          setProvider(p);
          CampaignManager.saveUserPreferences({ aiProvider: p });
        }}
        currentModelId={activeModelId}
        onSelectModel={(id, selectedProvider) => {
          const targetProvider = selectedProvider || provider;
          setProvider(targetProvider);
          if (targetProvider === 'openrouter') {
            setOpenrouterModel(id);
            setIsCustomOpenrouter(false);
            CampaignManager.saveUserPreferences({ aiProvider: targetProvider, oracleOpenrouterModel: id });
          } else {
            setGeminiModel(id);
            setIsCustomGemini(false);
            CampaignManager.saveUserPreferences({ aiProvider: targetProvider, oracleGeminiModel: id });
          }
        }}
        favoriteModelIds={favoriteModelIds}
        onToggleFavorite={toggleFavoriteModel}
        isDm={Boolean(player?.isDm)}
      />
    </div>
  );
}
