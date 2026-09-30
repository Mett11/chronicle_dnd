import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Crown,
  Heart,
  Sparkles,
  Shield,
  Compass,
  Swords,
  Flame,
  User,
  Search,
  ExternalLink,
  Edit3,
  Trash2,
  X,
  Skull,
  HelpCircle,
  Link as LinkIcon,
  GitBranch,
  Layers,
  Lock,
  Globe,
  Eye,
} from 'lucide-react';
import {
  CharacterRelationship,
  GenerationCategory,
  GenealogyRole,
  Player,
  Entity,
  CharacterSectionPrivacy,
} from '../../types';
import { CampaignManager } from '../../store/campaignStore';
import { RelationModal } from './RelationModal';
import { ConfirmModal } from '../ConfirmModal';
import { VisualFamilyTree } from './VisualFamilyTree';
import { Portal } from '../Portal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

interface CharacterFamilyTreeTabProps {
  player: Player;
  isOtherPlayerView?: boolean;
  privacySettings?: CharacterSectionPrivacy;
  onPrivacyUpdated?: (updated: CharacterSectionPrivacy) => void;
}

type FilterCategory = 'all' | 'family' | 'ancestors' | 'connections' | 'rivals' | 'party';
type ViewMode = 'tree' | 'grid';

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
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');

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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRelationForEdit, setSelectedRelationForEdit] = useState<CharacterRelationship | null>(null);
  const [initialGenerationTier, setInitialGenerationTier] = useState<GenerationCategory | null>(null);
  const [initialGenealogyRole, setInitialGenealogyRole] = useState<GenealogyRole | null>(null);
  const [initialSideOfFamily, setInitialSideOfFamily] = useState<'paternal' | 'maternal' | 'direct' | 'unspecified' | null>(null);
  const [selectedRelationForDetail, setSelectedRelationForDetail] = useState<CharacterRelationship | null>(null);
  const [relationToDelete, setRelationToDelete] = useState<CharacterRelationship | null>(null);

  const loadData = () => {
    let rels = CampaignManager.getFamilyRelations(player._id);
    if (isReadOnly) {
      rels = rels.filter((r) => r.sharedWithParty !== false);
    }
    setRelations(rels);
    setEntities(CampaignManager.getEntities());
    setAllPlayers(CampaignManager.getPlayers());
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

  const handleSaveRelation = (relation: CharacterRelationship) => {
    if (isReadOnly) return;
    const exists = relations.some((r) => r.id === relation.id);
    if (exists || selectedRelationForEdit) {
      CampaignManager.updateFamilyRelation(relation);
    } else {
      CampaignManager.addFamilyRelation(relation);
    }
    loadData();
    if (selectedRelationForDetail?.id === relation.id) {
      setSelectedRelationForDetail(relation);
    }
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

  const handleDeleteRelation = () => {
    if (isReadOnly) return;
    if (!relationToDelete) return;
    CampaignManager.deleteFamilyRelation(relationToDelete.id);
    if (selectedRelationForDetail?.id === relationToDelete.id) {
      setSelectedRelationForDetail(null);
    }
    setRelationToDelete(null);
    loadData();
  };

  const handleAddMemberSlot = (
    role: GenealogyRole,
    side: 'paternal' | 'maternal' | 'direct' | 'unspecified',
    category: GenerationCategory
  ) => {
    if (isReadOnly) return;
    setSelectedRelationForEdit(null);
    setInitialGenealogyRole(role);
    setInitialSideOfFamily(side);
    setInitialGenerationTier(category);
    setIsModalOpen(true);
  };

  // Filter and search relations for grid / catalog view
  const filteredRelations = relations.filter((r) => {
    const matchesSearch =
      !searchQuery.trim() ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.titleOrRole?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customRelationshipLabel?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeFilter) {
      case 'family':
        return [
          'parent',
          'ancestor',
          'sibling',
          'spouse',
          'child',
          'descendant',
        ].includes(r.relationshipType);
      case 'ancestors':
        return r.generationCategory === 'ancestors' || r.generationCategory === 'parents';
      case 'connections':
        return r.relationshipType === 'mentor' || r.relationshipType === 'ally';
      case 'rivals':
        return r.relationshipType === 'rival' || r.relationshipType === 'enemy';
      case 'party':
        return r.relationshipType === 'companion' || !!r.linkedPlayerId;
      default:
        return true;
    }
  });

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
          label: 'Compagno di Party',
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
          label: 'Rivale d\'Onore',
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
                    className={`text-xs font-medium flex items-center gap-1 ${
                      getStatusBadge(selectedRelationForDetail.status).color
                    }`}
                  >
                    {getStatusBadge(selectedRelationForDetail.status).icon}
                    <span>{getStatusBadge(selectedRelationForDetail.status).label}</span>
                  </span>

                  {/* Setting Visibilità Party sui singoli componenti */}
                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={() => handleToggleRelationPrivacy(selectedRelationForDetail)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                        selectedRelationForDetail.sharedWithParty !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                      title={
                        selectedRelationForDetail.sharedWithParty !== false
                          ? 'Visibile al Party (clicca per rendere privato/segreto)'
                          : 'Riservato (clicca per mostrare al Party)'
                      }
                    >
                      {selectedRelationForDetail.sharedWithParty !== false ? <Eye size={11} /> : <Lock size={11} />}
                      <span>{selectedRelationForDetail.sharedWithParty !== false ? 'Visibile al Party' : 'Solo Personale (Privato)'}</span>
                    </button>
                  ) : (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md border flex items-center gap-1 ${
                        selectedRelationForDetail.sharedWithParty !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {selectedRelationForDetail.sharedWithParty !== false ? <Eye size={11} /> : <Lock size={11} />}
                      <span>{selectedRelationForDetail.sharedWithParty !== false ? 'Visibile al Party' : 'Privato'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRelationForDetail(null)}
              className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Backstory & Narrative Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-content-3 uppercase tracking-wider">
              Storia, Origini &amp; Legame con il Personaggio
            </h4>
            <div className="bg-surface-2/40 border border-surface-3 p-4 rounded-xl text-xs sm:text-sm text-content-1 leading-relaxed whitespace-pre-line max-h-48 sm:max-h-56 overflow-y-auto custom-scrollbar">
              {selectedRelationForDetail.bio || (
                <span className="text-content-3 italic">
                  Nessuna storia o nota inserita per questo membro. Clicca &ldquo;Modifica&rdquo; per aggiungere dettagli.
                </span>
              )}
            </div>
          </div>

          {/* Linked Entity / Party PG shortcut */}
          {(selectedRelationForDetail.linkedEntityId || selectedRelationForDetail.linkedPlayerId) && (
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-content-1">
                <LinkIcon size={14} className="text-primary shrink-0" />
                <span className="truncate">
                  {selectedRelationForDetail.linkedEntityId
                    ? 'Collegato a un NPC / Voce del Codex'
                    : 'Collegato a un Personaggio Giocatore del Party'}
                </span>
              </div>

              {selectedRelationForDetail.linkedEntityId && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/entities/${selectedRelationForDetail.linkedEntityId}`);
                  }}
                  className="px-3 py-1 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <ExternalLink size={12} />
                  <span>Apri nel Codex</span>
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-surface-2">
            {!isReadOnly ? (
              <button
                type="button"
                onClick={() => {
                  const toDelete = selectedRelationForDetail;
                  setSelectedRelationForDetail(null);
                  setRelationToDelete(toDelete);
                }}
                className="px-3.5 py-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Elimina
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selectedRelationForDetail;
                    setSelectedRelationForDetail(null);
                    setSelectedRelationForEdit(toEdit);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={14} /> Modifica
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRelationForDetail(null)}
                className="px-4 py-2 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header & Main Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 border border-surface-2 p-5 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-heading font-bold text-content-1 flex items-center gap-2">
                Genealogia &amp; Rete di Relazioni
              </h2>
              {onPrivacyUpdated && (
                <button
                  type="button"
                  onClick={handleToggleFamilyPrivacy}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                    isFamilyTreeShared
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                  }`}
                  title={
                    isFamilyTreeShared
                      ? 'Visibile al Party (clicca per rendere privato)'
                      : 'Privato (clicca per mostrare al Party)'
                  }
                >
                  {isFamilyTreeShared ? <Globe size={11} /> : <Lock size={11} />}
                  <span>{isFamilyTreeShared ? 'Party: Visibile' : 'Party: Nascosto'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-content-3 mt-0.5">
              Albero di sangue a doppia linea (paterno e materno), cerchia di fratellanza, eredi e catalogo legami
            </p>
          </div>
        </div>

        {/* View Mode Switcher + Add Button */}
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap overflow-x-auto custom-scrollbar">
          <div className="flex items-center bg-surface-2 p-1 rounded-2xl border border-surface-3 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                viewMode === 'tree'
                  ? 'bg-primary text-surface-0 shadow-xs'
                  : 'text-content-2 hover:text-content-1'
              }`}
            >
              <GitBranch size={14} />
              <span>Albero Genealogico</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                viewMode === 'grid'
                  ? 'bg-primary text-surface-0 shadow-xs'
                  : 'text-content-2 hover:text-content-1'
              }`}
            >
              <Layers size={14} />
              <span>Schede Catalogo</span>
            </button>
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setSelectedRelationForEdit(null);
                setInitialGenerationTier(null);
                setInitialGenealogyRole(null);
                setInitialSideOfFamily(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-2xl text-xs font-semibold shadow-md transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Aggiungi Membro</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: FAITHFUL DUAL-LINEAGE PEDIGREE FAMILY TREE */}
      {viewMode === 'tree' && (
        <VisualFamilyTree
          player={player}
          relations={relations}
          onSelectRelation={(rel) => setSelectedRelationForDetail(rel)}
          onAddMemberSlot={handleAddMemberSlot}
          onToggleRelationPrivacy={handleToggleRelationPrivacy}
          isReadOnly={isReadOnly}
        />
      )}

      {/* VIEW 2: CATALOG & CARDS VIEW */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-3 rounded-2xl">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-primary text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Tutti ({relations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('family')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'family'
                    ? 'bg-amber-500 text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Famiglia di Sangue
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('ancestors')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'ancestors'
                    ? 'bg-amber-600 text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Antenati &amp; Genitori
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('connections')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'connections'
                    ? 'bg-cyan-500 text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Alleati &amp; Mentori
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('rivals')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'rivals'
                    ? 'bg-rose-500 text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Rivali &amp; Nemici
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('party')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'party'
                    ? 'bg-purple-500 text-surface-0'
                    : 'bg-surface-2 text-content-2 hover:bg-surface-3'
                }`}
              >
                Party PG
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Cerca nome o relazione..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl pl-9 pr-3 py-1.5 text-xs text-content-1 outline-none transition-colors"
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

          {filteredRelations.length === 0 ? (
            <div className="bg-surface-1 border border-surface-2 rounded-2xl p-12 text-center space-y-3">
              <GitBranch size={36} className="mx-auto text-content-3 opacity-40" />
              <h3 className="font-heading text-base font-semibold text-content-1">
                Nessun membro o legame trovato
              </h3>
              <p className="text-xs text-content-3 max-w-md mx-auto">
                {isReadOnly
                  ? 'Il personaggio non ha ancora condiviso membri della propria cerchia familiare o relazionale.'
                  : "Aggiungi genitori, nonni, fratelli, alleati, mentori o rivali per costruire l'albero genealogico e relazionale completo del tuo eroe."}
              </p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRelationForEdit(null);
                    setInitialGenerationTier(null);
                    setInitialGenealogyRole(null);
                    setInitialSideOfFamily(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-primary text-surface-0 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer mt-2"
                >
                  <Plus size={15} /> Aggiungi primo membro
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredRelations.map((rel) => {
                const badge = getRelationshipBadge(rel);
                const statusBadge = getStatusBadge(rel.status);

                return (
                  <div
                    key={rel.id}
                    onClick={() => setSelectedRelationForDetail(rel)}
                    className="group bg-surface-1 border border-surface-3 hover:border-primary rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Relationship Pill & Status & Quick Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${badge.color}`}
                        >
                          {badge.label}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${statusBadge.color}`}
                            title={`Stato: ${statusBadge.label}`}
                          >
                            {statusBadge.icon}
                            <span className="text-[10px]">{statusBadge.label}</span>
                          </span>

                          {/* Party Visibility toggle button */}
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={(e) => handleToggleRelationPrivacy(rel, e)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 transition-colors ${
                              isReadOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80 active:scale-95'
                            } ${
                              rel.sharedWithParty !== false
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                            title={
                              rel.sharedWithParty !== false
                                ? (isReadOnly ? 'Visibile al Party' : 'Visibile al Party (clicca per rendere privato/segreto)')
                                : (isReadOnly ? 'Riservato' : 'Riservato/Segreto (clicca per condividere col Party)')
                            }
                          >
                            {rel.sharedWithParty !== false ? <Eye size={10} /> : <Lock size={10} />}
                            <span>{rel.sharedWithParty !== false ? 'Party' : 'Privato'}</span>
                          </button>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelationToDelete(rel);
                              }}
                              className="p-1 rounded-lg text-content-3/60 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer ml-1"
                              title="Rimuovi legame da scheda e Codex"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Avatar and Main Info */}
                      <div className="flex items-start gap-3">
                        {rel.avatarUrl ? (
                          <img
                            src={rel.avatarUrl}
                            alt={rel.name}
                            className="w-12 h-12 rounded-xl object-cover border border-surface-3 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-surface-3 flex items-center justify-center text-content-3 group-hover:text-primary transition-colors shrink-0 shadow-xs">
                            <User size={22} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h4 className="font-heading font-bold text-sm text-content-1 group-hover:text-primary transition-colors truncate">
                            {rel.name}
                          </h4>
                          {rel.titleOrRole ? (
                            <p className="text-xs text-content-3 truncate">{rel.titleOrRole}</p>
                          ) : (
                            <p className="text-xs text-content-3/60 italic">Nessun titolo</p>
                          )}
                        </div>
                      </div>

                      {/* Bio Preview */}
                      {rel.bio && (
                        <p className="text-xs text-content-2/80 line-clamp-2 mt-3 text-left leading-relaxed">
                          {rel.bio}
                        </p>
                      )}
                    </div>

                    {/* Footer Cross Links */}
                    {(rel.linkedEntityId || rel.linkedPlayerId) && (
                      <div className="mt-3 pt-2.5 border-t border-surface-2 flex items-center justify-between text-[11px]">
                        <span className="text-content-3">Collegamento:</span>
                        <div className="flex items-center gap-1">
                          {rel.linkedEntityId && (
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 font-medium">
                              <LinkIcon size={10} /> Codex
                            </span>
                          )}
                          {rel.linkedPlayerId && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 font-medium">
                              <Shield size={10} /> Party PG
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
      />

      {/* DELETE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!relationToDelete}
        onCancel={() => setRelationToDelete(null)}
        onConfirm={handleDeleteRelation}
        title="Elimina Membro o Legame"
        message={
          relationToDelete?.linkedEntityId
            ? `Sei sicuro di voler rimuovere "${relationToDelete?.name}"? Il legame verrà eliminato sia dalla scheda del personaggio sia dalla matrice del Codex dell'entità.`
            : `Sei sicuro di voler rimuovere "${relationToDelete?.name}" dall'albero genealogico e relazionale?`
        }
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        isDestructive
      />
    </div>
  );
}
