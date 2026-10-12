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
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel font-bold text-sm text-content-1">
                {isOtherPlayerView ? `CHRONO-TAPE // ${characterName.toUpperCase()}` : 'CHRONO-TAPE // TACCUINO PERSONALE'}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-surface-2 border border-surface-3 text-content-2 font-bold">
                {notes.length} LOGS
              </span>
            </div>
            <p className="text-[11px] font-mono text-content-3">
              {isOtherPlayerView
                ? 'Tracce di sessione e memorie condivise con la compagnia'
                : 'Registrazioni arcanatroniche, pensieri di sessione e cronache private'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center font-heading">
          {!isOtherPlayerView && onTogglePrivacy && (
            <button
              type="button"
              onClick={() => onTogglePrivacy('personalNotes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-mono ${
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
              className="px-3.5 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors shrink-0"
            >
              <Plus size={14} />
              <span>Nuovo Appunto</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes Grid or Empty state */}
      {notes.length === 0 ? (
        <div className="bg-surface-1/90 border border-surface-2 rounded-2xl p-12 text-center space-y-3 relative overflow-hidden backdrop-blur-md">
          <BookOpen size={36} className="mx-auto text-content-3 opacity-40" />
          <h3 className="font-cinzel text-sm font-bold text-content-1">
            {isOtherPlayerView
              ? 'NESSUNA REGISTRAZIONE CONDIVISA'
              : 'NESSUN LOG PERSONALE REGISTRATO'}
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed font-mono">
            {isOtherPlayerView
              ? `${characterName} non ha registrato appunti visibili in questo momento.`
              : 'Il nastro cronologico è pronto per accogliere le tue annotazioni private, riflessioni e segreti di campagna.'}
          </p>
          {!isOtherPlayerView && (
            <button
              type="button"
              onClick={onOpenCreateNote}
              className="px-4 py-2 bg-primary text-surface-0 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 mt-2 cursor-pointer shadow-md font-heading"
            >
              <Plus size={14} /> Incidi il tuo primo appunto
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-0 sm:pl-4">
          {/* Vertical Graduated Chrono-Tape Scale Axis */}
          <div className="hidden sm:block absolute left-0 top-3 bottom-3 w-[2px] bg-gradient-to-b from-primary/60 via-surface-3 to-transparent">
            <div className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-primary" />
            <div className="absolute -bottom-1 -left-[3px] w-2 h-2 rounded-full bg-surface-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((note, idx) => (
              <div
                key={note._id}
                onClick={() => onSelectNote(note)}
                className="bg-surface-1/90 border border-surface-2 hover:border-primary/50 rounded-2xl p-4 sm:p-5 space-y-3 transition-all cursor-pointer group hover:shadow-lg relative overflow-hidden flex flex-col justify-between backdrop-blur-md"
              >
                {/* Optical Corner Brackets */}
                <span className="absolute top-1.5 left-1.5 text-[8px] font-mono text-content-3/40 pointer-events-none">┌</span>
                <span className="absolute top-1.5 right-1.5 text-[8px] font-mono text-content-3/40 pointer-events-none">┐</span>
                <span className="absolute bottom-1.5 left-1.5 text-[8px] font-mono text-content-3/40 pointer-events-none">└</span>
                <span className="absolute bottom-1.5 right-1.5 text-[8px] font-mono text-content-3/40 pointer-events-none">┘</span>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1 rounded-md bg-surface-2 text-primary shrink-0 border border-surface-3">
                        {isSectionVisibleToParty ? <Eye size={12} /> : <Lock size={12} />}
                      </span>
                      <h3 className="font-heading font-semibold text-sm text-content-1 group-hover:text-primary transition-colors truncate">
                        {note.title}
                      </h3>
                    </div>
                    {note.category && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border shrink-0"
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

                <div className="flex items-center justify-between text-[11px] text-content-3 pt-2.5 border-t border-surface-2/60 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-primary/70">TAPE-{String(idx + 1).padStart(2, '0')}</span>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(note._createdAt).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  {note.askDm && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                      <HelpCircle size={10} /> DM
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
