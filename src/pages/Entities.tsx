import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { RichTextEditor } from '../components/RichTextEditor';
import { MentionInput } from '../components/MentionInput';
import { EntityMentionText } from '../components/EntityMentionText';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Entity, WorldMap as WorldMapType, MapFolder, EntityPartyRelation, EntityToEntityRelation, EntitySecretItem, TimelineMemoryEntry, EvolvingBelief, RelationMilestone, RelationAttitude } from '../types';
import {
  Users,
  Ghost,
  MapPin,
  Tag,
  Sparkles,
  Plus,
  X,
  Search,
  Shield,
  User,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Map as MapIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  BookMarked,
  BookOpen,
  Layers,
  Compass,
  Globe,
  Skull,
  Landmark,
  Scroll,
  Crown,
  Flame,
  Swords,
  Folder as FolderIcon,
  FolderPlus,
  Lock,
  Unlock,
  EyeOff,
  ArrowUpDown,
  MessageSquare,
  Bot,
  ChevronDown,
  ChevronUp,
  Brain,
  Clock,
} from 'lucide-react';
import { ImageGalleryUploader } from '../components/ImageGalleryUploader';
import { motion, AnimatePresence } from 'framer-motion';
import { Portal } from '../components/Portal';
import { Pagination } from '../components/Pagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { OcrButton } from '../components/OcrButton';

const ITEMS_PER_PAGE = 12;

export interface CategoryMeta {
  id: Entity['type'];
  title: string;
  singular: string;
  shortDesc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  heraldicIcon: React.ComponentType<{ size?: number; className?: string }>;
  heraldicSigil: string;
  defaultStatus: Entity['status'];
  color: string;
  bgGlow: string;
}

export const CATEGORY_DEFINITIONS: Record<Entity['type'], CategoryMeta> = {
  npc: {
    id: 'npc',
    title: 'NPC & Alleati',
    singular: 'NPC / Alleato',
    shortDesc: 'Personaggi non giocanti, alleati, mentori, informatori e figure di spicco incontrate.',
    icon: Users,
    heraldicIcon: Crown,
    heraldicSigil: 'Sigillum Personarum',
    defaultStatus: 'alive',
    color: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  monster: {
    id: 'monster',
    title: 'Bestiario & Mostri',
    singular: 'Mostro / Nemico',
    shortDesc: 'Creature leggendarie, aberrazioni, mostri feroci e nemici affrontati durante i viaggi.',
    icon: Ghost,
    heraldicIcon: Skull,
    heraldicSigil: 'Bestiarium & Monstra',
    defaultStatus: 'alive',
    color: 'text-rose-400',
    bgGlow: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  place: {
    id: 'place',
    title: 'Luoghi & Mappe',
    singular: 'Luogo / Mappa',
    shortDesc: 'Città, fortezze, rovine antiche, dungeon e toponomastica del reame.',
    icon: MapPin,
    heraldicIcon: Landmark,
    heraldicSigil: 'Topographia Regni',
    defaultStatus: 'alive',
    color: 'text-sky-400',
    bgGlow: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  quest: {
    id: 'quest',
    title: 'Missioni & Obiettivi',
    singular: 'Obiettivo / Quest',
    shortDesc: 'Incarichi del gruppo, contratti mercenari e trame personali dei singoli eroi.',
    icon: Tag,
    heraldicIcon: Scroll,
    heraldicSigil: 'Acta & Gesta Viatorii',
    defaultStatus: 'open',
    color: 'text-amber-400',
    bgGlow: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  item: {
    id: 'item',
    title: 'Oggetti & Reliquie',
    singular: 'Oggetto / Reliquia',
    shortDesc: 'Artefatti magici, tomi proibiti, equipaggiamento leggendario e ricompense.',
    icon: Sparkles,
    heraldicIcon: Flame,
    heraldicSigil: 'Thesaurus & Reliquiae',
    defaultStatus: 'alive',
    color: 'text-purple-400',
    bgGlow: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  faction: {
    id: 'faction',
    title: 'Fazioni & Gilde',
    singular: 'Fazione / Gilda',
    shortDesc: 'Gilde di ladri, ordini cavallereschi, casate nobiliari, culti e alleanze politiche.',
    icon: Shield,
    heraldicIcon: Swords,
    heraldicSigil: 'Ordines & Foedera',
    defaultStatus: 'alive',
    color: 'text-indigo-400',
    bgGlow: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
};

const CATEGORIES_LIST: CategoryMeta[] = Object.values(CATEGORY_DEFINITIONS);

/**
 * Animated High-Contrast Dither Grain Canvas Shader
 * Renders an organic pixel-dithered gradient in the exact user theme accent color on hover
 * Works seamlessly in both Dark Mode and Light Mode
 */
const TomeGrainCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = 160);
    const height = (canvas.height = 240);
    let frame = 0;

    const render = () => {
      frame++;
      if (frame % 2 === 0) {
        const comp = window.getComputedStyle(canvas);
        const rawColor = comp.getPropertyValue('--color-primary').trim() || '#ba78ff';
        const isLight = document.documentElement.classList.contains('light') || 
                        document.body.classList.contains('light') || 
                        document.documentElement.getAttribute('data-theme')?.includes('light');

        // Parse theme color into RGB
        let r = 186,
          g = 120,
          b = 255;
        if (rawColor.startsWith('#')) {
          const hex = rawColor.replace('#', '');
          if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
          } else if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
          }
        } else if (rawColor.startsWith('rgb')) {
          const parts = rawColor.match(/\d+/g);
          if (parts && parts.length >= 3) {
            r = parseInt(parts[0], 10);
            g = parseInt(parts[1], 10);
            b = parseInt(parts[2], 10);
          }
        }

        const r2 = Math.round(r * 0.14);
        const g2 = Math.round(g * 0.08);
        const b2 = Math.round(b * 0.18);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (let y = 0; y < height; y++) {
          const ny = y / height;
          for (let x = 0; x < width; x++) {
            const nx = x / width;

            // Diagonal gradient matching user reference image
            const base = 1 - (nx * 0.7 + ny * 0.6);
            const noise = (Math.random() - 0.5) * 0.72;
            const factor = Math.max(0, Math.min(1, base + noise));

            const idx = (y * width + x) * 4;
            if (isLight) {
              // Light mode: theme primary dither grain over clean transparency
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = Math.round(factor * 180);
            } else {
              // Dark mode: glowing dither grain over deep midnight tone
              data[idx] = Math.round(r2 + (r - r2) * factor);
              data[idx + 1] = Math.round(g2 + (g - g2) * factor);
              data[idx + 2] = Math.round(b2 + (b - b2) * factor);
              data[idx + 3] = Math.round(Math.min(255, factor * 255 * 1.05));
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-0 group-hover:opacity-95 transition-opacity duration-500 rounded-[3px] dark:mix-blend-screen mix-blend-multiply"
    />
  );
};

const ALL_CATEGORY_CONFIG = {
  id: 'all',
  title: 'Tutti i Registri',
  singular: 'Voce',
  plural: 'Tutte le Voci',
  icon: BookOpen,
  heraldicIcon: Sparkles,
  heraldicSigil: 'OMNIA',
  color: 'text-primary',
  accentBg: 'bg-primary/10',
  description: 'Visualizzazione panoramica di tutte le entità custodite nel Codex di Campagna.',
  defaultStatus: 'active' as Entity['status'],
};

export function Entities() {
  const { type, id: routeId } = useParams<{ type?: string; id?: string }>();
  const navigate = useNavigate();

  // If type is valid category or 'all', we are in category view; otherwise in overview
  const isAll = type === 'all';
  const isOverview = !type;
  const activeType: Entity['type'] | 'all' = isAll ? 'all' : (type && CATEGORY_DEFINITIONS[type as Entity['type']] ? (type as Entity['type']) : 'npc');
  const activeCategory = isAll ? ALL_CATEGORY_CONFIG : CATEGORY_DEFINITIONS[activeType as Entity['type']];
  const ActiveIcon = activeCategory.icon;
  const ActiveHeraldicIcon = activeCategory.heraldicIcon;

  const { player, allPlayers } = useAuth();
  const [entities, setEntities] = useState<Entity[]>(() => CampaignManager.getEntities());
  const [maps, setMaps] = useState<WorldMapType[]>(() => CampaignManager.getMaps());
  const [folders, setFolders] = useState<MapFolder[]>(() => CampaignManager.getMapFolders());
  const [searchQuery, setSearchQuery] = useState('');
  const [isTabChanging, setIsTabChanging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [highlightedEntityId, setHighlightedEntityId] = useState<string | null>(null);

  // Detail inspection modal
  const [detailEntity, setDetailEntity] = useState<Entity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'alpha-asc' | 'alpha-desc' | 'recent'>('alpha-asc');
  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetAllCodex = () => {
    CampaignManager.resetCompendiumAndRelations();
    setEntities([]);
    setDetailEntity(null);
    setHighlightedEntityId(null);
    setShowResetModal(false);
  };

  // Quest-specific scope filter
  const [questScopeFilter, setQuestScopeFilter] = useState<'all' | 'party' | 'personal'>('all');
  const [personalAssigneeFilter, setPersonalAssigneeFilter] = useState<string>('all');
  const [filterSendipietra, setFilterSendipietra] = useState(false);

  // Form State
  const [formType, setFormType] = useState<Entity['type']>(isAll ? 'npc' : (activeType as Entity['type']));
  const [newName, setNewName] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newStatus, setNewStatus] = useState<Entity['status']>(activeCategory.defaultStatus);
  const [newNote, setNewNote] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newQuestScope, setNewQuestScope] = useState<'party' | 'personal'>('party');
  const [newQuestPrivacy, setNewQuestPrivacy] = useState<'public' | 'private'>('public');
  const [newAssigneeId, setNewAssigneeId] = useState<string>(player?._id || '');
  const [newSharedWithDm, setNewSharedWithDm] = useState<boolean>(false);

  // Place-specific Form State
  const [newFolderId, setNewFolderId] = useState<string>('');
  const [newMapId, setNewMapId] = useState<string>('');
  const [newPinCategory, setNewPinCategory] = useState<string>('city');
  const [newPinX, setNewPinX] = useState<number>(50);
  const [newPinY, setNewPinY] = useState<number>(50);
  const [newIsMap, setNewIsMap] = useState<boolean>(false);
  const [newMapImageUrl, setNewMapImageUrl] = useState<string>('');

  // AI Persona & Sub-Codex Form State
  const [newAiEnabled, setNewAiEnabled] = useState<boolean>(false);
  const [newAiSpeechStyle, setNewAiSpeechStyle] = useState<string>('');
  const [newAiCurrentStatus, setNewAiCurrentStatus] = useState<string>('');
  const [newAiKnowledgeScope, setNewAiKnowledgeScope] = useState<string>('');
  const [newAiKnownEntityIds, setNewAiKnownEntityIds] = useState<string[]>([]);
  const [newAiKnownSessionIds, setNewAiKnownSessionIds] = useState<string[]>([]);
  const [newAiSecretsToProtect, setNewAiSecretsToProtect] = useState<string>('');
  const [newAiSecrets, setNewAiSecrets] = useState<EntitySecretItem[]>([]);
  const [newPartyRelations, setNewPartyRelations] = useState<Record<string, EntityPartyRelation>>({});
  const [newEntityRelations, setNewEntityRelations] = useState<Record<string, EntityToEntityRelation>>({});
  const [newAiTimelineMemories, setNewAiTimelineMemories] = useState<TimelineMemoryEntry[]>([]);
  const [newAiEvolvingBeliefs, setNewAiEvolvingBeliefs] = useState<EvolvingBelief[]>([]);
  const [expandedProgressionPlayerId, setExpandedProgressionPlayerId] = useState<string | null>(null);
  const [newAiVisibilityMode, setNewAiVisibilityMode] = useState<'dm_only' | 'all_players' | 'custom'>('dm_only');
  const [newAiAllowedViewPlayerIds, setNewAiAllowedViewPlayerIds] = useState<string[]>([]);
  const [newAiAllowedEditPlayerIds, setNewAiAllowedEditPlayerIds] = useState<string[]>([]);
  const [isAiSectionOpen, setIsAiSectionOpen] = useState<boolean>(false);

  // Granular AI Permissions Helper
  const canUserViewEntityAi = (ent?: Entity | null) => {
    if (!ent || !ent.aiConfig?.enabled) return false;
    if (player?.isDm) return true;
    const mode = ent.aiConfig.visibilityMode || 'dm_only';
    if (mode === 'all_players') return true;
    if (mode === 'custom' && player?._id && ent.aiConfig.allowedViewPlayerIds?.includes(player._id)) {
      return true;
    }
    return false;
  };

  const canUserEditEntityAi = (ent?: Entity | null) => {
    if (player?.isDm) return true;
    if (!ent) return true; // new entity creation
    if (!ent.aiConfig?.enabled) return true;
    if (player?._id && ent.aiConfig.allowedEditPlayerIds?.includes(player._id)) {
      return true;
    }
    return false;
  };

  // AI Sub-Codex Picker Helpers State
  const [aiExpandedChapterIds, setAiExpandedChapterIds] = useState<string[]>([]);
  const [aiEntitySearchQuery, setAiEntitySearchQuery] = useState<string>('');
  const [aiEntityTypeFilter, setAiEntityTypeFilter] = useState<string>('all');

  // Zoom lightbox
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);
  const [tomePairIndex, setTomePairIndex] = useState<number>(0);

  const activeCampaignCode = CampaignManager.getActiveCampaignCode() || '';
  const [canCreateEntity, setCanCreateEntity] = useState(() => CampaignManager.canUser('create_entity', activeCampaignCode));
  const [canEditEntity, setCanEditEntity] = useState(() => CampaignManager.canUser('edit_entity', activeCampaignCode));
  const [canDeleteEntity, setCanDeleteEntity] = useState(() => CampaignManager.canUser('delete_entity', activeCampaignCode));

  useEffect(() => {
    const handleSync = () => {
      setCanCreateEntity(CampaignManager.canUser('create_entity', activeCampaignCode));
      setCanEditEntity(CampaignManager.canUser('edit_entity', activeCampaignCode));
      setCanDeleteEntity(CampaignManager.canUser('delete_entity', activeCampaignCode));
    };
    window.addEventListener('chronicle_campaign_updated', handleSync);
    window.addEventListener('chronicle_campaigns_updated', handleSync);
    window.addEventListener('chronicle_data_updated', handleSync);
    window.addEventListener('chronicle_members_updated', handleSync);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleSync);
      window.removeEventListener('chronicle_campaigns_updated', handleSync);
      window.removeEventListener('chronicle_data_updated', handleSync);
      window.removeEventListener('chronicle_members_updated', handleSync);
    };
  }, [activeCampaignCode]);

  const refreshEntities = () => {
    setEntities(CampaignManager.getEntities());
    setMaps(CampaignManager.getMaps());
    setFolders(CampaignManager.getMapFolders());
  };

  // Sync state when store dispatches events
  useEffect(() => {
    const handleEntitiesUpdated = () => {
      setEntities(CampaignManager.getEntities());
    };
    const handleMapsUpdated = () => {
      setMaps(CampaignManager.getMaps());
    };
    const handleFoldersUpdated = () => {
      setFolders(CampaignManager.getMapFolders());
    };
    window.addEventListener('chronicle_entities_updated', handleEntitiesUpdated);
    window.addEventListener('chronicle_maps_updated', handleMapsUpdated);
    window.addEventListener('chronicle_map_folders_updated', handleFoldersUpdated);
    return () => {
      window.removeEventListener('chronicle_entities_updated', handleEntitiesUpdated);
      window.removeEventListener('chronicle_maps_updated', handleMapsUpdated);
      window.removeEventListener('chronicle_map_folders_updated', handleFoldersUpdated);
    };
  }, []);

  // Reset page and trigger brief elegant skeleton when category/tab changes
  useEffect(() => {
    setCurrentPage(1);
    setFilterSendipietra(false);
    setIsTabChanging(true);
    const timer = setTimeout(() => {
      setIsTabChanging(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [type]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, questScopeFilter, filterSendipietra]);

  const handleOpenCreateModal = (targetType?: Entity['type'] | 'all') => {
    const chosenType = (!targetType || targetType === 'all' || isOverview) ? 'npc' : targetType;
    const chosenConfig = CATEGORY_DEFINITIONS[chosenType];

    setIsEditing(false);
    setSelectedEntityId(null);
    setFormType(chosenType);
    setNewName('');
    setNewAlias('');
    setNewStatus(chosenConfig.defaultStatus);
    setNewNote('');
    setNewImages([]);
    setNewQuestScope('party');
    setNewQuestPrivacy('public');
    setNewAssigneeId(player?._id || allPlayers[0]?._id || '');
    setNewSharedWithDm(false);
    setNewFolderId('');
    setNewMapId(maps[0]?.id || '');
    setNewPinCategory('city');
    setNewPinX(50);
    setNewPinY(50);
    setNewIsMap(false);
    setNewMapImageUrl('');
    setNewAiEnabled(false);
    setNewAiSpeechStyle('');
    setNewAiCurrentStatus('');
    setNewAiKnowledgeScope('');
    setNewAiKnownEntityIds([]);
    setNewAiKnownSessionIds([]);
    setNewAiSecretsToProtect('');
    setNewAiSecrets([]);
    setNewPartyRelations({});
    setNewEntityRelations({});
    setNewAiTimelineMemories([]);
    setNewAiEvolvingBeliefs([]);
    setExpandedProgressionPlayerId(null);
    setNewAiVisibilityMode('dm_only');
    setNewAiAllowedViewPlayerIds([]);
    setNewAiAllowedEditPlayerIds([]);
    setIsAiSectionOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ent: Entity) => {
    setIsEditing(true);
    setSelectedEntityId(ent._id);
    setFormType(ent.type || 'npc');
    setNewName(ent.name);
    setNewAlias(ent.aliases?.join(', ') || '');
    setNewStatus(ent.status);
    setNewNote(ent.progressNote || '');
    setNewImages(ent.images || []);
    setNewQuestScope(ent.questScope || 'party');
    setNewQuestPrivacy(ent.questPrivacy || 'public');
    setNewAssigneeId(ent.assigneePlayerId || player?._id || '');
    setNewSharedWithDm(!!ent.sharedWithDm);
    setNewFolderId(ent.folderId || '');
    setNewMapId(ent.mapId || maps[0]?.id || '');
    setNewPinCategory(ent.pinCategory || 'city');
    setNewPinX(ent.pinX ?? 50);
    setNewPinY(ent.pinY ?? 50);
    setNewIsMap(!!ent.isMap);
    setNewMapImageUrl(ent.mapImageUrl || '');
    setNewAiEnabled(!!ent.aiConfig?.enabled);
    setNewAiSpeechStyle(ent.aiConfig?.speechStyle || '');
    setNewAiCurrentStatus(ent.aiConfig?.currentStatus || '');
    setNewAiKnowledgeScope(ent.aiConfig?.knowledgeScope || '');
    setNewAiKnownEntityIds(ent.aiConfig?.knownEntityIds || []);
    setNewAiKnownSessionIds(ent.aiConfig?.knownSessionIds || []);
    setNewAiSecretsToProtect(ent.aiConfig?.secretsToProtect || '');

    const existingSecrets: EntitySecretItem[] = Array.isArray(ent.aiConfig?.secrets) && ent.aiConfig.secrets.length > 0
      ? ent.aiConfig.secrets
      : (ent.aiConfig?.secretsToProtect?.trim()
          ? [{ id: `sec_${Date.now()}_1`, title: ent.aiConfig.secretsToProtect.trim(), isRevealed: false }]
          : []);
    setNewAiSecrets(existingSecrets);

    setNewPartyRelations(ent.aiConfig?.partyRelations || {});
    setNewEntityRelations(ent.aiConfig?.entityRelations || {});
    setNewAiTimelineMemories(ent.aiConfig?.timelineMemories || []);
    setNewAiEvolvingBeliefs(ent.aiConfig?.evolvingBeliefs || []);
    setExpandedProgressionPlayerId(null);
    setNewAiVisibilityMode(ent.aiConfig?.visibilityMode || 'dm_only');
    setNewAiAllowedViewPlayerIds(ent.aiConfig?.allowedViewPlayerIds || []);
    setNewAiAllowedEditPlayerIds(ent.aiConfig?.allowedEditPlayerIds || []);
    setIsAiSectionOpen(!!ent.aiConfig?.enabled);
    setIsModalOpen(true);
    setDetailEntity(null);
  };

  const location = useLocation();

  // Handle routeId & query param (?entity=ID) deep linking
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryEntityId = searchParams.get('entity') || searchParams.get('id');
    const targetId = routeId || queryEntityId;

    if (targetId) {
      const allEnts = CampaignManager.getEntities();
      const target = allEnts.find((e) => e._id === targetId);
      if (target) {
        setHighlightedEntityId(target._id);
        setDetailEntity(target);

        if (target.type && target.type !== type && CATEGORY_DEFINITIONS[target.type]) {
          navigate(`/codex/${target.type}/${target._id}`, { replace: true });
        }

        setTimeout(() => {
          const el = document.getElementById(`entity-${target._id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    }
  }, [routeId, location.search, type, navigate]);

  // Filtered entities for current view
  const filteredEntities = useMemo(() => {
    const allowedEntities = entities.filter((e) => CampaignManager.isEntityAccessible(e, player));

    let result: Entity[] = [];

    if (isOverview) {
      if (!searchQuery.trim()) {
        result = allowedEntities;
      } else {
        const q = searchQuery.toLowerCase().trim();
        result = allowedEntities.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(q))) ||
            (e.progressNote && e.progressNote.toLowerCase().includes(q))
        );
      }
    } else if (activeType === 'all') {
      result = allowedEntities
        .filter((e) => {
          if (e.type !== 'quest') return true;
          if (questScopeFilter === 'party') return e.questScope === 'party';
          if (questScopeFilter === 'personal') {
            if (personalAssigneeFilter === 'all') return e.questScope === 'personal';
            return e.questScope === 'personal' && e.assigneePlayerId === personalAssigneeFilter;
          }
          return true;
        })
        .filter(
          (e) =>
            !searchQuery ||
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))) ||
            (e.progressNote && e.progressNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (e.assigneePlayerName && e.assigneePlayerName.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    } else {
      result = allowedEntities
        .filter((e) => e.type === activeType)
        .filter((e) => {
          if (activeType !== 'quest') return true;
          if (questScopeFilter === 'party') return e.questScope === 'party';
          if (questScopeFilter === 'personal') {
            if (personalAssigneeFilter === 'all') return e.questScope === 'personal';
            return e.questScope === 'personal' && e.assigneePlayerId === personalAssigneeFilter;
          }
          return true;
        })
        .filter(
          (e) =>
            !searchQuery ||
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))) ||
            (e.progressNote && e.progressNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (e.assigneePlayerName && e.assigneePlayerName.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    if (filterSendipietra) {
      result = result.filter((e) => e.aiConfig?.enabled === true);
    }

    const sorted = [...result];
    if (sortOrder === 'alpha-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
    } else if (sortOrder === 'alpha-desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name, 'it', { sensitivity: 'base' }));
    } else if (sortOrder === 'recent') {
      sorted.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    }

    return sorted;
  }, [entities, isOverview, activeType, questScopeFilter, personalAssigneeFilter, searchQuery, player, sortOrder, filterSendipietra]);

  const totalPages = Math.max(1, Math.ceil(filteredEntities.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (highlightedEntityId) {
      const idx = filteredEntities.findIndex((e) => e._id === highlightedEntityId);
      if (idx !== -1) {
        const targetPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    }
  }, [highlightedEntityId, filteredEntities, currentPage]);

  const currentEntities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEntities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEntities, currentPage]);

  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const assignedPlayer = allPlayers.find((p) => p._id === newAssigneeId);

    const existingEntity = isEditing && selectedEntityId ? entities.find((e) => e._id === selectedEntityId) : null;
    const canEditAi = canUserEditEntityAi(existingEntity);

    let aiConfigData = existingEntity?.aiConfig;

    if (canEditAi) {
      const validSecrets = newAiSecrets.filter((s) => s.title.trim().length > 0);
      const legacySecretsText = validSecrets.length > 0
        ? validSecrets.map((s) => (s.isRevealed ? `[Svelato] ${s.title}` : `[Segreto] ${s.title}`)).join('\n')
        : newAiSecretsToProtect.trim();

      aiConfigData = newAiEnabled || newAiSpeechStyle.trim() || newAiCurrentStatus.trim() || newAiKnowledgeScope.trim() || validSecrets.length > 0 || Object.keys(newPartyRelations).length > 0 || Object.keys(newEntityRelations).length > 0 || newAiTimelineMemories.length > 0 || newAiEvolvingBeliefs.length > 0
        ? {
            enabled: newAiEnabled,
            speechStyle: newAiSpeechStyle.trim(),
            currentStatus: newAiCurrentStatus.trim(),
            knowledgeScope: newAiKnowledgeScope.trim(),
            knownEntityIds: newAiKnownEntityIds,
            knownSessionIds: newAiKnownSessionIds,
            secrets: validSecrets,
            secretsToProtect: legacySecretsText,
            partyRelations: newPartyRelations,
            entityRelations: newEntityRelations,
            timelineMemories: newAiTimelineMemories,
            evolvingBeliefs: newAiEvolvingBeliefs,
            visibilityMode: newAiVisibilityMode,
            allowedViewPlayerIds: newAiAllowedViewPlayerIds,
            allowedEditPlayerIds: newAiAllowedEditPlayerIds,
          }
        : undefined;
    }

    if (isEditing && selectedEntityId) {
      CampaignManager.updateEntity(selectedEntityId, {
        type: formType,
        name: newName.trim(),
        aliases: newAlias.trim() ? newAlias.split(',').map((a) => a.trim()).filter(Boolean) : [],
        status: newStatus,
        progressNote: newNote.trim(),
        images: newImages,
        aiConfig: aiConfigData,
        questScope: formType === 'quest' ? newQuestScope : undefined,
        questPrivacy: formType === 'quest' && newQuestScope === 'personal' ? newQuestPrivacy : undefined,
        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,
        sharedWithDm: formType === 'quest' && newQuestScope === 'personal' && newQuestPrivacy === 'private' ? newSharedWithDm : undefined,
        assigneePlayerName:
          formType === 'quest' && newQuestScope === 'personal'
            ? assignedPlayer?.characterName
            : undefined,
        mapId: formType === 'place' ? (newMapId || undefined) : undefined,
        folderId: formType === 'place' ? (newFolderId || undefined) : undefined,
        pinCategory: formType === 'place' ? (newPinCategory as any) : undefined,
        pinX: formType === 'place' ? newPinX : undefined,
        pinY: formType === 'place' ? newPinY : undefined,
        isMap: formType === 'place' ? newIsMap : undefined,
        mapImageUrl: formType === 'place' && newIsMap ? newMapImageUrl : undefined,
      });
    } else {
      CampaignManager.addEntity({
        type: formType,
        name: newName.trim(),
        aliases: newAlias.trim() ? newAlias.split(',').map((a) => a.trim()).filter(Boolean) : [],
        status: newStatus,
        progressNote: newNote.trim(),
        images: newImages,
        aiConfig: aiConfigData,
        questScope: formType === 'quest' ? newQuestScope : undefined,
        questPrivacy: formType === 'quest' && newQuestScope === 'personal' ? newQuestPrivacy : undefined,
        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,
        sharedWithDm: formType === 'quest' && newQuestScope === 'personal' && newQuestPrivacy === 'private' ? newSharedWithDm : undefined,
        assigneePlayerName:
          formType === 'quest' && newQuestScope === 'personal'
            ? assignedPlayer?.characterName
            : undefined,
        mapId: formType === 'place' ? (newMapId || undefined) : undefined,
        folderId: formType === 'place' ? (newFolderId || undefined) : undefined,
        pinCategory: formType === 'place' ? (newPinCategory as any) : undefined,
        pinX: formType === 'place' ? newPinX : undefined,
        pinY: formType === 'place' ? newPinY : undefined,
        isMap: formType === 'place' ? newIsMap : undefined,
        mapImageUrl: formType === 'place' && newIsMap ? newMapImageUrl : undefined,
      });
    }

    setIsModalOpen(false);
    refreshEntities();
  };

  const handleStatusChange = (id: string, nextStatus: Entity['status']) => {
    CampaignManager.updateEntityStatus(id, nextStatus);
    refreshEntities();
    if (detailEntity && detailEntity._id === id) {
      setDetailEntity({ ...detailEntity, status: nextStatus });
    }
  };

  const confirmDeleteEntity = () => {
    if (entityToDelete) {
      CampaignManager.deleteEntity(entityToDelete);
      setEntityToDelete(null);
      refreshEntities();
      if (detailEntity?._id === entityToDelete) {
        setDetailEntity(null);
      }
    }
  };

  const renderStatusBadge = (status: Entity['status']) => {
    switch (status) {
      case 'alive':
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-emerald-400 font-medium opacity-80 shrink-0">
            <span className="text-[7px] text-emerald-400">•</span>
            <span className="truncate">in vita</span>
          </span>
        );
      case 'dead':
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-rose-400 font-medium opacity-80 shrink-0">
            <span className="text-[7px] text-rose-400">•</span>
            <span className="truncate">caduto</span>
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-amber-400 font-medium opacity-80 shrink-0">
            <span className="text-[7px] text-amber-400">•</span>
            <span className="truncate">in corso</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-emerald-400 font-medium opacity-80 shrink-0">
            <span className="text-[7px] text-emerald-400">•</span>
            <span className="truncate">completata</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-rose-400 font-medium opacity-80 shrink-0">
            <span className="text-[7px] text-rose-400">•</span>
            <span className="truncate">fallita</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-mono tracking-[0.05em] uppercase text-content-3 font-medium opacity-80 shrink-0">
            <span className="text-[7px]">•</span>
            <span className="truncate">{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8 font-body">
      {/* 1. OVERVIEW VIEW: Editorial Chronicle Codex */}
      {isOverview ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Editorial Header Banner */}
          <header className="border-b border-surface-2/80 pb-4 sm:pb-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.15em] text-primary uppercase opacity-90">
                  <span>ARCHIVIO DEL REAME</span>
                  <span className="text-surface-3">/</span>
                  <span className="text-content-3 font-semibold">
                    {entities.length} {entities.length === 1 ? 'VOCE CUSTODITA' : 'VOCI CUSTODITE'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-cinzel font-semibold text-content-1 tracking-[0.05em]">
                  Codex di Campagna
                </h1>
                <p className="text-xs text-content-3/70 leading-relaxed hidden sm:block font-sans">
                  Compendio enciclopedico del mondo: tomi, memorie, creature, toponomastica e ordini trascritti dal gruppo.
                </p>
              </div>

              {/* Search and Action Bar */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <div className="relative flex-1 sm:w-64">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    type="text"
                    placeholder="Cerca per nome o alias..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-1/80 border border-surface-2 focus:border-primary rounded-[2px] pl-8 pr-7 py-1.5 text-xs text-content-1 placeholder-content-3 outline-none transition-colors font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/codex/all')}
                  className="px-3 py-1.5 rounded-[2px] font-medium text-xs bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-2 transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs font-mono"
                  title="Mostra tutte le entità in un unico registro"
                >
                  <Sparkles size={13} className="text-primary" />
                  <span className="hidden sm:inline">Tutti i Registri</span>
                  <span className="sm:hidden">Tutto</span>
                </button>

                {canCreateEntity && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal('npc')}
                    className="px-3.5 py-1.5 rounded-[2px] font-medium text-xs bg-primary text-surface-0 hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs font-mono"
                    title="Aggiungi nuova voce all'archivio"
                  >
                    <Plus size={14} />
                    <span className="hidden xs:inline">Nuova Voce</span>
                    <span className="xs:hidden">Nuovo</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Global Search Results if searching on overview */}
          {searchQuery.trim() ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-surface-2 pb-2">
                <h2 className="text-xs font-mono uppercase tracking-widest text-content-2">
                  Riscontri d&apos;archivio trovati — {filteredEntities.length}
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-primary hover:underline cursor-pointer font-mono"
                >
                  Torna all&apos;indice dei tomi
                </button>
              </div>

              {filteredEntities.length === 0 ? (
                <div className="bg-surface-1 rounded-[2px] p-8 border border-surface-2 text-left space-y-2">
                  <div className="text-xs font-mono text-primary tracking-widest uppercase">Indice Vuoto</div>
                  <h3 className="text-base font-cinzel font-medium text-content-1">
                    Nessun documento rinvenuto per &ldquo;{searchQuery}&rdquo;
                  </h3>
                  <p className="text-xs text-content-3 max-w-lg leading-relaxed font-sans">
                    Le pergamene consultate non contengono corrispondenze. Verifica l&apos;ortografia, cerca un alias o verga una nuova voce nel tomo appropriato.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredEntities.map((ent) => {
                    const cat = CATEGORY_DEFINITIONS[ent.type || 'npc'] || CATEGORY_DEFINITIONS.npc;
                    return (
                      <div
                        key={ent._id}
                        onClick={() => setDetailEntity(ent)}
                        className="bg-surface-1 hover:bg-surface-2/60 border border-surface-2 hover:border-primary/40 rounded-[2px] p-3.5 cursor-pointer transition-colors flex flex-col justify-between gap-2.5 shadow-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 border-b border-surface-2/40 pb-1.5">
                            <span className="text-[10px] font-mono tracking-wider text-content-3 uppercase">
                              {cat.title}
                            </span>
                            {renderStatusBadge(ent.status)}
                          </div>
                          <h3 className="font-cinzel font-medium text-sm text-content-1 tracking-tight">
                            {ent.name}
                          </h3>
                          {ent.aliases && ent.aliases.length > 0 && (
                            <p className="text-[10px] text-content-3 font-mono">
                              Alias: {ent.aliases.join(' · ')}
                            </p>
                          )}
                          {ent.progressNote && (
                            <p className="text-xs text-content-3 line-clamp-2 leading-relaxed font-sans">
                              {ent.progressNote.replace(/[#*`_]/g, '')}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-surface-2/40 flex items-center justify-between text-xs font-mono">
                          <span className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]">
                            Consulta scheda &rarr;
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/entities/${ent.type}/${ent._id}`);
                            }}
                            className="text-content-3 hover:text-content-1 text-[10px] font-mono cursor-pointer"
                          >
                            Apri tomo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* PANORAMICA DEI TOMI: 2 GRANDI LIBRI VERTICALI CON ILLUMINAZIONE A GRANA MAGICA ALL'HOVER */
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Header con Navigazione Slider & Controlli Coppie */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 border-b border-surface-2/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-content-2 font-semibold">
                    ARCHIVIO DEI TOMI &bull; VOLUMI I — VI
                  </span>
                  <span className="text-[10px] font-mono text-content-3/80 ml-2 hidden sm:inline">
                    ({entities.length} voci custodite)
                  </span>
                </div>

                {/* Slider Controls (Previous / Next + Pair Tabs) */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTomePairIndex((prev) => (prev > 0 ? prev - 1 : 2))}
                    className="p-1.5 rounded-[2px] border border-surface-2/80 bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                    title="Coppia precedente"
                    aria-label="Coppia precedente"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="flex items-center gap-1 bg-surface-1/40 p-0.5 rounded-[2px] border border-surface-2/60">
                    {[
                      { idx: 0, label: 'Tomi I – II' },
                      { idx: 1, label: 'Tomi III – IV' },
                      { idx: 2, label: 'Tomi V – VI' },
                    ].map((tab) => (
                      <button
                        key={tab.idx}
                        type="button"
                        onClick={() => setTomePairIndex(tab.idx)}
                        className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-[2px] transition-all cursor-pointer ${
                          tomePairIndex === tab.idx
                            ? 'bg-primary/25 text-primary border border-primary/50 font-semibold shadow-xs'
                            : 'text-content-3/70 hover:text-content-2 hover:bg-surface-2/40 border border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTomePairIndex((prev) => (prev < 2 ? prev + 1 : 0))}
                    className="p-1.5 rounded-[2px] border border-surface-2/80 bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                    title="Coppia successiva"
                    aria-label="Coppia successiva"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* 2 Libri Verticali (Formato Grimoire con Dorso Rinforzato & Grana Animata all'Hover con Accent Dinamico) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-7 sm:gap-8 max-w-3xl mx-auto w-full animate-fadeIn py-2">
                {[
                  [
                    { cat: CATEGORY_DEFINITIONS.npc, num: 'I', sub: 'Figure di spicco, alleati & PNG' },
                    { cat: CATEGORY_DEFINITIONS.monster, num: 'II', sub: 'Bestiario, creature & minacce' },
                  ],
                  [
                    { cat: CATEGORY_DEFINITIONS.place, num: 'III', sub: 'Toponomastica, reami & mappe' },
                    { cat: CATEGORY_DEFINITIONS.quest, num: 'IV', sub: 'Trame, ordini & incarichi' },
                  ],
                  [
                    { cat: CATEGORY_DEFINITIONS.item, num: 'V', sub: 'Reliquie, tomi & artefatti' },
                    { cat: CATEGORY_DEFINITIONS.faction, num: 'VI', sub: 'Gilde, casate & congreghe' },
                  ],
                ][tomePairIndex].map(({ cat, num, sub }) => {
                  const catEntities = entities.filter((e) => e.type === cat.id);
                  const count = catEntities.length;
                  const HeraldicIcon = cat.heraldicIcon;
                  const aliveCount =
                    cat.id === 'npc'
                      ? catEntities.filter((n) => n.status === 'alive').length
                      : undefined;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => navigate(`/entities/${cat.id}`)}
                      className="w-full max-w-[360px] min-h-[520px] sm:min-h-[560px] mx-auto p-5 sm:p-6 rounded-[4px] border border-surface-3/80 hover:border-primary/80 border-l-[10px] sm:border-l-[12px] border-l-primary bg-surface-1/95 hover:bg-surface-1 transition-all duration-500 shadow-xl hover:shadow-[0_16px_45px_var(--color-primary-muted)] text-left flex flex-col justify-between gap-4 group cursor-pointer relative overflow-hidden"
                    >
                      {/* Porzione Interna del Tomo: Scura a riposo, Grana Animata & Bagliore con Accent del Tema SOLO in Hover */}
                      <div className="relative w-full rounded-[3px] border border-surface-3/60 group-hover:border-primary/70 bg-surface-0/90 p-6 sm:p-7 overflow-hidden shadow-2xl flex flex-col justify-between flex-1 min-h-[360px] transition-all duration-500">
                        {/* Sfondo Notturno a Riposo */}
                        <div className="absolute inset-0 bg-gradient-to-b from-surface-1 via-surface-0 to-surface-0/95" />

                        {/* Riempimento con Grana Dither Gradiente Animata a Tema (Attiva SOLO in Hover) */}
                        <TomeGrainCanvas />

                        {/* Bagliore Soffuso Radiante Posteriore */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-500 ease-out pointer-events-none"
                          style={{
                            background:
                              'radial-gradient(circle at 45% 35%, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 40%, transparent) 50%, transparent 80%)',
                          }}
                        />

                        {/* Riga Superiore: Intestazione Volume & Emblema */}
                        <div className="flex items-center justify-between gap-2 relative z-10">
                          <span className="text-xs font-mono tracking-widest text-primary font-bold uppercase drop-shadow-sm">
                            VOL. {num}
                          </span>
                          <div className="flex items-center gap-1.5 text-content-1 bg-surface-0/80 backdrop-blur-xs px-2.5 py-1 rounded-[2px] border border-surface-3/80 group-hover:border-primary/80 transition-colors">
                            <HeraldicIcon size={14} className="shrink-0 text-primary" />
                            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                              {cat.heraldicSigil}
                            </span>
                          </div>
                        </div>

                        {/* Centro del Libro: Numero Romano ad Altissimo Contrasto & Titolo Monumentale */}
                        <div className="py-6 text-center space-y-3 relative z-10">
                          <div className="font-cinzel font-black text-6xl sm:text-7xl text-content-1 group-hover:text-primary transition-colors dark:drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] drop-shadow-none tracking-widest leading-none select-none">
                            {num}
                          </div>
                          <div className="space-y-1.5 px-2">
                            <h3 className="font-cinzel font-bold text-2xl sm:text-[1.65rem] text-content-1 group-hover:text-content-1 transition-colors tracking-wide leading-tight dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] drop-shadow-none">
                              {cat.title}
                            </h3>
                            <p className="text-xs sm:text-[0.82rem] text-content-2 group-hover:text-content-1 font-sans max-w-xs mx-auto leading-relaxed transition-colors">
                              {aliveCount !== undefined ? `${aliveCount} in vita • ${sub}` : sub}
                            </p>
                          </div>
                        </div>

                        {/* Filetto Decorativo Inferiore dell'inlay */}
                        <div className="w-full flex items-center justify-center gap-2 opacity-60 relative z-10">
                          <span className="h-px bg-content-3/30 flex-1" />
                          <span className="text-[10px] font-cinzel text-primary tracking-widest">&diams;</span>
                          <span className="h-px bg-content-3/30 flex-1" />
                        </div>
                      </div>

                      {/* Piede del Libro: Margine e Azione */}
                      <div className="pt-3 border-t border-surface-2/60 flex items-center justify-between text-xs font-mono w-full">
                        <span className="truncate flex-1 mr-3 text-content-3 text-[11px]">
                          {catEntities.length > 0 ? (
                            <span className="text-content-2">
                              <span className="text-primary mr-1.5 font-bold">&bull;</span>
                              {catEntities[0].name}
                              {catEntities.length > 1 && (
                                <span className="text-content-3/70 ml-1">(+{catEntities.length - 1} altre)</span>
                              )}
                            </span>
                          ) : (
                            <span className="italic opacity-50">Tomo intonso</span>
                          )}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] uppercase tracking-wider text-content-3 font-semibold">
                            {count} {count === 1 ? 'voce' : 'voci'}
                          </span>
                          <span className="text-primary font-serif font-bold text-base group-hover:translate-x-1.5 transition-transform">
                            &rarr;
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Indicatori Slider Inferiori (Punti di Navigazione Rapida) */}
              <div className="flex items-center justify-center gap-2 pt-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTomePairIndex(idx)}
                    className={`h-2 transition-all rounded-full cursor-pointer ${
                      tomePairIndex === idx ? 'w-9 bg-primary' : 'w-2.5 bg-surface-3 hover:bg-content-3'
                    }`}
                    title={`Passa alla coppia ${idx + 1}`}
                    aria-label={`Passa alla coppia ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2. CATEGORY VIEW: Editorial Tome Workspace */
        <div className="space-y-4 sm:space-y-6">
          {/* Breadcrumb / Back to Overview Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-surface-2/80">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-content-3 font-mono min-w-0">
              <button
                type="button"
                onClick={() => navigate('/codex')}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[2px] bg-surface-1 hover:bg-surface-2 text-content-2 hover:text-content-1 font-medium transition-colors border border-surface-2 text-xs cursor-pointer shrink-0 shadow-xs"
              >
                <ArrowLeft size={13} />
                <span className="hidden xs:inline">Codex</span>
                <span className="xs:hidden">Indice</span>
              </button>
              <span>/</span>
              <span className="font-cinzel font-medium text-content-1 flex items-center gap-1.5 truncate text-xs sm:text-sm">
                <ActiveIcon size={14} className={`${activeCategory.color} shrink-0`} />
                <span className="truncate">{activeCategory.title}</span>
              </span>
            </div>

            {canCreateEntity && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal(activeType)}
                className="px-3.5 py-1.5 rounded-[2px] font-medium text-xs bg-primary text-surface-0 hover:bg-primary-hover transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 font-mono"
              >
                <Plus size={14} />
                <span className="hidden xs:inline">Nuovo {activeCategory.singular}</span>
                <span className="xs:hidden">Nuovo</span>
              </button>
            )}
          </div>

          {/* Mobile Horizontal Tome Selector (Tutto + Tomi I — VI) */}
          <div className="lg:hidden overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1.5 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                navigate('/codex/all');
                setHighlightedEntityId(null);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] text-xs whitespace-nowrap border transition-all cursor-pointer shrink-0 font-mono ${
                activeType === 'all'
                  ? 'bg-primary/10 text-primary border-primary font-semibold'
                  : 'bg-surface-1 text-content-2 hover:text-content-1 hover:bg-surface-2 border-surface-2'
              }`}
            >
              <Sparkles size={13} className={activeType === 'all' ? 'text-primary' : 'text-content-3'} />
              <span className="text-xs font-semibold">Tutto</span>
              <span className="text-[10px] px-1 rounded-[2px] bg-surface-2 text-content-3 font-semibold">
                {entities.length}
              </span>
            </button>
            {CATEGORIES_LIST.map((cat, idx) => {
              const CatHeraldicIcon = cat.heraldicIcon;
              const isActive = activeType === cat.id;
              const count = entities.filter((e) => e.type === cat.id).length;
              const romanNums = ['I', 'II', 'III', 'IV', 'V', 'VI'];

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    navigate(`/codex/${cat.id}`);
                    setHighlightedEntityId(null);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] text-xs whitespace-nowrap border transition-all cursor-pointer shrink-0 font-mono ${
                    isActive
                      ? 'bg-primary/10 text-primary border-primary font-semibold'
                      : 'bg-surface-1 text-content-2 hover:text-content-1 hover:bg-surface-2 border-surface-2'
                  }`}
                >
                  <span className="text-[10px] font-bold opacity-80">{romanNums[idx]}</span>
                  <CatHeraldicIcon size={13} className={isActive ? 'text-primary' : 'text-content-3'} />
                  <span className="text-xs">{cat.title.split('&')[0].trim()}</span>
                  <span className="text-[10px] px-1 rounded-[2px] bg-surface-2 text-content-3 font-semibold">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main Layout: Left Vertical Categories Column (Desktop) + Right Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Left Vertical Categories Navigator (Desktop Column Register) */}
            <aside className="hidden lg:block lg:col-span-3 space-y-5">
              <div className="border border-surface-2/60 bg-surface-1/20 divide-y divide-surface-2/40">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-content-3/70 flex items-center justify-between bg-surface-1/40">
                  <span>REGISTRI CODEX</span>
                  <span>TOMI I–VI</span>
                </div>
                {/* TUTTO / TUTTI I REGISTRI Button */}
                <button
                  type="button"
                  onClick={() => {
                    navigate('/codex/all');
                    setHighlightedEntityId(null);
                    setCurrentPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                    activeType === 'all'
                      ? 'bg-surface-2/40 text-primary font-medium border-l-2 border-primary'
                      : 'text-content-2 hover:text-content-1 hover:bg-surface-2/20 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-[10px] font-mono text-content-3/60 w-3 font-semibold">★</span>
                    <Sparkles size={13} className={activeType === 'all' ? 'text-primary' : 'text-content-3/60'} />
                    <span className="truncate font-medium">Tutti i Registri</span>
                  </div>
                  <span className="text-[10px] font-mono text-content-3/60 shrink-0">
                    {entities.length}
                  </span>
                </button>
                {CATEGORIES_LIST.map((cat, idx) => {
                  const CatHeraldicIcon = cat.heraldicIcon;
                  const isActive = activeType === cat.id;
                  const count = entities.filter((e) => e.type === cat.id).length;
                  const romanNums = ['I', 'II', 'III', 'IV', 'V', 'VI'];

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        navigate(`/codex/${cat.id}`);
                        setHighlightedEntityId(null);
                        setCurrentPage(1);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-surface-2/40 text-primary font-medium border-l-2 border-primary'
                          : 'text-content-2 hover:text-content-1 hover:bg-surface-2/20 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-[10px] font-mono text-content-3/60 w-3 font-semibold">
                          {romanNums[idx]}
                        </span>
                        <CatHeraldicIcon size={13} className={isActive ? 'text-primary' : 'text-content-3/60'} />
                        <span className="truncate">{cat.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-content-3/60 shrink-0">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Vertical Entity Quick List for Active Category (Desktop Index Rubric) */}
              <div className="border border-surface-2/60 bg-surface-1/20 divide-y divide-surface-2/40 rounded-[2px] overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-content-3/70 flex items-center justify-between bg-surface-1/50 border-b border-surface-2/40">
                  <span className="truncate pr-2">INDICE &bull; {activeCategory.title}</span>
                  <span className="shrink-0 font-mono">({filteredEntities.length})</span>
                </div>

                {/* Fixed Lower Height Scrollable Index */}
                <div className="h-52 sm:h-56 overflow-y-auto divide-y divide-surface-2/30 custom-scrollbar overscroll-contain">
                  {isTabChanging ? (
                    <div className="space-y-1.5 p-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-6 bg-surface-2/50 animate-pulse rounded-[1px]" />
                      ))}
                    </div>
                  ) : filteredEntities.length === 0 ? (
                    <p className="text-xs text-content-3/60 italic p-3">Nessun elemento registrato.</p>
                  ) : (
                    filteredEntities.map((ent) => (
                      <button
                        key={ent._id}
                        type="button"
                        onClick={() => {
                          setHighlightedEntityId(ent._id);
                          setDetailEntity(ent);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors truncate flex items-center justify-between gap-2 cursor-pointer font-sans ${
                          highlightedEntityId === ent._id || detailEntity?._id === ent._id
                            ? 'bg-surface-2/50 text-primary font-medium border-l-2 border-primary'
                            : 'text-content-2/80 hover:text-content-1 hover:bg-surface-2/20 border-l-2 border-transparent'
                        }`}
                      >
                        <span className="truncate">{ent.name}</span>
                        <span className="text-[9px] font-mono text-content-3/50 shrink-0">
                          {ent.status === 'alive' || ent.status === 'open' ? '●' : '○'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Right Main Content Area */}
            <main className="lg:col-span-9 space-y-5 w-full">
              {/* Action & Filter Header Banner */}
              <div className="border-b border-surface-2/80 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 rounded-[2px] bg-surface-2/60 border border-surface-3 flex items-center justify-center text-primary shrink-0">
                    <ActiveHeraldicIcon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-base sm:text-lg font-cinzel font-semibold text-content-1 truncate">
                        {activeCategory.title}
                      </h1>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-[2px] bg-surface-2 text-content-3 border border-surface-3 shrink-0 hidden xs:inline">
                        {activeCategory.heraldicSigil}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs font-mono text-content-3/80 truncate">
                      {filteredEntities.length} {filteredEntities.length === 1 ? 'voce catalogata' : 'voci catalogate'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-56">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                    <input
                      type="text"
                      placeholder={`Cerca in ${activeCategory.singular}...`}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-surface-1/80 border border-surface-2 focus:border-primary rounded-[2px] pl-8 pr-7 py-1.5 text-xs text-content-1 placeholder-content-3 outline-none transition-colors font-sans"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-surface-1/80 border border-surface-2 rounded-[2px] px-2 py-1 shrink-0">
                    <ArrowUpDown size={11} className="text-content-3 shrink-0" />
                    <select
                      value={sortOrder}
                      onChange={(e) => {
                        setSortOrder(e.target.value as any);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent border-none text-[11px] text-content-2 focus:text-content-1 font-mono outline-none cursor-pointer"
                      title="Ordinamento entità"
                    >
                      <option value="alpha-asc">A-Z</option>
                      <option value="alpha-desc">Z-A</option>
                      <option value="recent">Recenti</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sendipietra / AI Sintonizzazione Filter Bar */}
              <div className="bg-surface-1/40 p-2 flex flex-wrap items-center justify-between gap-2 border border-surface-2/60 text-xs rounded-[2px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-content-3/80 mr-1">Sintonizzazione:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSendipietra(false);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-[2px] text-xs font-mono transition-all cursor-pointer flex items-center gap-1 border ${
                      !filterSendipietra
                        ? 'bg-surface-2 text-content-1 border-surface-3 font-semibold'
                        : 'text-content-3 hover:text-content-1 border-transparent'
                    }`}
                  >
                    Tutti gli elementi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSendipietra(true);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-[2px] text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                      filterSendipietra
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold'
                        : 'text-content-3 hover:text-content-1 border-transparent'
                    }`}
                  >
                    <Sparkles size={11} className={filterSendipietra ? 'text-amber-400 animate-pulse' : 'text-content-3'} />
                    <span>Sintonizzati Sendipietra</span>
                    <span className="text-[9px] font-mono px-1 rounded-[2px] bg-surface-3 text-content-2">
                      {entities.filter(e => e.type === activeType && e.aiConfig?.enabled === true).length}
                    </span>
                  </button>
                </div>

                {filterSendipietra && (
                  <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                    Pronti per la trasmissione mentale
                  </span>
                )}
              </div>

              {/* Quest Scope Filter Bar (Only shown on Quest page) */}
              {activeType === 'quest' && (
                <div className="bg-surface-1/40 p-2 flex flex-wrap items-center justify-between gap-2 border border-surface-2/60 text-xs rounded-[2px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-content-3/80 mr-1">Filtro:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestScopeFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-[2px] text-xs font-mono transition-colors cursor-pointer ${
                        questScopeFilter === 'all'
                          ? 'bg-surface-2 text-primary border border-surface-3 font-semibold'
                          : 'text-content-3 hover:text-content-1'
                      }`}
                    >
                      Tutte
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestScopeFilter('party');
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-[2px] text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                        questScopeFilter === 'party'
                          ? 'bg-surface-2 text-primary border border-surface-3 font-semibold'
                          : 'text-content-3 hover:text-content-1'
                      }`}
                    >
                      <Shield size={11} /> Gruppo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestScopeFilter('personal');
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-[2px] text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                        questScopeFilter === 'personal'
                          ? 'bg-surface-2 text-primary border border-surface-3 font-semibold'
                          : 'text-content-3 hover:text-content-1'
                      }`}
                    >
                      <User size={11} /> Personali
                    </button>
                  </div>

                  {questScopeFilter === 'personal' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-content-3">Personaggio:</span>
                      <select
                        value={personalAssigneeFilter}
                        onChange={(e) => {
                          setPersonalAssigneeFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="bg-surface-0 border border-surface-2 focus:border-primary text-xs text-content-1 rounded-[2px] px-2 py-1 outline-none font-mono"
                      >
                        <option value="all">Tutti</option>
                        {allPlayers.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.characterName} {p.isDm ? '(DM)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Entity Dossier Grid (Investigative Dossiers with fine top hairline, translucent tone, and generous spacing) */}
              {isTabChanging ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 animate-fadeIn">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={`skeleton-${idx}`}
                      className="border border-surface-2/60 border-t-2 border-t-surface-3 bg-surface-1/20 rounded-[2px] p-4 sm:p-5 space-y-3 min-h-[140px]"
                    >
                      <div className="h-3 bg-surface-2 animate-pulse rounded w-1/3" />
                      <div className="h-5 bg-surface-2 animate-pulse rounded w-3/4" />
                      <div className="h-3.5 bg-surface-2 animate-pulse rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="border border-surface-2/60 bg-surface-1/30 rounded-[2px] py-14 px-4 text-center animate-fadeIn space-y-2">
                  <ActiveIcon size={32} className="mx-auto text-content-3 opacity-40" />
                  <p className="text-xs sm:text-sm font-cinzel text-content-2">
                    Nessun fascicolo rinvenuto per {activeCategory.singular.toLowerCase()}.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(activeType)}
                    className="mt-2 px-3 py-1 rounded-[2px] text-xs font-mono text-primary hover:underline cursor-pointer"
                  >
                    + Trascrivi ora
                  </button>
                </div>
              ) : (
                <div
                  key={`list-${activeType}`}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 animate-fadeIn"
                >
                  {currentEntities.map((ent, idx) => {
                    const isHighlighted = highlightedEntityId === ent._id;
                    const previewText = ent.aliases && ent.aliases.length > 0
                      ? `Alias: ${ent.aliases.join(' · ')}`
                      : ent.progressNote
                      ? ent.progressNote.replace(/[#*`_]/g, '').trim()
                      : undefined;
                    const archiveRef = `REF-${String(idx + 1 + (currentPage - 1) * 9).padStart(3, '0')}`;

                    return (
                      <article
                        id={`entity-${ent._id}`}
                        key={ent._id}
                        onClick={() => setDetailEntity(ent)}
                        className={`rounded-[2px] p-4 sm:p-5 transition-all duration-200 text-left flex flex-col justify-between gap-3 group cursor-pointer relative border border-surface-2/60 hover:border-primary/50 border-t-2 border-t-primary/70 bg-surface-1/40 hover:bg-surface-1/70 backdrop-blur-xs shadow-xs hover:shadow-md ${
                          isHighlighted ? 'border-primary border-t-primary bg-surface-2/50 ring-1 ring-primary/40' : ''
                        }`}
                      >
                        {/* Dossier Header Tag & Status */}
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between gap-2 border-b border-surface-2/40 pb-1.5">
                            {(() => {
                              const entCat = CATEGORY_DEFINITIONS[ent.type] || activeCategory;
                              return (
                                <span className="text-[9px] font-mono tracking-widest text-content-3/70 uppercase flex items-center gap-1">
                                  <span>{archiveRef}</span>
                                  <span>&bull;</span>
                                  <span className={activeType === 'all' ? `${entCat.color} font-semibold` : ''}>{entCat.singular.toUpperCase()}</span>
                                </span>
                              );
                            })()}

                            <div className="flex items-center gap-1.5 shrink-0">
                              {renderStatusBadge(ent.status)}

                              {/* Mini Feature Badges */}
                              {ent.aiConfig?.enabled && (
                                <span
                                  className="text-amber-400/90 ml-0.5"
                                  title="Sintonizzazione Sendipietra attiva"
                                >
                                  <Sparkles size={11} />
                                </span>
                              )}
                              {activeType === 'place' && ent.mapId && (
                                <span
                                  className="text-primary opacity-80"
                                  title="Posizionato sull'Atlante"
                                >
                                  <MapPin size={11} />
                                </span>
                              )}
                              {activeType === 'quest' && ent.questPrivacy === 'private' && (
                                <span
                                  className="text-purple-400 opacity-80"
                                  title="Quest segreta"
                                >
                                  <Lock size={11} />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Dossier Hero Name & Subtitle/Description */}
                          <div className="space-y-1">
                            <h3 className="font-cinzel text-base sm:text-[1.05rem] font-semibold text-content-1 leading-snug group-hover:text-primary transition-colors tracking-wide">
                              <EntityMentionText text={ent.name} />
                            </h3>

                            <p className="text-[0.82rem] text-content-3/80 font-sans leading-relaxed line-clamp-3">
                              {previewText || <span className="italic opacity-40 text-xs">Nessuna annotazione registrata nel fascicolo</span>}
                            </p>
                          </div>
                        </div>

                        {/* Dossier Footer Action Link */}
                        <div className="pt-2.5 border-t border-surface-2/40 flex items-center justify-between text-xs font-mono">
                          <span className="text-[9px] text-content-3/60 uppercase tracking-wider">
                            ARCHIVIO CODEX
                          </span>

                          <div className="flex items-center gap-2">
                            {canDeleteEntity && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEntityToDelete(ent._id);
                                }}
                                className="p-1 text-content-3/60 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title={`Elimina ${ent.name} dal Codex`}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}

                            <div className="flex items-center gap-1 text-[11px] font-medium text-primary/80 group-hover:text-primary transition-colors">
                              {ent.aiConfig?.enabled ? (
                                <span className="flex items-center gap-1 font-mono text-[10px]">
                                  <MessageSquare size={11} />
                                  <span>Interroga</span>
                                </span>
                              ) : (
                                <span className="font-mono text-[10px]">Apri Fascicolo</span>
                              )}
                              <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="pt-2">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTION MODAL */}
      <AnimatePresence>
        {detailEntity && (
          <Portal>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-0/80 backdrop-blur-sm overflow-y-auto"
              onClick={() => setDetailEntity(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                className="bg-surface-1 rounded-[2px] max-w-3xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col overflow-hidden border border-surface-2 shadow-2xl shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
              <div className="p-4 sm:p-5 border-b border-surface-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[2px] border flex items-center justify-center shrink-0 ${
                    CATEGORY_DEFINITIONS[detailEntity.type || 'npc']?.bgGlow || 'bg-surface-2'
                  }`}>
                    {React.createElement(
                      CATEGORY_DEFINITIONS[detailEntity.type || 'npc']?.icon || Users,
                      { size: 20 }
                    )}
                  </div>
                  <div>
                    <h2 className="font-cinzel font-semibold text-lg sm:text-xl text-content-1">
                      <EntityMentionText text={detailEntity.name} />
                    </h2>
                    {detailEntity.aliases && detailEntity.aliases.length > 0 && (
                      <p className="text-[11px] text-content-3 font-mono">
                        Alias: {detailEntity.aliases.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailEntity(null);
                      navigate(`/prismalink?entityId=${detailEntity._id}`);
                    }}
                    className={`px-3 py-1.5 rounded-[2px] text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border ${
                      detailEntity.aiConfig?.enabled
                        ? 'bg-primary text-surface-0 border-primary hover:bg-primary-hover'
                        : 'bg-surface-2 text-content-1 border-surface-3 hover:bg-surface-3'
                    }`}
                    title={`Interroga ${detailEntity.name} in Sendipietra`}
                  >
                    <Bot size={13} />
                    <span className="hidden sm:inline">Sendipietra</span>
                    <span className="sm:hidden">AI</span>
                  </button>
                  {detailEntity.type === 'place' && (
                    <button
                      type="button"
                      onClick={() => navigate('/map')}
                      className="px-3 py-1.5 rounded-[2px] bg-surface-2 text-content-1 hover:bg-surface-3 font-medium text-xs font-mono flex items-center gap-1.5 transition-colors border border-surface-3 cursor-pointer"
                      title="Visualizza nell'Atlante Cartografico"
                    >
                      <MapIcon size={13} className="text-primary" />
                      <span>Atlante</span>
                      <ExternalLink size={10} className="text-content-3" />
                    </button>
                  )}
                  {canEditEntity && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(detailEntity)}
                      className="px-3.5 py-1.5 rounded-[2px] bg-primary text-surface-0 hover:bg-primary-hover font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer font-mono"
                    >
                      <Edit3 size={13} />
                      <span>Modifica</span>
                    </button>
                  )}
                  {canDeleteEntity && (
                    <button
                      type="button"
                      onClick={() => {
                        const idToDelete = detailEntity._id;
                        setDetailEntity(null);
                        setEntityToDelete(idToDelete);
                      }}
                      className="px-3 py-1.5 rounded-[2px] bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 font-medium text-xs font-mono flex items-center gap-1.5 transition-colors border border-red-800/50 cursor-pointer"
                      title={`Elimina ${detailEntity.name} dal Codex`}
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Elimina</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailEntity(null)}
                    className="p-1.5 text-content-3 hover:text-content-1 rounded-[2px] hover:bg-surface-2 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusBadge(detailEntity.status)}
                  {detailEntity.questScope && (
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-2 text-content-2 border border-surface-3 text-xs font-medium">
                      Ambito: {detailEntity.questScope === 'party' ? 'Gruppo' : `Personale (${detailEntity.assigneePlayerName || 'PG'})`}
                    </span>
                  )}
                </div>

                {/* Place Cartography Integration Box */}
                {detailEntity.type === 'place' && (() => {
                  const placeMap = maps.find((m) => m.id === detailEntity.mapId);
                  const linkedFolder = folders.find(
                    (f) => f.placeEntityId === detailEntity._id || (detailEntity.folderId && String(f.id) === String(detailEntity.folderId))
                  );
                  const folderMaps = linkedFolder ? maps.filter((m) => String(m.folderId || '') === linkedFolder.id) : [];
                  const directlyLinkedMaps = maps.filter((m) => m.entityId === detailEntity._id && m.id !== detailEntity.mapId);

                  return (
                    <div className="bg-surface-2 p-4 sm:p-5 rounded-xl border border-surface-3 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                          <MapIcon size={15} className="text-primary" />
                          <span>Collegamento Cartografico &amp; Atlante</span>
                        </h4>
                        {detailEntity.mapId || linkedFolder || detailEntity.isMap ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                            Collegato ad Atlante
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-content-3">
                            Non Collegato
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1 bg-surface-1/60 p-2.5 rounded-lg border border-surface-3/60">
                          <span className="text-content-3 text-[11px] font-medium block">Mappa di Riferimento:</span>
                          <p className="text-content-1 font-medium flex items-center gap-1.5">
                            <Compass size={13} className="text-primary shrink-0" />
                            <span className="truncate">{placeMap?.title || 'Nessuna mappa selezionata'}</span>
                          </p>
                        </div>

                        {detailEntity.pinX !== undefined && detailEntity.pinY !== undefined && (
                          <div className="space-y-1 bg-surface-1/60 p-2.5 rounded-lg border border-surface-3/60">
                            <span className="text-content-3 text-[11px] font-medium block">Coordinate Segnaposto:</span>
                            <p className="text-content-1 font-mono text-[11px]">
                              X: {detailEntity.pinX}% | Y: {detailEntity.pinY}% ({detailEntity.pinCategory || 'city'})
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Linked Map Folder & Sub-maps */}
                      {linkedFolder && (
                        <div className="p-3 rounded-lg bg-surface-1 border border-surface-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FolderIcon size={14} style={{ color: linkedFolder.color || '#d4af37' }} />
                              <span className="text-xs font-semibold text-content-1">
                                Cartella Atlante: {linkedFolder.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-content-3">
                              {folderMaps.length} {folderMaps.length === 1 ? 'mappa' : 'mappe'}
                            </span>
                          </div>

                          {folderMaps.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                              {folderMaps.map((fm) => (
                                <Link
                                  key={fm.id}
                                  to={`/map?mapId=${fm.id}`}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-xs transition-colors group"
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    <MapIcon size={11} className="text-primary group-hover:scale-110 transition-transform" />
                                    {fm.title}
                                  </span>
                                  <ExternalLink size={10} className="opacity-60 group-hover:opacity-100" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Additional maps linked directly */}
                      {directlyLinkedMaps.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-medium text-content-3">Mappe collegate a questo Luogo:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {directlyLinkedMaps.map((dm) => (
                              <Link
                                key={dm.id}
                                to={`/map?mapId=${dm.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-1 border border-surface-3 text-content-2 hover:text-primary text-xs transition-colors"
                              >
                                <MapIcon size={11} />
                                <span>{dm.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-surface-3 flex flex-wrap items-center justify-end gap-2">
                        {linkedFolder && (
                          <Link
                            to={`/map?folderId=${linkedFolder.id}`}
                            className="px-3 py-1.5 rounded-lg bg-surface-1 border border-surface-3 text-content-2 hover:text-content-1 text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <FolderIcon size={13} style={{ color: linkedFolder.color || '#d4af37' }} />
                            <span>Vedi Cartella nell'Atlante</span>
                          </Link>
                        )}
                        {detailEntity.mapId ? (
                          <Link
                            to={`/map?mapId=${detailEntity.mapId}${detailEntity.pinId ? `&pinId=${detailEntity.pinId}` : ''}`}
                            className="px-3 py-1.5 rounded-lg bg-primary text-surface-0 hover:bg-primary-hover text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <Compass size={13} />
                            <span>Centra sulla Mappa</span>
                          </Link>
                        ) : (
                          <Link
                            to={`/map?placeId=${detailEntity._id}&action=place`}
                            className="px-3 py-1.5 rounded-lg bg-primary text-surface-0 hover:bg-primary-hover text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <MapPin size={13} />
                            <span>Piazza ora sull'Atlante</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* AI Persona & Sub-Codex Preview (Protected by Granular DM Permissions) */}
                {detailEntity.aiConfig?.enabled && (
                  canUserViewEntityAi(detailEntity) ? (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Bot size={15} />
                          <span>Agente AI Attivo per Sendipietra</span>
                        </h4>
                        <div className="flex items-center gap-1.5">
                          {player?.isDm && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-content-2 border border-surface-3">
                              {detailEntity.aiConfig.visibilityMode === 'all_players'
                                ? '👥 Visibile Party'
                                : detailEntity.aiConfig.visibilityMode === 'custom'
                                ? `🎯 Visibile a ${detailEntity.aiConfig.allowedViewPlayerIds?.length || 0} PG`
                                : '🔒 Riservato DM'}
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Disponibile in Chat
                          </span>
                        </div>
                      </div>

                      {/* Prominent Current Status Banner */}
                      {detailEntity.aiConfig.currentStatus && (
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs space-y-1">
                          <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>Situazione &amp; Stato Attuale nel Presente:</span>
                          </span>
                          <p className="text-content-1 font-medium leading-relaxed">
                            {detailEntity.aiConfig.currentStatus}
                          </p>
                        </div>
                      )}

                      {detailEntity.aiConfig.speechStyle && (
                        <p className="text-xs text-content-2">
                          <strong className="text-content-1">Stile:</strong> {detailEntity.aiConfig.speechStyle}
                        </p>
                      )}

                      {/* Granular Secrets Section in Detail Drawer */}
                      {(() => {
                        const secretsList: EntitySecretItem[] = Array.isArray(detailEntity.aiConfig.secrets) && detailEntity.aiConfig.secrets.length > 0
                          ? detailEntity.aiConfig.secrets
                          : (detailEntity.aiConfig.secretsToProtect?.trim()
                              ? [{ id: 'sec_legacy_1', title: detailEntity.aiConfig.secretsToProtect.trim(), isRevealed: false }]
                              : []);

                        if (secretsList.length === 0) return null;

                        const revealedSecrets = secretsList.filter((s) => s.isRevealed);
                        const isUserDm = !!player?.isDm;

                        // Non-DMs only see secrets that were explicitly revealed
                        if (!isUserDm && revealedSecrets.length === 0) return null;

                        return (
                          <div className="p-3 rounded-xl bg-surface-1/90 border border-primary/25 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Lock size={12} className={isUserDm ? 'text-amber-400' : 'text-emerald-400'} />
                                <span>{isUserDm ? 'Segreti &amp; Rivelazioni (Controllo DM):' : 'Dettagli &amp; Segreti Svelati:'}</span>
                              </span>
                              {isUserDm && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  {revealedSecrets.length}/{secretsList.length} svelati al party
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {(isUserDm ? secretsList : revealedSecrets).map((sec, idx) => (
                                <div
                                  key={sec.id || idx}
                                  className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-all ${
                                    sec.isRevealed
                                      ? 'bg-emerald-500/10 border-emerald-500/30'
                                      : 'bg-amber-500/10 border-amber-500/25'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                                            sec.isRevealed
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          }`}
                                        >
                                          {sec.isRevealed ? '🔓 Svelato al Party' : '🔒 Custodito (DM)'}
                                        </span>
                                        {sec.revealedAt && (
                                          <span className="text-[10px] text-content-3 font-mono">
                                            Svelato il {new Date(sec.revealedAt).toLocaleDateString('it-IT')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-content-1 font-medium font-mono text-[11px] leading-relaxed pt-0.5">
                                        {sec.title}
                                      </p>
                                    </div>

                                    {/* DM 1-Click Reveal / Conceal Toggle Button */}
                                    {isUserDm && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (sec.isRevealed) {
                                            CampaignManager.concealEntitySecret(detailEntity._id, sec.id);
                                          } else {
                                            CampaignManager.revealEntitySecret(detailEntity._id, sec.id, player?.characterName);
                                          }
                                          const updatedList = CampaignManager.getEntities();
                                          setEntities(updatedList);
                                          const targetEnt = updatedList.find((e) => e._id === detailEntity._id);
                                          if (targetEnt) setDetailEntity(targetEnt);
                                        }}
                                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-2xs ${
                                          sec.isRevealed
                                            ? 'bg-surface-2 hover:bg-surface-3 text-content-2 border border-surface-3'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-surface-0 font-bold border border-emerald-500'
                                        }`}
                                        title={sec.isRevealed ? 'Nascondi nuovamente questo segreto al party' : 'Svela subito questo segreto e invia notifica al party'}
                                      >
                                        {sec.isRevealed ? (
                                          <>
                                            <Lock size={11} />
                                            <span>Nascondi al Party</span>
                                          </>
                                        ) : (
                                          <>
                                            <Unlock size={11} />
                                            <span>Svela al Party</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {sec.revelationCondition && isUserDm && (
                                    <div className="pt-1 border-t border-surface-3/50 flex items-center gap-1.5 text-[10px] text-content-3 font-mono">
                                      <span className="font-semibold text-amber-300/80">Condizione sblocco:</span>
                                      <span className="italic">{sec.revelationCondition}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Party Relations List Preview */}
                      {detailEntity.aiConfig.partyRelations && Object.keys(detailEntity.aiConfig.partyRelations).length > 0 && (
                        <div className="pt-2 border-t border-primary/20">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block mb-1.5">
                            Relazioni con il Party &amp; DM:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {Object.values(detailEntity.aiConfig.partyRelations).map((rel) => {
                              if (!rel.relationType && !rel.notes && !rel.attitude) return null;
                              const attitudeBadges: Record<string, string> = {
                                friendly: '😊 Amichevole',
                                helpful: '🤝 Disponibile',
                                neutral: '😐 Neutrale',
                                suspicious: '🤨 Diffidente',
                                hostile: '😡 Ostile',
                                fearful: '😨 Timoroso',
                                devoted: '👑 Devoto',
                              };
                              return (
                                <div key={rel.playerId} className="p-2.5 rounded-lg bg-surface-1/80 border border-surface-3/80 text-xs space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-content-1">{rel.characterName || 'PG'}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-content-2 border border-surface-3">
                                      {attitudeBadges[rel.attitude || 'neutral']}
                                    </span>
                                  </div>
                                  {rel.relationType && (
                                    <p className="text-[11px] text-primary font-medium">Legame: {rel.relationType}</p>
                                  )}
                                  {rel.notes && (
                                    <p className="text-[11px] text-content-3 italic">{rel.notes}</p>
                                  )}

                                  {/* Milestones Progression Timeline */}
                                  {rel.progression && rel.progression.length > 0 && (
                                    <div className="mt-2 pt-1.5 border-t border-surface-3/60 space-y-1">
                                      <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                        <Clock size={10} />
                                        <span>Cronologia Svolte Storiche ({rel.progression.length}):</span>
                                      </span>
                                      <div className="space-y-1 pl-1.5 border-l-2 border-primary/30">
                                        {rel.progression.map((m, mIdx) => (
                                          <div key={mIdx} className="text-[10px] leading-tight space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-semibold text-content-1">
                                                {m.sessionNumber ? `Sess. ${m.sessionNumber}` : m.sessionTitle || 'Sessione'}
                                              </span>
                                              {m.loreDate && (
                                                <span className="font-mono text-content-3">⏳ {m.loreDate}</span>
                                              )}
                                              <span className="px-1 py-0.2 rounded bg-surface-2 text-content-2 border border-surface-3">
                                                {attitudeBadges[m.attitude] || m.attitude}
                                              </span>
                                            </div>
                                            <p className="text-content-3 italic pl-1">&ldquo;{m.event}&rdquo;</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Codex Entity-to-Entity Relations List Preview */}
                      {detailEntity.aiConfig.entityRelations && Object.keys(detailEntity.aiConfig.entityRelations).length > 0 && (
                        <div className="pt-2 border-t border-primary/20">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block mb-1.5">
                            Relazioni con Altre Entità del Compendio:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {Object.values(detailEntity.aiConfig.entityRelations).map((rel) => {
                              if (!rel.relationType && !rel.notes && !rel.attitude) return null;
                              const targetEnt = CampaignManager.getEntities().find((e) => e._id === rel.targetEntityId);
                              const attitudeBadges: Record<string, string> = {
                                friendly: '😊 Amichevole',
                                helpful: '🤝 Disponibile',
                                neutral: '😐 Neutrale',
                                suspicious: '🤨 Diffidente',
                                hostile: '😡 Ostile',
                                fearful: '😨 Timoroso',
                                devoted: '👑 Devoto',
                              };
                              return (
                                <div key={rel.targetEntityId} className="p-2.5 rounded-lg bg-surface-1/80 border border-surface-3/80 text-xs space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-content-1 truncate">
                                      {targetEnt?.name || rel.targetEntityName || 'Entità'}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-content-2 border border-surface-3">
                                      {attitudeBadges[rel.attitude || 'neutral']}
                                    </span>
                                  </div>
                                  {rel.relationType && (
                                    <p className="text-[11px] text-primary font-medium">Legame: {rel.relationType}</p>
                                  )}
                                  {rel.notes && (
                                    <p className="text-[11px] text-content-3 italic">{rel.notes}</p>
                                  )}

                                  {/* Milestones Progression Timeline between Entities */}
                                  {rel.progression && rel.progression.length > 0 && (
                                    <div className="mt-2 pt-1.5 border-t border-surface-3/60 space-y-1">
                                      <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                        <Clock size={10} />
                                        <span>Cronologia Svolte ({rel.progression.length}):</span>
                                      </span>
                                      <div className="space-y-1 pl-1.5 border-l-2 border-primary/30">
                                        {rel.progression.map((m, mIdx) => (
                                          <div key={mIdx} className="text-[10px] leading-tight space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-semibold text-content-1">
                                                {m.sessionNumber ? `Sess. ${m.sessionNumber}` : m.sessionTitle || 'Sessione'}
                                              </span>
                                              {m.loreDate && (
                                                <span className="font-mono text-content-3">⏳ {m.loreDate}</span>
                                              )}
                                              <span className="px-1 py-0.2 rounded bg-surface-2 text-content-2 border border-surface-3">
                                                {attitudeBadges[m.attitude] || m.attitude}
                                              </span>
                                            </div>
                                            <p className="text-content-3 italic pl-1">&ldquo;{m.event}&rdquo;</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Timeline Memories Preview */}
                      {detailEntity.aiConfig.timelineMemories && detailEntity.aiConfig.timelineMemories.length > 0 && (
                        <div className="pt-2 border-t border-primary/20 space-y-1.5">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block">
                            Cronologia Memorie di Lore ({detailEntity.aiConfig.timelineMemories.length}):
                          </span>
                          <div className="space-y-1.5">
                            {detailEntity.aiConfig.timelineMemories.map((mem, idx) => (
                              <div key={mem.id || idx} className="p-2 rounded-lg bg-surface-1/80 border border-surface-3/80 text-xs space-y-0.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-content-1">{mem.title}</span>
                                  {mem.loreDate && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-2">
                                      ⏳ {mem.loreDate}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-content-3 leading-relaxed">{mem.summary}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evolving Beliefs Preview */}
                      {detailEntity.aiConfig.evolvingBeliefs && detailEntity.aiConfig.evolvingBeliefs.length > 0 && (
                        <div className="pt-2 border-t border-primary/20 space-y-1.5">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block">
                            Teorie &amp; Credenze Evolutive ({detailEntity.aiConfig.evolvingBeliefs.length}):
                          </span>
                          <div className="space-y-1.5">
                            {detailEntity.aiConfig.evolvingBeliefs.map((bel, idx) => (
                              <div key={bel.id || idx} className="p-2 rounded-lg bg-surface-1/80 border border-surface-3/80 text-xs space-y-0.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-content-1">Soggetto: {bel.subject}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    {bel.status === 'proven_fact' ? '✅ Verità' : bel.status === 'shattered_belief' ? '❌ Smentita' : '💡 Teoria'}
                                  </span>
                                </div>
                                {bel.previousBelief && (
                                  <p className="text-[10px] text-content-3 line-through opacity-70">
                                    Prima: {bel.previousBelief}
                                  </p>
                                )}
                                <p className="text-[11px] text-content-2 font-mono">
                                  👉 Ora: {bel.currentTruth}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Known Sessions Preview */}
                      {detailEntity.aiConfig.knownSessionIds && detailEntity.aiConfig.knownSessionIds.length > 0 && (
                        <div className="pt-2 border-t border-primary/20">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block mb-1">
                            Sessioni Vissute o Conosciute:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {detailEntity.aiConfig.knownSessionIds.map((sId) => {
                              const sess = CampaignManager.getSessions().find((s) => s._id === sId);
                              if (!sess) return null;
                              return (
                                <span key={sId} className="px-2 py-0.5 rounded bg-surface-1 border border-surface-3 text-[11px] text-content-2 font-mono">
                                  Sessione {sess.number}: {sess.title}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Known Entities Preview */}
                      {detailEntity.aiConfig.knownEntityIds && detailEntity.aiConfig.knownEntityIds.length > 0 && (
                        <div className="pt-2 border-t border-primary/20">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block mb-1">
                            Entità del Compendio Conosciute:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {detailEntity.aiConfig.knownEntityIds.map((eId) => {
                              const ent = CampaignManager.getEntities().find((e) => e._id === eId);
                              if (!ent) return null;
                              return (
                                <span key={eId} className="px-2 py-0.5 rounded bg-surface-1 border border-surface-3 text-[11px] text-content-2 font-mono">
                                  {ent.name} ({ent.type.toUpperCase()})
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* World Lore Connected Knowledge Preview */}
                      {(() => {
                        const worldArticles = CampaignManager.getWorldLoreArticles();
                        const connectedBites: { article: any; bite: any }[] = [];
                        worldArticles.forEach((art) => {
                          (art.bites || []).forEach((b) => {
                            if (b.knownBy?.some((k) => k.id === detailEntity._id && k.type === 'entity')) {
                              connectedBites.push({ article: art, bite: b });
                            }
                          });
                        });

                        if (connectedBites.length === 0) return null;

                        return (
                          <div className="pt-2 border-t border-primary/20 space-y-1.5">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono flex items-center justify-between">
                              <span>Conoscenze di World Lore Custodite ({connectedBites.length}):</span>
                            </span>
                            <div className="space-y-1">
                              {connectedBites.map(({ article, bite }) => (
                                <div
                                  key={`${article._id}_${bite.id}`}
                                  className="p-2 rounded-lg bg-surface-1/80 border border-surface-3/80 text-xs flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-content-1 block truncate">{bite.title}</span>
                                    <span className="text-[10px] text-content-3 truncate">Da: {article.title}</span>
                                  </div>
                                  <Link
                                    to={`/world-lore/${article._id}`}
                                    className="p-1 rounded text-primary hover:bg-primary/10 transition-colors shrink-0"
                                    title="Vedi articolo World Lore"
                                  >
                                    <ExternalLink size={12} />
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3 text-xs text-content-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-amber-400 shrink-0" />
                        <span>I dettagli di conoscenza e i segreti di questo PNG sono protetti e riservati al DM.</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-1 text-content-3 border border-surface-3">
                        Privato
                      </span>
                    </div>
                  )
                )}

                {/* Progress Note / Description */}
                <div>
                  <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider mb-2">
                    Note &amp; Dettagli Narrativi
                  </h4>
                  {detailEntity.progressNote ? (
                    <div className="bg-surface-2 p-5 rounded-xl border border-surface-3 text-sm text-content-2 leading-relaxed text-pretty">
                      <MarkdownRenderer content={detailEntity.progressNote} />
                    </div>
                  ) : (
                    <p className="text-xs text-content-3 italic">Nessuna informazione o nota registrata.</p>
                  )}
                </div>

                {/* Image Gallery */}
                {detailEntity.images && detailEntity.images.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider mb-2">
                      Galleria Immagini ({detailEntity.images.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {detailEntity.images.filter((img) => img && typeof img === 'string' && img.trim()).map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveLightboxImg(img)}
                          className="aspect-video rounded-xl overflow-hidden cursor-pointer bg-surface-2 border border-surface-3 relative group"
                        >
                          <img
                            src={img}
                            alt="Dettaglio"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </Portal>
      )}
    </AnimatePresence>

    {/* CREATE / EDIT ENTITY MODAL */}
    {isModalOpen && (
      <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-1 rounded-2xl max-w-3xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col border border-surface-2 shadow-2xl overflow-hidden shrink-0">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-surface-2 p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                {React.createElement(CATEGORY_DEFINITIONS[formType]?.icon || Users, { size: 18, className: 'text-primary' })}
                <h3 className="font-heading font-semibold text-lg text-content-1">
                  {isEditing
                    ? `Modifica ${CATEGORY_DEFINITIONS[formType]?.singular || 'Entità'}`
                    : `Aggiungi ${CATEGORY_DEFINITIONS[formType]?.singular || 'Entità'}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-content-3 hover:text-content-1 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEntity} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-4">
                {/* Category Type Selector */}
                <div>
                  <label className="block text-xs font-medium text-content-2 mb-1.5">
                    Categoria Codex <span className="text-primary">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES_LIST.map((c) => {
                      const CatIcon = c.icon;
                      const isSelected = formType === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={isEditing}
                          onClick={() => setFormType(c.id)}
                          className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-primary text-surface-0 border-primary shadow-sm font-semibold'
                              : 'bg-surface-2 border-surface-3 text-content-2 hover:text-content-1 disabled:opacity-60'
                          }`}
                        >
                          <CatIcon size={14} />
                          <span className="truncate">{c.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-content-2 mb-1.5">
                    Nome {CATEGORY_DEFINITIONS[formType]?.singular} <span className="text-primary">*</span>
                  </label>
                  <MentionInput
                    required
                    placeholder={`Es. ${formType === 'quest' ? 'Trovare la reliquia' : formType === 'place' ? 'Neverwinter' : 'Geralt di Rivia'}`}
                    value={newName}
                    onValueChange={setNewName}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-content-1 placeholder-content-3 outline-none transition-colors"
                  />
                </div>

                {/* Quest Scope Selector */}
                {formType === 'quest' && (
                  <div className="p-4 bg-surface-2 border border-surface-3 rounded-xl space-y-3">
                    <label className="block text-xs font-medium text-content-2">
                      Tipologia &amp; Ambito della Quest <span className="text-primary">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewQuestScope('party')}
                        className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                          newQuestScope === 'party'
                            ? 'bg-primary text-surface-0 border-primary shadow-sm'
                            : 'bg-surface-1 border-surface-3 text-content-2 hover:text-content-1'
                        }`}
                      >
                        <Shield size={16} />
                        <span>Quest di Gruppo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQuestScope('personal')}
                        className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                          newQuestScope === 'personal'
                            ? 'bg-primary text-surface-0 border-primary shadow-sm'
                            : 'bg-surface-1 border-surface-3 text-content-2 hover:text-content-1'
                        }`}
                      >
                        <User size={16} />
                        <span>Quest Personale</span>
                      </button>
                    </div>

                    {newQuestScope === 'personal' && (
                      <div className="space-y-3 pt-1 border-t border-surface-3">
                        <div>
                          <label className="block text-xs font-medium text-content-3 mb-1.5">
                            Assegnata al Personaggio:
                          </label>
                          <select
                            value={newAssigneeId}
                            onChange={(e) => setNewAssigneeId(e.target.value)}
                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-sm text-content-1 outline-none"
                          >
                            {allPlayers.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.characterName} {p.isDm ? '(Dungeon Master)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-content-3 mb-1.5">
                            Privacy &amp; Visibilità tra i Giocatori:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewQuestPrivacy('public')}
                              className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                                newQuestPrivacy === 'public'
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40 font-semibold'
                                  : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                              }`}
                            >
                              <Eye size={14} />
                              <span>Condivisa con il gruppo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setNewQuestPrivacy('private')}
                              className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                                newQuestPrivacy === 'private'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/40 font-semibold'
                                  : 'bg-surface-1 border-surface-3 text-content-3 hover:text-content-1'
                              }`}
                            >
                              <Lock size={14} />
                              <span>Riservata / Segreta</span>
                            </button>
                          </div>
                        </div>

                        {newQuestPrivacy === 'private' && !player?.isDm && (
                          <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg hover:bg-amber-500/20 transition-colors">
                            <input
                              type="checkbox"
                              checked={newSharedWithDm}
                              onChange={(e) => setNewSharedWithDm(e.target.checked)}
                              className="rounded-[2px] border-amber-500/50 text-amber-600 focus:ring-0"
                            />
                            <span className="font-medium">Permetti al Dungeon Master di leggere questa quest (👑 DM)</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Place Map Integration Settings */}
                {formType === 'place' && (
                  <div className="p-4 bg-surface-2 border border-surface-3 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-content-1 flex items-center gap-1.5">
                        <MapIcon size={14} className="text-primary" />
                        <span>Collegamento Cartografico (Atlante)</span>
                      </label>
                      <span className="text-[10px] text-content-3">Sincronizzazione bi-direzionale</span>
                    </div>

                    {/* Folder Assignment */}
                    <div>
                      <label className="block text-xs font-medium text-content-3 mb-1 flex items-center gap-1.5">
                        <FolderIcon size={12} className="text-primary" />
                        <span>Cartella Mappe Atlante:</span>
                      </label>
                      <select
                        value={newFolderId}
                        onChange={(e) => setNewFolderId(e.target.value)}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none"
                      >
                        <option value="">-- Nessuna Cartella Assegnata --</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name} ({maps.filter((m) => m.folderId === f.id).length} mappe)
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-content-3 mt-1">
                        Le mappe raggruppate in questa cartella dell'Atlante saranno collegate automaticamente a questo luogo.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-content-3 mb-1">
                          Mappa di Riferimento (Ancoraggio):
                        </label>
                        <select
                          value={newMapId}
                          onChange={(e) => setNewMapId(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none"
                        >
                          <option value="">-- Nessuna (Non ancorato) --</option>
                          {maps.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title} ({m.pins?.length || 0} punti)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-content-3 mb-1">
                          Tipologia Segnaposto (Icona):
                        </label>
                        <select
                          value={newPinCategory}
                          onChange={(e) => setNewPinCategory(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none capitalize"
                        >
                          <option value="city">Città / Insediamento</option>
                          <option value="dungeon">Dungeon / Sotterraneo</option>
                          <option value="tavern">Taverna / Locanda</option>
                          <option value="ruins">Rovine / Antico</option>
                          <option value="landmark">Punto di Riferimento</option>
                          <option value="danger">Zona Pericolosa</option>
                          <option value="quest">Obiettivo Quest</option>
                          <option value="faction">Sede Fazione</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-content-3 mb-1">
                          Posizione Orizzontale X (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={newPinX}
                          onChange={(e) => setNewPinX(Number(e.target.value))}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-1.5 text-xs text-content-1 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-content-3 mb-1">
                          Posizione Verticale Y (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={newPinY}
                          onChange={(e) => setNewPinY(Number(e.target.value))}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-1.5 text-xs text-content-1 outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-surface-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-content-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newIsMap}
                          onChange={(e) => setNewIsMap(e.target.checked)}
                          className="rounded border-surface-3 text-primary focus:ring-primary"
                        />
                        <span>Questo luogo contiene una sua mappa dettagliata</span>
                      </label>
                    </div>

                    {newIsMap && (
                      <div>
                        <label className="block text-xs font-medium text-content-3 mb-1">
                          URL Immagine Cartografica:
                        </label>
                        <input
                          type="text"
                          placeholder="https://... mappa dettagliata della città o dungeon"
                          value={newMapImageUrl}
                          onChange={(e) => setNewMapImageUrl(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1.5">
                      Titolo / Alias / Soprannome
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Il Lupo Bianco"
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-content-1 placeholder-content-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1.5">
                      Stato
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-content-1 outline-none"
                    >
                      {formType === 'quest' ? (
                        <>
                          <option value="open">Aperta / In Corso</option>
                          <option value="completed">Completata</option>
                          <option value="failed">Fallita</option>
                        </>
                      ) : (
                        <>
                          <option value="alive">In Vita / Operativo</option>
                          <option value="dead">Morto / Distrutto</option>
                          <option value="unknown">Sconosciuto</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* AI Persona & Sub-Codex Configuration (Prismalink) */}
                <div className="p-4 bg-surface-2 border border-surface-3 rounded-xl space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsAiSectionOpen(!isAiSectionOpen)}
                  >
                    <div className="flex items-center gap-2">
                      <Bot size={18} className="text-primary" />
                      <div>
                        <h4 className="text-xs font-bold text-content-1 flex items-center gap-2">
                          <span>Configurazione Agente AI &amp; Sotto-Codex</span>
                          {newAiEnabled && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                              ● Attivo per Sendipietra
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-content-3">
                          Imposta la personalità, l'accento, i permessi di lettura/modifica del party e i segreti per Sendipietra.
                        </p>
                      </div>
                    </div>
                    <button type="button" className="p-1 text-content-3 hover:text-content-1">
                      {isAiSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {isAiSectionOpen && (
                    <div className="pt-3 border-t border-surface-3 space-y-3.5 animate-fadeIn">
                      {!canUserEditEntityAi(selectedEntityId ? entities.find((e) => e._id === selectedEntityId) : null) ? (
                        <div className="p-3.5 bg-surface-1 rounded-xl border border-surface-3 flex items-center gap-2.5 text-xs text-content-3">
                          <Lock size={16} className="text-amber-400 shrink-0" />
                          <span>La configurazione dell'Agente AI e i segreti di questa entità sono protetti e modificabili esclusivamente dal Dungeon Master o da giocatori autorizzati.</span>
                        </div>
                      ) : (
                        <>
                          {/* Enable Toggle */}
                          <label className="flex items-center gap-2.5 p-2.5 bg-surface-1 rounded-lg border border-surface-3 cursor-pointer hover:bg-surface-3/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={newAiEnabled}
                              onChange={(e) => setNewAiEnabled(e.target.checked)}
                              className="rounded border-surface-3 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-content-1 block">Abilita Interrogazione AI per questa entità</span>
                              <span className="text-content-3 text-[11px]">Consente ai giocatori e al DM di selezionare ed interrogare questo personaggio in Sendipietra</span>
                            </div>
                          </label>

                          {/* Granular DM Permissions & Secrecy Card (Only DM can configure access policy) */}
                          {player?.isDm && (
                            <div className="p-3.5 rounded-xl bg-surface-1 border border-primary/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                  <Shield size={14} className="text-primary" />
                                  <span>Permessi Party &amp; Segretezza Sotto-Codex (Controllo DM)</span>
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  Privacy NPC
                                </span>
                              </div>
                              <p className="text-[11px] text-content-3">
                                Decidi chi nel party può consultare o gestire la scheda AI, il sotto-codex e i rapporti con questo PNG.
                              </p>

                              {/* Mode selector pills */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setNewAiVisibilityMode('dm_only')}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    newAiVisibilityMode === 'dm_only'
                                      ? 'bg-primary/15 border-primary text-content-1 shadow-xs'
                                      : 'bg-surface-2 border-surface-3 text-content-2 hover:bg-surface-3/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                                    <Lock size={12} className="text-amber-400" />
                                    <span>Riservato al DM</span>
                                  </div>
                                  <p className="text-[10px] text-content-3">Solo il DM può leggere o modificare il sotto-codex e i segreti.</p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setNewAiVisibilityMode('all_players')}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    newAiVisibilityMode === 'all_players'
                                      ? 'bg-primary/15 border-primary text-content-1 shadow-xs'
                                      : 'bg-surface-2 border-surface-3 text-content-2 hover:bg-surface-3/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                                    <Users size={12} className="text-emerald-400" />
                                    <span>Tutto il Party</span>
                                  </div>
                                  <p className="text-[10px] text-content-3">Tutti i giocatori possono leggere lo stato e il sotto-codex.</p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setNewAiVisibilityMode('custom')}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    newAiVisibilityMode === 'custom'
                                      ? 'bg-primary/15 border-primary text-content-1 shadow-xs'
                                      : 'bg-surface-2 border-surface-3 text-content-2 hover:bg-surface-3/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                                    <Sparkles size={12} className="text-primary" />
                                    <span>Permessi Singoli</span>
                                  </div>
                                  <p className="text-[10px] text-content-3">Assegna permessi personalizzati di lettura o modifica per PG.</p>
                                </button>
                              </div>

                              {/* Granular per-player checklist if custom */}
                              {newAiVisibilityMode === 'custom' && (
                                <div className="pt-2.5 border-t border-surface-3 space-y-2">
                                  <span className="text-[11px] font-bold text-content-2 uppercase tracking-wider font-mono block">
                                    Autorizzazioni Singole per Giocatore:
                                  </span>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {allPlayers.filter((p) => !p.isDm).map((p) => {
                                      const canView = newAiAllowedViewPlayerIds.includes(p._id);
                                      const canEdit = newAiAllowedEditPlayerIds.includes(p._id);

                                      const toggleView = () => {
                                        setNewAiAllowedViewPlayerIds((prev) =>
                                          canView ? prev.filter((id) => id !== p._id) : [...prev, p._id]
                                        );
                                      };

                                      const toggleEdit = () => {
                                        setNewAiAllowedEditPlayerIds((prev) =>
                                          canEdit ? prev.filter((id) => id !== p._id) : [...prev, p._id]
                                        );
                                        if (!canEdit && !canView) {
                                          setNewAiAllowedViewPlayerIds((prev) => [...prev, p._id]);
                                        }
                                      };

                                      return (
                                        <div key={p._id} className="p-2 rounded-lg bg-surface-2 border border-surface-3 flex items-center justify-between gap-2">
                                          <span className="text-xs font-semibold text-content-1 truncate">
                                            {p.characterName || 'Giocatore'}
                                          </span>
                                          <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-1 text-[11px] text-content-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={canView}
                                                onChange={toggleView}
                                                className="rounded border-surface-3 text-primary focus:ring-primary h-3.5 w-3.5"
                                              />
                                              <span>Legge 👁️</span>
                                            </label>
                                            <label className="flex items-center gap-1 text-[11px] text-content-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={canEdit}
                                                onChange={toggleEdit}
                                                className="rounded border-surface-3 text-primary focus:ring-primary h-3.5 w-3.5"
                                              />
                                              <span>Modifica ✏️</span>
                                            </label>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                      {/* Speech Style */}
                      <div>
                        <label className="block text-xs font-medium text-content-2 mb-1 flex items-center gap-1.5">
                          <Sparkles size={12} className="text-primary" />
                          <span>Stile di Parlata &amp; Personalità:</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Es. Parlata formale ed aristocratica, accento romano, cita spesso la Famiglia Von Bergen, è diffidente verso i tiefling..."
                          value={newAiSpeechStyle}
                          onChange={(e) => setNewAiSpeechStyle(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none resize-none font-mono"
                        />
                      </div>

                      {/* Current Status / Present Situation in Campaign */}
                      <div>
                        <label className="block text-xs font-bold text-content-1 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-primary" />
                            <span>Stato / Situazione Attuale nel Presente della Campagna:</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-normal">Priorità nei Saluti &amp; Chat</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Es. Presso l'Accademia T.A.V., ha appena promosso Kaelen e la classe dopo la Sessione 25 e attende le prossime direttive del Consiglio Arcano..."
                          value={newAiCurrentStatus}
                          onChange={(e) => setNewAiCurrentStatus(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none resize-none font-mono"
                        />
                      </div>

                      {/* Granular Secrets List */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-content-1 flex items-center gap-1.5">
                            <Lock size={13} className="text-amber-400" />
                            <span>Segreti Granulari &amp; Limiti di Rivelazione ({newAiSecrets.length})</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newSec: EntitySecretItem = {
                                id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                title: '',
                                revelationCondition: '',
                                isRevealed: false,
                              };
                              setNewAiSecrets([...newAiSecrets, newSec]);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-1 hover:bg-surface-3 text-primary text-xs font-medium border border-surface-3 transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Aggiungi Segreto</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-content-3">
                          Inserisci i segreti custoditi da questo personaggio. Il DM può svelarli singolarmente al party in qualsiasi momento durante la campagna.
                        </p>

                        {newAiSecrets.length === 0 ? (
                          <div className="p-3 rounded-xl bg-surface-1 border border-surface-3/80 text-center text-xs text-content-3">
                            <span>Nessun segreto configurato. Clicca su &quot;Aggiungi Segreto&quot; per inserirne uno.</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {newAiSecrets.map((sec, idx) => (
                              <div key={sec.id} className="p-3 rounded-xl bg-surface-1 border border-surface-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-content-2 font-mono flex items-center gap-1">
                                    <span className="text-primary">#{idx + 1}</span> Segreto:
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = newAiSecrets.map((s) =>
                                          s.id === sec.id ? { ...s, isRevealed: !s.isRevealed } : s
                                        );
                                        setNewAiSecrets(updated);
                                      }}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                                        sec.isRevealed
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                      }`}
                                      title="Clicca per cambiare lo stato di rivelazione"
                                    >
                                      {sec.isRevealed ? (
                                        <>
                                          <Unlock size={11} />
                                          <span>Svelato al Party</span>
                                        </>
                                      ) : (
                                        <>
                                          <Lock size={11} />
                                          <span>Custodito (DM)</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewAiSecrets(newAiSecrets.filter((s) => s.id !== sec.id));
                                      }}
                                      className="p-1 text-content-3 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                      title="Rimuovi questo segreto"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  placeholder="Es. È il vero erede al trono della casata Von Bergen..."
                                  value={sec.title}
                                  onChange={(e) => {
                                    const updated = newAiSecrets.map((s) =>
                                      s.id === sec.id ? { ...s, title: e.target.value } : s
                                    );
                                    setNewAiSecrets(updated);
                                  }}
                                  className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                                />

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-content-3 font-mono shrink-0">Condizione sblocco:</span>
                                  <input
                                    type="text"
                                    placeholder="Es. Se persuaso con DC 15 o se nominano la regina"
                                    value={sec.revelationCondition || ''}
                                    onChange={(e) => {
                                      const updated = newAiSecrets.map((s) =>
                                        s.id === sec.id ? { ...s, revelationCondition: e.target.value } : s
                                      );
                                      setNewAiSecrets(updated);
                                    }}
                                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2 py-1 text-[11px] text-content-2 outline-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Party Relations Matrix */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2.5">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Users size={13} className="text-primary" />
                            <span>Matrice Relazioni con il Party &amp; DM</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-normal">
                            Personalizza atteggiamento e legame con ciascun membro
                          </span>
                        </label>

                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                          {allPlayers.map((p) => {
                            const rel = newPartyRelations[p._id] || {
                              playerId: p._id,
                              characterName: p.characterName || (p.isDm ? 'Dungeon Master' : 'Giocatore'),
                              attitude: 'neutral',
                              relationType: '',
                              notes: '',
                            };

                            const updateRel = (key: string, val: any) => {
                              setNewPartyRelations((prev) => ({
                                ...prev,
                                [p._id]: {
                                  ...rel,
                                  playerId: p._id,
                                  characterName: p.characterName || (p.isDm ? 'Dungeon Master' : 'Giocatore'),
                                  [key]: val,
                                },
                              }));
                            };

                            return (
                              <div key={p._id} className="p-3 rounded-xl bg-surface-1 border border-surface-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-content-1">
                                      {p.characterName || (p.isDm ? 'Dungeon Master' : 'Giocatore')}
                                      {p.isDm && <span className="text-[10px] ml-1.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">DM</span>}
                                    </span>
                                    {p.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />}
                                  </div>

                                  <select
                                    value={rel.attitude || 'neutral'}
                                    onChange={(e) => updateRel('attitude', e.target.value)}
                                    className="bg-surface-2 border border-surface-3 rounded-lg px-2 py-1 text-[11px] text-content-1 font-semibold outline-none focus:border-primary cursor-pointer"
                                  >
                                    <option value="friendly">😊 Amichevole / Alleato</option>
                                    <option value="helpful">🤝 Disponibile / Cooperativo</option>
                                    <option value="neutral">😐 Neutrale / Indifferente</option>
                                    <option value="suspicious">🤨 Diffidente / Sospettoso</option>
                                    <option value="hostile">😡 Ostile / Nemico</option>
                                    <option value="fearful">😨 Timoroso / Sottomesso</option>
                                    <option value="devoted">👑 Devoto / Fedele</option>
                                  </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    placeholder="Tipo legame (es. Nipote, Mentore, Debitore)"
                                    value={rel.relationType || ''}
                                    onChange={(e) => updateRel('relationType', e.target.value)}
                                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Dettaglio o fatto comune (es. Salvato a Largo Agro)"
                                    value={rel.notes || ''}
                                    onChange={(e) => updateRel('notes', e.target.value)}
                                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none"
                                  />
                                </div>

                                {/* Expandable Historical Progression Milestones */}
                                <div className="pt-1.5 border-t border-surface-3/50">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedProgressionPlayerId((prev) => (prev === p._id ? null : p._id))}
                                    className="flex items-center justify-between w-full text-[11px] font-mono text-content-3 hover:text-content-1 transition-colors cursor-pointer py-1"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Clock size={11} className="text-amber-400" />
                                      <span>Cronologia Svolte Storiche ({rel.progression?.length || 0})</span>
                                    </span>
                                    {expandedProgressionPlayerId === p._id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>

                                  {expandedProgressionPlayerId === p._id && (
                                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-primary/30">
                                      {/* Existing milestones */}
                                      {(rel.progression || []).map((m, mIdx) => (
                                        <div key={mIdx} className="p-2 rounded-lg bg-surface-2/60 border border-surface-3 flex items-start justify-between gap-2 text-xs">
                                          <div className="space-y-0.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-content-1 text-[11px]">
                                                {m.sessionNumber ? `Sess. ${m.sessionNumber}` : m.sessionTitle || 'Sessione'}
                                              </span>
                                              {m.loreDate && (
                                                <span className="text-[10px] font-mono text-content-3">⏳ {m.loreDate}</span>
                                              )}
                                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-1 border border-surface-3 text-content-2">
                                                {m.attitude}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-content-2 italic">&ldquo;{m.event}&rdquo;</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedProg = (rel.progression || []).filter((_, idx) => idx !== mIdx);
                                              updateRel('progression', updatedProg);
                                            }}
                                            className="p-1 text-content-3 hover:text-error transition-colors cursor-pointer shrink-0"
                                            title="Rimuovi svolta"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      ))}

                                      {/* Quick Add Milestone row */}
                                      <div className="p-2 rounded-lg bg-surface-2/40 border border-dashed border-surface-3 space-y-1.5">
                                        <span className="text-[10px] font-mono text-content-3 block font-bold">+ Aggiungi Svolta Storica (Milestone):</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                          <input
                                            type="text"
                                            id={`new-milestone-session-${p._id}`}
                                            placeholder="Sessione (es. 25)"
                                            className="bg-surface-1 border border-surface-3 rounded px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                          <input
                                            type="text"
                                            id={`new-milestone-date-${p._id}`}
                                            placeholder="Data Lore (es. 15 Mirtul)"
                                            className="bg-surface-1 border border-surface-3 rounded px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                          <select
                                            id={`new-milestone-att-${p._id}`}
                                            defaultValue="neutral"
                                            className="bg-surface-1 border border-surface-3 rounded px-2 py-1 text-xs text-content-1 outline-none cursor-pointer"
                                          >
                                            <option value="friendly">😊 Amichevole</option>
                                            <option value="helpful">🤝 Disponibile</option>
                                            <option value="neutral">😐 Neutrale</option>
                                            <option value="suspicious">🤨 Diffidente</option>
                                            <option value="hostile">😡 Ostile</option>
                                            <option value="fearful">😨 Timoroso</option>
                                            <option value="devoted">👑 Devoto</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="text"
                                            id={`new-milestone-event-${p._id}`}
                                            placeholder="Descrizione svolta (es. Scontro sul tomo proibito; promessa infranta)"
                                            className="flex-1 bg-surface-1 border border-surface-3 rounded px-2 py-1 text-xs text-content-1 outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const sessInput = document.getElementById(`new-milestone-session-${p._id}`) as HTMLInputElement;
                                              const dateInput = document.getElementById(`new-milestone-date-${p._id}`) as HTMLInputElement;
                                              const attSelect = document.getElementById(`new-milestone-att-${p._id}`) as HTMLSelectElement;
                                              const eventInput = document.getElementById(`new-milestone-event-${p._id}`) as HTMLInputElement;
                                              const evtText = eventInput?.value?.trim();
                                              if (!evtText) return;

                                              const sessNum = parseInt(sessInput?.value || '', 10);
                                              const newM: RelationMilestone = {
                                                sessionNumber: !isNaN(sessNum) ? sessNum : undefined,
                                                sessionTitle: sessInput?.value?.trim(),
                                                loreDate: dateInput?.value?.trim() || undefined,
                                                attitude: (attSelect?.value as RelationAttitude) || 'neutral',
                                                event: evtText,
                                                createdAt: new Date().toISOString(),
                                              };

                                              const updatedProg = [...(rel.progression || []), newM];
                                              updateRel('progression', updatedProg);
                                              if (eventInput) eventInput.value = '';
                                              if (sessInput) sessInput.value = '';
                                              if (dateInput) dateInput.value = '';
                                            }}
                                            className="px-2.5 py-1 rounded bg-primary text-surface-0 text-xs font-mono font-bold hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                                          >
                                            Salva Svolta
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Codex Entity-to-Entity Relations Matrix */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2.5">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Shield size={13} className="text-primary" />
                            <span>Relazioni con Altre Entità del Compendio (PNG, Fazioni, Luoghi, Quest)</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-semibold">
                            {Object.keys(newEntityRelations).length} Legami Definiti
                          </span>
                        </label>

                        {/* Existing Defined Entity Relations List */}
                        {Object.keys(newEntityRelations).length > 0 && (
                          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {Object.values(newEntityRelations).map((rel) => {
                              const targetEnt = CampaignManager.getEntities().find((e) => e._id === rel.targetEntityId);
                              const updateEntityRel = (key: string, val: any) => {
                                setNewEntityRelations((prev) => ({
                                  ...prev,
                                  [rel.targetEntityId]: {
                                    ...rel,
                                    [key]: val,
                                  },
                                }));
                              };

                              const removeEntityRel = () => {
                                setNewEntityRelations((prev) => {
                                  const next = { ...prev };
                                  delete next[rel.targetEntityId];
                                  return next;
                                });
                              };

                              return (
                                <div key={rel.targetEntityId} className="p-3 rounded-xl bg-surface-1 border border-surface-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-bold text-content-1 truncate">
                                        {targetEnt?.name || rel.targetEntityName || 'Entità'}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3 shrink-0">
                                        {(targetEnt?.type || rel.targetEntityType || 'codex').toUpperCase()}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <select
                                        value={rel.attitude || 'neutral'}
                                        onChange={(e) => updateEntityRel('attitude', e.target.value)}
                                        className="bg-surface-2 border border-surface-3 rounded-lg px-2 py-1 text-[11px] text-content-1 font-semibold outline-none focus:border-primary cursor-pointer"
                                      >
                                        <option value="friendly">😊 Amichevole / Alleato</option>
                                        <option value="helpful">🤝 Disponibile / Cooperativo</option>
                                        <option value="neutral">😐 Neutrale / Indifferente</option>
                                        <option value="suspicious">🤨 Diffidente / Sospettoso</option>
                                        <option value="hostile">😡 Ostile / Nemico</option>
                                        <option value="fearful">😨 Timoroso / Sottomesso</option>
                                        <option value="devoted">👑 Devoto / Fedele</option>
                                      </select>

                                      <button
                                        type="button"
                                        onClick={removeEntityRel}
                                        className="p-1 text-content-3 hover:text-error transition-colors cursor-pointer"
                                        title="Rimuovi legame"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      placeholder="Tipo legame (es. Rivali, Membro, Base, Nemico giurato)"
                                      value={rel.relationType || ''}
                                      onChange={(e) => updateEntityRel('relationType', e.target.value)}
                                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Dettagli / Opinione dell'entità su questo soggetto"
                                      value={rel.notes || ''}
                                      onChange={(e) => updateEntityRel('notes', e.target.value)}
                                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Quick Entity Picker to add a new relation */}
                        <div className="p-2.5 rounded-xl bg-surface-1 border border-surface-3/80 flex items-center gap-2">
                          <select
                            id="add-entity-relation-select"
                            className="flex-1 bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none cursor-pointer"
                            defaultValue=""
                            onChange={(e) => {
                              const eId = e.target.value;
                              if (!eId) return;
                              const targetEnt = CampaignManager.getEntities().find((ent) => ent._id === eId);
                              if (!targetEnt) return;
                              setNewEntityRelations((prev) => ({
                                ...prev,
                                [eId]: {
                                  targetEntityId: eId,
                                  targetEntityName: targetEnt.name,
                                  targetEntityType: targetEnt.type,
                                  attitude: 'neutral',
                                  relationType: '',
                                  notes: '',
                                },
                              }));
                              setNewAiKnownEntityIds((prev) => (prev.includes(eId) ? prev : [...prev, eId]));
                              e.target.value = '';
                            }}
                          >
                            <option value="" disabled>+ Aggiungi legame con un'altra Entità del Compendio...</option>
                            {CampaignManager.getEntities()
                              .filter((e) => e._id !== selectedEntityId && !newEntityRelations[e._id])
                              .map((ent) => (
                                <option key={ent._id} value={ent._id}>
                                  {ent.name} ({ent.type.toUpperCase()})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Explicit Session Memory Connections Grouped by Chapters */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <BookOpen size={13} className="text-primary" />
                            <span>Sessioni Vissute o Conosciute (per Capitolo / Arco)</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-semibold">
                            {newAiKnownSessionIds.length} Selezionate
                          </span>
                        </label>

                        {(() => {
                          const chapters = CampaignManager.getChapters();
                          const allSessions = CampaignManager.getSessions();

                          if (allSessions.length === 0) {
                            return (
                              <p className="text-xs text-content-3 italic p-2 bg-surface-1 rounded-xl border border-surface-3">
                                Nessuna sessione registrata nella campagna.
                              </p>
                            );
                          }

                          // Group sessions
                          const chapterMap = new Map<string, typeof allSessions>();
                          chapters.forEach((c) => chapterMap.set(c.id, []));

                          const unchaptered: typeof allSessions = [];

                          allSessions.forEach((s) => {
                            if (s.chapterId && chapterMap.has(s.chapterId)) {
                              chapterMap.get(s.chapterId)!.push(s);
                            } else if (s.chapterName) {
                              const foundCh = chapters.find((c) => c.name.toLowerCase() === s.chapterName?.toLowerCase());
                              if (foundCh) {
                                chapterMap.get(foundCh.id)!.push(s);
                              } else {
                                unchaptered.push(s);
                              }
                            } else {
                              unchaptered.push(s);
                            }
                          });

                          return (
                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                              {chapters.map((ch) => {
                                const chSessions = chapterMap.get(ch.id) || [];
                                const isExpanded = aiExpandedChapterIds.includes(ch.id);
                                const selectedInChapter = chSessions.filter((s) => newAiKnownSessionIds.includes(s._id));
                                const allSelected = chSessions.length > 0 && selectedInChapter.length === chSessions.length;

                                const toggleChapterAll = (e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  const chIds = chSessions.map((s) => s._id);
                                  if (allSelected) {
                                    setNewAiKnownSessionIds((prev) => prev.filter((id) => !chIds.includes(id)));
                                  } else {
                                    setNewAiKnownSessionIds((prev) => Array.from(new Set([...prev, ...chIds])));
                                  }
                                };

                                return (
                                  <div key={ch.id} className="rounded-xl border border-surface-3 bg-surface-1 overflow-hidden">
                                    <div
                                      onClick={() => {
                                        setAiExpandedChapterIds((prev) =>
                                          isExpanded ? prev.filter((id) => id !== ch.id) : [...prev, ch.id]
                                        );
                                      }}
                                      className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-surface-2/60 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: ch.color || 'var(--color-primary)' }}
                                        />
                                        <span className="text-xs font-bold text-content-1 truncate">{ch.name}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3">
                                          {selectedInChapter.length}/{chSessions.length}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {chSessions.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={toggleChapterAll}
                                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                                              allSelected
                                                ? 'bg-primary/20 border-primary text-primary font-bold'
                                                : 'bg-surface-2 hover:bg-surface-3 text-content-3 border-surface-3'
                                            }`}
                                          >
                                            {allSelected ? 'Deseleziona Arco' : 'Seleziona Arco'}
                                          </button>
                                        )}
                                        {isExpanded ? <ChevronUp size={14} className="text-content-3" /> : <ChevronDown size={14} className="text-content-3" />}
                                      </div>
                                    </div>

                                    {isExpanded && (
                                      <div className="p-2.5 pt-1 bg-surface-0/60 border-t border-surface-3/50 flex flex-wrap gap-1.5">
                                        {chSessions.length === 0 ? (
                                          <span className="text-[11px] text-content-3 italic">Nessuna sessione in questo capitolo.</span>
                                        ) : (
                                          chSessions.map((sess) => {
                                            const isChecked = newAiKnownSessionIds.includes(sess._id);
                                            return (
                                              <button
                                                key={sess._id}
                                                type="button"
                                                onClick={() => {
                                                  setNewAiKnownSessionIds((prev) =>
                                                    isChecked ? prev.filter((id) => id !== sess._id) : [...prev, sess._id]
                                                  );
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border ${
                                                  isChecked
                                                    ? 'bg-primary text-surface-0 border-primary font-bold shadow-2xs'
                                                    : 'bg-surface-1 hover:bg-surface-2 text-content-2 border-surface-3'
                                                }`}
                                              >
                                                <span>Sessione {sess.number || ''}: {sess.title}</span>
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Unchaptered Sessions */}
                              {unchaptered.length > 0 && (
                                <div className="rounded-xl border border-surface-3 bg-surface-1 overflow-hidden">
                                  <div
                                    onClick={() => {
                                      setAiExpandedChapterIds((prev) =>
                                        prev.includes('unchaptered') ? prev.filter((id) => id !== 'unchaptered') : [...prev, 'unchaptered']
                                      );
                                    }}
                                    className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-surface-2/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-surface-3" />
                                      <span className="text-xs font-bold text-content-1 truncate">Sessioni Extra / Senza Capitolo</span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3">
                                        {unchaptered.filter((s) => newAiKnownSessionIds.includes(s._id)).length}/{unchaptered.length}
                                      </span>
                                    </div>
                                    {aiExpandedChapterIds.includes('unchaptered') ? <ChevronUp size={14} className="text-content-3" /> : <ChevronDown size={14} className="text-content-3" />}
                                  </div>

                                  {aiExpandedChapterIds.includes('unchaptered') && (
                                    <div className="p-2.5 pt-1 bg-surface-0/60 border-t border-surface-3/50 flex flex-wrap gap-1.5">
                                      {unchaptered.map((sess) => {
                                        const isChecked = newAiKnownSessionIds.includes(sess._id);
                                        return (
                                          <button
                                            key={sess._id}
                                            type="button"
                                            onClick={() => {
                                              setNewAiKnownSessionIds((prev) =>
                                                isChecked ? prev.filter((id) => id !== sess._id) : [...prev, sess._id]
                                              );
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border ${
                                              isChecked
                                                ? 'bg-primary text-surface-0 border-primary font-bold shadow-2xs'
                                                : 'bg-surface-1 hover:bg-surface-2 text-content-2 border-surface-3'
                                            }`}
                                          >
                                            <span>Sessione {sess.number || ''}: {sess.title}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Searchable Entity Picker */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2.5">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Brain size={13} className="text-primary" />
                            <span>Altre Entità del Compendio Conosciute dal PNG</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-semibold">
                            {newAiKnownEntityIds.length} Selezionate
                          </span>
                        </label>

                        {/* Currently Selected Entities Bar */}
                        {newAiKnownEntityIds.length > 0 && (
                          <div className="p-2 rounded-xl bg-surface-1 border border-surface-3 space-y-1">
                            <span className="text-[10px] font-mono text-content-3 block font-bold uppercase tracking-wider">
                              Entità Collegate al Sotto-Codex:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {newAiKnownEntityIds.map((eId) => {
                                const ent = CampaignManager.getEntities().find((e) => e._id === eId);
                                if (!ent) return null;
                                return (
                                  <span
                                    key={eId}
                                    className="px-2 py-0.5 rounded-lg bg-primary/15 border border-primary/40 text-content-1 text-[11px] font-mono flex items-center gap-1.5"
                                  >
                                    <span>{ent.name} ({ent.type.toUpperCase()})</span>
                                    <button
                                      type="button"
                                      onClick={() => setNewAiKnownEntityIds((prev) => prev.filter((id) => id !== eId))}
                                      className="hover:text-error transition-colors cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Search & Filter Inputs */}
                        <div className="space-y-2 p-2 rounded-xl bg-surface-1 border border-surface-3">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-2.5 text-content-3" />
                            <input
                              type="text"
                              placeholder="Cerca entità per nome o alias..."
                              value={aiEntitySearchQuery}
                              onChange={(e) => setAiEntitySearchQuery(e.target.value)}
                              className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg pl-8 pr-3 py-1.5 text-xs text-content-1 outline-none font-sans"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: 'all', label: 'Tutti' },
                              { id: 'npc', label: 'PNG' },
                              { id: 'place', label: 'Luoghi' },
                              { id: 'faction', label: 'Fazioni' },
                              { id: 'item', label: 'Oggetti' },
                              { id: 'quest', label: 'Quest' },
                              { id: 'monster', label: 'Mostri' },
                            ].map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setAiEntityTypeFilter(f.id)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-all border ${
                                  aiEntityTypeFilter === f.id
                                    ? 'bg-primary text-surface-0 border-primary font-bold'
                                    : 'bg-surface-2 text-content-3 border-surface-3 hover:bg-surface-3 hover:text-content-1'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          {/* Filtered Scrollable List */}
                          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 pt-1">
                            {(() => {
                              const avail = CampaignManager.getEntities()
                                .filter((e) => e._id !== selectedEntityId)
                                .filter((e) => {
                                  if (aiEntityTypeFilter !== 'all' && e.type !== aiEntityTypeFilter) return false;
                                  if (aiEntitySearchQuery.trim()) {
                                    const q = aiEntitySearchQuery.toLowerCase();
                                    const matchName = e.name.toLowerCase().includes(q);
                                    const matchAlias = e.aliases?.some((a) => a.toLowerCase().includes(q));
                                    return matchName || matchAlias;
                                  }
                                  return true;
                                });

                              if (avail.length === 0) {
                                return (
                                  <p className="text-xs text-content-3 italic p-1">
                                    Nessuna entità trovata con questi filtri.
                                  </p>
                                );
                              }

                              return avail.map((ent) => {
                                const isChecked = newAiKnownEntityIds.includes(ent._id);
                                return (
                                  <div
                                    key={ent._id}
                                    onClick={() => {
                                      setNewAiKnownEntityIds((prev) =>
                                        isChecked ? prev.filter((id) => id !== ent._id) : [...prev, ent._id]
                                      );
                                    }}
                                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                      isChecked
                                        ? 'bg-primary/20 border-primary text-content-1 font-semibold'
                                        : 'bg-surface-2/60 border-surface-3/80 hover:bg-surface-2 text-content-2'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs truncate font-bold">{ent.name}</span>
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-1 text-content-3 border border-surface-3">
                                        {ent.type.toUpperCase()}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                      isChecked ? 'bg-primary text-surface-0 border-primary' : 'bg-surface-3 text-content-3 border-surface-3'
                                    }`}>
                                      {isChecked ? 'Collegato' : 'Collega'}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Timeline Memories Section */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2.5">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-primary" />
                            <span>Cronologia Memorie di Lore ({newAiTimelineMemories.length})</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-normal">
                            Ricordi vissuti ancorati alle date di lore
                          </span>
                        </label>

                        {newAiTimelineMemories.length > 0 && (
                          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {newAiTimelineMemories.map((mem, mIdx) => (
                              <div key={mem.id || mIdx} className="p-2.5 rounded-xl bg-surface-1 border border-surface-3 flex items-start justify-between gap-2 text-xs">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-content-1">{mem.title}</span>
                                    {mem.loreDate && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-3 border border-surface-3">
                                        ⏳ {mem.loreDate}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-content-2">
                                      {mem.category}
                                    </span>
                                  </div>
                                  <p className="text-content-2 text-[11px] leading-relaxed">{mem.summary}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setNewAiTimelineMemories((prev) => prev.filter((_, idx) => idx !== mIdx))}
                                  className="p-1 text-content-3 hover:text-error transition-colors cursor-pointer shrink-0"
                                  title="Elimina memoria"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Add Memory Form */}
                        <div className="p-2.5 rounded-xl bg-surface-1 border border-dashed border-surface-3 space-y-2">
                          <span className="text-[11px] font-mono font-bold text-content-2 block">+ Aggiungi Nuova Memoria di Lore:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              id="new-mem-title"
                              placeholder="Titolo memoria (es. La rottura all'Accademia)"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                            <input
                              type="text"
                              id="new-mem-date"
                              placeholder="Data Lore (es. 14 Mirtul, 1492 CV)"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                          </div>
                          <textarea
                            id="new-mem-summary"
                            rows={2}
                            placeholder="Descrizione dell'evento o ricordo dal punto di vista del PNG..."
                            className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none resize-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const titleEl = document.getElementById('new-mem-title') as HTMLInputElement;
                              const dateEl = document.getElementById('new-mem-date') as HTMLInputElement;
                              const sumEl = document.getElementById('new-mem-summary') as HTMLTextAreaElement;
                              const t = titleEl?.value?.trim();
                              const s = sumEl?.value?.trim();
                              if (!t || !s) return;

                              const newEntry: TimelineMemoryEntry = {
                                id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                title: t,
                                summary: s,
                                loreDate: dateEl?.value?.trim() || undefined,
                                category: 'event',
                                impact: 'normal',
                              };
                              setNewAiTimelineMemories((prev) => [...prev, newEntry]);
                              if (titleEl) titleEl.value = '';
                              if (dateEl) dateEl.value = '';
                              if (sumEl) sumEl.value = '';
                            }}
                            className="px-3 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-primary text-xs font-mono font-bold border border-surface-3 transition-colors cursor-pointer"
                          >
                            Salva Memoria nel Sotto-Codex
                          </button>
                        </div>
                      </div>

                      {/* Evolving Beliefs Section */}
                      <div className="pt-2 border-t border-surface-3/70 space-y-2.5">
                        <label className="block text-xs font-bold text-content-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={13} className="text-amber-400" />
                            <span>Teorie &amp; Credenze Evolutive ({newAiEvolvingBeliefs.length})</span>
                          </span>
                          <span className="text-[10px] font-mono text-content-3 font-normal">
                            Evoluzione delle certezze e teorie smentite/confermate
                          </span>
                        </label>

                        {newAiEvolvingBeliefs.length > 0 && (
                          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {newAiEvolvingBeliefs.map((bel, bIdx) => (
                              <div key={bel.id || bIdx} className="p-2.5 rounded-xl bg-surface-1 border border-surface-3 flex items-start justify-between gap-2 text-xs">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-content-1">Soggetto: {bel.subject}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-amber-300 border border-surface-3">
                                      {bel.status}
                                    </span>
                                    {bel.revealedLoreDate && (
                                      <span className="text-[10px] font-mono text-content-3">
                                        ⏳ {bel.revealedLoreDate}
                                      </span>
                                    )}
                                  </div>
                                  {bel.previousBelief && (
                                    <p className="text-[11px] text-content-3 font-mono line-through opacity-70">
                                      Prima credeva: &ldquo;{bel.previousBelief}&rdquo;
                                    </p>
                                  )}
                                  <p className="text-[11px] text-content-1 font-mono">
                                    👉 Verità attuale: &ldquo;{bel.currentTruth}&rdquo;
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setNewAiEvolvingBeliefs((prev) => prev.filter((_, idx) => idx !== bIdx))}
                                  className="p-1 text-content-3 hover:text-error transition-colors cursor-pointer shrink-0"
                                  title="Elimina credenza"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Add Belief Form */}
                        <div className="p-2.5 rounded-xl bg-surface-1 border border-dashed border-surface-3 space-y-2">
                          <span className="text-[11px] font-mono font-bold text-content-2 block">+ Aggiungi Teoria / Credenza:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              id="new-bel-subject"
                              placeholder="Soggetto (es. Kaelen / Tomo proibito)"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                            <select
                              id="new-bel-status"
                              defaultValue="proven_fact"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono cursor-pointer"
                            >
                              <option value="proven_fact">Fatto Accertato (proven_fact)</option>
                              <option value="shattered_belief">Credenza Smentita (shattered_belief)</option>
                              <option value="active_theory">Teoria Attiva (active_theory)</option>
                              <option value="suspicion">Sospetto (suspicion)</option>
                            </select>
                            <input
                              type="text"
                              id="new-bel-date"
                              placeholder="Data Lore (es. 20 Mirtul)"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              id="new-bel-prev"
                              placeholder="Cosa credeva prima (opzionale)"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                            <input
                              type="text"
                              id="new-bel-truth"
                              placeholder="Verità o certezza attuale *"
                              className="bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const subEl = document.getElementById('new-bel-subject') as HTMLInputElement;
                              const statEl = document.getElementById('new-bel-status') as HTMLSelectElement;
                              const dateEl = document.getElementById('new-bel-date') as HTMLInputElement;
                              const prevEl = document.getElementById('new-bel-prev') as HTMLInputElement;
                              const truthEl = document.getElementById('new-bel-truth') as HTMLInputElement;

                              const sub = subEl?.value?.trim();
                              const truth = truthEl?.value?.trim();
                              if (!sub || !truth) return;

                              const newBel: EvolvingBelief = {
                                id: `bel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                subject: sub,
                                status: (statEl?.value as any) || 'proven_fact',
                                currentTruth: truth,
                                previousBelief: prevEl?.value?.trim() || undefined,
                                revealedLoreDate: dateEl?.value?.trim() || undefined,
                              };
                              setNewAiEvolvingBeliefs((prev) => [...prev, newBel]);
                              if (subEl) subEl.value = '';
                              if (truthEl) truthEl.value = '';
                              if (prevEl) prevEl.value = '';
                              if (dateEl) dateEl.value = '';
                            }}
                            className="px-3 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-amber-300 text-xs font-mono font-bold border border-surface-3 transition-colors cursor-pointer"
                          >
                            Salva Credenza nel Sotto-Codex
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-content-2">
                      Note &amp; Descrizione
                    </label>
                    <OcrButton
                      compact
                      label="Trascrivi Foto (OCR)"
                      onScanComplete={(transcribed) => {
                        setNewNote((prev) => (prev.trim() ? `${prev}\n\n${transcribed}` : transcribed));
                      }}
                    />
                  </div>
                  <RichTextEditor
                    placeholder="Informazioni, segreti, indizi, dettagli tattici o trascrizione da foto..."
                    value={newNote}
                    onChange={setNewNote}
                  />
                </div>

                {/* Images Upload */}
                <ImageGalleryUploader
                  images={newImages}
                  onChange={setNewImages}
                  label={`Ritratti & Illustrazioni di ${CATEGORY_DEFINITIONS[formType]?.singular || 'Entità'}`}
                  maxImages={6}
                  entityName={newName}
                  entityType={formType}
                  contextDescription={`${newAlias || ''} ${newNote || ''}`}
                />
              </div>

              <div className="flex-shrink-0 flex items-center justify-between gap-3 p-5 sm:p-6 border-t border-surface-2 bg-surface-1">
                {isEditing && selectedEntityId && canDeleteEntity ? (
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = selectedEntityId;
                      setIsModalOpen(false);
                      setEntityToDelete(idToDelete);
                    }}
                    className="px-3.5 py-2 text-xs font-mono font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/50 rounded-xl border border-red-800/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Elimina dal Codex</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-medium bg-primary text-surface-0 hover:bg-primary-hover shadow-sm transition-colors cursor-pointer font-mono"
                  >
                    {isEditing ? 'Salva Modifiche' : 'Salva nel Codex'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}

    {/* Zoom Lightbox */}
    {activeLightboxImg && activeLightboxImg.trim() && (
      <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-0/90 backdrop-blur-md overflow-y-auto"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90dvh] my-auto">
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="absolute -top-10 right-0 text-content-3 hover:text-content-1 p-2 cursor-pointer"
            >
              <X size={24} />
            </button>
            <img
              src={activeLightboxImg}
              alt="Ingrandimento"
              className="max-h-[85dvh] w-auto max-w-full rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </Portal>
    )}

      <ConfirmModal
        isOpen={!!entityToDelete}
        title="Elimina Voce dal Codex"
        message="Sei sicuro di voler eliminare definitivamente questa voce? I collegamenti e i riferimenti verranno rimossi."
        confirmLabel="Elimina"
        onConfirm={confirmDeleteEntity}
        onCancel={() => setEntityToDelete(null)}
      />

      <ConfirmModal
        isOpen={showResetModal}
        title="Azzera Tutte le Voci del Codex e le Relazioni"
        message="Sei sicuro di voler cancellare TUTTE le entità catalogate nel Codex (PNG, Luoghi, Mostri, Fazioni, Oggetti, Quest) e tutte le relazioni familiari? I personaggi del Party, le sessioni, i capitoli e le note rimarranno intatti."
        confirmLabel="Azzera Tutto"
        onConfirm={handleResetAllCodex}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}
