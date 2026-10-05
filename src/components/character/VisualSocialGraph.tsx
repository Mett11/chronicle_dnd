import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  User,
  Heart,
  Skull,
  Flame,
  Shield,
  Swords,
  Sparkles,
  Link as LinkIcon,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Eye,
  Filter,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Crown,
  Compass,
} from 'lucide-react';
import {
  CharacterRelationship,
  Player,
  Entity,
  CharacterBio,
} from '../../types';
import { useNavigate } from 'react-router-dom';

interface VisualSocialGraphProps {
  player: Player;
  relations: CharacterRelationship[];
  entities: Entity[];
  allPlayers: Player[];
  characterBio?: CharacterBio | null;
  onSelectRelation?: (rel: CharacterRelationship) => void;
  onSelectPlayer?: (p: Player) => void;
  isReadOnly?: boolean;
}

export type SocialNodeType = 'hero' | 'pg' | 'npc' | 'faction';
export type SocialAttitude = 'friendly' | 'hostile' | 'neutral' | 'suspicious';

export interface SocialGraphNode {
  id: string;
  uniqueKey: string;
  name: string;
  nodeType: SocialNodeType;
  avatarUrl?: string;
  color?: string;
  subtitle: string;
  attitude: SocialAttitude;
  relationLabel: string;
  notes?: string;
  linkedEntityId?: string;
  linkedPlayerId?: string;
  rawRelation?: CharacterRelationship;
  rawPlayer?: Player;
  rawEntity?: Entity;
  isFamily?: boolean;
  familyRole?: string;
  x: number;
  y: number;
}

export interface SocialGraphEdge {
  fromId: string;
  toId: string;
  label: string;
  attitude: SocialAttitude;
  notes?: string;
  isFamily?: boolean;
  familyRole?: string;
}

const ATTITUDE_CONFIG: Record<
  SocialAttitude,
  { label: string; stroke: string; bg: string; text: string; border: string }
> = {
  friendly: {
    label: 'Amichevole / Alleato',
    stroke: '#10b981',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  hostile: {
    label: 'Rivale / Nemico',
    stroke: '#f43f5e',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
  neutral: {
    label: 'Neutrale / Pragmatico',
    stroke: '#0ea5e9',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  suspicious: {
    label: 'Misterioso / Diffidente',
    stroke: '#a855f7',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
};

export function VisualSocialGraph({
  player,
  relations,
  entities,
  allPlayers,
  characterBio,
  onSelectRelation,
  onSelectPlayer,
}: VisualSocialGraphProps) {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'family' | 'pg' | 'npc' | 'friendly' | 'hostile'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to determine if a relation is family
  const isFamilyRelation = (rel?: CharacterRelationship | null) => {
    if (!rel) return false;
    const famTypes = ['parent', 'child', 'sibling', 'spouse', 'ancestor', 'descendant', 'relative'];
    if (famTypes.includes(rel.relationshipType)) return true;
    if (rel.generationCategory) return true;
    if (rel.genealogyRole || rel.sideOfFamily) return true;
    const label = (rel.customRelationshipLabel || rel.titleOrRole || '').toLowerCase();
    return ['padre', 'madre', 'figlio', 'figlia', 'fratello', 'sorella', 'coniuge', 'marito', 'moglie', 'nonno', 'nonna', 'antenato', 'avo', 'zio', 'zia', 'cugino', 'cugina', 'nipote', 'parente'].some(k => label.includes(k));
  };

  // 1. Build Nodes & Edges
  const { nodes, edges, centerHero, familyCount } = useMemo(() => {
    const rawNodes: Omit<SocialGraphNode, 'x' | 'y'>[] = [];
    const rawEdges: SocialGraphEdge[] = [];

    // Center Hero node
    const heroNode: Omit<SocialGraphNode, 'x' | 'y'> = {
      id: 'hero',
      uniqueKey: 'hero',
      name: player.characterName || 'Eroe',
      nodeType: 'hero',
      avatarUrl: player.avatarUrl,
      color: player.color || '#D4AF37',
      subtitle: characterBio?.characterClass || 'Protagonista',
      attitude: 'friendly',
      relationLabel: 'Tu',
      notes: characterBio?.characterTitle || characterBio?.backstoryMarkdown?.slice(0, 100),
      rawPlayer: player,
      isFamily: true,
      familyRole: 'Eroe / Te stesso',
    };

    // 2. Party Companions (PG Nodes)
    const otherPlayers = allPlayers.filter((p) => p._id !== player._id);
    otherPlayers.forEach((otherP) => {
      // Find custom interPartyRelation if available in bio
      const customPartyRel = characterBio?.interPartyRelations?.[otherP._id];
      // Or find matching CharacterRelationship linked to this player
      const linkedFamRel = relations.find((r) => r.linkedPlayerId === otherP._id);

      let attitude: SocialAttitude = 'friendly';
      let relationLabel = "Compagno d'Avventura";
      let notes = `Membro della Compagnia di Avventurieri.`;

      if (customPartyRel) {
        relationLabel = customPartyRel.relationType || relationLabel;
        attitude =
          customPartyRel.attitude === 'hostile'
            ? 'hostile'
            : customPartyRel.attitude === 'neutral'
            ? 'neutral'
            : 'friendly';
        if (customPartyRel.notes) notes = customPartyRel.notes;
      } else if (linkedFamRel) {
        relationLabel = linkedFamRel.customRelationshipLabel || linkedFamRel.name;
        if (linkedFamRel.relationshipType === 'enemy' || linkedFamRel.relationshipType === 'rival') {
          attitude = 'hostile';
        }
        if (linkedFamRel.bio) notes = linkedFamRel.bio;
      }

      const isFamily = isFamilyRelation(linkedFamRel);
      const familyRole = isFamily ? (linkedFamRel?.customRelationshipLabel || linkedFamRel?.titleOrRole || 'Familiare') : undefined;

      rawNodes.push({
        id: otherP._id,
        uniqueKey: `pg_${otherP._id}`,
        name: otherP.characterName,
        nodeType: 'pg',
        avatarUrl: otherP.avatarUrl,
        color: otherP.color || '#3b82f6',
        subtitle: 'Personaggio Giocante (PG)',
        attitude,
        relationLabel,
        notes,
        linkedPlayerId: otherP._id,
        rawPlayer: otherP,
        rawRelation: linkedFamRel,
        isFamily,
        familyRole,
      });

      rawEdges.push({
        fromId: 'hero',
        toId: otherP._id,
        label: relationLabel,
        attitude,
        notes,
        isFamily,
        familyRole,
      });
    });

    // 3. NPC & World Relations
    // Every relation from `relations` that is not a fellow player
    relations.forEach((rel) => {
      if (rel.linkedPlayerId && otherPlayers.some((p) => p._id === rel.linkedPlayerId)) {
        return; // Already handled in PG
      }

      // Find matching entity from Codex if linked
      const matchedEntity = entities.find(
        (e) =>
          (rel.linkedEntityId && e._id === rel.linkedEntityId) ||
          e.name.toLowerCase().trim() === rel.name.toLowerCase().trim()
      );

      let attitude: SocialAttitude = 'neutral';
      if (
        rel.relationshipType === 'enemy' ||
        rel.relationshipType === 'rival'
      ) {
        attitude = 'hostile';
      } else if (
        rel.relationshipType === 'mentor' ||
        rel.relationshipType === 'ally' ||
        rel.relationshipType === 'spouse' ||
        rel.relationshipType === 'child' ||
        rel.relationshipType === 'sibling' ||
        rel.relationshipType === 'parent'
      ) {
        attitude = 'friendly';
      }

      const nodeType: SocialNodeType =
        matchedEntity?.type === 'faction' ? 'faction' : 'npc';

      const relationLabel =
        rel.customRelationshipLabel ||
        rel.titleOrRole ||
        (rel.relationshipType === 'mentor'
          ? 'Mentore'
          : rel.relationshipType === 'ally'
          ? 'Alleato'
          : rel.relationshipType === 'rival'
          ? 'Rivale'
          : rel.relationshipType === 'enemy'
          ? 'Arci-Nemico'
          : rel.relationshipType === 'spouse'
          ? 'Coniuge'
          : rel.relationshipType === 'parent'
          ? 'Genitore'
          : rel.relationshipType === 'sibling'
          ? 'Fratello/Sorella'
          : 'Contatto / PNG');

      const isFamily = isFamilyRelation(rel);
      const familyRole = isFamily ? (rel.customRelationshipLabel || rel.titleOrRole || (
        rel.relationshipType === 'parent' ? 'Genitore' :
        rel.relationshipType === 'child' ? 'Figlio/a' :
        rel.relationshipType === 'sibling' ? 'Fratello/Sorella' :
        rel.relationshipType === 'spouse' ? 'Coniuge' :
        rel.relationshipType === 'ancestor' ? 'Antenato' : 'Familiare'
      )) : undefined;

      const nodeId = `rel_${rel.id}`;

      rawNodes.push({
        id: nodeId,
        uniqueKey: nodeId,
        name: rel.name,
        nodeType,
        avatarUrl: rel.avatarUrl || matchedEntity?.images?.[0] || (matchedEntity as any)?.imageUrl,
        color: matchedEntity?.color || '#10b981',
        subtitle:
          rel.titleOrRole ||
          (matchedEntity ? `Codex: ${matchedEntity.type.toUpperCase()}` : 'PNG del Mondo'),
        attitude,
        relationLabel,
        notes: rel.bio || (matchedEntity?.progressNote ? matchedEntity.progressNote.slice(0, 150) : ''),
        linkedEntityId: rel.linkedEntityId || matchedEntity?._id,
        rawRelation: rel,
        rawEntity: matchedEntity,
        isFamily,
        familyRole,
      });

      rawEdges.push({
        fromId: 'hero',
        toId: nodeId,
        label: relationLabel,
        attitude,
        notes: rel.bio,
        isFamily,
        familyRole,
      });
    });

    const totalFamilyCount = rawNodes.filter((n) => n.isFamily).length;

    // 4. Calculate Radial Positions
    const centerX = 500;
    const centerY = 360;

    // Filter nodes for display
    const visibleNodes = rawNodes.filter((node) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = node.name.toLowerCase().includes(q);
        const matchesLabel = node.relationLabel.toLowerCase().includes(q);
        const matchesSub = node.subtitle.toLowerCase().includes(q);
        if (!matchesName && !matchesLabel && !matchesSub) return false;
      }

      // Filter category
      if (filterType === 'family') return Boolean(node.isFamily);
      if (filterType === 'pg') return node.nodeType === 'pg';
      if (filterType === 'npc') return node.nodeType === 'npc' || node.nodeType === 'faction';
      if (filterType === 'friendly') return node.attitude === 'friendly';
      if (filterType === 'hostile') return node.attitude === 'hostile';
      return true;
    });

    // Separate PG companions (inner orbit) and NPCs (outer orbit)
    const pgNodes = visibleNodes.filter((n) => n.nodeType === 'pg');
    const npcNodes = visibleNodes.filter((n) => n.nodeType !== 'pg');

    const positionedNodes: SocialGraphNode[] = [];

    // Position PG nodes in inner orbit (radius = 210)
    const pgRadius = 210;
    pgNodes.forEach((node, idx) => {
      const total = pgNodes.length;
      const angle = total === 1 ? -Math.PI / 2 : (idx / total) * 2 * Math.PI - Math.PI / 2;
      positionedNodes.push({
        ...node,
        x: centerX + Math.cos(angle) * pgRadius,
        y: centerY + Math.sin(angle) * pgRadius,
      });
    });

    // Position NPC nodes in outer orbit (radius = 330)
    const npcRadius = 330;
    npcNodes.forEach((node, idx) => {
      const total = npcNodes.length;
      // Offset starting angle so they don't overlap directly with PGs
      const offset = Math.PI / (total || 1);
      const angle = (idx / (total || 1)) * 2 * Math.PI - Math.PI / 2 + offset;
      positionedNodes.push({
        ...node,
        x: centerX + Math.cos(angle) * npcRadius,
        y: centerY + Math.sin(angle) * npcRadius,
      });
    });

    // Center Hero
    const heroPositioned: SocialGraphNode = {
      ...heroNode,
      x: centerX,
      y: centerY,
    };

    return {
      nodes: positionedNodes,
      edges: rawEdges,
      centerHero: heroPositioned,
      familyCount: totalFamilyCount,
    };
  }, [player, relations, entities, allPlayers, characterBio, searchQuery, filterType]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    if (selectedNodeId === 'hero') return centerHero;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes, centerHero]);

  return (
    <div className="space-y-4">
      {/* Control Bar: Filters, Search & Zoom */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-3 sm:p-4 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-primary text-surface-0 shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            Tutti ({nodes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('family')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'family'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-amber-400'
            }`}
            title="Mostra solo i membri della famiglia e i legami di sangue / stirpe"
          >
            <Crown size={13} className={filterType === 'family' ? 'text-amber-200' : 'text-amber-400'} />
            <span>Famiglia / Stirpe ({familyCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('pg')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'pg'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-blue-400'
            }`}
          >
            <Users size={13} />
            <span>Party PG</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('npc')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'npc'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-2 hover:bg-surface-3 text-emerald-400'
            }`}
          >
            <Compass size={13} />
            <span>PNG &amp; Mondo</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('friendly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'friendly'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            <Heart size={13} className="text-emerald-400" />
            <span>Alleati</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('hostile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'hostile'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-surface-2 hover:bg-surface-3 text-content-2'
            }`}
          >
            <Swords size={13} className="text-rose-400" />
            <span>Rivali/Nemici</span>
          </button>
        </div>

        {/* Search & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nella rete..."
              className="w-full pl-9 pr-3 py-1.5 bg-surface-2 border border-surface-3 rounded-xl text-xs text-content-1 placeholder:text-content-3 focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="flex items-center bg-surface-2 border border-surface-3 rounded-xl p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
              className="p-1.5 text-content-3 hover:text-content-1 rounded-lg transition-colors cursor-pointer"
              title="Rimpicciolisci"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-content-2">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
              className="p-1.5 text-content-3 hover:text-content-1 rounded-lg transition-colors cursor-pointer"
              title="Ingrandisci"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-content-3 hover:text-content-1 rounded-lg transition-colors cursor-pointer border-l border-surface-3 ml-0.5"
              title="Reimposta Zoom"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Graph Viewport */}
      <div
        ref={containerRef}
        className="relative w-full h-[580px] sm:h-[660px] bg-surface-0 border border-surface-2 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center select-none"
      >
        {/* Subtle Background Hex / Star Pattern */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Orbit Rings (Visual Depth) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 720"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: '500px 360px',
            transition: 'transform 0.2s ease-out',
          }}
        >
          {/* Inner PG Orbit Circle */}
          <circle
            cx="500"
            cy="360"
            r="210"
            fill="none"
            stroke="rgba(59, 130, 246, 0.12)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          {/* Outer NPC Orbit Circle */}
          <circle
            cx="500"
            cy="360"
            r="330"
            fill="none"
            stroke="rgba(16, 185, 129, 0.10)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
          />

          {/* SVG Edges from Center Hero to Nodes */}
          {nodes.map((node) => {
            const attitudeConf = ATTITUDE_CONFIG[node.attitude] || ATTITUDE_CONFIG.neutral;
            const isSelected = selectedNodeId === node.id;
            const isHeroSelected = selectedNodeId === 'hero';
            const isDimmed = selectedNodeId && !isSelected && !isHeroSelected;
            const isFamily = Boolean(node.isFamily);
            const edgeStroke = isFamily ? '#f59e0b' : attitudeConf.stroke;
            const edgeWidth = isSelected ? 3.5 : isFamily ? 2.5 : 1.5;
            const edgeOpacity = isSelected ? 0.95 : isFamily ? 0.85 : 0.45;
            const displayLabel = isFamily ? `👑 ${node.familyRole || node.relationLabel}` : node.relationLabel;

            // Midpoint coordinates for edge label
            const midX = (centerHero.x + node.x) / 2;
            const midY = (centerHero.y + node.y) / 2;

            return (
              <g key={`edge_${node.uniqueKey}`} className="transition-opacity duration-200" opacity={isDimmed ? 0.2 : 1}>
                {/* Connecting Line */}
                <line
                  x1={centerHero.x}
                  y1={centerHero.y}
                  x2={node.x}
                  y2={node.y}
                  stroke={edgeStroke}
                  strokeWidth={edgeWidth}
                  strokeOpacity={edgeOpacity}
                  strokeDasharray={node.attitude === 'hostile' ? '5 5' : undefined}
                />

                {/* Edge Label Pill */}
                <g
                  transform={`translate(${midX}, ${midY})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <rect
                    x="-45"
                    y="-10"
                    width="90"
                    height="20"
                    rx="10"
                    fill="#18181b"
                    stroke={edgeStroke}
                    strokeWidth={isFamily ? '1.5' : '1'}
                    strokeOpacity={isFamily ? '0.9' : '0.6'}
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={isFamily ? '#fde68a' : '#e4e4e7'}
                    fontSize="9.5"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {displayLabel.length > 14
                      ? `${displayLabel.slice(0, 13)}…`
                      : displayLabel}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* DOM Interactive Nodes Overlay */}
        <div
          className="absolute inset-0 w-[1000px] h-[720px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: '500px 360px',
            transition: 'transform 0.2s ease-out',
          }}
        >
          {/* 1. Center Hero Node */}
          <div
            onClick={() => setSelectedNodeId(selectedNodeId === 'hero' ? null : 'hero')}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group transition-transform duration-200 z-20 ${
              selectedNodeId === 'hero' ? 'scale-115' : 'hover:scale-108'
            }`}
            style={{ left: centerHero.x, top: centerHero.y }}
          >
            <div className="relative">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-3 border-primary shadow-lg shadow-primary/30 overflow-hidden bg-surface-2 p-0.5 flex items-center justify-center">
                {centerHero.avatarUrl && centerHero.avatarUrl.trim() ? (
                  <img
                    src={centerHero.avatarUrl}
                    alt={centerHero.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 text-primary flex items-center justify-center font-heading font-bold text-xl rounded-full">
                    {centerHero.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-primary text-surface-0 rounded-full shadow-md">
                <Crown size={12} />
              </span>
            </div>

            <div className="mt-2 text-center bg-surface-1/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-primary/40 shadow-xs max-w-[120px]">
              <span className="font-heading font-bold text-xs text-content-1 block truncate">
                {centerHero.name}
              </span>
              <span className="text-[10px] text-primary font-medium block truncate">
                Protagonista
              </span>
            </div>
          </div>

          {/* 2. Orbit Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isDimmed = selectedNodeId && selectedNodeId !== 'hero' && !isSelected;
            const attitudeConf = ATTITUDE_CONFIG[node.attitude] || ATTITUDE_CONFIG.neutral;
            const isFamily = Boolean(node.isFamily);

            const isPg = node.nodeType === 'pg';
            const badgeColor = isFamily
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
              : isPg
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : node.nodeType === 'faction'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

            const borderColor = isFamily ? '#f59e0b' : attitudeConf.stroke;

            return (
              <div
                key={node.uniqueKey}
                onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group transition-all duration-200 z-10 ${
                  isSelected ? 'scale-115 z-30' : 'hover:scale-108'
                } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                style={{ left: node.x, top: node.y }}
              >
                <div className="relative">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 overflow-hidden bg-surface-2 p-0.5 flex items-center justify-center transition-shadow shadow-md ${
                      isSelected
                        ? 'border-primary ring-4 ring-primary/20 shadow-primary/30'
                        : isFamily
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : `border-[${attitudeConf.stroke}] hover:border-primary`
                    }`}
                    style={{ borderColor }}
                  >
                    {node.avatarUrl && node.avatarUrl.trim() ? (
                      <img
                        src={node.avatarUrl}
                        alt={node.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center font-heading font-semibold text-sm rounded-full text-surface-0"
                        style={{ backgroundColor: node.color || borderColor }}
                      >
                        {node.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Corner Icon Badge */}
                  <span
                    className="absolute -bottom-1 -right-1 p-0.5 rounded-full border border-surface-0 shadow-xs"
                    style={{ backgroundColor: borderColor }}
                  >
                    {isFamily ? (
                      <Crown size={10} className="text-white" />
                    ) : node.attitude === 'hostile' ? (
                      <Swords size={10} className="text-white" />
                    ) : isPg ? (
                      <Users size={10} className="text-white" />
                    ) : (
                      <Heart size={10} className="text-white" />
                    )}
                  </span>
                </div>

                {/* Node Label Card */}
                <div
                  className={`mt-1.5 text-center bg-surface-1/95 backdrop-blur-md px-2 py-0.5 rounded-xl border shadow-xs max-w-[110px] transition-colors ${
                    isSelected
                      ? 'border-primary ring-1 ring-primary/30 bg-surface-2'
                      : isFamily
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : 'border-surface-2/80 hover:border-surface-3'
                  }`}
                >
                  <span className="font-heading font-semibold text-[11px] text-content-1 block truncate">
                    {node.name}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded-sm border inline-block truncate max-w-full ${badgeColor}`}
                  >
                    {isFamily ? `👑 ${node.familyRole || node.relationLabel}` : node.relationLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Quick Detail Panel for Selected Node */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-surface-1/95 backdrop-blur-md border border-surface-2 rounded-2xl p-4 shadow-xl z-40 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-surface-3 shrink-0 bg-surface-2 flex items-center justify-center">
                  {selectedNode.avatarUrl && selectedNode.avatarUrl.trim() ? (
                    <img
                      src={selectedNode.avatarUrl}
                      alt={selectedNode.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-heading font-bold text-sm text-content-1">
                      {selectedNode.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-heading font-bold text-sm text-content-1 truncate">
                    {selectedNode.name}
                  </h4>
                  <span className="text-[11px] text-content-3 block truncate">
                    {selectedNode.subtitle}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-content-3 hover:text-content-1 text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Attitude & Role badge */}
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              {selectedNode.isFamily && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Crown size={11} className="text-amber-400" />
                  <span>{selectedNode.familyRole || 'Membro Famiglia'}</span>
                </span>
              )}

              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                  (ATTITUDE_CONFIG[selectedNode.attitude] || ATTITUDE_CONFIG.neutral).bg
                } ${(ATTITUDE_CONFIG[selectedNode.attitude] || ATTITUDE_CONFIG.neutral).text} ${
                  (ATTITUDE_CONFIG[selectedNode.attitude] || ATTITUDE_CONFIG.neutral).border
                }`}
              >
                {selectedNode.attitude === 'hostile' ? <Swords size={11} /> : <Heart size={11} />}
                <span>{selectedNode.relationLabel}</span>
              </span>

              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-2 text-content-2 border border-surface-3">
                {selectedNode.nodeType === 'pg'
                  ? 'PG Party'
                  : selectedNode.nodeType === 'hero'
                  ? 'Protagonista'
                  : selectedNode.nodeType === 'faction'
                  ? 'Fazione'
                  : 'PNG Mondo'}
              </span>
            </div>

            {/* Notes snippet */}
            {selectedNode.notes && (
              <p className="text-xs text-content-2 line-clamp-3 leading-relaxed mb-3 bg-surface-0/60 p-2 rounded-xl border border-surface-2/60">
                {selectedNode.notes}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-surface-2">
              {selectedNode.linkedEntityId && (
                <button
                  type="button"
                  onClick={() => navigate(`/entities?select=${selectedNode.linkedEntityId}`)}
                  className="flex-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <BookOpen size={12} />
                  <span>Vedi nel Codex</span>
                </button>
              )}

              {selectedNode.rawPlayer && selectedNode.nodeType === 'pg' && onSelectPlayer && (
                <button
                  type="button"
                  onClick={() => onSelectPlayer(selectedNode.rawPlayer!)}
                  className="flex-1 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <User size={12} />
                  <span>Profilo PG</span>
                </button>
              )}

              {selectedNode.rawRelation && onSelectRelation && (
                <button
                  type="button"
                  onClick={() => onSelectRelation(selectedNode.rawRelation!)}
                  className="px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Dettagli
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state when filter yields no nodes */}
        {nodes.length === 0 && (
          <div className="text-center p-6 space-y-2 z-10 max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
              <Filter size={20} />
            </div>
            <h4 className="font-heading font-semibold text-sm text-content-1">
              Nessuna relazione trovata
            </h4>
            <p className="text-xs text-content-3">
              Nessun compagno o PNG corrisponde ai filtri attuali. Prova a selezionare "Tutti" o ad aggiungere nuovi legami dal tab Famiglia &amp; Relazioni.
            </p>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-content-3 px-2 pt-1">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            <span>Orbita Interna: Party PG</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Orbita Esterna: PNG &amp; Mondo</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span>Linea Tratteggiata: Rivali / Nemici</span>
          </span>
        </div>
        <span className="italic">Clicca su qualsiasi nodo o etichetta per esplorare i dettagli.</span>
      </div>
    </div>
  );
}
