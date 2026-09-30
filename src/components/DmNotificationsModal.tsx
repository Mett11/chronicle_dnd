import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  MessageSquare,
  Send,
  X,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Trash2,
  CheckCheck,
  RotateCcw,
  BellOff,
  Eye,
} from 'lucide-react';
import { Note, Player } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { motion } from 'framer-motion';
import { Portal } from './Portal';

interface DmNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Player | null;
  onSelectNote?: (noteId: string) => void;
}

export function DmNotificationsModal({
  isOpen,
  onClose,
  currentUser,
  onSelectNote,
}: DmNotificationsModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'pending' | 'archived' | 'all'>('pending');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingNoteId, setReplyingNoteId] = useState<string | null>(null);

  const isDm = !!currentUser?.isDm;
  const currentUserId = currentUser?._id || (currentUser as any)?.id || CampaignManager.getCurrentAccount()?.id;

  const refreshNotes = () => {
    const allNotes = CampaignManager.getNotes();
    // Filter notes that have askDm = true or have a dmResponse
    const askDmNotes = allNotes.filter((n) => n.askDm || n.dmResponse);
    setNotes(askDmNotes);
    const dismissed = CampaignManager.getDismissedNotificationIds(currentUserId);
    setDismissedIds(dismissed);
  };

  useEffect(() => {
    if (isOpen) {
      refreshNotes();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Filter notes based on user role
  const userRoleNotes = notes.filter((n) => {
    if (isDm) {
      if (n.hiddenForDm) return false;
    } else {
      // Player sees only their own questions
      const authorId = n.author?._id || (n.author as any)?.id;
      if (authorId !== currentUserId && n.author?.email !== currentUser?.email) {
        return false;
      }
      if (currentUserId && n.hiddenForPlayerIds?.includes(currentUserId)) {
        return false;
      }
    }
    return true;
  });

  // Active / pending count for badge and filter
  const pendingNotes = userRoleNotes.filter((n) => {
    const isDismissed = dismissedIds.includes(n._id);
    if (isDismissed) return false;

    if (isDm) {
      return !n.dmResponse?.text || !n.dmResponse.isResolved;
    } else {
      // For PG: note is pending if asked or if answered and not yet dismissed
      return true;
    }
  });

  const archivedNotes = userRoleNotes.filter((n) => {
    const isDismissed = dismissedIds.includes(n._id);
    const isResolved = !!n.dmResponse?.isResolved;
    return isDismissed || (isDm && isResolved);
  });

  const visibleNotes = userRoleNotes.filter((n) => {
    const isDismissed = dismissedIds.includes(n._id);
    if (filter === 'pending') {
      if (isDismissed) return false;
      if (isDm) {
        return !n.dmResponse?.text || !n.dmResponse.isResolved;
      }
      return true;
    }
    if (filter === 'archived') {
      if (isDismissed) return true;
      if (isDm && n.dmResponse?.isResolved) return true;
      return false;
    }
    return true;
  });

  const handleSendReply = (noteId: string) => {
    const text = replyTextMap[noteId];
    if (!text || !text.trim()) return;

    const dmName = currentUser?.characterName || 'Dungeon Master';
    CampaignManager.replyToDmClarification(noteId, text, dmName, true);
    setReplyTextMap((prev) => ({ ...prev, [noteId]: '' }));
    setReplyingNoteId(null);
    refreshNotes();
  };

  const handleToggleResolved = (noteId: string, currentResolved: boolean) => {
    CampaignManager.toggleDmClarificationResolved(noteId, !currentResolved);
    if (!currentResolved) {
      // If marking resolved, also dismiss notification for DM
      CampaignManager.dismissNotification(noteId, currentUserId);
    }
    refreshNotes();
  };

  const handleDismissNotification = (noteId: string) => {
    CampaignManager.dismissNotification(noteId, currentUserId);
    refreshNotes();
  };

  const handleRestoreNotification = (noteId: string) => {
    CampaignManager.restoreNotification(noteId, currentUserId);
    refreshNotes();
  };

  const handleRemoveClarification = (noteId: string) => {
    if (isDm) {
      CampaignManager.removeClarificationForDm(noteId);
    } else if (currentUserId) {
      CampaignManager.removeClarificationForPlayer(noteId, currentUserId);
    }
    refreshNotes();
  };

  const handleDismissAll = () => {
    const idsToDismiss = pendingNotes.map((n) => n._id);
    if (idsToDismiss.length > 0) {
      CampaignManager.dismissAllNotifications(idsToDismiss, currentUserId);
      refreshNotes();
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface-1 rounded-2xl max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col border border-surface-2 shadow-2xl overflow-hidden shrink-0"
        >
          {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-2 flex items-center justify-between bg-surface-1">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDm
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}
            >
              {isDm ? <ShieldAlert size={20} /> : <HelpCircle size={20} />}
            </div>
            <div>
              <h3 className="font-heading font-semibold text-base sm:text-lg text-content-1 flex items-center gap-2">
                {isDm ? 'Richieste di Chiarimento al Master' : 'Notifiche & Risposte dal Master'}
                {pendingNotes.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingNotes.length} nuove
                  </span>
                )}
              </h3>
              <p className="text-xs text-content-3">
                {isDm
                  ? 'Domande e annotazioni inviate dai tuoi giocatori per chiarimenti di lore o regole.'
                  : 'Stato delle tue richieste e chiarimenti ricevuti dal Dungeon Master.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Tabs & Quick Action Bar */}
        <div className="px-4 py-2.5 bg-surface-2/40 border-b border-surface-3/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === 'pending'
                  ? 'bg-primary text-surface-0 font-bold shadow-xs'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
              }`}
            >
              Nuove / In Sospeso ({pendingNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === 'archived'
                  ? 'bg-primary text-surface-0 font-bold shadow-xs'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
              }`}
            >
              Lette / Archiviate ({archivedNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-primary text-surface-0 font-bold shadow-xs'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
              }`}
            >
              Tutte ({userRoleNotes.length})
            </button>
          </div>

          {pendingNotes.length > 0 && (
            <button
              type="button"
              onClick={handleDismissAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-2 text-content-2 hover:text-content-1 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer"
              title="Segna tutte le notifiche attuali come lette"
            >
              <CheckCheck size={13} className="text-primary" />
              <span>Segna tutte come lette</span>
            </button>
          )}
        </div>

        {/* Question & Answer List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {visibleNotes.length === 0 ? (
            <div className="py-12 text-center text-content-3 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400 opacity-60" />
              <p className="text-sm font-medium text-content-2">
                {filter === 'pending'
                  ? 'Nessuna notifica in sospeso!'
                  : 'Nessun elemento presente in questa sezione.'}
              </p>
              <p className="text-xs text-content-3">
                {isDm
                  ? 'I giocatori possono richiedere il tuo intervento spuntando "Chiedi chiarimento al DM" nei loro appunti.'
                  : 'Puoi chiedere un chiarimento al Master direttamente quando crei o modifichi un appunto nel diario.'}
              </p>
            </div>
          ) : (
            visibleNotes.map((note) => {
              const hasResponse = !!note.dmResponse?.text;
              const isResolved = !!note.dmResponse?.isResolved;
              const isDismissed = dismissedIds.includes(note._id);
              const isReplying = replyingNoteId === note._id;

              return (
                <div
                  key={note._id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isDismissed
                      ? 'bg-surface-2/20 border-surface-3/60 opacity-80'
                      : hasResponse
                      ? 'bg-surface-2/40 border-surface-3'
                      : 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  }`}
                >
                  {/* Note Header */}
                  <div className="p-4 border-b border-surface-3/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-2/30">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium ${
                            isDismissed
                              ? 'bg-surface-3 text-content-3 border border-surface-3'
                              : hasResponse
                              ? isResolved
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {isDismissed
                            ? 'Notifica Letta / Archiviata'
                            : hasResponse
                            ? isResolved
                              ? 'Risolto dal Master'
                              : 'Risposta Pronta'
                            : 'In Attesa del Master'}
                        </span>

                        {note.session && (
                          <span className="text-[10px] text-content-3 font-mono">
                            Sessione #{note.session.number}
                          </span>
                        )}
                        {note.loreDate && (
                          <span className="text-[10px] text-primary font-mono flex items-center gap-1">
                            <Clock size={10} /> {note.loreDate}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-content-1 mt-1 flex items-center gap-2">
                        {note.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Author badge */}
                      <div className="flex items-center gap-1.5 text-xs text-content-3">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0"
                          style={{ backgroundColor: note.author?.color || '#6366f1' }}
                        >
                          {note.author?.avatarUrl ? (
                            <img src={note.author.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            note.author?.characterName?.charAt(0).toUpperCase() || 'P'
                          )}
                        </div>
                        <span className="text-content-2 font-medium">{note.author?.characterName}</span>
                      </div>

                      {/* Action buttons on header */}
                      {isDismissed ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreNotification(note._id)}
                          className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Ripristina notifica tra quelle attive"
                        >
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDismissNotification(note._id)}
                          className="p-1.5 rounded-lg text-content-3 hover:text-emerald-400 hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Segna come letta / Cancella notifica"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}

                      {onSelectNote && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectNote(note._id);
                            onClose();
                          }}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Apri nel Diario"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Note Excerpt / Content */}
                  <div className="p-4 text-xs text-content-2 space-y-2">
                    <p className="text-[11px] font-semibold text-content-3 uppercase tracking-wider">
                      Domanda / Appunto del Personaggio:
                    </p>
                    <div className="bg-surface-1 p-3 rounded-xl border border-surface-3/60 text-content-2 leading-relaxed">
                      {note.content ? (
                        <MarkdownRenderer content={note.content} />
                      ) : (
                        <p className="italic text-content-3">Nessun testo allegato.</p>
                      )}
                    </div>
                  </div>

                  {/* DM Response Box (if exists) */}
                  {hasResponse && note.dmResponse && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-primary font-semibold">
                            <Sparkles size={13} />
                            <span>Responso di {note.dmResponse.answeredBy}</span>
                          </div>
                          <span className="text-[10px] text-content-3 font-mono">
                            {new Date(note.dmResponse.answeredAt).toLocaleDateString()} alle{' '}
                            {new Date(note.dmResponse.answeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-content-1 leading-relaxed pl-1 border-l-2 border-primary/40">
                          <MarkdownRenderer content={note.dmResponse.text} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action row for Player or DM */}
                  <div className="p-3 border-t border-surface-3/50 bg-surface-2/20 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-2">
                      {!isDismissed ? (
                        <button
                          type="button"
                          onClick={() => handleDismissNotification(note._id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors cursor-pointer"
                        >
                          <BellOff size={12} className="text-content-3" />
                          <span>Nascondi</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreNotification(note._id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>Ripristina</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveClarification(note._id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-error border border-surface-3 transition-colors cursor-pointer"
                        title={isDm ? "Rimuovi questo chiarimento dal Master" : "Rimuovi questo chiarimento dal tuo profilo"}
                      >
                        <Trash2 size={12} />
                        <span>Rimuovi</span>
                      </button>
                    </div>

                    {isDm && (
                      <div className="flex items-center gap-2">
                        {!isReplying && hasResponse ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleResolved(note._id, isResolved)}
                              className={`text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                isResolved
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-surface-3 text-content-2 border-surface-3 hover:text-content-1'
                              }`}
                            >
                              <CheckCircle2 size={13} />
                              <span>{isResolved ? 'Risolto (Archiviato)' : 'Segna Risolto'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setReplyingNoteId(note._id);
                                setReplyTextMap((prev) => ({
                                  ...prev,
                                  [note._id]: note.dmResponse?.text || '',
                                }));
                              }}
                              className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare size={13} /> Modifica Risposta
                            </button>
                          </>
                        ) : !isReplying ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingNoteId(note._id);
                              setReplyTextMap((prev) => ({
                                ...prev,
                                [note._id]: note.dmResponse?.text || '',
                              }));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageSquare size={13} /> Rispondi al PG
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* DM Reply Form when replying */}
                  {isDm && isReplying && (
                    <div className="p-4 pt-2 border-t border-surface-3/50 bg-surface-2/30 space-y-3">
                      <label className="block text-[11px] font-semibold text-primary uppercase tracking-wider">
                        {hasResponse ? 'Aggiorna Risposta al Giocatore:' : 'Scrivi Risposta del Master:'}
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Spiega il retroscena, fornisci l'indizio o chiarisci le regole per il PG..."
                        value={replyTextMap[note._id] ?? (note.dmResponse?.text || '')}
                        onChange={(e) =>
                          setReplyTextMap((prev) => ({ ...prev, [note._id]: e.target.value }))
                        }
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl p-3 text-xs text-content-1 outline-none resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingNoteId(null)}
                          className="px-3 py-1.5 text-xs text-content-3 hover:text-content-1 cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply(note._id)}
                          disabled={!(replyTextMap[note._id] ?? (note.dmResponse?.text || '')).trim()}
                          className="px-4 py-1.5 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <Send size={13} /> Invia Risposta al PG
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-surface-2 bg-surface-1 flex items-center justify-between text-xs text-content-3">
          <span>{visibleNotes.length} elementi visualizzati</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-surface-2 border border-surface-3 text-content-1 font-medium hover:bg-surface-3 transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </motion.div>
    </div>
  </Portal>
  );
}
