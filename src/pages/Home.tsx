import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Scroll,
  BookOpen,
  Crown,
  Compass,
  Target,
  Shield,
  Clock,
  Trash2,
  Pin,
  ChevronRight,
  X,
  Plus,
  Edit3,
  Search,
  Users,
  Calendar,
  Sparkles,
  ExternalLink,
  Eye,
  CheckCircle2,
  Feather,
  Filter,
  User,
  Lock,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  ArrowLeft,
  BookMarked,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Note, Session, Entity, Category, CampaignCalendar, DmResponse } from '../types';
import { RichTextEditor } from '../components/RichTextEditor';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { MentionInput } from '../components/MentionInput';
import { EntityMentionText } from '../components/EntityMentionText';
import { ConfirmModal } from '../components/ConfirmModal';
import { ImageGalleryUploader } from '../components/ImageGalleryUploader';
import { Pagination } from '../components/Pagination';
import { OcrButton } from '../components/OcrButton';
import { NoteModal } from '../components/NoteModal';
import { QuestModal } from '../components/QuestModal';
import { motion, AnimatePresence } from 'framer-motion';
import { extractTextFromContent } from '../lib/sanitize';
import { useNotesData } from '../hooks/useViewData';

type MainTab = 'notes' | 'session' | 'quests';

export function Home() {
  const { player, allPlayers } = useAuth();
  const { refresh: refreshNotesData } = useNotesData();
  const [searchParams] = useSearchParams();
  const selectParam = searchParams.get('select');

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<MainTab>('notes');

  const handleTabChange = (tab: MainTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteFilter, setNoteFilter] = useState<'all' | 'my' | 'group' | 'pinned' | 'askDm' | 'dmOnly'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  // Pagination for Notes (5, 10, 20 items per page)
  const [notePage, setNotePage] = useState(1);
  const [notePageSize, setNotePageSize] = useState(10);

  // DM Reply state in Note Reader
  const [dmReplyInput, setDmReplyInput] = useState('');
  const [isEditingDmReply, setIsEditingDmReply] = useState(false);

  // General campaign data
  const [latestSession, setLatestSession] = useState<Session | null>(null);
  const [openQuests, setOpenQuests] = useState<Entity[]>([]);
  const [questScopeFilter, setQuestScopeFilter] = useState<'all' | 'party' | 'personal'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [calendar, setCalendar] = useState<CampaignCalendar | null>(null);

  // Modals & Lightbox
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteModalDefaults, setNoteModalDefaults] = useState<{
    sessionId?: string;
    loreDate?: string;
    visibility?: 'group' | 'personal';
    askDm?: boolean;
  }>({});
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Quest Modal State
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Entity | null>(null);
  const [questToDelete, setQuestToDelete] = useState<string | null>(null);

  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const refreshData = () => {
    const allNotes = CampaignManager.getNotes();
    const allSessions = CampaignManager.getSessions();
    const allEntities = CampaignManager.getEntities();
    const cats = CampaignManager.getCategories();
    const cal = CampaignManager.getCalendar();

    setSessions(allSessions);
    setCategories(cats);
    setCalendar(cal);
    if (allSessions.length > 0) {
      setLatestSession(allSessions[0]);
    }
    setOpenQuests(allEntities.filter((e) => {
      if (e.type !== 'quest' || e.status !== 'open') return false;
      return CampaignManager.isEntityAccessible(e, player);
    }));

    // Filter notes based on player visibility permissions
    const accessibleNotes = allNotes.filter((n) => {
      const authorId = n.author?._id || (n.author as any)?.id;
      const authorName = (n.author?.characterName || '').trim().toLowerCase();
      const myId = player?._id || (player as any)?.id;
      const myName = (player?.characterName || '').trim().toLowerCase();
      const isAuthor = Boolean(
        (authorId && myId && authorId === myId) ||
        (authorName && myName && authorName === myName) ||
        (n.author?.email && player?.email && n.author.email.toLowerCase() === player.email.toLowerCase())
      );

      if (isAuthor) return true;
      // Privacy Fix Applied: Personal notes strictly isolated unless shared with DM
      if (n.visibility === 'personal') {
        if (n.dmOnly && player?.isDm) return true; // Shared with DM
        return false; // Not author, and either not shared with DM or user is not DM
      }
      if (n.dmOnly && !player?.isDm) return false;
      return true;
    });

    setNotes(accessibleNotes);
  };

  useEffect(() => {
    refreshData();
    const handleDataUpdate = () => refreshData();
    window.addEventListener('chronicle_data_updated', handleDataUpdate);
    window.addEventListener('chronicle_notes_updated', handleDataUpdate);
    window.addEventListener('chronicle_calendar_updated', handleDataUpdate);
    window.addEventListener('chronicle_sessions_updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);
    return () => {
      window.removeEventListener('chronicle_data_updated', handleDataUpdate);
      window.removeEventListener('chronicle_notes_updated', handleDataUpdate);
      window.removeEventListener('chronicle_calendar_updated', handleDataUpdate);
      window.removeEventListener('chronicle_sessions_updated', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, [player]);

  // Handle URL param selection for notifications jump
  useEffect(() => {
    if (selectParam) {
      setSelectedNoteId(selectParam);
      setActiveTab('notes');
    }
  }, [selectParam]);

  // Filtered Notes list for the Notes Tab
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const authorId = n.author?._id || (n.author as any)?.id;
      const authorName = (n.author?.characterName || '').trim().toLowerCase();
      const myId = player?._id || (player as any)?.id;
      const myName = (player?.characterName || '').trim().toLowerCase();
      const isAuthor = Boolean(
        (authorId && myId && authorId === myId) ||
        (authorName && myName && authorName === myName) ||
        (n.author?.email && player?.email && n.author.email.toLowerCase() === player.email.toLowerCase())
      );

      // Scope Filter
      if (noteFilter === 'pinned' && !n.pinned) return false;
      if (noteFilter === 'my' && !isAuthor) return false;
      if (noteFilter === 'group' && (n.visibility !== 'group' || n.dmOnly)) return false;
      if (noteFilter === 'askDm') {
        if (!n.askDm && !n.dmResponse) return false;
        if (player?.isDm && n.hiddenForDm) return false;
        if (player && !player.isDm && player._id && n.hiddenForPlayerIds?.includes(player._id)) return false;
      }
      if (noteFilter === 'dmOnly' && !n.dmOnly) return false;

      // Category Filter
      if (selectedCategoryFilter !== 'all' && n.category?._id !== selectedCategoryFilter) return false;

      // Search Query
      if (noteSearchQuery.trim()) {
        const q = noteSearchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesContent = n.content ? n.content.toLowerCase().includes(q) : false;
        const matchesAuthor = n.author?.characterName ? n.author.characterName.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesContent && !matchesAuthor) return false;
      }

      return true;
    });
  }, [notes, noteFilter, selectedCategoryFilter, noteSearchQuery, player]);

  // Reset page when filters change
  useEffect(() => {
    setNotePage(1);
  }, [noteFilter, selectedCategoryFilter, noteSearchQuery]);

  // Paginated Notes
  const totalNotePages = Math.max(1, Math.ceil(filteredNotes.length / notePageSize));
  const paginatedNotes = useMemo(() => {
    const start = (notePage - 1) * notePageSize;
    return filteredNotes.slice(start, start + notePageSize);
  }, [filteredNotes, notePage, notePageSize]);

  // Auto-select first note on initial desktop load if available
  const hasInitializedSelectionRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedSelectionRef.current && filteredNotes.length > 0) {
      hasInitializedSelectionRef.current = true;
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && !selectParam && !selectedNoteId) {
        setSelectedNoteId(filteredNotes[0]._id);
      }
    }
  }, [filteredNotes, selectParam, selectedNoteId]);

  // Clean up selection if the selected note no longer exists in notes
  useEffect(() => {
    if (selectedNoteId && !notes.some((n) => n._id === selectedNoteId)) {
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && filteredNotes.length > 0) {
        setSelectedNoteId(filteredNotes[0]._id);
      } else {
        setSelectedNoteId(null);
      }
    }
  }, [notes, filteredNotes, selectedNoteId]);

  const activeSelectedNote = useMemo(() => {
    return notes.find((n) => n._id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);

  // Sync DM reply input when active note changes
  useEffect(() => {
    if (activeSelectedNote?.dmResponse?.text) {
      setDmReplyInput(activeSelectedNote.dmResponse.text);
    } else {
      setDmReplyInput('');
    }
    setIsEditingDmReply(false);
  }, [activeSelectedNote?._id]);

  const handleTogglePin = (noteId: string) => {
    CampaignManager.togglePinNote(noteId);
    refreshData();
    showToast('Stato fissato aggiornato.');
  };

  const handleToggleAskDm = (noteId: string, currentAskDm: boolean) => {
    CampaignManager.setNoteAskDm(noteId, !currentAskDm);
    refreshData();
    showToast(!currentAskDm ? 'Richiesta chiarimento inviata al DM.' : 'Richiesta chiarimento rimossa.');
  };

  const handleSendDmReply = () => {
    if (!activeSelectedNote || !dmReplyInput.trim() || !player) return;
    const dmName = player.characterName || 'Dungeon Master';
    CampaignManager.replyToDmClarification(activeSelectedNote._id, dmReplyInput, dmName, true);
    setIsEditingDmReply(false);
    refreshData();
    showToast('Risposta inviata al giocatore!');
  };

  const handleToggleDmResolved = () => {
    if (!activeSelectedNote?.dmResponse) return;
    const current = !!activeSelectedNote.dmResponse.isResolved;
    CampaignManager.toggleDmClarificationResolved(activeSelectedNote._id, !current);
    refreshData();
    showToast(!current ? 'Chiarimento segnato come risolto.' : 'Chiarimento riaperto.');
  };

  const handleRemoveClarificationDm = (noteId: string) => {
    CampaignManager.removeClarificationForDm(noteId);
    refreshData();
    showToast('Chiarimento rimosso dalla vista del Master.');
  };

  const handleDeleteDmReply = (noteId: string) => {
    CampaignManager.deleteDmReply(noteId);
    setDmReplyInput('');
    setIsEditingDmReply(false);
    refreshData();
    showToast('Risposta del Master cancellata.');
  };

  const handleRemoveClarificationPlayer = (noteId: string) => {
    if (!player?._id) return;
    CampaignManager.removeClarificationForPlayer(noteId, player._id);
    refreshData();
    showToast('Chiarimento rimosso dal tuo profilo.');
  };

  const handleDeleteClarificationRequest = (noteId: string) => {
    CampaignManager.deleteClarificationRequest(noteId);
    refreshData();
    showToast('Richiesta chiarimento annullata.');
  };

  const handleOpenCreateNote = () => {
    setEditingNote(null);
    setNoteModalDefaults({
      sessionId: sessions[0]?._id || '',
      loreDate: calendar
        ? `${calendar.currentDay} ${calendar.months[calendar.currentMonthIndex]?.name || ''} ${calendar.currentYear} ${calendar.yearSuffix}`
        : '',
      visibility: 'group',
    });
    setIsNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: Note) => {
    setEditingNote(note);
    setIsNoteModalOpen(true);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      CampaignManager.deleteNote(noteToDelete);
      if (selectedNoteId === noteToDelete) {
        setSelectedNoteId(null);
      }
      setNoteToDelete(null);
      refreshData();
      showToast('Nota rimossa.');
    }
  };

  const filteredQuests = useMemo(() => {
    if (questScopeFilter === 'all') return openQuests;
    return openQuests.filter((q) => (questScopeFilter === 'personal' ? q.questScope === 'personal' : q.questScope !== 'personal'));
  }, [openQuests, questScopeFilter]);

  const campaignMeta = CampaignManager.getCampaignMeta();

  // Pending clarifications count for banner
  const pendingDmClarifications = notes.filter((n) => n.askDm && (!n.dmResponse?.text || !n.dmResponse.isResolved)).length;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-surface-0 font-body">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-1 border border-primary/40 text-content-1 px-4 py-2.5 rounded-[2px] shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-primary shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Integrated Top Header Bar */}
      <header className="bg-surface-1 border-b border-surface-2 px-4 sm:px-6 py-3.5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-primary uppercase">
              <span className="flex items-center gap-1.5">
                <Scroll size={12} className="text-primary" />
                Diario di Campagna
              </span>
              <span className="text-surface-3">/</span>
              <span className="text-content-3">
                {notes.length} {notes.length === 1 ? 'voce' : 'voci'}
              </span>
              {campaignMeta?.name && (
                <>
                  <span className="text-surface-3">/</span>
                  <span className="text-content-2 truncate max-w-[220px]">{campaignMeta.name}</span>
                </>
              )}
            </div>
            <h1 className="font-cinzel font-semibold text-lg sm:text-xl text-content-1 tracking-[0.05em]">
              Cronache, Memorie & Appunti del Tavolo
            </h1>
          </div>

          {/* Right side controls: In-game Date & Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {calendar && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-surface-2/60 border border-surface-2 text-xs font-mono text-content-2">
                <Compass size={13} className="text-primary shrink-0" />
                <span>
                  {calendar.currentDay} {calendar.months[calendar.currentMonthIndex]?.name} {calendar.currentYear}{' '}
                  {calendar.yearSuffix}
                </span>
              </div>
            )}

            <button
              onClick={handleOpenCreateNote}
              className="px-3.5 py-1.5 rounded-[2px] text-xs font-medium bg-primary text-surface-0 hover:bg-primary-hover transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>Verga Nuova Nota</span>
            </button>
          </div>
        </div>
      </header>

      {/* Integrated Typographic Tab Bar (Underlined tabs, no floating SaaS pills) */}
      <nav className="bg-surface-1 border-b border-surface-2 px-4 sm:px-6 flex items-center gap-6 overflow-x-auto custom-scrollbar shrink-0 text-xs">
        <button
          onClick={() => handleTabChange('notes')}
          className={`flex items-center gap-2 py-2.5 -mb-px border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'notes'
              ? 'border-primary text-content-1 font-semibold'
              : 'border-transparent text-content-3 hover:text-content-1'
          }`}
        >
          <Feather size={13} className={activeTab === 'notes' ? 'text-primary' : ''} />
          <span>Appunti & Cronache</span>
          <span className="font-mono text-[10px] text-content-3">({notes.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('session')}
          className={`flex items-center gap-2 py-2.5 -mb-px border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'session'
              ? 'border-primary text-content-1 font-semibold'
              : 'border-transparent text-content-3 hover:text-content-1'
          }`}
        >
          <BookOpen size={13} className={activeTab === 'session' ? 'text-primary' : ''} />
          <span>Ultima Cronaca</span>
          {latestSession && (
            <span className="font-mono text-[10px] text-primary">#{latestSession.number}</span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('quests')}
          className={`flex items-center gap-2 py-2.5 -mb-px border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'quests'
              ? 'border-primary text-content-1 font-semibold'
              : 'border-transparent text-content-3 hover:text-content-1'
          }`}
        >
          <Target size={13} className={activeTab === 'quests' ? 'text-primary' : ''} />
          <span>Missioni Attive</span>
          <span className="font-mono text-[10px] text-content-3">({openQuests.length})</span>
        </button>
      </nav>

      {/* Main Work Area */}
      <main className="flex-1 min-h-0 relative overflow-hidden bg-surface-0">
        {/* TAB 1: APPUNTI & CRONACHE (Archival Index + Direct Reading Sheet) */}
        {activeTab === 'notes' && (
          <div className="h-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-surface-2 overflow-hidden">
            {/* Left Column: Index Column (Fixed width on desktop, full on mobile) */}
            <aside className={`w-full md:w-80 lg:w-96 h-full flex flex-col min-h-0 bg-surface-1 shrink-0 ${selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
              {/* Filter & Search Header */}
              <div className="p-3 border-b border-surface-2 space-y-2.5 shrink-0 bg-surface-1">
                {/* Search Input */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    type="text"
                    placeholder="Filtra cronache, parole chiave, autori..."
                    value={noteSearchQuery}
                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                    className="w-full bg-surface-2/60 border border-surface-2 focus:border-primary rounded-[2px] pl-7 pr-7 py-1.5 text-xs text-content-1 outline-none transition-colors placeholder-content-3 font-sans"
                  />
                  {noteSearchQuery && (
                    <button
                      onClick={() => setNoteSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Filter Links */}
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar text-[11px] font-mono pb-0.5">
                  {[
                    { id: 'all' as const, label: 'TUTTE' },
                    { id: 'group' as const, label: 'GRUPPO' },
                    { id: 'my' as const, label: 'PERSONALI' },
                    { id: 'pinned' as const, label: 'FISSATE' },
                    { id: 'askDm' as const, label: 'CHIARIMENTI' },
                    ...(player?.isDm ? [{ id: 'dmOnly' as const, label: 'SEGRETI DM' }] : []),
                  ].map((tab) => {
                    const isActive = noteFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setNoteFilter(tab.id);
                          setNotePage(1);
                        }}
                        className={`px-2 py-0.5 rounded-[2px] transition-colors whitespace-nowrap cursor-pointer ${
                          isActive
                            ? 'bg-primary text-surface-0 font-semibold'
                            : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Category Dropdown */}
                {categories.length > 0 && (
                  <div className="flex items-center justify-between text-xs gap-2 pt-1 border-t border-surface-2/60">
                    <span className="text-[10px] text-content-3 font-mono uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Filter size={10} /> Categoria:
                    </span>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => {
                        setSelectedCategoryFilter(e.target.value);
                        setNotePage(1);
                      }}
                      className="w-full max-w-[200px] bg-surface-2/60 border border-surface-2 text-content-2 text-[11px] rounded-[2px] px-2 py-0.5 outline-none cursor-pointer truncate font-mono"
                    >
                      <option value="all">Tutte le categorie</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Continuous Register Rows (No card nesting, 1px divider) */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain divide-y divide-surface-2/60 bg-surface-1">
                {filteredNotes.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <Feather size={20} className="mx-auto text-content-3 opacity-40" />
                    <p className="text-xs text-content-3 font-mono">Nessuna voce trovata nel registro.</p>
                  </div>
                ) : (
                  paginatedNotes.map((note) => {
                    const isSelected = selectedNoteId === note._id;
                    const hasDmResponse = !!note.dmResponse?.text;
                    const isResolved = !!note.dmResponse?.isResolved;

                    return (
                      <article
                        key={note._id}
                        onClick={() => setSelectedNoteId(note._id)}
                        className={`px-4 py-3 transition-all cursor-pointer flex flex-col gap-1.5 relative border-b border-surface-2/40 ${
                          isSelected
                            ? 'border-l-[3px] border-l-primary bg-gradient-to-r from-primary/10 via-primary/[0.03] to-transparent text-content-1'
                            : 'border-l-[3px] border-l-transparent hover:bg-surface-2/30 text-content-2'
                        }`}
                      >
                        {/* Title Row with subtle minimal indicators */}
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <h4
                            className={`text-[0.95rem] font-cinzel leading-snug line-clamp-1 transition-colors ${
                              isSelected ? 'font-semibold text-primary' : 'font-medium text-content-1'
                            }`}
                          >
                            <EntityMentionText text={note.title} />
                          </h4>

                          {/* Minimalist discreet markers & clear personal/group distinction */}
                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            {note.pinned && (
                              <span title="Nota fissata" className="inline-flex items-center shrink-0">
                                <Pin size={11} className="text-primary fill-primary/30" />
                              </span>
                            )}
                            {note.dmOnly ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-[2px] border border-purple-500/20 font-medium"
                                title="Segreto DM"
                              >
                                <Lock size={8} /> DM
                              </span>
                            ) : note.visibility === 'personal' ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] border border-amber-500/20 font-medium"
                                title="Nota Personale"
                              >
                                <User size={8} /> PG
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-content-3/80 bg-surface-2/60 px-1.5 py-0.5 rounded-[2px] border border-surface-2 font-normal"
                                title="Nota Condivisa di Gruppo"
                              >
                                <Users size={8} /> Gruppo
                              </span>
                            )}
                            {note.askDm && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  hasDmResponse ? (isResolved ? 'bg-emerald-400' : 'bg-cyan-400') : 'bg-amber-400 animate-pulse'
                                }`}
                                title={hasDmResponse ? (isResolved ? 'DM Risposto (Risolto)' : 'DM Risposto') : 'Attesa responso DM'}
                              />
                            )}
                          </div>
                        </div>

                        {/* Sub-line: compact Author & Lore date with JetBrains Mono styling */}
                        <div className="flex items-center justify-between text-[0.72rem] font-mono tracking-[0.05em] uppercase opacity-75 text-content-3">
                          <span className="truncate max-w-[140px]">
                            {note.author?.characterName || 'Anonimo'}
                          </span>
                          <span className="shrink-0 text-[10px]">
                            {note.loreDate || new Date(note._createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {/* Compact Index Pagination */}
              <div className="p-2.5 border-t border-surface-2 bg-surface-1 shrink-0">
                <Pagination
                  currentPage={notePage}
                  totalPages={totalNotePages}
                  onPageChange={setNotePage}
                  pageSize={notePageSize}
                  onPageSizeChange={(sz) => {
                    setNotePageSize(sz);
                    setNotePage(1);
                  }}
                  pageSizeOptions={[5, 10, 20]}
                  totalItems={filteredNotes.length}
                  compact
                />
              </div>
            </aside>

            {/* Right Column: Direct Reading Sheet (Occupy all space, no nested cards) */}
            <section className={`flex-1 flex flex-col min-h-0 bg-surface-0 overflow-y-auto custom-scrollbar ${!selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
              {activeSelectedNote ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Reading Control Bar */}
                  <div className="px-6 py-3 border-b border-surface-2 bg-surface-1 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(null)}
                        className="md:hidden p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-2 hover:text-content-1 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                        title="Torna all'indice delle note"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <span className="font-mono text-[11px] text-content-3 flex items-center gap-1.5">
                        <Scroll size={12} className="text-primary" />
                        <span>REGISTRO ARCHIVISTICO #{activeSelectedNote._id.slice(-4).toUpperCase()}</span>
                      </span>
                    </div>

                    {/* Actions in row */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAskDm(activeSelectedNote._id, activeSelectedNote.askDm)}
                        className={`px-2.5 py-1 rounded-[2px] text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          activeSelectedNote.askDm
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            : 'bg-surface-2 text-content-3 border-surface-2 hover:text-content-1'
                        }`}
                      >
                        <HelpCircle size={12} />
                        <span className="hidden sm:inline">
                          {activeSelectedNote.askDm ? 'Chiesto al DM' : 'Chiedi al DM'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleTogglePin(activeSelectedNote._id)}
                        className={`p-1.5 rounded-[2px] border transition-colors cursor-pointer ${
                          activeSelectedNote.pinned
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-surface-2 text-content-3 border-surface-2 hover:text-content-1'
                        }`}
                        title="Fissa nota"
                      >
                        <Pin size={13} />
                      </button>

                      {(activeSelectedNote.author?._id === player?._id || player?.isDm) && (
                        <>
                          <button
                            onClick={() => handleOpenEditNote(activeSelectedNote)}
                            className="p-1.5 rounded-[2px] bg-surface-2 text-content-3 border border-surface-2 hover:text-content-1 transition-colors cursor-pointer"
                            title="Modifica Nota"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => setNoteToDelete(activeSelectedNote._id)}
                            className="p-1.5 rounded-[2px] bg-surface-2 text-content-3 border border-surface-2 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Elimina Nota"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reading Sheet Content (Centered 780px document sheet with refined styling) */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-10 w-full flex flex-col items-center">
                    <div className="w-full max-w-[780px] bg-surface-1/75 border border-surface-2/80 shadow-[0_4px_24px_rgba(0,0,0,0.35)] rounded-[4px] p-6 sm:p-10 md:p-12 space-y-8">
                      {/* Header */}
                      <div className="space-y-3 pb-2">
                        {/* Editorial Small Caps Metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.05em] font-mono text-content-3 opacity-80">
                          {activeSelectedNote.dmOnly ? (
                            <span className="text-purple-400 flex items-center gap-1 font-medium">
                              <Lock size={10} /> Segreto DM
                            </span>
                          ) : activeSelectedNote.visibility === 'personal' ? (
                            <span className="text-amber-400/90 flex items-center gap-1 font-medium">
                              <User size={10} /> Nota Personale PG
                            </span>
                          ) : (
                            <span className="text-content-3 flex items-center gap-1">
                              <Users size={10} /> Nota di Gruppo
                            </span>
                          )}

                          {activeSelectedNote.category && (
                            <>
                              <span className="text-surface-3">&bull;</span>
                              <span className="text-content-3">{activeSelectedNote.category.title}</span>
                            </>
                          )}
                          {activeSelectedNote.session && (
                            <>
                              <span className="text-surface-3">&bull;</span>
                              <span className="text-primary font-medium">
                                Sessione #{activeSelectedNote.session.number}
                              </span>
                            </>
                          )}
                          {activeSelectedNote.canonState && (
                            <>
                              <span className="text-surface-3">&bull;</span>
                              <span
                                className={
                                  activeSelectedNote.canonState === 'canon'
                                    ? 'text-emerald-400/90 font-medium'
                                    : 'text-amber-400/80 font-medium'
                                }
                              >
                                {activeSelectedNote.canonState === 'canon' ? 'Canone Accertato' : 'Teoria PG'}
                              </span>
                            </>
                          )}
                        </div>

                        <h2 className="font-cinzel font-semibold text-2xl sm:text-3xl text-content-1 tracking-[0.05em] leading-snug">
                          <EntityMentionText text={activeSelectedNote.title} />
                        </h2>

                        {/* Author & Lore Date */}
                        <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-content-3 font-mono pt-1">
                          <div className="flex items-center gap-1.5 text-content-2 font-sans font-medium">
                            <div
                              className="w-4 h-4 rounded-[2px] flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0"
                              style={{ backgroundColor: activeSelectedNote.author?.color || 'var(--color-primary)' }}
                            >
                              {activeSelectedNote.author?.avatarUrl ? (
                                <img
                                  src={activeSelectedNote.author.avatarUrl}
                                  alt="Avatar"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                activeSelectedNote.author?.characterName?.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span>{activeSelectedNote.author?.characterName}</span>
                          </div>

                          {activeSelectedNote.loreDate && (
                            <>
                              <span className="text-surface-3">&bull;</span>
                              <span className="flex items-center gap-1 text-primary">
                                <Clock size={11} /> {activeSelectedNote.loreDate}
                              </span>
                            </>
                          )}

                          <span className="text-surface-3">&bull;</span>
                          <span className="text-[10px]">
                            Registrato il {new Date(activeSelectedNote._createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Thin Decorative Gradient Separator */}
                        <div
                          className="h-[1px] w-full my-6 sm:my-8 opacity-40"
                          style={{
                            background: 'linear-gradient(90deg, transparent, var(--color-primary, #a855f7), transparent)',
                          }}
                        />
                      </div>

                      {/* Integrated DM Clarification Module */}
                      {(activeSelectedNote.askDm || activeSelectedNote.dmResponse) && (
                        <div className="p-4 rounded-[2px] bg-surface-1 border-l-2 border-cyan-500/80 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <ShieldAlert size={15} className="text-cyan-400 shrink-0" />
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-content-1 flex items-center gap-2">
                                  <span>Chiarimento col Dungeon Master</span>
                                  {activeSelectedNote.dmResponse?.isResolved && (
                                    <span className="text-emerald-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
                                      [Risolto]
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[11px] text-content-3 truncate">
                                  {activeSelectedNote.author?.characterName} ha richiesto responso su lore, indizi o regole.
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons for DM vs Player */}
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {player?.isDm ? (
                                <>
                                  {activeSelectedNote.dmResponse?.text && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handleToggleDmResolved}
                                        className={`px-2.5 py-1 rounded-[2px] text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                                          activeSelectedNote.dmResponse.isResolved
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-surface-2 text-content-2 border-surface-2 hover:text-content-1'
                                        }`}
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>{activeSelectedNote.dmResponse.isResolved ? 'Risolto' : 'Segna Risolto'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDmReply(activeSelectedNote._id)}
                                        className="px-2 py-1 rounded-[2px] text-xs font-medium text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Cancella la risposta del Master"
                                      >
                                        <Trash2 size={12} />
                                        <span className="hidden sm:inline">Elimina Risposta</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveClarificationDm(activeSelectedNote._id)}
                                    className="px-2.5 py-1 rounded-[2px] text-xs font-medium bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-2 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Rimuovi questo chiarimento dal pannello del Master"
                                  >
                                    <EyeOff size={12} />
                                    <span>Rimuovi dal Master</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveClarificationPlayer(activeSelectedNote._id)}
                                    className="px-2.5 py-1 rounded-[2px] text-xs font-medium bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-2 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Rimuovi questo chiarimento dal tuo profilo"
                                  >
                                    <EyeOff size={12} />
                                    <span>Rimuovi dal mio profilo</span>
                                  </button>

                                  {!activeSelectedNote.dmResponse?.text && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClarificationRequest(activeSelectedNote._id)}
                                      className="px-2 py-1 rounded-[2px] text-xs font-medium text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Annulla la richiesta di chiarimento"
                                    >
                                      <Trash2 size={12} />
                                      <span className="hidden sm:inline">Annulla Richiesta</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {activeSelectedNote.dmResponse?.text && (
                            <div className="bg-surface-2/60 p-3.5 rounded-[2px] border border-surface-2/60 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-primary font-semibold font-mono text-[11px]">
                                  <Sparkles size={12} />
                                  <span>Responso di {activeSelectedNote.dmResponse.answeredBy}</span>
                                </div>
                                <span className="text-[10px] text-content-3 font-mono">
                                  {new Date(activeSelectedNote.dmResponse.answeredAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="text-xs text-content-1 leading-relaxed pl-2 border-l-2 border-primary/40">
                                <MarkdownRenderer content={activeSelectedNote.dmResponse.text} />
                              </div>
                            </div>
                          )}

                          {player?.isDm && (
                            <div className="pt-2 border-t border-surface-2/60 space-y-2">
                              <span className="block font-semibold text-primary text-[10px] uppercase tracking-wider font-mono">
                                {activeSelectedNote.dmResponse?.text ? 'Modifica Risposta del Master:' : 'Scrivi Risposta del Master:'}
                              </span>
                              <textarea
                                rows={3}
                                placeholder="Fornisci la spiegazione del Master..."
                                value={dmReplyInput}
                                onChange={(e) => setDmReplyInput(e.target.value)}
                                className="w-full bg-surface-2/60 border border-surface-2 focus:border-primary rounded-[2px] p-3 text-xs text-content-1 outline-none resize-none"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={handleSendDmReply}
                                  disabled={!dmReplyInput.trim()}
                                  className="px-3.5 py-1.5 rounded-[2px] bg-primary text-surface-0 hover:bg-primary-hover text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                                >
                                  <Send size={12} /> Invia Responso al PG
                                </button>
                              </div>
                            </div>
                          )}

                          {!player?.isDm && !activeSelectedNote.dmResponse?.text && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[2px] text-xs text-amber-300 flex items-center gap-2">
                              <Clock size={13} className="shrink-0 animate-spin" />
                              <span>In attesa del responso del Dungeon Master...</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prose Body (Newsreader serif, 1.15rem, 1.85 line height for book-like readability) */}
                      <div className="font-reading text-[1.15rem] leading-[1.85] font-light text-content-1/95 space-y-6">
                        {activeSelectedNote.content ? (
                          <MarkdownRenderer content={activeSelectedNote.content} />
                        ) : (
                          <p className="text-xs text-content-3 italic font-mono">
                            // Nessun testo trascritto in questa voce di registro.
                          </p>
                        )}
                      </div>

                      {/* Attachments */}
                      {activeSelectedNote.images && activeSelectedNote.images.length > 0 && (
                        <div className="pt-6 border-t border-surface-2/60 space-y-3">
                          <span className="font-semibold uppercase tracking-wider font-mono text-[11px] text-content-3">
                            Tavole & Allegati Visivi ({activeSelectedNote.images.length})
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {activeSelectedNote.images.map((img, idx) => (
                              <div
                                key={idx}
                                onClick={() => setActiveLightboxImg(img)}
                                className="aspect-video rounded-[2px] overflow-hidden cursor-pointer bg-surface-2 border border-surface-2 relative group"
                              >
                                <img
                                  src={img}
                                  alt="Allegato"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Editorial Empty State with context */
                <div className="h-full flex flex-col justify-center max-w-xl mx-auto p-8 space-y-6">
                  <div className="space-y-2 border-b border-surface-2 pb-6">
                    <div className="flex items-center gap-2 text-primary text-xs font-mono uppercase tracking-wider">
                      <Scroll size={14} />
                      <span>Consultazione Archivistica</span>
                    </div>
                    <h3 className="font-cinzel font-semibold text-2xl text-content-1 tracking-[0.05em]">
                      Archivio del Diario & Cronache
                    </h3>
                    <p className="text-xs text-content-3 leading-relaxed">
                      Seleziona una pergamena dall'indice a sinistra per esaminarne il testo integrale e i chiarimenti, oppure avvia la redazione di una nuova cronaca per il gruppo.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs text-content-2">
                    <div className="flex items-center justify-between p-3 rounded-[2px] bg-surface-1 border border-surface-2">
                      <span className="font-mono text-content-3">Voci totali nel registro:</span>
                      <span className="font-mono font-bold text-content-1">{notes.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-[2px] bg-surface-1 border border-surface-2">
                      <span className="font-mono text-content-3">Chiarimenti aperti con il DM:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {notes.filter((n) => n.askDm && !n.dmResponse?.isResolved).length}
                      </span>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={handleOpenCreateNote}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-surface-0 hover:bg-primary-hover text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus size={14} />
                      <span>Verga Nuova Voce nel Diario</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: LATEST SESSION (Full-width 2-column Editorial Spread) */}
        {activeTab === 'session' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-surface-0">
            {latestSession ? (
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Prose Column (8/12) */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="border-b border-surface-2 pb-5 space-y-2">
                    <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-wider">
                      Cronaca Ufficiale &bull; Sessione #{latestSession.number}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold text-content-1 tracking-tight">
                      {latestSession.title}
                    </h2>
                    {latestSession.loreDate && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-primary font-mono pt-1">
                        <Clock size={12} /> {latestSession.loreDate}
                      </div>
                    )}
                  </div>

                  <div className="prose text-sm text-content-1 leading-relaxed space-y-4 font-body">
                    {extractTextFromContent(latestSession.recap) ? (
                      <MarkdownRenderer
                        content={extractTextFromContent(latestSession.recap)}
                      />
                    ) : (
                      <p className="text-xs text-content-3 italic font-mono">Nessun riassunto redatto per questa sessione.</p>
                    )}
                  </div>
                </div>

                {/* Archival Sidebar Register (4/12) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="border border-surface-2 divide-y divide-surface-2 bg-surface-1">
                    <div className="p-3 bg-surface-2/40 text-[10px] font-mono uppercase tracking-wider text-content-3 font-semibold">
                      Specifiche della Sessione
                    </div>
                    {latestSession.date && (
                      <div className="p-3 text-xs flex justify-between items-center">
                        <span className="text-content-3 font-mono">Data reale:</span>
                        <span className="text-content-1 font-mono">{latestSession.date}</span>
                      </div>
                    )}
                    {latestSession.loreDate && (
                      <div className="p-3 text-xs flex justify-between items-center">
                        <span className="text-content-3 font-mono">Data nel mondo:</span>
                        <span className="text-primary font-mono">{latestSession.loreDate}</span>
                      </div>
                    )}
                    <div className="p-3 text-xs flex justify-between items-center">
                      <span className="text-content-3 font-mono">Sessione:</span>
                      <span className="text-content-1 font-mono font-bold">#{latestSession.number}</span>
                    </div>
                  </div>

                  <Link
                    to="/sessions"
                    className="w-full p-3 rounded-[2px] bg-surface-1 border border-surface-2 hover:border-primary text-xs font-medium transition-colors flex items-center justify-between text-content-1"
                  >
                    <span>Apri il Tomo Completo delle Sessioni</span>
                    <ChevronRight size={14} className="text-primary" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-content-3 space-y-3">
                <BookOpen size={36} className="opacity-30 text-primary" />
                <p className="text-sm">Nessuna sessione registrata nella cronaca.</p>
                <Link
                  to="/sessions"
                  className="px-4 py-2 rounded-[2px] bg-primary text-surface-0 hover:bg-primary-hover text-xs font-medium transition-colors"
                >
                  Vai al Tomo delle Sessioni
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE QUESTS (Operational Full-Width Register) */}
        {activeTab === 'quests' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-surface-0 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-content-1">
                  Registro Operativo delle Missioni & Trame
                </h3>
                <p className="text-xs text-content-3">Tracciamento continuo di incarichi, promesse e investigazioni attive del gruppo e dei singoli personaggi</p>
              </div>

              {/* Controls & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs font-mono">
                  <button
                    onClick={() => setQuestScopeFilter('all')}
                    className={`px-3 py-1 rounded-[2px] transition-colors cursor-pointer ${
                      questScopeFilter === 'all' ? 'bg-primary text-surface-0 font-semibold' : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1'
                    }`}
                  >
                    TUTTE ({openQuests.length})
                  </button>
                  <button
                    onClick={() => setQuestScopeFilter('party')}
                    className={`px-3 py-1 rounded-[2px] transition-colors cursor-pointer ${
                      questScopeFilter === 'party' ? 'bg-primary text-surface-0 font-semibold' : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1'
                    }`}
                  >
                    GRUPPO
                  </button>
                  <button
                    onClick={() => setQuestScopeFilter('personal')}
                    className={`px-3 py-1 rounded-[2px] transition-colors cursor-pointer ${
                      questScopeFilter === 'personal' ? 'bg-primary text-surface-0 font-semibold' : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1'
                    }`}
                  >
                    PERSONALI
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingQuest(null);
                    setIsQuestModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-primary text-surface-0 text-xs font-medium rounded-[2px] flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  <Plus size={13} />
                  <span>Nuova Missione</span>
                </button>
              </div>
            </div>

            {filteredQuests.length === 0 ? (
              <div className="py-16 text-center text-content-3 space-y-3 border border-surface-2 bg-surface-1 rounded-[2px]">
                <Target size={32} className="mx-auto opacity-30 text-primary" />
                <p className="text-xs font-mono">Nessuna missione aperta registrata in questa categoria.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuest(null);
                    setIsQuestModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 text-xs rounded-[2px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Crea una Quest</span>
                </button>
              </div>
            ) : (
              <div className="border border-surface-2 divide-y divide-surface-2 bg-surface-1 rounded-[2px]">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 px-4 py-2.5 bg-surface-2/40 text-[10px] font-mono uppercase tracking-wider text-content-3 font-semibold">
                  <div className="col-span-4">Nome Missione / Incarico</div>
                  <div className="col-span-3">Ambito & Visibilità</div>
                  <div className="col-span-3">Avanzamento & Note</div>
                  <div className="col-span-2 text-right">Azioni</div>
                </div>

                {/* Table Rows */}
                {filteredQuests.map((quest) => (
                  <div
                    key={quest._id}
                    className="p-4 md:px-4 md:py-3.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center hover:bg-surface-2/20 transition-colors"
                  >
                    <div className="md:col-span-4">
                      <h4 className="font-serif font-bold text-sm text-content-1">
                        {quest.name}
                      </h4>
                    </div>

                    <div className="md:col-span-3 text-xs flex flex-wrap items-center gap-1.5">
                      {quest.questScope === 'personal' ? (
                        quest.questPrivacy === 'private' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-medium">
                            <Lock size={10} /> Personale (Segreta) • {quest.assigneePlayerName || 'PG'}
                            {quest.sharedWithDm && (
                              <span className="ml-1 text-amber-300 font-bold" title="Condivisa con DM">
                                👑 DM
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-medium">
                            <Eye size={10} /> Personale (Condivisa) • {quest.assigneePlayerName || 'PG'}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium">
                          <Users size={10} /> Quest di Gruppo
                        </span>
                      )}
                    </div>

                    <div className="md:col-span-3 text-xs text-content-2 line-clamp-2 leading-relaxed font-sans">
                      {quest.progressNote ? (
                        quest.progressNote
                      ) : quest.body?.[0]?.children?.[0]?.text ? (
                        quest.body[0].children[0].text
                      ) : (
                        <span className="text-content-3 italic font-mono">Nessun appunto</span>
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center justify-start md:justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const all = CampaignManager.getEntities();
                          const updated = all.map((q) => (q._id === quest._id ? { ...q, status: 'completed' as const } : q));
                          CampaignManager.saveEntities(updated);
                          refreshData();
                          showToast('Missione segnata come completata!');
                        }}
                        className="px-2 py-1 rounded-[2px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        title="Segna come completata"
                      >
                        <CheckCircle2 size={11} />
                        <span>Completa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuest(quest);
                          setIsQuestModalOpen(true);
                        }}
                        className="p-1 text-content-3 hover:text-primary hover:bg-surface-2 rounded-[2px] transition-colors cursor-pointer"
                        title="Modifica Quest"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestToDelete(quest._id)}
                        className="p-1 text-content-3 hover:text-rose-400 hover:bg-rose-500/10 rounded-[2px] transition-colors cursor-pointer"
                        title="Elimina Quest"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* UNIFIED NOTE MODAL */}
      <NoteModal
        isOpen={isNoteModalOpen}
        initialNote={editingNote}
        defaultValues={noteModalDefaults}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        onSaved={(savedNote) => {
          setSelectedNoteId(savedNote._id);
          refreshData();
          showToast(editingNote ? 'Nota salvata con successo!' : 'Nuova nota aggiunta al tomo!');
        }}
      />

      {/* UNIFIED QUEST MODAL */}
      <QuestModal
        isOpen={isQuestModalOpen}
        onClose={() => {
          setIsQuestModalOpen(false);
          setEditingQuest(null);
        }}
        initialQuest={editingQuest}
        defaultValues={{
          questScope: questScopeFilter === 'personal' ? 'personal' : 'party',
          questPrivacy: 'public',
          assigneePlayerId: player?._id,
        }}
        onSaved={() => {
          refreshData();
          showToast(editingQuest ? 'Missione aggiornata con successo!' : 'Nuova missione registrata nel tomo!');
        }}
      />

      {/* CONFIRM DELETE QUEST MODAL */}
      <ConfirmModal
        isOpen={!!questToDelete}
        title="Elimina Missione"
        message="Sei sicuro di voler eliminare questa quest dal registro? L'operazione non può essere annullata."
        confirmLabel="Elimina Definitivamente"
        onConfirm={() => {
          if (!questToDelete) return;
          const all = CampaignManager.getEntities();
          const updated = all.filter((q) => q._id !== questToDelete);
          CampaignManager.saveEntities(updated);
          setQuestToDelete(null);
          refreshData();
          showToast('Missione rimossa dal registro.');
        }}
        onCancel={() => setQuestToDelete(null)}
      />

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        title="Elimina Nota"
        message="Sei sicuro di voler eliminare questa annotazione dal diario? L'operazione non può essere annullata."
        confirmLabel="Elimina Definitivamente"
        onConfirm={confirmDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />

      {/* LIGHTBOX FOR IMAGES */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-2 cursor-pointer"
            >
              <X size={24} />
            </button>
            <img
              src={activeLightboxImg}
              alt="Anteprima"
              className="max-w-full max-h-[85vh] object-contain rounded-[2px] shadow-2xl border border-surface-2"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
