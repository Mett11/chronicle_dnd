import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { Note, Entity, Category, ScrapbookItem, DmResponse, CharacterBio, CharacterRelationship, EntityPartyRelation } from '../types';
import { SingleImageUploader } from '../components/SingleImageUploader';
import { ConfirmModal } from '../components/ConfirmModal';
import { OcrButton } from '../components/OcrButton';
import { NoteModal } from '../components/NoteModal';
import { QuestModal } from '../components/QuestModal';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { LoreDateInput } from '../components/LoreDateInput';
import { Portal } from '../components/Portal';
import { CharacterBackgroundTab } from '../components/character/CharacterBackgroundTab';
import { CharacterFamilyTreeTab } from '../components/character/CharacterFamilyTreeTab';
import { CharacterNotesTab } from '../components/character/CharacterNotesTab';
import { CharacterQuestsTab } from '../components/character/CharacterQuestsTab';
import { CharacterMemoriesTab } from '../components/character/CharacterMemoriesTab';
import { getStoredTheme, ClassTheme } from '../lib/theme';
import {
  User,
  Shield,
  Crown,
  BookOpen,
  Target,
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Lock,
  MessageSquare,
  Send,
  Palette,
  Check,
  X,
  Image as ImageIcon,
  Tag,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Filter,
  Eye,
  EyeOff,
  Pipette,
  GitBranch,
  FileText,
  Sliders,
  Users,
  Brain,
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Indaco Arcano', hex: '#6366f1' },
  { name: 'Blu Cobalto', hex: '#3b82f6' },
  { name: 'Rosso Scarlatto', hex: '#ef4444' },
  { name: 'Verde Smeraldo', hex: '#10b981' },
  { name: 'Viola Ametista', hex: '#8b5cf6' },
  { name: 'Ciano Cristallo', hex: '#06b6d4' },
  { name: 'Oro Regale', hex: '#f59e0b' },
  { name: 'Rosa Mistico', hex: '#ec4899' },
  { name: 'Ambra Fuoco', hex: '#f97316' },
  { name: 'Ardesia Ombra', hex: '#64748b' },
];

type ProfileTab = 'biography' | 'family_tree' | 'notes' | 'quests' | 'dm_questions' | 'memories';
type SearchCategoryFilter = 'all' | 'notes' | 'quests' | 'dm_questions' | 'memories';

interface UnifiedSearchResult {
  id: string;
  categoryType: 'notes' | 'quests' | 'dm_questions' | 'memories';
  title: string;
  subtitle?: string;
  snippet?: string;
  date?: string;
  statusBadge?: string;
  badgeColor?: string;
  imageUrl?: string;
  rawItem: Note | Entity | ScrapbookItem;
}

export function CharacterProfile() {
  const { account, player, allPlayers, updateAccountProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = (searchParams.get('tab') as ProfileTab) || 'biography';
  const playerParam = searchParams.get('player');

  // Resolve target player (can be current user or another party member)
  const targetPlayer = useMemo(() => {
    if (playerParam) {
      const partyList = allPlayers && allPlayers.length > 0 ? allPlayers : CampaignManager.getPlayers();
      const found = partyList.find((p) => p._id === playerParam || p.email === playerParam);
      if (found) return found;
    }
    return player;
  }, [playerParam, allPlayers, player]);

  const isOwnProfile = useMemo(() => {
    if (!targetPlayer) return true;
    if (!player) return false;
    return targetPlayer._id === player._id || (Boolean(targetPlayer.email && player.email) && targetPlayer.email === player.email);
  }, [targetPlayer, player]);

  const [activeTab, setActiveTab] = useState<ProfileTab>(defaultTab);
  const [currentTheme] = useState<ClassTheme>(getStoredTheme);
  const [viewMode, setViewMode] = useState<'edit' | 'read'>('edit');

  // Reset secondary active states when switching target player
  useEffect(() => {
    setSelectedNote(null);
    setSelectedMemory(null);
    setDmReplyText('');
    setIsNoteModalOpen(false);
    setIsQuestModalOpen(false);
    setIsMemoryModalOpen(false);
    setEditingNote(null);
    setEditingQuest(null);
  }, [targetPlayer?._id]);

  // If viewing someone else, always use read view mode
  const effectiveIsOtherPlayerView = !isOwnProfile || viewMode === 'read';

  // Data states
  const [notes, setNotes] = useState<Note[]>([]);
  const [quests, setQuests] = useState<Entity[]>([]);
  const [entities, setEntities] = useState<Entity[]>(() => CampaignManager.getEntities());
  const [scrapbook, setScrapbook] = useState<ScrapbookItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [characterBio, setCharacterBio] = useState<CharacterBio | null>(null);
  const [familyRelationsCount, setFamilyRelationsCount] = useState<number>(0);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Sync entities dynamically
  useEffect(() => {
    const handleEnts = () => setEntities(CampaignManager.getEntities());
    window.addEventListener('chronicle_entities_updated', handleEnts);
    window.addEventListener('chronicle_data_updated', handleEnts);
    return () => {
      window.removeEventListener('chronicle_entities_updated', handleEnts);
      window.removeEventListener('chronicle_data_updated', handleEnts);
    };
  }, []);

  const matchedCodexEntity = useMemo(() => {
    if (!targetPlayer?.characterName) return null;
    const cleanName = targetPlayer.characterName.toLowerCase().trim();
    return (
      entities.find(
        (e) =>
          e.name.toLowerCase().trim() === cleanName ||
          (e.aliases && e.aliases.some((a) => a.toLowerCase().trim() === cleanName))
      ) || null
    );
  }, [entities, targetPlayer?.characterName]);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<SearchCategoryFilter>('all');
  const [searchPage, setSearchPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Modals & Form states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // New Note / Ask DM Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isAskDm, setIsAskDm] = useState(false);

  // New Quest Modal
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Entity | null>(null);

  // New Memory / Scrapbook Modal
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryImage, setMemoryImage] = useState('');
  const [memoryCaption, setMemoryCaption] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<ScrapbookItem['category']>('moment');
  const [memoryLoreDate, setMemoryLoreDate] = useState('');

  // Selected Item Modals / Viewers
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<ScrapbookItem | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [questToDelete, setQuestToDelete] = useState<string | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);

  // DM Reply Input for DM users responding to player question
  const [dmReplyText, setDmReplyText] = useState('');

  const lastReconciledIdRef = useRef<string>('');
  useEffect(() => {
    if (
      targetPlayer?._id &&
      targetPlayer?.characterName &&
      lastReconciledIdRef.current !== targetPlayer._id
    ) {
      lastReconciledIdRef.current = targetPlayer._id;
      CampaignManager.reconcileUnregisteredRelations(targetPlayer._id, targetPlayer.characterName);
    }
  }, [targetPlayer?._id, targetPlayer?.characterName]);

  const loadData = () => {
    if (!targetPlayer) return;
    const allNotes = CampaignManager.getNotes();
    const allEntities = CampaignManager.getEntities();
    const allScrapbook = CampaignManager.getScrapbookItems();
    const allCategories = CampaignManager.getCategories();
    const bio = CampaignManager.getCharacterBio(targetPlayer._id);
    const relations = CampaignManager.getFamilyRelations(targetPlayer._id);

    // Notes filtering based on ownership and DM privileges
    let targetNotes: Note[] = [];
    if (isOwnProfile) {
      targetNotes = allNotes.filter(
        (n) =>
          n.author?._id === targetPlayer._id ||
          n.author?.email === targetPlayer.email ||
          (n.visibility === 'personal' && (n.author?._id === targetPlayer._id || n.author?.email === targetPlayer.email))
      );
    } else if (player?.isDm) {
      // Dungeon Master can see all notes authored by this player, including their askDm questions
      targetNotes = allNotes.filter(
        (n) =>
          n.author?._id === targetPlayer._id ||
          n.author?.email === targetPlayer.email
      );
    } else {
      // Regular party members only see notes that are not strictly personal
      targetNotes = allNotes.filter(
        (n) =>
          (n.author?._id === targetPlayer._id || n.author?.email === targetPlayer.email) &&
          n.visibility !== 'personal' &&
          !n.askDm
      );
    }

    // Quests filtering
    let targetQuests: Entity[] = [];
    if (isOwnProfile || player?.isDm) {
      targetQuests = allEntities.filter(
        (e) =>
          e.type === 'quest' &&
          (e.questScope === 'personal' ||
            e.assigneePlayerId === targetPlayer._id ||
            e.assigneePlayerName === targetPlayer.characterName) &&
          CampaignManager.isEntityAccessible(e, player || targetPlayer)
      );
    } else {
      targetQuests = allEntities.filter(
        (e) =>
          e.type === 'quest' &&
          (e.assigneePlayerId === targetPlayer._id ||
            e.assigneePlayerName === targetPlayer.characterName) &&
          CampaignManager.isEntityAccessible(e, player || targetPlayer)
      );
    }

    // Scrapbook memories filtering: ensure memories belong STRICTLY to targetPlayer
    const isDM = Boolean(player.isDm);
    const targetCharName = (targetPlayer.characterName || '').trim().toLowerCase();
    const targetPlayerId = targetPlayer._id;

    const targetMemories = allScrapbook.filter((s) => {
      const authorMatch = Boolean(s.authorName && s.authorName.trim().toLowerCase() === targetCharName);
      const entityMatch = Boolean(s.entityId && (s.entityId === targetPlayerId || (s.entityType === 'character' && s.entityId === targetPlayerId)));
      const tagMatch = Boolean(s.tags && Array.isArray(s.tags) && s.tags.some((t) => {
        const cleanT = t.trim().toLowerCase();
        return cleanT === targetCharName || cleanT === targetPlayerId.toLowerCase();
      }));

      const belongsToTarget = authorMatch || entityMatch || tagMatch;
      if (!belongsToTarget) return false;

      // Privacy check: if viewing another player's profile and user is not DM, check item-level secrecy
      if (!isOwnProfile && !isDM && s.isSecret) {
        return false;
      }

      return true;
    });

    setNotes(targetNotes);
    setQuests(targetQuests);
    setScrapbook(targetMemories);
    setCategories(allCategories);
    setCharacterBio(bio);
    setFamilyRelationsCount(relations.length);
  };

  useEffect(() => {
    loadData();
    const handleNotesUpdate = () => loadData();
    const handleEntitiesUpdate = () => loadData();
    const handleAccountsUpdate = () => loadData();
    const handleBioUpdate = () => loadData();
    const handleRelationsUpdate = () => loadData();
    const handleScrapbookUpdate = () => loadData();

    window.addEventListener('chronicle_notes_updated', handleNotesUpdate);
    window.addEventListener('chronicle_entities_updated', handleEntitiesUpdate);
    window.addEventListener('chronicle_accounts_updated', handleAccountsUpdate);
    window.addEventListener('chronicle_character_bio_updated', handleBioUpdate);
    window.addEventListener('chronicle_family_tree_updated', handleRelationsUpdate);
    window.addEventListener('chronicle_scrapbook_updated', handleScrapbookUpdate);

    return () => {
      window.removeEventListener('chronicle_notes_updated', handleNotesUpdate);
      window.removeEventListener('chronicle_entities_updated', handleEntitiesUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleAccountsUpdate);
      window.removeEventListener('chronicle_character_bio_updated', handleBioUpdate);
      window.removeEventListener('chronicle_family_tree_updated', handleRelationsUpdate);
      window.removeEventListener('chronicle_scrapbook_updated', handleScrapbookUpdate);
    };
  }, [targetPlayer, player, isOwnProfile]);

  useEffect(() => {
    if (player) {
      setEditName(player.characterName || account?.characterName || '');
      setEditAvatar(player.avatarUrl || account?.avatarUrl || '');
      setEditColor(player.color || account?.color || '#6366f1');
    }
  }, [player, account]);

  // Reset page when search query or filter changes
  useEffect(() => {
    setSearchPage(1);
  }, [searchQuery, searchCategoryFilter]);

  if (!player || !account) return null;

  const currentUserId = player?._id || (player as any)?.id || CampaignManager.getCurrentAccount()?.id;
  const isDm = !!player?.isDm;

  const dmQuestions = notes.filter((n) => {
    if (!n.askDm && !n.dmResponse) return false;
    if (isDm) {
      if (n.hiddenForDm) return false;
    } else {
      const targetId = targetPlayer._id || (targetPlayer as any)?.id;
      if (currentUserId && n.hiddenForPlayerIds?.includes(currentUserId)) return false;
      if (targetId && n.hiddenForPlayerIds?.includes(targetId)) return false;
    }
    return true;
  });
  const pendingQuestions = dmQuestions.filter((n) => !n.dmResponse?.text || !n.dmResponse.isResolved);
  const answeredQuestions = dmQuestions.filter((n) => n.dmResponse?.text);
  const activeQuests = quests.filter((q) => q.status !== 'completed');

  // Standard tab filtering
  const filteredNotes = notes.filter(
    (n) =>
      !searchQuery.trim() ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (n.category?.title && n.category.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredQuests = quests.filter(
    (q) =>
      !searchQuery.trim() ||
      q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.progressNote && q.progressNote.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDmQuestions = dmQuestions.filter(
    (q) =>
      !searchQuery.trim() ||
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.content && q.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.dmResponse?.text && q.dmResponse.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredMemories = scrapbook.filter(
    (m) =>
      !searchQuery.trim() ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.caption && m.caption.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.category && m.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.tags && m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // === UNIFIED SEARCH AGGREGATION ACROSS ALL 4 DOMAINS ===
  const isSearchActive = searchQuery.trim().length > 0;

  const searchResults: UnifiedSearchResult[] = useMemo(() => {
    if (!isSearchActive) return [];
    const query = searchQuery.toLowerCase().trim();
    const results: UnifiedSearchResult[] = [];

    // 1. Taccuino Personale (Non-DM Notes)
    notes
      .filter((n) => !n.askDm)
      .forEach((n) => {
        const titleMatch = n.title.toLowerCase().includes(query);
        const contentMatch = n.content && n.content.toLowerCase().includes(query);
        const categoryMatch = n.category?.title && n.category.title.toLowerCase().includes(query);
        if (titleMatch || contentMatch || categoryMatch) {
          results.push({
            id: `res_note_${n._id}`,
            categoryType: 'notes',
            title: n.title,
            subtitle: n.category?.title || 'Taccuino Personale',
            snippet: n.content || 'Nessun testo esteso...',
            date: new Date(n._createdAt).toLocaleDateString('it-IT'),
            statusBadge: 'Nota',
            badgeColor: n.category?.color || '#6366f1',
            rawItem: n,
          });
        }
      });

    // 2. Obiettivi e Quest
    quests.forEach((q) => {
      const nameMatch = q.name.toLowerCase().includes(query);
      const descMatch = q.progressNote && q.progressNote.toLowerCase().includes(query);
      if (nameMatch || descMatch) {
        results.push({
          id: `res_quest_${q._id}`,
          categoryType: 'quests',
          title: q.name,
          subtitle: q.questScope === 'personal' ? 'Quest Personale' : 'Quest Campagna',
          snippet: q.progressNote || 'Nessun dettaglio aggiuntivo...',
          statusBadge:
            q.status === 'completed' ? 'Completata' : q.status === 'failed' ? 'Fallita' : 'In Corso',
          badgeColor:
            q.status === 'completed' ? '#10b981' : q.status === 'failed' ? '#ef4444' : '#06b6d4',
          rawItem: q,
        });
      }
    });

    // 3. Chiarimenti DM
    dmQuestions.forEach((dq) => {
      const titleMatch = dq.title.toLowerCase().includes(query);
      const contentMatch = dq.content && dq.content.toLowerCase().includes(query);
      const replyMatch = dq.dmResponse?.text && dq.dmResponse.text.toLowerCase().includes(query);
      if (titleMatch || contentMatch || replyMatch) {
        results.push({
          id: `res_dm_${dq._id}`,
          categoryType: 'dm_questions',
          title: dq.title,
          subtitle: dq.dmResponse?.text ? `Risposto da ${dq.dmResponse.answeredBy}` : 'In attesa del DM',
          snippet: dq.dmResponse?.text
            ? `Risposta: ${dq.dmResponse.text}`
            : `Domanda: ${dq.content || 'Nessun contenuto'}`,
          date: new Date(dq._createdAt).toLocaleDateString('it-IT'),
          statusBadge: dq.dmResponse?.text ? 'Risposto' : 'In Attesa',
          badgeColor: dq.dmResponse?.text ? '#10b981' : '#f59e0b',
          rawItem: dq,
        });
      }
    });

    // 4. Memorie & Visual
    scrapbook.forEach((m) => {
      const titleMatch = m.title.toLowerCase().includes(query);
      const captionMatch = m.caption && m.caption.toLowerCase().includes(query);
      const catMatch = m.category && m.category.toLowerCase().includes(query);
      const tagsMatch = m.tags && m.tags.some((t) => t.toLowerCase().includes(query));
      if (titleMatch || captionMatch || catMatch || tagsMatch) {
        results.push({
          id: `res_mem_${m.id}`,
          categoryType: 'memories',
          title: m.title,
          subtitle: m.loreDate || m.category,
          snippet: m.caption || 'Memoria visiva',
          date: m.createdAt ? new Date(m.createdAt).toLocaleDateString('it-IT') : undefined,
          statusBadge: 'Memoria',
          badgeColor: '#8b5cf6',
          imageUrl: m.imageUrl,
          rawItem: m,
        });
      }
    });

    return results;
  }, [isSearchActive, searchQuery, notes, quests, dmQuestions, scrapbook]);

  // Categorized counts for search chips
  const searchCounts = useMemo(() => {
    const counts = {
      all: searchResults.length,
      notes: searchResults.filter((r) => r.categoryType === 'notes').length,
      quests: searchResults.filter((r) => r.categoryType === 'quests').length,
      dm_questions: searchResults.filter((r) => r.categoryType === 'dm_questions').length,
      memories: searchResults.filter((r) => r.categoryType === 'memories').length,
    };
    return counts;
  }, [searchResults]);

  // Filtered search results based on selected search chip
  const filteredSearchResults = useMemo(() => {
    if (searchCategoryFilter === 'all') return searchResults;
    return searchResults.filter((r) => r.categoryType === searchCategoryFilter);
  }, [searchResults, searchCategoryFilter]);

  // Pagination for search results
  const totalPages = Math.max(1, Math.ceil(filteredSearchResults.length / ITEMS_PER_PAGE));
  const paginatedResults = useMemo(() => {
    const startIndex = (searchPage - 1) * ITEMS_PER_PAGE;
    return filteredSearchResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSearchResults, searchPage]);

  // Actions
  const handleOpenEditProfile = () => {
    if (player) {
      setEditName(player.characterName || account?.characterName || '');
      setEditAvatar(player.avatarUrl || account?.avatarUrl || '');
      setEditColor(player.color || account?.color || '#6366f1');
    }
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (editName.trim()) updates.characterName = editName.trim();
    if (editColor) updates.color = editColor;
    updates.avatarUrl = editAvatar.trim();

    const ok = updateAccountProfile(updates);
    const activeCode = CampaignManager.getActiveCampaignCode();
    if (activeCode && account) {
      CampaignManager.setCampaignProfile(account.id, activeCode, {
        characterName: editName.trim() || undefined,
        color: editColor || undefined,
        avatarUrl: editAvatar.trim(),
      });
    }

    if (ok) {
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        setIsEditProfileOpen(false);
      }, 1200);
    }
  };

  const [isUploadingMemoryImage, setIsUploadingMemoryImage] = useState(false);

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim() || !memoryImage.trim() || !targetPlayer) return;

    setIsUploadingMemoryImage(true);
    let finalImageUrl = memoryImage.trim();

    try {
      const code = CampaignManager.getActiveCampaignCode() || 'default';
      finalImageUrl = await FirebaseStorageService.uploadMedia(
        code,
        'scrapbook',
        memoryTitle.trim(),
        memoryImage.trim()
      );
    } catch (err) {
      console.warn('Errore upload memoria su Firebase Storage:', err);
    } finally {
      setIsUploadingMemoryImage(false);
    }

    const newItem = CampaignManager.addScrapbookItem({
      title: memoryTitle.trim(),
      imageUrl: finalImageUrl,
      caption: memoryCaption.trim(),
      category: memoryCategory,
      loreDate: memoryLoreDate.trim() || undefined,
      authorName: targetPlayer.characterName,
      entityId: targetPlayer._id,
      entityType: 'character',
      tags: [targetPlayer.characterName, targetPlayer._id, 'personale', memoryCategory],
      isSecret: false,
    });

    setScrapbook((prev) => [newItem, ...prev.filter((m) => m.id !== newItem.id)]);
    setIsMemoryModalOpen(false);
    setMemoryTitle('');
    setMemoryImage('');
    setMemoryCaption('');
    setMemoryLoreDate('');
    setActiveTab('memories');
  };

  const handleToggleQuestStatus = (quest: Entity, newStatus: Entity['status']) => {
    const all = CampaignManager.getEntities();
    const updated = all.map((q) => (q._id === quest._id ? { ...q, status: newStatus } : q));
    CampaignManager.saveEntities(updated);
    setQuests(updated.filter((e) => e.type === 'quest' && (e.questScope === 'personal' || e.assigneePlayerId === player._id)));
  };

  const handleDeleteNote = (noteId: string) => {
    const all = CampaignManager.getNotes();
    const updated = all.filter((n) => n._id !== noteId);
    CampaignManager.saveNotes(updated);
    setNotes((prev) => prev.filter((n) => n._id !== noteId));
    setNoteToDelete(null);
    if (selectedNote?._id === noteId) setSelectedNote(null);
  };

  const handleDeleteQuest = (questId: string) => {
    const all = CampaignManager.getEntities();
    const updated = all.filter((q) => q._id !== questId);
    CampaignManager.saveEntities(updated);
    setQuests((prev) => prev.filter((q) => q._id !== questId));
    setQuestToDelete(null);
  };

  const handleDeleteMemory = (memoryId: string) => {
    CampaignManager.deleteScrapbookItem(memoryId);
    setScrapbook((prev) => prev.filter((m) => m.id !== memoryId));
    setMemoryToDelete(null);
    if (selectedMemory?.id === memoryId) setSelectedMemory(null);
  };

  const handleSendDmReply = (note: Note) => {
    if (!dmReplyText.trim()) return;
    const responseObj: DmResponse = {
      text: dmReplyText.trim(),
      answeredAt: new Date().toISOString(),
      answeredBy: player.characterName || 'Dungeon Master',
      isResolved: true,
    };

    const all = CampaignManager.getNotes();
    const updated = all.map((n) => (n._id === note._id ? { ...n, dmResponse: responseObj } : n));
    CampaignManager.saveNotes(updated);
    setDmReplyText('');
    loadData();
    if (selectedNote?._id === note._id) {
      setSelectedNote({ ...selectedNote, dmResponse: responseObj });
    }
  };

  const handleDeleteDmReply = (noteId: string) => {
    CampaignManager.deleteDmReply(noteId);
    loadData();
    if (selectedNote?._id === noteId) {
      setSelectedNote({ ...selectedNote, dmResponse: undefined });
    }
  };

  const handleRemoveClarification = (noteId: string) => {
    if (player?.isDm) {
      CampaignManager.removeClarificationForDm(noteId);
    } else {
      const pId = targetPlayer._id || (targetPlayer as any)?.id || currentUserId;
      CampaignManager.removeClarificationForPlayer(noteId, pId);
    }
    loadData();
    if (selectedNote?._id === noteId) {
      setSelectedNote(null);
    }
  };

  const handleDeleteClarificationRequest = (noteId: string) => {
    CampaignManager.deleteClarificationRequest(noteId);
    loadData();
    if (selectedNote?._id === noteId) {
      setSelectedNote(null);
    }
  };

  const handleToggleDmClarificationResolved = (noteId: string) => {
    CampaignManager.toggleDmClarificationResolved(noteId);
    loadData();
  };

  const handleSearchResultClick = (result: UnifiedSearchResult) => {
    if (result.categoryType === 'notes') {
      setSelectedNote(result.rawItem as Note);
    } else if (result.categoryType === 'quests') {
      setActiveTab('quests');
    } else if (result.categoryType === 'dm_questions') {
      setActiveTab('dm_questions');
      setSelectedNote(result.rawItem as Note);
    } else if (result.categoryType === 'memories') {
      setSelectedMemory(result.rawItem as ScrapbookItem);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchCategoryFilter('all');
  };

  const handleTogglePrivacy = (section: keyof import('../types').CharacterSectionPrivacy) => {
    if (!player) return;
    const currentPrivacy = characterBio?.privacySettings || {
      identity: true,
      backstory: true,
      traits: true,
      bondsFlaws: true,
      secrets: false,
      appearance: true,
      familyTree: true,
      personalNotes: false,
      quests: true,
      memories: true,
    };
    const updatedPrivacy = {
      ...currentPrivacy,
      [section]: !currentPrivacy[section],
    };
    const updatedBio: CharacterBio = {
      ...(characterBio || { playerId: player._id }),
      playerId: player._id,
      privacySettings: updatedPrivacy,
      updatedAt: new Date().toISOString(),
    };
    CampaignManager.saveCharacterBio(updatedBio);
    setCharacterBio(updatedBio);
  };

  const handleSyncToCodex = () => {
    if (!targetPlayer) return;
    const currentBio = characterBio || CampaignManager.getCharacterBio(targetPlayer._id);
    const charName = targetPlayer.characterName.trim();
    const existingEnt = matchedCodexEntity;

    // Compose rich progress note description
    const headerDetails = [
      currentBio?.characterRace,
      currentBio?.characterClass,
      currentBio?.characterTitle,
      currentBio?.characterAlignment,
    ]
      .filter(Boolean)
      .join(' • ');

    const descriptionParts: string[] = [];
    if (headerDetails) descriptionParts.push(`**${headerDetails}**\n`);
    if (currentBio?.appearanceDescription) {
      descriptionParts.push(`### Aspetto Visivo\n${currentBio.appearanceDescription}\n`);
    }
    if (currentBio?.backstoryMarkdown) {
      descriptionParts.push(`### Biografia & Background\n${currentBio.backstoryMarkdown}\n`);
    }
    if (currentBio?.personalityTraits && currentBio.personalityTraits.length > 0) {
      descriptionParts.push(
        `### Tratti di Personalità\n${currentBio.personalityTraits.map((t) => `- ${t}`).join('\n')}\n`
      );
    }
    if (currentBio?.ideals) descriptionParts.push(`**Ideali:** ${currentBio.ideals}`);
    if (currentBio?.bonds) descriptionParts.push(`**Legami:** ${currentBio.bonds}`);
    if (currentBio?.flaws) descriptionParts.push(`**Difetti:** ${currentBio.flaws}`);

    const progressNote = descriptionParts.join('\n\n') || `Membro della Compagnia di Avventurieri.`;

    // Compose AI Persona Config
    const traitsStr =
      currentBio?.personalityTraits && currentBio.personalityTraits.length > 0
        ? currentBio.personalityTraits.join(', ')
        : 'determinato e leale con i compagni';

    const speechStyle = `Interpreta fedelmente ${charName} (${currentBio?.characterRace || 'Eroe'} ${currentBio?.characterClass || 'Avventuriero'}). Tratti: ${traitsStr}. Allineamento: ${currentBio?.characterAlignment || 'Neutrale'}. Parla sempre in prima persona singolare.`;

    const knowledgeScope = `Conosce la propria storia personale${currentBio?.hometown ? ` (originario di ${currentBio.hometown})` : ''}, i compagni di viaggio (${allPlayers.map((p) => p.characterName).join(', ')}) e i fatti narrati nelle cronache.`;

    const defaultRelations: Record<string, EntityPartyRelation> = {};
    allPlayers
      .filter((p) => p._id !== targetPlayer._id)
      .forEach((otherP) => {
        defaultRelations[otherP._id] = {
          playerId: otherP._id,
          characterName: otherP.characterName,
          relationType: "Compagno d'Avventura",
          attitude: 'friendly',
          notes: `Condivide il viaggio e i pericoli con ${otherP.characterName}.`,
        };
      });

    const aiConfig = {
      enabled: true,
      speechStyle,
      currentStatus: `${currentBio?.characterClass || 'Avventuriero'} attivo della Compagnia`,
      knowledgeScope,
      secretsToProtect: currentBio?.secrets || '',
      partyRelations:
        existingEnt?.aiConfig?.partyRelations && Object.keys(existingEnt.aiConfig.partyRelations).length > 0
          ? { ...defaultRelations, ...existingEnt.aiConfig.partyRelations }
          : defaultRelations,
    };

    const aliases = Array.from(
      new Set(
        [
          currentBio?.characterTitle,
          ...(targetPlayer.aliases || []),
          ...(existingEnt?.aliases || []),
        ].filter((a): a is string => Boolean(a && a.trim()))
      )
    );

    const entityStatus: Entity['status'] =
      targetPlayer.status === 'dead' ? 'dead' : existingEnt?.status || 'alive';

    if (existingEnt) {
      // Update existing entity
      const allEnts = CampaignManager.getEntities();
      const updatedEnts: Entity[] = allEnts.map((e) => {
        if (e._id === existingEnt._id) {
          return {
            ...e,
            name: charName,
            aliases,
            color: targetPlayer.color || e.color,
            images: targetPlayer.avatarUrl ? [targetPlayer.avatarUrl] : e.images,
            status: entityStatus,
            progressNote,
            aiConfig: {
              ...e.aiConfig,
              ...aiConfig,
            },
          };
        }
        return e;
      });
      CampaignManager.saveEntities(updatedEnts);
      setEntities(updatedEnts);
      setSyncStatusMsg(`Scheda di "${charName}" aggiornata nel Codex con Persona IA!`);
    } else {
      // Create new Codex entity
      const newEnt = CampaignManager.addEntity({
        name: charName,
        type: 'npc',
        aliases,
        color: targetPlayer.color || '#6366f1',
        images: targetPlayer.avatarUrl ? [targetPlayer.avatarUrl] : [],
        status: entityStatus,
        progressNote,
        aiConfig,
      });
      setEntities(CampaignManager.getEntities());
      setSyncStatusMsg(`Nuova scheda di "${charName}" creata nel Codex con Persona IA abilitata!`);
    }

    setTimeout(() => {
      setSyncStatusMsg(null);
    }, 4000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 w-full pb-16">
      {/* 1. Party Members Selector Bar */}
      {allPlayers && allPlayers.length > 1 && (
        <div className="bg-surface-1 border border-surface-2 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs text-content-3 font-medium">
              <Users size={13} className="text-primary" />
              <span>Personaggi del Party ({allPlayers.length})</span>
            </div>
            {!isOwnProfile && (
              <button
                type="button"
                id="back-to-own-character-btn"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('player');
                  setSearchParams(newParams);
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <User size={12} /> Torna al mio personaggio
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
            {allPlayers.map((p) => {
              const isSelected = p._id === targetPlayer._id;
              const isMe = p._id === player._id;
              return (
                <button
                  key={p._id}
                  type="button"
                  id={`party-member-btn-${p._id}`}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    if (isMe) {
                      newParams.delete('player');
                    } else {
                      newParams.set('player', p._id);
                    }
                    setSearchParams(newParams);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-primary/15 border-primary text-content-1 ring-1 ring-primary/40 font-semibold shadow-xs'
                      : 'bg-surface-2/70 hover:bg-surface-2 border-surface-3 text-content-2 hover:text-content-1'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shrink-0"
                    style={{ backgroundColor: p.color || '#6366f1' }}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      p.characterName?.charAt(0).toUpperCase() || 'P'
                    )}
                  </div>
                  <span className="truncate max-w-[130px]">{p.characterName}</span>
                  {isMe && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono bg-surface-3 text-content-2 rounded">
                      Tu
                    </span>
                  )}
                  {p.isDm && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono bg-primary/20 text-primary rounded font-semibold">
                      DM
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Dossier Header Card */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative group shrink-0">
              {targetPlayer.avatarUrl ? (
                <img
                  src={targetPlayer.avatarUrl}
                  alt={targetPlayer.characterName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border-2 shadow-xs shrink-0 transition-colors"
                  style={{ borderColor: targetPlayer.color || '#6366f1' }}
                />
              ) : (
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center font-heading font-bold text-2xl sm:text-3xl text-surface-0 shadow-xs shrink-0 transition-colors"
                  style={{ backgroundColor: targetPlayer.color || '#6366f1' }}
                >
                  {targetPlayer.characterName?.charAt(0).toUpperCase()}
                </div>
              )}
              {isOwnProfile && (
                <button
                  type="button"
                  id="edit-profile-btn"
                  onClick={handleOpenEditProfile}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-md border border-surface-3 shadow-xs transition-colors cursor-pointer"
                  title="Modifica Identità & Colore Personaggio"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-bold text-content-1 truncate">
                  {targetPlayer.characterName}
                </h1>
                {targetPlayer.isDm ? (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-md border border-primary/20 flex items-center gap-1">
                    <Crown size={12} /> Dungeon Master
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-surface-2 text-content-2 text-xs font-medium rounded-md border border-surface-3 flex items-center gap-1">
                    <Shield size={12} className="text-primary" /> {isOwnProfile ? 'Tuo PG' : 'PG del Party'}
                  </span>
                )}
                <span
                  className="w-2.5 h-2.5 rounded-full border border-surface-0 shadow-xs shrink-0"
                  style={{ backgroundColor: targetPlayer.color || '#6366f1' }}
                  title={`Emblema: ${targetPlayer.color || '#6366f1'}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-3">
                {characterBio?.characterClass || characterBio?.characterRace ? (
                  <span className="text-content-2 font-medium">
                    {[characterBio.characterRace, characterBio.characterClass, characterBio.characterTitle]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <User size={12} /> {targetPlayer.email || account.email}
                </span>
              </div>

              {/* DM Assigned Character Tags */}
              {targetPlayer.tags && targetPlayer.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-mono text-content-3 flex items-center gap-1">
                    <Tag size={11} className="text-primary" /> Ruolo / Etichette DM:
                  </span>
                  {targetPlayer.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-mono font-medium rounded border border-primary/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Direct Actions & View Mode Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-surface-2">
            {isOwnProfile ? (
              <>
                {/* View Mode Toggle: Modifica (Proprietario) vs Lettura (Altri Giocatori) */}
                <div className="flex items-center p-0.5 bg-surface-2 border border-surface-3 rounded-lg mr-1">
                  <button
                    type="button"
                    id="view-mode-edit-btn"
                    onClick={() => {
                      setViewMode('edit');
                      CampaignManager.saveUserPreferences({ viewMode: 'edit' });
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'edit'
                        ? 'bg-surface-1 text-content-1 shadow-xs font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                    title="Vista Proprietario (Modifica & impostazioni privacy)"
                  >
                    <Edit3 size={13} className={viewMode === 'edit' ? 'text-primary' : ''} />
                    <span>Modifica</span>
                  </button>
                  <button
                    type="button"
                    id="view-mode-read-btn"
                    onClick={() => {
                      setViewMode('read');
                      CampaignManager.saveUserPreferences({ viewMode: 'read' });
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'read'
                        ? 'bg-surface-1 text-content-1 shadow-xs font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                    title="Anteprima Vista Party (Come appare agli altri giocatori)"
                  >
                    <Eye size={13} className={viewMode === 'read' ? 'text-primary' : ''} />
                    <span>Lettura</span>
                  </button>
                </div>

                {viewMode === 'edit' && (
                  <>
                    <button
                      type="button"
                      id="new-personal-note-btn"
                      onClick={() => {
                        setIsAskDm(false);
                        setIsNoteModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Nuova Nota</span>
                    </button>

                    <button
                      type="button"
                      id="ask-dm-btn"
                      onClick={() => {
                        setIsAskDm(true);
                        setIsNoteModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <HelpCircle size={14} className="text-amber-400" />
                      <span>Chiedi al DM</span>
                    </button>

                    <button
                      type="button"
                      id="new-quest-btn"
                      onClick={() => setIsQuestModalOpen(true)}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Target size={14} className="text-cyan-400" />
                      <span>Nuova Quest</span>
                    </button>

                    <button
                      type="button"
                      id="new-memory-btn"
                      onClick={() => setIsMemoryModalOpen(true)}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon size={14} className="text-purple-400" />
                      <span>Memoria</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-surface-2 text-content-2 border border-surface-3 rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <Eye size={13} className="text-primary" /> Vista Membro del Party
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 Codex Sync & AI Persona Card */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              matchedCodexEntity
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-primary/10 text-primary border-primary/30'
            }`}
          >
            <Brain size={20} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-bold text-sm text-content-1">
                {matchedCodexEntity
                  ? 'Scheda Sincronizzata nel Codex'
                  : 'Crea Scheda nel Codex & Abilita Persona IA'}
              </h3>
              {matchedCodexEntity && (
                <span className="px-2 py-0.2 text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 size={10} /> Persona IA Attiva
                </span>
              )}
            </div>
            <p className="text-xs text-content-3 leading-relaxed">
              {matchedCodexEntity
                ? `Il profilo di ${targetPlayer.characterName} è registrato nel Codex come entità del gruppo con Persona IA e relazioni lore.`
                : `Copia automaticamente biografia, classe, razza e tratti di ${targetPlayer.characterName} in una scheda del Codex abilitata all'IA.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-2">
          {matchedCodexEntity && (
            <Link
              to={`/entities?select=${matchedCodexEntity._id}`}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Apri la scheda nel Codex ed esplora le relazioni o chatta con la Persona IA"
            >
              <BookOpen size={13} className="text-primary" />
              <span>Vedi nel Codex</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleSyncToCodex}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
              matchedCodexEntity
                ? 'bg-surface-2 hover:bg-surface-3 text-primary border border-surface-3'
                : 'bg-primary text-surface-0 hover:bg-primary-hover border border-primary'
            }`}
          >
            <Sparkles size={13} />
            <span>{matchedCodexEntity ? 'Aggiorna Scheda Codex' : 'Sincronizza nel Codex'}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2 animate-fade-in">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} />
            {syncStatusMsg}
          </span>
          {matchedCodexEntity && (
            <Link
              to={`/entities?select=${matchedCodexEntity._id}`}
              className="underline font-semibold hover:text-emerald-200"
            >
              Apri nel Codex &rarr;
            </Link>
          )}
        </div>
      )}

      {/* 6 Core Dossier Section Navigation Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Background & Bio */}
        <button
          type="button"
          id="tab-bio-btn"
          onClick={() => {
            setActiveTab('biography');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'biography' && !isSearchActive
              ? 'border-amber-500/60 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <FileText size={15} />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-content-3">
              Bio
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Background</div>
            <div className="text-[11px] text-content-3 truncate">Storia &amp; Tratti</div>
          </div>
        </button>

        {/* 2. Family Tree & Relations */}
        <button
          type="button"
          id="tab-family-btn"
          onClick={() => {
            setActiveTab('family_tree');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'family_tree' && !isSearchActive
              ? 'border-emerald-500/60 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <GitBranch size={15} />
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
              {familyRelationsCount}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Albero &amp; Relazioni</div>
            <div className="text-[11px] text-content-3 truncate">Legami &amp; Parentela</div>
          </div>
        </button>

        {/* 3. Personal Notes */}
        <button
          type="button"
          id="tab-notes-btn"
          onClick={() => {
            setActiveTab('notes');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'notes' && !isSearchActive
              ? 'border-primary/60 bg-primary/10 shadow-xs ring-1 ring-primary/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <BookOpen size={15} />
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
              {notes.length}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Taccuino</div>
            <div className="text-[11px] text-content-3 truncate">Note &amp; Segreti</div>
          </div>
        </button>

        {/* 4. Quests & Goals */}
        <button
          type="button"
          id="tab-quests-btn"
          onClick={() => {
            setActiveTab('quests');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'quests' && !isSearchActive
              ? 'border-cyan-500/60 bg-cyan-500/10 shadow-xs ring-1 ring-cyan-500/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <Target size={15} />
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
              {quests.length}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Obiettivi &amp; Quest</div>
            <div className="text-[11px] text-content-3 truncate">
              {activeQuests.length} in corso
            </div>
          </div>
        </button>

        {/* 5. DM Questions */}
        <button
          type="button"
          id="tab-dm-questions-btn"
          onClick={() => {
            setActiveTab('dm_questions');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'dm_questions' && !isSearchActive
              ? 'border-amber-500/60 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <HelpCircle size={15} />
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2 flex items-center gap-1">
              {dmQuestions.length}
              {pendingQuestions.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Chiarimenti DM</div>
            <div className="text-[11px] text-content-3 truncate">
              {pendingQuestions.length > 0 ? `${pendingQuestions.length} in attesa` : 'Filo diretto'}
            </div>
          </div>
        </button>

        {/* 6. Scrapbook & Memories */}
        <button
          type="button"
          id="tab-memories-btn"
          onClick={() => {
            setActiveTab('memories');
            if (isSearchActive) clearSearch();
          }}
          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
            activeTab === 'memories' && !isSearchActive
              ? 'border-purple-500/60 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30'
              : 'border-surface-2 bg-surface-1 hover:bg-surface-2/70 hover:border-surface-3'
          }`}
        >
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <ImageIcon size={15} />
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
              {scrapbook.length}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-1 truncate">Memorie Visive</div>
            <div className="text-[11px] text-content-3 truncate">Scrapbook &amp; Ritratti</div>
          </div>
        </button>
      </div>

      {/* Active Section Info & Unified Search Bar */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-content-2 font-medium">
          <span className="text-content-3">Sezione attiva:</span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-2 border border-surface-3 text-content-1 font-semibold flex items-center gap-1.5">
            {activeTab === 'biography' && <FileText size={13} className="text-amber-400" />}
            {activeTab === 'family_tree' && <GitBranch size={13} className="text-emerald-400" />}
            {activeTab === 'notes' && <BookOpen size={13} className="text-primary" />}
            {activeTab === 'quests' && <Target size={13} className="text-cyan-400" />}
            {activeTab === 'dm_questions' && <HelpCircle size={13} className="text-amber-400" />}
            {activeTab === 'memories' && <ImageIcon size={13} className="text-purple-400" />}
            {activeTab === 'biography' && 'Background & Tratti'}
            {activeTab === 'family_tree' && 'Albero Genealogico & Relazioni'}
            {activeTab === 'notes' && 'Taccuino Personale'}
            {activeTab === 'quests' && 'Obiettivi & Quest'}
            {activeTab === 'dm_questions' && 'Chiarimenti col DM'}
            {activeTab === 'memories' && 'Memorie Visive & Scrapbook'}
          </span>
        </div>

        {/* Unified Search Input */}
        <div className="relative w-full sm:w-80 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" />
          <input
            type="text"
            id="character-notes-search-input"
            placeholder="Cerca in tutto il dossier del PG..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-2/80 border border-surface-3 focus:border-primary rounded-lg pl-9 pr-8 py-1.5 text-xs text-content-1 outline-none transition-colors placeholder:text-content-3/60"
          />
          {isSearchActive && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-content-3 hover:text-content-1 rounded-full bg-surface-3 transition-colors cursor-pointer"
              title="Cancella ricerca"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Search Filter Bar (Visible only when searching) */}
      {isSearchActive && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 bg-surface-1 border border-surface-2 p-3 rounded-lg text-xs"
        >
          <div className="flex items-center gap-1.5 text-content-3">
            <Filter size={13} className="text-primary" />
            <span>Filtra Risultati ({searchResults.length} trovati):</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                searchCategoryFilter === 'all'
                  ? 'bg-primary text-surface-0'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              Tutti ({searchCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSearchCategoryFilter('notes')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                searchCategoryFilter === 'notes'
                  ? 'bg-indigo-500 text-surface-0'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              Taccuino ({searchCounts.notes})
            </button>
            <button
              type="button"
              onClick={() => setSearchCategoryFilter('quests')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                searchCategoryFilter === 'quests'
                  ? 'bg-cyan-500 text-surface-0'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              Obiettivi ({searchCounts.quests})
            </button>
            <button
              type="button"
              onClick={() => setSearchCategoryFilter('dm_questions')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                searchCategoryFilter === 'dm_questions'
                  ? 'bg-amber-500 text-surface-0'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              Chiarimenti DM ({searchCounts.dm_questions})
            </button>
            <button
              type="button"
              onClick={() => setSearchCategoryFilter('memories')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                searchCategoryFilter === 'memories'
                  ? 'bg-purple-500 text-surface-0'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              Memorie ({searchCounts.memories})
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Content Area: Search Mode vs Tab Mode */}
      {isSearchActive ? (
        /* UNIFIED SEARCH RESULTS VIEW */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-content-1 flex items-center gap-2">
              <Search size={15} className="text-primary" />
              <span>Risultati per: &ldquo;<span className="text-primary">{searchQuery}</span>&rdquo;</span>
            </h3>
            <span className="text-xs text-content-3">
              Pagina {searchPage} di {totalPages}
            </span>
          </div>

          {filteredSearchResults.length === 0 ? (
            <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
              <Search size={32} className="mx-auto text-content-3 opacity-40" />
              <h3 className="font-heading text-sm font-semibold text-content-1">
                Nessun risultato trovato per la ricerca
              </h3>
              <p className="text-xs text-content-3 max-w-md mx-auto">
                Non ci sono corrispondenze in taccuino personale, obiettivi, chiarimenti al DM o memorie.
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-lg text-xs font-medium inline-flex items-center gap-2 mt-1 cursor-pointer transition-colors"
              >
                <X size={13} /> Cancella Ricerca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {paginatedResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleSearchResultClick(result)}
                  className="bg-surface-1 border border-surface-2 hover:border-surface-3 rounded-xl p-4 space-y-3 transition-all cursor-pointer group hover:shadow-xs relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="p-1 rounded-md text-xs shrink-0"
                          style={{
                            backgroundColor: `${result.badgeColor || '#6366f1'}15`,
                            color: result.badgeColor || '#6366f1',
                          }}
                        >
                          {result.categoryType === 'notes' && <BookOpen size={13} />}
                          {result.categoryType === 'quests' && <Target size={13} />}
                          {result.categoryType === 'dm_questions' && <HelpCircle size={13} />}
                          {result.categoryType === 'memories' && <ImageIcon size={13} />}
                        </span>
                        <h4 className="font-heading font-semibold text-sm text-content-1 group-hover:text-primary transition-colors truncate">
                          {result.title}
                        </h4>
                      </div>

                      <span
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md border shrink-0 uppercase tracking-wider"
                        style={{
                          backgroundColor: `${result.badgeColor || '#6366f1'}15`,
                          borderColor: `${result.badgeColor || '#6366f1'}30`,
                          color: result.badgeColor || '#6366f1',
                        }}
                      >
                        {result.statusBadge}
                      </span>
                    </div>

                    {result.imageUrl && (
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-surface-2 relative">
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <p className="text-xs text-content-3 line-clamp-3 leading-relaxed">
                      {result.snippet}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-content-3 pt-2.5 border-t border-surface-2/60">
                    <span className="font-medium text-content-2">
                      {result.subtitle}
                    </span>
                    {result.date && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {result.date}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                type="button"
                disabled={searchPage === 1}
                onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-surface-2 bg-surface-1 hover:bg-surface-2 text-content-2 disabled:opacity-40 disabled:pointer-events-none text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={13} /> Precedente
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setSearchPage(pageNum)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      searchPage === pageNum
                        ? 'bg-primary text-surface-0 font-bold'
                        : 'bg-surface-1 border border-surface-2 hover:bg-surface-2 text-content-2'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={searchPage === totalPages}
                onClick={() => setSearchPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-surface-2 bg-surface-1 hover:bg-surface-2 text-content-2 disabled:opacity-40 disabled:pointer-events-none text-xs flex items-center gap-1 cursor-pointer"
              >
                Successivo <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* STANDARD TAB CONTENT */
        <AnimatePresence mode="wait">
          {/* TAB: BACKGROUND & LORE */}
          {activeTab === 'biography' && (
            <motion.div
              key={`tab_biography_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <CharacterBackgroundTab
                key={targetPlayer._id}
                player={targetPlayer}
                isOtherPlayerView={effectiveIsOtherPlayerView}
                onBioUpdated={(updated) => setCharacterBio(updated)}
              />
            </motion.div>
          )}

          {/* TAB: FAMILY TREE & RELATIONSHIPS */}
          {activeTab === 'family_tree' && (
            <motion.div
              key={`tab_family_tree_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <CharacterFamilyTreeTab
                key={targetPlayer._id}
                player={targetPlayer}
                isOtherPlayerView={effectiveIsOtherPlayerView}
                privacySettings={characterBio?.privacySettings}
                onPrivacyUpdated={(updatedPrivacy) => {
                  if (targetPlayer) {
                    const updatedBio: CharacterBio = {
                      ...(characterBio || { playerId: targetPlayer._id }),
                      playerId: targetPlayer._id,
                      privacySettings: updatedPrivacy,
                      updatedAt: new Date().toISOString(),
                    };
                    CampaignManager.saveCharacterBio(updatedBio);
                    setCharacterBio(updatedBio);
                  }
                }}
              />
            </motion.div>
          )}

          {/* TAB 1: NOTES */}
          {activeTab === 'notes' && (
            <motion.div
              key={`tab_notes_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <CharacterNotesTab
                key={targetPlayer._id}
                notes={notes}
                isOtherPlayerView={effectiveIsOtherPlayerView}
                privacySettings={characterBio?.privacySettings}
                onTogglePrivacy={handleTogglePrivacy}
                onOpenCreateNote={() => {
                  setIsAskDm(false);
                  setIsNoteModalOpen(true);
                }}
                onSelectNote={(note) => setSelectedNote(note)}
                characterName={targetPlayer.characterName}
              />
            </motion.div>
          )}

          {/* TAB 2: QUESTS */}
          {activeTab === 'quests' && (
            <motion.div
              key={`tab_quests_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <CharacterQuestsTab
                key={targetPlayer._id}
                quests={quests}
                isOtherPlayerView={effectiveIsOtherPlayerView}
                privacySettings={characterBio?.privacySettings}
                onTogglePrivacy={handleTogglePrivacy}
                onOpenCreateQuest={() => {
                  setEditingQuest(null);
                  setIsQuestModalOpen(true);
                }}
                onEditQuest={(quest) => {
                  setEditingQuest(quest);
                  setIsQuestModalOpen(true);
                }}
                onToggleQuestStatus={(quest, newStatus) =>
                  handleToggleQuestStatus(quest, newStatus)
                }
                onRequestDeleteQuest={(questId) => setQuestToDelete(questId)}
                characterName={targetPlayer.characterName}
              />
            </motion.div>
          )}

          {/* TAB 3: DM QUESTIONS */}
          {activeTab === 'dm_questions' && (
            <motion.div
              key={`tab_dm_questions_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              {!isOwnProfile && !player?.isDm ? (
                <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-amber-400">
                    <Lock size={22} />
                  </div>
                  <h3 className="font-heading text-sm font-semibold text-content-1">
                    Comunicazioni con il Dungeon Master Riservate
                  </h3>
                  <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
                    Le conversazioni private e i chiarimenti di regole tra {targetPlayer.characterName} e il Master sono strettamente confidenziali.
                  </p>
                </div>
              ) : filteredDmQuestions.length === 0 ? (
                <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
                  <HelpCircle size={32} className="mx-auto text-amber-400/60" />
                  <h3 className="font-heading text-sm font-semibold text-content-1">
                    Nessuna domanda inviata al Dungeon Master
                  </h3>
                  <p className="text-xs text-content-3 max-w-md mx-auto">
                    {isOwnProfile
                      ? 'Hai dubbi sulla lore, desideri un chiarimento sulle tue capacità o vuoi chiedere un\'azione privata al Master?'
                      : `${targetPlayer.characterName} non ha ancora inviato domande o richieste private al Dungeon Master.`}
                  </p>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAskDm(true);
                        setIsNoteModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500 text-surface-0 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 mt-1 shadow-xs cursor-pointer hover:bg-amber-600"
                    >
                      <HelpCircle size={13} /> Fai una domanda al DM
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredDmQuestions.map((q) => (
                    <div
                      key={q._id}
                      className="bg-surface-1 border border-surface-2 rounded-xl p-5 space-y-3.5 transition-all shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold uppercase">
                              Chiarimento Riservato
                            </span>
                            <h3 className="font-heading font-semibold text-sm text-content-1">
                              {q.title}
                            </h3>
                          </div>
                          <p className="text-[11px] text-content-3">
                            Inviata da {targetPlayer.characterName} il {new Date(q._createdAt).toLocaleDateString('it-IT')}
                          </p>
                        </div>

                        {q.dmResponse?.text ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium rounded-md flex items-center gap-1">
                            <CheckCircle2 size={12} /> Risposta Ricevuta
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium rounded-md flex items-center gap-1 animate-pulse">
                            <Clock size={12} /> In Attesa del Master
                          </span>
                        )}
                      </div>

                      <div className="bg-surface-2/60 border border-surface-3 rounded-lg p-3.5 text-xs text-content-2 space-y-1.5">
                        <div className="font-medium text-content-1 flex items-center gap-1.5 text-primary text-[11px]">
                          <Lock size={11} /> {isOwnProfile ? 'La tua domanda:' : `Domanda di ${targetPlayer.characterName}:`}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{q.content}</p>
                      </div>

                      {/* DM Response block */}
                      {q.dmResponse?.text ? (
                        <div className="bg-primary/10 border border-primary/25 rounded-lg p-3.5 text-xs space-y-1.5">
                          <div className="font-heading font-semibold text-primary flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <Crown size={13} /> Risposta del DM ({q.dmResponse.answeredBy})
                            </span>
                            <span className="text-[10px] font-mono text-content-3">
                              {new Date(q.dmResponse.answeredAt).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                          <p className="text-content-1 whitespace-pre-wrap leading-relaxed">
                            {q.dmResponse.text}
                          </p>
                        </div>
                      ) : player?.isDm ? (
                        /* DM Input Response Area */
                        <div className="bg-surface-2 border border-surface-3 rounded-lg p-3.5 space-y-2.5">
                          <label className="block text-xs font-medium text-amber-400 flex items-center gap-1.5">
                            <Crown size={13} /> Rispondi come Dungeon Master a {targetPlayer.characterName}:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Inserisci qui la tua risposta per il giocatore..."
                            value={selectedNote?._id === q._id ? dmReplyText : ''}
                            onFocus={() => setSelectedNote(q)}
                            onChange={(e) => setDmReplyText(e.target.value)}
                            className="w-full bg-surface-1 border border-surface-3 focus:border-amber-400 rounded-lg p-2.5 text-xs text-content-1 outline-none transition-colors"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleSendDmReply(q)}
                              className="px-3.5 py-1.5 bg-amber-500 text-surface-0 hover:bg-amber-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Send size={12} /> Invia Risposta Riservata
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-content-3 italic flex items-center gap-1.5">
                          <Sparkles size={12} className="text-amber-400" /> Il DM risponderà al più presto a questo chiarimento.
                        </div>
                      )}

                      {/* Clarification Management Actions Footer */}
                      <div className="pt-2 border-t border-surface-2 flex items-center justify-between gap-2 flex-wrap text-xs">
                        {player?.isDm ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            {q.dmResponse?.text && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDmClarificationResolved(q._id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                                    q.dmResponse.isResolved
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-surface-2 text-content-2 border-surface-3 hover:text-content-1'
                                  }`}
                                >
                                  <CheckCircle2 size={12} />
                                  <span>{q.dmResponse.isResolved ? 'Risolto' : 'Segna Risolto'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteDmReply(q._id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-mono text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Elimina la risposta del Master"
                                >
                                  <Trash2 size={12} />
                                  <span>Elimina Risposta</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveClarification(q._id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Rimuovi questo chiarimento dalla visuale del Master"
                            >
                              <EyeOff size={12} />
                              <span>Rimuovi dal Master</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveClarification(q._id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Rimuovi questo chiarimento dal tuo profilo"
                            >
                              <EyeOff size={12} />
                              <span>Rimuovi dal mio profilo</span>
                            </button>

                            {!q.dmResponse?.text && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClarificationRequest(q._id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-mono text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Annulla la richiesta di chiarimento"
                              >
                                <Trash2 size={12} />
                                <span>Annulla Richiesta</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: MEMORIES & SCRAPBOOK */}
          {activeTab === 'memories' && (
            <motion.div
              key={`tab_memories_${targetPlayer._id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <CharacterMemoriesTab
                key={targetPlayer._id}
                memories={scrapbook}
                isOtherPlayerView={effectiveIsOtherPlayerView}
                privacySettings={characterBio?.privacySettings}
                onTogglePrivacy={handleTogglePrivacy}
                onOpenCreateMemory={() => setIsMemoryModalOpen(true)}
                onSelectMemory={(item) => setSelectedMemory(item)}
                characterName={targetPlayer.characterName}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. EDIT PROFILE & EMBLEM COLOR MODAL */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <Portal>
            <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-1 border border-surface-2 rounded-xl p-5 max-w-lg w-full space-y-5 shadow-xl relative max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between border-b border-surface-2 pb-3.5">
                  <h2 className="font-heading font-semibold text-base text-content-1 flex items-center gap-2">
                    <User size={16} className="text-primary" /> Modifica Identità Personaggio
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Character Name */}
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1.5">
                      Nome del Personaggio
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none transition-colors"
                    />
                  </div>

                  {/* Character Avatar */}
                  <div>
                    <SingleImageUploader
                      value={editAvatar}
                      onChange={setEditAvatar}
                      label="Avatar / Immagine Personaggio"
                      placeholder="URL immagine o carica file..."
                      aspectRatio="square"
                      previewHeightClass="h-24"
                      entityName={editName}
                      entityType="player"
                      contextDescription="Personaggio giocabile per D&D"
                    />
                  </div>

                  {/* Emblem Color Customization */}
                  <div className="space-y-3 pt-1 border-t border-surface-2/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-content-2 flex items-center gap-1.5">
                        <Palette size={13} className="text-primary" /> Colore Emblema Personaggio
                      </label>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-surface-3 shadow-inner"
                          style={{ backgroundColor: editColor }}
                        />
                        <span className="font-mono text-xs text-content-1 font-semibold">
                          {editColor.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Preset Color Swatches */}
                    <div>
                      <span className="text-[10px] text-content-3 block mb-1.5">Tavolozze Consigliate:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setEditColor(c.hex)}
                            title={`${c.name} (${c.hex})`}
                            className={`w-6 h-6 rounded-md transition-transform relative cursor-pointer ${
                              editColor.toLowerCase() === c.hex.toLowerCase()
                                ? 'scale-110 ring-2 ring-content-1 shadow-sm'
                                : 'opacity-70 hover:opacity-100 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {editColor.toLowerCase() === c.hex.toLowerCase() && (
                              <Check size={12} className="text-white absolute inset-0 m-auto drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Hex / Pipette Picker */}
                    <div className="bg-surface-2/60 border border-surface-3 rounded-lg p-3 space-y-2">
                      <span className="text-[10px] font-medium text-content-2 flex items-center gap-1">
                        <Pipette size={12} className="text-primary" /> Personalizza Colore Hex
                      </span>
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex items-center">
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 overflow-hidden"
                            title="Selettore colore tavolozza libera"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            placeholder="#RRGGBB"
                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs font-mono text-content-1 outline-none"
                          />
                        </div>
                      </div>

                      {/* Live Preview of Emblem badge */}
                      <div className="flex items-center gap-2.5 pt-1.5 border-t border-surface-3/60">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-sm text-surface-0 shadow-xs transition-colors"
                          style={{ backgroundColor: editColor }}
                        >
                          {editName ? editName.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="text-[11px]">
                          <p className="font-semibold text-content-1">Anteprima Emblema Scheda</p>
                          <p className="text-[10px] text-content-3">Questo colore identifica la tua cornice, note e avatar.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-surface-2">
                    <button
                      type="button"
                      onClick={() => setIsEditProfileOpen(false)}
                      className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check size={13} />
                      <span>{profileSuccess ? 'Salvato!' : 'Salva Profilo'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* 2. CREATE MEMORY / PHOTO MODAL */}
      <AnimatePresence>
        {isMemoryModalOpen && (
          <Portal>
            <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-1 border border-surface-2 rounded-xl p-5 max-w-lg w-full space-y-4 shadow-xl relative max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between border-b border-surface-2 pb-3.5">
                  <h2 className="font-heading font-semibold text-base text-content-1 flex items-center gap-2">
                    <ImageIcon size={16} className="text-purple-400" /> Aggiungi Memoria Visiva
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsMemoryModalOpen(false)}
                    className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleCreateMemory} className="space-y-3.5">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1">
                      Titolo della Memoria *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es. Incontro alla locanda..."
                      value={memoryTitle}
                      onChange={(e) => setMemoryTitle(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-3 py-2 text-xs text-content-1 outline-none transition-colors"
                    />
                  </div>

                  {/* Photo Uploader */}
                  <div>
                    <SingleImageUploader
                      value={memoryImage}
                      onChange={setMemoryImage}
                      label="Immagine Memoria (Carica o URL) *"
                      placeholder="https://... o carica un file"
                      aspectRatio="video"
                      previewHeightClass="h-36"
                      entityName={memoryTitle || player.characterName}
                      entityType="moment"
                      contextDescription={`Memoria o scena per ${player.characterName}`}
                    />
                  </div>

                  {/* Caption / Spunto narrativo */}
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1">
                      Didascalia / Spunto Narrativo
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Descrivi questo momento o annotazione..."
                      value={memoryCaption}
                      onChange={(e) => setMemoryCaption(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg p-2.5 text-xs text-content-1 outline-none transition-colors"
                    />
                  </div>

                  {/* Category & Lore Date Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-content-2 mb-1">
                        Categoria Memoria
                      </label>
                      <select
                        value={memoryCategory}
                        onChange={(e) => setMemoryCategory(e.target.value as ScrapbookItem['category'])}
                        className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none transition-colors"
                      >
                        <option value="moment">Momento Saliente</option>
                        <option value="character">Personaggio / PNG</option>
                        <option value="place">Luogo / Paesaggio</option>
                        <option value="monster">Mostro / Creatura</option>
                        <option value="artifact">Oggetto Magico / Artefatto</option>
                        <option value="handout">Indizio / Documento</option>
                        <option value="map">Mappa</option>
                      </select>
                    </div>

                    <div>
                      <LoreDateInput
                        label="Data Lore / Sessione (Opzionale)"
                        placeholder="Es. 15 Eleint 1492 DR"
                        value={memoryLoreDate}
                        onChange={setMemoryLoreDate}
                        inputClassName="rounded-lg px-2.5 py-1.5 border-surface-3 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-surface-2">
                    <button
                      type="button"
                      onClick={() => setIsMemoryModalOpen(false)}
                      className="px-3.5 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={!memoryTitle.trim() || !memoryImage.trim()}
                      className="px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-surface-0 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check size={13} />
                      <span>Salva Memoria</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* 3. MEMORY LIGHTBOX / VIEWER MODAL */}
      <AnimatePresence>
        {selectedMemory && (
          <Portal>
            <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-1 border border-surface-2 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto"
              >
                <div className="relative bg-black flex items-center justify-center max-h-[50vh] overflow-hidden">
                  <img
                    src={selectedMemory.imageUrl}
                    alt={selectedMemory.title}
                    className="w-full h-full object-contain max-h-[50vh]"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedMemory(null)}
                    className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold uppercase rounded-md">
                          {selectedMemory.category}
                        </span>
                        <h2 className="font-heading font-semibold text-base text-content-1">
                          {selectedMemory.title}
                        </h2>
                      </div>
                      {selectedMemory.loreDate && (
                        <p className="text-xs text-content-3 flex items-center gap-1">
                          <Calendar size={12} /> {selectedMemory.loreDate}
                        </p>
                      )}
                    </div>

                    {(isOwnProfile || player.isDm || (selectedMemory.authorName && selectedMemory.authorName.toLowerCase() === player.characterName.toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemoryToDelete(selectedMemory.id);
                        }}
                        className="p-1.5 text-content-3 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Elimina Memoria"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {selectedMemory.caption && (
                    <div className="bg-surface-2/60 border border-surface-3 rounded-lg p-3 text-xs text-content-2 leading-relaxed whitespace-pre-wrap">
                      {selectedMemory.caption}
                    </div>
                  )}

                  {selectedMemory.tags && selectedMemory.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {selectedMemory.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-surface-2 text-content-3 text-[10px] rounded-md border border-surface-3 flex items-center gap-1"
                        >
                          <Tag size={10} /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* 4. UNIFIED NOTE MODAL */}
      <NoteModal
        isOpen={isNoteModalOpen}
        initialNote={editingNote}
        defaultValues={{
          visibility: 'personal',
          askDm: isAskDm,
        }}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
          setIsAskDm(false);
        }}
        onSaved={(savedNote) => {
          loadData();
          if (savedNote.askDm) setActiveTab('dm_questions');
          else setActiveTab('notes');
        }}
      />

      {/* 5. UNIFIED QUEST MODAL */}
      <QuestModal
        isOpen={isQuestModalOpen}
        onClose={() => {
          setIsQuestModalOpen(false);
          setEditingQuest(null);
        }}
        initialQuest={editingQuest}
        defaultValues={{
          questScope: 'personal',
          questPrivacy: 'public',
          assigneePlayerId: player._id,
        }}
        onSaved={() => {
          loadData();
          setActiveTab('quests');
        }}
      />

      {/* 6. READ NOTE MODAL */}
      <AnimatePresence>
        {selectedNote && (
          <Portal>
            <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-1 border border-surface-2 rounded-xl p-5 max-w-xl w-full space-y-4 shadow-xl max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-surface-2 pb-3 shrink-0">
                  <div className="min-w-0 pr-3">
                    <h2 className="font-heading font-semibold text-base text-content-1 truncate">
                      {selectedNote.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-content-3">
                      <span>Creato il {new Date(selectedNote._createdAt).toLocaleDateString('it-IT')}</span>
                      {selectedNote.category && (
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium rounded-md border"
                          style={{
                            backgroundColor: `${selectedNote.category.color || '#6366f1'}15`,
                            borderColor: `${selectedNote.category.color || '#6366f1'}30`,
                            color: selectedNote.category.color || '#6366f1',
                          }}
                        >
                          {selectedNote.category.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const noteToEdit = selectedNote;
                        setSelectedNote(null);
                        setEditingNote(noteToEdit);
                        setIsNoteModalOpen(true);
                      }}
                      className="p-1.5 text-content-3 hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                      title="Modifica Nota"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(selectedNote._id)}
                      className="p-1.5 text-content-3 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                      title="Elimina Nota"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedNote(null)}
                      className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3.5 custom-scrollbar pr-1">
                  {selectedNote.content ? (
                    <div className="text-content-2 leading-relaxed text-xs">
                      <MarkdownRenderer content={selectedNote.content} />
                    </div>
                  ) : (
                    <p className="text-xs text-content-3 italic">Nessun contenuto registrato per questa nota.</p>
                  )}

                  {selectedNote.images && selectedNote.images.length > 0 && (
                    <div className="pt-2.5 border-t border-surface-2">
                      <h4 className="text-xs font-semibold text-content-2 mb-1.5">Allegati & Immagini</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedNote.images.map((img, idx) => (
                          <div key={idx} className="rounded-lg border border-surface-2 overflow-hidden bg-surface-2 aspect-video">
                            <img
                              src={typeof img === 'string' ? img : (img as any).url}
                              alt="Allegato"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNote.dmResponse?.text && (
                    <div className="bg-primary/10 border border-primary/25 rounded-lg p-3 space-y-1.5 mt-3">
                      <div className="font-heading font-semibold text-xs text-primary flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Crown size={13} /> Risposta dal DM ({selectedNote.dmResponse.answeredBy})
                        </span>
                      </div>
                      <p className="text-xs text-content-1 whitespace-pre-wrap leading-relaxed">
                        {selectedNote.dmResponse.text}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* 7. CONFIRM DELETE MODALS */}
      <ConfirmModal
        isOpen={!!questToDelete}
        onCancel={() => setQuestToDelete(null)}
        onConfirm={() => questToDelete && handleDeleteQuest(questToDelete)}
        title="Elimina Quest Personale"
        message="Sei sicuro di voler eliminare questo obiettivo? L'azione è irreversibile."
        confirmLabel="Elimina"
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={!!memoryToDelete}
        onCancel={() => setMemoryToDelete(null)}
        onConfirm={() => memoryToDelete && handleDeleteMemory(memoryToDelete)}
        title="Elimina Memoria Visiva"
        message="Sei sicuro di voler eliminare questa memoria? L'immagine e la didascalia verranno rimosse."
        confirmLabel="Elimina"
        isDestructive={true}
      />
    </div>
  );
}
