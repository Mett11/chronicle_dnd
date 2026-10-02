import React, { useState, useEffect } from 'react';
import { Portal } from '../Portal';
import {
  X,
  Users,
  UserCheck,
  Shield,
  Heart,
  Crown,
  Sparkles,
  Link as LinkIcon,
  Skull,
  HelpCircle,
  Swords,
  Flame,
  User,
  Compass,
  Check,
  ChevronDown,
  Eye,
  Lock,
  BookOpen,
  Plus,
} from 'lucide-react';
import {
  CharacterRelationship,
  RelationshipType,
  GenerationCategory,
  GenealogyRole,
  Entity,
  Player,
} from '../../types';
import { SingleImageUploader } from '../SingleImageUploader';
import { CampaignManager } from '../../store/campaignStore';

interface RelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (relation: CharacterRelationship) => void;
  initialData?: CharacterRelationship | null;
  initialGenerationTier?: GenerationCategory | null;
  initialGenealogyRole?: GenealogyRole | null;
  initialSideOfFamily?: 'paternal' | 'maternal' | 'direct' | 'unspecified' | null;
  playerId: string;
  currentPlayerName?: string;
  existingRelations?: CharacterRelationship[];
  defaultMode?: 'family' | 'party' | 'npc';
}

export interface DetailedRoleOption {
  role: GenealogyRole | 'companion' | 'mentor' | 'ally' | 'rival' | 'enemy' | 'custom';
  label: string;
  category: GenerationCategory;
  type: RelationshipType;
  side: 'paternal' | 'maternal' | 'direct' | 'unspecified';
  group: 'paternal' | 'maternal' | 'parents' | 'peers' | 'children' | 'descendants' | 'connections';
  groupLabel: string;
  icon: React.ReactNode;
}

export const DETAILED_ROLE_OPTIONS: DetailedRoleOption[] = [
  // Paternal Line
  {
    role: 'paternal_grandfather',
    label: 'Nonno Paterno (Padre del Padre)',
    category: 'ancestors',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Crown size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_grandmother',
    label: 'Nonna Paterna (Madre del Padre)',
    category: 'ancestors',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Crown size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_uncle',
    label: 'Zio Paterno (Fratello del Padre)',
    category: 'parents',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Users size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_aunt',
    label: 'Zia Paterna (Sorella del Padre)',
    category: 'parents',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Users size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_uncle_in_law',
    label: 'Zio Paterno Acquisito (Marito della Zia Paterna)',
    category: 'parents',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Users size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_aunt_in_law',
    label: 'Zia Paterna Acquisita (Moglie dello Zio Paterno)',
    category: 'parents',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Users size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_cousin',
    label: 'Cugino/a (Ramo Paterno)',
    category: 'peers',
    type: 'sibling',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Users size={14} className="text-amber-500" />,
  },
  {
    role: 'paternal_ancestor',
    label: 'Antenato Illustre / Avo della Linea Paterna',
    category: 'ancestors',
    type: 'ancestor',
    side: 'paternal',
    group: 'paternal',
    groupLabel: '🏛️ Ramo Paterno (Linea del Padre)',
    icon: <Crown size={14} className="text-amber-500" />,
  },

  // Maternal Line
  {
    role: 'maternal_grandfather',
    label: 'Nonno Materno (Padre della Madre)',
    category: 'ancestors',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Crown size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_grandmother',
    label: 'Nonna Materna (Madre della Madre)',
    category: 'ancestors',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Crown size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_uncle',
    label: 'Zio Materno (Fratello della Madre)',
    category: 'parents',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Users size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_aunt',
    label: 'Zia Materna (Sorella della Madre)',
    category: 'parents',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Users size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_uncle_in_law',
    label: 'Zio Materno Acquisito (Marito della Zia Materna)',
    category: 'parents',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Users size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_aunt_in_law',
    label: 'Zia Materna Acquisita (Moglie dello Zio Materno)',
    category: 'parents',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Users size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_cousin',
    label: 'Cugino/a (Ramo Materno)',
    category: 'peers',
    type: 'sibling',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Users size={14} className="text-amber-400" />,
  },
  {
    role: 'maternal_ancestor',
    label: 'Antenato Illustre / Avo della Linea Materna',
    category: 'ancestors',
    type: 'ancestor',
    side: 'maternal',
    group: 'maternal',
    groupLabel: '🏛️ Ramo Materno (Linea della Madre)',
    icon: <Crown size={14} className="text-amber-400" />,
  },

  // Parents
  {
    role: 'father',
    label: 'Padre',
    category: 'parents',
    type: 'parent',
    side: 'paternal',
    group: 'parents',
    groupLabel: '👑 Genitori & Tutori',
    icon: <Crown size={14} className="text-amber-500" />,
  },
  {
    role: 'mother',
    label: 'Madre',
    category: 'parents',
    type: 'parent',
    side: 'maternal',
    group: 'parents',
    groupLabel: '👑 Genitori & Tutori',
    icon: <Crown size={14} className="text-amber-400" />,
  },
  {
    role: 'guardian',
    label: 'Tutore / Genitore Adottivo',
    category: 'parents',
    type: 'parent',
    side: 'direct',
    group: 'parents',
    groupLabel: '👑 Genitori & Tutori',
    icon: <Shield size={14} className="text-blue-400" />,
  },

  // Siblings & Spouse
  {
    role: 'brother',
    label: 'Fratello',
    category: 'peers',
    type: 'sibling',
    side: 'direct',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Users size={14} className="text-blue-400" />,
  },
  {
    role: 'sister',
    label: 'Sorella',
    category: 'peers',
    type: 'sibling',
    side: 'direct',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Users size={14} className="text-blue-400" />,
  },
  {
    role: 'sibling',
    label: 'Fratello / Sorella generico',
    category: 'peers',
    type: 'sibling',
    side: 'direct',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Users size={14} className="text-blue-400" />,
  },
  {
    role: 'sibling_in_law',
    label: 'Cognato / Cognata (Marito/Moglie di Fratello/Sorella o Fratello/Sorella del Coniuge)',
    category: 'peers',
    type: 'sibling',
    side: 'direct',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Users size={14} className="text-blue-400" />,
  },
  {
    role: 'cousin',
    label: 'Cugino / Cugina (Ramo non specificato)',
    category: 'peers',
    type: 'sibling',
    side: 'unspecified',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Users size={14} className="text-blue-400" />,
  },
  {
    role: 'spouse',
    label: 'Coniuge / Consorte / Partner / Amore',
    category: 'peers',
    type: 'spouse',
    side: 'direct',
    group: 'peers',
    groupLabel: '⚔️ Stessa Generazione & Fratellanza',
    icon: <Heart size={14} className="text-pink-400" />,
  },

  // Children & Descendants
  {
    role: 'son',
    label: 'Figlio maschio',
    category: 'children',
    type: 'child',
    side: 'direct',
    group: 'children',
    groupLabel: '🌱 Figli & Eredi Diretti',
    icon: <Sparkles size={14} className="text-emerald-400" />,
  },
  {
    role: 'daughter',
    label: 'Figlia femmina',
    category: 'children',
    type: 'child',
    side: 'direct',
    group: 'children',
    groupLabel: '🌱 Figli & Eredi Diretti',
    icon: <Sparkles size={14} className="text-emerald-400" />,
  },
  {
    role: 'child',
    label: 'Figlio / Figlia generico',
    category: 'children',
    type: 'child',
    side: 'direct',
    group: 'children',
    groupLabel: '🌱 Figli & Eredi Diretti',
    icon: <Sparkles size={14} className="text-emerald-400" />,
  },
  {
    role: 'child_in_law',
    label: 'Genero / Nuora (Coniuge del Figlio/a)',
    category: 'children',
    type: 'child',
    side: 'direct',
    group: 'children',
    groupLabel: '🌱 Figli & Eredi Diretti',
    icon: <Sparkles size={14} className="text-emerald-400" />,
  },
  {
    role: 'nephew',
    label: 'Nipote (Figlio/a di Fratello o Sorella)',
    category: 'children',
    type: 'child',
    side: 'direct',
    group: 'children',
    groupLabel: '🌱 Figli & Eredi Diretti',
    icon: <Sparkles size={14} className="text-emerald-500" />,
  },
  {
    role: 'grandchild',
    label: 'Nipote di 2a Generazione (Figlio/a del proprio Figlio/a)',
    category: 'descendants',
    type: 'descendant',
    side: 'direct',
    group: 'descendants',
    groupLabel: '🍃 Discendenza Futura',
    icon: <Sparkles size={14} className="text-teal-400" />,
  },
  {
    role: 'descendant',
    label: 'Pronipote / Discendente Futuro',
    category: 'descendants',
    type: 'descendant',
    side: 'direct',
    group: 'descendants',
    groupLabel: '🍃 Discendenza Futura',
    icon: <Sparkles size={14} className="text-teal-400" />,
  },

  // Connections (Party, Mentors, Allies, Rivals, Enemies)
  {
    role: 'companion',
    label: 'Compagno di Party PG / Fratello d\'Armi',
    category: 'connections',
    type: 'companion',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <Shield size={14} className="text-purple-400" />,
  },
  {
    role: 'mentor',
    label: 'Mentore / Maestro d\'Arme / Guida Spirituale',
    category: 'connections',
    type: 'mentor',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <Compass size={14} className="text-indigo-400" />,
  },
  {
    role: 'ally',
    label: 'Alleato Fedele / Contatto / Fazione',
    category: 'connections',
    type: 'ally',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <UserCheck size={14} className="text-cyan-400" />,
  },
  {
    role: 'rival',
    label: 'Rivale / Concorrente d\'Onore',
    category: 'connections',
    type: 'rival',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <Swords size={14} className="text-orange-400" />,
  },
  {
    role: 'enemy',
    label: 'Arci-Nemico / Antagonista Giurato',
    category: 'connections',
    type: 'enemy',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <Flame size={14} className="text-rose-500" />,
  },
  {
    role: 'custom',
    label: 'Altro / Ruolo Personalizzato',
    category: 'connections',
    type: 'custom',
    side: 'unspecified',
    group: 'connections',
    groupLabel: '🤝 Rete Relazionale & Legami Esterni',
    icon: <User size={14} className="text-purple-400" />,
  },
];

const STATUS_OPTIONS: {
  value: CharacterRelationship['status'];
  label: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  { value: 'alive', label: 'In Vita', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <Heart size={13} /> },
  { value: 'deceased', label: 'Deceduto / Caduto', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', icon: <Skull size={13} /> },
  { value: 'missing', label: 'Disperso / Scomparso', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: <HelpCircle size={13} /> },
  { value: 'undead', label: 'Non-Morto / Maledetto', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: <Flame size={13} /> },
  { value: 'unknown', label: 'Stato Sconosciuto', color: 'text-content-3 bg-surface-2 border-surface-3', icon: <HelpCircle size={13} /> },
];

export function RelationModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  initialGenerationTier,
  initialGenealogyRole,
  initialSideOfFamily,
  playerId,
  currentPlayerName,
  existingRelations = [],
  defaultMode = 'family',
}: RelationModalProps) {
  const [name, setName] = useState('');
  const [titleOrRole, setTitleOrRole] = useState('');
  const [selectedDetailedRole, setSelectedDetailedRole] = useState<string>('father');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('parent');
  const [customRelationshipLabel, setCustomRelationshipLabel] = useState('');
  const [generationCategory, setGenerationCategory] = useState<GenerationCategory>('parents');
  const [sideOfFamily, setSideOfFamily] = useState<'paternal' | 'maternal' | 'direct' | 'unspecified'>('paternal');
  const [status, setStatus] = useState<CharacterRelationship['status']>('alive');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [secondParentId, setSecondParentId] = useState<string>('');
  const [otherParentName, setOtherParentName] = useState<string>('');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [linkedPlayerId, setLinkedPlayerId] = useState('');
  const [sharedWithParty, setSharedWithParty] = useState<boolean>(true);
  const [attitude, setAttitude] = useState<'friendly' | 'helpful' | 'neutral' | 'suspicious' | 'hostile' | 'devoted' | 'rival'>('neutral');
  const [trustLevel, setTrustLevel] = useState<number>(5);
  const [createInCodex, setCreateInCodex] = useState<boolean>(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [linkSource, setLinkSource] = useState<'custom' | 'npc' | 'player'>('custom');

  const registeredSpouses = existingRelations.filter(
    (r) => r.genealogyRole === 'spouse' || r.relationshipType === 'spouse'
  );

  useEffect(() => {
    if (isOpen) {
      const allEnts = CampaignManager.getEntities();
      setEntities(allEnts);
      const allPlayers = CampaignManager.getPlayers();
      setPlayers(allPlayers.filter((p) => p._id !== playerId));

      if (initialData) {
        setName(initialData.name || '');
        setTitleOrRole(initialData.titleOrRole || '');
        setRelationshipType(initialData.relationshipType || 'parent');
        setCustomRelationshipLabel(initialData.customRelationshipLabel || '');
        setGenerationCategory(initialData.generationCategory || 'parents');
        setSideOfFamily(initialData.sideOfFamily || 'direct');
        setStatus(initialData.status || 'alive');
        setAvatarUrl(initialData.avatarUrl || '');
        setBio(initialData.bio || '');
        setSecondParentId(initialData.secondParentId || '');
        setOtherParentName(initialData.otherParentName || '');
        setLinkedEntityId(initialData.linkedEntityId || '');
        setLinkedPlayerId(initialData.linkedPlayerId || '');
        setSharedWithParty(initialData.sharedWithParty !== undefined ? initialData.sharedWithParty : true);
        setAttitude((initialData.attitude as any) || 'neutral');
        setTrustLevel(initialData.trustLevel ?? 5);

        let roleMatch: string | undefined = initialData.genealogyRole;
        if (!roleMatch) {
          if (initialData.relationshipType === 'parent') {
            const lowName = (initialData.name || '').toLowerCase();
            const lowTitle = (initialData.titleOrRole || '').toLowerCase();
            if (initialData.sideOfFamily === 'maternal' || lowName.includes('madr') || lowName.includes('mamma') || lowTitle.includes('madr')) {
              roleMatch = 'mother';
            } else if (initialData.sideOfFamily === 'paternal' || lowName.includes('padr') || lowName.includes('papà') || lowTitle.includes('padr')) {
              roleMatch = 'father';
            } else {
              roleMatch = 'guardian';
            }
          } else if (initialData.relationshipType === 'ancestor') {
            const lowName = (initialData.name || '').toLowerCase();
            const lowTitle = (initialData.titleOrRole || '').toLowerCase();
            if (initialData.sideOfFamily === 'maternal') {
              if (lowName.includes('nonna') || lowTitle.includes('nonna')) {
                roleMatch = 'maternal_grandmother';
              } else {
                roleMatch = 'maternal_grandfather';
              }
            } else {
              if (lowName.includes('nonna') || lowTitle.includes('nonna')) {
                roleMatch = 'paternal_grandmother';
              } else {
                roleMatch = 'paternal_grandfather';
              }
            }
          } else if (initialData.relationshipType === 'sibling') {
            roleMatch = 'sibling';
          } else if (initialData.relationshipType === 'spouse') {
            roleMatch = 'spouse';
          } else if (initialData.relationshipType === 'child') {
            roleMatch = 'child';
          } else if (initialData.relationshipType === 'descendant') {
            roleMatch = 'grandchild';
          } else if (initialData.relationshipType === 'companion') {
            roleMatch = 'companion';
          } else if (initialData.relationshipType === 'mentor') {
            roleMatch = 'mentor';
          } else if (initialData.relationshipType === 'ally') {
            roleMatch = 'ally';
          } else if (initialData.relationshipType === 'rival') {
            roleMatch = 'rival';
          } else if (initialData.relationshipType === 'enemy') {
            roleMatch = 'enemy';
          } else if (initialData.linkedEntityId) {
            roleMatch = 'ally';
          } else {
            roleMatch = 'custom';
          }
        }

        setSelectedDetailedRole(roleMatch);

        const foundOpt = DETAILED_ROLE_OPTIONS.find((o) => o.role === roleMatch);
        if (foundOpt) {
          setRelationshipType(foundOpt.type);
          setGenerationCategory(foundOpt.category);
          setSideOfFamily(initialData.sideOfFamily || foundOpt.side);
        }

        if (initialData.linkedEntityId) {
          setLinkSource('npc');
        } else if (initialData.linkedPlayerId) {
          setLinkSource('player');
        } else {
          setLinkSource('custom');
        }
        setCreateInCodex(false);
      } else {
        setName('');
        setTitleOrRole('');

        // Find best match according to preset parameters
        let targetRole: string | null | undefined = initialGenealogyRole;
        if (!targetRole && initialGenerationTier) {
          if (initialGenerationTier === 'ancestors') {
            targetRole = initialSideOfFamily === 'maternal' ? 'maternal_grandfather' : 'paternal_grandfather';
          } else if (initialGenerationTier === 'parents') {
            targetRole = initialSideOfFamily === 'maternal' ? 'mother' : 'father';
          } else if (initialGenerationTier === 'peers') {
            targetRole = 'sibling';
          } else if (initialGenerationTier === 'children') {
            targetRole = 'child';
          } else if (initialGenerationTier === 'descendants') {
            targetRole = 'grandchild';
          } else {
            targetRole = 'ally';
          }
        } else if (!targetRole) {
          targetRole = defaultMode === 'npc' ? 'ally' : defaultMode === 'party' ? 'companion' : 'father';
        }

        if (targetRole === 'child' || targetRole === 'son' || targetRole === 'daughter') {
          if (registeredSpouses.length > 0) {
            setSecondParentId(registeredSpouses[0].id);
            setOtherParentName(registeredSpouses[0].name);
          } else {
            setSecondParentId('');
            setOtherParentName('');
          }
        } else {
          setSecondParentId('');
          setOtherParentName('');
        }

        const foundOpt =
          DETAILED_ROLE_OPTIONS.find((o) => o.role === targetRole) ||
          (defaultMode === 'npc' ? DETAILED_ROLE_OPTIONS.find((o) => o.role === 'ally') : DETAILED_ROLE_OPTIONS[0]) ||
          DETAILED_ROLE_OPTIONS[0];

        setSelectedDetailedRole(foundOpt.role);
        setRelationshipType(foundOpt.type);
        setGenerationCategory(foundOpt.category);
        setSideOfFamily(initialSideOfFamily || foundOpt.side);
        setCustomRelationshipLabel('');
        setStatus('alive');
        setAvatarUrl('');
        setBio('');
        setLinkedEntityId('');
        setLinkedPlayerId('');
        setLinkSource('custom');
        setAttitude('neutral');
        setTrustLevel(5);
        setCreateInCodex(defaultMode === 'npc');
      }
    }
  }, [isOpen, initialData, initialGenerationTier, initialGenealogyRole, initialSideOfFamily, playerId, defaultMode]);

  if (!isOpen) return null;

  const handleDetailedRoleChange = (roleKey: string) => {
    setSelectedDetailedRole(roleKey);
    const opt = DETAILED_ROLE_OPTIONS.find((o) => o.role === roleKey);
    if (opt) {
      setRelationshipType(opt.type);
      setGenerationCategory(opt.category);
      setSideOfFamily(opt.side);
    }
    if ((roleKey === 'child' || roleKey === 'son' || roleKey === 'daughter') && !otherParentName && !secondParentId && registeredSpouses.length > 0) {
      setSecondParentId(registeredSpouses[0].id);
      setOtherParentName(registeredSpouses[0].name);
    }
  };

  const handleSelectNpc = (entityId: string) => {
    setLinkedEntityId(entityId);
    setLinkedPlayerId('');
    const ent = entities.find((e) => e._id === entityId);
    if (ent) {
      if (!name || linkSource !== 'npc') setName(ent.name);
      if (ent.images && ent.images.length > 0 && !avatarUrl) {
        setAvatarUrl(ent.images[0]);
      }
      if (ent.body && !bio) {
        const bodyText = typeof ent.body === 'string' ? ent.body : '';
        if (bodyText) setBio(bodyText);
      }
      if (ent.type && !titleOrRole) {
        setTitleOrRole(ent.type.toUpperCase());
      }
    }
  };

  const handleSelectPlayer = (pId: string) => {
    setLinkedPlayerId(pId);
    setLinkedEntityId('');
    const p = players.find((pl) => pl._id === pId);
    if (p) {
      setName(p.characterName);
      if (p.avatarUrl && !avatarUrl) setAvatarUrl(p.avatarUrl);
      if (!titleOrRole) setTitleOrRole('Compagno di Party');
      handleDetailedRoleChange('companion');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const opt = DETAILED_ROLE_OPTIONS.find((o) => o.role === selectedDetailedRole);
    const genRole = opt?.role as GenealogyRole | undefined;

    let finalLinkedEntityId = linkSource === 'npc' ? linkedEntityId || undefined : undefined;

    // Auto-create in Codex if requested and not already linked
    if (createInCodex && !finalLinkedEntityId) {
      try {
        const cleanName = name.trim();
        const existing = entities.find(
          (e) => e.name.trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (existing) {
          finalLinkedEntityId = existing._id;
        } else {
          const isFamRole =
            opt?.group === 'paternal' ||
            opt?.group === 'maternal' ||
            opt?.group === 'parents' ||
            opt?.group === 'children' ||
            opt?.group === 'descendants';
          const newEntity = CampaignManager.addEntity({
            name: cleanName,
            type: 'npc',
            status: status === 'deceased' ? 'dead' : status === 'missing' ? 'unknown' : 'alive',
            images: avatarUrl.trim() ? [avatarUrl.trim()] : [],
            aliases: [
              isFamRole ? 'Famiglia' : 'PNG',
              opt?.label || undefined,
              titleOrRole.trim() || undefined,
              customRelationshipLabel.trim() || undefined,
            ].filter(Boolean) as string[],
            progressNote: bio.trim() || `Legame con ${currentPlayerName || 'il PG'}: ${customRelationshipLabel.trim() || titleOrRole.trim() || opt?.label || 'Relazione'}`,
          });
          if (newEntity?._id) {
            finalLinkedEntityId = newEntity._id;
          }
        }
      } catch (err) {
        console.warn('Failed to auto-create entity in Codex:', err);
      }
    }

    const relation: CharacterRelationship = {
      id: initialData?.id || `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerId,
      name: name.trim(),
      titleOrRole: titleOrRole.trim() || undefined,
      relationshipType,
      customRelationshipLabel: customRelationshipLabel.trim() || undefined,
      generationCategory,
      genealogyRole: genRole,
      sideOfFamily: sideOfFamily || opt?.side || 'direct',
      status,
      avatarUrl: avatarUrl.trim() || undefined,
      bio: bio.trim() || undefined,
      secondParentId: secondParentId || undefined,
      otherParentName: otherParentName.trim() || undefined,
      linkedEntityId: finalLinkedEntityId,
      linkedPlayerId: linkSource === 'player' ? linkedPlayerId || undefined : undefined,
      sharedWithParty,
      attitude,
      trustLevel,
      createdAt: initialData?.createdAt || new Date().toISOString(),
    };

    onSave(relation);
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-surface-1 border border-surface-2 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col shrink-0 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-surface-2 flex items-center justify-between bg-surface-1/90 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-heading font-bold text-content-1">
                  {initialData ? 'Modifica Membro o Relazione' : 'Aggiungi all\'Albero Genealogico & Relazioni'}
                </h2>
                <p className="text-xs text-content-3">
                  Imposta linea genealogica fedele (nonni paterni/materni, genitori, fratelli, figli) o alleanze esterne
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Quick Link Selector */}
          <div className="p-3.5 bg-surface-2/40 border border-surface-3 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-content-2">
              <span className="flex items-center gap-1.5">
                <LinkIcon size={14} className="text-primary" /> Collega a Entità del Mondo o Personaggio PG
              </span>
              <span className="text-[11px] font-normal text-content-3">Facoltativo</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLinkSource('custom');
                  setLinkedEntityId('');
                  setLinkedPlayerId('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-center cursor-pointer ${
                  linkSource === 'custom'
                    ? 'bg-primary text-surface-0 border-primary shadow-sm'
                    : 'bg-surface-1 text-content-2 border-surface-2 hover:bg-surface-2'
                }`}
              >
                Nuovo / Personalizzato
              </button>
              <button
                type="button"
                onClick={() => setLinkSource('npc')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-center cursor-pointer ${
                  linkSource === 'npc'
                    ? 'bg-primary text-surface-0 border-primary shadow-sm'
                    : 'bg-surface-1 text-content-2 border-surface-2 hover:bg-surface-2'
                }`}
              >
                Collega NPC / Codex
              </button>
              <button
                type="button"
                onClick={() => setLinkSource('player')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-center cursor-pointer ${
                  linkSource === 'player'
                    ? 'bg-primary text-surface-0 border-primary shadow-sm'
                    : 'bg-surface-1 text-content-2 border-surface-2 hover:bg-surface-2'
                }`}
              >
                Collega PG del Party
              </button>
            </div>

            {linkSource === 'custom' && (
              <div className="pt-2">
                <div
                  onClick={() => setCreateInCodex(!createInCodex)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    createInCodex
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-surface-1 border-surface-2 hover:border-surface-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                        createInCodex ? 'bg-primary text-surface-0' : 'bg-surface-2 text-content-3'
                      }`}
                    >
                      <BookOpen size={15} />
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-content-1 block">
                        Crea anche come Scheda PNG nel Codex
                      </span>
                      <span className="text-[11px] text-content-3 block leading-tight">
                        {createInCodex
                          ? '✓ Verrà generata automaticamente la scheda nell\'Enciclopedia della Campagna.'
                          : 'Solo legame nel profilo (non comparirà tra le schede generali del Codex).'}
                      </span>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                      createInCodex ? 'bg-primary' : 'bg-surface-3'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        createInCodex ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {linkSource === 'npc' && (
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-content-3 mb-1">
                  Seleziona NPC dal Codex della Campagna:
                </label>
                <select
                  value={linkedEntityId}
                  onChange={(e) => handleSelectNpc(e.target.value)}
                  className="w-full bg-surface-1 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="">-- Seleziona un NPC esistente --</option>
                  {entities
                    .filter((e) => e.type === 'npc' || !e.type)
                    .map((ent) => (
                      <option key={ent._id} value={ent._id}>
                        {ent.name} {ent.type ? `[${ent.type}]` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {linkSource === 'player' && (
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-content-3 mb-1">
                  Seleziona un Personaggio Giocatore (PG):
                </label>
                <select
                  value={linkedPlayerId}
                  onChange={(e) => handleSelectPlayer(e.target.value)}
                  className="w-full bg-surface-1 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="">-- Seleziona un PG del Party --</option>
                  {players.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.characterName} {p.isDm ? '(DM)' : '(PG)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Grado di Parentela / Ruolo Genealogico Preciso */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-content-2">
              Grado di Parentela &amp; Ruolo nell&apos;Albero <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedDetailedRole}
                onChange={(e) => handleDetailedRoleChange(e.target.value)}
                className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 font-medium outline-none transition-colors appearance-none cursor-pointer"
              >
                <optgroup label="🏛️ Ramo Paterno (Nonni & Avi da parte di Padre)">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'paternal').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="🏛️ Ramo Materno (Nonni & Avi da parte di Madre)">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'maternal').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="👑 Genitori & Tutori">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'parents').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="⚔️ Stessa Generazione (Fratelli, Sorelle, Coniuge, Partner)">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'peers').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="🌱 Figli & Nipoti">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'children').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="🍃 Discendenza Futura">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'descendants').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="🤝 Cerchia Relazionale Esterna (Mentori, Alleati, Rivali, Nemici)">
                  {DETAILED_ROLE_OPTIONS.filter((o) => o.group === 'connections').map((o) => (
                    <option key={o.role} value={o.role}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" />
            </div>

            {selectedDetailedRole === 'custom' && (
              <div className="pt-1.5">
                <input
                  type="text"
                  value={customRelationshipLabel}
                  onChange={(e) => setCustomRelationshipLabel(e.target.value)}
                  placeholder="Specifica la relazione (es. Padrino di Battesimo, Vecchio Maestro di Spada...)"
                  className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none transition-colors"
                />
              </div>
            )}
          </div>

          {/* Co-genitore per Figli (Eroe + Coniuge) */}
          {(selectedDetailedRole === 'son' || selectedDetailedRole === 'daughter' || selectedDetailedRole === 'child') && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/25 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-400">
                <Heart size={14} className="fill-pink-500/30 text-pink-400" />
                <span>Unione Genitoriale (Entrambi i Genitori del Figlio)</span>
              </div>
              <p className="text-[11px] text-content-3 leading-relaxed">
                Questo figlio/a verrà collegato alla sacra unione tra il tuo personaggio e la consorte/partner nell&apos;albero genealogico.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-content-3 mb-1">
                    1° Genitore (Personaggio):
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-surface-2 border border-surface-3 text-xs text-content-1 font-semibold flex items-center gap-2">
                    <User size={13} className="text-primary" />
                    <span>{currentPlayerName || 'Il tuo Eroe'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-content-3 mb-1">
                    2° Genitore (Coniuge / Consorte):
                  </label>
                  {registeredSpouses.length > 0 ? (
                    <select
                      value={secondParentId ? secondParentId : (otherParentName ? 'custom' : registeredSpouses[0].id)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'none') {
                          setSecondParentId('');
                          setOtherParentName('');
                        } else if (val === 'custom') {
                          setSecondParentId('');
                        } else {
                          const sp = registeredSpouses.find((s) => s.id === val);
                          if (sp) {
                            setSecondParentId(sp.id);
                            setOtherParentName(sp.name);
                          }
                        }
                      }}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-pink-500 rounded-xl px-3 py-2 text-xs text-content-1 font-medium outline-none cursor-pointer"
                    >
                      {registeredSpouses.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          💍 {sp.name} (Coniuge Registrato)
                        </option>
                      ))}
                      <option value="none">-- Nessun coniuge / Sconosciuto --</option>
                      <option value="custom">-- Altro nome genitore... --</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={otherParentName}
                      onChange={(e) => setOtherParentName(e.target.value)}
                      placeholder="Nome coniuge o consorte..."
                      className="w-full bg-surface-2 border border-surface-3 focus:border-pink-500 rounded-xl px-3 py-2 text-xs text-content-1 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Name & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-content-2">
                Nome del Membro o Contatto <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Lord Corvus Blackwood, Maelor..."
                className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-content-2">
                Titolo / Soprannome / Ruolo
              </label>
              <input
                type="text"
                value={titleOrRole}
                onChange={(e) => setTitleOrRole(e.target.value)}
                placeholder="es. Matriarca della Casata, Capitano..."
                className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Vital Status */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-content-2">
              Stato Vitale
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setStatus(st.value)}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    status === st.value
                      ? `${st.color} font-semibold ring-1 ring-primary/40 shadow-xs`
                      : 'bg-surface-2/40 border-surface-3 text-content-3 hover:text-content-2'
                  }`}
                >
                  {st.icon}
                  <span className="truncate">{st.label.split('/')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Attitude & Trust Level */}
          <div className="bg-surface-2/40 border border-surface-3 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-content-1 flex items-center gap-1.5">
                <span>Atteggiamento &amp; Livello di Fiducia</span>
              </label>
              <span className="font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                Fiducia: {trustLevel}/10
              </span>
            </div>

            {/* Attitude selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'friendly', label: 'Amichevole', emoji: '😄', color: 'hover:border-emerald-500/50' },
                { key: 'helpful', label: 'Disponibile', emoji: '🤝', color: 'hover:border-teal-500/50' },
                { key: 'neutral', label: 'Neutrale', emoji: '😐', color: 'hover:border-amber-500/50' },
                { key: 'suspicious', label: 'Diffidente', emoji: '🤨', color: 'hover:border-purple-500/50' },
                { key: 'hostile', label: 'Ostile', emoji: '😡', color: 'hover:border-rose-500/50' },
                { key: 'rival', label: 'Rivale', emoji: '⚔️', color: 'hover:border-orange-500/50' },
                { key: 'devoted', label: 'Devoto', emoji: '👑', color: 'hover:border-pink-500/50' },
              ].map((att) => (
                <button
                  key={att.key}
                  type="button"
                  onClick={() => setAttitude(att.key as any)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    attitude === att.key
                      ? 'bg-primary/20 text-primary border-primary shadow-xs'
                      : 'bg-surface-2/60 border-surface-3 text-content-3 hover:text-content-1'
                  }`}
                >
                  <span>{att.emoji}</span>
                  <span className="truncate">{att.label}</span>
                </button>
              ))}
            </div>

            {/* Trust Level slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-content-3 font-mono">
                <span>Diffidenza Totale (1)</span>
                <span>Fiducia Cieca (10)</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={trustLevel}
                onChange={(e) => setTrustLevel(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${(trustLevel / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Portrait Image Uploader */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-content-2">
              Ritratto / Avatar
            </label>
            <SingleImageUploader
              label="Carica o inserisci URL immagine ritratto"
              value={avatarUrl}
              onChange={(url) => setAvatarUrl(url)}
            />
          </div>

          {/* Narrative Bio / Story */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-content-2">
              Storia, Legame &amp; Origini Narrativi
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Racconta brevemente chi era/è questa persona, quali insegnamenti o segreti condivide con il tuo personaggio..."
              className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-xl p-3 text-xs text-content-1 outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Privacy & Visibility with Party */}
          <div className="bg-surface-2/40 border border-surface-3 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                {sharedWithParty ? (
                  <Eye size={14} className="text-emerald-400" />
                ) : (
                  <Lock size={14} className="text-amber-400" />
                )}
                <span>Visibilità al Party</span>
              </div>
              <p className="text-[11px] text-content-3 leading-snug">
                {sharedWithParty
                  ? 'Questo membro dell\'albero genealogico è visibile anche agli altri membri del party.'
                  : 'Questo legame è riservato (segreto personale): solo tu e il Dungeon Master potete vederlo.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSharedWithParty(!sharedWithParty)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                sharedWithParty
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              {sharedWithParty ? <Eye size={13} /> : <Lock size={13} />}
              <span>{sharedWithParty ? 'Mostra al Party' : 'Solo Personale'}</span>
            </button>
          </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-surface-2 bg-surface-1 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-semibold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>{initialData ? 'Salva Modifiche' : 'Aggiungi Membro'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
