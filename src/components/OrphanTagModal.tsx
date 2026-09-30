import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Link2,
  Plus,
  Users,
  Ghost,
  MapPin,
  Tag,
  Sparkles,
  Shield,
  User,
  Search,
  CheckCircle2,
  Sparkle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { Entity, Player } from '../types';

interface OrphanTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  onResolved?: (targetName: string, action: 'alias' | 'created') => void;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  npc: 'Personaggio (NPC)',
  monster: 'Mostro / Nemico',
  place: 'Luogo / Geografia',
  item: 'Oggetto / Artefatto',
  faction: 'Fazione / Ordine',
  quest: 'Quest / Missione',
};

export function OrphanTagModal({
  isOpen,
  onClose,
  tagName,
  onResolved,
}: OrphanTagModalProps) {
  const [activeTab, setActiveTab] = useState<'alias' | 'create'>('alias');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string;
    name: string;
    isPlayer: boolean;
    type?: string;
  } | null>(null);

  // New Entity Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Entity['type']>('npc');
  const [newStatus, setNewStatus] = useState<Entity['status']>('alive');
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCampaignCode = CampaignManager.getActiveCampaignCode() || '';

  // Clean raw tag string
  const cleanTag = useMemo(() => {
    let t = (tagName || '').trim();
    while (t.startsWith('@') || t.startsWith('[')) {
      t = t.slice(1);
    }
    while (t.endsWith(']')) {
      t = t.slice(0, -1);
    }
    return t.trim();
  }, [tagName]);

  // Synchronize newName when tag opens
  useEffect(() => {
    if (isOpen && cleanTag) {
      setNewName(cleanTag);
      setSelectedTarget(null);
      setSuccessMessage(null);
      setSearchQuery('');
    }
  }, [isOpen, cleanTag]);

  // Load Codex entities & party players
  const entities = useMemo(() => {
    if (!isOpen) return [];
    return CampaignManager.getEntities();
  }, [isOpen]);

  const players = useMemo(() => {
    if (!isOpen) return [];
    return CampaignManager.getPlayers();
  }, [isOpen]);

  // Find smart best-match recommendation (e.g. tag "Jeremiah" matches player "Jeremiah Sløaf" or entity "Lord Jeremiah")
  const smartRecommendation = useMemo(() => {
    if (!cleanTag) return null;
    const lowerTag = cleanTag.toLowerCase();

    // 1. Check players first (party members are frequent targets for first name vs full name)
    for (const p of players) {
      const pNameLower = p.characterName.toLowerCase();
      // Tag is first name of player (e.g. "Jeremiah" in "Jeremiah Sløaf")
      if (
        pNameLower === lowerTag ||
        pNameLower.startsWith(lowerTag + ' ') ||
        pNameLower.split(' ').includes(lowerTag)
      ) {
        return {
          id: p._id,
          name: p.characterName,
          isPlayer: true,
          type: 'pg',
          reason: `Corrisponde al nome di battesimo del personaggio giocante "${p.characterName}"`,
        };
      }
    }

    // 2. Check codex entities
    for (const ent of entities) {
      const eNameLower = ent.name.toLowerCase();
      if (
        eNameLower === lowerTag ||
        eNameLower.startsWith(lowerTag + ' ') ||
        eNameLower.split(' ').includes(lowerTag)
      ) {
        return {
          id: ent._id,
          name: ent.name,
          isPlayer: false,
          type: ent.type,
          reason: `Corrisponde all'entità del Codex "${ent.name}" (${ENTITY_TYPE_LABELS[ent.type] || ent.type})`,
        };
      }
    }

    return null;
  }, [cleanTag, players, entities]);

  // Auto-select smart recommendation if available and nothing selected
  useEffect(() => {
    if (smartRecommendation && !selectedTarget) {
      setSelectedTarget({
        id: smartRecommendation.id,
        name: smartRecommendation.name,
        isPlayer: smartRecommendation.isPlayer,
        type: smartRecommendation.type,
      });
    }
  }, [smartRecommendation]);

  // Filterable candidate list
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result: Array<{
      id: string;
      name: string;
      isPlayer: boolean;
      type: string;
      aliases?: string[];
      subtitle?: string;
    }> = [];

    // Add Players
    players.forEach((p) => {
      const match =
        !q ||
        p.characterName.toLowerCase().includes(q) ||
        (p.aliases && p.aliases.some((a) => a.toLowerCase().includes(q)));
      if (match) {
        result.push({
          id: p._id,
          name: p.characterName,
          isPlayer: true,
          type: 'pg',
          aliases: p.aliases,
          subtitle: p.isDm ? 'Dungeon Master' : 'Avventuriero del Party',
        });
      }
    });

    // Add Entities
    entities.forEach((e) => {
      const match =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(q)));
      if (match) {
        result.push({
          id: e._id,
          name: e.name,
          isPlayer: false,
          type: e.type,
          aliases: e.aliases,
          subtitle: ENTITY_TYPE_LABELS[e.type] || e.type,
        });
      }
    });

    return result;
  }, [players, entities, searchQuery]);

  const handleLinkAlias = (targetToLink = selectedTarget) => {
    if (!targetToLink || !cleanTag) return;
    setIsSubmitting(true);

    try {
      if (targetToLink.isPlayer) {
        CampaignManager.addPlayerAlias(targetToLink.id, activeCampaignCode, cleanTag);
      } else {
        CampaignManager.addEntityAlias(targetToLink.id, cleanTag);
      }

      setSuccessMessage(`Etichetta "@${cleanTag}" collegata come alias a "${targetToLink.name}"!`);
      setTimeout(() => {
        onResolved?.(targetToLink.name, 'alias');
        onClose();
        setIsSubmitting(false);
      }, 700);
    } catch (e: any) {
      console.error('Error linking alias:', e);
      setIsSubmitting(false);
    }
  };

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);

    try {
      const created = CampaignManager.addEntity({
        name: newName.trim(),
        type: newType,
        status: newStatus,
        progressNote: newNote.trim(),
        aliases: cleanTag.toLowerCase() !== newName.trim().toLowerCase() ? [cleanTag] : [],
      });

      setSuccessMessage(`Nuova entità "${created.name}" creata nel Codex e collegata a "@${cleanTag}"!`);
      setTimeout(() => {
        onResolved?.(created.name, 'created');
        onClose();
        setIsSubmitting(false);
      }, 700);
    } catch (err: any) {
      console.error('Error creating entity:', err);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-primary/25 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-2 bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Link2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-content-1">
                  Risolvi Etichetta Orfana
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
                  @{cleanTag}
                </span>
              </div>
              <p className="text-xs text-content-3">
                L'etichetta non è attualmente agganciata a nessuna scheda nel Codex.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-3 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Smart Recommendation Banner */}
        {smartRecommendation && !successMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/20 text-primary shrink-0 mt-0.5">
                <Sparkle size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-content-1">Corrispondenza rilevata</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/20 text-primary border border-primary/30">
                    {smartRecommendation.isPlayer ? 'PG Party' : smartRecommendation.type}
                  </span>
                </div>
                <p className="text-xs text-content-2 mt-0.5">
                  {smartRecommendation.reason}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleLinkAlias(smartRecommendation)}
              disabled={isSubmitting}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <span>Collega subito</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-surface-2 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('alias')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'alias'
                ? 'border-primary text-primary'
                : 'border-transparent text-content-3 hover:text-content-1'
            }`}
          >
            <Link2 size={14} />
            <span>Collega come Alias a Entità Esistente o PG</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'create'
                ? 'border-primary text-primary'
                : 'border-transparent text-content-3 hover:text-content-1'
            }`}
          >
            <Plus size={14} />
            <span>Crea Nuova Scheda nel Codex</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'alias' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Cerca nel Codex o tra i personaggi del party..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 rounded-xl pl-9 pr-4 py-2 text-xs text-content-1 placeholder:text-content-3 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-surface-2/60">
                {filteredCandidates.length === 0 ? (
                  <div className="text-center py-6 text-xs text-content-3">
                    Nessuna entità o personaggio trovato per "{searchQuery}".
                  </div>
                ) : (
                  filteredCandidates.map((cand) => {
                    const isSelected = selectedTarget?.id === cand.id;
                    const IconComponent = cand.isPlayer
                      ? User
                      : ENTITY_ICONS[cand.type] || Tag;

                    return (
                      <div
                        key={cand.id}
                        onClick={() =>
                          setSelectedTarget({
                            id: cand.id,
                            name: cand.name,
                            isPlayer: cand.isPlayer,
                            type: cand.type,
                          })
                        }
                        className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-primary/20 border border-primary/40'
                            : 'hover:bg-surface-2 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              cand.isPlayer
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-400/30'
                                : 'bg-surface-3 text-content-2 border border-surface-4'
                            }`}
                          >
                            <IconComponent size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-content-1 truncate flex items-center gap-1.5">
                              <span>{cand.name}</span>
                              {cand.aliases && cand.aliases.length > 0 && (
                                <span className="text-[10px] text-content-3 font-normal truncate">
                                  ({cand.aliases.join(', ')})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-content-3 truncate">
                              {cand.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => {}}
                            className="text-primary focus:ring-primary h-3.5 w-3.5 bg-surface-2 border-surface-4"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedTarget && (
                <div className="p-3 rounded-xl bg-surface-2/60 border border-surface-3 text-xs text-content-2 flex items-start gap-2">
                  <Info size={15} className="text-primary shrink-0 mt-0.5" />
                  <p>
                    Verrà aggiunto <strong>"{cleanTag}"</strong> come alias per{' '}
                    <strong>{selectedTarget.name}</strong>. Tutti i riferimenti{' '}
                    <code>@{cleanTag}</code> nel testo punteranno a questa scheda.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateEntity} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-content-2 mb-1">
                  Nome Entità nel Codex
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Es. Lord Jeremiah, Bosco dei Sussurri..."
                  className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-content-2 mb-1">
                    Tipo di Entità
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as Entity['type'])}
                    className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="npc">Personaggio (NPC)</option>
                    <option value="place">Luogo / Città / Geografia</option>
                    <option value="faction">Fazione / Ordine</option>
                    <option value="monster">Mostro / Creatura</option>
                    <option value="item">Oggetto / Artefatto</option>
                    <option value="quest">Quest / Missione</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-content-2 mb-1">
                    Stato Iniziale
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as Entity['status'])}
                    className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="alive">In vita / Attivo</option>
                    <option value="dead">Deceduto / Distrutto</option>
                    <option value="unknown">Sconosciuto / Misterioso</option>
                    <option value="open">Aperta (per Quest)</option>
                    <option value="completed">Completata (per Quest)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-2 mb-1">
                  Descrizione o Note Rapide (opzionale)
                </label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Aggiungi una breve nota o contesto..."
                  rows={2}
                  className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-2 text-xs text-content-1 focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-surface-2/60 border border-surface-3 text-xs text-content-2 flex items-start gap-2">
                <Info size={15} className="text-primary shrink-0 mt-0.5" />
                <p>
                  Verrà creata la scheda nel Codex e l'etichetta <code>@{cleanTag}</code> si
                  trasformerà istantaneamente in un badge interattivo con collegamento diretto.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-surface-2 bg-surface-2/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 hover:bg-surface-3 rounded-xl transition-colors"
          >
            Annulla
          </button>

          {activeTab === 'alias' ? (
            <button
              type="button"
              onClick={() => handleLinkAlias()}
              disabled={!selectedTarget || isSubmitting}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Link2 size={14} />
              <span>Collega come Alias</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateEntity}
              disabled={!newName.trim() || isSubmitting}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Crea nel Codex e Collega</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
