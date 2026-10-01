import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Brain,
  Sparkles,
  Clock,
  Users,
  Shield,
  AlertCircle,
  X,
  RefreshCw,
  Check,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  User,
  Cpu,
  Zap,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Terminal,
  Layers,
  Lightbulb,
  HeartHandshake,
  Compass,
  Star,
  Lock,
} from 'lucide-react';
import { Portal } from './Portal';
import {
  Session,
  EntityMemoryProposal,
  PlayerMemoryProposal,
  RelationAttitude,
  TimelineMemoryEntry,
  EvolvingBelief,
  InterPartyRelation,
} from '../types';
import { SessionMemorySyncService } from '../lib/sessionMemorySyncService';
import { CampaignManager } from '../store/campaignStore';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { fetchAvailableGeminiModels } from '../lib/geminiModels';
import { CURATED_OPENROUTER_MODELS, OpenRouterCatalogItem } from '../lib/openrouterUtils';
import { LlmCatalogModal, LlmProviderType } from './OpenRouterCatalogModal';

interface SessionMemorySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onApplied?: () => void;
}

const ATTITUDE_LABELS: Record<RelationAttitude, string> = {
  friendly: '😊 Amichevole',
  helpful: '🤝 Disponibile',
  neutral: '😐 Neutrale',
  suspicious: '🤨 Diffidente',
  hostile: '😡 Ostile',
  fearful: '😨 Timoroso',
  devoted: '👑 Devoto',
};

const BELIEF_STATUS_LABELS: Record<EvolvingBelief['status'], { label: string; cls: string }> = {
  active_theory: {
    label: '💡 Teoria Attiva',
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  },
  proven_fact: {
    label: '✅ Verità Svelata',
    cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  },
  shattered_belief: {
    label: '❌ Credenza Smentita',
    cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
  },
  suspicion: {
    label: '🔍 Sospetto / Ipotesi',
    cls: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  },
  pact: {
    label: '📜 Patto / Giuramento',
    cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  },
};

const MEMORY_CATEGORY_LABELS: Record<TimelineMemoryEntry['category'], { label: string; cls: string }> = {
  discovery: { label: 'Scossa & Rivelazione', cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
  belief_shift: { label: 'Cambio di Opinione', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  relationship: { label: 'Svolta di Relazione', cls: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
  milestone: { label: 'Traguardo Raggiunto', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  trauma: { label: 'Ferita & Trauma', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  secret: { label: 'Patto o Segreto', cls: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  event: { label: 'Avvenimento Chiave', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
};

export function SessionMemorySyncModal({
  isOpen,
  onClose,
  session,
  onApplied,
}: SessionMemorySyncModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<EntityMemoryProposal[]>([]);
  const [playerProposals, setPlayerProposals] = useState<PlayerMemoryProposal[]>([]);
  const [activeSyncTab, setActiveSyncTab] = useState<'players' | 'entities'>('players');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ count: number; names: string[] } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [includeDmAsPlayer, setIncludeDmAsPlayer] = useState(() => {
    try {
      return localStorage.getItem('chronicle_include_dm_as_player') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleIncludeDmAsPlayer = (val: boolean) => {
    setIncludeDmAsPlayer(val);
    try {
      localStorage.setItem('chronicle_include_dm_as_player', String(val));
    } catch {}
  };

  useEffect(() => {
    const handleSyncSetting = (e: any) => {
      if (e && typeof e.detail === 'boolean') {
        setIncludeDmAsPlayer(e.detail);
      }
    };
    window.addEventListener('chronicle_include_dm_as_player_changed', handleSyncSetting);
    return () => {
      window.removeEventListener('chronicle_include_dm_as_player_changed', handleSyncSetting);
    };
  }, []);

  // Provider & Model State
  const [provider, setProvider] = useState<LlmProviderType>(() => {
    try {
      const saved = localStorage.getItem('chronicle_session_sync_provider') || localStorage.getItem('chronicle_oracle_provider');
      if (saved === 'openrouter' || saved === 'gemini') return saved;
    } catch {}
    return 'gemini';
  });

  const [geminiModel, setGeminiModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('chronicle_session_sync_gemini_model');
      if (saved && !saved.includes('2.') && !saved.includes('1.5')) return saved;
    } catch {}
    return 'gemini-3.8-flash';
  });

  const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('chronicle_session_sync_openrouter_model');
      if (saved) return saved;
    } catch {}
    return 'google/gemini-2.5-flash:free';
  });

  const [isOpenRouterCatalogOpen, setIsOpenRouterCatalogOpen] = useState(false);
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Timer for loading feedback
  useEffect(() => {
    let timer: any = null;
    if (isLoading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setProposals([]);
      setPlayerProposals([]);
      setError(null);
      setSaveSuccess(null);
      setHasStartedAnalysis(false);
      setActiveSyncTab('players');
    }
  }, [isOpen, session?._id]);

  const handleProviderChange = (newProvider: LlmProviderType) => {
    setProvider(newProvider);
    try {
      localStorage.setItem('chronicle_session_sync_provider', newProvider);
    } catch {}
  };

  const handleGeminiModelChange = (modelId: string) => {
    setGeminiModel(modelId);
    try {
      localStorage.setItem('chronicle_session_sync_gemini_model', modelId);
    } catch {}
  };

  const handleOpenRouterModelChange = (modelId: string) => {
    setOpenrouterModel(modelId);
    try {
      localStorage.setItem('chronicle_session_sync_openrouter_model', modelId);
    } catch {}
  };

  const handleStartAnalysis = async () => {
    if (!session) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setSaveSuccess(null);
    setHasStartedAnalysis(true);

    const activeModel = provider === 'openrouter' ? openrouterModel : geminiModel;

    try {
      const res = await SessionMemorySyncService.analyzeSession({
        session,
        preferredProvider: provider,
        preferredModel: activeModel,
        includeDmAsPlayer,
        signal: controller.signal,
      });

      const detected = res.detectedEntities || [];
      const players = res.playerProposals || [];
      setProposals(detected);
      setPlayerProposals(players);

      if (players.length > 0) {
        setActiveSyncTab('players');
      } else if (detected.length > 0) {
        setActiveSyncTab('entities');
      }
    } catch (err: any) {
      console.error('Session memory sync analysis error:', err);
      setError(err?.message || "Errore durante l'analisi della memoria della sessione.");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Toggle helpers for PG proposals
  const handleTogglePlayerProposal = (playerId: string, enabled: boolean) => {
    setPlayerProposals((prev) =>
      prev.map((p) => {
        if (p.playerId !== playerId) return p;
        return {
          ...p,
          applyCurrentStatus: enabled,
          applyTimelineMemories: enabled,
          applyEvolvingBeliefs: enabled,
          interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r) => ({
            ...r,
            applied: enabled,
          })),
        };
      })
    );
  };

  const handleToggleAllPlayers = (enabled: boolean) => {
    setPlayerProposals((prev) =>
      prev.map((p) => ({
        ...p,
        applyCurrentStatus: enabled,
        applyTimelineMemories: enabled,
        applyEvolvingBeliefs: enabled,
        interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r) => ({
          ...r,
          applied: enabled,
        })),
      }))
    );
  };

  // Toggle helpers for Entity proposals
  const handleToggleEntityProposal = (entityId: string, enabled: boolean) => {
    setProposals((prev) =>
      prev.map((prop) => {
        if (prop.entityId !== entityId) return prop;
        return {
          ...prop,
          applyCurrentStatus: enabled,
          applySessionToMemory: enabled,
          applyNewKnowledge: enabled,
          applyTimelineMemories: enabled,
          applyEvolvingBeliefs: enabled,
          partyRelationUpdates: (prop.partyRelationUpdates || []).map((pru) => ({
            ...pru,
            applied: enabled,
          })),
          entityRelationUpdates: (prop.entityRelationUpdates || []).map((eru) => ({
            ...eru,
            applied: enabled,
          })),
        };
      })
    );
  };

  const handleToggleAllEntities = (enabled: boolean) => {
    setProposals((prev) =>
      prev.map((prop) => ({
        ...prop,
        applyCurrentStatus: enabled,
        applySessionToMemory: enabled,
        applyNewKnowledge: enabled,
        applyTimelineMemories: enabled,
        applyEvolvingBeliefs: enabled,
        partyRelationUpdates: (prop.partyRelationUpdates || []).map((pru) => ({
          ...pru,
          applied: enabled,
        })),
        entityRelationUpdates: (prop.entityRelationUpdates || []).map((eru) => ({
          ...eru,
          applied: enabled,
        })),
      }))
    );
  };

  const handleSave = () => {
    if (!session || (proposals.length === 0 && playerProposals.length === 0)) return;
    setIsSaving(true);
    try {
      const res = SessionMemorySyncService.applyApprovedProposals(proposals, session._id, playerProposals);
      setSaveSuccess({
        count: res.updatedCount,
        names: res.updatedEntityNames,
      });
      if (onApplied) onApplied();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Error applying proposals:', err);
      setError(err?.message || 'Errore durante il salvataggio degli aggiornamenti nel compendio.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalActivePlayersCount = playerProposals.filter(
    (p) =>
      p.applyCurrentStatus ||
      p.applyTimelineMemories ||
      p.applyEvolvingBeliefs ||
      (p.interPartyRelationUpdates && p.interPartyRelationUpdates.some((r) => r.applied))
  ).length;

  const totalActiveEntitiesCount = proposals.filter(
    (p) =>
      p.applyCurrentStatus ||
      p.applySessionToMemory ||
      p.applyNewKnowledge ||
      p.applyTimelineMemories ||
      p.applyEvolvingBeliefs ||
      p.partyRelationUpdates.some((r) => r.applied) ||
      p.entityRelationUpdates.some((r) => r.applied)
  ).length;

  const totalUpdatesCount = totalActivePlayersCount + totalActiveEntitiesCount;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-surface-0/80 backdrop-blur-md overflow-hidden animate-fadeIn font-body"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading && !isSaving) onClose();
        }}
      >
        <div className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-surface-2 bg-surface-2/40 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Brain size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-primary uppercase">
                  <span>Memoria Dinamica &amp; Lore Date</span>
                  <span className="text-surface-3">/</span>
                  <span className="text-content-3 truncate">
                    Sessione {session?.number || ''}: {session?.title || ''}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-content-1 truncate flex items-center gap-2">
                  <span>Sincronizzazione Memoria Party &amp; Mondo</span>
                  {session?.loreDate && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                      ⏳ {session.loreDate}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isSaving}
                className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Provider & Model Selector Strip */}
          <div className="px-4 sm:px-5 py-2.5 bg-surface-2/70 border-b border-surface-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-content-3 flex items-center gap-1.5 font-medium">
                <Cpu size={13} className="text-primary" />
                <span>Motore IA:</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-1 border border-surface-3 uppercase text-content-2">
                {provider}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <button
                type="button"
                onClick={() => setIsOpenRouterCatalogOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-surface-3 hover:border-primary/40 text-xs font-mono transition-all cursor-pointer shadow-xs"
              >
                {provider === 'openrouter' ? (
                  <Zap size={14} className="text-indigo-400 shrink-0" />
                ) : (
                  <Sparkles size={14} className="text-primary shrink-0" />
                )}
                <span className="font-bold text-content-1 truncate max-w-[140px] sm:max-w-[200px]">
                  {provider === 'openrouter' ? openrouterModel : geminiModel}
                </span>
                <ChevronDown size={12} className="text-content-3 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-surface-1 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <RefreshCw size={11} className={isLoading ? 'animate-spin text-primary' : ''} />
                <span>Analizza</span>
              </button>
            </div>
          </div>

          {/* Options Strip */}
          <div className="px-4 sm:px-5 py-2 bg-surface-2/40 border-b border-surface-2 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
            <label className="flex items-center gap-2 text-content-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={includeDmAsPlayer}
                onChange={(e) => handleToggleIncludeDmAsPlayer(e.target.checked)}
                className="rounded border-surface-3 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
              />
              <Users size={12} className="text-primary shrink-0" />
              <span>Includi il Dungeon Master come PG giocante nelle relazioni del gruppo</span>
            </label>
            <span className="text-[10px] font-mono text-content-3 hidden sm:inline text-right">
              Analisi incrociata PG ↔ PG &amp; Teorie di Lore
            </span>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
            {/* Loading State */}
            {isLoading && (
              <div className="py-8 max-w-lg mx-auto space-y-6">
                <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <Brain size={24} className="text-primary animate-pulse" />
                </div>

                <div className="text-center space-y-1.5">
                  <h4 className="text-sm font-semibold text-content-1">
                    L&apos;Archivista Arcano sta analizzando memorie, legami e teorie di Lore...
                  </h4>
                  <p className="text-xs font-mono text-primary font-semibold flex items-center justify-center gap-1.5">
                    <Cpu size={12} />
                    <span>
                      Motore: {provider === 'openrouter' ? `OpenRouter (${openrouterModel})` : `Google Gemini (${geminiModel})`}
                    </span>
                    <span className="text-surface-3">•</span>
                    <span className="text-content-2">Tempo: {elapsedSeconds}s</span>
                  </p>
                </div>

                {/* Progress Stepper */}
                <div className="bg-surface-2/60 border border-surface-3 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
                  <div className="flex items-center gap-2.5 text-emerald-400">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span className="flex-1">Scansione testo sessione &amp; recupero profili PG</span>
                    <span className="text-[10px] text-emerald-300">OK</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-amber-300">
                    <RefreshCw size={13} className="shrink-0 animate-spin text-amber-400" />
                    <span className="flex-1">Deduzione memorie temporali, credenze e relazioni PG ↔ PG...</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                      {elapsedSeconds}s
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-content-3">
                    <Clock size={13} className="shrink-0" />
                    <span className="flex-1">Generazione schede di revisione e approvazione</span>
                    <span className="text-[10px] text-content-3">In attesa</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleStopAnalysis}
                    className="px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-rose-500/15 text-content-3 hover:text-rose-400 border border-surface-3 text-xs font-mono transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Square size={11} />
                    <span>Interrompi Richiesta</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {!isLoading && error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider">Errore durante la sincronizzazione</h4>
                    <p className="text-xs leading-relaxed">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                >
                  Riprova Analisi
                </button>
              </div>
            )}

            {/* Save Success */}
            {!isLoading && saveSuccess && (
              <div className="py-10 text-center space-y-3 animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <h4 className="text-sm font-bold text-content-1">
                  Sincronizzazione completata con successo!
                </h4>
                <p className="text-xs text-content-3">
                  Aggiornati {saveSuccess.count} profili ed entità di campagna con le memorie e la Data di Lore.
                </p>
              </div>
            )}

            {/* Empty State before start */}
            {!isLoading && !error && !saveSuccess && !hasStartedAnalysis && proposals.length === 0 && playerProposals.length === 0 && (
              <div className="py-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                  <Brain size={28} />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-sm font-bold text-content-1">
                    Evoluzione Memorie dei PG &amp; Compendio di Campagna
                  </h4>
                  <p className="text-xs text-content-3 leading-relaxed">
                    L&apos;IA analizzerà gli eventi della Sessione {session?.number} per aggiornare la memoria viva dei membri del gruppo (fiducia PG ↔ PG, teorie verificate o smentite, ricordi con Data di Lore) e lo stato dei PNG.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="px-5 py-2.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Play size={14} />
                  <span>Avvia Analisi Sincronizzazione Memoria</span>
                </button>
              </div>
            )}

            {/* Results Review & Approval */}
            {!isLoading && !error && !saveSuccess && (playerProposals.length > 0 || proposals.length > 0) && (
              <div className="space-y-4 animate-fadeIn">
                {/* Categorized Tab Selector */}
                <div className="flex items-center justify-between gap-3 border-b border-surface-2 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSyncTab('players')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeSyncTab === 'players'
                          ? 'bg-primary text-surface-0 shadow-xs'
                          : 'bg-surface-2 text-content-3 hover:text-content-1'
                      }`}
                    >
                      <Users size={13} />
                      <span>Avventurieri del Party (PG)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                        {playerProposals.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSyncTab('entities')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeSyncTab === 'entities'
                          ? 'bg-primary text-surface-0 shadow-xs'
                          : 'bg-surface-2 text-content-3 hover:text-content-1'
                      }`}
                    >
                      <Shield size={13} />
                      <span>PNG &amp; Compendio (Codex)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                        {proposals.length}
                      </span>
                    </button>
                  </div>

                  {/* Batch Actions */}
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => (activeSyncTab === 'players' ? handleToggleAllPlayers(true) : handleToggleAllEntities(true))}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Seleziona Tutti
                    </button>
                    <span className="text-surface-3">|</span>
                    <button
                      type="button"
                      onClick={() => (activeSyncTab === 'players' ? handleToggleAllPlayers(false) : handleToggleAllEntities(false))}
                      className="text-content-3 hover:text-content-1 cursor-pointer"
                    >
                      Deseleziona Tutti
                    </button>
                  </div>
                </div>

                {/* TAB 1: PLAYER CHARACTERS (PG ↔ PG, BELIEFS, TIMELINE) */}
                {activeSyncTab === 'players' && (
                  <div className="space-y-4">
                    {playerProposals.length === 0 ? (
                      <div className="p-6 text-center text-xs text-content-3 bg-surface-2/30 rounded-xl border border-surface-3">
                        Nessun membro del gruppo rilevato esplicitamente nel testo di questa sessione.
                      </div>
                    ) : (
                      playerProposals.map((pp, ppIdx) => (
                        <div
                          key={pp.playerId || ppIdx}
                          className="p-4 rounded-xl bg-surface-1 border border-surface-3 space-y-3.5 hover:border-surface-3/80 transition-all shadow-xs"
                        >
                          {/* PG Header */}
                          <div className="flex items-start justify-between gap-3 border-b border-surface-2/60 pb-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-content-1 truncate">
                                  {pp.characterName}
                                </h4>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
                                  Membro Party
                                </span>
                                {pp.reason && (
                                  <span className="text-[10px] text-content-3 italic font-mono">
                                    • {pp.reason}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const isActive =
                                  pp.applyCurrentStatus ||
                                  pp.applyTimelineMemories ||
                                  pp.applyEvolvingBeliefs ||
                                  (pp.interPartyRelationUpdates && pp.interPartyRelationUpdates.some((r) => r.applied));
                                handleTogglePlayerProposal(pp.playerId, !isActive);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-mono text-content-3 hover:text-content-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer shrink-0"
                            >
                              Tutto per {pp.characterName}
                            </button>
                          </div>

                          {/* PG Current Status */}
                          {pp.suggestedCurrentStatus && (
                            <div className="space-y-1.5 p-2.5 rounded-lg bg-surface-2/40 border border-surface-3/60">
                              <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={!!pp.applyCurrentStatus}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPlayerProposals((prev) =>
                                        prev.map((p) => (p.playerId === pp.playerId ? { ...p, applyCurrentStatus: checked } : p))
                                      );
                                    }}
                                    className="rounded border-surface-3 text-primary focus:ring-primary"
                                  />
                                  <Clock size={12} className="text-primary" />
                                  <span>Stato &amp; Riflessione Attuale del PG</span>
                                </span>
                              </label>
                              <textarea
                                rows={2}
                                value={pp.suggestedCurrentStatus}
                                disabled={!pp.applyCurrentStatus}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPlayerProposals((prev) =>
                                    prev.map((p) =>
                                      p.playerId === pp.playerId ? { ...p, suggestedCurrentStatus: val } : p
                                    )
                                  );
                                }}
                                className={`w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none resize-none font-mono ${
                                  !pp.applyCurrentStatus ? 'opacity-40' : ''
                                }`}
                              />
                            </div>
                          )}

                          {/* PG Timeline Memories with Lore Date */}
                          {pp.timelineMemories && pp.timelineMemories.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-surface-3/60">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers size={12} />
                                  <span>Memorie di Lore &amp; Svolte della Sessione ({session?.loreDate || 'Data Lore'}):</span>
                                </span>
                                <label className="text-[11px] font-mono text-content-3 flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!pp.applyTimelineMemories}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPlayerProposals((prev) =>
                                        prev.map((p) => (p.playerId === pp.playerId ? { ...p, applyTimelineMemories: checked } : p))
                                      );
                                    }}
                                    className="rounded border-surface-3 text-primary focus:ring-primary"
                                  />
                                  <span>Collega memorie alla scheda PG</span>
                                </label>
                              </div>

                              <div className="space-y-2">
                                {pp.timelineMemories.map((mem, memIdx) => {
                                  const catInfo = MEMORY_CATEGORY_LABELS[mem.category] || MEMORY_CATEGORY_LABELS.event;
                                  return (
                                    <div
                                      key={mem.id || memIdx}
                                      className="p-2.5 rounded-lg bg-surface-2/60 border border-surface-3 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${catInfo.cls}`}>
                                            {catInfo.label}
                                          </span>
                                          {mem.loreDate && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-3 text-content-2">
                                              ⏳ {mem.loreDate}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-mono text-content-3">
                                          Impatto: {mem.impact === 'major' ? '⭐ Svolta' : mem.impact === 'secret' ? '🔒 Segreto' : '📜 Normale'}
                                        </span>
                                      </div>
                                      <div className="font-bold text-content-1">{mem.title}</div>
                                      <p className="text-content-2 text-[11px] leading-relaxed">{mem.summary}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* PG Evolving Beliefs */}
                          {pp.evolvingBeliefs && pp.evolvingBeliefs.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-surface-3/60">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Lightbulb size={12} />
                                  <span>Evoluzione Teorie &amp; Credenze di {pp.characterName}:</span>
                                </span>
                                <label className="text-[11px] font-mono text-content-3 flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!pp.applyEvolvingBeliefs}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPlayerProposals((prev) =>
                                        prev.map((p) => (p.playerId === pp.playerId ? { ...p, applyEvolvingBeliefs: checked } : p))
                                      );
                                    }}
                                    className="rounded border-surface-3 text-primary focus:ring-primary"
                                  />
                                  <span>Applica teorie alla scheda</span>
                                </label>
                              </div>

                              <div className="space-y-2">
                                {pp.evolvingBeliefs.map((bel, belIdx) => {
                                  const statusInfo = BELIEF_STATUS_LABELS[bel.status] || BELIEF_STATUS_LABELS.active_theory;
                                  return (
                                    <div
                                      key={bel.id || belIdx}
                                      className="p-2.5 rounded-lg bg-surface-2/60 border border-surface-3 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${statusInfo.cls}`}>
                                            {statusInfo.label}
                                          </span>
                                          <span className="font-bold text-content-1">Soggetto: {bel.subject}</span>
                                        </div>
                                        {bel.revealedLoreDate && (
                                          <span className="text-[10px] font-mono text-content-3">
                                            Rivelato il: {bel.revealedLoreDate}
                                          </span>
                                        )}
                                      </div>

                                      {bel.previousBelief && (
                                        <p className="text-[11px] text-content-3 font-mono line-through opacity-70">
                                          Credenza passata: &ldquo;{bel.previousBelief}&rdquo;
                                        </p>
                                      )}
                                      <p className="text-[11px] text-content-1 font-mono bg-surface-1 p-2 rounded border border-surface-3">
                                        👉 Verità / Deduzione attuale: &ldquo;{bel.currentTruth}&rdquo;
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* PG Inter-Party Relationships (PG ↔ PG) */}
                          {pp.interPartyRelationUpdates && pp.interPartyRelationUpdates.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-surface-3/60">
                              <span className="text-[11px] font-mono font-bold text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                                <HeartHandshake size={12} />
                                <span>Rapporti e Fiducia con i Compagni del Party (PG ↔ PG):</span>
                              </span>

                              <div className="grid grid-cols-1 gap-2">
                                {pp.interPartyRelationUpdates.map((rel, relIdx) => {
                                  const attLabel = ATTITUDE_LABELS[rel.newAttitude || 'neutral'];
                                  return (
                                    <div
                                      key={rel.targetPlayerId || relIdx}
                                      className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                                        rel.applied ? 'bg-surface-2/70 border-surface-3' : 'bg-surface-1 border-surface-3/50 opacity-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <label className="flex items-center gap-2 font-bold text-content-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={!!rel.applied}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setPlayerProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.playerId !== pp.playerId) return p;
                                                  return {
                                                    ...p,
                                                    interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r, idx) =>
                                                      idx === relIdx ? { ...r, applied: checked } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="rounded border-surface-3 text-primary focus:ring-primary"
                                          />
                                          <User size={13} className="text-pink-400" />
                                          <span>Verso compagno: {rel.targetCharacterName}</span>
                                        </label>

                                        <div className="flex items-center gap-2 text-[11px] font-mono">
                                          <span className="text-content-3">Fiducia: {rel.newTrust ?? 5}/10</span>
                                          {rel.previousAttitude && rel.previousAttitude !== rel.newAttitude && (
                                            <span className="text-content-3 opacity-75">
                                              {ATTITUDE_LABELS[rel.previousAttitude] || rel.previousAttitude} ➔
                                            </span>
                                          )}
                                          <select
                                            value={rel.newAttitude || 'neutral'}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value as RelationAttitude;
                                              setPlayerProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.playerId !== pp.playerId) return p;
                                                  return {
                                                    ...p,
                                                    interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r, idx) =>
                                                      idx === relIdx ? { ...r, newAttitude: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="bg-surface-1 border border-surface-3 text-primary font-bold rounded px-1.5 py-0.5 text-[11px] outline-none cursor-pointer"
                                          >
                                            {Object.entries(ATTITUDE_LABELS).map(([k, lbl]) => (
                                              <option key={k} value={k}>
                                                {lbl}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      {rel.reason && (
                                        <p className="text-[11px] text-content-3 italic pl-5">
                                          {rel.reason}
                                        </p>
                                      )}

                                      {/* Milestone Event Input */}
                                      <div className="pl-5 pt-0.5 space-y-1">
                                        <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 font-semibold">
                                          <Sparkles size={11} />
                                          <span>Svolta Narrativa / Pietra Miliare (Progressione):</span>
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Es. Accordo sancito sul segreto della gilda; fiducia consolidata..."
                                          value={rel.milestoneEvent || ''}
                                          disabled={!rel.applied}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setPlayerProposals((prev) =>
                                              prev.map((p) => {
                                                if (p.playerId !== pp.playerId) return p;
                                                return {
                                                  ...p,
                                                  interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r, idx) =>
                                                    idx === relIdx ? { ...r, milestoneEvent: val } : r
                                                  ),
                                                };
                                              })
                                            );
                                          }}
                                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                        />
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5 pt-0.5">
                                        <div>
                                          <span className="text-[10px] text-content-3 font-mono block">Legame:</span>
                                          <input
                                            type="text"
                                            value={rel.newRelationType || ''}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setPlayerProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.playerId !== pp.playerId) return p;
                                                  return {
                                                    ...p,
                                                    interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r, idx) =>
                                                      idx === relIdx ? { ...r, newRelationType: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-content-3 font-mono block">Note &amp; Segreti:</span>
                                          <input
                                            type="text"
                                            value={rel.notes || ''}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setPlayerProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.playerId !== pp.playerId) return p;
                                                  return {
                                                    ...p,
                                                    interPartyRelationUpdates: (p.interPartyRelationUpdates || []).map((r, idx) =>
                                                      idx === relIdx ? { ...r, notes: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 2: CODEX ENTITIES & NPCS */}
                {activeSyncTab === 'entities' && (
                  <div className="space-y-4">
                    {proposals.length === 0 ? (
                      <div className="p-6 text-center text-xs text-content-3 bg-surface-2/30 rounded-xl border border-surface-3">
                        Nessun PNG o entità del Codex rilevata per questa sessione.
                      </div>
                    ) : (
                      proposals.map((prop, propIdx) => (
                        <div
                          key={prop.entityId || propIdx}
                          className="p-4 rounded-xl bg-surface-1 border border-surface-3 space-y-3 hover:border-surface-3/80 transition-all shadow-xs"
                        >
                          {/* Entity Title */}
                          <div className="flex items-start justify-between gap-3 border-b border-surface-2/60 pb-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-content-1 truncate">
                                  {prop.entityName}
                                </h4>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3 uppercase">
                                  {prop.entityType}
                                </span>
                              </div>
                              <p className="text-xs text-content-3 italic leading-relaxed">
                                {prop.reason}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const isAnyActive =
                                  prop.applyCurrentStatus ||
                                  prop.applySessionToMemory ||
                                  prop.applyNewKnowledge ||
                                  prop.partyRelationUpdates.some((r) => r.applied) ||
                                  prop.entityRelationUpdates.some((r) => r.applied);
                                handleToggleEntityProposal(prop.entityId, !isAnyActive);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-mono text-content-3 hover:text-content-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer shrink-0"
                            >
                              Tutto per questo PNG
                            </button>
                          </div>

                          {/* Link Session to memory */}
                          <label className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-2/40 hover:bg-surface-2/70 transition-colors cursor-pointer border border-surface-3/60">
                            <input
                              type="checkbox"
                              checked={!!prop.applySessionToMemory}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setProposals((prev) =>
                                  prev.map((p) => (p.entityId === prop.entityId ? { ...p, applySessionToMemory: checked } : p))
                                );
                              }}
                              className="mt-0.5 rounded border-surface-3 text-primary focus:ring-primary"
                            />
                            <div className="text-xs space-y-0.5">
                              <span className="font-semibold text-content-1 flex items-center gap-1.5">
                                <BookOpen size={12} className="text-primary" />
                                <span>Collega Sessione {session?.number} alle memorie vissute di {prop.entityName}</span>
                              </span>
                              <p className="text-[11px] text-content-3 font-mono">
                                Aggiunge la sessione al suo Sotto-Codex per l&apos;Oracolo / Sendipietra.
                              </p>
                            </div>
                          </label>

                          {/* Current Status */}
                          {prop.suggestedCurrentStatus && (
                            <div className="space-y-1.5 p-2.5 rounded-lg bg-surface-2/40 border border-surface-3/60">
                              <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={!!prop.applyCurrentStatus}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setProposals((prev) =>
                                        prev.map((p) => (p.entityId === prop.entityId ? { ...p, applyCurrentStatus: checked } : p))
                                      );
                                    }}
                                    className="rounded border-surface-3 text-primary focus:ring-primary"
                                  />
                                  <Clock size={12} className="text-primary" />
                                  <span>Aggiorna Stato / Situazione Attuale nel Presente</span>
                                </span>
                              </label>

                              {prop.currentStatusBefore && (
                                <p className="text-[11px] text-content-3 font-mono line-through opacity-70 pl-5">
                                  Precedente: &ldquo;{prop.currentStatusBefore}&rdquo;
                                </p>
                              )}

                              <textarea
                                rows={2}
                                value={prop.suggestedCurrentStatus}
                                disabled={!prop.applyCurrentStatus}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProposals((prev) =>
                                    prev.map((p) =>
                                      p.entityId === prop.entityId ? { ...p, suggestedCurrentStatus: val } : p
                                    )
                                  );
                                }}
                                className={`w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none resize-none font-mono ${
                                  !prop.applyCurrentStatus ? 'opacity-40' : ''
                                }`}
                              />
                            </div>
                          )}

                          {/* Party Relations */}
                          {prop.partyRelationUpdates && prop.partyRelationUpdates.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-surface-3/60">
                              <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={12} />
                                <span>Relazioni con i Membri del Party:</span>
                              </span>

                              <div className="grid grid-cols-1 gap-2">
                                {prop.partyRelationUpdates.map((rel, relIdx) => {
                                  const attLabel = ATTITUDE_LABELS[rel.newAttitude || 'neutral'];
                                  return (
                                    <div
                                      key={rel.playerId || relIdx}
                                      className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                                        rel.applied ? 'bg-surface-2/70 border-surface-3' : 'bg-surface-1 border-surface-3/50 opacity-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <label className="flex items-center gap-2 font-bold text-content-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={!!rel.applied}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.entityId !== prop.entityId) return p;
                                                  return {
                                                    ...p,
                                                    partyRelationUpdates: p.partyRelationUpdates.map((r, idx) =>
                                                      idx === relIdx ? { ...r, applied: checked } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="rounded border-surface-3 text-primary focus:ring-primary"
                                          />
                                          <User size={13} className="text-primary" />
                                          <span>Verso: {rel.characterName}</span>
                                        </label>

                                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                          {rel.previousAttitude && rel.previousAttitude !== rel.newAttitude && (
                                            <span className="text-content-3 opacity-75">
                                              {ATTITUDE_LABELS[rel.previousAttitude] || rel.previousAttitude} ➔
                                            </span>
                                          )}
                                          <select
                                            value={rel.newAttitude || 'neutral'}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value as RelationAttitude;
                                              setProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.entityId !== prop.entityId) return p;
                                                  return {
                                                    ...p,
                                                    partyRelationUpdates: p.partyRelationUpdates.map((r, idx) =>
                                                      idx === relIdx ? { ...r, newAttitude: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="bg-surface-1 border border-surface-3 text-primary font-bold rounded px-1.5 py-0.5 text-[11px] outline-none cursor-pointer"
                                          >
                                            {Object.entries(ATTITUDE_LABELS).map(([k, lbl]) => (
                                              <option key={k} value={k}>
                                                {lbl}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      {/* Milestone Event Input */}
                                      <div className="pl-5 pt-0.5 space-y-1">
                                        <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 font-semibold">
                                          <Sparkles size={11} />
                                          <span>Svolta Narrativa / Pietra Miliare (Progressione):</span>
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Es. Forte delusione per il tomo proibito; fiducia revocata..."
                                          value={rel.milestoneEvent || ''}
                                          disabled={!rel.applied}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setProposals((prev) =>
                                              prev.map((p) => {
                                                if (p.entityId !== prop.entityId) return p;
                                                return {
                                                  ...p,
                                                  partyRelationUpdates: p.partyRelationUpdates.map((r, idx) =>
                                                    idx === relIdx ? { ...r, milestoneEvent: val } : r
                                                  ),
                                                };
                                              })
                                            );
                                          }}
                                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                        />
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5 pt-0.5">
                                        <div>
                                          <span className="text-[10px] text-content-3 font-mono block">Tipo Legame:</span>
                                          <input
                                            type="text"
                                            value={rel.newRelationType || ''}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.entityId !== prop.entityId) return p;
                                                  return {
                                                    ...p,
                                                    partyRelationUpdates: p.partyRelationUpdates.map((r, idx) =>
                                                      idx === relIdx ? { ...r, newRelationType: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-content-3 font-mono block">Note e Fatti Comuni:</span>
                                          <input
                                            type="text"
                                            value={rel.newNotes || ''}
                                            disabled={!rel.applied}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setProposals((prev) =>
                                                prev.map((p) => {
                                                  if (p.entityId !== prop.entityId) return p;
                                                  return {
                                                    ...p,
                                                    partyRelationUpdates: p.partyRelationUpdates.map((r, idx) =>
                                                      idx === relIdx ? { ...r, newNotes: val } : r
                                                    ),
                                                  };
                                                })
                                              );
                                            }}
                                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Codex Entity Relations */}
                          {prop.entityRelationUpdates && prop.entityRelationUpdates.length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-surface-3/60">
                              <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Shield size={12} />
                                <span>Relazioni con Altre Entità del Compendio:</span>
                              </span>

                              <div className="grid grid-cols-1 gap-2">
                                {prop.entityRelationUpdates.map((rel, relIdx) => (
                                  <div
                                    key={rel.targetEntityId || relIdx}
                                    className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                                      rel.applied ? 'bg-surface-2/70 border-surface-3' : 'bg-surface-1 border-surface-3/50 opacity-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <label className="flex items-center gap-2 font-bold text-content-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={!!rel.applied}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setProposals((prev) =>
                                              prev.map((p) => {
                                                if (p.entityId !== prop.entityId) return p;
                                                return {
                                                  ...p,
                                                  entityRelationUpdates: p.entityRelationUpdates.map((r, idx) =>
                                                    idx === relIdx ? { ...r, applied: checked } : r
                                                  ),
                                                };
                                              })
                                            );
                                          }}
                                          className="rounded border-surface-3 text-primary focus:ring-primary"
                                        />
                                        <span>Verso: {rel.targetEntityName} ({(rel.targetEntityType || 'codex').toUpperCase()})</span>
                                      </label>

                                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                        {rel.previousAttitude && rel.previousAttitude !== rel.newAttitude && (
                                          <span className="text-content-3 opacity-75">
                                            {ATTITUDE_LABELS[rel.previousAttitude] || rel.previousAttitude} ➔
                                          </span>
                                        )}
                                        <select
                                          value={rel.newAttitude || 'neutral'}
                                          disabled={!rel.applied}
                                          onChange={(e) => {
                                            const val = e.target.value as RelationAttitude;
                                            setProposals((prev) =>
                                              prev.map((p) => {
                                                if (p.entityId !== prop.entityId) return p;
                                                return {
                                                  ...p,
                                                  entityRelationUpdates: p.entityRelationUpdates.map((r, idx) =>
                                                    idx === relIdx ? { ...r, newAttitude: val } : r
                                                  ),
                                                };
                                              })
                                            );
                                          }}
                                          className="bg-surface-1 border border-surface-3 text-primary font-bold rounded px-1.5 py-0.5 text-[11px] outline-none cursor-pointer"
                                        >
                                          {Object.entries(ATTITUDE_LABELS).map(([k, lbl]) => (
                                            <option key={k} value={k}>
                                              {lbl}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {/* Entity Milestone Event Input */}
                                    <div className="pl-5 pt-0.5 space-y-1">
                                      <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 font-semibold">
                                        <Sparkles size={11} />
                                        <span>Svolta Narrativa / Patto (Pietra Miliare):</span>
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="Es. Patto di non aggressione stipulato; rivalità riaccesa..."
                                        value={rel.milestoneEvent || ''}
                                        disabled={!rel.applied}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setProposals((prev) =>
                                            prev.map((p) => {
                                              if (p.entityId !== prop.entityId) return p;
                                              return {
                                                ...p,
                                                entityRelationUpdates: p.entityRelationUpdates.map((r, idx) =>
                                                  idx === relIdx ? { ...r, milestoneEvent: val } : r
                                                ),
                                              };
                                            })
                                          );
                                        }}
                                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-md px-2 py-1 text-xs text-content-1 outline-none"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* New Knowledge */}
                          {prop.suggestedNewKnowledge && (
                            <div className="p-2.5 rounded-lg bg-surface-2/40 border border-surface-3/60 space-y-1.5">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!prop.applyNewKnowledge}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setProposals((prev) =>
                                      prev.map((p) => (p.entityId === prop.entityId ? { ...p, applyNewKnowledge: checked } : p))
                                    );
                                  }}
                                  className="rounded border-surface-3 text-primary focus:ring-primary"
                                />
                                <span className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                                  <Sparkles size={12} className="text-primary" />
                                  <span>Aggiungi nuova informazione appresa al Sotto-Codex:</span>
                                </span>
                              </label>
                              <textarea
                                rows={2}
                                value={prop.suggestedNewKnowledge}
                                disabled={!prop.applyNewKnowledge}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProposals((prev) =>
                                    prev.map((p) => (p.entityId === prop.entityId ? { ...p, suggestedNewKnowledge: val } : p))
                                  );
                                }}
                                className={`w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none resize-none font-mono ${
                                  !prop.applyNewKnowledge ? 'opacity-40' : ''
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-surface-2 bg-surface-2/40 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs font-mono text-content-3">
              {totalUpdatesCount > 0
                ? `${totalUpdatesCount} schede (${totalActivePlayersCount} PG, ${totalActiveEntitiesCount} PNG) pronte all'aggiornamento`
                : 'Nessuna modifica selezionata'}
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-medium text-content-2 hover:text-content-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer"
              >
                {playerProposals.length > 0 || proposals.length > 0 ? 'Annulla' : 'Chiudi'}
              </button>

              {!hasStartedAnalysis && playerProposals.length === 0 && proposals.length === 0 ? (
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-surface-0 hover:bg-primary-hover transition-colors shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <Play size={13} />
                  <span>Avvia Analisi</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoading || totalUpdatesCount === 0}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-surface-0 hover:bg-primary-hover transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Conferma e Salva nel Mondo</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Live Catalog Modal */}
      <LlmCatalogModal
        isOpen={isOpenRouterCatalogOpen}
        onClose={() => setIsOpenRouterCatalogOpen(false)}
        activeProvider={provider}
        onSelectProvider={(p) => setProvider(p)}
        currentModelId={provider === 'openrouter' ? openrouterModel : geminiModel}
        onSelectModel={(selectedId, selectedProvider) => {
          const targetProv = selectedProvider || provider;
          setProvider(targetProv);
          if (targetProv === 'openrouter') {
            handleOpenRouterModelChange(selectedId);
          } else {
            handleGeminiModelChange(selectedId);
          }
          setIsOpenRouterCatalogOpen(false);
        }}
      />
    </Portal>
  );
}
