import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { Entity } from '../types';
import { useAuth } from './AuthProvider';
import {
  Users,
  Ghost,
  MapPin,
  Tag,
  Sparkles,
  Shield,
  AtSign,
  X,
} from 'lucide-react';

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  npc: 'NPC',
  monster: 'Mostro',
  place: 'Luogo',
  quest: 'Quest',
  item: 'Oggetto',
  faction: 'Fazione',
};

interface MentionPopupProps {
  query: string;
  onSelect: (entity: Entity) => void;
  onClose: () => void;
  position?: { top?: number; bottom?: number; left: number };
}

function MentionPopup({ query, onSelect, onClose, position }: MentionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeType, setActiveType] = useState<string>('all');
  const { player } = useAuth();
  
  const allEntities = useMemo(() => {
    return CampaignManager.getEntities().filter((e) => CampaignManager.isEntityAccessible(e, player));
  }, [player]);

  const filteredEntities = useMemo(() => {
    const qLower = query ? query.toLowerCase().trim() : '';
    return allEntities.filter((e) => {
      const matchesQuery =
        !qLower ||
        e.name.toLowerCase().includes(qLower) ||
        (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(qLower))) ||
        (ENTITY_TYPE_LABELS[e.type] && ENTITY_TYPE_LABELS[e.type].toLowerCase().includes(qLower));

      const matchesType = activeType === 'all' || e.type === activeType;
      return matchesQuery && matchesType;
    });
  }, [allEntities, query, activeType]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeType]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredEntities.length > 0 ? (prev + 1) % filteredEntities.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredEntities.length > 0 ? (prev - 1 + filteredEntities.length) % filteredEntities.length : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredEntities.length > 0 && filteredEntities[selectedIndex]) {
          e.preventDefault();
          onSelect(filteredEntities[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filteredEntities, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const typeFilters = [
    { id: 'all', label: 'Tutti', icon: AtSign },
    { id: 'npc', label: 'NPC', icon: Users },
    { id: 'monster', label: 'Mostri', icon: Ghost },
    { id: 'place', label: 'Luoghi', icon: MapPin },
    { id: 'quest', label: 'Quest', icon: Tag },
    { id: 'item', label: 'Oggetti', icon: Sparkles },
    { id: 'faction', label: 'Fazioni', icon: Shield },
  ];

  return (
    <div
      className="absolute z-50 w-80 sm:w-96 bg-surface-1 border border-surface-3 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: position ? `${Math.max(0, Math.min(position.left, 200))}px` : '0px',
        top: position?.top !== undefined ? `${position.top}px` : undefined,
        bottom: position?.bottom !== undefined ? `${position.bottom}px` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-2 bg-surface-2 border-b border-surface-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
          <AtSign size={12} />
          <span>Menziona Entità {query ? `("${query}")` : ''}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-content-3 hover:text-content-1 p-0.5 rounded transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-1.5 bg-surface-0/60 border-b border-surface-3 overflow-x-auto custom-scrollbar">
        {typeFilters.map((t) => {
          const TabIcon = t.icon;
          const isTabActive = activeType === t.id;
          const tabCount = t.id === 'all'
            ? allEntities.length
            : allEntities.filter((e) => e.type === t.id).length;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                isTabActive
                  ? 'bg-primary text-surface-0 font-semibold shadow-sm'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
              }`}
            >
              <TabIcon size={11} />
              <span>{t.label}</span>
              <span className={`text-[9px] opacity-70 ${isTabActive ? 'text-surface-0' : 'text-content-3'}`}>
                ({tabCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Entity list */}
      <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 divide-y divide-surface-2 space-y-0.5">
        {filteredEntities.length > 0 ? (
          filteredEntities.map((ent, idx) => {
            const Icon = ENTITY_ICONS[ent.type] || Users;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={ent._id}
                type="button"
                onClick={() => onSelect(ent)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-primary/20 border border-primary/40 text-content-1 shadow-sm'
                    : 'hover:bg-surface-2 text-content-2 border border-transparent'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-surface-3"
                  style={{ backgroundColor: `${ent.color || '#2563EB'}25`, color: ent.color || '#2563EB' }}
                >
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate text-content-1">{ent.name}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface-2 text-content-3 shrink-0">
                      {ENTITY_TYPE_LABELS[ent.type] || ent.type}
                    </span>
                  </div>
                  {ent.aliases && ent.aliases.length > 0 && (
                    <span className="text-[10px] text-content-3 block truncate mt-0.5">
                      {ent.aliases.join(', ')}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs text-content-3 italic">
            Nessuna entità trovata per &quot;{query}&quot;
          </div>
        )}
      </div>

      {/* Footer Helper */}
      <div className="p-1.5 bg-surface-2 border-t border-surface-3 flex items-center justify-between text-[9px] font-mono text-content-3 px-2.5">
        <span>&uarr;&darr; Seleziona &bull; Invio Conferma</span>
        <span>Esc Chiudi</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// MENTION INPUT (Single Line)
// ----------------------------------------------------
export interface MentionInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  showMentionButton?: boolean;
}

export function MentionInput({
  value,
  onValueChange,
  className = '',
  placeholder = 'Scrivi... usa @ per menzionare entità',
  showMentionButton = true,
  ...props
}: MentionInputProps) {
  const { player } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionState, setMentionState] = useState<{ query: string; index: number } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onValueChange(val);

    const cursorPos = e.target.selectionEnd || 0;
    const textBeforeCursor = val.substring(0, cursorPos);

    const match = textBeforeCursor.match(/@([^@[\]\n\r]*)$/);
    if (match) {
      const q = match[1];
      const entities = CampaignManager.getEntities().filter(e => CampaignManager.isEntityAccessible(e, player));
      const hasMatch = entities.some(e => {
        const qLower = q.toLowerCase();
        return e.name.toLowerCase().includes(qLower) || (e.aliases && e.aliases.some(a => a.toLowerCase().includes(qLower)));
      });

      if (q.includes(' ') && !hasMatch) {
        setMentionState(null);
      } else {
        setMentionState({
          query: q,
          index: cursorPos - match[0].length,
        });
      }
    } else {
      setMentionState(null);
    }
  };

  const insertMention = (entity: Entity) => {
    if (!mentionState) return;
    const formatted = `@[${entity.name}]`;
    const before = value.substring(0, mentionState.index);
    const after = value.substring(mentionState.index + mentionState.query.length + 1);
    const updated = `${before}${formatted} ${after}`;
    onValueChange(updated);
    setMentionState(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = before.length + formatted.length + 1;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const triggerMentionExplicitly = () => {
    if (inputRef.current) {
      const pos = inputRef.current.selectionEnd || value.length;
      const before = value.substring(0, pos);
      const after = value.substring(pos);
      const updated = `${before}@${after}`;
      onValueChange(updated);
      setMentionState({ query: '', index: pos });
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(pos + 1, pos + 1);
        }
      }, 10);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full ${className} ${showMentionButton ? 'pr-8' : ''}`}
          {...props}
        />
        {showMentionButton && (
          <button
            type="button"
            onClick={triggerMentionExplicitly}
            className="absolute right-2 text-content-1/30 hover:text-primary p-1 rounded transition-colors"
            title="Menziona entità (@)"
          >
            <AtSign size={14} />
          </button>
        )}
      </div>

      {mentionState && (
        <MentionPopup
          query={mentionState.query}
          onSelect={insertMention}
          onClose={() => setMentionState(null)}
          position={{ top: 40, left: 10 }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// MENTION TEXTAREA (Multiline)
// ----------------------------------------------------
export interface MentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  showMentionButton?: boolean;
}

export function MentionTextarea({
  value,
  onValueChange,
  className = '',
  placeholder = 'Scrivi la cronaca... usa @ per menzionare NPC, Quest o Luoghi',
  showMentionButton = true,
  ...props
}: MentionTextareaProps) {
  const { player } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionState, setMentionState] = useState<{ query: string; index: number } | null>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onValueChange(val);

    const cursorPos = e.target.selectionEnd || 0;
    const textBeforeCursor = val.substring(0, cursorPos);

    const match = textBeforeCursor.match(/@([^@[\]\n\r]*)$/);
    if (match) {
      const q = match[1];
      const entities = CampaignManager.getEntities().filter(e => CampaignManager.isEntityAccessible(e, player));
      const hasMatch = entities.some(e => {
        const qLower = q.toLowerCase();
        return e.name.toLowerCase().includes(qLower) || (e.aliases && e.aliases.some(a => a.toLowerCase().includes(qLower)));
      });

      if (q.includes(' ') && !hasMatch) {
        setMentionState(null);
      } else {
        setMentionState({
          query: q,
          index: cursorPos - match[0].length,
        });
      }
    } else {
      setMentionState(null);
    }
  };

  const insertMention = (entity: Entity) => {
    if (!mentionState) return;
    const formatted = `@[${entity.name}]`;
    const before = value.substring(0, mentionState.index);
    const after = value.substring(mentionState.index + mentionState.query.length + 1);
    const updated = `${before}${formatted} ${after}`;
    onValueChange(updated);
    setMentionState(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = before.length + formatted.length + 1;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const triggerMentionExplicitly = () => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionEnd || value.length;
      const before = value.substring(0, pos);
      const after = value.substring(pos);
      const updated = `${before}@${after}`;
      onValueChange(updated);
      setMentionState({ query: '', index: pos });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos + 1, pos + 1);
        }
      }, 10);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          placeholder={placeholder}
          className={`w-full ${className}`}
          {...props}
        />
        {showMentionButton && (
          <button
            type="button"
            onClick={triggerMentionExplicitly}
            className="absolute right-2.5 top-2.5 text-content-3 hover:text-primary bg-surface-2 hover:bg-surface-3 px-2 py-1 rounded-lg border border-surface-3 hover:border-primary/50 transition-all flex items-center gap-1 text-[10px] font-mono text-content-2"
            title="Menziona un'entità di campagna"
          >
            <AtSign size={12} className="text-primary" />
            <span>@ Entità</span>
          </button>
        )}
      </div>

      {mentionState && (
        <MentionPopup
          query={mentionState.query}
          onSelect={insertMention}
          onClose={() => setMentionState(null)}
          position={{ top: 38, left: 10 }}
        />
      )}
    </div>
  );
}
