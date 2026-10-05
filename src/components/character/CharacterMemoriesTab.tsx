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
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header bar with count & privacy control */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <ImageIcon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm text-content-1">
                {isOtherPlayerView ? `Memorie di ${characterName}` : 'Galleria Memorie Visive'}
              </h2>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
                {memories.length}
              </span>
            </div>
            <p className="text-[11px] text-content-3">
              {isOtherPlayerView
                ? 'Ritratti, istantanee e momenti visivi condivisi'
                : 'Ritratti, istanti di campagna, reperti e illustrazioni del personaggio'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isOtherPlayerView && onTogglePrivacy && (
            <button
              type="button"
              onClick={() => onTogglePrivacy('memories')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
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
              className="px-3 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Plus size={13} />
              <span>Nuova Memoria</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid or Empty State */}
      {memories.length === 0 ? (
        <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
          <ImageIcon size={32} className="mx-auto text-content-3 opacity-50" />
          <h3 className="font-heading text-sm font-semibold text-content-1">
            {isOtherPlayerView
              ? 'Nessuna memoria condivisa presente'
              : 'Nessuna memoria visiva salvata'}
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
            {isOtherPlayerView
              ? `${characterName} non ha caricato illustrazioni visibili al party.`
              : 'Carica illustrazioni, ritratti, schermate o ricordi salienti delle tue sessioni.'}
          </p>
          {!isOtherPlayerView && (
            <button
              type="button"
              onClick={onOpenCreateMemory}
              className="px-3.5 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium inline-flex items-center gap-1.5 mt-1 cursor-pointer shadow-xs transition-colors"
            >
              <Plus size={13} /> Aggiungi la tua prima memoria
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {memories.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectMemory(item)}
              className="bg-surface-1 border border-surface-2 rounded-xl overflow-hidden group hover:border-surface-3 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="aspect-video bg-surface-2 overflow-hidden relative">
                  {item.imageUrl && item.imageUrl.trim() ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-content-3">
                      <Sparkles size={24} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-surface-0/80 backdrop-blur-sm text-white text-[10px] font-medium rounded-md uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-1">
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

              <div className="px-3 pb-2.5 pt-1 flex items-center justify-between text-[10px] text-content-3 border-t border-surface-2/50">
                <span className="flex items-center gap-1">
                  {item.loreDate ? (
                    <>
                      <Calendar size={10} />
                      {item.loreDate}
                    </>
                  ) : (
                    'Memoria'
                  )}
                </span>
                <span className="flex items-center gap-1 text-primary group-hover:underline">
                  <Eye size={11} /> Apri
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
