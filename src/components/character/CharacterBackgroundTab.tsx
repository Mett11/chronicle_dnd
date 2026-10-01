import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Edit3,
  Save,
  X,
  Calendar,
  Sparkles,
  MapPin,
  Shield,
  Heart,
  Skull,
  Eye,
  Lock,
  Plus,
  Trash2,
  HelpCircle,
  FileText,
  User,
  Compass,
  CheckCircle2,
  Layers,
  Lightbulb,
  HeartHandshake,
  Clock,
  Star,
  ChevronDown,
  Globe,
  ExternalLink,
  Tag,
  Target,
  Users,
  Award,
  Scroll,
  Check,
} from 'lucide-react';
import {
  CharacterBio,
  CharacterSectionPrivacy,
  Player,
  CampaignCalendar,
  TimelineMemoryEntry,
  EvolvingBelief,
  InterPartyRelation,
  RelationAttitude,
  WorldLoreArticle,
  CharacterKnownLoreItem,
  LoreBiteLevel,
  Entity,
} from '../../types';
import { CampaignManager } from '../../store/campaignStore';
import { LoreDatePicker } from '../LoreDatePicker';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { formatLoreDate } from '../../lib/loreDateUtils';

interface CharacterBackgroundTabProps {
  player: Player;
  onBioUpdated?: (bio: CharacterBio) => void;
  isOtherPlayerView?: boolean;
  activeSectionMode?: 'all' | 'bio' | 'mind' | 'party';
  quests?: Entity[];
  onOpenCreateQuest?: () => void;
  onEditQuest?: (quest: Entity) => void;
  onToggleQuestStatus?: (quest: Entity, newStatus: Entity['status']) => void;
  onRequestDeleteQuest?: (questId: string) => void;
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
  belief_shift: { label: 'Cambio Teoria', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  relationship: { label: 'Svolta Relazione', cls: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
  milestone: { label: 'Traguardo Raggiunto', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  trauma: { label: 'Ferita & Trauma', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  secret: { label: 'Patto o Segreto', cls: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  event: { label: 'Avvenimento Chiave', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
};

export function CharacterBackgroundTab({
  player,
  onBioUpdated,
  isOtherPlayerView = false,
  activeSectionMode = 'all',
  quests = [],
  onOpenCreateQuest,
  onEditQuest,
  onToggleQuestStatus,
  onRequestDeleteQuest,
}: CharacterBackgroundTabProps) {
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => CampaignManager.getPlayers());

  const [beliefFilter, setBeliefFilter] = useState<'all' | EvolvingBelief['status']>('all');
  const [mindFilter, setMindFilter] = useState<'all' | 'beliefs' | 'memories' | 'open_quests' | 'completed_quests'>('all');
  const [isBackstoryExpanded, setIsBackstoryExpanded] = useState(false);
  const [expandedRelationPlayerId, setExpandedRelationPlayerId] = useState<string | null>(null);

  const [bio, setBio] = useState<CharacterBio>(() => {
    return (
      CampaignManager.getCharacterBio(player._id) || {
        playerId: player._id,
        characterTitle: '',
        characterClass: '',
        characterRace: '',
        characterAlignment: 'Neutrale Buono',
        deityOrPatron: '',
        hometown: '',
        birthDateFormatted: '',
        backstoryMarkdown: '',
        personalityTraits: [],
        ideals: '',
        bonds: '',
        flaws: '',
        secrets: '',
        appearanceDescription: '',
        timelineMemories: [],
        evolvingBeliefs: [],
        interPartyRelations: {},
      }
    );
  });

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterBio>(bio);
  const [newTraitInput, setNewTraitInput] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync calendar and players updates
  useEffect(() => {
    const handleCalUpdate = () => {
      setCalendar(CampaignManager.getCalendar());
      setAllPlayers(CampaignManager.getPlayers());
    };
    window.addEventListener('chronicle_calendar_updated', handleCalUpdate);
    window.addEventListener('chronicle_data_updated', handleCalUpdate);
    window.addEventListener('chronicle_players_updated', handleCalUpdate);
    return () => {
      window.removeEventListener('chronicle_calendar_updated', handleCalUpdate);
      window.removeEventListener('chronicle_data_updated', handleCalUpdate);
      window.removeEventListener('chronicle_players_updated', handleCalUpdate);
    };
  }, []);

  useEffect(() => {
    const loaded = CampaignManager.getCharacterBio(player._id);
    const resolvedBio: CharacterBio = loaded || {
      playerId: player._id,
      characterTitle: '',
      characterClass: '',
      characterRace: '',
      characterAlignment: 'Neutrale Buono',
      deityOrPatron: '',
      hometown: '',
      birthDateFormatted: '',
      backstoryMarkdown: '',
      personalityTraits: [],
      ideals: '',
      bonds: '',
      flaws: '',
      secrets: '',
      appearanceDescription: '',
      timelineMemories: [],
      evolvingBeliefs: [],
      interPartyRelations: {},
    };
    setBio(resolvedBio);
    setDraft(resolvedBio);
    setIsEditing(false);
  }, [player._id]);

  const handleStartEdit = () => {
    setDraft({ ...bio });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft({ ...bio });
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    const toSave: CharacterBio = {
      ...draft,
      playerId: player._id,
      updatedAt: new Date().toISOString(),
    };
    try {
      const res = await CampaignManager.saveCharacterBio(toSave);
      if (res.success) {
        setBio(toSave);
        setIsEditing(false);
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 3000);
        if (onBioUpdated) onBioUpdated(toSave);
      } else {
        setSaveError(res.error || 'Errore durante il salvataggio sul cloud.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Errore di connessione con il cloud.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTrait = () => {
    if (!newTraitInput.trim()) return;
    const current = draft.personalityTraits || [];
    if (!current.includes(newTraitInput.trim())) {
      setDraft({
        ...draft,
        personalityTraits: [...current, newTraitInput.trim()],
      });
    }
    setNewTraitInput('');
  };

  const handleRemoveTrait = (idx: number) => {
    const current = draft.personalityTraits || [];
    setDraft({
      ...draft,
      personalityTraits: current.filter((_, i) => i !== idx),
    });
  };

  // Timeline Memory Handlers
  const handleAddTimelineMemory = () => {
    const curMonth = calendar.months[calendar.currentMonthIndex]?.name || '';
    const curLoreDate = formatLoreDate(calendar.currentDay, undefined, curMonth, calendar.currentYear, calendar.yearSuffix);
    const newEntry: TimelineMemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: 'discovery',
      title: 'Nuova svolta o scoperta',
      summary: '',
      impact: 'normal',
      loreDate: curLoreDate || '',
    };
    setDraft((prev) => ({
      ...prev,
      timelineMemories: [...(prev.timelineMemories || []), newEntry],
    }));
  };

  const handleRemoveTimelineMemory = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      timelineMemories: (prev.timelineMemories || []).filter((m) => m.id !== id),
    }));
  };

  // Evolving Belief Handlers
  const handleAddBelief = () => {
    const curMonth = calendar.months[calendar.currentMonthIndex]?.name || '';
    const curLoreDate = formatLoreDate(calendar.currentDay, undefined, curMonth, calendar.currentYear, calendar.yearSuffix);
    const newBelief: EvolvingBelief = {
      id: `bel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: 'Nuovo mistero / Fazione / PNG',
      previousBelief: '',
      currentTruth: '',
      status: 'active_theory',
      revealedLoreDate: curLoreDate || '',
    };
    setDraft((prev) => ({
      ...prev,
      evolvingBeliefs: [...(prev.evolvingBeliefs || []), newBelief],
    }));
  };

  const handleRemoveBelief = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      evolvingBeliefs: (prev.evolvingBeliefs || []).filter((b) => b.id !== id),
    }));
  };

  // Inter-Party Relation Handlers
  const handleUpdateInterPartyRelation = (
    targetPlayerId: string,
    targetCharacterName: string,
    updates: Partial<InterPartyRelation>
  ) => {
    setDraft((prev) => {
      const current = { ...(prev.interPartyRelations || {}) };
      const existing = current[targetPlayerId] || {
        targetPlayerId,
        targetCharacterName,
        attitude: 'neutral',
        trustLevel: 5,
      };
      current[targetPlayerId] = {
        ...existing,
        ...updates,
        targetCharacterName,
      };
      return {
        ...prev,
        interPartyRelations: current,
      };
    });
  };

  // Privacy settings helpers
  const defaultPrivacy: CharacterSectionPrivacy = {
    identity: true,
    backstory: true,
    traits: true,
    bondsFlaws: true,
    secrets: false,
    appearance: true,
    familyTree: true,
    personalNotes: false,
    quests: true,
    memories: true,
    timelineMemories: true,
    evolvingBeliefs: true,
    interPartyRelations: true,
    worldLore: true,
  };

  const currentPrivacy: CharacterSectionPrivacy = {
    ...defaultPrivacy,
    ...(bio.privacySettings || {}),
  };

  const handleTogglePrivacy = (section: keyof CharacterSectionPrivacy) => {
    const updatedPrivacy: CharacterSectionPrivacy = {
      ...currentPrivacy,
      [section]: !currentPrivacy[section],
    };
    const updatedBio: CharacterBio = {
      ...bio,
      privacySettings: updatedPrivacy,
      updatedAt: new Date().toISOString(),
    };
    CampaignManager.saveCharacterBio(updatedBio);
    setBio(updatedBio);
    setDraft((prev) => ({ ...prev, privacySettings: updatedPrivacy }));
    if (onBioUpdated) onBioUpdated(updatedBio);
  };

  const renderPrivacyToggle = (section: keyof CharacterSectionPrivacy, label = 'Party') => {
    if (isOtherPlayerView) return null;
    const isVisible = currentPrivacy[section] !== false;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleTogglePrivacy(section);
        }}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
          isVisible
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
        }`}
        title={
          isVisible
            ? `Sezione "${label}" visibile al party. Clicca per renderla privata.`
            : `Sezione "${label}" nascosta al party (privata). Clicca per condividerla.`
        }
      >
        {isVisible ? <Eye size={12} /> : <Lock size={12} />}
        <span>{isVisible ? 'Visibile al Party' : 'Solo per Me'}</span>
      </button>
    );
  };

  // Teammates in party excluding this player
  const partyCompanions = allPlayers.filter((p) => p._id !== player._id);

  const showBioSections = activeSectionMode === 'all' || activeSectionMode === 'bio';
  const showMindSections = activeSectionMode === 'all' || activeSectionMode === 'mind';
  const showPartySections = activeSectionMode === 'all' || activeSectionMode === 'party';

  return (
    <div className="space-y-6 font-body relative">
      {isSaving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex flex-col items-center justify-center gap-4 animate-fadeIn">
          <div className="w-16 h-16 border-4 border-t-primary border-r-primary border-b-surface-3 border-l-surface-3 rounded-full animate-spin"></div>
          <div className="text-center space-y-1">
            <h3 className="font-heading font-bold text-lg text-content-1">Sincronizzazione in Corso</h3>
            <p className="text-sm text-content-3">Salvataggio atomico e persistente sul Cloud...</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between gap-3 text-red-200 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Errore di Sincronizzazione:</span> {saveError}
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-400 hover:text-red-300 font-bold px-2 py-1"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Top Header & Edit Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <BookOpen size={18} />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-content-1 flex items-center gap-2">
              <span>
                {activeSectionMode === 'bio' && 'Anagrafica & Background'}
                {activeSectionMode === 'mind' && 'Mente, Credenze & Memorie'}
                {activeSectionMode === 'party' && 'Legami & Relazioni col Party'}
                {activeSectionMode === 'all' && 'Biografia, Lore & Memoria Storica'}
              </span>
              {saveSuccessNotice && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 font-semibold animate-fadeIn">
                  <CheckCircle2 size={13} /> Salvato!
                </span>
              )}
            </h2>
            <p className="text-xs text-content-3">
              {activeSectionMode === 'bio' && 'Identità, storia personale, tratti psicologici, segreti e aspetto visivo.'}
              {activeSectionMode === 'mind' && 'Cronologia dei ricordi, teorie in evoluzione e bagaglio di conoscenze.'}
              {activeSectionMode === 'party' && 'Griglia dei compagni d\'avventura, livello di fiducia e note riservate.'}
              {activeSectionMode === 'all' && 'Tratti, memorie di Lore, teorie di campagna ed evoluzione dei rapporti col gruppo.'}
            </p>
          </div>
        </div>

        {!isOtherPlayerView && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs font-medium border border-surface-3 transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} /> Salva Modifiche
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 size={14} className="text-primary" /> Modifica Sezione
              </button>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. IDENTITY & ORIGINS SUMMARY GRID (BIO MODE)             */}
      {/* ======================================================== */}
      {showBioSections && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
            <h3 className="font-heading text-sm font-bold text-content-1 flex items-center gap-2">
              <User size={16} className="text-primary" />
              <span>Identità, Origini &amp; Retaggio</span>
            </h3>
            {renderPrivacyToggle('identity', 'Identità')}
          </div>

          {(!isOtherPlayerView || currentPrivacy.identity !== false) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {/* Titolo / Epiteto */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block">
                  Titolo / Epiteto
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.characterTitle || ''}
                    onChange={(e) => setDraft({ ...draft, characterTitle: e.target.value })}
                    placeholder="es. Il Flagello del Nord, L'Iniziato..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.characterTitle || <span className="text-content-3 italic">Nessun titolo</span>}
                  </p>
                )}
              </div>

              {/* Razza & Retaggio */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block">
                  Razza &amp; Retaggio
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.characterRace || ''}
                    onChange={(e) => setDraft({ ...draft, characterRace: e.target.value })}
                    placeholder="es. Elfo dei Boschi, Nano delle Colline..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.characterRace || <span className="text-content-3 italic">Non specificata</span>}
                  </p>
                )}
              </div>

              {/* Classe & Sottoclasse */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block">
                  Classe &amp; Specializzazione
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.characterClass || ''}
                    onChange={(e) => setDraft({ ...draft, characterClass: e.target.value })}
                    placeholder="es. Mago (Evocazione), Chierico..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.characterClass || <span className="text-content-3 italic">Non specificata</span>}
                  </p>
                )}
              </div>

              {/* Allineamento */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block">
                  Allineamento Morale
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.characterAlignment || ''}
                    onChange={(e) => setDraft({ ...draft, characterAlignment: e.target.value })}
                    placeholder="es. Caotico Buono, Legale Neutrale..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.characterAlignment || <span className="text-content-3 italic">Neutrale</span>}
                  </p>
                )}
              </div>

              {/* Divinità / Patrono */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block">
                  Divinità o Patrono
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.deityOrPatron || ''}
                    onChange={(e) => setDraft({ ...draft, deityOrPatron: e.target.value })}
                    placeholder="es. Mystra, Kelemvor, Grande Antico..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.deityOrPatron || <span className="text-content-3 italic">Nessun culto primario</span>}
                  </p>
                )}
              </div>

              {/* Luogo di Origine */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider block flex items-center gap-1">
                  <MapPin size={11} className="text-emerald-400" /> Luogo di Origine
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.hometown || ''}
                    onChange={(e) => setDraft({ ...draft, hometown: e.target.value })}
                    placeholder="es. Waterdeep, Baldur's Gate, Bosco di Smeraldo..."
                    className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3 py-1.5 text-xs text-content-1 outline-none"
                  />
                ) : (
                  <p className="font-semibold text-content-1 bg-surface-2/30 px-3 py-1.5 rounded-xl border border-surface-3 truncate">
                    {bio.hometown || <span className="text-content-3 italic">Sconosciuto</span>}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. BIOGRAFIA & BACKSTORY MARKDOWN (BIO MODE)             */}
      {/* ======================================================== */}
      {showBioSections && (!isOtherPlayerView || currentPrivacy.backstory !== false) && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
            <h3 className="font-heading text-sm font-bold text-content-1 flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              <span>Storia Personale &amp; Backstory</span>
            </h3>
            {renderPrivacyToggle('backstory', 'Storia')}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                rows={8}
                value={draft.backstoryMarkdown || ''}
                onChange={(e) => setDraft({ ...draft, backstoryMarkdown: e.target.value })}
                placeholder="Scrivi qui la storia passata, gli eventi formanti, gli amori perduti, i maestri e le ambizioni del personaggio..."
                className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl p-3.5 text-xs text-content-1 outline-none font-mono leading-relaxed"
              />
            </div>
          ) : bio.backstoryMarkdown ? (
            <div className="space-y-2">
              <div
                className={`prose prose-invert prose-sm max-w-none text-content-2 leading-relaxed bg-surface-2/30 p-4 rounded-xl border border-surface-3 transition-all ${
                  !isBackstoryExpanded && bio.backstoryMarkdown.length > 500
                    ? 'max-h-48 overflow-hidden relative'
                    : ''
                }`}
              >
                <MarkdownRenderer content={bio.backstoryMarkdown} />
                {!isBackstoryExpanded && bio.backstoryMarkdown.length > 500 && (
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-1 via-surface-1/80 to-transparent pointer-events-none" />
                )}
              </div>
              {bio.backstoryMarkdown.length > 500 && (
                <button
                  type="button"
                  onClick={() => setIsBackstoryExpanded(!isBackstoryExpanded)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 mx-auto cursor-pointer pt-1"
                >
                  <ChevronDown size={14} className={isBackstoryExpanded ? 'rotate-180 transition-transform' : ''} />
                  <span>{isBackstoryExpanded ? 'Comprimi Storia' : 'Espandi Storia Completa'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3">
              Nessun backstory scritto per questo personaggio.
            </div>
          )}
        </div>
      )}

      {/* 3. Cronologia Memorie di Lore & Svolte Personali */}
      {showMindSections && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-indigo-400" />
            <h3 className="font-heading text-sm font-bold text-content-1">
              Cronologia Memorie di Lore &amp; Svolte Personali
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {(isEditing ? draft.timelineMemories : bio.timelineMemories)?.length || 0}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {renderPrivacyToggle('timelineMemories', 'Timeline Memorie')}
            {isEditing && (
              <button
                type="button"
                onClick={handleAddTimelineMemory}
                className="px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} /> Aggiungi Ricordo
              </button>
            )}
          </div>
        </div>

        {/* Timeline Memories list */}
        {isOtherPlayerView && currentPrivacy.timelineMemories === false ? (
          <div className="bg-surface-2/30 border border-surface-3 rounded-xl p-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
              <Lock size={18} />
            </div>
            <p className="text-xs font-semibold text-content-2">Cronologia Memorie Riservata</p>
            <p className="text-[11px] text-content-3 max-w-sm mx-auto leading-relaxed">
              {player.characterName || 'Il personaggio'} ha scelto di non condividere la propria timeline memorie con il gruppo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const memList = isEditing ? draft.timelineMemories || [] : bio.timelineMemories || [];
              if (memList.length === 0) {
                return (
                  <div className="p-6 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3">
                    Nessuna memoria o svolta registrata. Verranno generate automaticamente durante la sincronizzazione delle sessioni o puoi aggiungerne manualmente.
                  </div>
                );
              }
              return memList.map((mem, idx) => {
                const catInfo = MEMORY_CATEGORY_LABELS[mem.category] || MEMORY_CATEGORY_LABELS.event;
              return (
                <div
                  key={mem.id || idx}
                  className="p-3.5 rounded-xl bg-surface-2/40 border border-surface-3 space-y-2 hover:border-surface-3/80 transition-all text-xs"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditing ? (
                        <select
                          value={mem.category}
                          onChange={(e) => {
                            const val = e.target.value as TimelineMemoryEntry['category'];
                            setDraft((prev) => ({
                              ...prev,
                              timelineMemories: (prev.timelineMemories || []).map((m, i) =>
                                i === idx ? { ...m, category: val } : m
                              ),
                            }));
                          }}
                          className="bg-surface-1 border border-surface-3 rounded px-2 py-0.5 text-xs text-indigo-300 font-mono"
                        >
                          {Object.entries(MEMORY_CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${catInfo.cls}`}>
                          {catInfo.label}
                        </span>
                      )}

                      {mem.loreDate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-3 text-content-2">
                          ⏳ {mem.loreDate}
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-content-3">
                        {mem.impact === 'major' ? '⭐ Svolta Epica' : mem.impact === 'secret' ? '🔒 Segreto Personale' : '📜 Memoria'}
                      </span>
                    </div>

                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTimelineMemory(mem.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={mem.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((prev) => ({
                            ...prev,
                            timelineMemories: (prev.timelineMemories || []).map((m, i) =>
                              i === idx ? { ...m, title: val } : m
                            ),
                          }));
                        }}
                        placeholder="Titolo del ricordo..."
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 font-bold outline-none"
                      />
                      <textarea
                        rows={2}
                        value={mem.summary}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((prev) => ({
                            ...prev,
                            timelineMemories: (prev.timelineMemories || []).map((m, i) =>
                              i === idx ? { ...m, summary: val } : m
                            ),
                          }));
                        }}
                        placeholder="Descrizione di ciò che è accaduto..."
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-2 outline-none font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-bold text-sm text-content-1">{mem.title}</h4>
                      <p className="text-content-2 text-xs leading-relaxed mt-1">{mem.summary}</p>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
        )}
      </div>
      )}

      {/* 4. Credenze, Teorie, Patti & Obiettivi di Campagna */}
      {showMindSections && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-400" />
              <h3 className="font-heading text-sm font-bold text-content-1">
                Mente: Teorie, Patti, Rivelazioni &amp; Obiettivi
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {renderPrivacyToggle('evolvingBeliefs', 'Teorie e Credenze')}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddBelief}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Nuova Teoria / Patto
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar for Mind Content */}
          {(!isOtherPlayerView || currentPrivacy.evolvingBeliefs !== false) && (
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
              {(() => {
                const rawList = isEditing ? draft.evolvingBeliefs || [] : bio.evolvingBeliefs || [];
                const pattiCount = rawList.filter(
                  (b) => b.status === 'pact' || (b.subject && /patto|giuramento|accordo|contratto/i.test(b.subject))
                ).length;
                const rivelazioniCount = rawList.filter(
                  (b) => b.status !== 'pact' && !(b.subject && /patto|giuramento|accordo|contratto/i.test(b.subject))
                ).length;
                const openQuestsList = (quests || []).filter(
                  (q) => q.status !== 'completed' && q.status !== 'resolved' && q.status !== 'archived'
                );
                const completedQuestsList = (quests || []).filter(
                  (q) => q.status === 'completed' || q.status === 'resolved'
                );

                const filterButtons = [
                  { id: 'all', label: `Tutti (${rawList.length + openQuestsList.length + completedQuestsList.length})` },
                  { id: 'patti', label: `📜 Patti & Giuramenti (${pattiCount})` },
                  { id: 'rivelazioni', label: `💡 Rivelazioni & Teorie (${rivelazioniCount})` },
                  { id: 'open_goals', label: `🎯 Obiettivi Aperti (${openQuestsList.length})` },
                  { id: 'completed_goals', label: `🏆 Obiettivi Raggiunti (${completedQuestsList.length})` },
                ];

                return filterButtons.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setBeliefFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                      beliefFilter === f.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'bg-surface-2 text-content-3 hover:text-content-1 border border-surface-3'
                    }`}
                  >
                    {f.label}
                  </button>
                ));
              })()}
            </div>
          )}

          {/* Mind Content Display based on filter */}
          {isOtherPlayerView && currentPrivacy.evolvingBeliefs === false ? (
            <div className="bg-surface-2/30 border border-surface-3 rounded-xl p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
                <Lock size={18} />
              </div>
              <p className="text-xs font-semibold text-content-2">Teorie e Credenze Riservate</p>
              <p className="text-[11px] text-content-3 max-w-sm mx-auto leading-relaxed">
                {player.characterName || 'Il personaggio'} ha scelto di non condividere le proprie teorie con il gruppo.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const rawList = isEditing ? draft.evolvingBeliefs || [] : bio.evolvingBeliefs || [];
                const pattiCount = rawList.filter(
                  (b) => b.status === 'pact' || (b.subject && /patto|giuramento|accordo|contratto/i.test(b.subject))
                ).length;
                const rivelazioniCount = rawList.filter(
                  (b) => b.status !== 'pact' && !(b.subject && /patto|giuramento|accordo|contratto/i.test(b.subject))
                ).length;

                const openQuestsList = (quests || []).filter(
                  (q) => String(q.status) !== 'completed' && String(q.status) !== 'resolved' && String(q.status) !== 'archived'
                );
                const completedQuestsList = (quests || []).filter(
                  (q) => String(q.status) === 'completed' || String(q.status) === 'resolved'
                );

                const isPactItem = (b: EvolvingBelief) =>
                  b.status === 'pact' || (b.subject && /patto|giuramento|accordo|contratto/i.test(b.subject));

                let displayBeliefs = rawList;
                if ((beliefFilter as string) === 'patti') {
                  displayBeliefs = rawList.filter(isPactItem);
                } else if ((beliefFilter as string) === 'rivelazioni') {
                  displayBeliefs = rawList.filter((b) => !isPactItem(b));
                } else if ((beliefFilter as string) === 'open_goals' || (beliefFilter as string) === 'completed_goals') {
                  displayBeliefs = [];
                }

                const showQuestsSection =
                  beliefFilter === 'all' || (beliefFilter as string) === 'open_goals' || (beliefFilter as string) === 'completed_goals';

                return (
                  <div className="space-y-4">
                    {/* Render Beliefs / Patti / Rivelazioni if applicable */}
                    {displayBeliefs.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {displayBeliefs.map((bel, idx) => {
                          const statusInfo = BELIEF_STATUS_LABELS[bel.status] || BELIEF_STATUS_LABELS.active_theory;
                          return (
                            <div
                              key={bel.id || idx}
                              className="p-3.5 rounded-xl bg-surface-2/40 border border-surface-3 space-y-2 hover:border-surface-3/80 transition-all text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <select
                                      value={bel.status}
                                      onChange={(e) => {
                                        const val = e.target.value as EvolvingBelief['status'];
                                        setDraft((prev) => ({
                                          ...prev,
                                          evolvingBeliefs: (prev.evolvingBeliefs || []).map((b, i) =>
                                            i === idx ? { ...b, status: val } : b
                                          ),
                                        }));
                                      }}
                                      className="bg-surface-1 border border-surface-3 rounded px-2 py-0.5 text-xs text-amber-300 font-mono outline-none"
                                    >
                                      {Object.entries(BELIEF_STATUS_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>
                                          {v.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${statusInfo.cls}`}>
                                      {statusInfo.label}
                                    </span>
                                  )}
                                  <span className="font-bold text-content-1">{bel.subject}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {bel.revealedLoreDate && (
                                    <span className="text-[10px] font-mono text-content-3">
                                      {bel.revealedLoreDate}
                                    </span>
                                  )}
                                  {isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBelief(bel.id)}
                                      className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-2 pt-1">
                                  <input
                                    type="text"
                                    value={bel.subject}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDraft((prev) => ({
                                        ...prev,
                                        evolvingBeliefs: (prev.evolvingBeliefs || []).map((b, i) =>
                                          i === idx ? { ...b, subject: val } : b
                                        ),
                                      }));
                                    }}
                                    placeholder="Nome soggetto / fazione / patto..."
                                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-1 font-bold outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={bel.previousBelief || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDraft((prev) => ({
                                        ...prev,
                                        evolvingBeliefs: (prev.evolvingBeliefs || []).map((b, i) =>
                                          i === idx ? { ...b, previousBelief: val } : b
                                        ),
                                      }));
                                    }}
                                    placeholder="Condizione passata..."
                                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-3 outline-none"
                                  />
                                  <textarea
                                    rows={2}
                                    value={bel.currentTruth}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDraft((prev) => ({
                                        ...prev,
                                        evolvingBeliefs: (prev.evolvingBeliefs || []).map((b, i) =>
                                          i === idx ? { ...b, currentTruth: val } : b
                                        ),
                                      }));
                                    }}
                                    placeholder="Dettagli del patto o verità attuale..."
                                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-1 outline-none font-mono"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {bel.previousBelief && (
                                    <p className="text-[11px] text-content-3 font-mono line-through opacity-70">
                                      Passato: &ldquo;{bel.previousBelief}&rdquo;
                                    </p>
                                  )}
                                  <p className="text-[11px] text-content-1 font-mono bg-surface-1 p-2.5 rounded-lg border border-surface-3">
                                    👉 {bel.currentTruth}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Render Quests / Objectives Section */}
                    {showQuestsSection && (
                      <div className="space-y-3 pt-2">
                        {(beliefFilter === 'all' || (beliefFilter as string) === 'open_goals') && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-heading text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wide">
                                <Target size={14} /> Obiettivi Aperti ({openQuestsList.length})
                              </h4>
                              {!isOtherPlayerView && onOpenCreateQuest && (
                                <button
                                  type="button"
                                  onClick={onOpenCreateQuest}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                                >
                                  <Plus size={12} /> Nuovo Obiettivo
                                </button>
                              )}
                            </div>

                            {openQuestsList.length === 0 ? (
                              <div className="p-4 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3 font-mono">
                                Nessun obiettivo aperto per questo personaggio.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {openQuestsList.map((q) => (
                                  <div
                                    key={q._id}
                                    className="p-3.5 rounded-xl bg-surface-2/40 border border-cyan-500/30 space-y-2 hover:border-cyan-500/60 transition-all text-xs"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono font-bold">
                                          🎯 In Corso
                                        </span>
                                        <h5 className="font-bold text-content-1 text-sm mt-1">{q.name}</h5>
                                      </div>
                                      {!isOtherPlayerView && onEditQuest && (
                                        <button
                                          type="button"
                                          onClick={() => onEditQuest(q)}
                                          className="p-1 text-content-3 hover:text-cyan-300 transition-colors"
                                          title="Modifica obiettivo"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                      )}
                                    </div>
                                    {(q as any).description && (
                                      <p className="text-content-2 text-xs leading-relaxed line-clamp-3">
                                        {(q as any).description}
                                      </p>
                                    )}
                                    {q.progressNote && (
                                      <div className="bg-surface-1 p-2 rounded-lg border border-surface-3 text-[11px] text-content-2 font-mono">
                                        <span className="text-cyan-400 font-bold">Avanzamento:</span> {q.progressNote}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {(beliefFilter === 'all' || (beliefFilter as string) === 'completed_goals') && (
                          <div className="space-y-2 pt-2">
                            <h4 className="font-heading text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                              <Award size={14} /> Obiettivi Raggiunti ({completedQuestsList.length})
                            </h4>

                            {completedQuestsList.length === 0 ? (
                              <div className="p-4 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3 font-mono">
                                Nessun obiettivo completato registrato.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {completedQuestsList.map((q) => (
                                  <div
                                    key={q._id}
                                    className="p-3.5 rounded-xl bg-surface-2/40 border border-emerald-500/30 space-y-2 text-xs"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono font-bold">
                                          🏆 Raggiunto
                                        </span>
                                        <h5 className="font-bold text-content-1 text-sm mt-1">{q.name}</h5>
                                      </div>
                                    </div>
                                    {(q as any).description && (
                                      <p className="text-content-2 text-xs leading-relaxed line-clamp-2">
                                        {(q as any).description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Empty State when no items match current filter */}
                    {displayBeliefs.length === 0 &&
                      (((beliefFilter as string) === 'patti' && pattiCount === 0) ||
                        ((beliefFilter as string) === 'rivelazioni' && rivelazioniCount === 0)) && (
                        <div className="p-6 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3 font-mono">
                          Nessun elemento trovato per il filtro selezionato.
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 5. Relazioni Inter-Party & Fiducia nel Gruppo (PG ↔ PG) */}
      {showPartySections && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
          <div className="flex items-center gap-2">
            <HeartHandshake size={16} className="text-pink-400" />
            <h3 className="font-heading text-sm font-bold text-content-1">
              Rapporti &amp; Fiducia con i Compagni del Party (PG ↔ PG)
            </h3>
          </div>
          {renderPrivacyToggle('interPartyRelations', 'Rapporti Party')}
        </div>

        {isOtherPlayerView && currentPrivacy.interPartyRelations === false ? (
          <div className="bg-surface-2/30 border border-surface-3 rounded-xl p-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
              <Lock size={18} />
            </div>
            <p className="text-xs font-semibold text-content-2">Rapporti e Fiducia Riservati</p>
            <p className="text-[11px] text-content-3 max-w-sm mx-auto leading-relaxed">
              {player.characterName || 'Il personaggio'} ha scelto di tenere riservate le proprie impressioni e livelli di fiducia verso i compagni.
            </p>
          </div>
        ) : partyCompanions.length === 0 ? (
          <div className="p-6 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3">
            Nessun altro compagno d&apos;avventura registrato nel gruppo.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {partyCompanions.map((comp) => {
              const relMap = (isEditing ? draft.interPartyRelations : bio.interPartyRelations) || {};
              const rel = relMap[comp._id] || {
                targetPlayerId: comp._id,
                targetCharacterName: comp.characterName,
                attitude: 'neutral',
                trustLevel: 5,
                relationType: "Compagno d'Armi",
                notes: '',
              };
              const attLabel = ATTITUDE_LABELS[rel.attitude || 'neutral'];

              return (
                <div
                  key={comp._id}
                  className="p-3.5 rounded-xl bg-surface-2/40 border border-surface-3 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                        style={{ backgroundColor: comp.color || '#EC4899', color: '#fff' }}
                      >
                        {comp.characterName ? comp.characterName[0].toUpperCase() : 'P'}
                      </div>
                      <span className="font-bold text-content-1 truncate">{comp.characterName}</span>
                    </div>

                    {isEditing ? (
                      <select
                        value={rel.attitude || 'neutral'}
                        onChange={(e) =>
                          handleUpdateInterPartyRelation(comp._id, comp.characterName, {
                            attitude: e.target.value as RelationAttitude,
                          })
                        }
                        className="bg-surface-1 border border-surface-3 text-pink-300 font-bold rounded px-1.5 py-0.5 text-[11px] outline-none"
                      >
                        {Object.entries(ATTITUDE_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-pink-300">
                        {attLabel}
                      </span>
                    )}
                  </div>

                  {/* Trust bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-content-3">
                      <span>Livello di Fiducia:</span>
                      <span className="font-bold text-content-1">{rel.trustLevel ?? 5}/10</span>
                    </div>
                    {isEditing ? (
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={rel.trustLevel ?? 5}
                        onChange={(e) =>
                          handleUpdateInterPartyRelation(comp._id, comp.characterName, {
                            trustLevel: Number(e.target.value),
                          })
                        }
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    ) : (
                      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full"
                          style={{ width: `${((rel.trustLevel ?? 5) / 10) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Bond type and notes */}
                  {isEditing ? (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        value={rel.relationType || ''}
                        onChange={(e) =>
                          handleUpdateInterPartyRelation(comp._id, comp.characterName, {
                            relationType: e.target.value,
                          })
                        }
                        placeholder="Tipo di legame (es. Fratello d'armi, Debito di vita...)"
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded px-2 py-1 text-xs text-content-1 outline-none"
                      />
                      <input
                        type="text"
                        value={rel.notes || ''}
                        onChange={(e) =>
                          handleUpdateInterPartyRelation(comp._id, comp.characterName, {
                            notes: e.target.value,
                          })
                        }
                        placeholder="Note o segreti condivisi..."
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded px-2 py-1 text-xs text-content-2 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {rel.relationType && (
                        <p className="text-content-1 font-semibold text-[11px]">
                          Legame: <span className="text-pink-300 font-normal">{rel.relationType}</span>
                        </p>
                      )}
                      {rel.notes && (
                        <p className="text-content-3 italic text-[11px] leading-relaxed">
                          &ldquo;{rel.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* 6. Conoscenze del Mondo & Nozioni Apprese (World Lore) */}
      {showMindSections && (!isOtherPlayerView || currentPrivacy.worldLore !== false) && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-3">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              <h3 className="font-heading text-sm font-bold text-content-1 flex items-center gap-2">
                <span>Conoscenze del Mondo &amp; Nozioni Apprese</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {((isEditing ? draft.knownLoreBites : bio.knownLoreBites) || []).length} Nozioni
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {renderPrivacyToggle('worldLore', 'World Lore')}
              <Link
                to="/world-lore"
                className="text-[11px] font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                title="Apri l'Archivio World Lore completo"
              >
                <span>Archivio Lore</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          <p className="text-xs text-content-3 leading-relaxed">
            Nozioni cosmologiche, dogmi divini, leggi magiche e segreti storici che {player.characterName || 'il personaggio'} ha appreso o studiato nella sua vita.
          </p>

          {/* Lore Knowledge List */}
          {(() => {
            const currentBites = (isEditing ? draft.knownLoreBites : bio.knownLoreBites) || [];
            const allWorldArticles = CampaignManager.getWorldLoreArticles();

            if (currentBites.length === 0) {
              return (
                <div className="p-6 text-center text-xs text-content-3 bg-surface-2/20 rounded-xl border border-surface-3 space-y-2">
                  <p className="italic">Nessuna nozione di World Lore attualmente assegnata a questo personaggio.</p>
                  {isEditing && (
                    <p className="text-[11px] text-content-2">
                      Puoi assegnare nozioni direttamente da questa scheda oppure dalla pagina <strong>World Lore</strong>.
                    </p>
                  )}
                </div>
              );
            }

            const levelBadges: Record<LoreBiteLevel, { label: string; cls: string; icon: string }> = {
              public: { label: 'Sapere Popolare', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', icon: '👥' },
              specialized: { label: 'Iniziatica', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/25', icon: '🎓' },
              esoteric: { label: 'Mito Arcano', cls: 'bg-purple-500/10 text-purple-300 border-purple-500/25', icon: '🔮' },
              secret: { label: 'Verità Proibita', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25', icon: '🗝️' },
            };

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentBites.map((item, idx) => {
                  const lvl = levelBadges[item.biteLevel || 'public'] || levelBadges.public;
                  const fullArticle = allWorldArticles.find((a) => a._id === item.articleId);
                  const fullBite = fullArticle?.bites.find((b) => b.id === item.biteId);

                  return (
                    <div
                      key={`${item.articleId}_${item.biteId}_${idx}`}
                      className="p-3.5 rounded-xl bg-surface-2/40 border border-surface-3 space-y-2 text-xs hover:border-surface-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <Link
                            to={`/world-lore/${item.articleId}`}
                            className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 font-semibold truncate"
                          >
                            <span>{item.articleTitle || fullArticle?.title || 'Articolo di Lore'}</span>
                            <ExternalLink size={10} />
                          </Link>
                          <h4 className="font-bold text-content-1 text-xs truncate">
                            {item.biteTitle || fullBite?.title || 'Nozione'}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${lvl.cls}`}>
                            {lvl.icon} {lvl.label}
                          </span>

                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                const filtered = currentBites.filter((_, i) => i !== idx);
                                setDraft((prev) => ({ ...prev, knownLoreBites: filtered }));
                                CampaignManager.removeLoreBiteFromPlayer(item.articleId, item.biteId, player._id);
                              }}
                              className="p-1 text-content-3 hover:text-rose-400 rounded transition-colors ml-1"
                              title="Rimuovi nozione dal personaggio"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {fullBite?.content && (
                        <p className="text-[11px] text-content-2 leading-relaxed bg-surface-1/50 p-2 rounded-lg border border-surface-3/50 font-sans">
                          {fullBite.content}
                        </p>
                      )}

                      {/* Learning Note */}
                      {isEditing ? (
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = currentBites.map((b, i) => (i === idx ? { ...b, note: val } : b));
                            setDraft((prev) => ({ ...prev, knownLoreBites: updated }));
                          }}
                          placeholder="Origine del sapere (es. Studiato a Candlekeep, Tramandato...)"
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded px-2 py-1 text-[11px] text-content-1 outline-none"
                        />
                      ) : (
                        item.note && (
                          <p className="text-[11px] text-content-3 italic flex items-center gap-1 font-mono">
                            <Sparkles size={11} className="text-primary shrink-0" />
                            <span>Origine: &ldquo;{item.note}&rdquo;</span>
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Quick attach from campaign lore in edit mode */}
          {isEditing && (
            <div className="pt-2 border-t border-surface-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-content-3 font-mono">
                Assegna o approfondisci conoscenze nella vista World Lore completa
              </span>
              <Link
                to="/world-lore"
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} />
                <span>Gestisci in World Lore</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
