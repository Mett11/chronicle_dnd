import React, { useState, useMemo, useEffect } from 'react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { MentionInput, MentionTextarea } from '../components/MentionInput';
import { EntityMentionText } from '../components/EntityMentionText';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Session, SessionEvent, CampaignChapter, Player, PlayerPartyStatus, Entity } from '../types';
import {
  Calendar,
  Compass,
  Plus,
  Users,
  Scroll,
  ChevronRight,
  ChevronLeft,
  X,
  Clock,
  Sparkles,
  MapPin,
  Image as ImageIcon,
  Edit3,
  Trash2,
  BookOpen,
  Feather,
  Mic,
  Volume2,
  Bookmark,
  BookMarked,
  FolderPlus,
  Filter,
  Crown,
  Search,
  Layers,
  LayoutGrid,
  FileText,
  ShieldAlert,
  Shield,
  UserMinus,
  UserX,
  Skull,
  UserCheck,
  AlertCircle,
  User,
  Tag,
  Link2,
  Brain,
  MoreVertical,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { LoreDatePicker } from '../components/LoreDatePicker';
import { ImageGalleryUploader } from '../components/ImageGalleryUploader';
import { SingleImageUploader } from '../components/SingleImageUploader';
import { AudioPlayer } from '../components/AudioPlayer';
import { AudioRecorder } from '../components/AudioRecorder';
import { GazetteModal } from '../components/GazetteModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination } from '../components/Pagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { SessionModal } from '../components/SessionModal';
import { EntityExtractionModal } from '../components/EntityExtractionModal';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { PlayerTagsModal } from '../components/PlayerTagsModal';
import { SessionMemorySyncModal } from '../components/SessionMemorySyncModal';
import features from '../config/features.json';
import { extractTextFromContent } from '../lib/sanitize';

type SessionViewSection = 'cover' | 'recap' | 'events' | 'images' | 'audio' | 'party';

const getRecapExcerpt = (recap: any): string => {
  if (!recap) return '';
  const raw = extractTextFromContent(recap);
  return raw
    .replace(/#+\s+/g, '')
    .replace(/[*_~`>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/@\[(.*?)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

export function Sessions() {
  const { player, allPlayers, refreshAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams<{ id?: string }>();
  const selectParam = searchParams.get('select') || paramId;

  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getAccessibleSessions(player));
  const [chapters, setChapters] = useState<CampaignChapter[]>(() => CampaignManager.getChapters());
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>('all');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionSortOrder, setSessionSortOrder] = useState<'desc' | 'asc'>('desc');
  const [onlyMySessions, setOnlyMySessions] = useState(false);
  const [inspectingEntity, setInspectingEntity] = useState<Entity | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(() => {
    const all = CampaignManager.getAccessibleSessions(player);
    if (selectParam) {
      const match = all.find((s) => s._id === selectParam || s.number.toString() === selectParam);
      if (match) return match;
    }
    return all[0] || null;
  });

  // Chronicle view mode for desktop and mobile: 'index' (full session list) or 'reader' (full session reading view)
  const [chronicleView, setChronicleView] = useState<'index' | 'reader'>(() => {
    return selectParam ? 'reader' : 'index';
  });

  // Keep selectedSession synced when selectParam changes in URL
  useEffect(() => {
    if (selectParam) {
      const match = sessions.find((s) => s._id === selectParam || s.number.toString() === selectParam);
      if (match) {
        setSelectedSession(match);
        setChronicleView('reader');
      }
    }
  }, [selectParam, sessions]);

  // Layout mode for the session detail: 'tabs' (ordered & clean) or 'continuous' (all stacked)
  const [activeSection, setActiveSection] = useState<SessionViewSection>('recap');

  // Pagination for Sessions (5, 10, 20 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGazetteOpen, setIsGazetteOpen] = useState(false);
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isMemorySyncModalOpen, setIsMemorySyncModalOpen] = useState(false);
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  // Chapter Modal & Cover Form State
  const [editingChapter, setEditingChapter] = useState<CampaignChapter | null>(null);
  const [editingCoverChapter, setEditingCoverChapter] = useState<CampaignChapter | null>(null);
  const [newChapName, setNewChapName] = useState('');
  const [newChapDesc, setNewChapDesc] = useState('');
  const [newChapColor, setNewChapColor] = useState('#6366f1');
  const [newChapCoverUrl, setNewChapCoverUrl] = useState('');

  const activeChapterObj = useMemo(() => {
    if (selectedChapterFilter === 'all' || selectedChapterFilter === 'unassigned') return null;
    return chapters.find((c) => c.id === selectedChapterFilter || c.name === selectedChapterFilter) || null;
  }, [selectedChapterFilter, chapters]);

  // Lightbox
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  // Reading Mode: toggle interactive @entity mention badges vs clean uninterrupted prose
  const [showMentionTags, setShowMentionTags] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('chronicle_show_mention_tags');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleMentionTags = () => {
    setShowMentionTags((prev) => {
      const next = !prev;
      CampaignManager.saveUserPreferences({ showMentionTags: next });
      return next;
    });
  };

  const orphanTagsInCurrentSession = useMemo(() => {
    const text = extractTextFromContent(selectedSession?.recap);
    if (!text || !text.includes('@')) {
      return [];
    }

    const entityMap = CampaignManager.getEntityLookupMap();
    const players = CampaignManager.getPlayers();
    const playerMap = new Map<string, any>();
    players.forEach((p) => {
      if (p.characterName) playerMap.set(p.characterName.toLowerCase().trim(), p);
      if (p.aliases && Array.isArray(p.aliases)) {
        p.aliases.forEach((a) => {
          if (a) playerMap.set(a.toLowerCase().trim(), p);
        });
      }
    });

    const tokenRegex = /(\[(.*?)\]\(\/entities\/([a-zA-Z]+)\/([a-zA-Z0-9_-]+)\)|@\[(.*?)\]|@([a-zA-Z0-9_'\u00C0-\u017F-]+))/g;
    const orphans: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match[2] && match[3] && match[4]) continue;
      let rawName = (match[5] || match[6] || '').trim();
      while (/[.,;:!?]$/.test(rawName)) {
        rawName = rawName.slice(0, -1);
      }
      if (!rawName) continue;
      const lower = rawName.toLowerCase();
      if (!entityMap.has(lower) && !playerMap.has(lower)) {
        if (!orphans.includes(rawName)) {
          orphans.push(rawName);
        }
      }
    }
    return orphans;
  }, [selectedSession, sessions]);

  // Party Tab Filter and Removal State
  const [partyStatusFilter, setPartyStatusFilter] = useState<'all' | 'active' | 'inactive' | 'retired' | 'dead'>('all');
  const [partyTagFilter, setPartyTagFilter] = useState<string>('all');
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);
  const [managingTagsPlayer, setManagingTagsPlayer] = useState<Player | null>(null);

  const activeCampaignCode = CampaignManager.getActiveCampaignCode() || '';
  const [isDmPlayer, setIsDmPlayer] = useState(() => CampaignManager.isDmPlayerCampaign());
  const isMaster = Boolean(player?.isDm || CampaignManager.isCurrentUserDm() || player?.isCoDm);

  useEffect(() => {
    const handleCampaignSync = () => {
      setIsDmPlayer(CampaignManager.isDmPlayerCampaign());
    };
    window.addEventListener('chronicle_campaign_updated', handleCampaignSync);
    window.addEventListener('chronicle_campaigns_updated', handleCampaignSync);
    window.addEventListener('chronicle_data_updated', handleCampaignSync);
    window.addEventListener('chronicle_campaign_changed', handleCampaignSync);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleCampaignSync);
      window.removeEventListener('chronicle_campaigns_updated', handleCampaignSync);
      window.removeEventListener('chronicle_data_updated', handleCampaignSync);
      window.removeEventListener('chronicle_campaign_changed', handleCampaignSync);
    };
  }, []);

  const handleToggleSessionParticipant = (targetPlayerId: string) => {
    if (!selectedSession || !isMaster) return;
    const currentExcluded = new Set(selectedSession.excludedPlayerIds || []);
    if (currentExcluded.has(targetPlayerId)) {
      currentExcluded.delete(targetPlayerId);
    } else {
      currentExcluded.add(targetPlayerId);
    }
    const nextExcluded = Array.from(currentExcluded);
    const partyPlayers = allPlayers.filter((p) => !p.isDm || isDmPlayer);
    const nextAttendees = partyPlayers.filter((p) => !currentExcluded.has(p._id));
    const nextAttendeeIds = nextAttendees.map((p) => p._id);

    const updated = CampaignManager.updateSession(selectedSession._id, {
      excludedPlayerIds: nextExcluded,
      attendeePlayerIds: nextAttendeeIds,
      attendees: nextAttendees,
    });
    if (updated) {
      setSelectedSession({ ...updated });
      refreshSessions();
    }
  };

  const handlePlayerStatusChange = (targetPlayerId: string, newStatus: PlayerPartyStatus) => {
    const code = activeCampaignCode || CampaignManager.getActiveCampaignCode() || '';
    if (!code) return;
    const targetPlayer = allPlayers.find((p) => p._id === targetPlayerId);
    CampaignManager.setPlayerPartyStatus(targetPlayerId, code, newStatus, targetPlayer?.email);
    refreshAccount();
  };

  const handleConfirmRemovePlayer = () => {
    if (!playerToRemove) return;
    const code = activeCampaignCode || CampaignManager.getActiveCampaignCode() || '';
    if (!code) return;
    CampaignManager.removePlayerFromCampaign(playerToRemove._id, code);
    setPlayerToRemove(null);
    refreshAccount();
  };

  const allPartyTags = useMemo(() => {
    const tagSet = new Set<string>();
    allPlayers.forEach((p) => {
      if (p.tags) {
        p.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [allPlayers]);

  const filteredPartyPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      if (partyStatusFilter !== 'all') {
        const st = p.status || 'active';
        if (st !== partyStatusFilter) return false;
      }
      if (partyTagFilter !== 'all') {
        if (!p.tags || !p.tags.includes(partyTagFilter)) return false;
      }
      return true;
    });
  }, [allPlayers, partyStatusFilter, partyTagFilter]);

  const partyCounts = useMemo(() => {
    return {
      all: allPlayers.length,
      active: allPlayers.filter((p) => (p.status || 'active') === 'active').length,
      inactive: allPlayers.filter((p) => p.status === 'inactive').length,
      retired: allPlayers.filter((p) => p.status === 'retired').length,
      dead: allPlayers.filter((p) => p.status === 'dead').length,
    };
  }, [allPlayers]);

  const refreshSessions = () => {
    const updated = CampaignManager.getAccessibleSessions(player);
    const updatedChaps = CampaignManager.getChapters();
    setSessions(updated);
    setChapters(updatedChaps);
    if (selectedSession) {
      const refreshedSelected = updated.find((s) => s._id === selectedSession._id);
      const nextSelected = refreshedSelected || updated[0] || null;
      setSelectedSession(nextSelected);
      if (!nextSelected) {
        setChronicleView('index');
      }
    } else if (updated.length > 0) {
      setSelectedSession(updated[0]);
    } else {
      setChronicleView('index');
    }
  };

  useEffect(() => {
    refreshSessions();
  }, [player]);

  useEffect(() => {
    const handleUpdate = () => {
      refreshSessions();
    };
    const handleAccountsUpdate = () => {
      refreshAccount();
    };
    window.addEventListener('chronicle_sessions_updated', handleUpdate);
    window.addEventListener('chronicle_chapters_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('chronicle_campaign_changed', handleUpdate);
    window.addEventListener('chronicle_accounts_updated', handleAccountsUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_sessions_updated', handleUpdate);
      window.removeEventListener('chronicle_chapters_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleAccountsUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedSession, player]);

  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      // Chapter filter
      if (selectedChapterFilter !== 'all') {
        if (selectedChapterFilter === 'unassigned') {
          if (s.chapterName || s.chapterId) return false;
        } else if (s.chapterId !== selectedChapterFilter && s.chapterName !== selectedChapterFilter) {
          return false;
        }
      }

      // Search query
      if (sessionSearchQuery.trim()) {
        const q = sessionSearchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesRecap = extractTextFromContent(s.recap).toLowerCase().includes(q);
        const matchesNumber = s.number.toString() === q || `sessione ${s.number}`.includes(q);
        if (!matchesTitle && !matchesRecap && !matchesNumber) return false;
      }

      // Only my sessions filter (attended by current player)
      if (onlyMySessions && player && !player.isDm) {
        if (s.excludedPlayerIds && s.excludedPlayerIds.includes(player._id)) {
          return false;
        }
      }

      return true;
    });

    return [...list].sort((a, b) => {
      return sessionSortOrder === 'desc'
        ? b.number - a.number
        : a.number - b.number;
    });
  }, [sessions, selectedChapterFilter, sessionSearchQuery, sessionSortOrder, onlyMySessions, player]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const currentSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // Keep selected session synced or pick first
  React.useEffect(() => {
    if (filteredSessions.length > 0) {
      if (!selectedSession || !filteredSessions.some((s) => s._id === selectedSession._id)) {
        setSelectedSession(filteredSessions[0]);
      }
    } else {
      setSelectedSession(null);
    }
  }, [filteredSessions, selectedSession]);

  // Natural chronological session navigation:
  // "Sessione Precedente" (sx, indietro nella storia, es. da #12 a #11) -> decrementa il numero di sessione
  // "Sessione Successiva" (dx, avanti nella storia, es. da #12 a #13) -> incrementa il numero di sessione
  const currentSessionNumber = selectedSession?.number;

  // Find previous session (lower session number)
  const prevSession = useMemo(() => {
    if (!selectedSession || typeof currentSessionNumber !== 'number') return null;
    const lowerSessions = filteredSessions
      .filter((s) => s.number < currentSessionNumber)
      .sort((a, b) => b.number - a.number); // Highest of the lower ones (e.g. #11 for #12)
    return lowerSessions[0] || null;
  }, [filteredSessions, selectedSession, currentSessionNumber]);

  // Find next session (higher session number)
  const nextSession = useMemo(() => {
    if (!selectedSession || typeof currentSessionNumber !== 'number') return null;
    const higherSessions = filteredSessions
      .filter((s) => s.number > currentSessionNumber)
      .sort((a, b) => a.number - b.number); // Lowest of the higher ones (e.g. #13 for #12)
    return higherSessions[0] || null;
  }, [filteredSessions, selectedSession, currentSessionNumber]);

  const hasPrevSession = prevSession !== null;
  const hasNextSession = nextSession !== null;

  const handlePrevSession = () => {
    if (prevSession) {
      setSelectedSession(prevSession);
    }
  };

  const handleNextSession = () => {
    if (nextSession) {
      setSelectedSession(nextSession);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sess: Session) => {
    setSelectedSession(sess);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveSessionData = (payload: {
    number: number;
    title: string;
    sessionType: 'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed';
    chapterId?: string;
    chapterName?: string;
    date: string;
    loreDate?: string;
    loreMeta?: {
      startDay: number;
      endDay?: number;
      month: string;
      endMonth?: string;
      year: number;
      endYear?: number;
    };
    recapText: string;
    sessionImages: string[];
    eventsList: Omit<SessionEvent, 'id'>[];
    excludedPlayerIds?: string[];
    attendeePlayerIds?: string[];
    attendees?: Player[];
    entitiesExtracted?: boolean;
    entitiesExtractedAt?: string;
    memorySynced?: boolean;
    memorySyncedAt?: string;
  }) => {
    const attendeePlayerIds = payload.attendeePlayerIds || payload.attendees?.map((p) => p._id) || [];
    if (isEditing && selectedSession) {
      const updated = CampaignManager.updateSession(selectedSession._id, {
        number: payload.number,
        title: payload.title,
        sessionType: payload.sessionType,
        chapterId: payload.chapterId,
        chapterName: payload.chapterName,
        date: payload.date,
        loreDate: payload.loreDate,
        loreStartDay: payload.loreMeta?.startDay,
        loreEndDay: payload.loreMeta?.endDay,
        loreMonth: payload.loreMeta?.month,
        loreEndMonth: payload.loreMeta?.endMonth,
        loreYear: payload.loreMeta?.year,
        loreEndYear: payload.loreMeta?.endYear,
        excludedPlayerIds: payload.excludedPlayerIds,
        attendeePlayerIds,
        attendees: payload.attendees,
        recap: [
          {
            _type: 'block',
            children: [{ _type: 'span', text: payload.recapText || 'Nessun riassunto inserito.' }],
          },
        ],
        events: payload.eventsList.map((evt, i) => ({
          ...evt,
          id: (evt as any).id || ('evt_' + Date.now() + '_' + i),
        })),
        images: payload.sessionImages,
        entitiesExtracted: payload.entitiesExtracted !== undefined ? payload.entitiesExtracted : selectedSession.entitiesExtracted,
        entitiesExtractedAt: payload.entitiesExtractedAt || selectedSession.entitiesExtractedAt,
        memorySynced: payload.memorySynced !== undefined ? payload.memorySynced : selectedSession.memorySynced,
        memorySyncedAt: payload.memorySyncedAt || selectedSession.memorySyncedAt,
      });
      if (updated) {
        setSelectedSession(updated);
      }
    } else {
      const newSess = CampaignManager.addSession({
        number: payload.number,
        title: payload.title,
        sessionType: payload.sessionType,
        chapterId: payload.chapterId,
        chapterName: payload.chapterName,
        date: payload.date,
        loreDate: payload.loreDate,
        loreStartDay: payload.loreMeta?.startDay,
        loreEndDay: payload.loreMeta?.endDay,
        loreMonth: payload.loreMeta?.month,
        loreEndMonth: payload.loreMeta?.endMonth,
        loreYear: payload.loreMeta?.year,
        loreEndYear: payload.loreMeta?.endYear,
        excludedPlayerIds: payload.excludedPlayerIds,
        attendeePlayerIds,
        attendees: payload.attendees,
        recap: [
          {
            _type: 'block',
            children: [{ _type: 'span', text: payload.recapText || 'Nessun riassunto inserito.' }],
          },
        ],
        events: payload.eventsList.map((evt, i) => ({
          ...evt,
          id: (evt as any).id || ('evt_' + Date.now() + '_' + i),
        })),
        images: payload.sessionImages,
        entitiesExtracted: payload.entitiesExtracted,
        entitiesExtractedAt: payload.entitiesExtractedAt,
        memorySynced: payload.memorySynced,
        memorySyncedAt: payload.memorySyncedAt,
      });
      setSelectedSession(newSess);
    }

    setIsModalOpen(false);
    refreshSessions();
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      CampaignManager.deleteSession(sessionToDelete);
      setSessionToDelete(null);
      refreshSessions();
    }
  };

  const handleSelectChapterFromCard = (chap: CampaignChapter) => {
    setSelectedChapterFilter(chap.id);
    setCurrentPage(1);
    const chapSessions = sessions.filter(
      (s) => s.chapterId === chap.id || s.chapterName === chap.name
    );
    if (chapSessions.length > 0) {
      setSelectedSession(chapSessions[0]);
    }
    setActiveSection('recap');
    setMainTab('chronicles');
    setChronicleView('index');
  };

  const handleCreateOrUpdateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapName.trim()) return;
    if (editingChapter) {
      CampaignManager.updateChapter(editingChapter.id, {
        name: newChapName.trim(),
        description: newChapDesc.trim() || undefined,
        color: newChapColor,
        coverImageUrl: newChapCoverUrl.trim() || undefined,
      });
    } else {
      CampaignManager.addChapter({
        name: newChapName.trim(),
        description: newChapDesc.trim() || undefined,
        color: newChapColor,
        coverImageUrl: newChapCoverUrl.trim() || undefined,
      });
    }
    setEditingChapter(null);
    setNewChapName('');
    setNewChapDesc('');
    setNewChapColor('#6366f1');
    setNewChapCoverUrl('');
    setIsChapterModalOpen(false);
    refreshSessions();
  };

  const handleSaveChapterCover = (chapId: string, url: string) => {
    CampaignManager.updateChapter(chapId, { coverImageUrl: url });
    setEditingCoverChapter(null);
    refreshSessions();
  };

  const confirmDeleteChapter = () => {
    if (chapterToDelete) {
      CampaignManager.deleteChapter(chapterToDelete);
      setChapterToDelete(null);
      refreshSessions();
    }
  };

  // Active Top-Level Tab: 'chapters' (default chapter cards view) | 'chronicles' (session list & manuscript reader)
  const [mainTab, setMainTab] = useState<'chronicles' | 'events' | 'chapters' | 'party'>('chapters');

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-surface-0 font-body">
      {/* Top Header Banner (Only visible when not in full reader mode) */}
      {chronicleView !== 'reader' && (
        <header className="bg-surface-1 border-b border-surface-2 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {mainTab === 'chronicles' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterFilter('all');
                    setMainTab('chapters');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-3 text-primary hover:text-primary-hover text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                  title="Torna alla vista Capitoli"
                >
                  <ChevronLeft size={16} />
                  <span>Torna ai Capitoli</span>
                </button>
              ) : null}

              <div className="flex items-center gap-2 min-w-0">
                {activeChapterObj && selectedChapterFilter !== 'all' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/10"
                    style={{ backgroundColor: activeChapterObj.color || '#6366f1' }}
                  />
                )}
                <h1 className="font-serif font-bold text-sm sm:text-base md:text-lg text-content-1 tracking-tight truncate">
                  {selectedChapterFilter !== 'all' && activeChapterObj
                    ? activeChapterObj.name
                    : mainTab === 'chapters'
                    ? 'Capitoli & Tomo delle Sessioni'
                    : 'Tutte le Sessioni di Campagna'}
                </h1>
                <span className="text-[10px] font-mono text-content-3 shrink-0">
                  ({filteredSessions.length} {filteredSessions.length === 1 ? 'sessione' : 'sessioni'})
                </span>
                {selectedChapterFilter !== 'all' && activeChapterObj && player?.isDm && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChapter(activeChapterObj);
                      setNewChapName(activeChapterObj.name);
                      setNewChapDesc(activeChapterObj.description || '');
                      setNewChapColor(activeChapterObj.color || '#6366f1');
                      setNewChapCoverUrl(activeChapterObj.coverImageUrl || '');
                      setIsChapterModalOpen(true);
                    }}
                    className="p-1 rounded text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
                    title="Modifica capitolo"
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {player?.isDm && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChapter(null);
                      setNewChapName('');
                      setNewChapDesc('');
                      setNewChapColor('#6366f1');
                      setNewChapCoverUrl('');
                      setIsChapterModalOpen(true);
                    }}
                    className="px-2.5 sm:px-3 py-1.5 rounded-[2px] font-medium text-xs bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    title="Crea un nuovo Capitolo"
                  >
                    <FolderPlus size={14} className="text-primary" />
                    <span className="hidden sm:inline">+ Nuovo Capitolo</span>
                  </button>
                  <button
                    id="btn-create-new-session"
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-2.5 sm:px-3.5 py-1.5 rounded-[2px] font-medium text-xs bg-primary text-surface-0 hover:bg-primary-hover transition-colors shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                    title="Nuova Sessione"
                  >
                    <Plus size={14} className="stroke-[2.5]" />
                    <span className="sm:hidden font-mono font-bold">+</span>
                    <span className="hidden sm:inline">Nuova Sessione</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Tab 1: Chronicles & Session Manuscript Reader */}
      {mainTab === 'chronicles' && (
        <div className="flex-1 flex flex-col min-h-0 bg-surface-0 overflow-hidden">
          {/* Indice delle Cronache View */}
          <aside className={`w-full flex-1 bg-surface-0 flex flex-col min-h-0 shrink-0 ${
            chronicleView === 'index' ? 'flex' : 'hidden'
          }`}>
            {/* Search and Chapter Filter Header */}
            <div className="p-3 sm:p-4 border-b border-surface-2 bg-surface-1 shrink-0">
              <div className="max-w-7xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 flex-1">
                    {/* Search bar */}
                    <div className="relative flex-1 max-w-md">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                      <input
                        type="text"
                        placeholder="Cerca per titolo, numero o testo..."
                        value={sessionSearchQuery}
                        onChange={(e) => {
                          setSessionSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full bg-surface-2/60 border border-surface-3 focus:border-primary rounded-lg pl-8 pr-7 py-2 text-xs text-content-1 outline-none transition-colors placeholder-content-3 font-sans"
                      />
                      {sessionSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionSearchQuery('');
                            setCurrentPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Chapter Filter Select */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={selectedChapterFilter}
                        onChange={(e) => {
                          setSelectedChapterFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="bg-surface-2/60 border border-surface-3 text-content-1 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer"
                      >
                        <option value="all">Tutti i Capitoli ({sessions.length})</option>
                        {chapters.map((chap) => {
                          const count = sessions.filter((s) => s.chapterId === chap.id || s.chapterName === chap.name).length;
                          return (
                            <option key={chap.id} value={chap.id}>
                              {chap.name} ({count})
                            </option>
                          );
                        })}
                        <option value="unassigned">Non Assegnati ({sessions.filter((s) => !s.chapterName && !s.chapterId).length})</option>
                      </select>

                      {/* Sort Order Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setSessionSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                        className="bg-surface-2/60 hover:bg-surface-2 border border-surface-3 text-content-1 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer flex items-center gap-1.5 font-mono transition-colors shrink-0"
                        title={sessionSortOrder === 'desc' ? 'Ordina: Dal numero di sessione più alto al più basso' : 'Ordina: Dal numero di sessione più basso al più alto'}
                      >
                        <SlidersHorizontal size={12} className="text-primary" />
                        <span>{sessionSortOrder === 'desc' ? 'Sess. # Decrescente (N → 1)' : 'Sess. # Crescente (1 → N)'}</span>
                      </button>

                      {/* Player Participation Filter Button */}
                      {player && !player.isDm && (
                        <button
                          type="button"
                          onClick={() => {
                            setOnlyMySessions((prev) => !prev);
                            setCurrentPage(1);
                          }}
                          className={`border rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer flex items-center gap-1.5 font-mono transition-colors shrink-0 ${
                            onlyMySessions
                              ? 'bg-primary/15 border-primary text-primary font-semibold'
                              : 'bg-surface-2/60 hover:bg-surface-2 border-surface-3 text-content-2'
                          }`}
                          title={onlyMySessions ? 'Mostra tutte le sessioni' : 'Mostra solo le sessioni a cui ho partecipato'}
                        >
                          <Users size={12} className={onlyMySessions ? 'text-primary' : 'text-content-3'} />
                          <span>{onlyMySessions ? 'Solo Mie Presenze (Attivo)' : 'Solo Mie Presenze'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                    {player?.isDm && (
                      <button
                        type="button"
                        onClick={() => setIsChapterModalOpen(true)}
                        className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <FolderPlus size={13} />
                        <span>Gestisci Capitoli</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Session Cards Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-6 bg-surface-0">
              <div className="max-w-7xl mx-auto w-full">
                {filteredSessions.length === 0 ? (
                  <div className="p-12 text-center space-y-3 bg-surface-1 border border-surface-2 rounded-xl">
                    <Scroll size={32} className="mx-auto text-content-3 opacity-40" />
                    <p className="text-sm font-medium text-content-2">Nessuna sessione trovata per i criteri selezionati.</p>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      {sessionSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionSearchQuery('');
                            setCurrentPage(1);
                          }}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
                          Azzera ricerca
                        </button>
                      )}
                      {player?.isDm && (
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="px-3 py-1.5 rounded bg-primary text-surface-0 text-xs font-mono font-semibold cursor-pointer hover:bg-primary-hover transition-colors"
                        >
                          + Registra Nuova Sessione
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentSessions.map((sess) => {
                      const excerpt = getRecapExcerpt(sess.recap);
                      return (
                        <article
                          key={sess._id}
                          onClick={() => {
                            setSelectedSession(sess);
                            setChronicleView('reader');
                          }}
                          className="group p-4 bg-surface-1 hover:bg-surface-2/60 border border-surface-2 hover:border-primary/40 rounded-xl transition-all flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-md relative"
                        >
                          <div className="space-y-2">
                            {/* Card Top Pill & Dates */}
                            <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                              <span className="font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                SESS. #{sess.number}
                              </span>
                              <div className="flex items-center gap-2 text-content-3">
                                {sess.loreDate && (
                                  <span className="flex items-center gap-1 text-primary truncate max-w-[120px]" title={`Data Lore: ${sess.loreDate}`}>
                                    <Clock size={11} /> {sess.loreDate}
                                  </span>
                                )}
                                {sess.date && (
                                  <span className="flex items-center gap-1 text-content-3" title={`Data giocata: ${sess.date}`}>
                                    <Calendar size={11} /> {sess.date}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Session Title */}
                            <h3 className="font-serif font-bold text-sm sm:text-base text-content-1 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                              <EntityMentionText text={sess.title} />
                            </h3>

                            {/* Narrative Excerpt */}
                            {excerpt ? (
                              <p className="text-xs text-content-3 line-clamp-3 leading-relaxed font-sans">
                                {excerpt}
                              </p>
                            ) : (
                              <p className="text-xs text-content-3 italic font-sans">
                                Nessun diario registrato per questa sessione.
                              </p>
                            )}
                          </div>

                          {/* Card Footer Badges & CTA */}
                          <div className="mt-3.5 pt-2.5 border-t border-surface-2/70 flex items-center justify-between gap-2 text-[11px] font-mono">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {sess.chapterName && selectedChapterFilter === 'all' && (
                                <span className="text-[10px] text-content-3 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-3 truncate max-w-[110px]">
                                  {sess.chapterName}
                                </span>
                              )}
                              {sess.events && sess.events.length > 0 && (
                                <span className="text-[10px] text-primary flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                  <Sparkles size={10} /> {sess.events.length}
                                </span>
                              )}
                              {sess.images && sess.images.length > 0 && (
                                <span className="text-[10px] text-content-3 flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-3">
                                  <ImageIcon size={10} /> {sess.images.length}
                                </span>
                              )}
                              {sess.audioLogs && sess.audioLogs.length > 0 && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  <Volume2 size={10} /> Audio
                                </span>
                              )}
                              {sess.entitiesExtracted && (
                                <span
                                  className="text-[10px] text-amber-300 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25"
                                  title="Entità compendio estratte con IA"
                                >
                                  <Sparkles size={10} className="text-amber-400" /> Entità IA
                                </span>
                              )}
                              {sess.memorySynced && (
                                <span
                                  className="text-[10px] text-purple-300 flex items-center gap-1 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/25"
                                  title="Memoria PNG e relazioni sincronizzate"
                                >
                                  <Brain size={10} className="text-purple-400" /> Memoria Sync
                                </span>
                              )}
                              {sess.excludedPlayerIds && sess.excludedPlayerIds.length > 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                    player && sess.excludedPlayerIds.includes(player._id)
                                      ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                                      : 'text-content-3 bg-surface-2 border-surface-3'
                                  }`}
                                  title={
                                    player && sess.excludedPlayerIds.includes(player._id)
                                      ? 'Non eri presente a questa sessione'
                                      : `${sess.excludedPlayerIds.length} PG non presenti a questa sessione`
                                  }
                                >
                                  <Users size={10} />
                                  {player && sess.excludedPlayerIds.includes(player._id) ? (
                                    <span>Assente</span>
                                  ) : (
                                    <span>{allPlayers.filter((p) => (!p.isDm || isDmPlayer) && !(sess.excludedPlayerIds || []).includes(p._id)).length} PG</span>
                                  )}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] font-mono text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold shrink-0">
                              <span>Leggi</span>
                              <ChevronRight size={13} />
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-surface-2 bg-surface-1 shrink-0">
              <div className="max-w-7xl mx-auto w-full">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[6, 12, 24]}
                  totalItems={filteredSessions.length}
                  compact
                />
              </div>
            </div>
          </aside>

          {/* Single Session Manuscript Reader View (Consistent Desktop & Mobile) */}
          <section className={`bg-surface-0 flex flex-col min-h-0 overflow-hidden w-full flex-1 ${chronicleView === 'reader' ? 'flex' : 'hidden'}`}>
            {selectedSession ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Reading Toolbar: compact, clean & distraction-free */}
                <div className="px-3 sm:px-5 py-2 border-b border-surface-2 bg-surface-1 flex items-center justify-between gap-2 shrink-0">
                  {/* Left: Return to Index (desktop & mobile) & Session Identifier */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setChronicleView('index');
                      }}
                      className="flex items-center gap-1 text-primary hover:text-primary-hover font-mono text-xs px-2.5 py-1 rounded-[2px] bg-surface-2 border border-surface-2 transition-colors cursor-pointer mr-0.5"
                      title="Torna all'elenco delle sessioni"
                    >
                      <ChevronLeft size={13} />
                      <span>Indice</span>
                    </button>

                    <span className="font-mono text-xs text-primary font-semibold flex items-center gap-1.5 uppercase shrink-0">
                      <BookOpen size={13} />
                      <span>SESS. #{selectedSession.number}</span>
                    </span>

                    {selectedSession.chapterName && (
                      <span className="text-[10px] font-mono text-content-3 px-1.5 py-0.5 rounded-[2px] bg-surface-2 border border-surface-2 truncate hidden sm:inline max-w-[140px]">
                        {selectedSession.chapterName}
                      </span>
                    )}
                  </div>

                  {/* Right: Streamlined Steppers and Actions Menu */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* Previous/Next Session Steppers */}
                    <div className="flex items-center bg-surface-2/60 rounded-[2px] border border-surface-2 p-0.5">
                      <button
                        type="button"
                        onClick={handlePrevSession}
                        disabled={!hasPrevSession}
                        className="p-1 rounded-[2px] text-content-2 disabled:opacity-30 disabled:cursor-not-allowed hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Sessione precedente"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextSession}
                        disabled={!hasNextSession}
                        className="p-1 rounded-[2px] text-content-2 disabled:opacity-30 disabled:cursor-not-allowed hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Sessione successiva"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* AI Entity Extractor Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsExtractModalOpen(true)}
                      className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono rounded-[2px] flex items-center gap-1 border border-amber-500/30 transition-colors cursor-pointer shadow-xs"
                      title="Estrai e cataloga PNG, Luoghi e Mostri nel Codex con IA"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span className="hidden sm:inline">Estrai Entità</span>
                    </button>

                    {/* Actions Trigger Modal Button */}
                    <button
                      type="button"
                      onClick={() => setIsActionsModalOpen(true)}
                      className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-mono rounded-[2px] flex items-center gap-1.5 border border-surface-2 hover:border-primary/40 transition-colors cursor-pointer shadow-xs"
                      title="Azioni, Sincronizzazione ed Extra per questa sessione"
                    >
                      <MoreVertical size={13} className="text-primary" />
                      <span className="font-medium">Azioni</span>
                    </button>
                  </div>
                </div>

                {/* Session Manuscript Continuous Reading View */}
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full mx-auto p-4 sm:p-6 md:p-8 max-w-3xl space-y-6">
                  {/* Session & Chapter Hero Artwork Banner */}
                  {(() => {
                    const currentChapter = selectedSession.chapterId
                      ? chapters.find((c) => c.id === selectedSession.chapterId)
                      : (selectedSession.chapterName ? chapters.find((c) => c.name === selectedSession.chapterName) : activeChapterObj);

                    const sessionCover =
                      (typeof selectedSession.coverImage === 'string' ? selectedSession.coverImage : selectedSession.coverImage?.url) ||
                      (selectedSession.images && selectedSession.images.length > 0 ? selectedSession.images[0] : null);

                    const bannerUrl = sessionCover || currentChapter?.coverImageUrl;
                    if (!bannerUrl) return null;

                    return (
                      <div
                        onClick={() => bannerUrl && setActiveLightboxImg(bannerUrl)}
                        className="relative w-full h-36 sm:h-52 md:h-64 rounded-xl overflow-hidden mb-5 sm:mb-6 border border-surface-2 shadow-lg group cursor-pointer"
                        title="Clicca per ingrandire la copertina"
                      >
                        {bannerUrl && bannerUrl.trim() ? (
                          <img
                            src={bannerUrl}
                            alt={selectedSession.title}
                            className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-surface-2 to-surface-1 flex items-center justify-center text-content-3 font-serif">
                            <span>Nessuna copertina</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-0/90 via-surface-0/30 to-transparent pointer-events-none" />

                        {/* Top action badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="p-1.5 rounded-[2px] bg-black/80 text-white backdrop-blur-md text-[10px] font-mono border border-white/10 flex items-center gap-1">
                            <Maximize2 size={12} />
                            <span>Ingrandisci</span>
                          </span>
                        </div>

                        {/* Bottom Tag Strip */}
                        <div className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 right-2.5 sm:right-4 flex items-center justify-between text-xs font-mono text-white/90 drop-shadow-md pointer-events-none">
                          <div className="flex items-center gap-2">
                            {currentChapter && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 backdrop-blur-xs border border-white/10">
                                <span
                                  className="w-2 h-2 rounded-full shadow-xs"
                                  style={{ backgroundColor: currentChapter.color || '#6366f1' }}
                                />
                                <span className="font-serif font-bold text-xs sm:text-sm tracking-wide text-white">
                                  {currentChapter.name}
                                </span>
                              </span>
                            )}
                            {sessionCover && (
                              <span className="px-2 py-1 rounded bg-primary/80 backdrop-blur-xs text-[10px] font-mono font-semibold text-white">
                                Artwork Sessione
                              </span>
                            )}
                          </div>

                          {currentChapter?.description && (
                            <span className="text-[11px] text-white/80 italic max-w-xs truncate hidden sm:inline drop-shadow">
                              {currentChapter.description}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Title & Metadata Strip */}
                  <div className="space-y-2 pb-4 sm:pb-5 border-b border-surface-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono text-content-3">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Calendar size={13} className="text-primary" />
                        <span>Giocata il: {selectedSession.date}</span>
                      </span>
                      {selectedSession.loreDate && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1.5 text-primary">
                            <Clock size={13} />
                            <span>Lore: {selectedSession.loreDate}</span>
                          </span>
                        </>
                      )}
                      {selectedSession.entitiesExtracted && (
                        <>
                          <span>&bull;</span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[10.5px]"
                            title={
                              selectedSession.entitiesExtractedAt
                                ? `Entità estratte il: ${new Date(selectedSession.entitiesExtractedAt).toLocaleDateString('it-IT')}`
                                : 'Entità estratte nel Compendio'
                            }
                          >
                            <Sparkles size={11} className="text-amber-400" />
                            <span>Entità estratte</span>
                          </span>
                        </>
                      )}
                      {selectedSession.memorySynced && (
                        <>
                          <span>&bull;</span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25 text-[10.5px]"
                            title={
                              selectedSession.memorySyncedAt
                                ? `Memoria sincronizzata il: ${new Date(selectedSession.memorySyncedAt).toLocaleDateString('it-IT')}`
                                : 'Memoria PNG sincronizzata'
                            }
                          >
                            <Brain size={11} className="text-purple-400" />
                            <span>Memoria sincronizzata</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="font-serif font-bold text-lg sm:text-2xl text-content-1 tracking-tight">
                      <EntityMentionText
                        text={selectedSession.title}
                        showMentions={showMentionTags}
                        onEntityClick={setInspectingEntity}
                      />
                    </h2>

                    {/* Exclusion Alert for current player */}
                    {(() => {
                      const excludedSet = new Set(selectedSession.excludedPlayerIds || []);
                      const isCurrentUserExcluded = Boolean(player && !player.isDm && excludedSet.has(player._id));
                      if (!isCurrentUserExcluded) return null;

                      return (
                        <div className="pt-2">
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono flex items-start gap-2">
                            <AlertCircle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-semibold block">Il tuo personaggio non era presente a questa sessione</span>
                              <span className="text-[11px] text-content-3 font-sans">
                                Il tuo eroe non possiede ricordi diretti degli avvenimenti vissuti dal gruppo in questa cronaca. Puoi comunque leggere il diario e sincronizzare la conoscenza se ti verrà raccontata in gioco!
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* SECTION 1: Main Chronicle Text (Recap) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-surface-2/70 pb-2">
                      <span className="text-xs font-mono font-medium text-content-3 uppercase tracking-wider">
                        Diario &amp; Cronaca
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Attendance / Participants Jump Button */}
                        {(() => {
                          const excludedSet = new Set(selectedSession.excludedPlayerIds || []);
                          const partyPool = allPlayers.filter((p) => !p.isDm || isDmPlayer);
                          const activeTotalCount = partyPool.filter((p) => !excludedSet.has(p._id)).length;

                          return (
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById('session-participants-section');
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              className="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 bg-surface-2 text-content-2 border border-surface-3 hover:text-content-1 hover:border-primary/40 transition-all cursor-pointer shadow-xs"
                              title="Vai alla gestione presenze e lista partecipanti della seduta"
                            >
                              <Users size={12} className="text-primary" />
                              <span className="hidden sm:inline">Presenze ({activeTotalCount}/{partyPool.length})</span>
                              <span className="sm:hidden font-bold text-[11px]">{activeTotalCount}</span>
                            </button>
                          );
                        })()}

                        {orphanTagsInCurrentSession.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('chronicle_resolve_orphan_tag', {
                                  detail: { tagName: orphanTagsInCurrentSession[0] },
                                })
                              );
                            }}
                            className="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm"
                            title={`Rilevati ${orphanTagsInCurrentSession.length} tag orfani nel testo: ${orphanTagsInCurrentSession.join(', ')}. Clicca per risolverli.`}
                          >
                            <Link2 size={12} className="text-amber-400" />
                            <span className="hidden sm:inline">
                              {orphanTagsInCurrentSession.length} tag orfan{orphanTagsInCurrentSession.length > 1 ? 'i' : 'o'}
                            </span>
                            <span className="sm:hidden font-bold text-[11px]">{orphanTagsInCurrentSession.length}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleToggleMentionTags}
                          className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${
                            showMentionTags
                              ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                              : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1 hover:border-content-3/40'
                          }`}
                          title={
                            showMentionTags
                              ? 'Disattiva i badge per una lettura continua senza interruzioni visive'
                              : 'Attiva i badge entità interattivi nel testo'
                          }
                        >
                          <Tag size={12} className={showMentionTags ? 'text-primary' : 'text-content-3'} />
                          <span className="hidden sm:inline">{showMentionTags ? 'Tag Entità: ATTIVI' : 'Lettura Pulita'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-content-1 leading-relaxed font-sans text-pretty">
                      {extractTextFromContent(selectedSession.recap) ? (
                        <MarkdownRenderer
                          key={`recap-${selectedSession._id}-${showMentionTags ? 'with-tags' : 'clean'}`}
                          content={extractTextFromContent(selectedSession.recap)}
                          showMentions={showMentionTags}
                          onEntityClick={setInspectingEntity}
                        />
                      ) : (
                        <p className="italic text-content-3 text-xs">Nessuna cronaca registrata per questa sessione.</p>
                      )}
                    </div>
                  </section>

                  {/* SECTION 2: Snodi Narrativi (if present) */}
                  {(() => {
                    const accessibleEvents = (selectedSession.events || []).filter((evt) =>
                      CampaignManager.isSessionEventAccessible(evt, player)
                    );
                    if (accessibleEvents.length === 0) return null;

                    return (
                      <section className="space-y-3 pt-4 border-t border-surface-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif font-bold text-sm sm:text-base text-content-1 flex items-center gap-2">
                            <Sparkles size={14} className="text-primary" />
                            <span>Snodi ed Eventi Chiave ({accessibleEvents.length})</span>
                          </h3>
                        </div>
                        <div className="divide-y divide-surface-2 border border-surface-2 rounded-xl bg-surface-1 overflow-hidden">
                          {accessibleEvents.map((evt, evtIdx) => (
                            <div
                              key={evt.id || `session_evt_${evtIdx}`}
                              className={`p-3.5 space-y-1.5 ${
                                evt.impact === 'major' ? 'border-l-2 border-primary bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-serif font-semibold text-xs sm:text-sm text-content-1">
                                  <EntityMentionText text={evt.title} onEntityClick={setInspectingEntity} />
                                </h4>
                                <div className="flex items-center gap-2 font-mono text-[10px]">
                                  {evt.impact === 'major' && (
                                    <span className="px-1.5 py-0.5 rounded-[2px] font-semibold text-primary bg-primary/10">
                                      [CRUCIALE]
                                    </span>
                                  )}
                                  {evt.impact === 'secret' && (
                                    <span className="px-1.5 py-0.5 rounded-[2px] font-semibold text-purple-400 bg-purple-500/10 flex items-center gap-1">
                                      <ShieldAlert size={10} /> [SEGRETO DM]
                                    </span>
                                  )}
                                </div>
                              </div>
                              {evt.description && (
                                <p className="text-xs text-content-2 leading-relaxed font-sans">
                                  <EntityMentionText text={evt.description} onEntityClick={setInspectingEntity} />
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-content-3 font-mono">
                                {evt.loreDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} className="text-primary" /> {evt.loreDate}
                                  </span>
                                )}
                                {evt.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={11} className="text-emerald-400" /> {evt.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}

                  {/* SECTION 3: Mappe & Illustrazioni (if present) */}
                  {selectedSession.images && selectedSession.images.length > 0 && (
                    <section className="space-y-3 pt-4 border-t border-surface-2">
                      <h3 className="font-serif font-bold text-sm sm:text-base text-content-1 flex items-center gap-2">
                        <ImageIcon size={14} className="text-primary" />
                        <span>Mappe &amp; Illustrazioni ({selectedSession.images.length})</span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedSession.images.filter((img) => img && typeof img === 'string' && img.trim()).map((img, idx) => (
                          <div
                            key={idx}
                            onClick={() => setActiveLightboxImg(img)}
                            className="aspect-video rounded-lg overflow-hidden cursor-pointer bg-surface-1 border border-surface-2 relative group"
                          >
                            <img
                              src={img}
                              alt="Illustrazione di sessione"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* SECTION 4: Audio Logs (if present) */}
                  {selectedSession.audioLogs && selectedSession.audioLogs.length > 0 && (
                    <section className="space-y-3 pt-4 border-t border-surface-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif font-bold text-sm sm:text-base text-content-1 flex items-center gap-2">
                          <Volume2 size={14} className="text-primary" />
                          <span>Diario Vocale &amp; Registrazioni ({selectedSession.audioLogs.length})</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsAudioRecorderOpen(true)}
                          className="text-xs font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Mic size={12} />
                          <span>+ NUOVA REGISTRAZIONE</span>
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {selectedSession.audioLogs.map((log) => (
                          <AudioPlayer
                            key={log.id}
                            log={log}
                            onDelete={() => {
                              const updated = (selectedSession.audioLogs || []).filter((l) => l.id !== log.id);
                              CampaignManager.updateSession(selectedSession._id, { audioLogs: updated });
                              setSelectedSession({ ...selectedSession, audioLogs: updated });
                              refreshSessions();
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* SECTION 5: Partecipanti alla Seduta */}
                  {allPlayers && allPlayers.length > 0 && (() => {
                    const excludedSet = new Set(selectedSession.excludedPlayerIds || []);
                    const partyPool = allPlayers.filter((p) => !p.isDm || isDmPlayer);
                    const activeTotalCount = partyPool.filter((p) => !excludedSet.has(p._id)).length;

                    return (
                      <section id="session-participants-section" className="space-y-3 pt-4 border-t border-surface-2 scroll-mt-6">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-serif font-bold text-sm sm:text-base text-content-1 flex items-center gap-2">
                            <Users size={15} className="text-primary" />
                            <span>Partecipanti alla Seduta ({activeTotalCount}/{partyPool.length} Attivi)</span>
                          </h3>

                          {isMaster && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditing(true);
                                setIsModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-primary text-xs font-mono rounded border border-surface-3 flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Modifica presenze ed esclusioni per questa sessione"
                            >
                              <Edit3 size={12} />
                              <span className="hidden sm:inline">Modifica Presenze</span>
                            </button>
                          )}
                        </div>

                        <div className="divide-y divide-surface-2 border border-surface-2 rounded-xl bg-surface-1 overflow-hidden">
                          {partyPool.map((p) => {
                            const isExcluded = excludedSet.has(p._id);

                            return (
                              <div
                                key={p._id}
                                className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                                  isExcluded ? 'bg-surface-2/20' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 border border-surface-2 ${
                                      isExcluded ? 'grayscale opacity-50' : ''
                                    }`}
                                    style={{ backgroundColor: p.color || '#6366f1' }}
                                  >
                                    {p.avatarUrl && p.avatarUrl.trim() ? (
                                      <img src={p.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                      p.characterName?.charAt(0).toUpperCase() || 'P'
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className={`font-serif font-semibold text-xs text-content-1 truncate ${isExcluded ? 'line-through text-content-3' : ''}`}>
                                        {p.characterName}
                                      </h5>
                                      {isExcluded ? (
                                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/25 text-[10px] font-mono flex items-center gap-1">
                                          <span>🚫</span>
                                          <span className="hidden sm:inline">Non Presente (Escluso)</span>
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[10px] font-mono flex items-center gap-1">
                                          <span>✅</span>
                                          <span className="hidden sm:inline">Presente</span>
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-content-3 font-mono uppercase truncate">
                                      {p.isDm ? 'DM / Giocatore' : 'Personaggio Giocante'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isMaster && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSessionParticipant(p._id)}
                                      className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer border ${
                                        isExcluded
                                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                          : 'bg-surface-2 hover:bg-rose-500/15 text-content-3 hover:text-rose-300 border-surface-3 hover:border-rose-500/30'
                                      }`}
                                      title={
                                        isExcluded
                                          ? `Segna ${p.characterName} come presente in questa sessione`
                                          : `Escludi ${p.characterName} dalla partecipazione a questa sessione`
                                      }
                                    >
                                      {isExcluded ? (
                                        <>
                                          <UserCheck size={12} />
                                          <span className="hidden sm:inline">Includi</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserMinus size={12} />
                                          <span className="hidden sm:inline">Escludi</span>
                                        </>
                                      )}
                                    </button>
                                  )}

                                  {p.isDm && (
                                    <span className="text-[10px] font-mono text-primary font-semibold hidden sm:inline">[DM]</span>
                                  )}
                                  <Link
                                    to={`/profile?player=${p._id}`}
                                    className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-xs font-mono rounded border border-surface-2 flex items-center gap-1 transition-colors"
                                    title={`Visualizza il profilo dossier di ${p.characterName}`}
                                  >
                                    <User size={12} className="sm:hidden text-content-3" />
                                    <span className="hidden sm:inline">Profilo</span>
                                    <ChevronRight size={12} />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}
                  {/* Session Prev/Next Bottom Stepper */}
                  <div className="pt-6 pb-6 border-t border-surface-2 flex items-center justify-between gap-3 text-xs font-mono">
                    <button
                      type="button"
                      onClick={handlePrevSession}
                      disabled={!hasPrevSession}
                      className="px-3 py-1.5 rounded-[2px] bg-surface-1 border border-surface-2 text-content-2 hover:text-content-1 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={13} />
                      <span className="hidden sm:inline">Sessione Precedente</span>
                      <span className="sm:hidden">Precedente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChronicleView('index');
                      }}
                      className="px-3 py-1.5 rounded-[2px] bg-surface-1 border border-surface-2 text-primary hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Scroll size={13} />
                      <span>Torna all'Indice</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextSession}
                      disabled={!hasNextSession}
                      className="px-3 py-1.5 rounded-[2px] bg-surface-1 border border-surface-2 text-content-2 hover:text-content-1 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="hidden sm:inline">Sessione Successiva</span>
                      <span className="sm:hidden">Successiva</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-content-3 space-y-3">
                <BookOpen size={36} className="text-primary opacity-30" />
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-base text-content-1">
                    Tomo delle Sessioni
                  </h3>
                  <p className="text-xs text-content-3 max-w-sm">
                    Seleziona una cronaca dal registro a sinistra per leggerne la trascrizione completa, gli snodi narrativi e i file multimediali.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChronicleView('index')}
                  className="mt-2 px-3.5 py-1.5 rounded-[2px] bg-primary text-surface-0 text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Scroll size={13} />
                  <span>Apri Indice Cronache</span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Main Tab 2: Snodi Narrativi & Registro Timeline Eventi */}
      {mainTab === 'events' && (
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 max-w-5xl w-full mx-auto space-y-6">
          <div className="border-b border-surface-2 pb-4">
            <h2 className="font-serif font-bold text-lg text-content-1">
              Registro di Tutti gli Snodi ed Eventi di Campagna
            </h2>
            <p className="text-xs text-content-3 font-mono">
              Eventi cruciali, snodi di trama e segreti estratti dalle sessioni di gioco
            </p>
          </div>

          {sessions.flatMap((s) => (s.events || []).map((e, idx) => ({ ...e, sessionNumber: s.number, sessionTitle: s.title, uniqueKey: `${s._id}_${e.id || idx}` }))).length === 0 ? (
            <div className="p-12 border border-surface-2 rounded-[2px] bg-surface-1 text-center text-content-3 space-y-2">
              <p className="text-xs">Nessuno snodo narrativo registrato nelle sessioni.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-2 border border-surface-2 rounded-[2px] bg-surface-1">
              {sessions.flatMap((s) => (s.events || []).map((e, idx) => ({ ...e, sessionNumber: s.number, sessionTitle: s.title, uniqueKey: `${s._id}_${e.id || idx}` }))).map((evt) => (
                <div key={evt.uniqueKey} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-primary font-semibold">
                        [SESS. #{evt.sessionNumber}]
                      </span>
                      <h4 className="font-serif font-semibold text-sm text-content-1">
                        <EntityMentionText text={evt.title} onEntityClick={setInspectingEntity} />
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {evt.impact === 'major' && (
                        <span className="px-1.5 py-0.5 rounded-[2px] font-semibold text-primary bg-primary/10">
                          [CRUCIALE]
                        </span>
                      )}
                      {evt.impact === 'secret' && (
                        <span className="px-1.5 py-0.5 rounded-[2px] font-semibold text-purple-400 bg-purple-500/10 flex items-center gap-1">
                          <ShieldAlert size={10} /> [SEGRETO DM]
                        </span>
                      )}
                    </div>
                  </div>
                  {evt.description && (
                    <p className="text-xs text-content-2 leading-relaxed font-sans">
                      <EntityMentionText text={evt.description} onEntityClick={setInspectingEntity} />
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-content-3 font-mono">
                    {evt.loreDate && <span>LORE: {evt.loreDate}</span>}
                    {evt.location && <span>LUOGO: {evt.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Main Tab 3: Archi Narrativi & Capitoli (Vista Entry Tomi) */}
      {mainTab === 'chapters' && (
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 max-w-7xl w-full mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-5">
            <div className="space-y-1">
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-content-1 flex items-center gap-2.5 tracking-tight">
                <BookMarked size={28} className="text-primary" />
                <span>Tomo delle Sessioni &amp; Capitoli Narrativi</span>
              </h1>
              <p className="text-xs sm:text-sm text-content-3 font-mono">
                Seleziona un capitolo per accedere direttamente alla trascrizione della cronaca di gioco.
              </p>
            </div>
            {player?.isDm && (
              <button
                type="button"
                onClick={() => {
                  setEditingChapter(null);
                  setNewChapName('');
                  setNewChapDesc('');
                  setNewChapColor('#6366f1');
                  setNewChapCoverUrl('');
                  setIsChapterModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-[2px] bg-primary text-surface-0 hover:bg-primary-hover text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md self-start sm:self-auto hover:shadow-lg shrink-0"
              >
                <FolderPlus size={16} />
                <span>+ Nuovo Capitolo</span>
              </button>
            )}
          </div>

          {chapters.length === 0 ? (
            <div className="p-16 border border-surface-2 rounded-2xl bg-surface-1 text-center text-content-3 space-y-4 shadow-sm">
              <Bookmark size={48} className="mx-auto text-primary opacity-30" />
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-serif font-bold text-content-1">Nessun capitolo creato finora</h3>
                <p className="text-xs text-content-3">
                  {player?.isDm
                    ? 'Crea il tuo primo capitolo per organizzare le sessioni di gioco e associare splendide immagini di copertina.'
                    : 'Il Dungeon Master non ha ancora strutturato i capitoli narrativi per questa campagna.'}
                </p>
              </div>
              {player?.isDm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingChapter(null);
                    setNewChapName('');
                    setNewChapDesc('');
                    setNewChapColor('#6366f1');
                    setNewChapCoverUrl('');
                    setIsChapterModalOpen(true);
                  }}
                  className="mt-2 px-5 py-2.5 bg-primary text-surface-0 text-xs font-mono rounded-[2px] cursor-pointer inline-flex items-center gap-2 shadow-sm font-semibold"
                >
                  <FolderPlus size={15} />
                  <span>Crea Primo Capitolo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
              {chapters.map((chap) => {
                const chapSessions = sessions.filter(
                  (s) => s.chapterId === chap.id || s.chapterName === chap.name
                );
                const sessionCount = chapSessions.length;

                return (
                  <article
                    key={chap.id}
                    onClick={() => handleSelectChapterFromCard(chap)}
                    className="group relative bg-surface-1 border border-surface-2 hover:border-primary/80 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 flex flex-col cursor-pointer"
                  >
                    {/* Large Book Tome Cover Artwork (Aspect Ratio 2/3) */}
                    <div className="relative aspect-[2/3] w-full bg-surface-2 overflow-hidden shrink-0 shadow-inner">
                      {chap.coverImageUrl && chap.coverImageUrl.trim() ? (
                        <img
                          src={chap.coverImageUrl}
                          alt={chap.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-b from-surface-2 to-surface-1 flex flex-col items-center justify-center p-8 text-center relative">
                          <BookOpen size={52} className="text-content-3 opacity-30 mb-3" />
                          <span className="text-xs font-mono text-content-3 font-semibold uppercase tracking-wider">Nessuna Copertina</span>
                          {player?.isDm && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCoverChapter(chap);
                              }}
                              className="text-xs font-mono text-primary hover:underline mt-3 flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              <ImageIcon size={14} /> + Imposta Copertina
                            </span>
                          )}
                        </div>
                      )}

                      {/* Top Bar Badges & Actions Overlay */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                        <span className="px-3 py-1.5 rounded-[2px] text-[11px] font-mono font-bold tracking-wider text-white shadow-md flex items-center gap-2 backdrop-blur-md bg-black/80 border border-white/10">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs"
                            style={{ backgroundColor: chap.color || '#6366f1' }}
                          />
                          <span>{sessionCount} {sessionCount === 1 ? 'SESSIONE' : 'SESSIONI'}</span>
                        </span>

                        {player?.isDm && (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setEditingCoverChapter(chap)}
                              className="p-2 rounded-[2px] bg-black/80 hover:bg-black text-white/90 hover:text-white backdrop-blur-md transition-colors cursor-pointer border border-white/10 shadow-sm"
                              title="Modifica copertina capitolo"
                            >
                              <ImageIcon size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingChapter(chap);
                                setNewChapName(chap.name);
                                setNewChapDesc(chap.description || '');
                                setNewChapColor(chap.color || '#6366f1');
                                setNewChapCoverUrl(chap.coverImageUrl || '');
                                setIsChapterModalOpen(true);
                              }}
                              className="p-2 rounded-[2px] bg-black/80 hover:bg-black text-white/90 hover:text-white backdrop-blur-md transition-colors cursor-pointer border border-white/10 shadow-sm"
                              title="Modifica dettagli capitolo"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setChapterToDelete(chap.id)}
                              className="p-2 rounded-[2px] bg-black/80 hover:bg-black text-white/90 hover:text-rose-400 backdrop-blur-md transition-colors cursor-pointer border border-white/10 shadow-sm"
                              title="Elimina capitolo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book Tome Title & Information Bar */}
                    <div className="p-5 bg-surface-1 border-t border-surface-2 flex items-center justify-between gap-3 flex-1">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 mt-1 shadow-xs"
                          style={{ backgroundColor: chap.color || '#6366f1' }}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif font-bold text-base sm:text-lg text-content-1 group-hover:text-primary transition-colors leading-snug truncate">
                            {chap.name}
                          </h3>
                          {chap.description && (
                            <p className="text-xs text-content-3 line-clamp-2 font-sans mt-1 leading-relaxed">
                              {chap.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="p-2 rounded-full bg-surface-2 group-hover:bg-primary group-hover:text-surface-0 text-content-3 transition-colors shrink-0">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* Main Tab 4: Compagnia & Partecipanti */}
      {mainTab === 'party' && (
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 max-w-5xl w-full mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-4">
            <div>
              <h2 className="font-serif font-bold text-lg text-content-1">
                Ruolino della Compagnia
              </h2>
              <p className="text-xs text-content-3 font-mono">
                Partecipanti, Dungeon Master e stato dei Personaggi Giocanti al tavolo
              </p>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPartyStatusFilter('all')}
                className={`px-3 py-1 text-xs font-mono rounded-[2px] transition-colors cursor-pointer border ${
                  partyStatusFilter === 'all'
                    ? 'bg-surface-3 text-content-1 border-primary/40'
                    : 'bg-surface-1 text-content-3 border-surface-2 hover:text-content-2'
                }`}
              >
                Tutti ({partyCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setPartyStatusFilter('active')}
                className={`px-3 py-1 text-xs font-mono rounded-[2px] transition-colors cursor-pointer border ${
                  partyStatusFilter === 'active'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-surface-1 text-content-3 border-surface-2 hover:text-emerald-400'
                }`}
              >
                🟢 Attivi ({partyCounts.active})
              </button>
              <button
                type="button"
                onClick={() => setPartyStatusFilter('inactive')}
                className={`px-3 py-1 text-xs font-mono rounded-[2px] transition-colors cursor-pointer border ${
                  partyStatusFilter === 'inactive'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-surface-1 text-content-3 border-surface-2 hover:text-amber-400'
                }`}
              >
                🟡 Fuori Uso ({partyCounts.inactive})
              </button>
              <button
                type="button"
                onClick={() => setPartyStatusFilter('retired')}
                className={`px-3 py-1 text-xs font-mono rounded-[2px] transition-colors cursor-pointer border ${
                  partyStatusFilter === 'retired'
                    ? 'bg-surface-3 text-content-1 border-surface-3'
                    : 'bg-surface-1 text-content-3 border-surface-2 hover:text-content-2'
                }`}
              >
                ⚪ Ritirati ({partyCounts.retired})
              </button>
              {partyCounts.dead > 0 && (
                <button
                  type="button"
                  onClick={() => setPartyStatusFilter('dead')}
                  className={`px-3 py-1 text-xs font-mono rounded-[2px] transition-colors cursor-pointer border ${
                    partyStatusFilter === 'dead'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                      : 'bg-surface-1 text-content-3 border-surface-2 hover:text-rose-400'
                  }`}
                >
                  💀 Caduti ({partyCounts.dead})
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-surface-2 border border-surface-2 rounded-[2px] bg-surface-1">
            {filteredPartyPlayers.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-content-3">
                Nessun avventuriero corrisponde al filtro selezionato.
              </div>
            ) : (
              filteredPartyPlayers.map((p) => {
                const isCurrent = p._id === player?._id;
                const canManage = Boolean(player?.isDm);
                const status = p.status || 'active';

                return (
                  <div
                    key={p._id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isCurrent ? 'bg-surface-2/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-[2px] flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 border border-surface-2 shadow-sm"
                        style={{ backgroundColor: p.color || '#6366f1' }}
                      >
                        {p.avatarUrl && p.avatarUrl.trim() ? (
                          <img
                            src={p.avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          p.characterName?.charAt(0).toUpperCase() || 'P'
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-serif font-semibold text-sm text-content-1 truncate">
                            {p.characterName}
                          </h4>
                          {p.isDm && (
                            <span className="px-1.5 py-0.2 text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 rounded flex items-center gap-1">
                              <Crown size={10} /> DM
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 text-[10px] font-mono text-content-2 bg-surface-3 rounded">
                              Tu
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-content-3 font-mono">
                          {p.isDm ? 'Dungeon Master' : 'Personaggio Giocante'}
                          {p.email && ` • ${p.email}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                      {/* Status Badges */}
                      {p.isDm ? (
                        <span className="font-mono text-[11px] text-primary font-semibold px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-[2px]">
                          [DM ACCREDITATO]
                        </span>
                      ) : status === 'active' ? (
                        <span className="font-mono text-[11px] text-emerald-400 font-semibold px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-[2px]">
                          [AVVENTURIERO ATTIVO]
                        </span>
                      ) : status === 'inactive' ? (
                        <span className="font-mono text-[11px] text-amber-400 font-semibold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-[2px]">
                          [FUORI USO / INATTIVO]
                        </span>
                      ) : status === 'retired' ? (
                        <span className="font-mono text-[11px] text-content-3 px-2.5 py-1 bg-surface-3 border border-surface-3 rounded-[2px]">
                          [RITIRATO]
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-rose-400 font-semibold px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-[2px]">
                          [CADUTO IN BATTAGLIA]
                        </span>
                      )}

                      {/* Status Quick Selector (For DM or User on self) */}
                      {(canManage || isCurrent) && (
                        <select
                          value={status}
                          onChange={(e) =>
                            handlePlayerStatusChange(
                              p._id,
                              e.target.value as PlayerPartyStatus
                            )
                          }
                          className="bg-surface-2 border border-surface-3 text-content-2 text-xs rounded-[2px] px-2.5 py-1 focus:outline-none focus:border-primary cursor-pointer font-mono"
                          title="Modifica stato nel party"
                        >
                          <option value="active">🟢 Attivo</option>
                          <option value="inactive">🟡 Fuori Uso</option>
                          <option value="retired">⚪ Ritirato</option>
                          <option value="dead">💀 Caduto</option>
                        </select>
                      )}

                      {/* Remove from Party Button (Master only, not self) */}
                      {canManage && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => setPlayerToRemove(p)}
                          className="p-1.5 text-content-3 hover:text-rose-400 hover:bg-rose-950/20 rounded border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                          title={`Rimuovi ${p.characterName} dalla compagnia`}
                        >
                          <UserMinus size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      )}

      {/* CREATE / EDIT SESSION MODAL */}
      <SessionModal
        isOpen={isModalOpen}
        isEditing={isEditing}
        initialSession={isEditing ? selectedSession : null}
        existingSessions={sessions}
        chapters={chapters}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSessionData}
      />

      {/* GAZETTE MODAL */}
      {isGazetteOpen && selectedSession && (
        <GazetteModal
          session={selectedSession}
          onClose={() => setIsGazetteOpen(false)}
          onSaved={(updated) => {
            setSelectedSession(updated);
            refreshSessions();
          }}
        />
      )}

      {/* AUDIO RECORDER MODAL */}
      {isAudioRecorderOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-surface-0/80 backdrop-blur-sm">
          <AudioRecorder
            associatedType="session"
            associatedId={selectedSession._id}
            loreDate={selectedSession.loreDate}
            defaultTitle={`Nota Vocale #${selectedSession.number}: ${selectedSession.title}`}
            onCancel={() => setIsAudioRecorderOpen(false)}
            onSave={(newLog) => {
              const fullLog = {
                ...newLog,
                id: 'aud_' + Date.now(),
                createdAt: new Date().toISOString(),
              };
              const currentLogs = selectedSession.audioLogs || [];
              const updatedLogs = [...currentLogs, fullLog];
              CampaignManager.updateSession(selectedSession._id, { audioLogs: updatedLogs });
              setSelectedSession({ ...selectedSession, audioLogs: updatedLogs });
              setIsAudioRecorderOpen(false);
              refreshSessions();
            }}
          />
        </div>
      )}

      {/* CHAPTER MANAGER & EDITOR MODAL */}
      {isChapterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-surface-0/80 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-surface-2 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-2 p-5">
              <div className="flex items-center gap-2.5">
                <Bookmark className="text-primary" size={18} />
                <h3 className="font-heading font-semibold text-base sm:text-lg text-content-1">
                  {editingChapter ? 'Modifica Capitolo' : 'Archi Narrativi & Capitoli'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChapterModalOpen(false);
                  setEditingChapter(null);
                }}
                className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
              <form onSubmit={handleCreateOrUpdateChapter} className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-content-1 flex items-center gap-1.5 text-sm">
                    <FolderPlus size={15} className="text-primary" />
                    <span>{editingChapter ? `Modifica "${editingChapter.name}"` : 'Nuovo Capitolo'}</span>
                  </h4>
                  {editingChapter && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChapter(null);
                        setNewChapName('');
                        setNewChapDesc('');
                        setNewChapColor('#6366f1');
                        setNewChapCoverUrl('');
                      }}
                      className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      + Annulla modifica &amp; crea nuovo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-content-2 mb-1">
                      Nome Capitolo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es. Atto II: L'Assedio di Baldur's Gate..."
                      value={newChapName}
                      onChange={(e) => setNewChapName(e.target.value)}
                      className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none font-sans"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-content-2 mb-1">
                      Colore Distintivo
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newChapColor}
                        onChange={(e) => setNewChapColor(e.target.value)}
                        className="w-8 h-8 rounded border border-surface-3 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-content-3">{newChapColor}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">
                    Descrizione Breve
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Dall'arrivo alla cittadella fino alla caduta del tiranno..."
                    value={newChapDesc}
                    onChange={(e) => setNewChapDesc(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none font-sans"
                  />
                </div>

                <div>
                  <SingleImageUploader
                    value={newChapCoverUrl}
                    onChange={(url) => setNewChapCoverUrl(url)}
                    label="Immagine di Copertina Capitolo"
                    placeholder="https://images.unsplash.com/... o seleziona immagine"
                    aspectRatio="video"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-3/50">
                  {editingChapter && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChapter(null);
                        setNewChapName('');
                        setNewChapDesc('');
                        setNewChapColor('#6366f1');
                        setNewChapCoverUrl('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-surface-2 text-content-3 hover:text-content-1 text-xs font-medium cursor-pointer"
                    >
                      Annulla
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-primary text-surface-0 hover:bg-primary-hover font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{editingChapter ? 'Salva Modifiche Capitolo' : 'Aggiungi Capitolo'}</span>
                  </button>
                </div>
              </form>

              {/* List of Existing Chapters */}
              <div className="space-y-3">
                <h4 className="font-semibold text-content-3 uppercase tracking-wider text-[11px] font-mono">
                  Capitoli Registrati ({chapters.length})
                </h4>
                {chapters.length === 0 ? (
                  <p className="text-content-3 italic">Nessun capitolo creato finora.</p>
                ) : (
                  <div className="space-y-2">
                    {chapters.map((chap) => {
                      const sessionCount = sessions.filter((s) => s.chapterId === chap.id || s.chapterName === chap.name).length;
                      return (
                        <div
                          key={chap.id}
                          className="bg-surface-2/40 border border-surface-3 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {chap.coverImageUrl && chap.coverImageUrl.trim() ? (
                              <img
                                src={chap.coverImageUrl}
                                alt={chap.name}
                                className="w-10 h-10 rounded-lg object-cover shrink-0 border border-surface-3"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: chap.color || '#6366f1' }}
                              />
                            )}
                            <div className="min-w-0">
                              <h5 className="font-semibold text-content-1 truncate">
                                {chap.name}
                              </h5>
                              {chap.description && (
                                <p className="text-content-3 truncate text-[11px]">
                                  {chap.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                            <span className="text-content-3 bg-surface-3 px-2 py-0.5 rounded text-[10px]">
                              {sessionCount} sess.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingChapter(chap);
                                setNewChapName(chap.name);
                                setNewChapDesc(chap.description || '');
                                setNewChapColor(chap.color || '#6366f1');
                                setNewChapCoverUrl(chap.coverImageUrl || '');
                              }}
                              className="text-content-3 hover:text-content-1 p-1 rounded hover:bg-surface-3 transition-colors cursor-pointer"
                              title="Modifica capitolo"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setChapterToDelete(chap.id)}
                              className="text-content-3 hover:text-rose-400 p-1 rounded hover:bg-surface-3 transition-colors cursor-pointer"
                              title="Elimina capitolo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CHAPTER COVER MODAL */}
      {editingCoverChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-surface-0/80 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-2xl max-w-lg w-full flex flex-col border border-surface-2 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-2 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <ImageIcon className="text-primary" size={18} />
                <h3 className="font-heading font-semibold text-base text-content-1">
                  Immagine di Copertina: {editingCoverChapter.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCoverChapter(null)}
                className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-content-3">
                Seleziona o carica una copertina visiva per il capitolo "{editingCoverChapter.name}". L'immagine verrà mostrata nell'anteprima capitoli e nell'intestazione delle sessioni appartenenti ad esso.
              </p>

              <SingleImageUploader
                value={editingCoverChapter.coverImageUrl || ''}
                onChange={(url) => handleSaveChapterCover(editingCoverChapter.id, url)}
                label="Copertina Capitolo"
                aspectRatio="video"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setEditingCoverChapter(null)}
                  className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 text-xs font-mono transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Actions Modal (Clutter-free mobile & desktop action hub) */}
      {isActionsModalOpen && selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsActionsModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-surface-1 border-t sm:border border-surface-3 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-surface-2 bg-surface-1 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 rounded-[2px] bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <BookOpen size={14} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-sm text-content-1 truncate">
                    Azioni Sessione #{selectedSession.number}
                  </h3>
                  <p className="text-[10px] font-mono text-content-3 truncate">
                    {selectedSession.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActionsModalOpen(false)}
                className="p-1 text-content-3 hover:text-content-1 rounded hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Actions List */}
            <div className="p-3 sm:p-4 space-y-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Sincronizza Memoria & Relazioni PNG */}
              <button
                type="button"
                onClick={() => {
                  setIsActionsModalOpen(false);
                  setIsMemorySyncModalOpen(true);
                }}
                className="w-full text-left p-3 rounded-[2px] bg-surface-2/50 hover:bg-primary/10 border border-surface-2 hover:border-primary/40 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-[2px] bg-primary/15 text-primary border border-primary/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Brain size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>Sincronizza Memoria & Relazioni</span>
                    </div>
                    <div className="text-[11px] text-content-3 leading-tight">
                      Aggiorna sentimenti, segreti e conoscenze PNG
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase text-primary bg-primary/15 px-1.5 py-0.5 rounded border border-primary/30 shrink-0">
                  AI Lore
                </span>
              </button>

              {/* Estrai Entità AI (se abilitato) */}
              {features.enableAiExtractor && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsModalOpen(false);
                    setIsExtractModalOpen(true);
                  }}
                  className="w-full text-left p-3 rounded-[2px] bg-surface-2/50 hover:bg-primary/10 border border-surface-2 hover:border-primary/40 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-[2px] bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors">
                        Estrai Entità con IA
                      </div>
                      <div className="text-[11px] text-content-3 leading-tight">
                        Rileva e cataloga PNG, luoghi e artefatti citati
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                    Scanner
                  </span>
                </button>
              )}

              {/* Gazzetta Stampabile */}
              <button
                type="button"
                onClick={() => {
                  setIsActionsModalOpen(false);
                  setIsGazetteOpen(true);
                }}
                className="w-full text-left p-3 rounded-[2px] bg-surface-2/50 hover:bg-surface-2 border border-surface-2 hover:border-surface-3 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-[2px] bg-surface-3 text-content-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Feather size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors">
                      Genera Gazzetta del Regno
                    </div>
                    <div className="text-[11px] text-content-3 leading-tight">
                      Crea un volantino d'epoca o cronaca stampabile
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase text-content-3 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-3 shrink-0">
                  Stampa
                </span>
              </button>

              {/* Note Audio & Registratore */}
              <button
                type="button"
                onClick={() => {
                  setIsActionsModalOpen(false);
                  setIsAudioRecorderOpen(true);
                }}
                className="w-full text-left p-3 rounded-[2px] bg-surface-2/50 hover:bg-surface-2 border border-surface-2 hover:border-surface-3 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-[2px] bg-surface-3 text-content-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Mic size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors">
                      Registratore / Note Vocali
                    </div>
                    <div className="text-[11px] text-content-3 leading-tight">
                      Registra o riascolta audio e appunti vocali del tavolo
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase text-content-3 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-3 shrink-0">
                  Audio
                </span>
              </button>

              {/* Modifica Sessione (Only DM) */}
              {player?.isDm && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsModalOpen(false);
                    handleOpenEditModal(selectedSession);
                  }}
                  className="w-full text-left p-3 rounded-[2px] bg-surface-2/50 hover:bg-surface-2 border border-surface-2 hover:border-surface-3 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-[2px] bg-surface-3 text-content-2 shrink-0 group-hover:scale-105 transition-transform">
                      <Edit3 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors">
                        Modifica Cronaca & Dati
                      </div>
                      <div className="text-[11px] text-content-3 leading-tight">
                        Modifica titolo, capitolo, data lore, recap ed eventi
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono uppercase text-content-3 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-3 shrink-0">
                    Editor
                  </span>
                </button>
              )}

              {/* Separatore per Elimina (Only DM) */}
              {player?.isDm && (
                <div className="pt-1 border-t border-surface-2/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsModalOpen(false);
                      setSessionToDelete(selectedSession._id);
                    }}
                    className="w-full text-left p-2.5 rounded-[2px] bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-[2px] bg-rose-500/10 text-rose-400 shrink-0">
                        <Trash2 size={14} />
                      </div>
                      <span className="text-xs font-medium text-rose-300">Elimina questa sessione</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Elimina
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Elimina Cronaca di Sessione"
        message="Sei sicuro di voler eliminare definitivamente questa sessione? I dati e gli eventi registrati andranno persi."
        confirmLabel="Elimina"
        onConfirm={confirmDeleteSession}
        onCancel={() => setSessionToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!chapterToDelete}
        title="Elimina Capitolo Narrativo"
        message="Sei sicuro di voler eliminare questo capitolo? Le sessioni associate rimarranno ma non saranno più raggruppate."
        confirmLabel="Elimina"
        onConfirm={confirmDeleteChapter}
        onCancel={() => setChapterToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!playerToRemove}
        title="Rimuovi Partecipante dalla Compagnia"
        message={`Sei sicuro di voler rimuovere "${playerToRemove?.characterName}" da questa campagna? Il giocatore perderà l'accesso al tavolo fino a nuovo invito.`}
        confirmLabel="Rimuovi Partecipante"
        onConfirm={handleConfirmRemovePlayer}
        onCancel={() => setPlayerToRemove(null)}
      />

      {/* Entity Inspection Modal directly within Session */}
      <EntityDetailModal
        entity={inspectingEntity}
        isOpen={!!inspectingEntity}
        onClose={() => setInspectingEntity(null)}
        sourceContextTitle={selectedSession ? `Sessione #${selectedSession.number}: ${selectedSession.title}` : undefined}
      />

      {/* Player Tags Management Modal (DM Only) */}
      <PlayerTagsModal
        isOpen={!!managingTagsPlayer}
        player={managingTagsPlayer}
        campaignCode={activeCampaignCode}
        onClose={() => setManagingTagsPlayer(null)}
        onTagsSaved={() => {
          refreshAccount();
          setManagingTagsPlayer(null);
        }}
      />

      {/* Session Memory & World Evolution Sync Modal */}
      <SessionMemorySyncModal
        isOpen={isMemorySyncModalOpen}
        onClose={() => setIsMemorySyncModalOpen(false)}
        session={selectedSession}
        onApplied={() => {
          const updated = CampaignManager.getSessions();
          setSessions(updated);
          if (selectedSession) {
            const found = updated.find((s) => s._id === selectedSession._id);
            if (found) setSelectedSession(found);
          }
          refreshAccount();
        }}
      />

      {/* AI Entity Extractor Modal */}
      {selectedSession && (
        <EntityExtractionModal
          key={selectedSession._id}
          isOpen={isExtractModalOpen}
          onClose={() => setIsExtractModalOpen(false)}
          rawText={
            extractTextFromContent(selectedSession.recap) ||
            (selectedSession.events && selectedSession.events.length > 0
              ? selectedSession.events.map((e) => `${e.title}: ${e.description}`).join('\n')
              : selectedSession.title)
          }
          onApplied={(newEntitiesCreated, updatedTextWithMentions) => {
            if (selectedSession) {
              const updatedRecap = updatedTextWithMentions
                ? [
                    {
                      _type: 'block',
                      children: [{ _type: 'span', text: updatedTextWithMentions }],
                    },
                  ]
                : selectedSession.recap;

              const updated = CampaignManager.updateSession(selectedSession._id, {
                entitiesExtracted: true,
                entitiesExtractedAt: new Date().toISOString(),
                ...(updatedTextWithMentions ? { recap: updatedRecap } : {}),
              });
              if (updated) {
                setSelectedSession(updated);
              }
            }
            refreshSessions();
          }}
        />
      )}
    </div>
  );
}
