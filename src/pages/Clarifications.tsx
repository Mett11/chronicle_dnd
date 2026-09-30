import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Note, CampaignNotification } from '../types';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Bell,
  HelpCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Search,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Scroll,
  Filter,
  Crown,
  BookMarked,
  BookOpen,
  Check,
  Eye,
} from 'lucide-react';

export interface StreamItem {
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

export function Clarifications() {
  const { player } = useAuth();
  const navigate = useNavigate();

  const [campaignNotifs, setCampaignNotifs] = useState<CampaignNotification[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [filterCategory, setFilterCategory] = useState<'all' | 'codex' | 'session' | 'note' | 'clarification'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingNoteId, setReplyingNoteId] = useState<string | null>(null);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);

  const isDm = !!player?.isDm;
  const currentUserId = player?._id || (player as any)?.id || CampaignManager.getCurrentAccount()?.id;

  const refreshData = () => {
    const allNotifs = CampaignManager.getCampaignNotifications();
    const allNotes = CampaignManager.getNotes();
    const askDmNotes = allNotes.filter((n) => n.askDm || n.dmResponse);

    setCampaignNotifs(allNotifs);
    setNotes(askDmNotes);

    const dismissed = CampaignManager.getDismissedNotificationIds(currentUserId);
    setDismissedIds(dismissed);
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('chronicle_notes_updated', handleUpdate);
    window.addEventListener('chronicle_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_notes_updated', handleUpdate);
      window.removeEventListener('chronicle_notifications_updated', handleUpdate);
    };
  }, [player]);

  // Combine campaign notifications and askDm notes into a unified stream
  const allStreamItems = useMemo<StreamItem[]>(() => {
    const list: StreamItem[] = [];

    // 1. Campaign Notifications
    campaignNotifs.forEach((cn) => {
      if (cn.targetPlayerId && cn.targetPlayerId !== currentUserId && !isDm) return;

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

    // 2. Ask DM Notes
    notes.forEach((n) => {
      if (isDm) {
        if (n.hiddenForDm) return;
      } else {
        const authorId = n.author?._id || (n.author as any)?.id;
        if (authorId !== currentUserId && n.author?.email !== player?.email) return;
        if (currentUserId && n.hiddenForPlayerIds?.includes(currentUserId)) return;
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
        ? n.dmResponse!.text
        : typeof n.content === 'string'
        ? n.content
        : n.title;

      list.push({
        id: n._id,
        kind: 'clarification_note',
        category: 'clarification',
        title,
        message,
        authorName: hasResponse ? n.dmResponse?.answeredBy || 'Dungeon Master' : n.author?.characterName,
        createdAt: n.dmResponse?.answeredAt || n._createdAt,
        targetUrl: `/notes?select=${n._id}`,
        isRead: isRead || (isDm && isResolved),
        rawNote: n,
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [campaignNotifs, notes, dismissedIds, player, currentUserId, isDm]);

  const pendingCount = useMemo(() => allStreamItems.filter((i) => !i.isRead).length, [allStreamItems]);
  const resolvedCount = useMemo(() => allStreamItems.filter((i) => i.isRead).length, [allStreamItems]);

  const visibleItems = useMemo(() => {
    return allStreamItems.filter((item) => {
      // Pending vs Resolved vs All
      if (filterState === 'pending' && item.isRead) return false;
      if (filterState === 'resolved' && !item.isRead) return false;

      // Category filter
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(q);
        const msgMatch = item.message.toLowerCase().includes(q);
        const authorMatch = item.authorName?.toLowerCase().includes(q);
        if (!titleMatch && !msgMatch && !authorMatch) return false;
      }

      return true;
    });
  }, [allStreamItems, filterState, filterCategory, searchQuery]);

  const handleSendReply = (noteId: string) => {
    const text = replyTextMap[noteId]?.trim();
    if (!text) return;

    CampaignManager.replyToDmClarification(
      noteId,
      text,
      player?.characterName || 'Dungeon Master',
      true
    );
    setReplyTextMap((prev) => ({ ...prev, [noteId]: '' }));
    setReplyingNoteId(null);
    refreshData();
  };

  const handleToggleResolved = (noteId: string) => {
    CampaignManager.toggleDmClarificationResolved(noteId);
    refreshData();
  };

  const handleDeleteDmReply = (noteId: string) => {
    CampaignManager.deleteDmReply(noteId);
    refreshData();
  };

  const handleRemoveClarification = (noteId: string) => {
    if (isDm) {
      CampaignManager.removeClarificationForDm(noteId);
    } else if (currentUserId) {
      CampaignManager.removeClarificationForPlayer(noteId, currentUserId);
    }
    refreshData();
  };

  const handleDeleteClarificationRequest = (noteId: string) => {
    CampaignManager.deleteClarificationRequest(noteId);
    refreshData();
  };

  const handleDismiss = (id: string) => {
    CampaignManager.dismissNotification(id, currentUserId);
    refreshData();
  };

  const handleRestore = (id: string) => {
    CampaignManager.restoreNotification(id, currentUserId);
    refreshData();
  };

  const handleDeleteItem = (item: StreamItem) => {
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
    const unreadIds = allStreamItems.filter((i) => !i.isRead).map((i) => i.id);
    if (unreadIds.length > 0) {
      CampaignManager.dismissAllNotifications(unreadIds, currentUserId);
      refreshData();
    }
  };

  const CategoryIcon = ({ category }: { category: StreamItem['category'] }) => {
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
    <div className="flex flex-col h-full bg-surface-0 text-content-1 overflow-hidden">
      {/* View Header */}
      <div className="border-b border-surface-2 bg-surface-1/90 backdrop-blur-md px-4 sm:px-6 py-4 shrink-0 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                pendingCount > 0
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-2 border-surface-3 text-content-3'
              }`}
            >
              <Bell size={20} className={pendingCount > 0 ? 'animate-bounce' : ''} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-cinzel font-bold text-content-1 truncate">
                  Centro Notifiche &amp; Chiarimenti
                </h1>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary text-surface-0 shrink-0">
                    {pendingCount} non lette
                  </span>
                )}
              </div>
              <p className="text-xs text-content-3 truncate">
                Tutte le notifiche del party: voci del Codex, nuove sessioni, note di gruppo e risposte del Master
              </p>
            </div>
          </div>

          {/* Search, Status & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca notifica o nota..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-surface-0 border border-surface-3 text-xs text-content-1 placeholder:text-content-3 outline-none focus:border-primary w-44 sm:w-56 font-sans transition-all"
              />
            </div>

            <div className="flex items-center bg-surface-0 border border-surface-3 rounded-xl p-0.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setFilterState('pending')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterState === 'pending'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1'
                }`}
              >
                <span>Da Leggere</span>
                <span className="text-[10px] opacity-90">({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterState('resolved')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterState === 'resolved'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1'
                }`}
              >
                <span>Archiviate</span>
                <span className="text-[10px] opacity-90">({resolvedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterState('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterState === 'all'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1'
                }`}
              >
                <span>Tutte</span>
                <span className="text-[10px] opacity-90">({allStreamItems.length})</span>
              </button>
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleDismissAll}
                className="p-2 rounded-xl bg-surface-0 hover:bg-surface-2 border border-surface-3 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                title="Segna tutte le notifiche come lette"
              >
                <CheckCheck size={16} className="text-primary" />
              </button>
            )}

            {allStreamItems.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/30 text-xs font-semibold transition-colors cursor-pointer"
                title="Cancella lo storico notifiche della campagna"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Svuota Storico</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-header Category Tabs */}
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-3 pb-1 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-surface-2 text-content-1 border border-surface-3 font-semibold'
                : 'bg-surface-1/60 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-transparent'
            }`}
          >
            Tutte le Notifiche
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('codex')}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'codex'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                : 'bg-surface-1/60 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-transparent'
            }`}
          >
            <BookMarked size={14} className="text-purple-400" />
            <span>Codex &amp; Segreti</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('session')}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'session'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'bg-surface-1/60 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-transparent'
            }`}
          >
            <BookOpen size={14} className="text-amber-400" />
            <span>Sessioni</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('note')}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'note'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'bg-surface-1/60 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-transparent'
            }`}
          >
            <Scroll size={14} className="text-emerald-400" />
            <span>Note &amp; Menzioni</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('clarification')}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'clarification'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'bg-surface-1/60 text-content-3 hover:bg-surface-2 hover:text-content-1 border border-transparent'
            }`}
          >
            <HelpCircle size={14} className="text-cyan-400" />
            <span>Chiarimenti DM</span>
          </button>
        </div>
      </div>

      {/* Main Stream Stream */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {visibleItems.length === 0 ? (
            <div className="p-12 text-center bg-surface-1/40 border border-surface-2 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-surface-3 mx-auto flex items-center justify-center text-content-3">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-cinzel font-bold text-content-1">
                Nessuna notifica in questo elenco
              </h3>
              <p className="text-xs text-content-3 max-w-md mx-auto">
                {filterState === 'pending'
                  ? 'Hai letto tutte le notifiche! Quando verranno pubblicate nuove sessioni, entità o risposte, appariranno qui.'
                  : 'Nessun elemento trovato con i filtri e la ricerca selezionati.'}
              </p>
            </div>
          ) : (
            visibleItems.map((item) => {
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
                  className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 shadow-xs ${
                    !item.isRead
                      ? 'bg-surface-1 border-primary/40'
                      : 'bg-surface-1/50 border-surface-2 opacity-80'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-surface-2 border border-surface-3 shrink-0">
                        <CategoryIcon category={item.category} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="font-bold text-sm text-content-1 truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0 animate-ping" />
                            )}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-content-3 font-mono">
                          {item.authorName && (
                            <span>Autore: <strong className="text-content-2">{item.authorName}</strong></span>
                          )}
                          <span>•</span>
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.targetUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.isRead) handleDismiss(item.id);
                            navigate(item.targetUrl!);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-2 hover:text-content-1 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Apri</span>
                          <ExternalLink size={13} />
                        </button>
                      )}

                      {!item.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleDismiss(item.id)}
                          className="p-1.5 rounded-xl border border-surface-3 text-content-3 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          title="Segna come letta / Archivia"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(item.id)}
                          className="p-1.5 rounded-xl border border-surface-3 text-content-3 hover:text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Ripristina tra le notifiche da leggere"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 rounded-xl border border-surface-3 text-content-3 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                        title="Elimina definitivamente dal tuo elenco"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 rounded-xl bg-surface-0 border border-surface-2/80 text-xs text-content-2 leading-relaxed">
                    {item.kind === 'clarification_note' && item.rawNote?.dmResponse?.text ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-mono font-bold text-primary block">
                          Risposta Ufficiale del Master:
                        </span>
                        <MarkdownRenderer content={item.rawNote.dmResponse.text} />
                      </div>
                    ) : (
                      <p>{item.message}</p>
                    )}
                  </div>

                  {/* Clarification Management Actions Bar */}
                  {item.kind === 'clarification_note' && item.rawNote && (
                    <div className="pt-2 border-t border-surface-2 flex items-center justify-between gap-2 flex-wrap text-xs">
                      {isDm ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.rawNote.dmResponse?.text && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleResolved(item.rawNote!._id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                                  item.rawNote.dmResponse.isResolved
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-surface-2 text-content-2 border-surface-3 hover:text-content-1'
                                }`}
                              >
                                <CheckCircle2 size={12} />
                                <span>{item.rawNote.dmResponse.isResolved ? 'Risolto' : 'Segna Risolto'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteDmReply(item.rawNote!._id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-mono text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Cancella la risposta del Master"
                              >
                                <Trash2 size={12} />
                                <span>Elimina Risposta</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveClarification(item.rawNote!._id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Rimuovi questo chiarimento dalla visuale del Master"
                          >
                            <span>Rimuovi dal Master</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveClarification(item.rawNote!._id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Rimuovi questo chiarimento dal tuo profilo"
                          >
                            <span>Rimuovi dal mio profilo</span>
                          </button>

                          {!item.rawNote.dmResponse?.text && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClarificationRequest(item.rawNote!._id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Annulla la richiesta di chiarimento"
                            >
                              <Trash2 size={12} />
                              <span>Annulla Richiesta</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* DM Reply Form trigger button if DM */}
                      {isDm && (
                        <div>
                          {replyingNoteId === item.rawNote._id ? null : (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingNoteId(item.rawNote!._id);
                                setReplyTextMap((prev) => ({
                                  ...prev,
                                  [item.rawNote!._id]: item.rawNote?.dmResponse?.text || '',
                                }));
                              }}
                              className="px-3 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-3 text-xs font-mono text-content-1 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare size={13} className="text-primary" />
                              <span>{item.rawNote.dmResponse?.text ? 'Modifica Risposta' : 'Rispondi al PG'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DM Reply Form for Clarifications */}
                  {isDm && item.kind === 'clarification_note' && item.rawNote && replyingNoteId === item.rawNote._id && (
                    <div className="pt-2 border-t border-surface-2 space-y-2">
                      <textarea
                        value={replyTextMap[item.rawNote._id] ?? (item.rawNote.dmResponse?.text || '')}
                        onChange={(e) =>
                          setReplyTextMap((prev) => ({ ...prev, [item.rawNote!._id]: e.target.value }))
                        }
                        placeholder="Scrivi il chiarimento o la risposta del Master..."
                        className="w-full p-2.5 rounded-xl bg-surface-0 border border-surface-3 text-xs text-content-1 placeholder:text-content-3 outline-none focus:border-primary font-sans resize-y min-h-[80px]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingNoteId(null)}
                          className="px-3 py-1.5 rounded-lg border border-surface-3 text-xs font-mono text-content-3 hover:text-content-1 cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply(item.rawNote!._id)}
                          disabled={!(replyTextMap[item.rawNote._id] ?? (item.rawNote.dmResponse?.text || '')).trim()}
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-surface-0 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Send size={13} />
                          <span>Invia Chiarimento</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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
            notes.forEach((n) => {
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
    </div>
  );
}
