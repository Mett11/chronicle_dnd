import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Check, Shield, Sparkles, Compass, Skull } from 'lucide-react';
import { Player } from '../types';
import { CampaignManager } from '../store/campaignStore';

interface PlayerTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  campaignCode: string;
  onTagsSaved?: (tags: string[]) => void;
}

interface TagPresetCategory {
  title: string;
  icon: React.ReactNode;
  presets: string[];
}

const PRESET_CATEGORIES: TagPresetCategory[] = [
  {
    title: 'Ruoli & Combattimento',
    icon: <Shield size={13} className="text-primary" />,
    presets: [
      'Tank / Difensore',
      'Assalitore / DPS',
      'Guaritore / Medico',
      'Supporto / Buffer',
      'Incantatore Arcano',
      'Incantatore Divino',
      'Tiratore / Ranged',
      'Combattente da Mischia',
    ],
  },
  {
    title: 'Esplorazione & Sociale',
    icon: <Compass size={13} className="text-emerald-400" />,
    presets: [
      'Furtivo / Scout',
      'Esploratore / Guida',
      'Diplomatico / Volto',
      'Sapiente / Accademico',
      'Leader / Stratega',
      'Cercatore / Investigatore',
      'Scassinatore',
    ],
  },
  {
    title: 'Tratti & Condizioni Narrative',
    icon: <Skull size={13} className="text-purple-400" />,
    presets: [
      'Maledetto',
      'Prescelto',
      'Nobile / Erede',
      'Ricercato / Fuggitivo',
      'Posseduto',
      'Veterano',
      'Custode di Segreti',
      'Licantropo',
      'Patto Oscuro',
    ],
  },
];

export function PlayerTagsModal({
  isOpen,
  onClose,
  player,
  campaignCode,
  onTagsSaved,
}: PlayerTagsModalProps) {
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (player && isOpen) {
      const activeCode = (campaignCode || CampaignManager.getActiveCampaignCode() || '').trim().toUpperCase();
      const accounts = CampaignManager.getAccounts();
      const freshAcc = accounts.find(
        (a) => a.id === player._id || (player.email && a.email?.toLowerCase() === player.email.toLowerCase())
      );
      const prof = activeCode && freshAcc?.campaignProfiles ? freshAcc.campaignProfiles[activeCode] : null;
      const initialTags = (prof?.tags && prof.tags.length > 0)
        ? prof.tags
        : (freshAcc?.tags && freshAcc.tags.length > 0)
        ? freshAcc.tags
        : (player.tags && player.tags.length > 0 ? player.tags : []);

      setCurrentTags([...initialTags]);
      setCustomInput('');
    }
  }, [player, isOpen, campaignCode]);

  if (!isOpen || !player) return null;

  const [tagLimitMsg, setTagLimitMsg] = useState<string | null>(null);

  const handleTogglePreset = (preset: string) => {
    setTagLimitMsg(null);
    setCurrentTags((prev) => {
      if (prev.includes(preset)) {
        return prev.filter((t) => t !== preset);
      }
      if (prev.length >= 3) {
        setTagLimitMsg('Puoi assegnare un massimo di 3 etichette per giocatore.');
        return prev;
      }
      return [...prev, preset];
    });
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTagLimitMsg(null);
    const clean = customInput.trim();
    if (!clean) return;

    if (currentTags.length >= 3) {
      setTagLimitMsg('Puoi assegnare un massimo di 3 etichette per giocatore.');
      return;
    }

    if (!currentTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setCurrentTags((prev) => [...prev, clean]);
    }
    setCustomInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCurrentTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!player) return;
    const effectiveCode = (campaignCode || CampaignManager.getActiveCampaignCode() || '').trim().toUpperCase();
    CampaignManager.setPlayerTags(player._id, effectiveCode, currentTags, player.email);
    if (onTagsSaved) {
      onTagsSaved(currentTags);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-surface-1 border border-surface-3 rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-2 flex items-center justify-between gap-3 bg-surface-1/90">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 border border-surface-3 shadow-xs"
              style={{ backgroundColor: player.color || '#6366f1' }}
            >
              {player.avatarUrl && player.avatarUrl.trim() ? (
                <img
                  src={player.avatarUrl}
                  alt={player.characterName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                player.characterName?.charAt(0).toUpperCase() || 'P'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-serif font-bold text-sm text-content-1 truncate flex items-center gap-1.5">
                <Tag size={13} className="text-primary" />
                <span>Etichette PG: {player.characterName}</span>
              </h3>
              <p className="text-[11px] text-content-3 font-mono">
                Assegnazione ruoli tattici, archetipi e tratti di campagna (DM)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 text-xs font-sans">
          {tagLimitMsg && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-mono">
              {tagLimitMsg}
            </div>
          )}
          {/* Current Assigned Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-medium text-content-2 uppercase tracking-wider flex items-center gap-1.5">
                <span>Etichette Assegnate ({currentTags.length})</span>
              </label>
              {currentTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentTags([])}
                  className="text-[11px] font-mono text-content-3 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Rimuovi tutte
                </button>
              )}
            </div>

            <div className="p-3 min-h-[52px] bg-surface-0 border border-surface-2 rounded-md flex flex-wrap items-center gap-1.5">
              {currentTags.length === 0 ? (
                <span className="text-content-3 italic font-mono text-[11px]">
                  Nessuna etichetta assegnata. Seleziona un ruolo consigliato sotto o digitane uno personalizzato.
                </span>
              ) : (
                currentTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded text-xs font-mono transition-colors"
                  >
                    <Tag size={10} className="text-primary" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-content-3 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                      title="Rimuovi etichetta"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Custom Tag Input */}
          <form onSubmit={handleAddCustomTag} className="space-y-1.5">
            <label className="text-[11px] font-mono text-content-3 uppercase">
              Aggiungi Etichetta Personalizzata
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Es. Alchimista, Schivo, Campione di Kelemvor..."
                  className="w-full bg-surface-0 border border-surface-2 text-content-1 placeholder-content-3/60 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-primary transition-colors font-sans"
                />
              </div>
              <button
                type="submit"
                disabled={!customInput.trim()}
                className="px-3 py-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed text-content-1 border border-surface-3 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus size={13} />
                <span>Aggiungi</span>
              </button>
            </div>
          </form>

          {/* Quick Presets Section */}
          <div className="space-y-3.5 pt-2 border-t border-surface-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-content-2 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" />
                <span>Archetipi &amp; Ruoli Consigliati (Tocca per Assegnare)</span>
              </span>
            </div>

            <div className="space-y-3">
              {PRESET_CATEGORIES.map((cat) => (
                <div key={cat.title} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-content-3">
                    {cat.icon}
                    <span>{cat.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.presets.map((preset) => {
                      const isSelected = currentTags.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleTogglePreset(preset)}
                          className={`px-2 py-1 rounded text-[11px] font-mono border transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-primary/15 text-primary border-primary/40 font-semibold'
                              : 'bg-surface-0 text-content-3 border-surface-2 hover:text-content-1 hover:border-surface-3'
                          }`}
                        >
                          {isSelected ? <Check size={11} className="text-primary" /> : <Plus size={10} />}
                          <span>{preset}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-surface-2 bg-surface-1 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-surface-2 text-content-2 hover:text-content-1 hover:bg-surface-3 text-xs font-mono border border-surface-3 transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-surface-0 text-xs font-mono font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Check size={13} />
            <span>Salva Etichette</span>
          </button>
        </div>
      </div>
    </div>
  );
}
