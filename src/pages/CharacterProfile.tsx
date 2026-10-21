import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { FirebaseStorageService } from '../lib/firebaseStorageService';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Note, Entity, Category, ScrapbookItem, DmResponse, CharacterBio, CharacterRelationship, EntityPartyRelation, EntityAiConfig, EntityToEntityRelation, RelationAttitude, TimelineMemoryEntry, EvolvingBelief, CharacterKnownLoreItem } from '../types';
import { SingleImageUploader } from '../components/SingleImageUploader';
import { ConfirmModal } from '../components/ConfirmModal';
import { OcrButton } from '../components/OcrButton';
import { NoteModal } from '../components/NoteModal';
import { QuestModal } from '../components/QuestModal';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { LoreDateInput } from '../components/LoreDateInput';
import { extractTextFromContent } from '../lib/sanitize';
import { Portal } from '../components/Portal';
import { CharacterBackgroundTab } from '../components/character/CharacterBackgroundTab';
import { CharacterFamilyTreeTab } from '../components/character/CharacterFamilyTreeTab';
import { CharacterNotesTab } from '../components/character/CharacterNotesTab';
import { CharacterQuestsTab } from '../components/character/CharacterQuestsTab';
import { CharacterMemoriesTab } from '../components/character/CharacterMemoriesTab';
import { CharacterGrimoireFolio } from '../components/character/CharacterGrimoireFolio';
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
  RefreshCw,
  Scroll,
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

type ProfileTab = 'biography' | 'mind' | 'family_tree' | 'notes' | 'quests' | 'dm_questions' | 'memories';
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
  const [notesHubSubTab, setNotesHubSubTab] = useState<'notes' | 'dm_questions'>(
    defaultTab === 'dm_questions' ? 'dm_questions' : 'notes'
  );
  const [questsHubSubTab, setQuestsHubSubTab] = useState<'quests' | 'memories'>('quests');
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
    if (!targetPlayer?.characterName && !characterBio?.entityId) return null;
    if (characterBio?.entityId) {
      const foundById = entities.find((e) => e._id === characterBio.entityId);
      if (foundById) return foundById;
    }
    if (!targetPlayer?.characterName) return null;
    const cleanName = targetPlayer.characterName.toLowerCase().trim();
    return (
      entities.find(
        (e) =>
          (e.name || '').toLowerCase().trim() === cleanName ||
          (e.aliases && Array.isArray(e.aliases) && e.aliases.some((a) => typeof a === 'string' && a.toLowerCase().trim() === cleanName))
      ) || null
    );
  }, [entities, targetPlayer?.characterName, characterBio?.entityId]);
  
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
    let bio = CampaignManager.getCharacterBio(targetPlayer._id);
    const relations = CampaignManager.getFamilyRelations(targetPlayer._id);

    // Auto-heal bio name locally if missing
    const isGenericName = (n?: string | null) => !n || ['personaggio', 'avventuriero', 'player', 'giocatore'].includes(n.trim().toLowerCase());
    const realCharName = !isGenericName(targetPlayer.characterName)
      ? targetPlayer.characterName
      : (!isGenericName(account?.characterName) ? account?.characterName : null);

    if (bio && realCharName && (isGenericName(bio.characterName) || isGenericName((bio as any).name))) {
      bio = { ...bio, characterName: realCharName, name: realCharName };
    }

    // Consolidate memories, beliefs, and knowledges from matching Codex entity (if any)
    const cleanTargetCharName = (targetPlayer.characterName || '').trim().toLowerCase();
    const codexEnt = allEntities.find((e) => {
      if (!e) return false;
      const cleanEntName = (e.name || '').trim().toLowerCase();
      if (!cleanEntName || cleanEntName === 'avventuriero' || cleanEntName === 'personaggio') return false;
      return (
        cleanEntName === cleanTargetCharName ||
        (e.aliases && Array.isArray(e.aliases) && e.aliases.some((a) => typeof a === 'string' && a.trim().toLowerCase() === cleanTargetCharName))
      );
    });

    if (codexEnt?.aiConfig) {
      if (!bio) {
        bio = {
          playerId: targetPlayer._id,
          characterName: codexEnt.name,
          name: codexEnt.name,
          color: codexEnt.color || '#6366f1',
          timelineMemories: [],
          evolvingBeliefs: [],
          knownLoreBites: [],
        };
      }

      let bioChanged = false;
      const existingMemIds = new Set((bio.timelineMemories || []).map((m) => m.id || `${m.sessionId}_${m.title}`));
      const mergedMemories = [...(bio.timelineMemories || [])];
      (codexEnt.aiConfig.timelineMemories || []).forEach((m) => {
        const key = m.id || `${m.sessionId}_${m.title}`;
        if (m && !existingMemIds.has(key)) {
          existingMemIds.add(key);
          mergedMemories.push(m);
          bioChanged = true;
        }
      });

      const existingBeliefSubjects = new Set((bio.evolvingBeliefs || []).map((b) => (b.subject || '').toLowerCase().trim()));
      const mergedBeliefs = [...(bio.evolvingBeliefs || [])];
      (codexEnt.aiConfig.evolvingBeliefs || []).forEach((b) => {
        const key = (b.subject || '').toLowerCase().trim();
        if (b && key && !existingBeliefSubjects.has(key)) {
          existingBeliefSubjects.add(key);
          mergedBeliefs.push(b);
          bioChanged = true;
        }
      });

      const existingBites = new Set((bio.knownLoreBites || []).map((k) => `${k.articleId}_${k.biteId}`));
      const mergedBites = [...(bio.knownLoreBites || [])];
      (codexEnt.aiConfig.knownLoreBites || []).forEach((k) => {
        const key = `${k.articleId}_${k.biteId}`;
        if (k && !existingBites.has(key)) {
          existingBites.add(key);
          mergedBites.push(k);
          bioChanged = true;
        }
      });

      if (bioChanged) {
        bio = {
          ...bio,
          timelineMemories: mergedMemories,
          evolvingBeliefs: mergedBeliefs,
          knownLoreBites: mergedBites,
        };
        CampaignManager.saveCharacterBio(bio);
      }
    }

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
    const isDM = Boolean(player?.isDm);
    const targetCharName = (targetPlayer.characterName || '').trim().toLowerCase();
    const accountCharName = (account?.characterName || '').trim().toLowerCase();
    const bioCharName = (bio?.characterName || (bio as any)?.name || '').trim().toLowerCase();
    const targetPlayerId = (targetPlayer._id || (targetPlayer as any).id || '').toLowerCase();
    const accountId = (account?.id || '').toLowerCase();
    const bioPlayerId = (bio?.playerId || '').toLowerCase();

    const candidateNames = [targetCharName, accountCharName, bioCharName]
      .filter((n) => n && !isGenericName(n));
    if (targetPlayer.aliases && Array.isArray(targetPlayer.aliases)) {
      targetPlayer.aliases.forEach((a) => {
        if (a && typeof a === 'string') candidateNames.push(a.trim().toLowerCase());
      });
    }
    if (account?.aliases && Array.isArray(account.aliases)) {
      account.aliases.forEach((a) => {
        if (a && typeof a === 'string') candidateNames.push(a.trim().toLowerCase());
      });
    }

    const candidateIds = [
      targetPlayerId,
      accountId,
      bioPlayerId,
      ...(account?.previousAccountIds || []).map((id) => String(id).toLowerCase()),
      ...(targetPlayer.email ? [targetPlayer.email.toLowerCase()] : []),
      ...(account?.email ? [account.email.toLowerCase()] : []),
    ].filter(Boolean);

    const targetMemories = allScrapbook.filter((s) => {
      const sAuthor = (s.authorName || '').trim().toLowerCase();
      const sEntityId = (s.entityId || '').trim().toLowerCase();
      const authorMatch = Boolean(sAuthor && (candidateNames.includes(sAuthor) || sAuthor === targetCharName));
      const entityMatch = Boolean(sEntityId && (candidateIds.includes(sEntityId) || (s.entityType === 'character' && candidateIds.includes(sEntityId))));
      const tagMatch = Boolean(s.tags && Array.isArray(s.tags) && s.tags.some((t) => {
        if (typeof t !== 'string') return false;
        const cleanT = t.trim().toLowerCase();
        return candidateNames.includes(cleanT) || candidateIds.includes(cleanT);
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
      const cleanPUrl = CampaignManager.cleanAvatarString(player.avatarUrl);
      const cleanAccUrl = CampaignManager.cleanAvatarString(account?.avatarUrl);
      const safePUrl = (!player.isDm && CampaignManager.isDmAvatar(cleanPUrl)) ? '' : cleanPUrl;
      const safeAccUrl = account?.isDm ? cleanAccUrl : '';
      setEditAvatar(safePUrl || safeAccUrl || '');
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
    const rawTargetAvatar = characterBio?.avatarUrl || targetPlayer?.avatarUrl || '';
    const cleanAvatar = CampaignManager.cleanAvatarString(rawTargetAvatar);
    const isTargetDm = Boolean(targetPlayer?.isDm || (targetPlayer as any)?.role === 'dm');
    const safeAvatar = (!isTargetDm && CampaignManager.isDmAvatar(cleanAvatar)) ? '' : cleanAvatar;
    setEditName(characterBio?.characterName || targetPlayer?.characterName || '');
    setEditAvatar(safeAvatar);
    setEditColor(characterBio?.color || targetPlayer?.color || '#6366f1');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim();
    const cleanAvatar = CampaignManager.cleanAvatarString(editAvatar);
    const cleanColor = editColor || '#6366f1';

    const activeCode = CampaignManager.getActiveCampaignCode();
    const targetId = targetPlayer?._id || targetPlayer?.id || account?.id;
    if (!targetId) return;

    if (activeCode) {
      CampaignManager.setCampaignProfile(targetId, activeCode, {
        characterName: cleanName || undefined,
        color: cleanColor,
        avatarUrl: cleanAvatar,
      });

      // Authoritative synchronization to CharacterBio for this player in this campaign (SSOT)
      const existingBio = CampaignManager.getCharacterBio(targetId);
      const updatedBio: CharacterBio = {
        ...(existingBio || { playerId: targetId }),
        playerId: targetId,
        campaignCode: activeCode,
        characterName: cleanName || existingBio?.characterName || targetPlayer?.characterName || 'Personaggio',
        name: cleanName || existingBio?.characterName || targetPlayer?.characterName || 'Personaggio',
        avatarUrl: cleanAvatar,
        color: cleanColor,
        updatedAt: new Date().toISOString(),
      };
      await CampaignManager.saveCharacterBio(updatedBio);
      setCharacterBio(updatedBio);
    }

    if (isOwnProfile && account) {
      updateAccountProfile({
        color: cleanColor,
      });
    }

    setProfileSuccess(true);
    setTimeout(() => {
      setProfileSuccess(false);
      setIsEditProfileOpen(false);
    }, 1200);
  };

  const [isUploadingMemoryImage, setIsUploadingMemoryImage] = useState(false);

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim() || !memoryImage.trim() || !targetPlayer) return;

    let finalImageUrl = memoryImage.trim();
    if (!finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://')) {
      setIsUploadingMemoryImage(true);
      try {
        const code = CampaignManager.getActiveCampaignCode() || 'default';
        finalImageUrl = await FirebaseStorageService.uploadMedia(
          code,
          'scrapbook',
          memoryTitle.trim(),
          memoryImage.trim()
        );
      } catch (err) {
        console.warn('Errore upload memoria su Supabase Storage:', err);
      } finally {
        setIsUploadingMemoryImage(false);
      }
    }

    // Do NOT store raw base64 in scrapbook items
    if (!finalImageUrl || (!finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://'))) {
      console.warn('[handleCreateMemory] Immagine non valida o upload fallito su Supabase Storage.');
      return;
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
    CampaignManager.updateEntityStatus(quest._id, newStatus);
    const updated = CampaignManager.getEntities();
    setQuests(updated.filter((e) => e.type === 'quest' && (e.questScope === 'personal' || e.assigneePlayerId === player._id)));
  };

  const handleDeleteNote = (noteId: string) => {
    CampaignManager.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n._id !== noteId));
    setNoteToDelete(null);
    if (selectedNote?._id === noteId) setSelectedNote(null);
  };

  const handleDeleteQuest = (questId: string) => {
    CampaignManager.deleteEntity(questId);
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
    CampaignManager.replyToDmClarification(
      note._id,
      dmReplyText.trim(),
      player.characterName || 'Dungeon Master',
      true
    );
    setDmReplyText('');
    loadData();
    if (selectedNote?._id === note._id) {
      setSelectedNote({
        ...selectedNote,
        dmResponse: {
          text: dmReplyText.trim(),
          answeredAt: new Date().toISOString(),
          answeredBy: player.characterName || 'Dungeon Master',
          isResolved: true,
        },
      });
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
    const charName = (targetPlayer.characterName || '').trim();
    const existingEnt = matchedCodexEntity;

    // 1. Gather and merge all dynamic memories, beliefs and current status from PG profile and Codex
    const memMap = new Map<string, TimelineMemoryEntry>();
    (existingEnt?.aiConfig?.timelineMemories || []).forEach((m) => {
      if (m) memMap.set(m.id || `${m.sessionId}_${m.title}`, m);
    });
    (currentBio?.timelineMemories || []).forEach((m) => {
      if (m) memMap.set(m.id || `${m.sessionId}_${m.title}`, m);
    });
    const timelineMemories = Array.from(memMap.values());

    const beliefMap = new Map<string, EvolvingBelief>();
    (existingEnt?.aiConfig?.evolvingBeliefs || []).forEach((b) => {
      if (b && b.subject) beliefMap.set(b.subject.toLowerCase().trim(), b);
    });
    (currentBio?.evolvingBeliefs || []).forEach((b) => {
      if (b && b.subject) beliefMap.set(b.subject.toLowerCase().trim(), b);
    });
    const evolvingBeliefs = Array.from(beliefMap.values());

    const biteMap = new Map<string, CharacterKnownLoreItem>();
    (existingEnt?.aiConfig?.knownLoreBites || []).forEach((k) => {
      if (k && k.articleId && k.biteId) biteMap.set(`${k.articleId}_${k.biteId}`, k);
    });
    (currentBio?.knownLoreBites || []).forEach((k) => {
      if (k && k.articleId && k.biteId) biteMap.set(`${k.articleId}_${k.biteId}`, k);
    });
    const knownLoreBites = Array.from(biteMap.values());

    const currentStatus =
      currentBio?.currentStatus?.trim() ||
      `${currentBio?.characterClass || 'Avventuriero'} attivo della Compagnia`;

    // 2. Gather active personal quests / goals
    const openQuests = quests.filter(
      (q) =>
        q.status === 'open' &&
        (q.assigneePlayerId === targetPlayer._id ||
          q.assigneePlayerName?.toLowerCase() === charName.toLowerCase() ||
          q.questScope === 'personal')
    );

    // 3. Known Session IDs (from memories + attended campaign sessions)
    const knownSessionIds = new Set<string>();
    timelineMemories.forEach((m) => {
      if (m.sessionId) knownSessionIds.add(m.sessionId);
    });
    try {
      const allSessions = CampaignManager.getSessions();
      allSessions.forEach((s) => {
        if (
          s.attendeePlayerIds?.includes(targetPlayer._id) ||
          (s.title && s.title.toLowerCase().includes(charName.toLowerCase()))
        ) {
          knownSessionIds.add(s._id || (s as any).id);
        }
      });
    } catch {}

    // 4. Entity relations (NPCs, Factions, Places linked in relations)
    const pRelations = CampaignManager.getFamilyRelations(targetPlayer._id);
    const entityRelations: Record<string, EntityToEntityRelation> = {};
    pRelations.forEach((r) => {
      const targetId =
        r.linkedEntityId ||
        entities.find((e) => e.name.toLowerCase().trim() === r.name.toLowerCase().trim())?._id;
      if (targetId) {
        let attitude: RelationAttitude = 'neutral';
        if (
          r.relationshipType === 'enemy' ||
          r.relationshipType === 'rival'
        ) {
          attitude = 'hostile';
        } else if (
          ['mentor', 'ally', 'spouse', 'child', 'sibling', 'parent'].includes(r.relationshipType)
        ) {
          attitude = 'friendly';
        }
        entityRelations[targetId] = {
          targetEntityId: targetId,
          targetEntityName: r.name,
          relationType: r.customRelationshipLabel || r.titleOrRole || r.relationshipType,
          attitude,
          notes: r.bio || r.titleOrRole || '',
        };
      }
    });

    // 5. Party relations (Companions with real inter-party attitudes)
    const partyRelations: Record<string, EntityPartyRelation> = {};
    allPlayers
      .filter((p) => p._id !== targetPlayer._id)
      .forEach((otherP) => {
        const res = CampaignManager.resolveCompanionRelation(
          currentBio,
          otherP,
          pRelations,
          null
        );

        partyRelations[otherP._id] = {
          playerId: otherP._id,
          characterName: otherP.characterName,
          relationType: res.relationType,
          attitude: res.attitude as RelationAttitude,
          notes: res.notes,
          progression: res.progression || [],
        };
      });

    // 6. Compose rich progress note description in structured Markdown
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

    if (currentStatus) {
      descriptionParts.push(`### Situazione Attuale & Stato\n${currentStatus}\n`);
    }
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

    if (openQuests.length > 0) {
      descriptionParts.push(
        `### Obiettivi & Quest Personali Attive\n${openQuests
          .map((q) => `- **${q.name}**: ${q.progressNote || 'In corso'}`)
          .join('\n')}\n`
      );
    }

    if (timelineMemories.length > 0) {
      const recentMemories = timelineMemories.slice(-8);
      descriptionParts.push(
        `### Cronologia Ricordi & Memoria Storica\n${recentMemories
          .map((m) => `- [${m.loreDate || 'Evento'}] **${m.title}**: ${m.summary}`)
          .join('\n')}\n`
      );
    }

    if (evolvingBeliefs.length > 0) {
      descriptionParts.push(
        `### Credenze, Teorie & Verità Scoperte\n${evolvingBeliefs
          .map(
            (b) =>
              `- [${b.status}] **${b.subject}**: ${b.currentTruth}${b.notes ? ` (${b.notes})` : ''}`
          )
          .join('\n')}\n`
      );
    }

    if (knownLoreBites.length > 0) {
      descriptionParts.push(
        `### Nozioni del Mondo Conosciute\n${knownLoreBites
          .map((k) => `- **${k.articleTitle} - ${k.biteTitle}**: ${k.note || ''}`)
          .join('\n')}\n`
      );
    }

    const progressNote = descriptionParts.join('\n\n') || `Membro della Compagnia di Avventurieri.`;

    // 7. Compose AI Persona Config for Sendipietra / Oracle
    const traitsStr =
      currentBio?.personalityTraits && currentBio.personalityTraits.length > 0
        ? currentBio.personalityTraits.join(', ')
        : 'determinato e leale con i compagni';

    const speechStyle = `Interpreta fedelmente ${charName} (${currentBio?.characterRace || 'Eroe'} ${currentBio?.characterClass || 'Avventuriero'}). Tratti: ${traitsStr}. Allineamento: ${currentBio?.characterAlignment || 'Neutrale'}. Parla sempre in prima persona singolare. Non rivelare segreti custoditi.`;

    const loreItemsStr = knownLoreBites.map((k) => `${k.articleTitle}: ${k.biteTitle}`).join(', ');
    const questGoalsStr = openQuests.map((q) => q.name).join(', ');

    const knowledgeScopeParts = [
      `Conosce la propria storia personale${currentBio?.hometown ? ` (originario di ${currentBio.hometown})` : ''}`,
      `Compagni di viaggio del party: ${allPlayers.map((p) => p.characterName).join(', ')}`,
      openQuests.length > 0 ? `Obiettivi attuali perseguiti: ${questGoalsStr}` : null,
      loreItemsStr ? `Nozioni di mondo e fatti noti: ${loreItemsStr}` : null,
      `Memorie storiche ed eventi vissuti nelle cronache (${timelineMemories.length} ricordi registrati)`,
    ];
    const knowledgeScope = knowledgeScopeParts.filter(Boolean).join('. ') + '.';

    const aiConfig: EntityAiConfig = {
      enabled: true,
      speechStyle,
      currentStatus,
      knowledgeScope,
      secretsToProtect: currentBio?.secrets || '',
      timelineMemories,
      evolvingBeliefs,
      knownEntityIds: Object.keys(entityRelations),
      knownSessionIds: Array.from(knownSessionIds),
      partyRelations: {
        ...partyRelations,
        ...(existingEnt?.aiConfig?.partyRelations || {}),
      },
      entityRelations: {
        ...entityRelations,
        ...(existingEnt?.aiConfig?.entityRelations || {}),
      },
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

    let finalEntityId = existingEnt?._id;
    if (existingEnt) {
      // Update existing entity
      const updated = CampaignManager.updateEntity(existingEnt._id, {
        name: charName,
        aliases,
        color: targetPlayer.color || existingEnt.color,
        images: targetPlayer.avatarUrl ? [targetPlayer.avatarUrl] : existingEnt.images,
        status: entityStatus,
        progressNote,
        aiConfig: {
          ...existingEnt.aiConfig,
          ...aiConfig,
        },
      });
      finalEntityId = updated?._id || existingEnt._id;
      setEntities(CampaignManager.getEntities());
      setSyncStatusMsg(
        `Scheda di "${charName}" allineata nel Codex con memoria completa (${timelineMemories.length} ricordi, ${evolvingBeliefs.length} credenze, ${openQuests.length} obiettivi) e Persona IA!`
      );
    } else {
      // Create new Codex entity
      const created = CampaignManager.addEntity({
        name: charName,
        type: 'npc',
        aliases,
        color: targetPlayer.color || '#6366f1',
        images: targetPlayer.avatarUrl ? [targetPlayer.avatarUrl] : [],
        status: entityStatus,
        progressNote,
        aiConfig,
      });
      finalEntityId = created?._id;
      setEntities(CampaignManager.getEntities());
      setSyncStatusMsg(
        `Nuova scheda di "${charName}" creata nel Codex con memoria completa (${timelineMemories.length} ricordi, ${evolvingBeliefs.length} credenze) e Persona IA!`
      );
    }

    // Ensure CharacterBio is also updated with all merged memories, beliefs and linked entityId
    const updatedBio: CharacterBio = {
      ...(currentBio || { playerId: targetPlayer._id }),
      playerId: targetPlayer._id,
      entityId: finalEntityId || currentBio?.entityId,
      timelineMemories,
      evolvingBeliefs,
      knownLoreBites,
      updatedAt: new Date().toISOString(),
    };
    CampaignManager.saveCharacterBio(updatedBio);
    setCharacterBio(updatedBio);

    setTimeout(() => {
      setSyncStatusMsg(null);
    }, 5000);
  };

  const [isRebuildingMemories, setIsRebuildingMemories] = useState(false);

  const handleRebuildMemoriesFromSessions = async () => {
    if (!targetPlayer) return;
    setIsRebuildingMemories(true);
    try {
      const activeCode = CampaignManager.getActiveCampaignCode();
      const allSessions = CampaignManager.getSessions().sort((a, b) => a.number - b.number);
      const currentBio = characterBio || CampaignManager.getCharacterBio(targetPlayer._id) || { playerId: targetPlayer._id };
      const charName = (targetPlayer.characterName || '').trim();

      const existingMemories = [...(currentBio.timelineMemories || [])];
      const existingSessionIds = new Set(existingMemories.map((m) => m.sessionId).filter(Boolean));
      const existingSessionNumbers = new Set(existingMemories.map((m) => m.sessionNumber).filter(Boolean));

      let addedCount = 0;

      // 1. First pull in all memories from the Codex Entity (if any exist)
      if (matchedCodexEntity?.aiConfig?.timelineMemories?.length) {
        matchedCodexEntity.aiConfig.timelineMemories.forEach((m) => {
          const key = m.id || `${m.sessionId}_${m.title}`;
          if (!existingMemories.some((em) => (em.id && em.id === m.id) || (em.sessionId && em.sessionId === m.sessionId && em.title === m.title))) {
            existingMemories.push(m);
            if (m.sessionId) existingSessionIds.add(m.sessionId);
            if (m.sessionNumber) existingSessionNumbers.add(m.sessionNumber);
            addedCount++;
          }
        });
      }

      // Also pull in evolving beliefs and known lore bites from matched Codex entity
      let evolvingBeliefs = [...(currentBio.evolvingBeliefs || [])];
      if (matchedCodexEntity?.aiConfig?.evolvingBeliefs?.length) {
        const beliefKeys = new Set(evolvingBeliefs.map((b) => (b.subject || '').toLowerCase().trim()));
        matchedCodexEntity.aiConfig.evolvingBeliefs.forEach((b) => {
          const key = (b.subject || '').toLowerCase().trim();
          if (b && key && !beliefKeys.has(key)) {
            beliefKeys.add(key);
            evolvingBeliefs.push(b);
          }
        });
      }

      let knownLoreBites = [...(currentBio.knownLoreBites || [])];
      if (matchedCodexEntity?.aiConfig?.knownLoreBites?.length) {
        const biteKeys = new Set(knownLoreBites.map((k) => `${k.articleId}_${k.biteId}`));
        matchedCodexEntity.aiConfig.knownLoreBites.forEach((k) => {
          const key = `${k.articleId}_${k.biteId}`;
          if (k && !biteKeys.has(key)) {
            biteKeys.add(key);
            knownLoreBites.push(k);
          }
        });
      }

      // 2. Scan all sessions for session events / attendance
      allSessions.forEach((sess) => {
        if (existingSessionIds.has(sess._id) || existingSessionNumbers.has(sess.number)) {
          return;
        }

        const isExcluded = (sess.excludedPlayerIds || []).includes(targetPlayer._id);
        if (isExcluded) return;

        const summaryText = sess.summary?.trim() || extractTextFromContent(sess.recap)?.trim() || '';
        const titleText = sess.title?.trim() || `Sessione #${sess.number}`;
        const loreDateText = sess.loreDate || sess.calendar_date || sess.date || '';

        const charEvents = (sess.events || []).filter((e: any) => {
          const desc = `${e.title || ''} ${e.description || ''}`.toLowerCase();
          return desc.includes(charName.toLowerCase()) || e.impact === 'major';
        });

        const bulletPoints = charEvents.map((e: any) => `• ${e.title}: ${e.description || ''}`).join('\n');
        const fullSummary = bulletPoints ? `${summaryText}\n\nFatti Salienti per ${charName}:\n${bulletPoints}`.trim() : summaryText;

        existingMemories.push({
          id: `mem_sess_${sess._id}_${Date.now()}_${addedCount}`,
          sessionId: sess._id,
          sessionNumber: sess.number,
          sessionTitle: sess.title,
          title: `Ricordo di "${titleText}"`,
          summary: fullSummary || `Partecipazione agli eventi della sessione #${sess.number}.`,
          loreDate: loreDateText,
          impact: sess.events?.some((e: any) => e.impact === 'major') ? 'major' : 'normal',
          category: 'event',
          involvedEntities: sess.linkedEntityIds || [],
        });
        existingSessionIds.add(sess._id);
        existingSessionNumbers.add(sess.number);
        addedCount++;
      });

      const updatedBio: CharacterBio = {
        ...currentBio,
        playerId: targetPlayer._id,
        campaignCode: activeCode || currentBio.campaignCode,
        timelineMemories: existingMemories,
        evolvingBeliefs,
        knownLoreBites,
        updatedAt: new Date().toISOString(),
      };

      await CampaignManager.saveCharacterBio(updatedBio);
      setCharacterBio(updatedBio);

      if (matchedCodexEntity) {
        CampaignManager.updateEntity(matchedCodexEntity._id, {
          aiConfig: {
            ...matchedCodexEntity.aiConfig,
            timelineMemories: existingMemories,
            evolvingBeliefs,
            knownLoreBites,
          },
        });
        setEntities(CampaignManager.getEntities());
      }

      setSyncStatusMsg(`Recuperati con successo ${addedCount} ricordi dalle sessioni e dal Codex! Ora il PG ha ${existingMemories.length} memorie cronologiche e ${knownLoreBites.length} nozioni.`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to rebuild memories from sessions:', err);
    } finally {
      setIsRebuildingMemories(false);
    }
  };

  return (
    <div className="w-full pb-16 min-h-screen bg-surface-0">
      <div className="w-full">


        <CharacterGrimoireFolio
          player={targetPlayer}
          characterBio={characterBio}
          notes={notes}
          quests={quests}
          entities={entities}
          scrapbook={scrapbook}
          isOwnProfile={isOwnProfile}
          isDM={Boolean(player?.isDm)}
          onBioUpdated={(bio) => {
            setCharacterBio(bio);
            loadData();
          }}
          onOpenEditProfile={handleOpenEditProfile}
          onOpenNoteModal={(note, isDm) => {
            setEditingNote(note || null);
            setIsAskDm(Boolean(isDm));
            setIsNoteModalOpen(true);
          }}
          onOpenQuestModal={(quest) => {
            setEditingQuest(quest || null);
            setIsQuestModalOpen(true);
          }}
          onOpenMemoryModal={() => {
            setIsMemoryModalOpen(true);
          }}
        />
      </div>

      {/* MODALS */}
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
