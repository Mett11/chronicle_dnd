import React, { useMemo, useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { AtSign, ExternalLink, Users, Ghost, MapPin, Tag, Sparkles, Shield, User } from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { Entity } from '../types';
import { sanitizeMarkdown, isSafeUrl } from '../lib/sanitize';

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

export function separateItalicActionsToNewLines(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Recognized single-word action verbs (Italian)
  const ACTION_VERBS = new Set([
    'sospira', 'annuisce', 'sorride', 'ride', 'ghigna', 'esita', 'guarda',
    'indica', 'tace', 'scuote', 'continua', 'si volta', 'si ferma', 'sussurra',
    'urla', 'ringhia', 'ammicca', 'fissa', 'indietreggia', 'avanza', 'pausa', 'silenzio',
    'sospirando', 'annuendo', 'sorridendo', 'ridendo', 'ghignando', 'esitando', 'guardando',
    'indicando', 'tacendo', 'scuotendo', 'voltandosi', 'fermandosi', 'sussurrando'
  ]);

  // Match italic expressions: *action* or _action_ (not bold ** or __)
  const italicRegex = /(?<![*_])([*_])([^*\n_]+?)\1(?![*_])/g;

  let result = text.replace(italicRegex, (match, delim, rawInner, offset, fullStr) => {
    const inner = rawInner.trim();
    if (!inner) return match;

    const words = inner.split(/\s+/);
    const isMultiWord = words.length >= 2;
    const cleanWord = inner.toLowerCase().replace(/[.,!?;:]/g, '');
    const isActionVerb = ACTION_VERBS.has(cleanWord);
    const hasPunctuation = /[.,!?;:]$/.test(inner) || /^[A-Z\u00C0-\u017F]/.test(inner);

    const isAction = isMultiWord || isActionVerb || (hasPunctuation && inner.length >= 5);

    if (!isAction) {
      return match;
    }

    const before = fullStr.slice(0, offset);
    const after = fullStr.slice(offset + match.length);

    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n\n') && !before.endsWith('\n');
    const needsNewlineAfter = after.length > 0 && !after.startsWith('\n\n') && !after.startsWith('\n');

    const prefix = needsNewlineBefore ? '\n\n' : '';
    const suffix = needsNewlineAfter ? '\n\n' : '';

    return `${prefix}${delim}${inner}${delim}${suffix}`;
  });

  return result.replace(/\n{3,}/g, '\n\n');
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  className = '',
  showMentions = true,
  separateItalicActions = true,
  onEntityClick,
}: {
  content?: string;
  className?: string;
  showMentions?: boolean;
  separateItalicActions?: boolean;
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

  const processedContent = useMemo(() => {
    if (!content) return '';

    // Anti-XSS Sanitization
    const sanitized = sanitizeMarkdown(content);

    // Format italic actions onto their own distinct lines if enabled
    let textToFormat = separateItalicActions
      ? separateItalicActionsToNewLines(sanitized)
      : sanitized;

    // If mentions are disabled for a clean reading experience, strip @ tags and brackets
    if (!showMentions) {
      let cleaned = textToFormat.replace(/@\s*@+/g, '@');
      cleaned = cleaned.replace(/@\[(.*?)\]/g, '$1');
      cleaned = cleaned.replace(/(?<!\[)@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1');
      return cleaned;
    }

    if (!textToFormat.includes('@')) return textToFormat;

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

    // Clean up duplicate @ signs like @@Accademia or @ @Accademia before matching
    let cleaned = textToFormat.replace(/@\s*@+/g, '@');

    // 1. First Match bracketed @[Entity Full Name] (e.g. @[Accademia T.A.V.] or @[Terra di Fiumi Spezzati])
    let res = cleaned.replace(/@\[(.*?)\]/g, (_match, rawName) => {
      const name = rawName.trim();
      if (!name) return '';
      const lower = name.toLowerCase();

      const foundEntity = entityMap.get(lower);
      if (foundEntity) {
        return `[${foundEntity.name}](/entities/${foundEntity.type}/${foundEntity._id})`;
      }

      const foundPlayer = playerMap.get(lower);
      if (foundPlayer) {
        return `[${foundPlayer.characterName}](#player:${encodeURIComponent(foundPlayer.characterName)})`;
      }

      // Safe clean fallback tag so syntax symbols never remain unparsed
      return `[@${name}](#mention:${encodeURIComponent(name)})`;
    });

    // 2. Build a sorted list of registered multi-word entity names and player names to match longest first
    const multiWordNames: { name: string; lower: string; isPlayer: boolean; entity?: any }[] = [];
    entityMap.forEach((ent, key) => {
      if (key.includes(' ') || key.includes('.') || key.includes('-')) {
        multiWordNames.push({ name: ent.name, lower: key, isPlayer: false, entity: ent });
      }
    });
    playerMap.forEach((pl, key) => {
      if (key.includes(' ') || key.includes('-')) {
        multiWordNames.push({ name: pl.characterName, lower: key, isPlayer: true });
      }
    });
    // Sort descending by length so longer phrases match first
    multiWordNames.sort((a, b) => b.lower.length - a.lower.length);

    for (const item of multiWordNames) {
      const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`@${escaped}\\b`, 'gi');
      res = res.replace(regex, () => {
        if (item.isPlayer) {
          return `[${item.name}](#player:${encodeURIComponent(item.name)})`;
        }
        return `[${item.entity.name}](/entities/${item.entity.type}/${item.entity._id})`;
      });
    }

    // 3. Match single-word @EntityName (supporting accents and letters, separating trailing punctuation)
    res = res.replace(/(?<!\[)@([a-zA-Z0-9_'\u00C0-\u017F-]+)(\b|[.,;:!?])/g, (_match, rawName, punct) => {
      let name = rawName.trim();
      let suffix = punct || '';
      
      // If name ends in punctuation, strip it
      while (/[.,;:!?]$/.test(name)) {
        suffix = name.slice(-1) + suffix;
        name = name.slice(0, -1);
      }
      
      if (!name) return _match;
      const lower = name.toLowerCase();

      const foundEntity = entityMap.get(lower);
      if (foundEntity) {
        return `[${foundEntity.name}](/entities/${foundEntity.type}/${foundEntity._id})${suffix}`;
      }

      const foundPlayer = playerMap.get(lower);
      if (foundPlayer) {
        return `[${foundPlayer.characterName}](#player:${encodeURIComponent(foundPlayer.characterName)})${suffix}`;
      }

      return `[@${name}](#mention:${encodeURIComponent(name)})${suffix}`;
    });

    return res;
  }, [content, version, showMentions]);

  if (!content) return null;

  return (
    <div className={`prose prose-sm max-w-none text-content-2 prose-headings:text-content-1 prose-p:text-content-2 prose-strong:text-content-1 prose-em:text-content-2 prose-code:text-primary prose-pre:bg-surface-3 prose-pre:text-content-1 prose-blockquote:border-primary prose-blockquote:text-content-2 prose-li:text-content-2 prose-a:text-primary ${className}`}>
      <Markdown
        components={{
          a: ({ node, href, children, ...props }) => {
            if (!href || !isSafeUrl(href)) {
              return <span>{children}</span>;
            }

            if (href.startsWith('/') || href.startsWith('#')) {
              const isEntityLink = href.startsWith('/entities/');
              const isPlayerLink = href.startsWith('#player:');
              const isMentionLink = href.startsWith('#mention:');

              // If mentions/tags are turned off, render as clean inline text without badge or link
              if (!showMentions && (isEntityLink || isPlayerLink || isMentionLink)) {
                return <span>{children}</span>;
              }

              if (isEntityLink) {
                const parts = href.split('/');
                const entityType = parts[2] || 'npc';
                const entityId = parts[3];
                const Icon = ENTITY_ICONS[entityType] || Users;

                const handleClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (onEntityClick && entityId) {
                    const ent = CampaignManager.getEntityById(entityId);
                    if (ent) {
                      e.preventDefault();
                      onEntityClick(ent);
                    }
                  }
                };

                return (
                  <Link
                    to={href}
                    onClick={handleClick}
                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-primary/15 hover:bg-primary/30 text-content-1 hover:text-content-1 border border-primary/35 hover:border-primary text-[11px] font-body no-underline shadow-sm transition-all mx-0.5 align-baseline cursor-pointer"
                  >
                    <Icon size={11} className="text-primary shrink-0" />
                    <span>{children}</span>
                  </Link>
                );
              }

              if (isPlayerLink) {
                return (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-200 border border-blue-400/30 text-[11px] font-body shadow-sm mx-0.5 align-baseline"
                  >
                    <User size={11} className="text-blue-500 dark:text-blue-300 shrink-0" />
                    <span>{children}</span>
                  </span>
                );
              }

              if (isMentionLink) {
                const rawMention = href.replace('#mention:', '');
                const mentionName = decodeURIComponent(rawMention);
                const handleResolve = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('chronicle_resolve_orphan_tag', {
                        detail: { tagName: mentionName },
                      })
                    );
                  }
                };
                return (
                  <button
                    type="button"
                    onClick={handleResolve}
                    className="inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/60 text-[11px] font-body mx-0.5 align-baseline cursor-pointer transition-all group"
                    title={`Tag orfano: "${mentionName}". Clicca per collegarlo come alias o crearlo nel Codex.`}
                  >
                    <AtSign size={10} className="text-amber-400 group-hover:text-amber-300 shrink-0" />
                    <span>{children}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-[9px] text-amber-400 font-mono transition-opacity ml-0.5">
                      [collega]
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  to={href}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:underline font-semibold"
                  {...(props as any)}
                >
                  {children}
                </Link>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                {...props}
              >
                <span>{children}</span>
                <ExternalLink size={10} className="opacity-60" />
              </a>
            );
          },
          em: ({ node, children, ...props }) => {
            return (
              <em className="text-content-3 italic font-serif" {...props}>
                {children}
              </em>
            );
          },
        }}
      >
        {processedContent}
      </Markdown>
    </div>
  );
});
