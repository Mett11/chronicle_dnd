import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, List, Link as LinkIcon, AtSign, Users, Ghost, MapPin, Tag, Sparkles, Shield, X } from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { Entity } from '../types';
import { useAuth } from './AuthProvider';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

const CATEGORY_TABS = [
  { id: 'all', label: 'Tutti', icon: AtSign },
  { id: 'npc', label: 'NPC', icon: Users },
  { id: 'monster', label: 'Mostri', icon: Ghost },
  { id: 'place', label: 'Luoghi', icon: MapPin },
  { id: 'quest', label: 'Quest', icon: Tag },
  { id: 'item', label: 'Oggetti', icon: Sparkles },
  { id: 'faction', label: 'Fazioni', icon: Shield },
];

export function RichTextEditor({ value, onChange, placeholder = 'Scrivi qui...', className = '' }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<{ query: string; index: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const { player } = useAuth();
  
  const entities = CampaignManager.getEntities().filter((e) => {
    return CampaignManager.isEntityAccessible(e, player);
  });
  
  const filteredEntities = mentionQuery
    ? entities.filter(e => {
        const q = mentionQuery.query.toLowerCase().trim();
        const matchesQuery =
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.aliases && e.aliases.some(a => a.toLowerCase().includes(q))) ||
          e.type.toLowerCase().includes(q);
        const matchesCategory = activeCategoryFilter === 'all' || e.type === activeCategoryFilter;
        return matchesQuery && matchesCategory;
      }).slice(0, 15)
    : [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionQuery?.query, activeCategoryFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && filteredEntities.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredEntities.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredEntities.length) % filteredEntities.length);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertEntityLink(filteredEntities[selectedIndex] || filteredEntities[0]);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    // Check for @mention trigger
    const selectionEnd = e.target.selectionEnd;
    const textBeforeCursor = val.substring(0, selectionEnd);
    const match = textBeforeCursor.match(/@([^@[\]\n\r]*)$/);
    
    if (match) {
      const q = match[1];
      const hasMatch = entities.some(e => {
        const qLower = q.toLowerCase();
        return e.name.toLowerCase().includes(qLower) || (e.aliases && e.aliases.some(a => a.toLowerCase().includes(qLower)));
      });

      if (q.includes(' ') && !hasMatch) {
        setMentionQuery(null);
      } else {
        setMentionQuery({ query: q, index: selectionEnd - match[0].length });
      }
    } else {
      setMentionQuery(null);
    }
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const insertEntityLink = (entity: Entity) => {
    if (!mentionQuery) return;
    const linkText = `[${entity.name}](/entities/${entity.type}/${entity._id})`;
    
    const val = value;
    const before = val.substring(0, mentionQuery.index);
    const after = val.substring(mentionQuery.index + mentionQuery.query.length + 1);
    const newText = `${before}${linkText} ${after}`;
    onChange(newText);
    setMentionQuery(null);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = before.length + linkText.length + 1;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  return (
    <div className={`flex flex-col border border-surface-3 rounded-xl bg-surface-1 focus-within:border-primary transition-all ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-surface-2 bg-surface-0/60 rounded-t-xl">
        <button type="button" onClick={() => insertText('**', '**')} className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors" title="Grassetto">
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => insertText('*', '*')} className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors" title="Corsivo">
          <Italic size={14} />
        </button>
        <div className="w-px h-4 bg-surface-3 mx-1" />
        <button type="button" onClick={() => insertText('- ')} className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors" title="Elenco puntato">
          <List size={14} />
        </button>
        <button type="button" onClick={() => insertText('[', '](url)')} className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors" title="Link">
          <LinkIcon size={14} />
        </button>
        <div className="w-px h-4 bg-surface-3 mx-1" />
        <button type="button" onClick={() => insertText('@')} className="p-1.5 text-primary hover:bg-primary/15 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" title="Menziona Entità (@)">
          <AtSign size={14} /> Entità
        </button>
      </div>
      
      {/* Editor Area */}
      <div className="relative flex-1 flex flex-col">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full flex-1 bg-transparent p-3.5 text-xs text-content-1 placeholder-content-3/60 outline-none resize-y min-h-[120px] font-body leading-relaxed rounded-b-xl"
        />
        
        {/* Mentions Popover */}
        {mentionQuery && (
          <div
            className="absolute left-4 top-10 w-80 sm:w-96 bg-surface-1 border border-surface-3 rounded-xl shadow-2xl overflow-hidden z-[9999] animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="px-3 py-2 bg-surface-2 border-b border-surface-3 flex items-center justify-between text-[10px] font-bold text-primary uppercase tracking-wider font-mono">
              <span className="flex items-center gap-1.5">
                <AtSign size={12} />
                Menziona Entità {mentionQuery.query ? `("${mentionQuery.query}")` : ''}
              </span>
              <button
                type="button"
                onClick={() => setMentionQuery(null)}
                className="text-content-3 hover:text-content-1 p-0.5 rounded transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 p-1.5 bg-surface-0/60 border-b border-surface-3 overflow-x-auto custom-scrollbar">
              {CATEGORY_TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isTabActive = activeCategoryFilter === tab.id;
                const tabCount = tab.id === 'all'
                  ? entities.length
                  : entities.filter((e) => e.type === tab.id).length;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveCategoryFilter(tab.id);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                      isTabActive
                        ? 'bg-primary text-surface-0 font-semibold shadow-sm'
                        : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                    }`}
                  >
                    <TabIcon size={11} />
                    <span>{tab.label}</span>
                    <span className={`text-[9px] opacity-70 ${isTabActive ? 'text-surface-0' : 'text-content-3'}`}>
                      ({tabCount})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Entity List */}
            {filteredEntities.length > 0 ? (
              <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5 divide-y divide-surface-2">
                {filteredEntities.map((ent, idx) => {
                  const Icon = ENTITY_ICONS[ent.type] || Users;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={ent._id}
                      type="button"
                      onClick={() => insertEntityLink(ent)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-all rounded-lg ${
                        isSelected
                          ? 'bg-primary/20 border border-primary/40 text-content-1 shadow-sm'
                          : 'hover:bg-surface-2 text-content-2 border border-transparent'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-md bg-surface-2 flex items-center justify-center border border-surface-3 shrink-0 text-primary">
                        <Icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-xs font-semibold text-content-1 truncate">{ent.name}</p>
                          <span className="text-[9px] font-mono text-content-3 uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 shrink-0">
                            {ent.type}
                          </span>
                        </div>
                        {ent.aliases && ent.aliases.length > 0 && (
                          <p className="text-[10px] text-content-3 truncate mt-0.5">
                            {ent.aliases.join(', ')}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-xs text-content-3 text-center italic">
                Nessuna entità trovata nella categoria {activeCategoryFilter !== 'all' ? activeCategoryFilter : ''}
              </div>
            )}

            {/* Popover Footer Info */}
            <div className="px-2.5 py-1.5 bg-surface-2 border-t border-surface-3 flex items-center justify-between text-[9px] font-mono text-content-3">
              <span>&uarr;&darr; Seleziona &bull; Invio Conferma</span>
              <span>Esc Chiudi</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
