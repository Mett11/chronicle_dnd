import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  Crown,
  Heart,
  Shield,
  Swords,
  User,
  Search,
  Edit3,
  Trash2,
  X,
  Skull,
  HelpCircle,
  Link as LinkIcon,
  Lock,
  Globe,
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Compass,
  Flame,
  BookOpen,
  Loader2,
} from 'lucide-react';
import {
  CharacterRelationship,
  GenerationCategory,
  GenealogyRole,
  Player,
  Entity,
  CharacterSectionPrivacy,
  CharacterBio,
  InterPartyRelation,
  RelationAttitude,
} from '../../types';
import { CampaignManager } from '../../store/campaignStore';
import { RelationModal } from './RelationModal';
import { ConfirmModal } from '../ConfirmModal';
import { Portal } from '../Portal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

interface CharacterFamilyTreeTabProps {
  player: Player;
  isOtherPlayerView?: boolean;
  privacySettings?: CharacterSectionPrivacy;
  onPrivacyUpdated?: (updated: CharacterSectionPrivacy) => void;
}

type FilterCategory = 'all' | 'family' | 'party' | 'npc' | 'friendly' | 'hostile';

const ATTITUDE_CONFIGS: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  friendly: { label: 'Amichevole', emoji: '😄', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  helpful: { label: 'Disponibile', emoji: '🤝', badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  neutral: { label: 'Neutrale', emoji: '😐', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  suspicious: { label: 'Diffidente', emoji: '🤨', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  hostile: { label: 'Ostile', emoji: '😡', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  fearful: { label: 'Timoroso', emoji: '😨', badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  devoted: { label: 'Devoto', emoji: '👑', badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  rival: { label: 'Rivale', emoji: '⚔️', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
};

interface UnifiedCardItem {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  color?: string;
  attitude: string;
  attitudeConfig: { label: string; emoji: string; badgeClass: string };
  trustLevel: number;
  bondLabel: string;
  bondBadgeColor: string;
  isFamily: boolean;
  isPg: boolean;
  status?: CharacterRelationship['status'];
  statusLabel?: string;
  notes?: string;
  linkedEntityId?: string;
  linkedPlayerId?: string;
  sharedWithParty?: boolean;
  rawRelation?: CharacterRelationship;
  rawPlayer?: Player;
}

export function CharacterFamilyTreeTab({
  player,
  isOtherPlayerView = false,
  privacySettings,
  onPrivacyUpdated,
}: CharacterFamilyTreeTabProps) {
  const navigate = useNavigate();
  const { player: currentPlayer } = useAuth();

  // Strict ownership check: only owner (or DM) can edit
  const isOwner = Boolean(
    currentPlayer &&
    player &&
    (currentPlayer._id === player._id || (Boolean(currentPlayer.email && player.email) && currentPlayer.email === player.email))
  );
  const isReadOnly = Boolean(isOtherPlayerView || !isOwner);

  const [relations, setRelations] = useState<CharacterRelationship[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [characterBio, setCharacterBio] = useState<CharacterBio | null>(() => CampaignManager.getCharacterBio(player._id));
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown "+ Aggiungi Legame"
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Privacy helpers
  const isFamilyTreeShared = privacySettings?.familyTree !== false;

  const handleToggleFamilyPrivacy = () => {
    if (!onPrivacyUpdated || isReadOnly) return;
    const nextSettings: CharacterSectionPrivacy = {
      ...privacySettings,
      familyTree: !isFamilyTreeShared,
    };
    onPrivacyUpdated(nextSettings);
  };

  // Modal states for RelationModal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [relationModalMode, setRelationModalMode] = useState<'family' | 'party' | 'npc'>('family');
  const [createdToast, setCreatedToast] = useState<{ name: string; entityId: string } | null>(null);
  const [creatingCodexIds, setCreatingCodexIds] = useState<string[]>([]);
  const [selectedRelationForEdit, setSelectedRelationForEdit] = useState<CharacterRelationship | null>(null);
  const [initialGenerationTier, setInitialGenerationTier] = useState<GenerationCategory | null>(null);
  const [initialGenealogyRole, setInitialGenealogyRole] = useState<GenealogyRole | null>(null);
  const [initialSideOfFamily, setInitialSideOfFamily] = useState<'paternal' | 'maternal' | 'direct' | 'unspecified' | null>(null);
  const [selectedRelationForDetail, setSelectedRelationForDetail] = useState<CharacterRelationship | null>(null);
  const [relationToDelete, setRelationToDelete] = useState<CharacterRelationship | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Party Bond Edit Modal
  const [partyBondModal, setPartyBondModal] = useState<{
    isOpen: boolean;
    targetPlayer: Player | null;
    attitude: RelationAttitude;
    trustLevel: number;
    relationType: string;
    notes: string;
  } | null>(null);

  const loadData = () => {
    let rels = CampaignManager.getFamilyRelations(player._id);
    if (isReadOnly) {
      rels = rels.filter((r) => r.sharedWithParty !== false);
    }
    setRelations(rels);
    setEntities(CampaignManager.getEntities());
    setAllPlayers(CampaignManager.getPlayers());
    setCharacterBio(CampaignManager.getCharacterBio(player._id));
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('chronicle_family_tree_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_family_tree_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
    };
  }, [player._id, isReadOnly]);

  const handleSaveRelation = async (relation: CharacterRelationship) => {
    if (isReadOnly) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const exists = relations.some((r) => r.id === relation.id);
      let res;
      if (exists || selectedRelationForEdit) {
        res = await CampaignManager.updateFamilyRelation(relation);
      } else {
        const addRes = await CampaignManager.addFamilyRelation(relation);
        res = { success: addRes.success, error: addRes.error };
      }
      if (res.success) {
        loadData();
        if (selectedRelationForDetail?.id === relation.id) {
          setSelectedRelationForDetail(relation);
        }
      } else {
        setSaveError(res.error || 'Errore durante il salvataggio su Supabase.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Errore di connessione cloud.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePartyBond = async (
    targetPlayerId: string,
    targetCharacterName: string,
    attitude: RelationAttitude,
    trustLevel: number,
    relationType: string,
    notes: string
  ) => {
    const currentBio = CampaignManager.getCharacterBio(player._id) || { playerId: player._id };
    const currentInter = { ...(currentBio.interPartyRelations || {}) };
    const existing = currentInter[targetPlayerId] || {
      targetPlayerId,
      targetCharacterName,
      attitude: 'neutral',
      trustLevel: 5,
    };

    currentInter[targetPlayerId] = {
      ...existing,
      targetCharacterName,
      attitude,
      trustLevel,
      relationType,
      notes,
      updatedAt: new Date().toISOString(),
    };

    const updatedBio: CharacterBio = {
      ...currentBio,
      interPartyRelations: currentInter,
    };

    CampaignManager.saveCharacterBio(updatedBio);
    setCharacterBio(updatedBio);
    setPartyBondModal(null);
    loadData();
  };

  const handleToggleRelationPrivacy = (rel: CharacterRelationship, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    if (e) e.stopPropagation();
    const updated: CharacterRelationship = {
      ...rel,
      sharedWithParty: rel.sharedWithParty === false ? true : false,
    };
    handleSaveRelation(updated);
  };

  const handleDeleteRelation = async () => {
    if (isReadOnly) return;
    if (!relationToDelete) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await CampaignManager.deleteFamilyRelation(relationToDelete.id);
      if (res.success) {
        if (selectedRelationForDetail?.id === relationToDelete.id) {
          setSelectedRelationForDetail(null);
        }
        setRelationToDelete(null);
        loadData();
      } else {
        setSaveError(res.error || 'Errore durante la cancellazione su Supabase.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Errore di connessione.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInCodex = async (card: UnifiedCardItem) => {
    if (!card.rawRelation) return;
    if (creatingCodexIds.includes(card.id)) return;

    // Check if an entity already exists with the same name or linked ID
    const cleanName = card.name.trim();
    const existingEnt = entities.find(
      (e) => (card.linkedEntityId && e._id === card.linkedEntityId) ||
             (e.name.trim().toLowerCase() === cleanName.toLowerCase())
    );

    setCreatingCodexIds((prev) => [...prev, card.id]);
    setIsSaving(true);
    try {
      let targetEntityId = existingEnt?._id;

      if (!targetEntityId) {
        const isFam = card.isFamily;
        const cleanBond = card.bondLabel.replace('👑', '').trim();
        const newEnt = CampaignManager.addEntity({
          name: cleanName,
          type: 'npc',
          status: card.status === 'deceased' ? 'dead' : card.status === 'missing' ? 'unknown' : 'alive',
          images: card.avatarUrl ? [card.avatarUrl] : [],
          aliases: [
            isFam ? 'Famiglia' : 'PNG',
            cleanBond,
            card.subtitle || undefined,
          ].filter(Boolean) as string[],
          progressNote: card.notes || `Legame con ${player.characterName}: ${cleanBond}`,
        });
        targetEntityId = newEnt._id;
      }

      if (targetEntityId) {
        const updatedRel: CharacterRelationship = {
          ...card.rawRelation,
          linkedEntityId: targetEntityId,
        };
        await CampaignManager.updateFamilyRelation(updatedRel);
        setCreatedToast({ name: card.name, entityId: targetEntityId });
        loadData();
        setTimeout(() => setCreatedToast(null), 6000);
      }
    } catch (err: any) {
      console.error('Failed to create/link entity in Codex:', err);
    } finally {
      setIsSaving(false);
      setCreatingCodexIds((prev) => prev.filter((id) => id !== card.id));
    }
  };

  const isFamilyRelation = (rel?: CharacterRelationship | null) => {
    if (!rel) return false;

    // Explicit non-family types
    const nonFamTypes = ['companion', 'mentor', 'ally', 'rival', 'enemy', 'custom'];
    if (nonFamTypes.includes(rel.relationshipType)) {
      return false;
    }

    // Non-family titles or roles (e.g. supervisore, mandante, referente, capitano, oste, ecc.)
    const titleLower = `${rel.customRelationshipLabel || ''} ${rel.titleOrRole || ''} ${rel.name || ''}`.toLowerCase();
    const nonFamKeywords = [
      'mandante', 'supervisore', 'capitano', 'maestro', 'mentore', 'contatto',
      'referente', 'alleato', 'nemico', 'rivale', 'datore', 'committente',
      'informatore', 'oste', 'locandiere', 'guardia', 'mercenario'
    ];
    if (nonFamKeywords.some((k) => titleLower.includes(k))) {
      return false;
    }

    // If it's linked to an entity in Codex and has no explicit family relationshipType
    const famTypes = ['parent', 'child', 'sibling', 'spouse', 'ancestor', 'descendant', 'relative'];
    if (rel.linkedEntityId && !famTypes.includes(rel.relationshipType)) {
      return false;
    }

    // Explicit family relationship types
    if (famTypes.includes(rel.relationshipType)) {
      return true;
    }

    // Explicit genealogical roles
    const explicitFamRoles = [
      'paternal_grandfather', 'paternal_grandmother', 'paternal_uncle', 'paternal_aunt',
      'paternal_uncle_in_law', 'paternal_aunt_in_law', 'paternal_cousin', 'paternal_ancestor',
      'maternal_grandfather', 'maternal_grandmother', 'maternal_uncle', 'maternal_aunt',
      'maternal_uncle_in_law', 'maternal_aunt_in_law', 'maternal_cousin', 'maternal_ancestor',
      'father', 'mother', 'guardian', 'stepfather', 'stepmother', 'father_in_law', 'mother_in_law',
      'sibling', 'brother', 'sister', 'half_brother', 'half_sister', 'brother_in_law', 'sister_in_law',
      'spouse', 'husband', 'wife', 'fiance', 'ex_spouse',
      'child', 'son', 'daughter', 'stepson', 'stepdaughter', 'son_in_law', 'daughter_in_law',
      'nephew', 'grandchild', 'descendant', 'grandson', 'granddaughter',
    ];
    if (rel.genealogyRole && explicitFamRoles.includes(rel.genealogyRole)) {
      return true;
    }

    // Italian family keywords
    const famKeywords = [
      'padre', 'madre', 'figlio', 'figlia', 'fratello', 'sorella', 'coniuge',
      'marito', 'moglie', 'nonno', 'nonna', 'antenato', 'avo', 'zio', 'zia',
      'cugino', 'cugina', 'nipote', 'parente'
    ];
    return famKeywords.some((k) => titleLower.includes(k));
  };

  const getRelationshipBadge = (rel: CharacterRelationship) => {
    if (rel.customRelationshipLabel) {
      return {
        label: rel.customRelationshipLabel,
        color: 'bg-primary/10 text-primary border-primary/20',
      };
    }
    switch (rel.relationshipType) {
      case 'ancestor':
        return {
          label: rel.sideOfFamily === 'paternal' ? 'Avo Paterno' : rel.sideOfFamily === 'maternal' ? 'Avo Materno' : 'Antenato',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'parent':
        return {
          label: rel.sideOfFamily === 'paternal' ? 'Padre / Linea Paterna' : rel.sideOfFamily === 'maternal' ? 'Madre / Linea Materna' : 'Genitore',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'sibling':
        return {
          label: 'Fratello / Sorella',
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      case 'spouse':
        return {
          label: 'Coniuge / Amore',
          color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
        };
      case 'child':
        return {
          label: 'Figlio / Figlia',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'descendant':
        return {
          label: 'Discendente / Nipote',
          color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        };
      case 'companion':
        return {
          label: "Compagno d'Armi",
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        };
      case 'mentor':
        return {
          label: 'Mentore / Guida',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        };
      case 'ally':
        return {
          label: 'Alleato Fedele',
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        };
      case 'rival':
        return {
          label: "Rivale d'Onore",
          color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        };
      case 'enemy':
        return {
          label: 'Arci-Nemico',
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        };
      default:
        return {
          label: 'Legame',
          color: 'bg-surface-2 text-content-2 border-surface-3',
        };
    }
  };

  const getStatusBadge = (status: CharacterRelationship['status']) => {
    switch (status) {
      case 'alive':
        return { label: 'In Vita', color: 'text-emerald-400', icon: <Heart size={12} /> };
      case 'deceased':
        return { label: 'Deceduto', color: 'text-rose-400', icon: <Skull size={12} /> };
      case 'missing':
        return { label: 'Disperso', color: 'text-amber-400', icon: <HelpCircle size={12} /> };
      case 'undead':
        return { label: 'Non-Morto', color: 'text-purple-400', icon: <Flame size={12} /> };
      default:
        return { label: 'Sconosciuto', color: 'text-content-3', icon: <HelpCircle size={12} /> };
    }
  };

  // Build the Unified List of Cards (Party PG + Family + World NPCs)
  const unifiedCards: UnifiedCardItem[] = useMemo(() => {
    const list: UnifiedCardItem[] = [];
    const otherPlayers = allPlayers.filter((p) => p._id !== player._id);

    // 1. Fellow Party Members
    otherPlayers.forEach((otherP) => {
      const partyRel = characterBio?.interPartyRelations?.[otherP._id];
      const matchingFam = relations.find((r) => r.linkedPlayerId === otherP._id);

      const isFam = isFamilyRelation(matchingFam);
      const trust = partyRel?.trustLevel ?? matchingFam?.trustLevel ?? 5;
      const rawAttitude = partyRel?.attitude || matchingFam?.attitude || 'neutral';
      const attConf = ATTITUDE_CONFIGS[rawAttitude] || ATTITUDE_CONFIGS.neutral;

      let bondText = "Compagno d'Armi";
      let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

      if (isFam && matchingFam) {
        bondText = `👑 ${matchingFam.customRelationshipLabel || matchingFam.titleOrRole || getRelationshipBadge(matchingFam).label}`;
        badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold';
      } else if (partyRel?.relationType) {
        bondText = partyRel.relationType;
      } else if (matchingFam) {
        bondText = matchingFam.customRelationshipLabel || matchingFam.titleOrRole || getRelationshipBadge(matchingFam).label;
      }

      list.push({
        id: `pg_${otherP._id}`,
        name: otherP.characterName,
        subtitle: 'Personaggio Giocante (Party)',
        avatarUrl: otherP.avatarUrl || matchingFam?.avatarUrl,
        color: otherP.color || '#3b82f6',
        attitude: rawAttitude,
        attitudeConfig: attConf,
        trustLevel: Math.max(1, Math.min(10, trust)),
        bondLabel: bondText,
        bondBadgeColor: badgeColor,
        isFamily: isFam,
        isPg: true,
        notes: partyRel?.notes || matchingFam?.bio,
        linkedPlayerId: otherP._id,
        linkedEntityId: matchingFam?.linkedEntityId,
        sharedWithParty: matchingFam ? matchingFam.sharedWithParty !== false : true,
        rawRelation: matchingFam,
        rawPlayer: otherP,
      });
    });

    // 2. Non-PG Relations (Family, Codex NPCs, Mentors, Rivals, etc.)
    relations.forEach((rel) => {
      if (rel.linkedPlayerId && otherPlayers.some((p) => p._id === rel.linkedPlayerId)) {
        return; // Already merged in PG card
      }

      const isFam = isFamilyRelation(rel);
      const matchedEntity = entities.find(
        (e) => (rel.linkedEntityId && e._id === rel.linkedEntityId) || e.name.toLowerCase().trim() === rel.name.toLowerCase().trim()
      );

      let defaultTrust = 5;
      if (rel.trustLevel !== undefined) {
        defaultTrust = rel.trustLevel;
      } else if (rel.relationshipType === 'enemy') {
        defaultTrust = 1;
      } else if (rel.relationshipType === 'rival') {
        defaultTrust = 3;
      } else if (rel.relationshipType === 'mentor' || rel.relationshipType === 'parent' || rel.relationshipType === 'spouse') {
        defaultTrust = 8;
      }

      let defaultAttitude = rel.attitude;
      if (!defaultAttitude) {
        if (rel.relationshipType === 'enemy' || rel.relationshipType === 'rival') {
          defaultAttitude = 'hostile';
        } else if (['mentor', 'ally', 'spouse', 'parent', 'child', 'sibling'].includes(rel.relationshipType)) {
          defaultAttitude = 'friendly';
        } else {
          defaultAttitude = 'neutral';
        }
      }

      const attConf = ATTITUDE_CONFIGS[defaultAttitude] || ATTITUDE_CONFIGS.neutral;
      const badgeInfo = getRelationshipBadge(rel);
      const bondText = isFam ? `👑 ${badgeInfo.label}` : badgeInfo.label;
      const badgeColor = isFam ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold' : badgeInfo.color;
      const stBadge = getStatusBadge(rel.status);

      list.push({
        id: `rel_${rel.id}`,
        name: rel.name,
        subtitle: rel.titleOrRole || (matchedEntity ? `Codex: ${matchedEntity.type.toUpperCase()}` : isFam ? 'Componente della Famiglia' : 'PNG del Mondo'),
        avatarUrl: rel.avatarUrl || matchedEntity?.images?.[0] || (matchedEntity as any)?.imageUrl,
        color: matchedEntity?.color || (isFam ? '#f59e0b' : '#10b981'),
        attitude: defaultAttitude,
        attitudeConfig: attConf,
        trustLevel: Math.max(1, Math.min(10, defaultTrust)),
        bondLabel: bondText,
        bondBadgeColor: badgeColor,
        isFamily: isFam,
        isPg: false,
        status: rel.status,
        statusLabel: stBadge.label,
        notes: rel.bio || (matchedEntity?.progressNote ? matchedEntity.progressNote.slice(0, 150) : ''),
        linkedEntityId: rel.linkedEntityId || matchedEntity?._id,
        sharedWithParty: rel.sharedWithParty !== false,
        rawRelation: rel,
      });
    });

    return list;
  }, [allPlayers, relations, characterBio, entities, player._id]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const total = unifiedCards.length;
    const family = unifiedCards.filter((c) => c.isFamily).length;
    const party = unifiedCards.filter((c) => c.isPg).length;
    const npc = unifiedCards.filter((c) => !c.isPg && !c.isFamily).length;
    const friendly = unifiedCards.filter((c) => c.attitude === 'friendly' || c.attitude === 'helpful' || c.attitude === 'devoted').length;
    const hostile = unifiedCards.filter((c) => c.attitude === 'hostile' || c.attitude === 'rival' || c.attitude === 'suspicious').length;
    return { total, family, party, npc, friendly, hostile };
  }, [unifiedCards]);

  // Filter & Search
  const filteredCards = useMemo(() => {
    return unifiedCards.filter((card) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesSub = card.subtitle?.toLowerCase().includes(q) || false;
        const matchesBond = card.bondLabel.toLowerCase().includes(q);
        const matchesNotes = card.notes?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesSub && !matchesBond && !matchesNotes) return false;
      }

      // Filter Category
      if (activeFilter === 'family') return card.isFamily;
      if (activeFilter === 'party') return card.isPg;
      if (activeFilter === 'npc') return !card.isPg && !card.isFamily;
      if (activeFilter === 'friendly') return card.attitude === 'friendly' || card.attitude === 'helpful' || card.attitude === 'devoted';
      if (activeFilter === 'hostile') return card.attitude === 'hostile' || card.attitude === 'rival' || card.attitude === 'suspicious';
      return true;
    });
  }, [unifiedCards, activeFilter, searchQuery]);

  // Pagination states & calculations
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Reset to page 1 on filter, search or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCards = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredCards.slice(startIndex, startIndex + pageSize);
  }, [filteredCards, safeCurrentPage, pageSize]);

  // Open Edit Action for a Card
  const handleOpenEdit = (item: UnifiedCardItem) => {
    if (isReadOnly) return;
    if (item.rawRelation) {
      setSelectedRelationForEdit(item.rawRelation);
      setIsModalOpen(true);
    } else if (item.rawPlayer) {
      const currentPartyRel = characterBio?.interPartyRelations?.[item.rawPlayer._id];
      setPartyBondModal({
        isOpen: true,
        targetPlayer: item.rawPlayer,
        attitude: currentPartyRel?.attitude || 'neutral',
        trustLevel: currentPartyRel?.trustLevel ?? 5,
        relationType: currentPartyRel?.relationType || "Compagno d'Armi",
        notes: currentPartyRel?.notes || '',
      });
    }
  };

  // Detail Modal Content
  const detailModalContent = selectedRelationForDetail ? (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        onClick={() => setSelectedRelationForDetail(null)}
      >
        <div
          className="bg-surface-1 border border-surface-2 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto shrink-0 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedRelationForDetail.avatarUrl ? (
                <img
                  src={selectedRelationForDetail.avatarUrl}
                  alt={selectedRelationForDetail.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-surface-3 shadow-md shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-surface-2 border-2 border-surface-3 flex items-center justify-center text-content-3 shrink-0">
                  <User size={30} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-heading font-extrabold text-lg text-content-1 truncate">
                  {selectedRelationForDetail.name}
                </h3>
                <p className="text-xs text-content-2 font-medium truncate">
                  {selectedRelationForDetail.titleOrRole || 'Nessun titolo specificato'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${
                      getRelationshipBadge(selectedRelationForDetail).color
                    }`}
                  >
                    {getRelationshipBadge(selectedRelationForDetail).label}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border border-surface-3 flex items-center gap-1 bg-surface-2 ${
                      getStatusBadge(selectedRelationForDetail.status).color
                    }`}
                  >
                    {getStatusBadge(selectedRelationForDetail.status).icon}
                    <span>{getStatusBadge(selectedRelationForDetail.status).label}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRelationForDetail(null)}
              className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {selectedRelationForDetail.bio ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-3">
                Storia, Legame &amp; Note
              </h4>
              <p className="text-xs text-content-2 leading-relaxed bg-surface-0/60 p-3.5 rounded-xl border border-surface-2/60 whitespace-pre-wrap">
                {selectedRelationForDetail.bio}
              </p>
            </div>
          ) : (
            <p className="text-xs text-content-3/80 italic bg-surface-0/40 p-3 rounded-xl border border-surface-2/40">
              Nessun appunto narrativo registrato per questa figura.
            </p>
          )}

          {!isReadOnly && (
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRelationForEdit(selectedRelationForDetail);
                  setSelectedRelationForDetail(null);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Modifica</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  ) : null;

  return (
    <div className="space-y-6">
      {/* HEADER: Title, Visibility & Unified "+ Aggiungi Legame" Pill */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 border border-surface-2 p-4 sm:p-5 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-content-1 truncate">
                Genealogia &amp; Rete di Relazioni
              </h2>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleToggleFamilyPrivacy}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                    isFamilyTreeShared
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                  }`}
                  title={isFamilyTreeShared ? 'Visibile al Party' : 'Privato'}
                >
                  {isFamilyTreeShared ? <Globe size={11} /> : <Lock size={11} />}
                  <span>{isFamilyTreeShared ? 'Party: Visibile' : 'Party: Nascosto'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-content-3 mt-0.5 truncate">
              Legami familiari, compagni di party, alleati e figure del mondo
            </p>
          </div>
        </div>

        {/* UNIFIED "+ AGGIUNGI LEGAME" PILL BUTTON */}
        {!isReadOnly && (
          <div className="relative shrink-0" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 rounded-2xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Aggiungi Legame</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAddMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface-1 border border-surface-2 rounded-2xl p-1.5 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setSelectedRelationForEdit(null);
                    setRelationModalMode('family');
                    setInitialGenerationTier('parents');
                    setInitialGenealogyRole('father');
                    setInitialSideOfFamily('direct');
                    setIsModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-500/10 hover:text-amber-300 text-content-1 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Crown size={14} />
                  </span>
                  <div>
                    <span className="block font-bold">Membro della Famiglia</span>
                    <span className="block text-[10px] text-content-3 font-normal">Genitore, Figlio, Coniuge, Fratello, Antenato</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setSelectedRelationForEdit(null);
                    setRelationModalMode('party');
                    setInitialGenerationTier('peers');
                    setInitialGenealogyRole(null);
                    setInitialSideOfFamily(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-500/10 hover:text-blue-300 text-content-1 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Shield size={14} />
                  </span>
                  <div>
                    <span className="block font-bold">Compagno del Party (PG)</span>
                    <span className="block text-[10px] text-content-3 font-normal">Alleanza o legame con un altro eroe</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setSelectedRelationForEdit(null);
                    setRelationModalMode('npc');
                    setInitialGenerationTier(null);
                    setInitialGenealogyRole(null);
                    setInitialSideOfFamily(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-300 text-content-1 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Compass size={14} />
                  </span>
                  <div>
                    <span className="block font-bold">PNG del Mondo / Codex</span>
                    <span className="block text-[10px] text-content-3 font-normal">Mentore, Alleato, Rivale, Nemico o Contatto</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOAST FEEDBACK FOR CODEX CREATION */}
      {createdToast && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-400 shrink-0" />
            <span>
              Scheda di <strong>{createdToast.name}</strong> creata con successo nel Codex!
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/entities?select=${createdToast.entityId}`)}
            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Apri nel Codex &rarr;
          </button>
        </div>
      )}

      {/* FILTER CHIPS & SEARCH */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-3 sm:p-4 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-primary text-surface-0 shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            Tutti ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('family')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'family'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-amber-400'
            }`}
          >
            <Crown size={13} className={activeFilter === 'family' ? 'text-amber-200' : 'text-amber-400'} />
            <span>Famiglia / Stirpe ({counts.family})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('party')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'party'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-blue-400'
            }`}
          >
            <Shield size={13} />
            <span>Party PG ({counts.party})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('npc')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'npc'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-emerald-400'
            }`}
          >
            <Compass size={13} />
            <span>PNG &amp; Mondo ({counts.npc})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('friendly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'friendly'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            <Heart size={13} className="text-emerald-400" />
            <span>Alleati ({counts.friendly})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('hostile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'hostile'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            <Swords size={13} className="text-rose-400" />
            <span>Rivali/Nemici ({counts.hostile})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Cerca nome o legame..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl pl-9 pr-8 py-1.5 text-xs text-content-1 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* CARDS GRID (FAITHFUL TO SCREENSHOT 2) */}
      {filteredCards.length === 0 ? (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-12 text-center space-y-3">
          <Users size={36} className="mx-auto text-content-3 opacity-40" />
          <h3 className="font-heading text-base font-semibold text-content-1">
            Nessuna relazione o membro trovato
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto">
            {isReadOnly
              ? 'Il personaggio non ha ancora condiviso figure della propria cerchia relazionale o familiare.'
              : 'Aggiungi genitori, fratelli, alleati, mentori o rivali per costruire le dinamiche del tuo eroe.'}
          </p>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setSelectedRelationForEdit(null);
                setInitialGenerationTier('parents');
                setInitialGenealogyRole('father');
                setInitialSideOfFamily('direct');
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-md"
            >
              <Plus size={14} />
              <span>Aggiungi il Primo Legame</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedCards.map((card) => (
              <div
                key={card.id}
                className="bg-surface-1/90 border border-surface-2 hover:border-surface-3 rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between space-y-3.5 group"
              >
              {/* TOP: Avatar, Name & Attitude badge */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {card.avatarUrl ? (
                    <img
                      src={card.avatarUrl}
                      alt={card.name}
                      className="w-10 h-10 rounded-full object-cover border border-surface-3 shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-sm text-surface-0 shrink-0 shadow-xs"
                      style={{ backgroundColor: card.color || '#6366f1' }}
                    >
                      {card.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading font-bold text-sm sm:text-base text-content-1 truncate group-hover:text-primary transition-colors">
                        {card.name}
                      </span>
                      {card.isFamily && (
                        <span title="Familiare" className="text-amber-400 shrink-0">
                          <Crown size={13} />
                        </span>
                      )}
                    </div>
                    {card.subtitle && (
                      <span className="text-[11px] text-content-3 block truncate">
                        {card.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Attitude Badge */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${card.attitudeConfig.badgeClass}`}>
                    <span>{card.attitudeConfig.emoji}</span>
                    <span>{card.attitudeConfig.label}</span>
                  </span>
                </div>
              </div>

              {/* MIDDLE: Trust Level + Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-content-3 font-medium">Livello di Fiducia:</span>
                  <span className="font-bold text-content-1">{card.trustLevel}/10</span>
                </div>
                <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"
                    style={{ width: `${Math.max(8, Math.min(100, (card.trustLevel / 10) * 100))}%` }}
                  />
                </div>
              </div>

              {/* BOTTOM: Bond Label & Status */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-2/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-content-3 font-medium">Legame:</span>
                  <span className={`font-bold truncate px-2 py-0.5 rounded-md text-[11px] border ${card.bondBadgeColor}`}>
                    {card.bondLabel}
                  </span>
                </div>

                {card.status && card.status !== 'alive' && (
                  <span className="text-[11px] text-content-3 flex items-center gap-1">
                    {card.status === 'deceased' ? <Skull size={11} className="text-rose-400" /> : <HelpCircle size={11} className="text-amber-400" />}
                    <span>{card.statusLabel}</span>
                  </span>
                )}
              </div>

              {/* NOTES / ANECDOTE SNIPPET */}
              {card.notes && (
                <p className="text-xs text-content-2/80 line-clamp-2 bg-surface-0/40 p-2.5 rounded-xl border border-surface-2/40 leading-relaxed italic">
                  "{card.notes}"
                </p>
              )}

              {/* CARD ACTIONS FOOTER */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-2/40 text-xs">
                {!isReadOnly ? (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(card)}
                    className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 size={12} className="text-amber-400" />
                    <span>Modifica / Assegna Ruolo</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-1">
                  {!isReadOnly && !card.linkedEntityId && !card.isPg && card.rawRelation && (
                    <button
                      type="button"
                      disabled={creatingCodexIds.includes(card.id) || isSaving}
                      onClick={() => handleCreateInCodex(card)}
                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Crea una scheda dedicata a questo personaggio nel Codex"
                    >
                      {creatingCodexIds.includes(card.id) ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <BookOpen size={11} />
                      )}
                      <span>{creatingCodexIds.includes(card.id) ? 'Creazione...' : '+ Codex'}</span>
                    </button>
                  )}

                  {card.rawRelation && (
                    <button
                      type="button"
                      onClick={() => setSelectedRelationForDetail(card.rawRelation!)}
                      className="px-2 py-1 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Dettagli
                    </button>
                  )}

                  {card.linkedEntityId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/entities?select=${card.linkedEntityId}`)}
                      className="p-1.5 text-content-3 hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-surface-2"
                      title="Vedi nel Codex"
                    >
                      <LinkIcon size={14} />
                    </button>
                  )}

                  {!isReadOnly && card.rawRelation && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleRelationPrivacy(card.rawRelation!, e)}
                      className="p-1.5 text-content-3 hover:text-content-1 transition-colors cursor-pointer rounded-lg hover:bg-surface-2"
                      title={card.sharedWithParty ? 'Visibile al party' : 'Privato'}
                    >
                      {card.sharedWithParty ? <Globe size={14} className="text-emerald-400" /> : <Lock size={14} className="text-amber-400" />}
                    </button>
                  )}

                  {!isReadOnly && card.rawRelation && (
                    <button
                      type="button"
                      onClick={() => setRelationToDelete(card.rawRelation!)}
                      className="p-1.5 text-content-3 hover:text-rose-400 transition-colors cursor-pointer rounded-lg hover:bg-rose-500/10"
                      title="Elimina figura"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PAGINATION CONTROLS BAR */}
        {filteredCards.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-3 sm:p-4 rounded-2xl">
            <div className="flex items-center gap-2.5 text-xs text-content-3 font-medium flex-wrap">
              <span>
                Mostrando <strong className="text-content-1">{(safeCurrentPage - 1) * pageSize + 1}</strong> -{' '}
                <strong className="text-content-1">
                  {Math.min(safeCurrentPage * pageSize, filteredCards.length)}
                </strong>{' '}
                di <strong className="text-content-1">{filteredCards.length}</strong> figure
              </span>
              <span className="text-surface-3">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per pagina:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-surface-2 border border-surface-3 rounded-lg px-2 py-0.5 text-xs text-content-1 outline-none cursor-pointer"
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-xl border border-surface-3 bg-surface-2 hover:bg-surface-3 text-content-1 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span className="hidden sm:inline">Precedente</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-content-3 text-xs">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            safeCurrentPage === p
                              ? 'bg-primary text-surface-0 shadow-xs'
                              : 'bg-surface-2 hover:bg-surface-3 text-content-2'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-xl border border-surface-3 bg-surface-2 hover:bg-surface-3 text-content-1 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">Successiva</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* DETAIL MODAL */}
      {detailModalContent}

      {/* ADD / EDIT RELATION MODAL */}
      <RelationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRelationForEdit(null);
          setInitialGenerationTier(null);
          setInitialGenealogyRole(null);
          setInitialSideOfFamily(null);
        }}
        onSave={handleSaveRelation}
        initialData={selectedRelationForEdit}
        initialGenerationTier={initialGenerationTier}
        initialGenealogyRole={initialGenealogyRole}
        initialSideOfFamily={initialSideOfFamily}
        playerId={player._id}
        currentPlayerName={player.characterName}
        existingRelations={relations}
        defaultMode={relationModalMode}
      />

      {/* PARTY BOND EDIT MODAL */}
      {partyBondModal && partyBondModal.isOpen && partyBondModal.targetPlayer && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setPartyBondModal(null)}
          >
            <div
              className="bg-surface-1 border border-surface-2 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-content-1">
                      Legame con {partyBondModal.targetPlayer.characterName}
                    </h3>
                    <p className="text-xs text-content-3">
                      Modifica atteggiamento, fiducia e legame con il compagno di party
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPartyBondModal(null)}
                  className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Attitude selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-content-2">Atteggiamento</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'friendly', label: 'Amichevole', emoji: '😄' },
                    { key: 'helpful', label: 'Disponibile', emoji: '🤝' },
                    { key: 'neutral', label: 'Neutrale', emoji: '😐' },
                    { key: 'suspicious', label: 'Diffidente', emoji: '🤨' },
                    { key: 'hostile', label: 'Ostile', emoji: '😡' },
                    { key: 'rival', label: 'Rivale', emoji: '⚔️' },
                  ].map((att) => (
                    <button
                      key={att.key}
                      type="button"
                      onClick={() => setPartyBondModal((prev) => prev ? { ...prev, attitude: att.key as RelationAttitude } : null)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        partyBondModal.attitude === att.key
                          ? 'bg-primary/20 text-primary border-primary shadow-xs'
                          : 'bg-surface-2 border-surface-3 text-content-3 hover:text-content-1'
                      }`}
                    >
                      <span>{att.emoji}</span>
                      <span>{att.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-content-2">Livello di Fiducia</span>
                  <span className="font-mono font-bold text-primary">{partyBondModal.trustLevel}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={partyBondModal.trustLevel}
                  onChange={(e) => setPartyBondModal((prev) => prev ? { ...prev, trustLevel: Number(e.target.value) } : null)}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-200"
                    style={{ width: `${(partyBondModal.trustLevel / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Relation Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content-2">Tipo di Legame</label>
                <input
                  type="text"
                  value={partyBondModal.relationType}
                  onChange={(e) => setPartyBondModal((prev) => prev ? { ...prev, relationType: e.target.value } : null)}
                  placeholder="es. Compagno d'Armi, Fratello d'armi, Debito di vita..."
                  className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-xs text-content-1 outline-none transition-colors"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content-2">Note &amp; Aneddoti</label>
                <textarea
                  rows={2}
                  value={partyBondModal.notes}
                  onChange={(e) => setPartyBondModal((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Note sul vostro rapporto o cosa pensi di lui..."
                  className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-2.5 text-xs text-content-1 outline-none transition-colors resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setPartyBondModal(null)}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSavePartyBond(
                      partyBondModal.targetPlayer!._id,
                      partyBondModal.targetPlayer!.characterName,
                      partyBondModal.attitude,
                      partyBondModal.trustLevel,
                      partyBondModal.relationType,
                      partyBondModal.notes
                    )
                  }
                  className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-semibold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={13} />
                  <span>Salva Legame</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!relationToDelete}
        title="Rimuovi Figura"
        message={`Sei sicuro di voler rimuovere "${relationToDelete?.name}" dalle relazioni? L'operazione sincronizzerà la rimozione anche su Supabase.`}
        confirmLabel="Rimuovi"
        isDestructive={true}
        onConfirm={handleDeleteRelation}
        onCancel={() => setRelationToDelete(null)}
      />
    </div>
  );
}
