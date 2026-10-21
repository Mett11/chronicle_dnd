import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scroll,
  Edit3,
  Plus,
  Save,
  X,
  Compass,
  Users,
  Feather,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  HeartHandshake,
  Search,
  Sparkles,
  Calendar,
  Lock,
  Globe,
} from 'lucide-react';
import {
  Player,
  CharacterBio,
  Note,
  Entity,
  TimelineMemoryEntry,
  EvolvingBelief,
  CharacterKnownLoreItem,
  CharacterRelationship,
  RelationAttitude,
  InterPartyRelation,
} from '../../types';
import { CampaignManager } from '../../store/campaignStore';
import { RelationModal } from './RelationModal';

interface CharacterGrimoireFolioProps {
  player: Player;
  characterBio: CharacterBio | null;
  notes: Note[];
  quests: Entity[];
  entities: Entity[];
  scrapbook: any[];
  isOwnProfile: boolean;
  isDM: boolean;
  onBioUpdated: (bio: CharacterBio) => void;
  onOpenEditProfile: () => void;
  onOpenNoteModal: (note?: Note | null, isDm?: boolean) => void;
  onOpenQuestModal: (quest?: Entity | null) => void;
  onOpenMemoryModal: () => void;
  viewMode?: 'folio' | 'hub';
  onChangeViewMode?: (mode: 'folio' | 'hub') => void;
}

type HubSectionKey = 'conoscenze' | 'memorie' | 'legami' | 'reperti';

const ATTITUDE_LABELS: Record<string, { label: string; badgeClass: string; color: string }> = {
  friendly: { label: 'Amichevole', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', color: '#10b981' },
  helpful: { label: 'Disponibile', badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30', color: '#14b8a6' },
  neutral: { label: 'Neutrale', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30', color: '#f59e0b' },
  suspicious: { label: 'Diffidente', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30', color: '#a855f7' },
  hostile: { label: 'Ostile', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30', color: '#f43f5e' },
  fearful: { label: 'Timoroso', badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30', color: '#0ea5e9' },
  devoted: { label: 'Devoto', badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30', color: '#ec4899' },
  rival: { label: 'Rivale', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30', color: '#f97316' },
};

// Helper to normalize any historical trust value to a strict 1-10 scale
const normalizeTrust = (val: any): number => {
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num) || num <= 0) return 5;
  // If stored as percentage (e.g. 50, 75, 100), divide by 10 to fit 1-10
  if (num > 10) return Math.max(1, Math.min(10, Math.round(num / 10)));
  return Math.max(1, Math.min(10, Math.round(num)));
};

export function CharacterGrimoireFolio({
  player,
  characterBio,
  notes,
  quests,
  entities,
  scrapbook,
  isOwnProfile,
  isDM = false,
  onBioUpdated,
  onOpenEditProfile,
  onOpenNoteModal,
  onOpenMemoryModal,
}: CharacterGrimoireFolioProps) {
  // Can edit if this is the user's own character OR if the user is Dungeon Master
  const canEdit = Boolean(isOwnProfile || isDM);

  // Selected Subview (Null = 4-card overview, or specific section key)
  const [selectedHubSection, setSelectedHubSection] = useState<HubSectionKey | null>(null);

  // Local active notes list so quick additions reflect immediately
  const [localNotes, setLocalNotes] = useState<Note[]>(notes);
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  // Editing state for Section 1 (Dossier Identity)
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [dossierTitle, setDossierTitle] = useState('');
  const [dossierRace, setDossierRace] = useState('');
  const [dossierClass, setDossierClass] = useState('');
  const [dossierHometown, setDossierHometown] = useState('');
  const [dossierFaction, setDossierFaction] = useState('');
  const [dossierMotto, setDossierMotto] = useState('');
  const [dossierProse, setDossierProse] = useState('');

  // Trascrivi Pensiero Modal & State
  const [isTrascriviModalOpen, setIsTrascriviModalOpen] = useState(false);
  const [thoughtTitle, setThoughtTitle] = useState('');
  const [thoughtContent, setThoughtContent] = useState('');
  const [thoughtVisibility, setThoughtVisibility] = useState<'personal' | 'party'>('personal');
  const [isSubmittingThought, setIsSubmittingThought] = useState(false);
  const [thoughtSuccessBanner, setThoughtSuccessBanner] = useState<string | null>(null);

  // Search & Filtering inside sub-views
  const [searchQuery, setSearchQuery] = useState('');
  const [conoscenzeFilter, setConoscenzeFilter] = useState<'all' | 'beliefs' | 'lore' | 'codex'>('all');
  const [memorieFilter, setMemorieFilter] = useState<'all' | 'notes' | 'timeline'>('all');
  const [legamiFilter, setLegamiFilter] = useState<'all' | 'party' | 'family' | 'npc'>('all');
  const [repertiFilter, setRepertiFilter] = useState<'all' | 'quests' | 'scrapbook'>('all');

  // Pagination states (per section)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(6);
  const [paginatedResult, setPaginatedResult] = useState<{
    items: any[];
    total: number;
    totalPages: number;
    page: number;
  }>({
    items: [],
    total: 0,
    totalPages: 1,
    page: 1,
  });

  // Reset page when switching section or filter or search
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [selectedHubSection, conoscenzeFilter, memorieFilter, legamiFilter, repertiFilter]);

  // RelationModal state
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelationship | null>(null);

  // Party Bond edit modal state
  const [editingPartyBond, setEditingPartyBond] = useState<{
    targetPlayerId: string;
    targetCharacterName: string;
    attitude: RelationAttitude;
    trustLevel: number;
    relationType: string;
    notes: string;
  } | null>(null);

  // Real campaign data
  const calendar = useMemo(() => CampaignManager.getCalendar(), []);
  const allPlayers = useMemo(() => CampaignManager.getPlayers(), []);

  // Reactive Family & NPC relations state for this character
  const [familyRelations, setFamilyRelations] = useState<CharacterRelationship[]>(() =>
    CampaignManager.getFamilyRelations(player._id)
  );

  useEffect(() => {
    setFamilyRelations(CampaignManager.getFamilyRelations(player._id));
  }, [player._id]);

  useEffect(() => {
    const handleFamilyTreeUpdate = () => {
      setFamilyRelations(CampaignManager.getFamilyRelations(player._id));
    };
    window.addEventListener('chronicle_family_tree_updated', handleFamilyTreeUpdate);
    window.addEventListener('chronicle_character_bio_updated', handleFamilyTreeUpdate);
    return () => {
      window.removeEventListener('chronicle_family_tree_updated', handleFamilyTreeUpdate);
      window.removeEventListener('chronicle_character_bio_updated', handleFamilyTreeUpdate);
    };
  }, [player._id]);

  // Resolved hero details
  const displayName = useMemo(() => {
    return (characterBio?.characterName || characterBio?.name || player.characterName || player.name || 'Personaggio').trim();
  }, [characterBio, player]);

  const displayAvatar = useMemo(() => {
    const raw = CampaignManager.cleanAvatarString(characterBio?.avatarUrl) || CampaignManager.cleanAvatarString(player.avatarUrl) || '';
    return raw;
  }, [characterBio?.avatarUrl, player?.avatarUrl]);

  // Synchronize dossier fields from real bio data
  useEffect(() => {
    setDossierTitle(characterBio?.characterTitle || '');
    setDossierRace(characterBio?.characterRace || '');
    setDossierClass(characterBio?.characterClass || '');
    setDossierHometown(characterBio?.hometown || '');
    setDossierFaction((characterBio as any)?.factionOrGuild || '');
    setDossierMotto((characterBio as any)?.motto || '');
    setDossierProse(characterBio?.bio || characterBio?.backstoryMarkdown || '');
  }, [characterBio]);

  const handleSaveDossier = () => {
    const updated: CharacterBio = {
      ...(characterBio || { playerId: player._id }),
      playerId: player._id,
      characterName: displayName,
      name: displayName,
      characterTitle: dossierTitle.trim() || undefined,
      characterRace: dossierRace.trim() || undefined,
      characterClass: dossierClass.trim() || undefined,
      hometown: dossierHometown.trim() || undefined,
      bio: dossierProse.trim(),
      backstoryMarkdown: dossierProse.trim(),
      updatedAt: new Date().toISOString(),
      ...({
        factionOrGuild: dossierFaction.trim() || undefined,
        motto: dossierMotto.trim() || undefined,
      } as any),
    };

    CampaignManager.saveCharacterBio(updated);
    onBioUpdated(updated);
    setIsEditingDossier(false);
  };

  // Submit thought / note via CampaignManager with full author data
  const handleTrascriviThoughtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thoughtTitle.trim() && !thoughtContent.trim()) return;

    setIsSubmittingThought(true);
    try {
      const currentDay = calendar.currentDay || 1;
      const currentMonth = calendar.months?.[calendar.currentMonthIndex]?.name || 'Mese';
      const currentYear = calendar.currentYear || 1492;
      const yearSuffix = calendar.yearSuffix || 'CV';
      const loreDate = `${currentDay} ${currentMonth} ${currentYear} ${yearSuffix}`;

      const authorObj: Player = {
        _id: player._id,
        name: player.name || displayName,
        characterName: displayName,
        email: player.email || '',
        avatarUrl: displayAvatar,
        color: player.color || '#6366f1',
        isDm: Boolean(player.isDm),
      };

      const newNote = CampaignManager.addNote(
        {
          title: thoughtTitle.trim() || 'Pensiero di Viaggio',
          content: thoughtContent.trim(),
          visibility: thoughtVisibility === 'party' ? 'group' : 'personal',
          loreDate,
          dmOnly: false,
          canonState: 'theory',
          pinned: false,
          askDm: false,
        },
        authorObj
      );

      // Immediately append to local notes so view updates with zero delay
      setLocalNotes((prev) => [newNote, ...prev.filter((n) => n._id !== newNote._id)]);

      // Reset form
      setThoughtTitle('');
      setThoughtContent('');
      setIsTrascriviModalOpen(false);

      // Show toast
      setThoughtSuccessBanner('Pensiero trascritto e inciso nel Diario!');
      setTimeout(() => setThoughtSuccessBanner(null), 4000);

      // Switch to memorie section to let user see it immediately
      setSelectedHubSection('memorie');
      setCurrentPage(1);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_notes_updated'));
      }
    } catch (err) {
      console.error('[Trascrivi Pensiero Error]:', err);
    } finally {
      setIsSubmittingThought(false);
    }
  };

  // 1. Raw Conoscenze items (Beliefs + Known Lore Bites + Codex Entities)
  const rawConoscenzeList = useMemo(() => {
    const items: any[] = [];

    // Evolving Beliefs
    if (Array.isArray(characterBio?.evolvingBeliefs)) {
      characterBio.evolvingBeliefs.forEach((b: EvolvingBelief, idx) => {
        items.push({
          id: `belief_${idx}_${b.subject}`,
          type: 'belief',
          subject: b.subject,
          title: b.subject,
          status: b.status,
          currentTruth: b.currentTruth,
          notes: b.notes,
        });
      });
    }

    // Known Lore Bites
    if (Array.isArray(characterBio?.knownLoreBites)) {
      characterBio.knownLoreBites.forEach((lb: CharacterKnownLoreItem, idx) => {
        items.push({
          id: `lore_${idx}_${lb.biteId || lb.articleId || idx}`,
          type: 'lore',
          title: lb.biteTitle || lb.articleTitle || 'Frammento di Conoscenza',
          subject: lb.articleTitle || lb.biteTitle,
          content: lb.note || '',
          lore: lb.note || '',
          learnedDate: lb.addedAt,
          articleId: lb.articleId,
        });
      });
    }

    // Linked Codex Entities
    if (entities && entities.length > 0) {
      const cleanHeroName = displayName.toLowerCase().trim();
      const heroId = player._id;

      entities.forEach((ent) => {
        // Skip self
        if (ent.name?.toLowerCase().trim() === cleanHeroName) return;

        // Check if entity mentions or relates to this hero
        const entDesc = ent.description || (ent as any).content || '';
        const isLinked =
          ent.tags?.includes(heroId) ||
          ((ent as any).relatedEntityIds && (ent as any).relatedEntityIds.includes(heroId)) ||
          (entDesc && entDesc.toLowerCase().includes(cleanHeroName));

        if (isLinked) {
          items.push({
            id: `codex_${ent._id || ent.id}`,
            type: 'codex',
            codexId: ent._id || ent.id,
            title: ent.name,
            subject: ent.type || 'Codex',
            content: entDesc.slice(0, 180),
            category: ent.type,
            imageUrl: ent.imageUrl,
          });
        }
      });
    }

    return items;
  }, [characterBio?.evolvingBeliefs, characterBio?.knownLoreBites, entities, displayName, player._id]);

  // 2. Raw Memorie items (Timeline memories from bio + Player's session notes)
  const rawMemorieList = useMemo(() => {
    const items: any[] = [];

    // Timeline memories
    if (Array.isArray(characterBio?.timelineMemories)) {
      characterBio.timelineMemories.forEach((tm: TimelineMemoryEntry, idx) => {
        items.push({
          id: `tm_${idx}_${tm.id || idx}`,
          type: 'timeline',
          title: tm.title || `Memoria del ${tm.loreDate || 'Passato'}`,
          content: tm.summary || '',
          date: tm.loreDate,
          category: tm.category,
        });
      });
    }

    // Notes authored by this character
    if (Array.isArray(localNotes)) {
      localNotes.forEach((n) => {
        items.push({
          id: n._id,
          type: 'note',
          title: n.title,
          content: n.content,
          date: n.loreDate || new Date(n._createdAt || (n as any).createdAt || Date.now()).toLocaleDateString('it-IT'),
          rawDate: n._createdAt || (n as any).createdAt,
          visibility: n.visibility,
          pinned: n.pinned,
          tags: n.tags,
        });
      });
    }

    return items;
  }, [characterBio?.timelineMemories, localNotes]);

  // 3. Raw Legami items (Party companions + Family relations + World NPCs)
  const rawLegamiList = useMemo(() => {
    const items: any[] = [];

    // A. Fellow party members (PG)
    const otherPlayers = allPlayers.filter((p) => p._id !== player._id);
    const relMap = characterBio?.interPartyRelations || {};

    otherPlayers.forEach((otherP) => {
      const partyRel = relMap[otherP._id];
      const resolvedCompanion = CampaignManager.resolveCompanionRelation(
        characterBio,
        {
          _id: otherP._id,
          characterName: otherP.characterName || otherP.name,
        },
        familyRelations
      );

      const rawTrust = typeof partyRel?.trustLevel === 'number' ? partyRel.trustLevel : (resolvedCompanion as any).trustLevel ?? 5;
      const trust = normalizeTrust(rawTrust);
      const attitude = partyRel?.attitude || (resolvedCompanion as any).attitude || 'neutral';
      const notesText = partyRel?.notes || (resolvedCompanion as any).notes || '';
      const relationLabel = partyRel?.relationType || (resolvedCompanion as any).relationType || 'Compagno di Party';

      items.push({
        id: `party_${otherP._id}`,
        category: 'party',
        isPg: true,
        targetPlayerId: otherP._id,
        characterName: otherP.characterName || otherP.name,
        titleOrRole: otherP.name ? `Giocatore: ${otherP.name}` : 'Avventuriero',
        avatarUrl: CampaignManager.cleanAvatarString(otherP.avatarUrl),
        relationType: relationLabel,
        attitude,
        trustLevel: trust,
        notes: notesText,
      });
    });

    // B. Family Relations & Registered World Connections (Scale 1 to 10)
    if (Array.isArray(familyRelations)) {
      familyRelations.forEach((r) => {
        const isTrueFamily = [
          'ancestor', 'parent', 'sibling', 'child', 'spouse', 'descendant', 'relative'
        ].includes(r.relationshipType || '') || [
          'ancestors', 'parents', 'peers', 'children', 'descendants'
        ].includes(r.generationCategory || '');

        const isNpc = !isTrueFamily || r.generationCategory === 'connections' || [
          'companion', 'mentor', 'ally', 'rival', 'enemy', 'custom', 'other'
        ].includes(r.relationshipType || '');

        const category = isNpc ? 'npc' : 'family';

        items.push({
          id: `rel_${r.id}`,
          category,
          isFamily: !isNpc,
          characterName: r.name,
          titleOrRole: r.relationshipType || (isNpc ? 'Contatto' : 'Parente'),
          relationType: r.customRelationshipLabel || r.relationshipType || (isNpc ? 'Legame' : 'Famiglia'),
          avatarUrl: CampaignManager.cleanAvatarString(r.avatarUrl),
          attitude: r.attitude || 'neutral',
          trustLevel: normalizeTrust(r.trustLevel ?? 5),
          notes: r.bio || '',
          statusBadge: r.status,
          rawRelation: r,
        });
      });
    }

    // C. World NPCs & Non-Party Entities in Bio (if any additional)
    const bioRelationships = (characterBio as any)?.relationships;
    if (Array.isArray(bioRelationships)) {
      bioRelationships.forEach((r: any) => {
        const isAlreadyPresent = items.some(
          (item) => item.characterName?.toLowerCase() === r.name?.toLowerCase() || item.id === `rel_${r.id}`
        );
        if (!isAlreadyPresent) {
          items.push({
            id: `npc_${r.id}`,
            category: 'npc',
            characterName: r.name,
            titleOrRole: r.titleOrRole || 'Contatto del Mondo',
            relationType: r.customRelationshipLabel || r.relationshipType || 'Legame',
            avatarUrl: CampaignManager.cleanAvatarString(r.avatarUrl),
            attitude: r.attitude || 'neutral',
            trustLevel: normalizeTrust(r.trustLevel ?? 5),
            notes: r.bio || '',
            rawRelation: r,
          });
        }
      });
    }

    return items;
  }, [allPlayers, player._id, characterBio, familyRelations]);

  // 4. Raw Reperti & Cronache items (Quests + Scrapbook Items)
  const rawRepertiList = useMemo(() => {
    const items: any[] = [];

    if (Array.isArray(quests)) {
      quests.forEach((q) => {
        items.push({
          id: `quest_${q._id || q.id}`,
          type: 'quest',
          title: q.name,
          status: (q as any).status || 'active',
          questScope: (q as any).questScope || 'personal',
          content: q.description || (q as any).content || '',
          category: 'Missione Personale',
        });
      });
    }

    if (Array.isArray(scrapbook)) {
      scrapbook.forEach((s) => {
        items.push({
          id: `scrap_${s.id || s._id}`,
          type: 'scrapbook',
          title: s.title || 'Frammento Visivo',
          content: s.caption || s.description,
          imageUrl: s.imageUrl,
          category: s.category || 'Reperto',
          loreDate: s.loreDate || s.date,
        });
      });
    }

    return items;
  }, [quests, scrapbook]);

  // Active raw list based on selected section
  const currentRawItems = useMemo(() => {
    if (!selectedHubSection) return [];
    if (selectedHubSection === 'conoscenze') return rawConoscenzeList;
    if (selectedHubSection === 'memorie') return rawMemorieList;
    if (selectedHubSection === 'legami') return rawLegamiList;
    if (selectedHubSection === 'reperti') return rawRepertiList;
    return [];
  }, [selectedHubSection, rawConoscenzeList, rawMemorieList, rawLegamiList, rawRepertiList]);

  // Active section filter key
  const activeSubFilter = useMemo(() => {
    if (selectedHubSection === 'conoscenze') return conoscenzeFilter;
    if (selectedHubSection === 'memorie') return memorieFilter;
    if (selectedHubSection === 'legami') return legamiFilter;
    if (selectedHubSection === 'reperti') return repertiFilter;
    return 'all';
  }, [selectedHubSection, conoscenzeFilter, memorieFilter, legamiFilter, repertiFilter]);

  // Call Server-side pagination endpoint with fallback to local client pagination
  const fetchPaginatedData = useCallback(async () => {
    if (!selectedHubSection) {
      setPaginatedResult({ items: [], total: 0, totalPages: 1, page: 1 });
      return;
    }

    try {
      const response = await fetch('/api/character/hub-data/paginate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: selectedHubSection,
          items: currentRawItems,
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery,
          filter: activeSubFilter,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPaginatedResult({
          items: data.items || [],
          total: data.total || 0,
          totalPages: data.totalPages || 1,
          page: data.page || currentPage,
        });
        return;
      }
    } catch {
      // Fallback to client-side computation if server is unreachable
    }

    // Local client-side slicing fallback
    let filtered = [...currentRawItems];

    if (activeSubFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        if (selectedHubSection === 'conoscenze') {
          if (activeSubFilter === 'beliefs') return item.type === 'belief';
          if (activeSubFilter === 'lore') return item.type === 'lore';
          if (activeSubFilter === 'codex') return item.type === 'codex';
        } else if (selectedHubSection === 'legami') {
          if (activeSubFilter === 'party') return item.category === 'party';
          if (activeSubFilter === 'family') return item.category === 'family';
          if (activeSubFilter === 'npc') return item.category === 'npc';
        } else if (selectedHubSection === 'memorie') {
          if (activeSubFilter === 'notes') return item.type === 'note';
          if (activeSubFilter === 'timeline') return item.type === 'timeline';
        } else if (selectedHubSection === 'reperti') {
          if (activeSubFilter === 'quests') return item.type === 'quest';
          if (activeSubFilter === 'scrapbook') return item.type === 'scrapbook';
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item: any) => {
        const text = [
          item.title,
          item.characterName,
          item.subject,
          item.content,
          item.lore,
          item.currentTruth,
          item.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const validPage = Math.min(currentPage, totalPages);
    const startIndex = (validPage - 1) * itemsPerPage;
    const items = filtered.slice(startIndex, startIndex + itemsPerPage);

    setPaginatedResult({
      items,
      total,
      totalPages,
      page: validPage,
    });
  }, [selectedHubSection, currentRawItems, currentPage, itemsPerPage, searchQuery, activeSubFilter]);

  useEffect(() => {
    fetchPaginatedData();
  }, [fetchPaginatedData]);

  // Handle saving party bond attitude and trust
  const handleSavePartyBond = async () => {
    if (!editingPartyBond) return;
    const currentRelMap = { ...(characterBio?.interPartyRelations || {}) };
    const cleanTrust = normalizeTrust(editingPartyBond.trustLevel);
    const newBond: InterPartyRelation = {
      targetPlayerId: editingPartyBond.targetPlayerId,
      targetCharacterName: editingPartyBond.targetCharacterName,
      attitude: editingPartyBond.attitude,
      trustLevel: cleanTrust,
      relationType: editingPartyBond.relationType.trim() || 'Compagno di Party',
      notes: editingPartyBond.notes.trim(),
    };

    const updatedBio: CharacterBio = {
      ...(characterBio || { playerId: player._id }),
      playerId: player._id,
      characterName: displayName,
      interPartyRelations: {
        ...currentRelMap,
        [editingPartyBond.targetPlayerId]: newBond,
      },
    };

    await CampaignManager.saveCharacterBio(updatedBio);
    onBioUpdated(updatedBio);
    setEditingPartyBond(null);
  };

  // Helper to render trust bar strictly on a 1 to 10 scale (no percentage, 10 segment pips)
  const renderTrustBar = (trustLevel: number, attitude?: string) => {
    const trust = normalizeTrust(trustLevel);
    const isHigh = trust >= 7;
    const isLow = trust <= 3;
    const badgeText = attitude ? (ATTITUDE_LABELS[attitude]?.label || attitude) : null;

    return (
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between text-[11px] font-serif">
          <span className="text-content-3 uppercase tracking-wider flex items-center gap-1.5">
            <HeartHandshake size={12} className="text-primary" /> Fiducia
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-content-1 font-bold font-mono text-xs">
              {trust} / 10
            </span>
            {badgeText && (
              <span className="text-content-3 text-[10px]">
                • {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* 10 discrete segment pips for unambiguous 1-10 scale */}
        <div className="grid grid-cols-10 gap-1 w-full pt-0.5">
          {Array.from({ length: 10 }, (_, i) => {
            const isFilled = i < trust;
            let pipColor = 'bg-surface-3';
            if (isFilled) {
              if (isLow) pipColor = 'bg-rose-500 shadow-xs shadow-rose-500/20';
              else if (isHigh) pipColor = 'bg-emerald-500 shadow-xs shadow-emerald-500/20';
              else pipColor = 'bg-amber-500 shadow-xs shadow-amber-500/20';
            }
            return (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${pipColor}`}
                title={`Livello ${i + 1}/10`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full text-content-1">
      {/* Toast Notification */}
      {thoughtSuccessBanner && (
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-serif shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span className="font-semibold">{thoughtSuccessBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setThoughtSuccessBanner(null)}
              className="text-emerald-400/70 hover:text-emerald-400 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-10">
        {/* ========================================================================= */}
        {/* TOP HERO DOSSIER: 3:4 IMAGE ON LEFT, RACE/INFO & 4-CARD HUB ON RIGHT       */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Large Character Portrait in 3:4 */}
          <div className="lg:col-span-4 flex flex-col items-center sm:items-start space-y-4">
            <div className="relative group w-full max-w-[340px] aspect-[3/4] bg-surface-1 rounded-2xl overflow-hidden border border-surface-2 shadow-2xl p-1.5 transition-all">
              <div className="w-full h-full relative overflow-hidden bg-surface-2 rounded-xl border border-surface-3">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover object-center filter contrast-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-surface-2 text-primary p-6 text-center">
                    <Scroll size={48} className="opacity-50 mb-3" />
                    <span className="font-serif text-lg font-bold tracking-wider">{displayName}</span>
                    <span className="text-xs font-serif text-content-3 mt-1">Nessun ritratto registrato</span>
                  </div>
                )}
              </div>

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={onOpenEditProfile}
                  className="absolute bottom-4 right-4 p-2 bg-surface-1/90 hover:bg-surface-2 text-content-1 border border-surface-3 rounded-xl shadow-lg transition-colors cursor-pointer"
                  title="Modifica ritratto ed emblema"
                >
                  <Edit3 size={15} />
                </button>
              )}
            </div>

            {/* Motto */}
            {dossierMotto ? (
              <p className="text-center sm:text-left text-xs font-serif italic text-content-3 max-w-[340px] leading-relaxed px-1">
                &ldquo;{dossierMotto}&rdquo;
              </p>
            ) : null}

            {/* Quick Trascrivi Pensiero CTA right below portrait */}
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setIsTrascriviModalOpen(true)}
                className="w-full max-w-[340px] py-2.5 px-4 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-serif font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Feather size={14} />
                <span>Trascrivi Pensiero</span>
              </button>
            )}
          </div>

          {/* RIGHT COLUMN: Character Details & Badges, then 4-Card Hub */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            {/* 1. Character Identity & Lore Information */}
            <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-5 shadow-lg relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-4xl font-serif font-bold text-content-1 tracking-tight">
                    {displayName}
                  </h1>
                  {dossierTitle ? (
                    <p className="text-xs sm:text-sm font-serif italic text-primary">
                      {dossierTitle}
                    </p>
                  ) : null}
                </div>

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDossier(!isEditingDossier)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 rounded-lg text-xs font-serif flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>{isEditingDossier ? 'Annulla' : 'Modifica Dati'}</span>
                  </button>
                )}
              </div>

              {/* Badges: Razza, Classe, Origine, Fazione */}
              {isEditingDossier ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Titolo / Epitaffio
                    </label>
                    <input
                      type="text"
                      value={dossierTitle}
                      onChange={(e) => setDossierTitle(e.target.value)}
                      placeholder="es. Erede della Casata..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Razza / Stirpe
                    </label>
                    <input
                      type="text"
                      value={dossierRace}
                      onChange={(e) => setDossierRace(e.target.value)}
                      placeholder="es. Mezzelfo, Umano..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Classe / Ruolo
                    </label>
                    <input
                      type="text"
                      value={dossierClass}
                      onChange={(e) => setDossierClass(e.target.value)}
                      placeholder="es. Mago delle Ombre, Guerriero..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Origine / Città Natale
                    </label>
                    <input
                      type="text"
                      value={dossierHometown}
                      onChange={(e) => setDossierHometown(e.target.value)}
                      placeholder="es. Waterdeep, Baldur's Gate..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Fazione / Circolo
                    </label>
                    <input
                      type="text"
                      value={dossierFaction}
                      onChange={(e) => setDossierFaction(e.target.value)}
                      placeholder="es. Arpisti, Gilda dei Ladri..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Motto del Personaggio
                    </label>
                    <input
                      type="text"
                      value={dossierMotto}
                      onChange={(e) => setDossierMotto(e.target.value)}
                      placeholder="es. Nessun segreto resta sepolto..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block mb-1">
                      Biografia & Cronaca Personale (Markdown)
                    </label>
                    <textarea
                      rows={3}
                      value={dossierProse}
                      onChange={(e) => setDossierProse(e.target.value)}
                      placeholder="Trascrivi le origini del personaggio..."
                      className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-lg p-2.5 text-xs font-serif outline-none focus:border-primary"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDossier(false)}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-lg text-xs font-serif cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDossier}
                      className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-lg text-xs font-serif font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save size={12} /> Salva Dati
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="bg-surface-2 border border-surface-3 rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-content-3 font-serif block">
                        Razza / Stirpe
                      </span>
                      <span className="text-xs font-serif font-bold text-content-1 truncate block mt-0.5">
                        {dossierRace || 'Non specificata'}
                      </span>
                    </div>

                    <div className="bg-surface-2 border border-surface-3 rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-content-3 font-serif block">
                        Classe / Ruolo
                      </span>
                      <span className="text-xs font-serif font-bold text-content-1 truncate block mt-0.5">
                        {dossierClass || 'Avventuriero'}
                      </span>
                    </div>

                    <div className="bg-surface-2 border border-surface-3 rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-content-3 font-serif block">
                        Origine
                      </span>
                      <span className="text-xs font-serif font-bold text-content-1 truncate block mt-0.5">
                        {dossierHometown || 'Non specificata'}
                      </span>
                    </div>

                    <div className="bg-surface-2 border border-surface-3 rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-content-3 font-serif block">
                        Fazione / Circolo
                      </span>
                      <span className="text-xs font-serif font-bold text-content-1 truncate block mt-0.5">
                        {dossierFaction || 'Nessuna'}
                      </span>
                    </div>
                  </div>

                  {dossierProse ? (
                    <div className="pt-2 border-t border-surface-2">
                      <p className="text-xs sm:text-sm font-serif text-content-2 leading-relaxed whitespace-pre-line line-clamp-3">
                        {dossierProse}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* 2. THE 4-CARD HUB: Conoscenze, Memorie, Legami, Reperti */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-content-3 font-serif font-bold flex items-center gap-1.5">
                  <BookOpen size={13} className="text-primary" /> HUB DEL PERSONAGGIO
                </span>
                {selectedHubSection && (
                  <button
                    type="button"
                    onClick={() => setSelectedHubSection(null)}
                    className="text-xs font-serif text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={13} /> Torna a tutte le card
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CARD 1: Conoscenze & Verità */}
                <div
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setSelectedHubSection('conoscenze');
                  }}
                  className={`bg-surface-0/60 hover:bg-surface-1 border-l-4 pl-4 py-3 sm:py-3.5 transition-all duration-200 cursor-pointer group relative ${
                    selectedHubSection === 'conoscenze'
                      ? 'border-primary bg-surface-1 shadow-xs'
                      : 'border-surface-3 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-amber-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-serif font-bold text-content-1 group-hover:text-primary transition-colors">
                        Conoscenze & Verità
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-content-3">
                      {rawConoscenzeList.length} voci
                    </span>
                  </div>
                  <p className="text-xs font-serif text-content-3 mt-1 line-clamp-1">
                    Credenze, rivelazioni storiche, glifi arcanici e lore del mondo.
                  </p>
                </div>

                {/* CARD 2: Memorie & Presagi */}
                <div
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setSelectedHubSection('memorie');
                  }}
                  className={`bg-surface-0/60 hover:bg-surface-1 border-l-4 pl-4 py-3 sm:py-3.5 transition-all duration-200 cursor-pointer group relative ${
                    selectedHubSection === 'memorie'
                      ? 'border-primary bg-surface-1 shadow-xs'
                      : 'border-surface-3 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Feather size={16} className="text-indigo-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-serif font-bold text-content-1 group-hover:text-primary transition-colors">
                        Memorie & Diario
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-content-3">
                      {rawMemorieList.length} note
                    </span>
                  </div>
                  <p className="text-xs font-serif text-content-3 mt-1 line-clamp-1">
                    Pensieri trascritti, cronache di sessione e memorie del passato.
                  </p>
                </div>

                {/* CARD 3: Legami & Fiducia */}
                <div
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setSelectedHubSection('legami');
                  }}
                  className={`bg-surface-0/60 hover:bg-surface-1 border-l-4 pl-4 py-3 sm:py-3.5 transition-all duration-200 cursor-pointer group relative ${
                    selectedHubSection === 'legami'
                      ? 'border-primary bg-surface-1 shadow-xs'
                      : 'border-surface-3 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Users size={16} className="text-emerald-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-serif font-bold text-content-1 group-hover:text-primary transition-colors">
                        Legami & Fiducia
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-content-3">
                      {rawLegamiList.length} relazioni
                    </span>
                  </div>
                  <p className="text-xs font-serif text-content-3 mt-1 line-clamp-1">
                    Compagni di party, parentela, PNG e barra di fiducia dedicata.
                  </p>
                </div>

                {/* CARD 4: Reperti & Cronache */}
                <div
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setSelectedHubSection('reperti');
                  }}
                  className={`bg-surface-0/60 hover:bg-surface-1 border-l-4 pl-4 py-3 sm:py-3.5 transition-all duration-200 cursor-pointer group relative ${
                    selectedHubSection === 'reperti'
                      ? 'border-primary bg-surface-1 shadow-xs'
                      : 'border-surface-3 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Compass size={16} className="text-rose-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-serif font-bold text-content-1 group-hover:text-primary transition-colors">
                        Reperti & Imprese
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-content-3">
                      {rawRepertiList.length} elementi
                    </span>
                  </div>
                  <p className="text-xs font-serif text-content-3 mt-1 line-clamp-1">
                    Missioni personali, frammenti visivi e reperti di campagna.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SUBVIEW CONTAINER: REPLACES/SHOWS DETAILS FOR SELECTED HUB SECTION        */}
        {/* ========================================================================= */}
        {selectedHubSection && (
          <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl animate-fadeIn">
            {/* Subview Header & Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-2 pb-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedHubSection(null)}
                  className="p-2 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 rounded-xl transition-colors cursor-pointer border border-surface-3"
                  title="Torna all'Hub"
                >
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-content-1 tracking-tight flex items-center gap-2">
                    {selectedHubSection === 'conoscenze' && <Sparkles size={20} className="text-amber-400" />}
                    {selectedHubSection === 'memorie' && <Feather size={20} className="text-indigo-400" />}
                    {selectedHubSection === 'legami' && <Users size={20} className="text-emerald-400" />}
                    {selectedHubSection === 'reperti' && <Compass size={20} className="text-rose-400" />}
                    <span>
                      {selectedHubSection === 'conoscenze' && 'Conoscenze & Verità'}
                      {selectedHubSection === 'memorie' && 'Memorie & Diario di Viaggio'}
                      {selectedHubSection === 'legami' && 'Legami, Alleanze & Fiducia'}
                      {selectedHubSection === 'reperti' && 'Reperti, Imprese & Cronache'}
                    </span>
                  </h2>
                  <p className="text-xs font-serif text-content-3 mt-0.5">
                    {paginatedResult.total} elementi registrati nel tomo
                  </p>
                </div>
              </div>

              {/* Quick section switcher buttons */}
              <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-surface-3 text-xs font-serif">
                {(['conoscenze', 'memorie', 'legami', 'reperti'] as HubSectionKey[]).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedHubSection(sec)}
                    className={`px-3 py-1.5 rounded-lg transition-colors capitalize cursor-pointer ${
                      selectedHubSection === sec
                        ? 'bg-surface-3 text-primary font-bold shadow-xs'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Pills, Search Bar & Action CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-serif">
                {selectedHubSection === 'conoscenze' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConoscenzeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        conoscenzeFilter === 'all'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Tutte ({rawConoscenzeList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConoscenzeFilter('beliefs')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        conoscenzeFilter === 'beliefs'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Credenze & Teorie
                    </button>
                    <button
                      type="button"
                      onClick={() => setConoscenzeFilter('lore')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        conoscenzeFilter === 'lore'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Lore & Glifi
                    </button>
                    <button
                      type="button"
                      onClick={() => setConoscenzeFilter('codex')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        conoscenzeFilter === 'codex'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Dal Codex
                    </button>
                  </>
                )}

                {selectedHubSection === 'memorie' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMemorieFilter('all')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        memorieFilter === 'all'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Tutte ({rawMemorieList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemorieFilter('notes')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        memorieFilter === 'notes'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Diario & Pensieri
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemorieFilter('timeline')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        memorieFilter === 'timeline'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Memorie Storiche
                    </button>
                  </>
                )}

                {selectedHubSection === 'legami' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setLegamiFilter('all')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        legamiFilter === 'all'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Tutti ({rawLegamiList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegamiFilter('party')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        legamiFilter === 'party'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Compagni di Party
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegamiFilter('family')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        legamiFilter === 'family'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Parenti & Famiglia
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegamiFilter('npc')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        legamiFilter === 'npc'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Contatti & PNG
                    </button>
                  </>
                )}

                {selectedHubSection === 'reperti' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRepertiFilter('all')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        repertiFilter === 'all'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Tutti ({rawRepertiList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepertiFilter('quests')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        repertiFilter === 'quests'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Missioni Personali
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepertiFilter('scrapbook')}
                      className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        repertiFilter === 'scrapbook'
                          ? 'bg-primary text-surface-0 border-primary font-bold'
                          : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                      }`}
                    >
                      Scrapbook & Frammenti
                    </button>
                  </>
                )}
              </div>

              {/* Search Bar & Action Buttons */}
              <div className="flex items-center gap-3">
                <div className="relative min-w-[200px] sm:min-w-[260px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca in questa sezione..."
                    className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl pl-8 pr-7 py-1.5 text-xs font-serif outline-none focus:border-primary transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Section Specific Action CTA */}
                {selectedHubSection === 'memorie' && canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsTrascriviModalOpen(true)}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-serif font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Feather size={13} />
                    <span>Trascrivi Pensiero</span>
                  </button>
                )}

                {selectedHubSection === 'legami' && canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRelation(null);
                      setRelationModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-serif font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Aggiungi Legame</span>
                  </button>
                )}

                {selectedHubSection === 'reperti' && canEdit && (
                  <button
                    type="button"
                    onClick={onOpenMemoryModal}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-serif font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Aggiungi Reperto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Items Per Page Selector */}
            <div className="flex items-center justify-between text-xs font-serif text-content-3 pt-2">
              <span>
                Mostrando {paginatedResult.items.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{' '}
                {Math.min(currentPage * itemsPerPage, paginatedResult.total)} di {paginatedResult.total} elementi
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]">Voci per pagina:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value={4}>4</option>
                  <option value={6}>6</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            {/* Paginated Items Grid */}
            <div className="space-y-4 pt-2">
              {paginatedResult.items.length === 0 ? (
                <div className="bg-surface-2/60 border border-surface-3 border-dashed rounded-2xl p-10 text-center space-y-3">
                  <Scroll size={32} className="mx-auto text-content-3 opacity-50" />
                  <p className="text-sm font-serif font-semibold text-content-2">
                    Nessun elemento trovato per questa selezione.
                  </p>
                  <p className="text-xs font-serif text-content-3 max-w-sm mx-auto">
                    {searchQuery
                      ? `Nessuna voce corrisponde a "${searchQuery}". Prova a modificare i filtri.`
                      : 'Non vi sono registrazioni presenti in questo tomo per la categoria selezionata.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6 divide-y divide-surface-2/60">
                  {/* CONOSCENZE ITEMS */}
                  {selectedHubSection === 'conoscenze' &&
                    paginatedResult.items.map((item: any) => (
                      <article
                        key={item.id}
                        className="pt-6 first:pt-0 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-serif tracking-widest text-primary font-bold">
                            {item.type === 'belief' && (item.status || 'Credenza')}
                            {item.type === 'lore' && 'Lore del Mondo'}
                            {item.type === 'codex' && `Codex: ${item.category || 'Entità'}`}
                          </span>
                          {item.learnedDate && (
                            <span className="text-[10px] font-serif text-content-3 flex items-center gap-1">
                              <Calendar size={11} /> {item.learnedDate}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-base sm:text-lg font-serif font-bold text-content-1 tracking-tight">
                            {item.title}
                          </h4>
                          <p className="text-xs sm:text-sm font-serif text-content-2 mt-2 leading-relaxed whitespace-pre-line">
                            {item.currentTruth || item.content || item.notes || item.lore}
                          </p>
                        </div>
                      </article>
                    ))}

                  {/* MEMORIE ITEMS */}
                  {selectedHubSection === 'memorie' &&
                    paginatedResult.items.map((note: any) => (
                      <article
                        key={note.id}
                        className="pt-6 first:pt-0 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-serif tracking-widest text-primary font-bold flex items-center gap-1.5">
                              {note.type === 'timeline' ? (
                                <>
                                  <Scroll size={12} /> Memoria Storica
                                </>
                              ) : (
                                <>
                                  <Feather size={12} /> Diario di Viaggio
                                </>
                              )}
                            </span>
                            <div className="flex items-center gap-3">
                              {note.date && (
                                <span className="text-[10px] font-serif text-content-3 flex items-center gap-1">
                                  <Calendar size={11} /> {note.date}
                                </span>
                              )}
                              {note.visibility && (
                                <span className="text-[10px] font-serif text-content-3" title={note.visibility === 'group' ? 'Visibile al party' : 'Privato'}>
                                  {note.visibility === 'group' ? (
                                    <Globe size={11} className="text-emerald-400" />
                                  ) : (
                                    <Lock size={11} className="text-amber-400" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <h4 className="text-base sm:text-lg font-serif font-bold text-content-1 tracking-tight">
                            &ldquo;{note.title}&rdquo;
                          </h4>

                          <p className="text-xs sm:text-sm font-serif text-content-2 leading-relaxed whitespace-pre-line">
                            {note.content}
                          </p>
                        </div>

                        {isOwnProfile && note.type === 'note' && (
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const realNote = localNotes.find((n) => n._id === note.id);
                                if (realNote) onOpenNoteModal(realNote);
                              }}
                              className="text-xs font-serif text-content-3 hover:text-content-1 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit3 size={12} /> Modifica Nota
                            </button>
                          </div>
                        )}
                      </article>
                    ))}

                  {/* LEGAMI ITEMS */}
                  {selectedHubSection === 'legami' &&
                    paginatedResult.items.map((rel: any) => {
                      const attitudeData = ATTITUDE_LABELS[rel.attitude] || {
                        label: rel.attitude,
                        badgeClass: 'bg-surface-3 text-content-2 border-surface-3',
                      };

                      return (
                        <article
                          key={rel.id}
                          className="pt-6 first:pt-0 space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-2 border border-surface-3 shrink-0 flex items-center justify-center">
                                  {rel.avatarUrl ? (
                                    <img
                                      src={rel.avatarUrl}
                                      alt={rel.characterName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Users size={18} className="text-content-3" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-base sm:text-lg font-serif font-bold text-content-1">
                                    {rel.characterName}
                                  </h4>
                                  <span className="text-xs font-serif text-content-3 block">
                                    {rel.relationType || rel.titleOrRole}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-serif px-2.5 py-0.5 rounded-full border ${attitudeData.badgeClass}`}
                              >
                                {attitudeData.label}
                              </span>
                            </div>

                            {/* Trust Bar */}
                            {renderTrustBar(rel.trustLevel, rel.attitude)}

                            {rel.notes ? (
                              <p className="text-xs sm:text-sm font-serif text-content-2 italic leading-relaxed pt-1">
                                &ldquo;{rel.notes}&rdquo;
                              </p>
                            ) : null}
                          </div>

                          {canEdit && (
                            <div className="pt-2 flex justify-end">
                              {rel.isPg ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPartyBond({
                                      targetPlayerId: rel.targetPlayerId,
                                      targetCharacterName: rel.characterName,
                                      attitude: rel.attitude,
                                      trustLevel: normalizeTrust(rel.trustLevel),
                                      relationType: rel.relationType,
                                      notes: rel.notes,
                                    })
                                  }
                                  className="text-xs font-serif text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 size={12} /> Modifica Legame Party
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRelation(rel.rawRelation);
                                    setRelationModalOpen(true);
                                  }}
                                  className="text-xs font-serif text-content-3 hover:text-content-1 flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 size={12} /> Modifica Relazione
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}

                  {/* REPERTI ITEMS */}
                  {selectedHubSection === 'reperti' &&
                    paginatedResult.items.map((rep: any) => (
                      <article
                        key={rep.id}
                        className="pt-6 first:pt-0 space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-serif tracking-widest text-rose-400 font-bold">
                            {rep.category}
                          </span>
                          {rep.loreDate && (
                            <span className="text-[10px] font-serif text-content-3 flex items-center gap-1">
                              <Calendar size={11} /> {rep.loreDate}
                            </span>
                          )}
                        </div>

                        {rep.imageUrl && (
                          <div className="w-full max-w-md h-44 rounded-xl overflow-hidden bg-surface-2 border border-surface-3">
                            <img src={rep.imageUrl} alt={rep.title} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div>
                          <h4 className="text-base sm:text-lg font-serif font-bold text-content-1">{rep.title}</h4>
                          <p className="text-xs sm:text-sm font-serif text-content-2 mt-1.5 leading-relaxed">{rep.content}</p>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </div>

            {/* Pagination Controls Bar */}
            {paginatedResult.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-surface-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 text-content-1 border border-surface-3 rounded-xl text-xs font-serif flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} /> Precedente
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: paginatedResult.totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-serif font-bold transition-colors cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-primary text-surface-0 shadow-sm'
                            : 'bg-surface-2 hover:bg-surface-3 text-content-2 border border-surface-3'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= paginatedResult.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(paginatedResult.totalPages, p + 1))}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 text-content-1 border border-surface-3 rounded-xl text-xs font-serif flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  Successiva <ChevronRight size={13} />
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TRASCRIVI PENSIERO (WORKING & THEMED)                               */}
      {/* ========================================================================= */}
      {isTrascriviModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-primary font-serif font-bold flex items-center gap-2">
                <Feather size={16} /> TRASCRIVI UN PENSIERO NEL TOMO
              </span>
              <button
                type="button"
                onClick={() => setIsTrascriviModalOpen(false)}
                className="text-content-3 hover:text-content-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTrascriviThoughtSubmit} className="space-y-4">
              {/* Visibility selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block">
                  Visibilità del Pensiero
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-serif">
                  <button
                    type="button"
                    onClick={() => setThoughtVisibility('personal')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      thoughtVisibility === 'personal'
                        ? 'bg-surface-3 text-content-1 border-primary font-semibold'
                        : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                    }`}
                  >
                    <Lock size={12} className="text-amber-400" />
                    <span>Personale (Privato)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThoughtVisibility('party')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      thoughtVisibility === 'party'
                        ? 'bg-surface-3 text-primary border-primary font-semibold'
                        : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                    }`}
                  >
                    <Globe size={12} className="text-emerald-400" />
                    <span>Visibile alla Compagnia</span>
                  </button>
                </div>
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block">
                  Titolo del Pensiero o Presagio
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Sospetto sulle rovine antiche..."
                  value={thoughtTitle}
                  onChange={(e) => setThoughtTitle(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl px-3.5 py-2 text-xs font-serif outline-none focus:border-primary"
                />
              </div>

              {/* Content textarea */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-serif tracking-wider text-content-3 block">
                  Riflessioni & Dettagli
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Quale indizio, timore o intuizione vuoi annotare nella cronaca del personaggio?"
                  value={thoughtContent}
                  onChange={(e) => setThoughtContent(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl p-3.5 text-xs font-serif leading-relaxed outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setIsTrascriviModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs font-serif cursor-pointer transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingThought || (!thoughtTitle.trim() && !thoughtContent.trim())}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-surface-0 rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Save size={13} />
                  <span>{isSubmittingThought ? 'Salvataggio...' : 'Incidi nel Tomo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PARTY BOND EDITING (ATTITUDE & TRUST BAR)                           */}
      {/* ========================================================================= */}
      {editingPartyBond && (
        <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-1 border border-surface-2 rounded-2xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <div>
                <h3 className="text-sm font-serif font-bold text-content-1">
                  Legame con {editingPartyBond.targetCharacterName}
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-content-3 font-serif">
                  Compagno di Compagnia
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingPartyBond(null)}
                className="text-content-3 hover:text-content-1 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-serif">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-content-3 block mb-1">
                  Natura del Legame
                </label>
                <input
                  type="text"
                  value={editingPartyBond.relationType}
                  onChange={(e) =>
                    setEditingPartyBond({ ...editingPartyBond, relationType: e.target.value })
                  }
                  placeholder="es. Fratello d'arme, Rivale rispettato..."
                  className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl px-3 py-2 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-content-3 block mb-1">
                  Atteggiamento Reciproco
                </label>
                <select
                  value={editingPartyBond.attitude}
                  onChange={(e) =>
                    setEditingPartyBond({
                      ...editingPartyBond,
                      attitude: e.target.value as RelationAttitude,
                    })
                  }
                  className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl px-3 py-2 outline-none focus:border-primary cursor-pointer"
                >
                  {Object.entries(ATTITUDE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-content-3 uppercase">Livello di Fiducia (Scala da 1 a 10)</span>
                  <span className="font-bold font-mono text-primary text-sm px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    {normalizeTrust(editingPartyBond.trustLevel)} / 10
                  </span>
                </div>
                {/* 1 to 10 selector buttons */}
                <div className="grid grid-cols-10 gap-1 mb-2">
                  {Array.from({ length: 10 }, (_, i) => {
                    const val = i + 1;
                    const isSelected = normalizeTrust(editingPartyBond.trustLevel) === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          setEditingPartyBond({
                            ...editingPartyBond,
                            trustLevel: val,
                          })
                        }
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-primary text-surface-0 shadow-md scale-105'
                            : 'bg-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-3 border border-surface-3'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={normalizeTrust(editingPartyBond.trustLevel)}
                  onChange={(e) =>
                    setEditingPartyBond({
                      ...editingPartyBond,
                      trustLevel: Number(e.target.value),
                    })
                  }
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-content-3 block mb-1">
                  Appunti sul Legame & Eventi Condivisi
                </label>
                <textarea
                  rows={3}
                  value={editingPartyBond.notes}
                  onChange={(e) =>
                    setEditingPartyBond({ ...editingPartyBond, notes: e.target.value })
                  }
                  placeholder="Cosa pensi davvero di questo compagno? Quale debito o promessa vi unisce?"
                  className="w-full bg-surface-2 border border-surface-3 text-content-1 rounded-xl p-3 leading-relaxed outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setEditingPartyBond(null)}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSavePartyBond}
                  className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl font-bold cursor-pointer"
                >
                  Salva Legame
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RELATION MODAL: FAMILY & WORLD NPCS                                       */}
      {/* ========================================================================= */}
      {relationModalOpen && (
        <RelationModal
          isOpen={relationModalOpen}
          onClose={() => {
            setRelationModalOpen(false);
            setEditingRelation(null);
          }}
          playerId={player._id}
          currentPlayerName={displayName}
          initialData={editingRelation}
          existingRelations={familyRelations}
          defaultMode={
            editingRelation
              ? editingRelation.generationCategory === 'connections' ||
                ['companion', 'mentor', 'ally', 'rival', 'enemy', 'custom'].includes(
                  editingRelation.relationshipType || ''
                )
                ? 'npc'
                : 'family'
              : legamiFilter === 'npc'
              ? 'npc'
              : 'family'
          }
          onSave={async (savedRelation) => {
            try {
              const all = CampaignManager.getAllFamilyRelations();
              const exists =
                all.some((r) => r.id === savedRelation.id) ||
                Boolean(editingRelation?.id && all.some((r) => r.id === editingRelation.id));

              if (exists) {
                await CampaignManager.updateFamilyRelation(savedRelation);
              } else {
                await CampaignManager.addFamilyRelation(savedRelation);
              }

              // Also if bio had a relationships array
              if (characterBio && Array.isArray((characterBio as any).relationships)) {
                const bioRels = (characterBio as any).relationships;
                const idx = bioRels.findIndex(
                  (br: any) =>
                    br.id === savedRelation.id ||
                    (editingRelation?.id && br.id === editingRelation.id)
                );
                if (idx !== -1) {
                  const updatedBioRels = [...bioRels];
                  updatedBioRels[idx] = { ...updatedBioRels[idx], ...savedRelation };
                  const updatedBio = {
                    ...characterBio,
                    relationships: updatedBioRels,
                  };
                  await CampaignManager.saveCharacterBio(updatedBio);
                  onBioUpdated(updatedBio);
                }
              }

              const updatedRels = CampaignManager.getFamilyRelations(player._id);
              setFamilyRelations(updatedRels);
              onBioUpdated(characterBio || { playerId: player._id });
            } catch (err) {
              console.error('Error saving relation:', err);
            } finally {
              setRelationModalOpen(false);
              setEditingRelation(null);
            }
          }}
        />
      )}
    </div>
  );
}
