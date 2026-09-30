import React from 'react';
import {
  BookOpen,
  Plus,
  Lock,
  Clock,
  HelpCircle,
  Eye,
  Shield,
  EyeOff,
} from 'lucide-react';
import { Note, CharacterSectionPrivacy } from '../../types';

interface CharacterNotesTabProps {
  notes: Note[];
  isOtherPlayerView?: boolean;
  privacySettings?: CharacterSectionPrivacy;
  onTogglePrivacy?: (section: keyof CharacterSectionPrivacy) => void;
  onOpenCreateNote: () => void;
  onSelectNote: (note: Note) => void;
  characterName: string;
}

export function CharacterNotesTab({
  notes,
  isOtherPlayerView = false,
  privacySettings,
  onTogglePrivacy,
  onOpenCreateNote,
  onSelectNote,
  characterName,
}: CharacterNotesTabProps) {
  const isSectionVisibleToParty = privacySettings?.personalNotes ?? false;

  // If viewing another player's profile and they set their notes to private
  if (isOtherPlayerView && !isSectionVisibleToParty) {
    return (
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
          <Lock size={22} />
        </div>
        <h3 className="font-heading text-sm font-semibold text-content-1">
          Taccuino Personale Riservato
        </h3>
        <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
          {characterName} ha scelto di mantenere privati i propri appunti e riflessioni di gioco.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header bar with count & privacy control */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <BookOpen size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm text-content-1">
                {isOtherPlayerView ? `Taccuino di ${characterName}` : 'Taccuino Personale'}
              </h2>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
                {notes.length}
              </span>
            </div>
            <p className="text-[11px] text-content-3">
              {isOtherPlayerView
                ? 'Appunti e memorie condivise con il party'
                : 'Annotazioni private, pensieri di sessione e cronache personali'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isOtherPlayerView && onTogglePrivacy && (
            <button
              type="button"
              onClick={() => onTogglePrivacy('personalNotes')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                isSectionVisibleToParty
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title={
                isSectionVisibleToParty
                  ? 'Taccuino visibile al party. Clicca per renderlo privato.'
                  : 'Taccuino privato. Clicca per mostrarlo al party.'
              }
            >
              {isSectionVisibleToParty ? <Eye size={13} /> : <Lock size={13} />}
              <span>{isSectionVisibleToParty ? 'Visibile al Party' : 'Privato al Giocatore'}</span>
            </button>
          )}

          {!isOtherPlayerView && (
            <button
              type="button"
              id="notes-tab-create-btn"
              onClick={onOpenCreateNote}
              className="px-3 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Plus size={13} />
              <span>Nuovo Appunto</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes Grid or Empty state */}
      {notes.length === 0 ? (
        <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
          <BookOpen size={32} className="mx-auto text-content-3 opacity-50" />
          <h3 className="font-heading text-sm font-semibold text-content-1">
            {isOtherPlayerView
              ? 'Nessun appunto condiviso disponibile'
              : 'Nessun appunto personale ancora presente'}
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
            {isOtherPlayerView
              ? `${characterName} non ha registrato appunti visibili in questo momento.`
              : 'Questo taccuino è riservato alle tue annotazioni private, i tuoi segreti e i tuoi spunti di gioco.'}
          </p>
          {!isOtherPlayerView && (
            <button
              type="button"
              onClick={onOpenCreateNote}
              className="px-3.5 py-1.5 bg-primary text-surface-0 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 mt-1 cursor-pointer shadow-xs"
            >
              <Plus size={13} /> Scrivi il tuo primo appunto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {notes.map((note) => (
            <div
              key={note._id}
              onClick={() => onSelectNote(note)}
              className="bg-surface-1 border border-surface-2 hover:border-surface-3 rounded-xl p-4 space-y-3 transition-all cursor-pointer group hover:shadow-xs relative overflow-hidden flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-md bg-surface-2 text-primary shrink-0">
                      {isSectionVisibleToParty ? <Eye size={12} /> : <Lock size={12} />}
                    </span>
                    <h3 className="font-heading font-semibold text-sm text-content-1 group-hover:text-primary transition-colors truncate">
                      {note.title}
                    </h3>
                  </div>
                  {note.category && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md border shrink-0"
                      style={{
                        backgroundColor: `${note.category.color || '#6366f1'}15`,
                        borderColor: `${note.category.color || '#6366f1'}30`,
                        color: note.category.color || '#6366f1',
                      }}
                    >
                      {note.category.title}
                    </span>
                  )}
                </div>

                <p className="text-xs text-content-3 line-clamp-3 leading-relaxed">
                  {note.content || 'Nessun testo esteso...'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-content-3 pt-2.5 border-t border-surface-2/60">
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={11} />
                  {new Date(note._createdAt).toLocaleDateString('it-IT')}
                </span>
                {note.askDm && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                    <HelpCircle size={10} /> DM
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
