import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Crown,
  Heart,
  Sparkles,
  User,
  Plus,
  Skull,
  HelpCircle,
  Flame,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Shield,
  Users,
  Edit3,
  Target,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Eye,
  Lock,
} from 'lucide-react';
import {
  CharacterRelationship,
  GenealogyRole,
  GenerationCategory,
  Player,
} from '../../types';

interface VisualFamilyTreeProps {
  player: Player;
  relations: CharacterRelationship[];
  onSelectRelation: (rel: CharacterRelationship) => void;
  onAddMemberSlot: (
    role: GenealogyRole,
    side: 'paternal' | 'maternal' | 'direct' | 'unspecified',
    category: GenerationCategory
  ) => void;
  onToggleRelationPrivacy?: (rel: CharacterRelationship) => void;
  isReadOnly?: boolean;
}

interface HubItem {
  id: string;
  isHero: boolean;
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  status?: 'alive' | 'deceased' | 'missing' | 'undead' | 'unknown';
  parentageNote?: string;
  titleOrRole?: string;
  relation?: CharacterRelationship;
}

export function VisualFamilyTree({
  player,
  relations,
  onSelectRelation,
  onAddMemberSlot,
  onToggleRelationPrivacy,
  isReadOnly = false,
}: VisualFamilyTreeProps) {
  // Currently focused character (default: 'hero')
  const [focusedId, setFocusedId] = useState<string>('hero');
  // Navigation trail
  const [historyStack, setHistoryStack] = useState<string[]>(['hero']);
  // Quick Add Dropdown open/close
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);

  // Navigate focus
  const handleSetFocus = (targetId: string) => {
    if (targetId === focusedId) return;
    setFocusedId(targetId);
    setHistoryStack((prev) => {
      const idx = prev.indexOf(targetId);
      if (idx !== -1) {
        return prev.slice(0, idx + 1);
      }
      return [...prev, targetId];
    });
  };

  const handleJumpToHistoryIndex = (idx: number) => {
    const targetId = historyStack[idx];
    if (!targetId) return;
    setFocusedId(targetId);
    setHistoryStack((prev) => prev.slice(0, idx + 1));
  };

  const handleResetToHero = () => {
    setFocusedId('hero');
    setHistoryStack(['hero']);
  };

  // Role labels
  const getRoleLabel = (rel: CharacterRelationship) => {
    if (rel.customRelationshipLabel) return rel.customRelationshipLabel;
    switch (rel.genealogyRole) {
      case 'paternal_grandfather':
        return 'Nonno Paterno';
      case 'paternal_grandmother':
        return 'Nonna Paterna';
      case 'paternal_ancestor':
        return 'Avo Paterno';
      case 'maternal_grandfather':
        return 'Nonno Materno';
      case 'maternal_grandmother':
        return 'Nonna Materna';
      case 'maternal_ancestor':
        return 'Avo Materno';
      case 'ancestor':
        return 'Antenato';
      case 'father':
        return 'Padre';
      case 'mother':
        return 'Madre';
      case 'guardian':
        return 'Tutore';
      case 'paternal_uncle':
        return 'Zio Paterno';
      case 'paternal_aunt':
        return 'Zia Paterna';
      case 'paternal_uncle_in_law':
        return 'Zio Pat. Acquisito';
      case 'paternal_aunt_in_law':
        return 'Zia Pat. Acquisita';
      case 'maternal_uncle':
        return 'Zio Materno';
      case 'maternal_aunt':
        return 'Zia Materna';
      case 'maternal_uncle_in_law':
        return 'Zio Mat. Acquisito';
      case 'maternal_aunt_in_law':
        return 'Zia Mat. Acquisita';
      case 'paternal_cousin':
        return 'Cugino/a (Pat.)';
      case 'maternal_cousin':
        return 'Cugino/a (Mat.)';
      case 'cousin':
        return 'Cugino/a';
      case 'brother':
        return 'Fratello';
      case 'sister':
        return 'Sorella';
      case 'sibling':
        return 'Fratello / Sorella';
      case 'sibling_in_law':
        return 'Cognato/a';
      case 'spouse':
        return 'Coniuge / Consorte';
      case 'son':
        return 'Figlio';
      case 'daughter':
        return 'Figlia';
      case 'child':
        return 'Figlio / Figlia';
      case 'child_in_law':
        return 'Genero / Nuora';
      case 'nephew':
        return 'Nipote (di zio)';
      case 'niece':
        return 'Nipote (di zia)';
      case 'sibling_child':
        return 'Nipote';
      case 'grandson':
        return 'Nipote (di nonno)';
      case 'granddaughter':
        return 'Nipote (di nonna)';
      case 'grandchild':
        return 'Discendente 2ª Gen.';
      case 'descendant':
        return 'Discendente';
      default:
        return rel.titleOrRole || 'Parente';
    }
  };

  const getVitalStatusBadge = (status?: string) => {
    switch (status) {
      case 'deceased':
        return (
          <span className="inline-flex items-center gap-1 text-[8.5px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.2 rounded-full whitespace-nowrap shrink-0">
            <Skull size={9} />
            <span>Deceduto</span>
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 text-[8.5px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.2 rounded-full whitespace-nowrap shrink-0">
            <HelpCircle size={9} />
            <span>Disperso</span>
          </span>
        );
      case 'undead':
        return (
          <span className="inline-flex items-center gap-1 text-[8.5px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.2 rounded-full whitespace-nowrap shrink-0">
            <Flame size={9} />
            <span>Non-Morto</span>
          </span>
        );
      case 'alive':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[8.5px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>In vita</span>
          </span>
        );
    }
  };

  const toHubItem = (rel: CharacterRelationship | undefined, fallbackLabel?: string, pNote?: string): HubItem | undefined => {
    if (!rel) return undefined;
    return {
      id: rel.id,
      isHero: false,
      name: rel.name,
      roleLabel: fallbackLabel || getRoleLabel(rel),
      avatarUrl: rel.avatarUrl,
      status: rel.status,
      titleOrRole: rel.titleOrRole,
      parentageNote: pNote || (rel.otherParentName ? `con ${rel.otherParentName}` : undefined),
      relation: rel,
    };
  };

  // Safe Hero Item
  const heroBio = (player as any).bio?.identity;
  const heroClass = (player as any).characterClass || heroBio?.class;
  const heroLevel = (player as any).level || heroBio?.level;
  const heroHubItem: HubItem = {
    id: 'hero',
    isHero: true,
    name: player.characterName || 'Eroe Principale',
    roleLabel: 'Protagonista (Eroe)',
    avatarUrl: player.avatarUrl,
    status: 'alive',
    titleOrRole: heroClass ? `${heroClass}${heroLevel ? ` · Liv. ${heroLevel}` : ''}` : 'Personaggio Giocatore',
  };

  // Categorize standard pedigree slots
  const categorized = useMemo(() => {
    const claimedIds = new Set<string>();

    const f = relations.find((r) => {
      if (claimedIds.has(r.id)) return false;
      if (r.genealogyRole === 'father') return true;
      if (
        !r.genealogyRole &&
        r.relationshipType === 'parent' &&
        (r.sideOfFamily === 'paternal' ||
          (r.name && (r.name.toLowerCase().includes('padre') || r.name.toLowerCase().includes('papà'))))
      ) {
        return true;
      }
      return false;
    });
    if (f) claimedIds.add(f.id);

    const m = relations.find((r) => {
      if (claimedIds.has(r.id)) return false;
      if (r.genealogyRole === 'mother') return true;
      if (
        !r.genealogyRole &&
        r.relationshipType === 'parent' &&
        (r.sideOfFamily === 'maternal' ||
          (r.name && (r.name.toLowerCase().includes('madre') || r.name.toLowerCase().includes('mamma'))))
      ) {
        return true;
      }
      return false;
    });
    if (m) claimedIds.add(m.id);

    const pgf = relations.find((r) => r.genealogyRole === 'paternal_grandfather');
    const pgm = relations.find((r) => r.genealogyRole === 'paternal_grandmother');
    const mgf = relations.find((r) => r.genealogyRole === 'maternal_grandfather');
    const mgm = relations.find((r) => r.genealogyRole === 'maternal_grandmother');

    const pUncles = relations.filter(
      (r) =>
        r.genealogyRole === 'paternal_uncle' ||
        r.genealogyRole === 'paternal_aunt' ||
        r.genealogyRole === 'paternal_uncle_in_law' ||
        r.genealogyRole === 'paternal_aunt_in_law' ||
        (r.sideOfFamily === 'paternal' && r.generationCategory === 'parents' && r.id !== f?.id)
    );

    const mUncles = relations.filter(
      (r) =>
        r.genealogyRole === 'maternal_uncle' ||
        r.genealogyRole === 'maternal_aunt' ||
        r.genealogyRole === 'maternal_uncle_in_law' ||
        r.genealogyRole === 'maternal_aunt_in_law' ||
        (r.sideOfFamily === 'maternal' && r.generationCategory === 'parents' && r.id !== m?.id)
    );

    const pCousins = relations.filter(
      (r) =>
        r.genealogyRole === 'paternal_cousin' ||
        (r.sideOfFamily === 'paternal' &&
          (r.genealogyRole === 'cousin' || r.generationCategory === 'peers') &&
          r.genealogyRole !== 'brother' &&
          r.genealogyRole !== 'sister' &&
          r.genealogyRole !== 'spouse')
    );

    const mCousins = relations.filter(
      (r) =>
        r.genealogyRole === 'maternal_cousin' ||
        (r.sideOfFamily === 'maternal' &&
          (r.genealogyRole === 'cousin' || r.generationCategory === 'peers') &&
          r.genealogyRole !== 'brother' &&
          r.genealogyRole !== 'sister' &&
          r.genealogyRole !== 'spouse')
    );

    const sibs = relations.filter(
      (r) =>
        r.genealogyRole === 'brother' ||
        r.genealogyRole === 'sister' ||
        r.genealogyRole === 'sibling' ||
        (r.relationshipType === 'sibling' && !r.sideOfFamily)
    );

    const sps = relations.filter((r) => r.genealogyRole === 'spouse' || r.relationshipType === 'spouse');

    const kids = relations.filter(
      (r) =>
        r.genealogyRole === 'son' ||
        r.genealogyRole === 'daughter' ||
        r.genealogyRole === 'child' ||
        (r.relationshipType === 'child' && r.genealogyRole !== 'nephew' && r.genealogyRole !== 'niece')
    );

    const gkids = relations.filter(
      (r) =>
        r.genealogyRole === 'grandson' ||
        r.genealogyRole === 'granddaughter' ||
        r.genealogyRole === 'grandchild' ||
        r.genealogyRole === 'descendant' ||
        r.relationshipType === 'descendant'
    );

    return {
      father: f,
      mother: m,
      paternalGrandfather: pgf,
      paternalGrandmother: pgm,
      maternalGrandfather: mgf,
      maternalGrandmother: mgm,
      paternalUncles: pUncles,
      maternalUncles: mUncles,
      paternalCousins: pCousins,
      maternalCousins: mCousins,
      siblings: sibs,
      spouses: sps,
      children: kids,
      grandchildren: gkids,
    };
  }, [relations]);

  // Compute the Orbit/Hub centered on `focusedId`
  const hubData = useMemo(() => {
    const isHero = focusedId === 'hero';
    const focusedRel = !isHero ? relations.find((r) => r.id === focusedId) : null;

    if (isHero || !focusedRel) {
      // CENTERED ON HERO
      return {
        center: heroHubItem,
        father: toHubItem(categorized.father, 'Padre'),
        mother: toHubItem(categorized.mother, 'Madre'),
        fatherSiblings: categorized.paternalUncles.map((u) => toHubItem(u)!),
        motherSiblings: categorized.maternalUncles.map((u) => toHubItem(u)!),
        fatherParentsLabel: categorized.paternalGrandfather || categorized.paternalGrandmother
          ? `${categorized.paternalGrandfather?.name || 'Nonno'} & ${categorized.paternalGrandmother?.name || 'Nonna'}`
          : undefined,
        motherParentsLabel: categorized.maternalGrandfather || categorized.maternalGrandmother
          ? `${categorized.maternalGrandfather?.name || 'Nonno'} & ${categorized.maternalGrandmother?.name || 'Nonna'}`
          : undefined,
        spouses: categorized.spouses.map((s) => toHubItem(s, 'Consorte')!),
        siblings: categorized.siblings.map((s) => toHubItem(s)!),
        children: categorized.children.map((c) => {
          const coParent = c.otherParentName || categorized.spouses[0]?.name;
          const pNote = coParent ? `con ${coParent}` : undefined;
          return toHubItem(c, undefined, pNote)!;
        }),
      };
    }

    // CENTERED ON A SPECIFIC RELATIVE
    const centerItem = toHubItem(focusedRel, getRoleLabel(focusedRel))!;
    const role = focusedRel.genealogyRole;

    // 1. Father focused
    if (role === 'father' || (focusedRel.relationshipType === 'parent' && focusedRel.sideOfFamily === 'paternal')) {
      return {
        center: centerItem,
        father: toHubItem(categorized.paternalGrandfather, 'Padre (Nonno dell\'Eroe)'),
        mother: toHubItem(categorized.paternalGrandmother, 'Madre (Nonna dell\'Eroe)'),
        fatherSiblings: [],
        motherSiblings: [],
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: categorized.mother ? [toHubItem(categorized.mother, 'Consorte (Madre dell\'Eroe)')!] : [],
        siblings: categorized.paternalUncles.map((u) => toHubItem(u, `Fratello/Sorella (${getRoleLabel(u)})`)!),
        children: [
          { ...heroHubItem, roleLabel: 'Figlio (Eroe)' },
          ...categorized.siblings.map((s) => toHubItem(s, `Figlio/a (${getRoleLabel(s)})`)!),
        ],
      };
    }

    // 2. Mother focused
    if (role === 'mother' || (focusedRel.relationshipType === 'parent' && focusedRel.sideOfFamily === 'maternal')) {
      return {
        center: centerItem,
        father: toHubItem(categorized.maternalGrandfather, 'Padre (Nonno dell\'Eroe)'),
        mother: toHubItem(categorized.maternalGrandmother, 'Madre (Nonna dell\'Eroe)'),
        fatherSiblings: [],
        motherSiblings: [],
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: categorized.father ? [toHubItem(categorized.father, 'Consorte (Padre dell\'Eroe)')!] : [],
        siblings: categorized.maternalUncles.map((u) => toHubItem(u, `Fratello/Sorella (${getRoleLabel(u)})`)!),
        children: [
          { ...heroHubItem, roleLabel: 'Figlio (Eroe)' },
          ...categorized.siblings.map((s) => toHubItem(s, `Figlio/a (${getRoleLabel(s)})`)!),
        ],
      };
    }

    // 3. Paternal Uncle / Aunt focused
    if (role === 'paternal_uncle' || role === 'paternal_aunt' || focusedRel.sideOfFamily === 'paternal') {
      const inLaw = categorized.paternalUncles.find(
        (u) => (u.genealogyRole === 'paternal_uncle_in_law' || u.genealogyRole === 'paternal_aunt_in_law') && u.id !== focusedRel.id
      );
      return {
        center: centerItem,
        father: toHubItem(categorized.paternalGrandfather, 'Padre (Nonno dell\'Eroe)'),
        mother: toHubItem(categorized.paternalGrandmother, 'Madre (Nonna dell\'Eroe)'),
        fatherSiblings: [],
        motherSiblings: [],
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: inLaw ? [toHubItem(inLaw, 'Consorte Acquisita')!] : [],
        siblings: [
          ...(categorized.father ? [toHubItem(categorized.father, 'Fratello (Padre dell\'Eroe)')!] : []),
          ...categorized.paternalUncles.filter((u) => u.id !== focusedRel.id && u.id !== inLaw?.id).map((u) => toHubItem(u)!),
        ],
        children: categorized.paternalCousins.map((c) => toHubItem(c, 'Figlio/a (Cugino dell\'Eroe)')!),
      };
    }

    // 4. Maternal Uncle / Aunt focused
    if (role === 'maternal_uncle' || role === 'maternal_aunt' || focusedRel.sideOfFamily === 'maternal') {
      const inLaw = categorized.maternalUncles.find(
        (u) => (u.genealogyRole === 'maternal_uncle_in_law' || u.genealogyRole === 'maternal_aunt_in_law') && u.id !== focusedRel.id
      );
      return {
        center: centerItem,
        father: toHubItem(categorized.maternalGrandfather, 'Padre (Nonno dell\'Eroe)'),
        mother: toHubItem(categorized.maternalGrandmother, 'Madre (Nonna dell\'Eroe)'),
        fatherSiblings: [],
        motherSiblings: [],
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: inLaw ? [toHubItem(inLaw, 'Consorte Acquisita')!] : [],
        siblings: [
          ...(categorized.mother ? [toHubItem(categorized.mother, 'Sorella (Madre dell\'Eroe)')!] : []),
          ...categorized.maternalUncles.filter((u) => u.id !== focusedRel.id && u.id !== inLaw?.id).map((u) => toHubItem(u)!),
        ],
        children: categorized.maternalCousins.map((c) => toHubItem(c, 'Figlio/a (Cugino dell\'Eroe)')!),
      };
    }

    // 5. Child focused
    if (role === 'son' || role === 'daughter' || role === 'child') {
      const secondParent = focusedRel.secondParentId
        ? relations.find((r) => r.id === focusedRel.secondParentId)
        : categorized.spouses[0];
      return {
        center: centerItem,
        father: { ...heroHubItem, roleLabel: 'Genitore (Eroe)' },
        mother: secondParent ? toHubItem(secondParent, 'Genitore (Consorte)') : undefined,
        fatherSiblings: [],
        motherSiblings: [],
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: [],
        siblings: categorized.children.filter((c) => c.id !== focusedRel.id).map((c) => toHubItem(c)!),
        children: categorized.grandchildren.map((g) => toHubItem(g, 'Figlio/a (Nipote dell\'Eroe)')!),
      };
    }

    // 6. Sibling focused
    if (role === 'brother' || role === 'sister' || role === 'sibling') {
      return {
        center: centerItem,
        father: toHubItem(categorized.father, 'Padre'),
        mother: toHubItem(categorized.mother, 'Madre'),
        fatherSiblings: categorized.paternalUncles.map((u) => toHubItem(u)!),
        motherSiblings: categorized.maternalUncles.map((u) => toHubItem(u)!),
        fatherParentsLabel: undefined,
        motherParentsLabel: undefined,
        spouses: [],
        siblings: [
          { ...heroHubItem, roleLabel: 'Fratello/Sorella (Eroe)' },
          ...categorized.siblings.filter((s) => s.id !== focusedRel.id).map((s) => toHubItem(s)!),
        ],
        children: relations.filter((r) => r.genealogyRole === 'nephew' || r.genealogyRole === 'niece').map((n) => toHubItem(n)!),
      };
    }

    // Fallback generic relative
    return {
      center: centerItem,
      father: undefined,
      mother: undefined,
      fatherSiblings: [],
      motherSiblings: [],
      fatherParentsLabel: undefined,
      motherParentsLabel: undefined,
      spouses: [],
      siblings: [],
      children: [],
    };
  }, [focusedId, relations, player, categorized, heroHubItem]);

  // RENDER A CLEAN CARD IN THE HUB
  const renderCard = (
    item: HubItem | undefined,
    fallbackRole: GenealogyRole,
    fallbackSide: 'paternal' | 'maternal' | 'direct' | 'unspecified',
    fallbackCategory: GenerationCategory,
    placeholderLabel: string,
    isCentral = false
  ) => {
    if (item) {
      const isCurrentPiv = item.id === focusedId;

      return (
        <div
          onClick={() => {
            if (item.relation) onSelectRelation(item.relation);
          }}
          className={`group relative flex flex-col p-3 rounded-2xl transition-all duration-150 select-none shadow-xs ${
            isCentral
              ? 'w-full sm:w-[245px] bg-primary/10 border-2 border-primary ring-2 ring-primary/30 shadow-md text-center'
              : 'w-full sm:w-[215px] bg-surface-1 border border-surface-3 hover:border-primary/60 hover:shadow-md'
          } ${item.relation ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {isCentral && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-surface-0 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1 z-10 whitespace-nowrap">
              <Crown size={10} className="text-amber-300" />
              <span>Perno della Famiglia</span>
            </div>
          )}

          <div className={`flex ${isCentral ? 'flex-col items-center' : 'items-center gap-3'}`}>
            {/* Avatar */}
            <div className={`relative shrink-0 ${isCentral ? 'mb-2 mt-1' : ''}`}>
              <div
                className={`rounded-full overflow-hidden border-2 transition-colors bg-surface-2 flex items-center justify-center shadow-inner ${
                  isCentral ? 'w-16 h-16 border-primary' : 'w-12 h-12 border-surface-3 group-hover:border-primary'
                }`}
              >
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : item.isHero ? (
                  <Shield size={isCentral ? 28 : 20} className="text-primary" />
                ) : (
                  <User size={isCentral ? 26 : 20} className="text-content-3" />
                )}
              </div>
              {item.relation?.linkedEntityId && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-surface-0 flex items-center justify-center text-[8px]"
                  title="Entità Collegata nel Codex"
                >
                  <LinkIcon size={9} />
                </div>
              )}
            </div>

            {/* Content */}
            <div className={`min-w-0 ${isCentral ? 'text-center' : 'text-left flex-1'}`}>
              <div className="text-[9.5px] font-mono font-semibold uppercase text-primary tracking-wider truncate">
                {item.roleLabel}
              </div>
              <div className={`font-serif font-bold text-content-1 truncate group-hover:text-primary transition-colors ${
                isCentral ? 'text-base sm:text-lg mt-0.5' : 'text-sm leading-snug mt-0.5'
              }`}>
                {item.name}
              </div>
              {item.parentageNote && (
                <div className="text-[9px] font-mono text-emerald-400 truncate mt-0.5">
                  {item.parentageNote}
                </div>
              )}
              {isCentral && item.titleOrRole && (
                <div className="text-[11px] text-content-3 truncate mt-0.5">
                  {item.titleOrRole}
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-2.5 pt-2 border-t border-surface-2/80 flex items-center justify-between gap-1.5">
            <div className="shrink-0 flex items-center gap-1 min-w-0">
              {getVitalStatusBadge(item.status)}

              {/* Setting Visibilità Party sui singoli componenti */}
              {!item.isHero && item.relation && (
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isReadOnly && onToggleRelationPrivacy) {
                      onToggleRelationPrivacy(item.relation!);
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1 transition-all shrink-0 whitespace-nowrap ${
                    isReadOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80 active:scale-95'
                  } ${
                    item.relation.sharedWithParty !== false
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                  title={
                    item.relation.sharedWithParty !== false
                      ? (isReadOnly ? 'Visibile al Party' : 'Visibile al Party (clicca per rendere privato/segreto)')
                      : (isReadOnly ? 'Riservato' : 'Riservato/Segreto Personale (clicca per mostrare al Party)')
                  }
                >
                  {item.relation.sharedWithParty !== false ? <Eye size={10} /> : <Lock size={10} />}
                  <span className="text-[8.5px] font-mono">
                    {item.relation.sharedWithParty !== false ? 'Party' : 'Privato'}
                  </span>
                </button>
              )}
            </div>

            {isCurrentPiv ? (
              item.relation ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRelation(item.relation!);
                  }}
                  className="px-2 py-0.5 rounded-md bg-primary text-surface-0 font-mono text-[9px] font-semibold flex items-center gap-1 hover:bg-primary-hover transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Edit3 size={10} />
                  <span>Dettagli</span>
                </button>
              ) : null
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetFocus(item.id);
                }}
                className="p-1 rounded-md bg-surface-2 hover:bg-primary hover:text-surface-0 text-content-2 border border-surface-3 hover:border-transparent transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                title={`Centra l'albero su ${item.name}`}
                aria-label={`Centra l'albero su ${item.name}`}
              >
                <Target size={12} className="text-primary group-hover:text-surface-0 transition-colors" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // Empty placeholder in read-only
    if (isReadOnly) {
      return (
        <div className="w-full sm:w-[215px] p-3 rounded-2xl border border-dashed border-surface-3/40 bg-surface-1/30 text-center flex flex-col items-center justify-center min-h-[96px] opacity-60">
          <span className="text-[10.5px] font-mono text-content-3">{placeholderLabel}</span>
          <span className="text-[9px] text-content-3 italic">Non specificato</span>
        </div>
      );
    }

    // Interactive add slot
    return (
      <button
        type="button"
        onClick={() => onAddMemberSlot(fallbackRole, fallbackSide, fallbackCategory)}
        className="group w-full sm:w-[215px] p-3 rounded-2xl border border-dashed border-surface-3 hover:border-primary/60 bg-surface-1/40 hover:bg-surface-2/60 text-center flex flex-col items-center justify-center min-h-[96px] transition-all cursor-pointer shadow-xs"
      >
        <div className="w-6 h-6 rounded-full border border-dashed border-surface-3 group-hover:border-primary group-hover:bg-primary/10 flex items-center justify-center text-content-3 group-hover:text-primary transition-all mb-1">
          <Plus size={13} />
        </div>
        <span className="text-[10px] font-mono font-semibold text-content-2 group-hover:text-primary transition-colors">
          + {placeholderLabel}
        </span>
      </button>
    );
  };

  const getNameById = (id: string) => {
    if (id === 'hero') return player.characterName || 'Eroe';
    const rel = relations.find((r) => r.id === id);
    return rel ? rel.name : 'Familiare';
  };

  return (
    <div className="space-y-4">
      {/* ========================================================= */}
      {/* 1. TOP CONTROL BAR & BREADCRUMB HISTORY                   */}
      {/* ========================================================= */}
      <div className="bg-surface-1 border border-surface-2 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Active Pivot Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Crown size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-content-3">
                  Perno Attivo:
                </span>
                <span className="text-sm font-serif font-bold text-content-1">
                  {hubData.center.name}
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-primary/15 text-primary border border-primary/25">
                  {hubData.center.roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Quick switcher & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Add Menu */}
            {!isReadOnly && (
              <div className="relative" ref={addMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-mono text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus size={14} />
                  <span>+ Aggiungi Parente</span>
                  <ChevronDown size={12} className={`transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAddMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-surface-1 border border-surface-3 rounded-2xl shadow-xl p-1.5 z-50 text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-content-3 tracking-wider">
                      Cosa vuoi aggiungere?
                    </div>

                    <div className="space-y-0.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('paternal_uncle', 'paternal', 'parents');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">🏛️ Zio / Zia Paterna</span>
                        <span className="text-[10px] font-mono text-content-3">Ramo Padre</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('maternal_uncle', 'maternal', 'parents');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">🏛️ Zio / Zia Materna</span>
                        <span className="text-[10px] font-mono text-content-3">Ramo Madre</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('paternal_cousin', 'paternal', 'peers');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">👥 Cugino/a</span>
                        <span className="text-[10px] font-mono text-content-3">Figlio di Zii</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('brother', 'direct', 'peers');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">🌱 Fratello / Sorella</span>
                        <span className="text-[10px] font-mono text-content-3">Stesso Livello</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('spouse', 'direct', 'peers');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">💍 Coniuge / Consorte</span>
                        <span className="text-[10px] font-mono text-content-3">Unione</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('child', 'direct', 'children');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">✨ Figlio / Figlia</span>
                        <span className="text-[10px] font-mono text-content-3">Discendenza</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          onAddMemberSlot('paternal_grandfather', 'paternal', 'ancestors');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 text-content-1 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="font-medium group-hover:text-primary">👑 Nonno / Nonna</span>
                        <span className="text-[10px] font-mono text-content-3">Avi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Switcher */}
            {relations.length > 0 && (
              <div className="flex items-center gap-1 bg-surface-2/60 border border-surface-3 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-[10px] font-mono text-content-3 hidden sm:inline">Centra su:</span>
                <select
                  value={focusedId}
                  onChange={(e) => handleSetFocus(e.target.value)}
                  className="bg-transparent text-content-1 text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="hero" className="bg-surface-1 text-content-1">
                    🛡️ {player.characterName || 'Eroe'} (Principale)
                  </option>
                  {relations.map((r) => (
                    <option key={r.id} value={r.id} className="bg-surface-1 text-content-1">
                      {r.name} ({getRoleLabel(r)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Return to Hero Button */}
            {focusedId !== 'hero' && (
              <button
                type="button"
                onClick={handleResetToHero}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={13} />
                <span>Torna all'Eroe</span>
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb Trail */}
        {historyStack.length > 1 && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-content-3 pt-1 border-t border-surface-2/60 overflow-x-auto custom-scrollbar">
            <span className="shrink-0 text-content-3 font-semibold">Percorso:</span>
            {historyStack.map((id, index) => {
              const isLast = index === historyStack.length - 1;
              const name = getNameById(id);
              return (
                <React.Fragment key={id}>
                  {index > 0 && <ChevronRight size={12} className="text-content-3/60 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => handleJumpToHistoryIndex(index)}
                    className={`px-1.5 py-0.5 rounded transition-colors shrink-0 cursor-pointer ${
                      isLast
                        ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                        : 'text-content-2 hover:text-primary hover:bg-surface-2'
                    }`}
                  >
                    {id === 'hero' ? '🛡️ ' : ''}
                    {name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. THE GEOMETRIC FAMILY HUB (LAYOUT FISSO A 4 DIREZIONI)  */}
      {/* ========================================================= */}
      <div className="bg-surface-1/60 border border-surface-2 rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto shadow-inner flex flex-col items-center space-y-6 sm:space-y-8">
        
        {/* ========================================================= */}
        {/* IN ALTO (⬆️): GENITORI & ASCENDENZA                        */}
        {/* ========================================================= */}
        <div className="w-full flex flex-col items-center">
          <div className="text-[10.5px] font-mono font-bold tracking-wider uppercase text-amber-400 mb-2 flex items-center gap-1.5">
            <Crown size={12} />
            <span>Ascendenza Diretta (Genitori)</span>
          </div>

          <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-8 relative">
            {/* Blocco Padre */}
            <div className="flex flex-col items-center space-y-1.5">
              {hubData.fatherParentsLabel && (
                <div className="text-[8.5px] font-mono text-amber-500/80 tracking-wider uppercase">
                  Avi: {hubData.fatherParentsLabel}
                </div>
              )}
              {renderCard(
                hubData.father,
                'father',
                'paternal',
                'parents',
                'Padre'
              )}

              {/* Zii Paterni (fratelli del padre) se presenti */}
              {hubData.fatherSiblings.length > 0 && (
                <div className="pt-1 flex flex-col items-center space-y-1">
                  <span className="text-[8px] font-mono text-content-3 font-semibold uppercase">
                    Zii Paterni ({hubData.fatherSiblings.length})
                  </span>
                  <div className="flex flex-wrap justify-center gap-1 max-w-[180px]">
                    {hubData.fatherSiblings.map((uncle) => (
                      <button
                        key={uncle.id}
                        type="button"
                        onClick={() => handleSetFocus(uncle.id)}
                        className="px-1.5 py-0.5 rounded bg-surface-2 hover:bg-primary hover:text-surface-0 text-content-2 border border-surface-3 font-mono text-[8.5px] font-medium transition-colors cursor-pointer"
                        title={`Centra la famiglia su ${uncle.name}`}
                      >
                        {uncle.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Unione Matrimoniale Genitori */}
            <div className="flex flex-col items-center justify-center pt-8">
              <div className="w-6 sm:w-10 h-0.5 bg-amber-500/40" />
              <div className="w-5 h-5 rounded-full bg-surface-2 border border-amber-500/40 flex items-center justify-center -my-2.5 z-10">
                <Heart size={10} className="text-amber-400 fill-amber-400/30" />
              </div>
            </div>

            {/* Blocco Madre */}
            <div className="flex flex-col items-center space-y-1.5">
              {hubData.motherParentsLabel && (
                <div className="text-[8.5px] font-mono text-amber-500/80 tracking-wider uppercase">
                  Avi: {hubData.motherParentsLabel}
                </div>
              )}
              {renderCard(
                hubData.mother,
                'mother',
                'maternal',
                'parents',
                'Madre'
              )}

              {/* Zii Materni (fratelli della madre) se presenti */}
              {hubData.motherSiblings.length > 0 && (
                <div className="pt-1 flex flex-col items-center space-y-1">
                  <span className="text-[8px] font-mono text-content-3 font-semibold uppercase">
                    Zii Materni ({hubData.motherSiblings.length})
                  </span>
                  <div className="flex flex-wrap justify-center gap-1 max-w-[180px]">
                    {hubData.motherSiblings.map((uncle) => (
                      <button
                        key={uncle.id}
                        type="button"
                        onClick={() => handleSetFocus(uncle.id)}
                        className="px-1.5 py-0.5 rounded bg-surface-2 hover:bg-primary hover:text-surface-0 text-content-2 border border-surface-3 font-mono text-[8.5px] font-medium transition-colors cursor-pointer"
                        title={`Centra la famiglia su ${uncle.name}`}
                      >
                        {uncle.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linea verticale dai genitori verso il centro */}
          <div className="w-0.5 h-6 sm:h-8 bg-primary/60 mt-1" />
        </div>

        {/* ========================================================= */}
        {/* AL CENTRO (⭐) & AI LATI (FRATELLI A SX | CONSORTE A DX)   */}
        {/* ========================================================= */}
        <div className="w-full flex flex-col md:flex-row items-center md:items-start justify-center gap-4 sm:gap-6">
          
          {/* A SINISTRA: FRATELLI & SORELLE */}
          <div className="w-full md:w-[225px] flex flex-col items-center md:items-end space-y-2 order-2 md:order-1">
            <div className="text-[9.5px] font-mono font-bold uppercase text-blue-400 flex items-center gap-1">
              <span>Fratelli &amp; Sorelle ({hubData.siblings.length})</span>
            </div>

            <div className="w-full space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {hubData.siblings.length > 0 ? (
                hubData.siblings.map((sib) => (
                  <div
                    key={sib.id}
                    onClick={() => {
                      if (sib.relation) onSelectRelation(sib.relation);
                    }}
                    className="p-1.5 rounded-xl bg-surface-1 border border-surface-3 hover:border-blue-500/50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-surface-2 border border-surface-3 overflow-hidden flex items-center justify-center shrink-0">
                        {sib.avatarUrl ? (
                          <img src={sib.avatarUrl} alt={sib.name} className="w-full h-full object-cover" />
                        ) : sib.isHero ? (
                          <Shield size={12} className="text-primary" />
                        ) : (
                          <User size={12} className="text-content-3" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-serif font-bold text-content-1 truncate leading-tight">
                          {sib.name}
                        </div>
                        <div className="text-[8px] font-mono text-blue-400/90 truncate">
                          {sib.roleLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!sib.isHero && sib.relation && (
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isReadOnly && onToggleRelationPrivacy) {
                              onToggleRelationPrivacy(sib.relation!);
                            }
                          }}
                          className={`p-1 rounded text-[9px] border transition-colors ${
                            isReadOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80 active:scale-95'
                          } ${
                            sib.relation.sharedWithParty !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                          title={
                            sib.relation.sharedWithParty !== false
                              ? (isReadOnly ? 'Visibile al Party' : 'Visibile al Party (clicca per rendere privato/segreto)')
                              : (isReadOnly ? 'Riservato' : 'Riservato/Segreto Personale (clicca per mostrare al Party)')
                          }
                        >
                          {sib.relation.sharedWithParty !== false ? <Eye size={10} /> : <Lock size={10} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetFocus(sib.id);
                        }}
                        className="p-1 rounded bg-surface-2 hover:bg-primary hover:text-surface-0 text-content-3 shrink-0 transition-colors cursor-pointer"
                        title={`Metti ${sib.name} al centro`}
                      >
                        <Target size={11} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[9px] text-content-3 italic py-1 text-center md:text-right">
                  Nessun fratello registrato
                </div>
              )}

              {!isReadOnly && focusedId === 'hero' && (
                <button
                  type="button"
                  onClick={() => onAddMemberSlot('brother', 'direct', 'peers')}
                  className="w-full py-1 text-center font-mono text-[9px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg border border-dashed border-blue-500/30 transition-colors cursor-pointer"
                >
                  + Aggiungi Fratello/Sorella
                </button>
              )}
            </div>
          </div>

          {/* AL CENTRO: IL PERSONAGGIO ATTIVO (PERNO) */}
          <div className="flex flex-col items-center order-1 md:order-2 shrink-0">
            {renderCard(
              hubData.center,
              'child',
              'direct',
              'peers',
              'Soggetto',
              true // isCentral
            )}
          </div>

          {/* A DESTRA: CONSORTE / CONIUGE */}
          <div className="w-full md:w-[225px] flex flex-col items-center md:items-start space-y-2 order-3">
            <div className="text-[9.5px] font-mono font-bold uppercase text-pink-400 flex items-center gap-1">
              <Heart size={10} className="fill-pink-400/40" />
              <span>Consorte &amp; Unione</span>
            </div>

            <div className="w-full space-y-1.5">
              {hubData.spouses.length > 0 ? (
                hubData.spouses.map((spouse) => (
                  <React.Fragment key={spouse.id}>
                    {renderCard(
                      spouse,
                      'spouse',
                      'direct',
                      'peers',
                      'Consorte'
                    )}
                  </React.Fragment>
                ))
              ) : (
                !isReadOnly &&
                focusedId === 'hero' && (
                  <button
                    type="button"
                    onClick={() => onAddMemberSlot('spouse', 'direct', 'peers')}
                    className="w-full sm:w-[215px] p-3 rounded-2xl border border-dashed border-pink-500/40 hover:border-pink-500/80 bg-surface-1/40 hover:bg-pink-500/10 text-center flex flex-col items-center justify-center min-h-[96px] transition-colors cursor-pointer"
                  >
                    <Heart size={15} className="text-pink-400/80 mb-1" />
                    <span className="text-[10px] font-mono text-content-2">+ Coniuge / Consorte</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* IN BASSO (⬇️): FIGLI & EREDI                               */}
        {/* ========================================================= */}
        <div className="w-full flex flex-col items-center pt-2">
          {/* Linea verticale dal centro verso i figli */}
          <div className="w-0.5 h-6 sm:h-8 bg-emerald-500/60 -mt-4 mb-2" />

          <div className="text-[10.5px] font-mono font-bold uppercase text-emerald-400 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>Discendenza Diretta (Figli &amp; Eredi: {hubData.children.length})</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-3xl">
            {hubData.children.length > 0 ? (
              hubData.children.map((child) => (
                <div key={child.id}>
                  {renderCard(
                    child,
                    'child',
                    'direct',
                    'children',
                    'Figlio / Figlia'
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 text-center rounded-xl bg-surface-2/20 border border-dashed border-surface-3/40 text-content-3 text-xs italic">
                Nessun erede diretto registrato
              </div>
            )}

            {!isReadOnly && focusedId === 'hero' && (
              <button
                type="button"
                onClick={() => onAddMemberSlot('child', 'direct', 'children')}
                className="w-full sm:w-[215px] p-3 rounded-2xl border border-dashed border-surface-3 hover:border-emerald-500/60 bg-surface-1/40 hover:bg-surface-2/60 text-center flex flex-col items-center justify-center min-h-[96px] transition-colors cursor-pointer"
              >
                <Plus size={14} className="text-emerald-400 mb-1" />
                <span className="text-[10px] font-mono text-content-2">+ Aggiungi Figlio/Figlia</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
