import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  Send,
  X,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  CheckCheck,
  RotateCcw,
  BookMarked,
  BookOpen,
  Scroll,
  HelpCircle,
  Eye,
  Trash2,
  Crown,
  Layers,
} from 'lucide-react';
import { Note, Player, CampaignNotification } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { Portal } from './Portal';
import { ConfirmModal } from './ConfirmModal';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Player | null;
  onSelectNote?: (noteId: string) => void;
}

export interface UnifiedNotificationItem {
  id: string;
  kind: 'campaign_notif' | 'clarification_note';
  category: 'codex' | 'session' | 'note' | 'clarification';
  title: string;
  message: string;
  authorName?: string;
  createdAt: string;
  targetUrl?: string;
  isRead: boolean;
  rawNote?: Note;
  rawCampaignNotif?: CampaignNotification;
}

export function NotificationsModal({
  isOpen,
  onClose,
  currentUser,
  onSelectNote,
}: NotificationsModalProps) {
  const navigate = useNavigate();
  const [campaignNotifs, setCampaignNotifs] = useState<CampaignNotification[]>([]);
  const [askDmNotes, setAskDmNotes] = useState<Note[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'codex' | 'session' | 'note' | 'clarification'>('all');
  const [viewState, setViewState] = useState<'unread' | 'archived' | 'all'>('unread');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingNoteId, setReplyingNoteId] = useState<string | null>(null);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);

  const isDm = !!currentUser?.isDm;
  const currentUserId = currentUser?._id || (currentUser as any)?.id || CampaignManager.getCurrentAccount()?.id;

  const refreshData = () => {
    if (!currentUser) return;
    const allNotifs = CampaignManager.getCampaignNotifications();
    const allNotes = CampaignManager.getNotes();
    const askNotes = allNotes.filter((n) => n.askDm || n.dmResponse);
    const dismissed = CampaignManager.getDismissedNotificationIds(currentUserId);

    setCampaignNotifs(allNotifs);
    setAskDmNotes(askNotes);
    setDismissedIds(dismissed);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => refreshData();
    window.addEventListener('chronicle_notifications_updated', handleUpdate);
    window.addEventListener('chronicle_notes_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_notifications_updated', handleUpdate);
      window.removeEventListener('chronicle_notes_updated', handleUpdate);
    };
  }, [isOpen]);

  // Build unified notification items list
  const unifiedItems = useMemo<UnifiedNotificationItem[]>(() => {
    const list: UnifiedNotificationItem[] = [];

    // 1. Convert CampaignNotification items
    campaignNotifs.forEach((cn) => {
      // If targeted to specific player, filter out if not for this user
      if (cn.targetPlayerId && cn.targetPlayerId !== currentUserId && !isDm) {
        return;
      }

      const isRead = dismissedIds.includes(cn.id);
      list.push({
        id: cn.id,
        kind: 'campaign_notif',
        category: cn.category || 'codex',
        title: cn.title,
        message: cn.message,
        authorName: cn.authorName,
        createdAt: cn.createdAt,
        targetUrl: cn.targetUrl,
        isRead,
        rawCampaignNotif: cn,
      });
    });

    // 2. Convert Ask DM Note items
    askDmNotes.forEach((n) => {
      if (isDm) {
        if (n.hiddenForDm) return;
      } else {
        // Player sees only their own questions
        const authorId = n.author?._id || (n.author as any)?.id;
        if (authorId !== currentUserId && n.author?.email !== currentUser?.email) {
          return;
        }
        if (currentUserId && n.hiddenForPlayerIds?.includes(currentUserId)) {
          return;
        }
      }

      const isRead = dismissedIds.includes(n._id);
      const hasResponse = !!n.dmResponse?.text;
      const isResolved = !!n.dmResponse?.isResolved;

      let title = isDm
        ? `Richiesta Chiarimento da ${n.author?.characterName || 'Giocatore'}`
        : hasResponse
        ? 'Risposta dal Dungeon Master'
        : 'Richiesta Chiarimento Inviata';

      if (isResolved) {
        title = `Chiarimento Risolto: "${n.title}"`;
      }

      const message = hasResponse
        ? n.dmResponse!.text.slice(0, 120)
        : (typeof n.content === 'string' ? n.content : '').slice(0, 120) || n.title;

      list.push({
        id: n._id,
        kind: 'clarification_note',
        category: 'clarification',
        title,
        message,
        authorName: hasResponse ? n.dmResponse?.answeredBy || 'Dungeon Master' : n.author?.characterName,
        createdAt: n.dmResponse?.answeredAt || n._createdAt,
        targetUrl: `/notes?select=${n._id}`,
        isRead: isRead || (isDm && isResolved) || (!isDm && !hasResponse),
        rawNote: n,
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [campaignNotifs, askDmNotes, dismissedIds, currentUser, currentUserId, isDm]);

  const unreadItems = useMemo(() => unifiedItems.filter((item) => !item.isRead), [unifiedItems]);
  const archivedItems = useMemo(() => unifiedItems.filter((item) => item.isRead), [unifiedItems]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // View State filter
      if (viewState === 'unread' && item.isRead) return false;
      if (viewState === 'archived' && !item.isRead) return false;

      // Category filter
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;

      return true;
    });
  }, [unifiedItems, viewState, filterCategory]);

  const handleDismiss = (id: string) => {
    CampaignManager.dismissNotification(id, currentUserId);
    refreshData();
  };

  const handleRestore = (id: string) => {
    CampaignManager.restoreNotification(id, currentUserId);
    refreshData();
  };

  const handleDeleteItem = (item: UnifiedNotificationItem) => {
    if (item.kind === 'campaign_notif') {
      CampaignManager.deleteCampaignNotification(item.id);
    } else if (item.kind === 'clarification_note' && item.rawNote) {
      if (isDm) {
        CampaignManager.removeClarificationForDm(item.rawNote._id);
      } else if (currentUserId) {
        CampaignManager.removeClarificationForPlayer(item.rawNote._id, currentUserId);
      }
    }
    refreshData();
  };

  const handleDismissAll = () => {
    const idsToDismiss = unreadItems.map((item) => item.id);
    if (idsToDismiss.length > 0) {
      CampaignManager.dismissAllNotifications(idsToDismiss, currentUserId);
      refreshData();
    }
  };

  const handleNavigate = (item: UnifiedNotificationItem) => {
    if (!item.isRead) {
      CampaignManager.dismissNotification(item.id, currentUserId);
    }
    onClose();
    if (item.kind === 'clarification_note' && item.rawNote && onSelectNote) {
      onSelectNote(item.rawNote._id);
    } else if (item.targetUrl) {
      navigate(item.targetUrl);
    } else {
      navigate('/notes');
    }
  };

  const handleSendReply = (noteId: string) => {
    const text = replyTextMap[noteId]?.trim();
    if (!text) return;

    const dmName = currentUser?.characterName || 'Dungeon Master';
    CampaignManager.replyToDmClarification(noteId, text, dmName, true);
    setReplyTextMap((prev) => ({ ...prev, [noteId]: '' }));
    setReplyingNoteId(null);
    refreshData();
  };

  if (!isOpen) return null;

  const CategoryIcon = ({ category }: { category: UnifiedNotificationItem['category'] }) => {
    switch (category) {
      case 'codex':
        return <BookMarked size={16} className="text-purple-400" />;
      case 'session':
        return <BookOpen size={16} className="text-amber-400" />;
      case 'note':
        return <Scroll size={16} className="text-emerald-400" />;
      case 'clarification':
        return <HelpCircle size={16} className="text-cyan-400" />;
      default:
        return <Bell size={16} className="text-primary" />;
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface-1 rounded-2xl max-w-2xl w-full max-h-[calc(100dvh-2rem)] my-auto flex flex-col border border-surface-2 shadow-2xl overflow-hidden shrink-0"
        >
          {/* Top Modal Header */}
          <div className="p-4 sm:p-5 border-b border-surface-2 flex items-center justify-between bg-surface-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Bell size={20} className={unreadItems.length > 0 ? 'animate-bounce' : ''} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base sm:text-lg text-content-1 flex items-center gap-2">
                  <span>Centro Notifiche Campagna</span>
                  {unreadItems.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary text-surface-0">
                      {unreadItems.length} non lette
                    </span>
                  )}
                </h3>
                <p className="text-xs text-content-3">
                  Aggiornamenti in tempo reale su Codex, Sessioni, Note di Gruppo e Chiarimenti DM
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

          {/* Controls Bar: Read State Tabs & Category Filter */}
          <div className="px-4 py-3 bg-surface-2/40 border-b border-surface-2 space-y-2.5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar flex-nowrap shrink-0 pb-1 sm:pb-0">
              {/* View State Tabs */}
              <div className="flex items-center bg-surface-0 border border-surface-3 rounded-xl p-0.5 font-mono text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setViewState('unread')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    viewState === 'unread'
                      ? 'bg-primary text-surface-0 shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <span>Da Leggere</span>
                  <span className="text-[10px] opacity-90">({unreadItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewState('archived')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    viewState === 'archived'
                      ? 'bg-primary text-surface-0 shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <span>Archiviate</span>
                  <span className="text-[10px] opacity-90">({archivedItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewState('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    viewState === 'all'
                      ? 'bg-primary text-surface-0 shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <span>Tutte</span>
                  <span className="text-[10px] opacity-90">({unifiedItems.length})</span>
                </button>
              </div>

              {/* Mark All Read & Clear History Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                {unreadItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDismissAll}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-surface-0 hover:bg-surface-2 border border-surface-3 text-content-2 hover:text-content-1 transition-colors cursor-pointer shrink-0"
                  >
                    <CheckCheck size={13} className="text-primary" />
                    <span>Segna lette</span>
                  </button>
                )}

                {unifiedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearHistoryModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-error/10 hover:bg-error/20 text-error border border-error/30 transition-colors cursor-pointer shrink-0"
                    title="Cancella lo storico notifiche della campagna"
                  >
                    <Trash2 size={13} />
                    <span>Svuota Storico</span>
                  </button>
                )}
              </div>
            </div>

            {/* Category Pill Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filterCategory === 'all'
                    ? 'bg-surface-3 text-content-1 border border-surface-4 font-semibold'
                    : 'bg-surface-1/80 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-surface-2'
                }`}
              >
                Tutti i Tipi
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('codex')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'codex'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                    : 'bg-surface-1/80 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-surface-2'
                }`}
              >
                <BookMarked size={13} className="text-purple-400" />
                <span>Codex &amp; Segreti</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('session')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'session'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'bg-surface-1/80 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-surface-2'
                }`}
              >
                <BookOpen size={13} className="text-amber-400" />
                <span>Sessioni</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('note')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'note'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'bg-surface-1/80 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-surface-2'
                }`}
              >
                <Scroll size={13} className="text-emerald-400" />
                <span>Note &amp; Menzioni</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('clarification')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'clarification'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'bg-surface-1/80 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-surface-2'
                }`}
              >
                <HelpCircle size={13} className="text-cyan-400" />
                <span>Chiarimenti DM</span>
              </button>
            </div>
          </div>

          {/* List Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-content-3 space-y-2 bg-surface-1/40 border border-surface-2 rounded-2xl">
                <CheckCircle2 size={36} className="mx-auto text-emerald-400 opacity-60" />
                <p className="text-sm font-medium text-content-2">
                  {viewState === 'unread'
                    ? 'Nessuna notifica non letta!'
                    : 'Nessun elemento presente in questo elenco.'}
                </p>
                <p className="text-xs text-content-3 max-w-sm mx-auto">
                  Tutte le novità della campagna appariranno qui quando il party aggiunge note, sessioni, entità o quando il Master risponde a un dubbio.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const formattedDate = new Date(item.createdAt).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-xs ${
                      !item.isRead
                        ? 'bg-surface-1 border-primary/40'
                        : 'bg-surface-1/40 border-surface-2 opacity-80'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-surface-2 border border-surface-3 shrink-0">
                          <CategoryIcon category={item.category} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-content-1 truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0 animate-ping" />
                            )}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-content-3 font-mono">
                            {item.authorName && (
                              <span>Da: <strong className="text-content-2">{item.authorName}</strong></span>
                            )}
                            <span>•</span>
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleNavigate(item)}
                          className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-2 hover:text-content-1 text-xs font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          title="Apri elemento correlato"
                        >
                          <span>Vedi</span>
                          <ExternalLink size={12} />
                        </button>

                        {!item.isRead ? (
                          <button
                            type="button"
                            onClick={() => handleDismiss(item.id)}
                            className="p-1.5 rounded-lg border border-surface-3 text-content-3 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            title="Segna come letta"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(item.id)}
                            className="p-1.5 rounded-lg border border-surface-3 text-content-3 hover:text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                            title="Ripristina notifica"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-lg border border-surface-3 text-content-3 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                          title="Elimina definitivamente dal tuo elenco"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Notification Message / Content excerpt */}
                    <div className="p-2.5 rounded-xl bg-surface-0 border border-surface-2/80 text-xs text-content-2 leading-relaxed">
                      {item.kind === 'clarification_note' && item.rawNote?.dmResponse?.text ? (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-mono font-bold text-primary block">
                            Risposta del Master:
                          </span>
                          <MarkdownRenderer content={item.rawNote.dmResponse.text} />
                        </div>
                      ) : (
                        <p className="line-clamp-2">{item.message}</p>
                      )}
                    </div>

                    {/* DM Inline Quick Reply Form for Clarifications */}
                    {isDm && item.kind === 'clarification_note' && item.rawNote && (
                      <div className="pt-2 border-t border-surface-2">
                        {replyingNoteId === item.rawNote._id ? (
                          <div className="space-y-2 mt-1">
                            <textarea
                              rows={2}
                              value={replyTextMap[item.rawNote._id] ?? (item.rawNote.dmResponse?.text || '')}
                              onChange={(e) =>
                                setReplyTextMap((prev) => ({
                                  ...prev,
                                  [item.rawNote!._id]: e.target.value,
                                }))
                              }
                              placeholder="Scrivi la risposta del Master..."
                              className="w-full p-2 rounded-xl bg-surface-0 border border-surface-3 text-xs text-content-1 placeholder:text-content-3 outline-none focus:border-primary font-sans resize-y"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingNoteId(null)}
                                className="px-2.5 py-1 rounded-lg border border-surface-3 text-xs font-mono text-content-3 hover:text-content-1 cursor-pointer"
                              >
                                Annulla
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendReply(item.rawNote!._id)}
                                disabled={!(replyTextMap[item.rawNote._id] ?? (item.rawNote.dmResponse?.text || '')).trim()}
                                className="px-3 py-1 rounded-lg bg-primary hover:bg-primary-hover text-surface-0 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              >
                                <Send size={12} />
                                <span>Invia Risposta</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingNoteId(item.rawNote!._id);
                              setReplyTextMap((prev) => ({
                                ...prev,
                                [item.rawNote!._id]: item.rawNote?.dmResponse?.text || '',
                              }));
                            }}
                            className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>{item.rawNote.dmResponse?.text ? 'Modifica Risposta DM' : 'Rispondi al Giocatore'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 border-t border-surface-2 bg-surface-1 flex items-center justify-between text-xs text-content-3">
            <span>{filteredItems.length} notifiche mostrate</span>
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

      <ConfirmModal
        isOpen={isClearHistoryModalOpen}
        title="Svuota Storico Notifiche"
        message="Sei sicuro di voler svuotare e cancellare definitivamente lo storico di tutte le notifiche della campagna? Questa azione non può essere annullata."
        confirmLabel="Svuota Storico"
        cancelLabel="Annulla"
        isDestructive
        onConfirm={() => {
          if (currentUserId) {
            CampaignManager.clearAllCampaignNotifications(currentUserId);
            askDmNotes.forEach((n) => {
              if (isDm) {
                CampaignManager.removeClarificationForDm(n._id);
              } else {
                CampaignManager.removeClarificationForPlayer(n._id, currentUserId);
              }
            });
            refreshData();
          }
          setIsClearHistoryModalOpen(false);
        }}
        onCancel={() => setIsClearHistoryModalOpen(false)}
      />
    </Portal>
  );
}
