import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { CampaignCalendar, CalendarMonth, Session, SessionEvent, ScrapbookItem } from '../types';
import { HARPTOS_CALENDAR, CUSTOM_DEFAULT_CALENDAR } from '../lib/calendarPresets';
import { matchesLoreDayAndMonth } from '../lib/loreDateUtils';
import { useCalendarData } from '../hooks/useViewData';
import { Skeleton } from '../components/Skeleton';
import {
  Calendar as CalendarIcon,
  Compass,
  Sparkles,
  Check,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Swords,
  Search,
  MessageSquare,
  Scroll,
  MapPin,
  Star,
  X,
  Image as ImageIcon,
  Edit3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const EVENT_TYPE_CONFIG = {
  combat: { label: 'Combattimento', icon: Swords, color: 'text-rose-400', dotBg: 'bg-rose-400' },
  roleplay: { label: 'Interpretazione', icon: MessageSquare, color: 'text-blue-400', dotBg: 'bg-blue-400' },
  exploration: { label: 'Esplorazione', icon: Compass, color: 'text-emerald-400', dotBg: 'bg-emerald-400' },
  investigation: { label: 'Investigazione', icon: Search, color: 'text-amber-400', dotBg: 'bg-amber-400' },
  lore: { label: 'Lore', icon: Scroll, color: 'text-purple-400', dotBg: 'bg-purple-400' },
  mixed: { label: 'Campagna', icon: Sparkles, color: 'text-primary', dotBg: 'bg-primary' },
};

interface DayStorylineEvent extends SessionEvent {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  inheritedStartDay?: number;
  inheritedEndDay?: number;
  inheritedMonth?: string;
  inheritedEndMonth?: string;
  inheritedYear?: number;
  inheritedEndYear?: number;
}

export function CalendarPage() {
  const { player } = useAuth();
  const { calendar: hookedCalendar, sessions: hookedSessions, scrapbook: hookedScrapbook, isLoading } = useCalendarData();
  const [calendar, setCalendar] = useState<CampaignCalendar>(hookedCalendar);
  const [sessions, setSessions] = useState<Session[]>(hookedSessions);
  const [scrapbook, setScrapbook] = useState<ScrapbookItem[]>(hookedScrapbook);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'presets'>('overview');

  // Sync internal state when hooked data updates from Supabase / cache
  useEffect(() => {
    setCalendar(hookedCalendar);
  }, [hookedCalendar]);

  useEffect(() => {
    setSessions(hookedSessions);
  }, [hookedSessions]);

  useEffect(() => {
    setScrapbook(hookedScrapbook);
  }, [hookedScrapbook]);

  // Month structure editor state
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthDays, setNewMonthDays] = useState(30);
  const [newMonthSeason, setNewMonthSeason] = useState('Primavera');

  // Editing existing month state
  const [editingMonthIndex, setEditingMonthIndex] = useState<number | null>(null);
  const [editingMonthData, setEditingMonthData] = useState<{
    name: string;
    days: number;
    season: string;
  } | null>(null);

  // Visual calendar month browsing
  const [browsingMonthIndex, setBrowsingMonthIndex] = useState<number>(() => calendar?.currentMonthIndex || 0);

  // Year quick edit input state
  const [heroYearInput, setHeroYearInput] = useState<string>(() => String(calendar?.currentYear || 1492));

  // Selected day for storyline details inspector
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(() => calendar?.currentDay || 1);

  // Lightbox for event images
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const refreshData = () => {
    const cal = CampaignManager.getCalendar();
    setCalendar(cal);
    setHeroYearInput(String(cal.currentYear || 1492));
    setSessions(CampaignManager.getSessions());
    setScrapbook(CampaignManager.getScrapbookItems());
  };

  useEffect(() => {
    if (calendar) {
      setHeroYearInput(String(calendar.currentYear || 1492));
    }
  }, [calendar]);

  const handleSave = (newCal?: CampaignCalendar) => {
    const calToSave = newCal || calendar;
    CampaignManager.saveCalendar(calToSave);
    setCalendar(calToSave);
    setSaveSuccess(true);
    refreshData();
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLoadPreset = (preset: CampaignCalendar) => {
    handleSave(preset);
    setBrowsingMonthIndex(preset.currentMonthIndex || 0);
  };

  const handleAdvanceDays = (days: number) => {
    const updated = CampaignManager.advanceCalendar(days);
    setCalendar(updated);
    setBrowsingMonthIndex(updated.currentMonthIndex);
    setSelectedDayNumber(updated.currentDay);
    setSaveSuccess(true);
    refreshData();
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSetYear = (newYear: number) => {
    const updated: CampaignCalendar = {
      ...calendar,
      currentYear: newYear,
    };
    handleSave(updated);
  };

  const handleAddMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthName.trim()) return;

    const newM: CalendarMonth = {
      id: 'm_' + Date.now(),
      name: newMonthName.trim(),
      days: Math.max(1, newMonthDays || 30),
      season: newMonthSeason,
    };

    const updated: CampaignCalendar = {
      ...calendar,
      months: [...calendar.months, newM],
    };

    setCalendar(updated);
    setNewMonthName('');
    setNewMonthDays(30);
  };

  const handleStartEditMonth = (idx: number) => {
    const target = calendar.months[idx];
    if (!target) return;
    setEditingMonthIndex(idx);
    setEditingMonthData({
      name: target.name,
      days: target.days,
      season: target.season || 'Primavera',
    });
  };

  const handleSaveEditMonth = (idx: number) => {
    if (!editingMonthData || !editingMonthData.name.trim()) return;

    const updatedMonths = [...calendar.months];
    updatedMonths[idx] = {
      ...updatedMonths[idx],
      name: editingMonthData.name.trim(),
      days: Math.max(1, editingMonthData.days || 30),
      season: editingMonthData.season,
    };

    const updatedCal: CampaignCalendar = {
      ...calendar,
      months: updatedMonths,
    };

    setCalendar(updatedCal);
    setEditingMonthIndex(null);
    setEditingMonthData(null);
  };

  const handleCancelEditMonth = () => {
    setEditingMonthIndex(null);
    setEditingMonthData(null);
  };

  const handleMoveMonth = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= calendar.months.length) return;

    const updatedMonths = [...calendar.months];
    const [movedMonth] = updatedMonths.splice(idx, 1);
    updatedMonths.splice(targetIdx, 0, movedMonth);

    const updatedCal: CampaignCalendar = {
      ...calendar,
      months: updatedMonths,
    };

    setCalendar(updatedCal);
  };

  const handleRemoveMonth = (index: number) => {
    if (calendar.months.length <= 1) return;
    const updatedMonths = calendar.months.filter((_, i) => i !== index);
    const updatedCal: CampaignCalendar = {
      ...calendar,
      months: updatedMonths,
      currentMonthIndex: Math.min(calendar.currentMonthIndex, updatedMonths.length - 1),
    };
    setCalendar(updatedCal);
    if (browsingMonthIndex >= updatedMonths.length) {
      setBrowsingMonthIndex(updatedMonths.length - 1);
    }
  };

  const currentMonth = (calendar?.months && calendar.months[calendar.currentMonthIndex]) || (calendar?.months && calendar.months[0]) || HARPTOS_CALENDAR.months[0];
  const activeBrowsingMonth = (calendar?.months && calendar.months[browsingMonthIndex]) || currentMonth || HARPTOS_CALENDAR.months[0];

  // Flatten all events across all sessions with parent session metadata
  const allStorylineEvents = useMemo(() => {
    const list: DayStorylineEvent[] = [];
    sessions.forEach((s) => {
      if (s.events && Array.isArray(s.events)) {
        s.events.forEach((ev) => {
          list.push({
            ...ev,
            sessionId: s._id,
            sessionNumber: s.number,
            sessionTitle: s.title,
            loreDate: ev.loreDate || s.loreDate,
            inheritedStartDay: s.loreStartDay,
            inheritedEndDay: s.loreEndDay,
            inheritedMonth: s.loreMonth,
            inheritedEndMonth: s.loreEndMonth,
            inheritedYear: s.loreYear,
            inheritedEndYear: s.loreEndYear,
          });
        });
      }
    });
    return list;
  }, [sessions]);

  // Build lookup mapping for every day in the active browsing month
  const monthDayDataMap = useMemo(() => {
    const map = new Map<
      number,
      {
        events: DayStorylineEvent[];
        sessions: Session[];
        memories: ScrapbookItem[];
      }
    >();

    const totalDays = activeBrowsingMonth?.days || 30;

    for (let day = 1; day <= totalDays; day++) {
      const dayEvents = allStorylineEvents.filter((ev) => {
        return matchesLoreDayAndMonth(
          {
            loreDate: ev.loreDate,
            loreStartDay: ev.loreStartDay ?? ev.inheritedStartDay,
            loreEndDay: ev.loreEndDay ?? ev.inheritedEndDay,
            loreMonth: ev.loreMonth ?? ev.inheritedMonth,
            loreEndMonth: ev.loreEndMonth ?? ev.inheritedEndMonth,
            loreYear: ev.loreYear ?? ev.inheritedYear,
            loreEndYear: ev.loreEndYear ?? ev.inheritedEndYear,
          },
          day,
          activeBrowsingMonth,
          browsingMonthIndex,
          calendar.months
        );
      });

      const daySessions = sessions.filter((s) => {
        const matchesDirect = matchesLoreDayAndMonth(
          {
            loreDate: s.loreDate,
            loreStartDay: s.loreStartDay,
            loreEndDay: s.loreEndDay,
            loreMonth: s.loreMonth,
            loreEndMonth: s.loreEndMonth,
            loreYear: s.loreYear,
            loreEndYear: s.loreEndYear,
          },
          day,
          activeBrowsingMonth,
          browsingMonthIndex,
          calendar.months
        );

        if (matchesDirect) return true;

        if (s.events && Array.isArray(s.events)) {
          return s.events.some((ev) =>
            matchesLoreDayAndMonth(
              {
                loreDate: ev.loreDate || s.loreDate,
                loreStartDay: ev.loreStartDay ?? s.loreStartDay,
                loreEndDay: ev.loreEndDay ?? s.loreEndDay,
                loreMonth: ev.loreMonth ?? s.loreMonth,
                loreEndMonth: ev.loreEndMonth ?? s.loreEndMonth,
                loreYear: ev.loreYear ?? s.loreYear,
                loreEndYear: ev.loreEndYear ?? s.loreEndYear,
              },
              day,
              activeBrowsingMonth,
              browsingMonthIndex,
              calendar.months
            )
          );
        }

        return false;
      });

      const dayMemories = scrapbook.filter((m) => {
        // Privacy Fix Applied: Scrapbook isolation
        if (m.isSecret) {
          if (m.authorName !== player?.characterName) {
            // Check if shared with DM
            if (!(player?.isDm && m.sharedWithDm)) {
              return false;
            }
          }
        }
        
        return matchesLoreDayAndMonth(
          {
            loreDate: m.loreDate,
          },
          day,
          activeBrowsingMonth,
          browsingMonthIndex,
          calendar.months
        );
      });

      map.set(day, {
        events: dayEvents,
        sessions: daySessions,
        memories: dayMemories,
      });
    }

    return map;
  }, [activeBrowsingMonth, browsingMonthIndex, calendar.months, allStorylineEvents, sessions, scrapbook]);

  const selectedDayData = useMemo(() => {
    if (!selectedDayNumber) return null;
    return (
      monthDayDataMap.get(selectedDayNumber) || {
        events: [],
        sessions: [],
        memories: [],
      }
    );
  }, [selectedDayNumber, monthDayDataMap]);

  if (isLoading && (!calendar?.months || calendar.months.length === 0)) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3 border-b border-surface-2 pb-5">
          <Skeleton variant="circular" className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton variant="text" className="w-48 h-6" />
            <Skeleton variant="text" className="w-64 h-3" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton variant="rectangular" className="h-96 w-full rounded-[2px]" />
          </div>
          <div className="space-y-4">
            <Skeleton variant="rectangular" className="h-96 w-full rounded-[2px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[2px] bg-surface-1 border border-surface-2 flex items-center justify-center text-primary">
            <Compass size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-cinzel font-bold tracking-wide text-content-1">
              Calendario Lore &amp; Tempo
            </h1>
            <p className="text-xs font-mono text-content-3 tracking-wide">
              Computo temporale della campagna, sincronizzazione storyline ed effemeridi
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex bg-surface-1 p-1 rounded-[2px] border border-surface-2/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                : 'text-content-3 hover:text-content-1'
            }`}
          >
            Calendario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                : 'text-content-3 hover:text-content-1'
            }`}
          >
            Struttura Mesi &amp; Anno
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                : 'text-content-3 hover:text-content-1'
            }`}
          >
            Preset
          </button>
        </div>
      </div>

      {/* Hero Banner: Testata Astronomica Unificata */}
      <div className="p-5 sm:p-6 bg-surface-1/80 border border-surface-2/80 rounded-[2px] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-primary font-mono text-[11px] uppercase tracking-[0.16em] font-semibold">
              COMPUTO ASTRONOMICO &bull; {calendar.name}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-cinzel font-bold tracking-wide text-content-1">
            Giorno {calendar.currentDay} {currentMonth?.name}
          </h2>

          {/* Glossa Tecnica a Margine & Stepper Anno */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-content-3/90 pt-0.5">
            <div className="flex items-center gap-1.5 bg-surface-2/70 px-2.5 py-1 rounded-[2px] border border-surface-2/90">
              <span className="text-content-3 text-[11px] uppercase tracking-wider">Anno:</span>
              <input
                type="number"
                value={heroYearInput}
                onChange={(e) => {
                  setHeroYearInput(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    handleSetYear(val);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(heroYearInput, 10);
                  if (isNaN(val)) {
                    setHeroYearInput(String(calendar.currentYear));
                  } else {
                    handleSetYear(val);
                  }
                }}
                className="w-16 bg-surface-1 border border-surface-3/80 focus:border-primary rounded-[2px] px-1 py-0.5 text-xs font-mono text-content-1 text-center outline-none font-semibold"
                title="Modifica Anno di Campagna"
              />
              <span className="text-primary font-semibold text-[11px]">{calendar.yearSuffix}</span>
              <div className="flex items-center gap-0.5 ml-1 border-l border-surface-3/80 pl-1">
                <button
                  type="button"
                  onClick={() => handleSetYear(calendar.currentYear - 1)}
                  className="p-1 hover:bg-surface-3 rounded-[2px] text-content-3 hover:text-content-1 transition-colors cursor-pointer"
                  title="Anno precedente (-1)"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetYear(calendar.currentYear + 1)}
                  className="p-1 hover:bg-surface-3 rounded-[2px] text-content-3 hover:text-content-1 transition-colors cursor-pointer"
                  title="Anno successivo (+1)"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            <span className="opacity-40">&bull;</span>
            <span className="text-[11px] uppercase tracking-wider">
              Stagione: <strong className="text-content-2 font-semibold">{currentMonth?.season || 'Attuale'}</strong>
            </span>
            <span className="opacity-40">&bull;</span>
            <span className="text-[11px] uppercase tracking-wider text-content-3/80">
              Mese {calendar.currentMonthIndex + 1} di {calendar.months.length}
            </span>
          </div>
        </div>

        {/* Stepper Orizzontale a Linea per Avanzamento Rapido */}
        <div className="space-y-1.5 shrink-0 relative z-10 self-start md:self-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-content-3 font-semibold">
              Avanzamento Rapido
            </span>
            {saveSuccess && (
              <span className="text-[10px] font-mono text-emerald-400 font-medium flex items-center gap-1">
                <Check size={10} /> Registrato
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-surface-1/60 p-1 rounded-[2px] border border-surface-2/90">
            <button
              type="button"
              onClick={() => handleAdvanceDays(1)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[2px] border border-surface-2/80 bg-surface-2/40 hover:bg-surface-2 hover:border-primary/50 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title="Avanza di 1 giorno"
            >
              +1G
            </button>
            <button
              type="button"
              onClick={() => handleAdvanceDays(3)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[2px] border border-surface-2/80 bg-surface-2/40 hover:bg-surface-2 hover:border-primary/50 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title="Avanza di 3 giorni"
            >
              +3G
            </button>
            <button
              type="button"
              onClick={() => handleAdvanceDays(7)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[2px] border border-surface-2/80 bg-surface-2/40 hover:bg-surface-2 hover:border-primary/50 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title="Avanza di 1 settimana (7 giorni)"
            >
              +1S
            </button>
            <button
              type="button"
              onClick={() => handleAdvanceDays(currentMonth?.days || 30)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[2px] border border-surface-2/80 bg-surface-2/40 hover:bg-surface-2 hover:border-primary/50 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title="Avanza di 1 mese intero"
            >
              +1M
            </button>
            <button
              type="button"
              onClick={() => handleSetYear(calendar.currentYear + 1)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[2px] border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary transition-colors cursor-pointer"
              title="Avanza di 1 anno intero"
            >
              +1A
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="border border-surface-2/80 bg-surface-1/60 rounded-[2px] p-5 space-y-4 shadow-xs">
            {/* Barra Controlli del Mese */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2/80 pb-3.5">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    setBrowsingMonthIndex((prev) =>
                      prev > 0 ? prev - 1 : calendar.months.length - 1
                    )
                  }
                  className="p-1.5 rounded-[2px] border border-surface-2/80 bg-surface-2/50 hover:bg-surface-2 text-content-2 hover:text-content-1 transition-colors cursor-pointer shrink-0"
                  title="Mese Precedente"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-cinzel font-bold text-content-1 flex items-center gap-2 flex-wrap">
                    <span>{activeBrowsingMonth?.name}</span>
                    <span className="text-xs font-mono font-normal text-primary">
                      ({calendar.currentYear} {calendar.yearSuffix})
                    </span>
                  </h3>
                  <p className="text-[11px] text-content-3 font-mono uppercase tracking-wider">
                    Mese #{browsingMonthIndex + 1} &bull; {activeBrowsingMonth?.days} giorni &bull; {activeBrowsingMonth?.season}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBrowsingMonthIndex((prev) =>
                      prev < calendar.months.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="p-1.5 rounded-[2px] border border-surface-2/80 bg-surface-2/50 hover:bg-surface-2 text-content-2 hover:text-content-1 transition-colors cursor-pointer shrink-0"
                  title="Mese Successivo"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Month Quick Select */}
              <div className="flex items-center gap-2 flex-wrap">
                {browsingMonthIndex === calendar.currentMonthIndex && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-[2px] bg-primary/10 text-primary border border-primary/30 font-semibold shrink-0">
                    Mese Corrente
                  </span>
                )}
                <select
                  value={browsingMonthIndex}
                  onChange={(e) => setBrowsingMonthIndex(parseInt(e.target.value))}
                  className="bg-surface-2/60 border border-surface-2/90 rounded-[2px] px-2.5 py-1 text-xs font-mono text-content-1 outline-none cursor-pointer max-w-full"
                >
                  {calendar.months.map((m, idx) => (
                    <option key={m.id || idx} value={idx}>
                      #{idx + 1} {m.name} ({m.days}gg)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Griglia del Mese a Tavola Continua (Matrice 10 Colonne x 3 Righe a Filetti Continui) */}
            <div className="overflow-x-auto w-full pb-1">
              <div
                className="min-w-[680px] sm:min-w-0 border border-surface-2/90 bg-surface-1/60 rounded-[2px] overflow-hidden"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gap: 0,
                }}
              >
                {Array.from({ length: activeBrowsingMonth?.days || 30 }, (_, i) => {
                  const dayNum = i + 1;
                  const isCurrentCampaignDay =
                    browsingMonthIndex === calendar.currentMonthIndex &&
                    dayNum === calendar.currentDay;
                  const isSelected = selectedDayNumber === dayNum;
                  const dayData = monthDayDataMap.get(dayNum);
                  const hasEvents = (dayData?.events?.length || 0) > 0;
                  const hasSessions = (dayData?.sessions?.length || 0) > 0;
                  const hasMemories = (dayData?.memories?.length || 0) > 0;
                  const hasAnyActivity = hasEvents || hasSessions || hasMemories;

                  const isLastCol = dayNum % 10 === 0;
                  const isLastRow = dayNum > 20;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setSelectedDayNumber(dayNum)}
                      className={`min-h-[80px] p-2 sm:p-2.5 flex flex-col justify-between text-left transition-all relative cursor-pointer group ${
                        isSelected
                          ? 'bg-primary/20 shadow-[inset_0_0_12px_var(--color-primary-muted)] z-10'
                          : isCurrentCampaignDay
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : 'bg-surface-1/90 hover:bg-surface-2/80'
                      }`}
                      style={{
                        borderRight: isLastCol ? 'none' : '1px solid var(--color-surface-2, rgba(255, 255, 255, 0.08))',
                        borderBottom: isLastRow ? 'none' : '1px solid var(--color-surface-2, rgba(255, 255, 255, 0.08))',
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`font-cinzel text-[0.9rem] font-semibold transition-colors ${
                            isCurrentCampaignDay
                              ? 'text-primary font-bold'
                              : isSelected
                              ? 'text-content-1 font-bold'
                              : 'text-content-2 group-hover:text-content-1 opacity-85'
                          }`}
                        >
                          {dayNum}
                        </span>
                        {isCurrentCampaignDay && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Giorno attuale nella campagna" />
                        )}
                      </div>

                      {/* Micro-marcatore geometrico discreto in basso al centro */}
                      <div className="w-full flex items-center justify-center min-h-[8px]">
                        {hasAnyActivity && (
                          <span
                            className="w-[5px] h-[5px] rounded-full bg-primary mx-auto shadow-xs"
                            title={`${(dayData?.events?.length || 0) + (dayData?.sessions?.length || 0) + (dayData?.memories?.length || 0)} registrazioni`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DAY INSPECTOR: Estratto d'Archivio del Giorno Selezionato */}
          {selectedDayNumber !== null && selectedDayData && (
            <div className="border border-surface-2/80 bg-surface-1/60 rounded-[2px] p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[2px] bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-cinzel font-bold text-sm">
                    {selectedDayNumber}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-primary font-semibold">
                      ESTRATTO CRONOLOGICO // EFFEMERIDE
                    </div>
                    <h3 className="text-base sm:text-lg font-cinzel font-bold text-content-1">
                      Giorno {selectedDayNumber} {activeBrowsingMonth?.name} &bull; {calendar.currentYear} {calendar.yearSuffix}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {browsingMonthIndex === calendar.currentMonthIndex && selectedDayNumber === calendar.currentDay && (
                    <span className="px-3 py-1 bg-primary/15 text-primary text-xs font-mono uppercase tracking-wider font-semibold rounded-[2px] border border-primary/30">
                      Giorno Attuale
                    </span>
                  )}
                  {!(browsingMonthIndex === calendar.currentMonthIndex && selectedDayNumber === calendar.currentDay) && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated: CampaignCalendar = {
                          ...calendar,
                          currentDay: selectedDayNumber,
                          currentMonthIndex: browsingMonthIndex,
                        };
                        handleSave(updated);
                      }}
                      className="px-3 py-1.5 bg-surface-2/70 hover:bg-surface-2 text-content-1 text-xs font-mono uppercase tracking-wider rounded-[2px] border border-surface-2/90 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin size={13} className="text-primary" />
                      <span>Imposta come Giorno Attuale</span>
                    </button>
                  )}
                </div>
              </div>

              {/* No Data State */}
              {selectedDayData.events.length === 0 &&
                selectedDayData.sessions.length === 0 &&
                selectedDayData.memories.length === 0 && (
                  <div className="p-8 text-center bg-surface-2/30 border border-dashed border-surface-2/80 rounded-[2px]">
                    <p className="text-xs font-mono text-content-3">
                      Nessun evento, sessione o appunto registrato per il giorno {selectedDayNumber} {activeBrowsingMonth?.name}.
                    </p>
                  </div>
                )}

              {/* Linked Sessions */}
              {selectedDayData.sessions.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-content-3 flex items-center gap-1.5">
                    <BookOpen size={13} className="text-blue-400" />
                    Sessioni di Gioco ({selectedDayData.sessions.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedDayData.sessions.map((s) => (
                      <Link
                        key={s._id}
                        to={`/sessions?select=${s._id}`}
                        className="p-3.5 bg-surface-2/50 hover:bg-surface-2 border border-surface-2/80 hover:border-primary/40 rounded-[2px] transition-all block group cursor-pointer"
                        title={`Apri la cronaca della Sessione #${s.number}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-blue-400 font-mono font-medium">
                            Sessione #{s.number}
                          </span>
                          {s.loreDate && (
                            <span className="text-[11px] font-mono text-content-3 truncate">
                              {s.loreDate}
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-cinzel font-bold text-content-1 group-hover:text-primary transition-colors mt-1">
                          {s.title}
                        </h5>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Events */}
              {selectedDayData.events.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-content-3 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-primary" />
                    Eventi della Storyline ({selectedDayData.events.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayData.events.map((ev, idx) => {
                      const evConfig = EVENT_TYPE_CONFIG[ev.eventType || 'mixed'] || EVENT_TYPE_CONFIG.mixed;
                      const Icon = evConfig.icon;
                      return (
                        <Link
                          key={ev.id || idx}
                          to={`/sessions?select=${ev.sessionId}`}
                          className="p-3 bg-surface-2/50 hover:bg-surface-2 border border-surface-2/80 hover:border-primary/40 rounded-[2px] flex items-start gap-3 transition-colors block cursor-pointer group"
                          title={`Apri Sessione #${ev.sessionNumber}`}
                        >
                          <div className={`p-2 rounded-[2px] bg-surface-1 border border-surface-2/90 ${evConfig.color} shrink-0 mt-0.5`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-content-1 group-hover:text-primary transition-colors">
                                {ev.title}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] font-medium bg-surface-1 ${evConfig.color}`}>
                                {evConfig.label}
                              </span>
                              <span className="text-[10px] text-content-3 font-mono">
                                In Sessione #{ev.sessionNumber} ({ev.sessionTitle})
                              </span>
                            </div>
                            <p className="text-xs text-content-2 mt-1 leading-relaxed">
                              {ev.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Linked Scrapbook / Visual Memories */}
              {selectedDayData.memories.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-content-3 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-emerald-400" />
                    Memorie Visive del Diario ({selectedDayData.memories.length})
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {selectedDayData.memories.map((m) => (
                      <div
                        key={m.id}
                        className="w-44 p-2 bg-surface-2/50 border border-surface-2/80 rounded-[2px] flex flex-col gap-1.5 shrink-0"
                      >
                        <div
                          onClick={() => setLightboxImage(m.imageUrl)}
                          className="w-full h-24 rounded-[2px] overflow-hidden bg-surface-1 cursor-pointer"
                        >
                          <img src={m.imageUrl} alt={m.title} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </div>
                        <p className="text-xs font-mono font-medium text-content-1 truncate">{m.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-content-2 mb-1.5">
                Nome del Calendario
              </label>
              <input
                type="text"
                value={calendar.name}
                onChange={(e) => setCalendar({ ...calendar, name: e.target.value })}
                className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-2 mb-1.5">
                Anno Corrente di Gioco
              </label>
              <input
                type="number"
                value={calendar.currentYear}
                onChange={(e) => setCalendar({ ...calendar, currentYear: parseInt(e.target.value) || 0 })}
                className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none font-mono font-bold"
                placeholder="Es. 1492"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-2 mb-1.5">
                Suffisso / Nome dell'Era
              </label>
              <input
                type="text"
                placeholder="Es. CV, DR, Anno Solare"
                value={calendar.yearSuffix}
                onChange={(e) => setCalendar({ ...calendar, yearSuffix: e.target.value })}
                className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none font-mono"
              />
            </div>
          </div>

          {/* Current Day & Month selector */}
          <div className="p-4 bg-surface-2/60 border border-surface-3 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-content-1">Posizione Attuale della Campagna</h4>
              <p className="text-[11px] text-content-3 mt-0.5">
                Imposta esattamente in che giorno, mese e anno si trovano i personaggi.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-content-3 font-mono">Giorno:</span>
                <input
                  type="number"
                  min={1}
                  max={calendar.months[calendar.currentMonthIndex]?.days || 30}
                  value={calendar.currentDay}
                  onChange={(e) => setCalendar({ ...calendar, currentDay: parseInt(e.target.value) || 1 })}
                  className="w-16 bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1 text-xs text-content-1 font-mono text-center outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-content-3 font-mono">Mese:</span>
                <select
                  value={calendar.currentMonthIndex}
                  onChange={(e) => setCalendar({ ...calendar, currentMonthIndex: parseInt(e.target.value) || 0 })}
                  className="bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-1 outline-none cursor-pointer"
                >
                  {calendar.months.map((m, idx) => (
                    <option key={m.id || idx} value={idx}>
                      #{idx + 1} {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List of Months with Edit & Reorder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-content-2">
                Mesi Configurati ({calendar.months.length} mesi totali &bull; Modifica, riordina o elimina)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {calendar.months.map((m, idx) => {
                const isEditingThisMonth = editingMonthIndex === idx;

                if (isEditingThisMonth && editingMonthData) {
                  return (
                    <div
                      key={m.id || idx}
                      className="p-3.5 bg-surface-2 border-2 border-primary rounded-xl space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary font-mono">
                          Modifica Mese #{idx + 1}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-content-3 mb-1">Nome Mese</label>
                          <input
                            type="text"
                            value={editingMonthData.name}
                            onChange={(e) =>
                              setEditingMonthData({ ...editingMonthData, name: e.target.value })
                            }
                            className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-1 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-content-3 mb-1">Giorni</label>
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={editingMonthData.days}
                              onChange={(e) =>
                                setEditingMonthData({
                                  ...editingMonthData,
                                  days: parseInt(e.target.value) || 30,
                                })
                              }
                              className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1 text-xs text-content-1 font-mono text-center outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-content-3 mb-1">Stagione</label>
                            <select
                              value={editingMonthData.season}
                              onChange={(e) =>
                                setEditingMonthData({ ...editingMonthData, season: e.target.value })
                              }
                              className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1 text-xs text-content-1 outline-none"
                            >
                              <option value="Primavera">Primavera</option>
                              <option value="Estate">Estate</option>
                              <option value="Autunno">Autunno</option>
                              <option value="Inverno">Inverno</option>
                              <option value="Intercalare">Intercalare</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-surface-3">
                        <button
                          type="button"
                          onClick={handleCancelEditMonth}
                          className="px-2.5 py-1 text-xs text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditMonth(idx)}
                          className="px-3 py-1 bg-primary text-surface-0 hover:bg-primary-hover text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Salva Mese
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id || idx}
                    className="p-3.5 bg-surface-2 border border-surface-3 rounded-xl flex items-center justify-between gap-2 hover:border-surface-4 transition-colors"
                  >
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-primary font-mono font-medium">
                          #{idx + 1}
                        </span>
                        <strong className="text-xs text-content-1 font-semibold truncate">{m.name}</strong>
                      </div>
                      <p className="text-xs text-content-3 font-mono mt-0.5">
                        {m.days} giorni &bull; {m.season || 'Stagione'}
                      </p>
                    </div>

                    {/* Reorder and Edit Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveMonth(idx, -1)}
                        disabled={idx === 0}
                        className={`p-1 rounded-md transition-colors ${
                          idx === 0
                            ? 'text-surface-3 cursor-not-allowed opacity-30'
                            : 'text-content-3 hover:text-content-1 hover:bg-surface-3 cursor-pointer'
                        }`}
                        title="Sposta prima"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMonth(idx, 1)}
                        disabled={idx === calendar.months.length - 1}
                        className={`p-1 rounded-md transition-colors ${
                          idx === calendar.months.length - 1
                            ? 'text-surface-3 cursor-not-allowed opacity-30'
                            : 'text-content-3 hover:text-content-1 hover:bg-surface-3 cursor-pointer'
                        }`}
                        title="Sposta dopo"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditMonth(idx)}
                        className="p-1 rounded-md text-content-3 hover:text-primary hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Modifica Mese"
                      >
                        <Edit3 size={13} />
                      </button>
                      {calendar.months.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMonth(idx)}
                          className="p-1 rounded-md text-content-3 hover:text-rose-400 hover:bg-surface-3 transition-colors cursor-pointer"
                          title="Rimuovi mese"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Month Form */}
          <form
            onSubmit={handleAddMonth}
            className="p-4 bg-surface-2 border border-surface-3 rounded-xl flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-content-2 mb-1">
                Nuovo Mese
              </label>
              <input
                type="text"
                placeholder="Nome mese..."
                value={newMonthName}
                onChange={(e) => setNewMonthName(e.target.value)}
                className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-1.5 text-xs text-content-1 outline-none"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-content-2 mb-1">Giorni</label>
              <input
                type="number"
                min={1}
                max={365}
                value={newMonthDays}
                onChange={(e) => setNewMonthDays(parseInt(e.target.value) || 30)}
                className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-3 py-1.5 text-xs text-content-1 font-mono text-center outline-none"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-content-2 mb-1">Stagione</label>
              <select
                value={newMonthSeason}
                onChange={(e) => setNewMonthSeason(e.target.value)}
                className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none cursor-pointer"
              >
                <option value="Primavera">Primavera</option>
                <option value="Estate">Estate</option>
                <option value="Autunno">Autunno</option>
                <option value="Inverno">Inverno</option>
                <option value="Intercalare">Intercalare</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-surface-3 hover:bg-surface-4 text-content-1 px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={13} /> Aggiungi Mese
            </button>
          </form>

          <div className="flex justify-end pt-2 border-t border-surface-2">
            <button
              type="button"
              onClick={() => handleSave()}
              className="bg-primary hover:bg-primary-hover text-surface-0 px-5 py-2 rounded-xl font-medium text-xs shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              {saveSuccess ? <Check size={14} /> : <CalendarIcon size={14} />}
              <span>Salva Configurazione</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PRESETS */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-surface-1 border border-surface-2 rounded-2xl space-y-3 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-heading font-semibold text-content-1">
                  Calendario di Harptos (Faerûn / D&amp;D)
                </h4>
                <span className="text-xs font-medium text-primary px-2 py-0.5 bg-primary/10 rounded">
                  Standard 1492 CV
                </span>
              </div>
              <p className="text-xs text-content-3 leading-relaxed mt-2">
                12 mesi da 30 giorni (Hammer, Alturiak, Ches, Tarsakh, Mirtul, Kythorn, Flamerule, Eleasis, Eleint, Marpenoth, Uktar, Nightal) con l'anno standard 1492 CV.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLoadPreset(HARPTOS_CALENDAR)}
              className="w-full py-2 bg-surface-2 hover:bg-surface-3 text-content-1 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} className="text-primary" /> Carica Preset Harptos
            </button>
          </div>

          <div className="p-5 bg-surface-1 border border-surface-2 rounded-2xl space-y-3 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-heading font-semibold text-content-1">
                  Calendario Solare Semplificato
                </h4>
                <span className="text-xs font-medium text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                  Universale 742 Era
                </span>
              </div>
              <p className="text-xs text-content-3 leading-relaxed mt-2">
                12 mesi stagionali descrittivi (Mese del Gelo, Mese del Risveglio, Mese del Sole, Mese del Raccolto...) per ambientazioni homebrew.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLoadPreset(CUSTOM_DEFAULT_CALENDAR)}
              className="w-full py-2 bg-surface-2 hover:bg-surface-3 text-content-1 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} className="text-primary" /> Carica Preset Solare
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-0/80 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img
              src={lightboxImage}
              alt="Ingrandito"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl border border-surface-3"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-surface-1 text-content-1 hover:bg-surface-2 border border-surface-3 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
