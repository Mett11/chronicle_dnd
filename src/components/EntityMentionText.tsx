import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CampaignManager } from '../store/campaignStore';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { Entity } from '../types';
import { Users, Ghost, MapPin, Tag, Sparkles, Shield, AtSign, User } from 'lucide-react';

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

interface EntityMentionTextProps {
  text?: string;
  className?: string;
  showMentions?: boolean;
  onEntityClick?: (entity: Entity) => void;
}

/**
 * High-performance parser that turns @[Entity Name], @EntityName or [Entity Name](/entities/type/id)
 * into interactive, styled entity badges that link to /entities/:type/:id or player badges.
 */
export function EntityMentionText({ text, className = '', showMentions = true, onEntityClick }: EntityMentionTextProps) {
  const { preferences } = useUserPreferences();
  const isPillEnabled = preferences?.reading?.pillTagsEnabled ?? true;
  const effectiveShowMentions = showMentions && isPillEnabled;

  if (!text) return null;

  if (!effectiveShowMentions) {
    const plain = text
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/(?<!\[)@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1');
    return <span className={className}>{plain}</span>;
  }

  // Ultra-fast bail-out if there are no mentions or markdown links in text
  if (!text.includes('@') && !text.includes('](')) {
    return <span className={className}>{text}</span>;
  }

  return <EntityMentionTextInner text={text} className={className} onEntityClick={onEntityClick} />;
}

// Inner component only rendered when mentions or links are actually present
const EntityMentionTextInner = React.memo(function EntityMentionTextInner({
  text,
  className = '',
  onEntityClick,
}: {
  text: string;
  className: string;
  onEntityClick?: (entity: Entity) => void;
}) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setVersion((v) => v + 1);
    };
    window.addEventListener('chronicle_entities_updated', handleUpdate);
    window.addEventListener('chronicle_accounts_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_entities_updated', handleUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const renderedParts = useMemo(() => {
    const entityMap = CampaignManager.getEntityLookupMap();
    const players = CampaignManager.getPlayers();
    const playerMap = new Map<string, any>();
    players.forEach((p) => {
      if (p.characterName) {
        playerMap.set(p.characterName.toLowerCase().trim(), p);
      }
      if (p.aliases && Array.isArray(p.aliases)) {
        p.aliases.forEach((a) => {
          if (a) playerMap.set(a.toLowerCase().trim(), p);
        });
      }
    });

    // Clean duplicate @ tokens
    const cleanedText = text.replace(/@\s*@+/g, '@');

    // Build multi-word names sorted descending by length to match compound names like @[Accademia T.A.V.] or @Accademia T.A.V.
    const tokenRegex = /(\[(.*?)\]\(\/entities\/([a-zA-Z]+)\/([a-zA-Z0-9_-]+)\)|@\[(.*?)\]|@([a-zA-Z0-9_'\u00C0-\u017F-]+))([.,;:!?]*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(cleanedText)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(cleanedText.substring(lastIndex, matchIndex));
      }

      const fullMatch = match[0];
      const trailingPunctuation = match[7] || '';
      let entityName = '';
      let entityType = '';
      let entityId = '';
      let isPlayer = false;

      if (match[2] && match[3] && match[4]) {
        // [Name](/entities/type/id)
        entityName = match[2];
        entityType = match[3];
        entityId = match[4];
      } else if (match[5]) {
        // @[Name]
        entityName = match[5].trim();
        const found = entityMap.get(entityName.toLowerCase());
        if (found) {
          entityType = found.type;
          entityId = found._id;
        } else if (playerMap.has(entityName.toLowerCase())) {
          isPlayer = true;
        }
      } else if (match[6]) {
        // @Name
        entityName = match[6].trim();
        while (/[.,;:!?]$/.test(entityName)) {
          entityName = entityName.slice(0, -1);
        }
        const found = entityMap.get(entityName.toLowerCase());
        if (found) {
          entityType = found.type;
          entityId = found._id;
        } else if (playerMap.has(entityName.toLowerCase())) {
          isPlayer = true;
        }
      }

      if (entityId && entityType) {
        const Icon = ENTITY_ICONS[entityType] || Users;
        const currentEntityId = entityId;
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onEntityClick) {
            const ent = CampaignManager.getEntityById(currentEntityId);
            if (ent) {
              e.preventDefault();
              onEntityClick(ent);
            }
          }
        };

        parts.push(
          <React.Fragment key={`${matchIndex}_${entityId}`}>
            <Link
              to={`/entities/${entityType}/${entityId}`}
              onClick={handleClick}
              className="inline-flex items-center gap-1 font-semibold text-content-1 hover:text-content-1 px-2 py-0.5 rounded-lg bg-primary/15 hover:bg-primary/30 border border-primary/35 hover:border-primary text-[11px] font-body transition-colors no-underline shadow-sm mx-0.5 align-baseline cursor-pointer"
              title={`Vai a scheda ${entityName} (${entityType.toUpperCase()})`}
            >
              <Icon size={11} className="text-primary shrink-0" />
              <span>{entityName}</span>
            </Link>
            {trailingPunctuation}
          </React.Fragment>
        );
      } else if (isPlayer) {
        parts.push(
          <React.Fragment key={`${matchIndex}_player_${entityName}`}>
            <span
              className="inline-flex items-center gap-1 font-semibold text-blue-200 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-400/30 text-[11px] font-body mx-0.5 align-baseline"
              title={`Avventuriero: ${entityName}`}
            >
              <User size={11} className="text-blue-300 shrink-0" />
              <span>{entityName}</span>
            </span>
            {trailingPunctuation}
          </React.Fragment>
        );
      } else if (entityName) {
        const orphanName = entityName;
        const handleResolve = (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('chronicle_resolve_orphan_tag', {
                detail: { tagName: orphanName },
              })
            );
          }
        };
        parts.push(
          <React.Fragment key={`${matchIndex}_unresolved`}>
            <button
              type="button"
              onClick={handleResolve}
              className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 px-1.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/60 text-[11px] font-body mx-0.5 align-baseline cursor-pointer transition-all group"
              title={`Tag orfano: "${entityName}". Clicca per collegarlo come alias o crearlo nel Codex.`}
            >
              <AtSign size={10} className="text-amber-400 group-hover:text-amber-300 shrink-0" />
              <span>{entityName}</span>
              <span className="opacity-0 group-hover:opacity-100 text-[9px] text-amber-400 font-mono transition-opacity ml-0.5">
                [collega]
              </span>
            </button>
            {trailingPunctuation}
          </React.Fragment>
        );
      } else {
        parts.push(fullMatch);
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < cleanedText.length) {
      parts.push(cleanedText.substring(lastIndex));
    }

    return parts;
  }, [text, version]);

  return <span className={className}>{renderedParts}</span>;
});
