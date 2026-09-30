import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { useAuth } from '../components/AuthProvider';
import {
  Search as SearchIcon,
  Scroll,
  Calendar as CalendarIcon,
  Users,
  Ghost,
  MapPin,
  Tag,
  ArrowRight,
  Info,
  Filter,
  Sparkles,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkle,
  MessageSquare,
  Shield,
  Flame,
  HelpCircle,
  BookOpen,
  UserCheck,
  CalendarDays,
  FileText,
  Compass,
  Bookmark,
  ExternalLink,
  Layers,
  Send,
  Loader2,
  Brain,
  ListFilter,
  Lock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { parseLoreDateString, normalizeText } from '../lib/loreDateUtils';
import { Note, Session, Entity, CalendarMonth, Player } from '../types';

type CategoryTab = 'all' | 'notes' | 'sessions' | 'npc' | 'monster' | 'place' | 'quest' | 'item' | 'faction';
type MatchMode = 'and' | 'or' | 'exact';
type SearchScope = 'all' | 'title_only';
type SortOption = 'relevance' | 'loreDate_desc' | 'loreDate_asc' | 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc';

interface SearchResultItem {
  id: string;
  type: 'note' | 'session' | 'npc' | 'monster' | 'place' | 'quest' | 'item' | 'faction';
  title: string;
  subtitle?: string;
  authorName?: string;
  authorColor?: string;
  loreDate?: string;
  realDate?: string;
  categoryName?: string;
  status?: string;
  questScope?: 'party' | 'personal';
  assigneeName?: string;
  snippet?: string;
  relevanceScore: number;
  highlightMatches?: string[];
  rawItem: any;
  targetUrl: string;
}

// Utility to recursively extract plain text from Portable Text or strings
function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block?.children && Array.isArray(block.children)) {
          return block.children.map((c: any) => c.text || '').join(' ');
        }
        if (block?.text) return block.text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof content === 'object') {
    if (content.text) return content.text;
    if (content.description) return content.description;
  }
  return '';
}

// Utility to generate a highlighted snippet around search terms
function generateSnippet(
  fullText: string,
  queryTerms: string[],
  maxLength = 180
): { snippet: string; hasMatch: boolean } {
  if (!fullText) return { snippet: '', hasMatch: false };

  const cleanText = fullText.replace(/\s+/g, ' ').trim();
  if (!cleanText) return { snippet: '', hasMatch: false };

  if (!queryTerms || queryTerms.length === 0) {
    return {
      snippet: cleanText.length > maxLength ? cleanText.slice(0, maxLength) + '...' : cleanText,
      hasMatch: false,
    };
  }

  const lowerText = cleanText.toLowerCase();
  let firstMatchIndex = -1;

  for (const term of queryTerms) {
    const idx = lowerText.indexOf(term.toLowerCase());
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    return {
      snippet: cleanText.length > maxLength ? cleanText.slice(0, maxLength) + '...' : cleanText,
      hasMatch: false,
    };
  }

  const start = Math.max(0, firstMatchIndex - 50);
  const end = Math.min(cleanText.length, start + maxLength);
  let snippet = cleanText.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < cleanText.length) snippet = snippet + '...';

  return { snippet, hasMatch: true };
}

// Component to render text with highlighted keywords
function HighlightedText({ text, queryTerms }: { text: string; queryTerms: string[] }) {
  if (!text) return null;
  if (!queryTerms || queryTerms.length === 0) return <span>{text}</span>;

  // Filter out short terms for safety
  const validTerms = queryTerms.filter((t) => t && t.trim().length >= 2);
  if (validTerms.length === 0) return <span>{text}</span>;

  // Escape regex special chars
  const escaped = validTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!escaped) return <span>{text}</span>;

  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          return (
            <mark
              key={i}
              className="bg-primary/25 text-content-1 font-semibold px-0.5 rounded text-inherit"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function Search() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('chronicle_sessions_updated', handleUpdate);
    window.addEventListener('chronicle_notes_updated', handleUpdate);
    window.addEventListener('chronicle_entities_updated', handleUpdate);
    window.addEventListener('chronicle_calendar_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('chronicle_campaign_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_sessions_updated', handleUpdate);
      window.removeEventListener('chronicle_notes_updated', handleUpdate);
      window.removeEventListener('chronicle_entities_updated', handleUpdate);
      window.removeEventListener('chronicle_calendar_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);


  // Query & Basic state
  const [query, setQuery] = useState('');
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Advanced Filters Panel visibility
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filters State
  // 1. Temporal / Lore Date Filters
  const [loreYearFilter, setLoreYearFilter] = useState<string>('all');
  const [loreMonthFilter, setLoreMonthFilter] = useState<string>('all');
  const [realDateRange, setRealDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  // 2. Character / Author / Assignee Filters
  const [characterFilter, setCharacterFilter] = useState<string>('all');
  const [characterScope, setCharacterScope] = useState<'author_or_assignee' | 'author_only' | 'mentioned'>('author_or_assignee');

  // 3. Category & Visibility Filters
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'group' | 'personal' | 'dm_only' | 'ask_dm'>('all');
  const [canonFilter, setCanonFilter] = useState<'all' | 'canon' | 'theory' | 'unknown'>('all');

  // 4. Entity & Quest Filters
  const [entityStatusFilter, setEntityStatusFilter] = useState<'all' | 'alive' | 'dead' | 'open' | 'completed' | 'failed'>('all');
  const [questScopeFilter, setQuestScopeFilter] = useState<'all' | 'party' | 'personal'>('all');

  // 5. Match & Scope options
  const [matchMode, setMatchMode] = useState<MatchMode>('and');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [sortOption, setSortOption] = useState<SortOption>('relevance');


  // Data from Campaign Store
  const notes = CampaignManager.getNotes().filter((n) => {
    const isAuthor = n.author._id === player?._id;
    if (isAuthor) return true;
    // Privacy Fix Applied: Personal notes isolation
    if (n.visibility === 'personal') {
      if (n.dmOnly && player?.isDm) return true; // Shared with DM
      return false; // Strictly personal
    }
    if (n.dmOnly && !player?.isDm) return false;
    return true;
  });
  const sessions = CampaignManager.getSessions();
  const entities = CampaignManager.getEntities().filter((e) => {
    return CampaignManager.isEntityAccessible(e, player);
  });
  const calendar = CampaignManager.getCalendar();
  const categories = CampaignManager.getCategories();
  const allPlayers = CampaignManager.getPlayers();
  const campaignMeta = CampaignManager.getCampaignMeta();

  // Extract all available Lore Years across notes and sessions
  const availableLoreYears = useMemo(() => {
    const years = new Set<number>();
    if (calendar?.currentYear) years.add(calendar.currentYear);

    notes.forEach((n) => {
      if (n.loreDate) {
        const parsed = parseLoreDateString(n.loreDate, calendar?.months || []);
        if (parsed?.year) years.add(parsed.year);
      }
    });

    sessions.forEach((s) => {
      if (s.loreYear) years.add(s.loreYear);
      else if (s.loreDate) {
        const parsed = parseLoreDateString(s.loreDate, calendar?.months || []);
        if (parsed?.year) years.add(parsed.year);
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [notes, sessions, calendar]);

  // Extract terms from query
  const queryTerms = useMemo(() => {
    const raw = query.trim();
    if (!raw) return [];
    if (matchMode === 'exact') return [raw];
    return raw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }, [query, matchMode]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (loreYearFilter !== 'all') count++;
    if (loreMonthFilter !== 'all') count++;
    if (realDateRange !== 'all') count++;
    if (characterFilter !== 'all') count++;
    if (noteCategoryFilter !== 'all') count++;
    if (visibilityFilter !== 'all') count++;
    if (canonFilter !== 'all') count++;
    if (entityStatusFilter !== 'all') count++;
    if (questScopeFilter !== 'all') count++;
    if (matchMode !== 'and') count++;
    if (searchScope !== 'all') count++;
    if (sortOption !== 'relevance') count++;
    return count;
  }, [
    loreYearFilter,
    loreMonthFilter,
    realDateRange,
    characterFilter,
    noteCategoryFilter,
    visibilityFilter,
    canonFilter,
    entityStatusFilter,
    questScopeFilter,
    matchMode,
    searchScope,
    sortOption,
  ]);

  const resetAllFilters = () => {
    setLoreYearFilter('all');
    setLoreMonthFilter('all');
    setRealDateRange('all');
    setCharacterFilter('all');
    setCharacterScope('author_or_assignee');
    setNoteCategoryFilter('all');
    setVisibilityFilter('all');
    setCanonFilter('all');
    setEntityStatusFilter('all');
    setQuestScopeFilter('all');
    setMatchMode('and');
    setSearchScope('all');
    setSortOption('relevance');
    setCurrentPage(1);
  };

  // Build the complete searchable index item list
  const allIndexedItems = useMemo(() => {
    const results: SearchResultItem[] = [];

    // 1. Index Notes
    notes.forEach((n) => {
      const bodyText = extractPlainText(n.body || n.content);
      const dmRespText = n.dmResponse?.text ? extractPlainText(n.dmResponse.text) : '';
      const fullText = `${n.title} ${n.category?.title || ''} ${n.author.characterName} ${n.loreDate || ''} ${
        n.tags?.join(' ') || ''
      } ${bodyText} ${dmRespText}`;

      results.push({
        id: n._id,
        type: 'note',
        title: n.title,
        subtitle: n.category?.title ? `Categoria: ${n.category.title}` : undefined,
        authorName: n.author.characterName,
        authorColor: n.author.color,
        loreDate: n.loreDate,
        realDate: n._createdAt,
        categoryName: n.category?.title,
        status: n.canonState,
        snippet: bodyText || n.title,
        relevanceScore: 0,
        rawItem: n,
        targetUrl: `/notes?select=${n._id}`,
      });
    });

    // 2. Index Sessions
    sessions.forEach((s) => {
      const recapText = extractPlainText(s.recap);
      const eventsText = (s.events || [])
        .map((e) => `${e.title}: ${extractPlainText(e.description)} ${e.location || ''}`)
        .join(' ');
      const quotesText = (s.quotes || []).map((q) => `${q.speaker}: "${q.text}"`).join(' ');
      const fullText = `Sessione #${s.number} ${s.title} ${s.chapterName || ''} ${s.date} ${s.loreDate || ''} ${recapText} ${eventsText} ${quotesText}`;

      results.push({
        id: s._id,
        type: 'session',
        title: `Sessione #${s.number}: ${s.title}`,
        subtitle: s.chapterName ? `Capitolo: ${s.chapterName}` : `${s.events?.length || 0} eventi registrati`,
        loreDate: s.loreDate,
        realDate: s.date,
        snippet: recapText || (s.events?.[0]?.description ? extractPlainText(s.events[0].description) : s.title),
        relevanceScore: 0,
        rawItem: s,
        targetUrl: `/sessions?select=${s._id}`,
      });
    });

    // 3. Index Entities
    entities.forEach((e) => {
      const bodyText = extractPlainText(e.body);
      const progressText = e.progressNote || '';
      const aliasesText = e.aliases?.join(' ') || '';
      const fullText = `${e.name} ${aliasesText} ${e.location || ''} ${progressText} ${bodyText} ${e.assigneePlayerName || ''}`;

      results.push({
        id: e._id,
        type: e.type,
        title: e.name,
        subtitle:
          e.type === 'quest'
            ? e.questScope === 'personal'
              ? `Quest Personale (${e.assigneePlayerName || 'Assegnata'})`
              : 'Quest di Gruppo'
            : e.aliases && e.aliases.length > 0
            ? `Alias: ${e.aliases.join(', ')}`
            : undefined,
        status: e.status,
        questScope: e.questScope,
        assigneeName: e.assigneePlayerName,
        snippet: progressText || bodyText || (e.aliases?.length ? `Conosciuto come: ${e.aliases.join(', ')}` : e.name),
        relevanceScore: 0,
        rawItem: e,
        targetUrl: `/codex/${e.type}/${e._id}`,
      });
    });

    return results;
  }, [notes, sessions, entities]);

  // Main Filtering Engine with Multi-criteria verification
  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const months = calendar?.months || [];

    // Real Date cutoff helper
    let realDateCutoff: Date | null = null;
    if (realDateRange !== 'all') {
      const days = realDateRange === '7d' ? 7 : realDateRange === '30d' ? 30 : 90;
      realDateCutoff = new Date();
      realDateCutoff.setDate(realDateCutoff.getDate() - days);
    }

    return allIndexedItems.filter((item) => {
      // 1. Category Tab Filter
      if (categoryTab !== 'all') {
        if (categoryTab === 'notes' && item.type !== 'note') return false;
        if (categoryTab === 'sessions' && item.type !== 'session') return false;
        if (categoryTab === 'npc' && item.type !== 'npc') return false;
        if (categoryTab === 'monster' && item.type !== 'monster') return false;
        if (categoryTab === 'place' && item.type !== 'place') return false;
        if (categoryTab === 'quest' && item.type !== 'quest') return false;
        if (categoryTab === 'item' && item.type !== 'item') return false;
        if (categoryTab === 'faction' && item.type !== 'faction') return false;
      }

      // 2. Real Date Range Filter
      if (realDateCutoff && item.realDate) {
        const itemDate = new Date(item.realDate);
        if (!isNaN(itemDate.getTime()) && itemDate < realDateCutoff) {
          return false;
        }
      }

      // 3. Lore Year Filter
      if (loreYearFilter !== 'all') {
        const targetYear = parseInt(loreYearFilter, 10);
        if (!isNaN(targetYear)) {
          let itemYear: number | null = null;
          if (item.type === 'session') {
            const rawSession = item.rawItem as Session;
            itemYear = rawSession.loreYear || (rawSession.loreDate ? parseLoreDateString(rawSession.loreDate, months)?.year || null : null);
          } else if (item.loreDate) {
            itemYear = parseLoreDateString(item.loreDate, months)?.year || null;
          }

          if (itemYear !== targetYear) {
            return false;
          }
        }
      }

      // 4. Lore Month Filter
      if (loreMonthFilter !== 'all') {
        const targetMonthIdx = parseInt(loreMonthFilter, 10);
        if (!isNaN(targetMonthIdx) && targetMonthIdx >= 0 && targetMonthIdx < months.length) {
          const targetMonth = months[targetMonthIdx];
          const targetMonthNameNorm = normalizeText(targetMonth.name);
          let matchedMonth = false;

          if (item.type === 'session') {
            const rawSession = item.rawItem as Session;
            if (rawSession.loreMonth && normalizeText(rawSession.loreMonth).includes(targetMonthNameNorm)) {
              matchedMonth = true;
            } else if (rawSession.loreDate) {
              const parsed = parseLoreDateString(rawSession.loreDate, months);
              if (parsed && parsed.monthIndex === targetMonthIdx) matchedMonth = true;
            }
          } else if (item.loreDate) {
            const parsed = parseLoreDateString(item.loreDate, months);
            if (parsed && parsed.monthIndex === targetMonthIdx) matchedMonth = true;
            else if (normalizeText(item.loreDate).includes(targetMonthNameNorm)) matchedMonth = true;
          }

          if (!matchedMonth) return false;
        }
      }

      // 5. Character / Author / Assignee Filter
      if (characterFilter !== 'all') {
        const charNorm = characterFilter.toLowerCase();
        let charMatches = false;

        if (item.type === 'note') {
          const rawNote = item.rawItem as Note;
          const isAuthor =
            rawNote.author._id === characterFilter ||
            rawNote.author.characterName.toLowerCase() === charNorm;

          if (characterScope === 'author_only') {
            charMatches = isAuthor;
          } else {
            // Check author or mention
            const fullNoteText = `${rawNote.title} ${extractPlainText(rawNote.body || rawNote.content)}`.toLowerCase();
            const isMentioned = fullNoteText.includes(charNorm);
            charMatches = isAuthor || isMentioned;
          }
        } else if (item.type === 'quest') {
          const rawQuest = item.rawItem as Entity;
          const isAssignee =
            rawQuest.assigneePlayerId === characterFilter ||
            (rawQuest.assigneePlayerName && rawQuest.assigneePlayerName.toLowerCase() === charNorm);
          charMatches = isAssignee;
        } else if (item.type === 'session') {
          const rawSession = item.rawItem as Session;
          const attended = (rawSession.attendees || []).some(
            (p) => p._id === characterFilter || p.characterName.toLowerCase() === charNorm
          );
          const fullSessionText = `${rawSession.title} ${extractPlainText(rawSession.recap)} ${(rawSession.events || [])
            .map((e) => e.title + ' ' + extractPlainText(e.description))
            .join(' ')}`.toLowerCase();
          const isMentioned = fullSessionText.includes(charNorm);
          charMatches = attended || isMentioned;
        } else {
          // Entity (npc/monster/place) - check mentions
          const fullText = `${item.title} ${item.snippet || ''}`.toLowerCase();
          charMatches = fullText.includes(charNorm);
        }

        if (!charMatches) return false;
      }

      // 6. Note Category Filter
      if (noteCategoryFilter !== 'all') {
        if (item.type !== 'note') return false;
        const rawNote = item.rawItem as Note;
        if (rawNote.category?._id !== noteCategoryFilter && rawNote.category?.title !== noteCategoryFilter) {
          return false;
        }
      }

      // 7. Visibility & DM Questions Filter
      if (visibilityFilter !== 'all') {
        if (item.type !== 'note') return false;
        const rawNote = item.rawItem as Note;
        if (visibilityFilter === 'group' && (rawNote.visibility !== 'group' || rawNote.dmOnly)) return false;
        if (visibilityFilter === 'personal' && rawNote.visibility !== 'personal') return false;
        if (visibilityFilter === 'dm_only' && !rawNote.dmOnly) return false;
        if (visibilityFilter === 'ask_dm' && !rawNote.askDm) return false;
      }

      // 8. Canon State Filter
      if (canonFilter !== 'all') {
        if (item.type !== 'note') return false;
        const rawNote = item.rawItem as Note;
        if (rawNote.canonState !== canonFilter) return false;
      }

      // 9. Entity Status Filter
      if (entityStatusFilter !== 'all') {
        if (item.type === 'note' || item.type === 'session') return false;
        const rawEntity = item.rawItem as Entity;
        if (rawEntity.status !== entityStatusFilter) return false;
      }

      // 10. Quest Scope Filter
      if (questScopeFilter !== 'all') {
        if (item.type !== 'quest') return false;
        const rawQuest = item.rawItem as Entity;
        if (rawQuest.questScope !== questScopeFilter) return false;
      }

      // 11. Text Search Query Matching
      if (trimmed) {
        let searchableText = '';
        if (searchScope === 'title_only') {
          searchableText = `${item.title} ${item.subtitle || ''}`.toLowerCase();
        } else {
          searchableText = `${item.title} ${item.subtitle || ''} ${item.authorName || ''} ${item.loreDate || ''} ${
            item.snippet || ''
          } ${item.status || ''} ${item.categoryName || ''}`.toLowerCase();
        }

        if (matchMode === 'exact') {
          if (!searchableText.includes(trimmed)) return false;
        } else if (matchMode === 'and') {
          const allFound = queryTerms.every((term) => searchableText.includes(term.toLowerCase()));
          if (!allFound) return false;
        } else if (matchMode === 'or') {
          const anyFound = queryTerms.some((term) => searchableText.includes(term.toLowerCase()));
          if (!anyFound) return false;
        }
      }

      return true;
    });
  }, [
    allIndexedItems,
    query,
    queryTerms,
    categoryTab,
    loreYearFilter,
    loreMonthFilter,
    realDateRange,
    characterFilter,
    characterScope,
    noteCategoryFilter,
    visibilityFilter,
    canonFilter,
    entityStatusFilter,
    questScopeFilter,
    matchMode,
    searchScope,
    calendar,
  ]);

  // Calculate Relevance & Sort the Filtered Results
  const scoredAndSortedResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    // Map and score
    const scored = filteredResults.map((item) => {
      let score = 10; // base score

      if (trimmed) {
        const lowerTitle = item.title.toLowerCase();
        const lowerSnippet = (item.snippet || '').toLowerCase();

        // Exact title match: +100
        if (lowerTitle === trimmed) score += 100;
        else if (lowerTitle.includes(trimmed)) score += 60;

        // Individual term matches in title
        for (const term of queryTerms) {
          if (lowerTitle.includes(term.toLowerCase())) score += 25;
          if (lowerSnippet.includes(term.toLowerCase())) score += 10;
        }

        // Tag / category match bonus
        if (item.categoryName && item.categoryName.toLowerCase().includes(trimmed)) score += 20;
        if (item.authorName && item.authorName.toLowerCase().includes(trimmed)) score += 15;
      }

      // Generate accurate snippet around matched keywords
      const { snippet: highlightedSnippet } = generateSnippet(item.snippet || item.title, queryTerms, 190);

      return {
        ...item,
        snippet: highlightedSnippet || item.snippet,
        relevanceScore: score,
      };
    });

    // Apply Sorting Option
    return scored.sort((a, b) => {
      if (sortOption === 'relevance') {
        if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      }

      if (sortOption === 'title_asc') {
        return a.title.localeCompare(b.title, 'it');
      }
      if (sortOption === 'title_desc') {
        return b.title.localeCompare(a.title, 'it');
      }

      if (sortOption === 'date_desc') {
        const dateA = a.realDate ? new Date(a.realDate).getTime() : 0;
        const dateB = b.realDate ? new Date(b.realDate).getTime() : 0;
        return dateB - dateA;
      }
      if (sortOption === 'date_asc') {
        const dateA = a.realDate ? new Date(a.realDate).getTime() : 0;
        const dateB = b.realDate ? new Date(b.realDate).getTime() : 0;
        return dateA - dateB;
      }

      if (sortOption === 'loreDate_desc' || sortOption === 'loreDate_asc') {
        const parsedA = a.loreDate ? parseLoreDateString(a.loreDate, calendar?.months || []) : null;
        const parsedB = b.loreDate ? parseLoreDateString(b.loreDate, calendar?.months || []) : null;

        const valA = parsedA ? parsedA.year * 10000 + parsedA.monthIndex * 100 + parsedA.startDay : 0;
        const valB = parsedB ? parsedB.year * 10000 + parsedB.monthIndex * 100 + parsedB.startDay : 0;

        return sortOption === 'loreDate_desc' ? valB - valA : valA - valB;
      }

      return b.relevanceScore - a.relevanceScore;
    });
  }, [filteredResults, query, queryTerms, sortOption, calendar]);

  // Category counts for quick tabs
  const categoryCounts = useMemo(() => {
    const counts = {
      all: filteredResults.length,
      notes: 0,
      sessions: 0,
      npc: 0,
      monster: 0,
      place: 0,
      quest: 0,
      item: 0,
      faction: 0,
    };

    allIndexedItems.forEach((item) => {
      if (item.type === 'note') counts.notes++;
      else if (item.type === 'session') counts.sessions++;
      else if (item.type === 'npc') counts.npc++;
      else if (item.type === 'monster') counts.monster++;
      else if (item.type === 'place') counts.place++;
      else if (item.type === 'quest') counts.quest++;
      else if (item.type === 'item') counts.item++;
      else if (item.type === 'faction') counts.faction++;
    });

    return counts;
  }, [filteredResults, allIndexedItems]);

  // Paginated Results
  const totalPages = Math.max(1, Math.ceil(scoredAndSortedResults.length / itemsPerPage));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return scoredAndSortedResults.slice(start, start + itemsPerPage);
  }, [scoredAndSortedResults, currentPage, itemsPerPage]);

  // State for active selection in 2-column layout
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Default selection to first item when paginated results change
  useEffect(() => {
    if (paginatedResults.length > 0) {
      if (!selectedItemId || !paginatedResults.some((r) => `${r.type}-${r.id}` === selectedItemId)) {
        setSelectedItemId(`${paginatedResults[0].type}-${paginatedResults[0].id}`);
      }
    } else {
      setSelectedItemId(null);
    }
  }, [paginatedResults, selectedItemId]);

  const selectedResult = useMemo(() => {
    if (!selectedItemId) return null;
    return paginatedResults.find((r) => `${r.type}-${r.id}` === selectedItemId) || null;
  }, [paginatedResults, selectedItemId]);

  // Keyboard navigation for results list (ArrowUp / ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (paginatedResults.length === 0) return;

      const currentIndex = paginatedResults.findIndex((r) => `${r.type}-${r.id}` === selectedItemId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < paginatedResults.length - 1 ? currentIndex + 1 : 0;
        setSelectedItemId(`${paginatedResults[nextIndex].type}-${paginatedResults[nextIndex].id}`);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : paginatedResults.length - 1;
        setSelectedItemId(`${paginatedResults[prevIndex].type}-${paginatedResults[prevIndex].id}`);
      } else if (e.key === 'Enter' && selectedResult) {
        navigate(selectedResult.targetUrl);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paginatedResults, selectedItemId, selectedResult, navigate]);

  const getTypeIcon = (type: SearchResultItem['type'], size = 14) => {
    switch (type) {
      case 'note':
        return <Scroll size={size} className="text-amber-400 shrink-0" />;
      case 'session':
        return <CalendarDays size={size} className="text-primary shrink-0" />;
      case 'npc':
        return <Users size={size} className="text-emerald-400 shrink-0" />;
      case 'monster':
        return <Ghost size={size} className="text-rose-400 shrink-0" />;
      case 'place':
        return <MapPin size={size} className="text-sky-400 shrink-0" />;
      case 'quest':
        return <Tag size={size} className="text-amber-400 shrink-0" />;
      case 'item':
        return <Sparkles size={size} className="text-purple-400 shrink-0" />;
      case 'faction':
        return <Shield size={size} className="text-indigo-400 shrink-0" />;
      default:
        return <FileText size={size} className="text-content-3 shrink-0" />;
    }
  };

  const getTypeBadge = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'note':
        return 'Nota Diario';
      case 'session':
        return 'Sessione';
      case 'npc':
        return 'Personaggio (NPC)';
      case 'monster':
        return 'Mostro / Creatura';
      case 'place':
        return 'Luogo';
      case 'quest':
        return 'Quest / Missione';
      case 'item':
        return 'Oggetto';
      case 'faction':
        return 'Fazione';
      default:
        return 'Elemento';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <SearchIcon size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-semibold text-content-1 text-balance">
              Archivio &amp; Ricerca Globale della Cronaca
            </h1>
            <p className="text-xs text-content-3 mt-0.5">
              Consultazione rapida con anteprima istantanea di note, sessioni e schede del Codex.
            </p>
          </div>
        </div>

        {/* Shortcuts indicator badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-content-3 bg-surface-1 px-3 py-1.5 rounded-xl border border-surface-2">
          <span>Naviga con:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-content-2 text-[10px] border border-surface-3">
            &uarr; &darr;
          </kbd>
          <span>Apri con:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-content-2 text-[10px] border border-surface-3">
            Invio
          </kbd>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Bar & Filter Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-3" />
            <input
              type="text"
              autoFocus
              placeholder="Cerca parole chiave, nomi di mostri, luoghi, dialoghi, segreti o date..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-surface-1 border border-surface-2 focus:border-primary rounded-xl pl-11 pr-10 py-3 text-sm text-content-1 placeholder-content-3 outline-none transition-colors shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 p-1 cursor-pointer"
                title="Svuota ricerca"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>

          {/* Toggle Filters Panel Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              showAdvancedFilters || activeFiltersCount > 0
                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/15'
                : 'bg-surface-1 border-surface-2 text-content-2 hover:bg-surface-2 hover:text-content-1'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>Filtri Avanzati</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary text-surface-0 font-mono text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
            {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible Advanced Filters Container */}
        {showAdvancedFilters && (
          <div className="p-5 bg-surface-1 border border-surface-2 rounded-2xl space-y-4 shadow-sm animate-fadeIn">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-primary" />
                <h3 className="text-xs font-semibold text-content-1 uppercase tracking-wider">
                  Pannello di Filtraggio Mirato
                </h3>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RotateCcw size={12} /> Ripristina Tutti i Filtri ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Grid of Specialized Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Temporal Lore Date: Year */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <CalendarIcon size={12} className="text-primary" /> Anno Lore (Campagna)
                </label>
                <select
                  value={loreYearFilter}
                  onChange={(e) => {
                    setLoreYearFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Tutti gli Anni della Lore</option>
                  {availableLoreYears.map((y) => (
                    <option key={y} value={y.toString()}>
                      {y} {calendar?.yearSuffix || 'CV'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Temporal Lore Date: Month */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <CalendarDays size={12} className="text-primary" /> Mese di Lore
                </label>
                <select
                  value={loreMonthFilter}
                  onChange={(e) => {
                    setLoreMonthFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Tutti i Mesi del Calendario</option>
                  {calendar?.months.map((m, idx) => (
                    <option key={m.id || idx} value={idx.toString()}>
                      {idx + 1}. {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Character / Player Character */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <Users size={12} className="text-primary" /> Personaggio / Autore
                </label>
                <select
                  value={characterFilter}
                  onChange={(e) => {
                    setCharacterFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Tutti i Personaggi &amp; DM</option>
                  {allPlayers.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.characterName} {p.isDm ? '(DM)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Note Visibility & DM Secrets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <Lock size={12} className="text-primary" /> Visibilità &amp; Segreti
                </label>
                <select
                  value={visibilityFilter}
                  onChange={(e) => {
                    setVisibilityFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Tutte le Note Accessibili</option>
                  <option value="group">Note Condivise (Gruppo)</option>
                  <option value="personal">Note Personali</option>
                  {player?.isDm && <option value="dm_only">Note Segrete Solo DM</option>}
                  <option value="ask_dm">Note con Domanda al DM</option>
                </select>
              </div>

              {/* 5. Note Categories */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <Scroll size={12} className="text-primary" /> Categoria Nota
                </label>
                <select
                  value={noteCategoryFilter}
                  onChange={(e) => {
                    setNoteCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Tutte le Categorie</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Entity & Quest Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-primary" /> Stato Entità / Quest
                </label>
                <select
                  value={entityStatusFilter}
                  onChange={(e) => {
                    setEntityStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="all">Qualsiasi Stato</option>
                  <option value="alive">In Vita / Esistente</option>
                  <option value="dead">Caduto / Distrutto</option>
                  <option value="open">Quest Aperta / In Corso</option>
                  <option value="completed">Quest Completata</option>
                  <option value="failed">Quest Fallita</option>
                </select>
              </div>

              {/* 7. Query Match Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <SearchIcon size={12} className="text-primary" /> Modalità Corrispondenza
                </label>
                <select
                  value={matchMode}
                  onChange={(e) => {
                    setMatchMode(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="and">Tutte le parole (AND)</option>
                  <option value="or">Almeno una parola (OR)</option>
                  <option value="exact">Frase esatta</option>
                </select>
              </div>

              {/* 8. Sorting Option */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} className="text-primary" /> Ordina Risultati
                </label>
                <select
                  value={sortOption}
                  onChange={(e) => {
                    setSortOption(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface-0 border border-surface-2 rounded-lg px-3 py-2 text-xs text-content-1 focus:border-primary outline-none"
                >
                  <option value="relevance">Rilevanza (Punteggio Migliore)</option>
                  <option value="loreDate_desc">Data Lore (Più recente prima)</option>
                  <option value="loreDate_asc">Data Lore (Meno recente prima)</option>
                  <option value="date_desc">Data Reale (Più recente)</option>
                  <option value="title_asc">Alfabetico (A &rarr; Z)</option>
                  <option value="title_desc">Alfabetico (Z &rarr; A)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quick Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              setCategoryTab('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 cursor-pointer ${
              categoryTab === 'all'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            Tutti ({categoryCounts.all})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('notes');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'notes'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Scroll size={13} className="text-amber-400" /> Note ({categoryCounts.notes})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('sessions');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'sessions'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <CalendarDays size={13} className="text-primary" /> Sessioni ({categoryCounts.sessions})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('npc');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'npc'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Users size={13} className="text-emerald-400" /> NPC ({categoryCounts.npc})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('monster');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'monster'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Ghost size={13} className="text-rose-400" /> Mostri ({categoryCounts.monster})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('place');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'place'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <MapPin size={13} className="text-sky-400" /> Luoghi ({categoryCounts.place})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('quest');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'quest'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Tag size={13} className="text-amber-400" /> Quest ({categoryCounts.quest})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('item');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'item'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Sparkles size={13} className="text-purple-400" /> Oggetti ({categoryCounts.item})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('faction');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              categoryTab === 'faction'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-surface-1 border border-surface-2 text-content-3 hover:text-content-1 hover:bg-surface-2'
            }`}
          >
            <Shield size={13} className="text-indigo-400" /> Fazioni ({categoryCounts.faction})
          </button>
        </div>

        {/* Results Area */}
        {scoredAndSortedResults.length === 0 ? (
          <div className="text-center py-16 bg-surface-1 rounded-2xl border border-surface-2 space-y-3">
            <SearchIcon size={32} className="mx-auto text-content-3 opacity-60" />
            <p className="text-sm font-medium text-content-2">
              Nessun elemento corrisponde ai criteri o ai filtri impostati.
            </p>
            <p className="text-xs text-content-3 max-w-md mx-auto">
              Prova ad allargare i filtri temporali o a rimuovere i vincoli sui personaggi.
            </p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs font-medium text-content-1 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} /> Ripristina Filtri
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-content-3 px-1">
              <span>
                Mostrati <strong>{paginatedResults.length}</strong> di <strong>{scoredAndSortedResults.length}</strong> elementi trovati
              </span>
              <span>
                Pagina {currentPage} di {totalPages}
              </span>
            </div>

            {/* MASTER-DETAIL 2-COLUMN SPLIT LAYOUT */}
            <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
              {/* LEFT COLUMN: Results Cards List */}
              <div className="w-full lg:w-[45%] xl:w-[40%] shrink-0 space-y-3">
                {paginatedResults.map((item) => {
                  const isSelected = selectedItemId === `${item.type}-${item.id}`;

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => setSelectedItemId(`${item.type}-${item.id}`)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative group w-full ${
                        isSelected
                          ? 'bg-surface-1 border-primary ring-2 ring-primary/40 shadow-md'
                          : 'bg-surface-1 border-surface-2 hover:border-surface-3 hover:bg-surface-1/80'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Type & Meta Header */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-surface-3 text-content-2 text-[10px] font-semibold shrink-0">
                              {getTypeIcon(item.type, 12)}
                              <span>{getTypeBadge(item.type)}</span>
                            </span>

                            {item.loreDate && (
                              <span className="flex items-center gap-1 text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                                <CalendarIcon size={10} /> {item.loreDate}
                              </span>
                            )}
                          </div>

                          {item.status && (
                            <span className="text-[9px] text-content-3 uppercase font-mono tracking-wider px-1.5 py-0.2 rounded bg-surface-2 shrink-0">
                              {item.status}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-content-1 group-hover:text-primary transition-colors leading-snug">
                            <HighlightedText text={item.title} queryTerms={queryTerms} />
                          </h4>
                          <Link
                            to={item.targetUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="text-content-3 hover:text-primary p-1 rounded hover:bg-surface-2 transition-colors shrink-0"
                            title="Apri direttamente"
                          >
                            <ArrowRight size={14} />
                          </Link>
                        </div>

                        {/* Subtitle */}
                        {item.subtitle && (
                          <p className="text-[11px] text-content-3 italic">
                            <HighlightedText text={item.subtitle} queryTerms={queryTerms} />
                          </p>
                        )}

                        {/* Snippet */}
                        {item.snippet && (
                          <p className="text-[11px] text-content-2 leading-relaxed line-clamp-3 bg-surface-0/50 p-2.5 rounded-lg border border-surface-2/60">
                            <HighlightedText text={item.snippet} queryTerms={queryTerms} />
                          </p>
                        )}

                        {/* Author line footer */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-content-3 font-mono">
                          {item.authorName ? (
                            <span>Autore: <strong className="text-content-2">{item.authorName}</strong></span>
                          ) : item.categoryName ? (
                            <span>{item.categoryName}</span>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                            Vedi anteprima &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pt-3">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Live Detail Inspector Preview */}
              <div className="w-full lg:flex-1 min-w-0 sticky top-6">
                {selectedResult ? (
                  <div className="p-5 sm:p-6 bg-surface-1 border border-surface-2 rounded-2xl shadow-xl space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar animate-fadeIn w-full">
                    {/* Header with Type, Badges and Action CTA */}
                    <div className="flex items-start justify-between gap-3 border-b border-surface-2 pb-4">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 border border-surface-3 text-content-2 text-xs font-semibold shrink-0">
                            {getTypeIcon(selectedResult.type, 13)}
                            <span>{getTypeBadge(selectedResult.type)}</span>
                          </span>

                          {selectedResult.loreDate && (
                            <span className="flex items-center gap-1 text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shrink-0">
                              <CalendarIcon size={12} /> {selectedResult.loreDate}
                            </span>
                          )}

                          {selectedResult.status && (
                            <span className="text-[10px] text-content-3 uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-surface-2 shrink-0">
                              {selectedResult.status}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-heading font-bold text-content-1 leading-snug pt-1">
                          {selectedResult.title}
                        </h3>

                        {selectedResult.subtitle && (
                          <p className="text-xs text-content-3 italic">
                            {selectedResult.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Direct CTA */}
                      <Link
                        to={selectedResult.targetUrl}
                        className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-surface-0 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        <span>Apri Completo</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>

                    {/* Metadata Section */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface-0/60 border border-surface-2/70 text-xs">
                      {selectedResult.authorName && (
                        <div>
                          <span className="text-[10px] text-content-3 uppercase tracking-wider block font-mono">Autore</span>
                          <span className="font-medium text-content-1">{selectedResult.authorName}</span>
                        </div>
                      )}
                      {selectedResult.categoryName && (
                        <div>
                          <span className="text-[10px] text-content-3 uppercase tracking-wider block font-mono">Categoria</span>
                          <span className="font-medium text-content-1">{selectedResult.categoryName}</span>
                        </div>
                      )}
                      {selectedResult.realDate && (
                        <div>
                          <span className="text-[10px] text-content-3 uppercase tracking-wider block font-mono">Data Reale</span>
                          <span className="font-mono text-content-2">{selectedResult.realDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Body Content / Markdown / Summary */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-content-3 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <FileText size={12} className="text-primary" /> Contenuto Registrato
                      </div>

                      <div className="p-4 rounded-xl bg-surface-0/40 border border-surface-2 text-sm text-content-1 leading-relaxed max-h-[42vh] overflow-y-auto custom-scrollbar">
                        {selectedResult.rawItem?.content ? (
                          <MarkdownRenderer content={extractPlainText(selectedResult.rawItem.content)} />
                        ) : selectedResult.rawItem?.description ? (
                          <MarkdownRenderer content={extractPlainText(selectedResult.rawItem.description)} />
                        ) : selectedResult.snippet ? (
                          <p className="text-xs text-content-2">{selectedResult.snippet}</p>
                        ) : (
                          <p className="text-xs text-content-3 italic">Nessun testo esteso disponibile in anteprima.</p>
                        )}
                      </div>
                    </div>

                    {/* Footer Quick Action */}
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-surface-2 text-content-3">
                      <span>Premi <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-surface-3 text-[10px]">Invio</kbd> per aprire</span>
                      <Link
                        to={selectedResult.targetUrl}
                        className="text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        Visualizza nella sezione dedicata &rarr;
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center bg-surface-1 border border-surface-2 rounded-2xl space-y-2 text-content-3 w-full">
                    <Compass size={28} className="mx-auto opacity-40" />
                    <p className="text-xs">Seleziona un risultato dalla lista per visualizzarne l'anteprima istantanea.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
