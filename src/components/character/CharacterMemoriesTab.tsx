import React from 'react';
import {
  ImageIcon,
  Plus,
  Lock,
  Eye,
  Calendar,
  Tag,
  Sparkles,
} from 'lucide-react';
import { ScrapbookItem, CharacterSectionPrivacy } from '../../types';

interface CharacterMemoriesTabProps {
  memories: ScrapbookItem[];
  isOtherPlayerView?: boolean;
  privacySettings?: CharacterSectionPrivacy;
  onTogglePrivacy?: (section: keyof CharacterSectionPrivacy) => void;
  onOpenCreateMemory: () => void;
  onSelectMemory: (item: ScrapbookItem) => void;
  characterName: string;
}

export function CharacterMemoriesTab({
  memories,
  isOtherPlayerView = false,
  privacySettings,
  onTogglePrivacy,
  onOpenCreateMemory,
  onSelectMemory,
  characterName,
}: CharacterMemoriesTabProps) {
  const isSectionVisibleToParty = privacySettings?.memories ?? true;

  if (isOtherPlayerView && !isSectionVisibleToParty) {
    return (
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
          <Lock size={22} />
        </div>
        <h3 className="font-heading text-sm font-semibold text-content-1">
          Galleria Memorie Riservata
        </h3>
        <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
          {characterName} ha scelto di non condividere pubblicamente le proprie memorie visive con il gruppo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header bar with count & privacy control */}
      <div
        className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md backdrop-blur-md relative overflow-hidden"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <ImageIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel font-bold text-sm text-content-1">
                {isOtherPlayerView ? `LENTE SCRUTANTE // REPERTI DI ${characterName.toUpperCase()}` : 'LENTE SCRUTANTE // ARCHIVIO OLOGRAMMI'}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-surface-2 border border-surface-3 text-content-2 font-bold">
                {memories.length} REPERTI
              </span>
            </div>
            <p className="text-[11px] font-mono text-content-3">
              {isOtherPlayerView
                ? 'Ritratti, istantanee e momenti visivi condivisi con la compagnia'
                : 'Scansioni visive, istanti di campagna, reperti arcanatronici e ritratti'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center font-heading">
          {!isOtherPlayerView && onTogglePrivacy && (
            <button
              type="button"
              onClick={() => onTogglePrivacy('memories')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-mono ${
                isSectionVisibleToParty
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title={
                isSectionVisibleToParty
                  ? 'Galleria memorie visibile al party. Clicca per renderla privata.'
                  : 'Galleria memorie privata. Clicca per mostrarla al party.'
              }
            >
              {isSectionVisibleToParty ? <Eye size={13} /> : <Lock size={13} />}
              <span>{isSectionVisibleToParty ? 'Visibile al Party' : 'Privato al Giocatore'}</span>
            </button>
          )}

          {!isOtherPlayerView && (
            <button
              type="button"
              id="memories-tab-create-btn"
              onClick={onOpenCreateMemory}
              className="px-3.5 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors shrink-0"
            >
              <Plus size={14} />
              <span>Nuovo Reperto</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid or Empty State */}
      {memories.length === 0 ? (
        <div className="bg-surface-1/90 border border-surface-2 rounded-2xl p-12 text-center space-y-3 relative overflow-hidden backdrop-blur-md">
          <ImageIcon size={36} className="mx-auto text-content-3 opacity-40" />
          <h3 className="font-cinzel text-sm font-bold text-content-1">
            {isOtherPlayerView
              ? 'NESSUN REPERTO VISIVO CONDIVISO'
              : 'NESSUNA PROIEZIONE VISIVA SALVATA'}
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed font-mono">
            {isOtherPlayerView
              ? `${characterName} non ha caricato illustrazioni visibili alla compagnia.`
              : 'Inquadra e salva illustrazioni, ritratti, schemi e istanti salienti delle sessioni di gioco.'}
          </p>
          {!isOtherPlayerView && (
            <button
              type="button"
              onClick={onOpenCreateMemory}
              className="px-4 py-2 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 mt-2 cursor-pointer shadow-md transition-colors font-heading"
            >
              <Plus size={14} /> Proietta il primo reperto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {memories.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => onSelectMemory(item)}
              className="bg-surface-1/90 border border-surface-2 hover:border-purple-500/50 rounded-2xl overflow-hidden group transition-all cursor-pointer shadow-sm hover:shadow-xl flex flex-col justify-between backdrop-blur-md relative"
            >
              {/* Viewfinder corner crosshairs */}
              <span className="absolute top-2 left-2 text-[8px] font-mono text-white/50 pointer-events-none z-10">┌</span>
              <span className="absolute top-2 right-2 text-[8px] font-mono text-white/50 pointer-events-none z-10">┐</span>

              <div>
                <div className="aspect-video bg-surface-2 overflow-hidden relative">
                  {item.imageUrl && item.imageUrl.trim() ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-content-3">
                      <Sparkles size={24} />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                    <span className="px-2 py-0.5 bg-surface-0/85 backdrop-blur-sm text-purple-300 border border-purple-500/30 text-[9px] font-mono font-semibold rounded-md uppercase tracking-wider">
                      {item.category} // REP-{String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 space-y-1">
                  <h4 className="font-heading font-semibold text-xs text-content-1 group-hover:text-primary transition-colors truncate">
                    {item.title}
                  </h4>
                  {item.caption && (
                    <p className="text-[11px] text-content-3 line-clamp-2 leading-relaxed">
                      {item.caption}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-3.5 pb-3 pt-1 flex items-center justify-between text-[10px] text-content-3 border-t border-surface-2/60 font-mono">
                <span className="flex items-center gap-1">
                  {item.loreDate ? (
                    <>
                      <Calendar size={10} />
                      {item.loreDate}
                    </>
                  ) : (
                    item.createdAt ? new Date(item.createdAt).toLocaleDateString('it-IT') : 'Data non registrata'
                  )}
                </span>
                <span className="text-primary/70 text-[9px]">LENTE: OK</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
