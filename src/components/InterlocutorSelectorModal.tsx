import React, { useState, useMemo, useEffect } from 'react';
import { Portal } from './Portal';
import { Entity } from '../types';
import { AGENT_PERSONAS, AgentPersona } from '../lib/oracleService';
import { CampaignManager } from '../store/campaignStore';
import { LlmCatalogModal, LlmProviderType } from './OpenRouterCatalogModal';
import { ApiKeyManager } from '../lib/apiKeyManager';
import {
  Search,
  X,
  Bot,
  Ghost,
  GraduationCap,
  Beer,
  User,
  MapPin,
  Shield,
  Scroll,
  Check,
  Sparkles,
  Cpu,
  Zap,
  Lock,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface InterlocutorSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonaId: string;
  activeCodexEntity: Entity | null;
  onSelectPersona: (personaId: string) => void;
  onSelectCodexEntity: (entity: Entity) => void;
  selectedPgIds?: string[];
  selectedEntityIds?: string[];
  onSelectMultiSubject?: (pgIds: string[], entityIds: string[], chosenModel?: string, chosenProvider?: LlmProviderType) => void;
  currentProvider?: LlmProviderType;
  currentModelId?: string;
  onSelectModel?: (modelId: string, provider?: LlmProviderType) => void;
  onSelectProvider?: (provider: LlmProviderType) => void;
}

type FilterCategory = 'all' | 'personas' | 'npc' | 'monster' | 'place' | 'faction' | 'quest' | 'pg_dialogue';

export const InterlocutorSelectorModal: React.FC<InterlocutorSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedPersonaId,
  activeCodexEntity,
  onSelectPersona,
  onSelectCodexEntity,
  selectedPgIds = [],
  selectedEntityIds = [],
  onSelectMultiSubject,
  currentProvider = 'gemini',
  currentModelId = 'gemini-3.8-flash',
  onSelectModel,
  onSelectProvider,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [tempSelectedPgIds, setTempSelectedPgIds] = useState<string[]>([]);
  const [tempSelectedEntityIds, setTempSelectedEntityIds] = useState<string[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState<LlmProviderType>(currentProvider);
  const [modalModelId, setModalModelId] = useState<string>(currentModelId);

  // Synchronize selection when modal is opened
  useEffect(() => {
    if (isOpen) {
      setTempSelectedPgIds(selectedPgIds);
      setTempSelectedEntityIds(selectedEntityIds);
      if (currentProvider) setModalProvider(currentProvider);
      if (currentModelId) setModalModelId(currentModelId);
    }
  }, [isOpen, selectedPgIds, selectedEntityIds, currentProvider, currentModelId]);

  const keysConfig = ApiKeyManager.getKeys();
  const campKeys = ApiKeyManager.getCampaignKeys();
  const persKeys = ApiKeyManager.getPersonalKeys();

  const hasGeminiKey = Boolean(keysConfig.geminiKey || campKeys.geminiKey || persKeys.geminiKey || true);
  const hasOpenRouterKey = Boolean(keysConfig.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey);

  const isCurrentProviderKeyMissing =
    (modalProvider === 'openrouter' && !hasOpenRouterKey);

  const allEntities = useMemo(() => {
    return CampaignManager.getEntities().filter((e) => e.aiConfig?.enabled !== false);
  }, [isOpen]);

  const availablePlayers = useMemo(() => {
    return CampaignManager.getPlayers().filter((p) => !p.isDm);
  }, [isOpen]);

  const npcs = useMemo(() => allEntities.filter((e) => e.type === 'npc'), [allEntities]);
  const monsters = useMemo(() => allEntities.filter((e) => e.type === 'monster'), [allEntities]);
  const places = useMemo(() => allEntities.filter((e) => e.type === 'place'), [allEntities]);
  const factions = useMemo(() => allEntities.filter((e) => e.type === 'faction'), [allEntities]);
  const quests = useMemo(() => allEntities.filter((e) => e.type === 'quest'), [allEntities]);

  const filteredPersonas = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'personas') return [];
    if (!searchQuery.trim()) return AGENT_PERSONAS;
    const q = searchQuery.toLowerCase();
    return AGENT_PERSONAS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.roleTitle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [searchQuery, selectedCategory]);

  const filteredEntities = useMemo(() => {
    if (selectedCategory === 'personas' || selectedCategory === 'pg_dialogue') return [];
    let list = allEntities;
    if (selectedCategory !== 'all') {
      list = list.filter((e) => e.type === selectedCategory);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((e) => {
      const nameMatch = e.name.toLowerCase().includes(q);
      const aliasMatch = e.aliases?.some((a) => a.toLowerCase().includes(q));
      const locMatch = e.location?.toLowerCase().includes(q);
      const styleMatch = e.aiConfig?.speechStyle?.toLowerCase().includes(q);
      const scopeMatch = e.aiConfig?.knowledgeScope?.toLowerCase().includes(q);
      return nameMatch || aliasMatch || locMatch || styleMatch || scopeMatch;
    });
  }, [allEntities, searchQuery, selectedCategory]);

  const searchedPlayers = useMemo(() => {
    if (!searchQuery.trim()) return availablePlayers;
    const q = searchQuery.toLowerCase();
    return availablePlayers.filter((p) => p.characterName?.toLowerCase().includes(q));
  }, [availablePlayers, searchQuery]);

  const searchedEntitiesForGroup = useMemo(() => {
    if (!searchQuery.trim()) return allEntities;
    const q = searchQuery.toLowerCase();
    return allEntities.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.aliases?.some((a) => a.toLowerCase().includes(q))
    );
  }, [allEntities, searchQuery]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
          {/* Header */}
          <div className="px-5 py-4 border-b border-surface-2 flex items-center justify-between gap-3 shrink-0 bg-surface-1/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <Bot size={17} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-cinzel font-bold text-content-1 truncate">
                  Seleziona Interlocutore Sendipietra
                </h2>
                <p className="text-[11px] text-content-3 truncate">
                  Scegli con quale guida o entità del compendio dialogare
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-surface-3 hover:bg-surface-2 text-content-3 hover:text-content-1 transition-colors cursor-pointer shrink-0"
              title="Chiudi (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Bar & Category Filters */}
          <div className="p-4 border-b border-surface-2 bg-surface-0 space-y-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per nome, ruolo, fazione, luogo, stile o alias..."
                className="w-full bg-surface-1 border border-surface-3 rounded-xl pl-9 pr-8 py-2 text-xs text-content-1 placeholder:text-content-3/70 outline-none focus:border-primary font-mono transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-white border-primary font-bold shadow-xs'
                    : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                }`}
              >
                Tutti ({AGENT_PERSONAS.length + allEntities.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('personas')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                  selectedCategory === 'personas'
                    ? 'bg-primary text-white border-primary font-bold shadow-xs'
                    : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                }`}
              >
                <Sparkles size={12} />
                <span>Guide Sendipietra ({AGENT_PERSONAS.length})</span>
              </button>
              {npcs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('npc')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                    selectedCategory === 'npc'
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <User size={12} />
                  <span>PNG ({npcs.length})</span>
                </button>
              )}
              {monsters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('monster')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                    selectedCategory === 'monster'
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <Ghost size={12} />
                  <span>Mostri ({monsters.length})</span>
                </button>
              )}
              {places.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('place')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                    selectedCategory === 'place'
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <MapPin size={12} />
                  <span>Luoghi ({places.length})</span>
                </button>
              )}
              {factions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('faction')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                    selectedCategory === 'faction'
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <Shield size={12} />
                  <span>Fazioni ({factions.length})</span>
                </button>
              )}
              {quests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('quest')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                    selectedCategory === 'quest'
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <Scroll size={12} />
                  <span>Quest ({quests.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCategory('pg_dialogue')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1 ${
                  selectedCategory === 'pg_dialogue'
                    ? 'bg-primary text-white border-primary font-bold shadow-xs'
                    : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                }`}
              >
                <Sparkles size={12} className="text-amber-400" />
                <span>Dialogo di Gruppo</span>
              </button>
            </div>
          </div>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Group Dialogue Section */}
            {selectedCategory === 'pg_dialogue' && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-primary font-cinzel flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400 animate-pulse" />
                    <span>Configura Dialogo di Gruppo</span>
                  </h3>
                  <p className="text-[11px] text-content-2 leading-relaxed">
                    Seleziona <strong>da 2 a 3 soggetti totali</strong> (un mix di Personaggi Giocanti e qualsiasi entità del Codex, come PNG, Luoghi o Fazioni). L'IA simulerà una discussione teatrale e interattiva tra di loro, interpretando le loro schede, allineamenti, stili e personalità.
                  </p>
                </div>

                {/* Personaggi Giocanti Section */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold text-content-3 uppercase tracking-wider block px-1">
                    Personaggi Giocanti (PG)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchedPlayers.map((p) => {
                      const isChecked = tempSelectedPgIds.includes(p._id);
                      const currentTotal = tempSelectedPgIds.length + tempSelectedEntityIds.length;
                      const isMaxReached = currentTotal >= 3 && !isChecked;

                      return (
                        <button
                          key={p._id}
                          type="button"
                          disabled={isMaxReached}
                          onClick={() => {
                            setTempSelectedPgIds((prev) => {
                              if (prev.includes(p._id)) {
                                return prev.filter((id) => id !== p._id);
                              }
                              if (currentTotal >= 3) return prev;
                              return [...prev, p._id];
                            });
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 group ${
                            isChecked
                              ? 'bg-primary/15 border-primary shadow-xs ring-1 ring-primary/40'
                              : isMaxReached
                              ? 'bg-surface-0 border-surface-2 opacity-30 cursor-not-allowed'
                              : 'bg-surface-0 hover:bg-surface-2 border-surface-3 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isMaxReached}
                              readOnly
                              className="rounded border-surface-3 text-primary focus:ring-primary shrink-0 cursor-pointer pointer-events-none"
                            />
                            {p.avatarUrl && p.avatarUrl.trim() ? (
                              <img
                                src={p.avatarUrl}
                                alt={p.characterName}
                                className="w-8 h-8 rounded-lg object-cover bg-surface-2 shrink-0 border border-surface-3"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-surface-2 text-content-3 flex items-center justify-center shrink-0 border border-surface-3">
                                <User size={15} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-content-1 block truncate">
                                {p.characterName}
                              </span>
                              <span className="text-[10px] font-mono text-content-3 block truncate">
                                {p.email || 'PG di Campagna'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {searchedPlayers.length === 0 && (
                      <p className="text-xs font-mono text-content-3 px-1">Nessun PG trovato.</p>
                    )}
                  </div>
                </div>

                {/* Entità del Codex Section */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-mono font-bold text-content-3 uppercase tracking-wider block px-1">
                    Entità del Compendio (Codex / PNG / Luoghi / Fazioni / Mostri)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
                    {searchedEntitiesForGroup.map((e) => {
                      const isChecked = tempSelectedEntityIds.includes(e._id);
                      const currentTotal = tempSelectedPgIds.length + tempSelectedEntityIds.length;
                      const isMaxReached = currentTotal >= 3 && !isChecked;

                      let IconComp = User;
                      if (e.type === 'monster') IconComp = Ghost;
                      else if (e.type === 'place') IconComp = MapPin;
                      else if (e.type === 'faction') IconComp = Shield;
                      else if (e.type === 'quest') IconComp = Scroll;

                      return (
                        <button
                          key={e._id}
                          type="button"
                          disabled={isMaxReached}
                          onClick={() => {
                            setTempSelectedEntityIds((prev) => {
                              if (prev.includes(e._id)) {
                                return prev.filter((id) => id !== e._id);
                              }
                              if (currentTotal >= 3) return prev;
                              return [...prev, e._id];
                            });
                          }}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 group ${
                            isChecked
                              ? 'bg-primary/15 border-primary shadow-xs ring-1 ring-primary/40'
                              : isMaxReached
                              ? 'bg-surface-0 border-surface-2 opacity-30 cursor-not-allowed'
                              : 'bg-surface-0 hover:bg-surface-2 border-surface-3 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isMaxReached}
                              readOnly
                              className="rounded border-surface-3 text-primary focus:ring-primary shrink-0 cursor-pointer pointer-events-none"
                            />
                            <div className="w-8 h-8 rounded-lg bg-surface-2 text-content-3 flex items-center justify-center shrink-0 border border-surface-3 group-hover:text-primary transition-colors">
                              <IconComp size={15} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-content-1 block truncate">
                                {e.name}
                              </span>
                              <span className="text-[10px] font-mono text-content-3 block truncate uppercase">
                                {e.type} {e.status ? `• ${e.status}` : ''}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {searchedEntitiesForGroup.length === 0 && (
                      <p className="text-xs font-mono text-content-3 px-1">Nessuna entità del Codex trovata.</p>
                    )}
                  </div>
                </div>

                {/* LLM Model & Provider Selector for Group Dialogue */}
                <div className="p-3 rounded-xl bg-surface-0 border border-surface-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bot size={13} className="text-primary shrink-0" />
                      <span className="text-[11px] font-mono font-bold text-content-2 uppercase tracking-wider">
                        Modello &amp; Provider AI del Dialogo:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCatalogModalOpen(true)}
                      className="text-[11px] text-primary hover:underline font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <span>Sfoglia catalogo</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCatalogModalOpen(true)}
                      className="flex-1 flex items-center justify-between p-2.5 rounded-lg bg-surface-1 hover:bg-surface-2 border border-surface-3 hover:border-primary/40 text-xs font-mono transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {modalProvider === 'openrouter' ? (
                          <Zap size={14} className="text-indigo-400 shrink-0" />
                        ) : (
                          <Sparkles size={14} className="text-primary shrink-0" />
                        )}
                        <span className="font-bold text-content-1 truncate">{modalModelId}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-2 text-content-3 border border-surface-3">
                          {modalProvider}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-content-3">
                        <span>Cambia</span>
                        <ChevronDown size={12} />
                      </div>
                    </button>
                  </div>

                  {isCurrentProviderKeyMissing && (
                    <div className="text-[11px] text-red-400 flex items-center gap-1.5 font-mono bg-red-500/10 border border-red-500/25 p-2 rounded-lg">
                      <Lock size={12} className="shrink-0" />
                      <span>Chiave API per {modalProvider.toUpperCase()} non configurata. Inseriscila nelle Impostazioni prima di avviare.</span>
                    </div>
                  )}
                </div>

                <div className="pt-3.5 flex flex-col xs:flex-row items-center justify-between gap-3 border-t border-surface-2">
                  <span className="text-[11px] font-mono text-content-3">
                    {(tempSelectedPgIds.length + tempSelectedEntityIds.length) < 2 ? (
                      <span className="text-amber-400">⚠️ Seleziona almeno 2 soggetti totali</span>
                    ) : (tempSelectedPgIds.length + tempSelectedEntityIds.length) > 3 ? (
                      <span className="text-amber-400">⚠️ Seleziona massimo 3 soggetti totali</span>
                    ) : isCurrentProviderKeyMissing ? (
                      <span className="text-red-400 font-semibold">⚠️ Chiave API {modalProvider.toUpperCase()} mancante</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">✓ Configurazione valida ({tempSelectedPgIds.length + tempSelectedEntityIds.length} soggetti con {modalModelId})</span>
                    )}
                  </span>

                  <button
                    type="button"
                    disabled={
                      (tempSelectedPgIds.length + tempSelectedEntityIds.length) < 2 ||
                      (tempSelectedPgIds.length + tempSelectedEntityIds.length) > 3 ||
                      isCurrentProviderKeyMissing
                    }
                    onClick={() => {
                      if (onSelectMultiSubject) {
                        onSelectMultiSubject(tempSelectedPgIds, tempSelectedEntityIds, modalModelId, modalProvider);
                      }
                      onClose();
                    }}
                    className="w-full xs:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-surface-3 text-white disabled:text-content-3 font-cinzel font-bold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Invia e Avvia Dialogo
                  </button>
                </div>
              </div>
            )}

            {/* Personas Section */}
            {filteredPersonas.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-content-3 uppercase tracking-wider block px-1">
                  Guide Sendipietra &amp; Archivisti
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredPersonas.map((p) => {
                    const isSelected = !activeCodexEntity && selectedPersonaId === p.id;
                    let IconComp = Ghost;
                    if (p.id === 'rosier') IconComp = GraduationCap;
                    else if (p.id === 'fenomeno') IconComp = Beer;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelectPersona(p.id);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'bg-primary/15 border-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-surface-0 hover:bg-surface-2 border-surface-3'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-surface-2 text-content-2 group-hover:text-primary'}`}>
                              <IconComp size={15} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-content-1 block truncate">
                                {p.name}
                              </span>
                              <span className="text-[10px] font-mono text-content-3 block truncate">
                                {p.roleTitle}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-primary text-white text-[9px] font-mono font-bold flex items-center gap-0.5">
                              <Check size={10} /> Attivo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-content-3 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Codex Entities Section */}
            {filteredEntities.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-content-3 uppercase tracking-wider block px-1">
                  Entità del Compendio ({filteredEntities.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredEntities.map((ent) => {
                    const isSelected = activeCodexEntity?._id === ent._id;
                    let IconComp = User;
                    if (ent.type === 'monster') IconComp = Ghost;
                    else if (ent.type === 'place') IconComp = MapPin;
                    else if (ent.type === 'faction') IconComp = Shield;
                    else if (ent.type === 'quest') IconComp = Scroll;

                    const descSnippet =
                      ent.aiConfig?.knowledgeScope ||
                      ent.aiConfig?.currentStatus ||
                      ent.progressNote ||
                      (ent.location ? `Luogo: ${ent.location}` : 'Entità del Compendio');

                    return (
                      <button
                        key={ent._id}
                        type="button"
                        onClick={() => {
                          onSelectCodexEntity(ent);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'bg-primary/15 border-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-surface-0 hover:bg-surface-2 border-surface-3'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-surface-2 text-content-2 group-hover:text-primary'}`}>
                              <IconComp size={15} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-content-1 block truncate">
                                {ent.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[9px] font-mono text-content-3">
                                <span className="uppercase">{ent.type}</span>
                                {ent.status && <span>• {ent.status}</span>}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-primary text-white text-[9px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                              <Check size={10} /> Attivo
                            </span>
                          )}
                        </div>

                        {ent.location && (
                          <div className="text-[10px] font-mono text-content-2 mb-1 flex items-center gap-1 truncate">
                            <MapPin size={10} className="text-primary shrink-0" />
                            <span className="truncate">{ent.location}</span>
                          </div>
                        )}

                        <p className="text-[11px] text-content-3 line-clamp-2 leading-relaxed">
                          {descSnippet}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredPersonas.length === 0 && filteredEntities.length === 0 && (
              <div className="py-12 text-center text-content-3 space-y-2">
                <Search size={28} className="mx-auto opacity-30" />
                <p className="text-xs font-mono">Nessun interlocutore trovato per &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Live LLM Catalog Modal */}
      <LlmCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        activeProvider={modalProvider}
        onSelectProvider={(p) => {
          setModalProvider(p);
          if (onSelectProvider) onSelectProvider(p);
        }}
        currentModelId={modalModelId}
        onSelectModel={(id, p) => {
          const targetProv = p || modalProvider;
          setModalProvider(targetProv);
          setModalModelId(id);
          if (onSelectProvider) onSelectProvider(targetProv);
          if (onSelectModel) onSelectModel(id, targetProv);
          setIsCatalogModalOpen(false);
        }}
        isDm={CampaignManager.isCurrentUserDm()}
      />
    </Portal>
  );
};
