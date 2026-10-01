import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { CampaignCalendar, Session } from '../types';
import { Calendar, Sparkles, Clock, ChevronDown, Check, X, CalendarDays } from 'lucide-react';
import { formatLoreDate, parseLoreDateString } from '../lib/loreDateUtils';

export interface LoreDateSuggestion {
  label: string;
  shortLabel?: string;
  value: string;
  tag?: string;
  isRange?: boolean;
  type: 'session_range' | 'session_day' | 'session_single' | 'calendar_today' | 'custom';
}

export interface LoreDateInputProps {
  value: string;
  onChange: (dateString: string) => void;
  sessionId?: string;
  session?: Session | null;
  sessions?: Session[];
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  hideLabel?: boolean;
  autoFillOnSessionChange?: boolean;
}

export function LoreDateInput({
  value: rawValue,
  onChange,
  sessionId,
  session: explicitSession,
  sessions: explicitSessions,
  label = 'Data nel Mondo (Lore)',
  placeholder = 'Es: 31 Kindolin 589 IV era',
  hint,
  required = false,
  className = '',
  inputClassName = '',
  hideLabel = false,
  autoFillOnSessionChange = true,
}: LoreDateInputProps) {
  const value = rawValue || '';
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());
  const [allSessions, setAllSessions] = useState<Session[]>(() => explicitSessions || CampaignManager.getSessions());
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const quickPickerRef = useRef<HTMLDivElement | null>(null);

  // Sync calendar & sessions
  useEffect(() => {
    const handleUpdate = () => {
      setCalendar(CampaignManager.getCalendar());
      if (!explicitSessions) {
        setAllSessions(CampaignManager.getSessions());
      }
    };
    window.addEventListener('chronicle_calendar_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_calendar_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
    };
  }, [explicitSessions]);

  useEffect(() => {
    if (explicitSessions) {
      setAllSessions(explicitSessions);
    }
  }, [explicitSessions]);

  // Resolve active connected session
  const activeSession = useMemo<Session | null>(() => {
    if (explicitSession) return explicitSession;
    if (sessionId) {
      return allSessions.find((s) => s._id === sessionId) || null;
    }
    return null;
  }, [explicitSession, sessionId, allSessions]);

  // Current formatted calendar today string
  const calendarTodayString = useMemo(() => {
    const month = calendar.months[calendar.currentMonthIndex || 0] || calendar.months[0] || { name: 'Mese', days: 30 };
    return formatLoreDate(
      calendar.currentDay || 1,
      undefined,
      month.name,
      calendar.currentYear || 1492,
      calendar.yearSuffix || 'CV'
    );
  }, [calendar]);

  // Compute suggestions from session and calendar
  const suggestions = useMemo<LoreDateSuggestion[]>(() => {
    const list: LoreDateSuggestion[] = [];

    // 1. Session suggestions
    if (activeSession) {
      const sessNumberStr = `Sess. #${activeSession.number}`;
      const sessLore = activeSession.loreDate?.trim();

      // Check if session has multi-day metadata or parsed multi-day string
      const parsedSess = sessLore
        ? parseLoreDateString(sessLore, calendar.months, calendar.currentYear, calendar.yearSuffix)
        : null;

      const hasStructuredMultiDay =
        (activeSession.loreStartDay !== undefined &&
          activeSession.loreEndDay !== undefined &&
          activeSession.loreEndDay > activeSession.loreStartDay) ||
        (activeSession.loreEndMonth && activeSession.loreEndMonth !== activeSession.loreMonth);

      const hasParsedMultiDay = parsedSess?.endDay !== undefined;

      if (hasStructuredMultiDay || hasParsedMultiDay) {
        const start = activeSession.loreStartDay ?? parsedSess?.startDay ?? 1;
        const end = activeSession.loreEndDay ?? parsedSess?.endDay ?? start;
        const startMonth = activeSession.loreMonth || parsedSess?.monthName || calendar.months[0]?.name || 'Mese';
        const endMonth = activeSession.loreEndMonth || parsedSess?.endMonthName || startMonth;
        const year = activeSession.loreYear || parsedSess?.year || calendar.currentYear || 1492;
        const endYear = activeSession.loreEndYear || parsedSess?.endYear || year;
        const suffix = calendar.yearSuffix || 'CV';

        const fullRangeFormatted =
          sessLore ||
          formatLoreDate(
            start,
            end,
            startMonth,
            year,
            suffix,
            endMonth !== startMonth ? endMonth : undefined,
            endYear !== year ? endYear : undefined
          );

        // Entire session range
        list.push({
          label: `${sessNumberStr}: ${fullRangeFormatted}`,
          shortLabel:
            endMonth !== startMonth
              ? `Intera (${start} ${startMonth} - ${end} ${endMonth})`
              : `Intera Sessione (${start}-${end} ${startMonth})`,
          value: fullRangeFormatted,
          tag: `${sessNumberStr} (Tutta)`,
          isRange: true,
          type: 'session_range',
        });

        // Day by day suggestions
        if (startMonth === endMonth && end >= start) {
          const maxDaysToSuggest = Math.min(end - start + 1, 8);
          for (let d = start; d <= start + maxDaysToSuggest - 1; d++) {
            const dayFormatted = formatLoreDate(d, undefined, startMonth, year, suffix);
            const isFirst = d === start;
            const isLast = d === end;
            const dayTag = isFirst ? 'Inizio' : isLast ? 'Fine' : `Giorno ${d}`;

            list.push({
              label: `${sessNumberStr}: Giorno ${d} di ${startMonth} (${dayTag})`,
              shortLabel: `Giorno ${d} (${dayTag})`,
              value: dayFormatted,
              tag: dayTag,
              type: 'session_day',
            });
          }
        } else {
          // Cross-month day suggestions: Inizio e Fine
          const startFormatted = formatLoreDate(start, undefined, startMonth, year, suffix);
          const endFormatted = formatLoreDate(end, undefined, endMonth, endYear, suffix);

          list.push({
            label: `${sessNumberStr}: Inizio (${start} ${startMonth})`,
            shortLabel: `Inizio (${start} ${startMonth})`,
            value: startFormatted,
            tag: 'Inizio',
            type: 'session_day',
          });

          list.push({
            label: `${sessNumberStr}: Fine (${end} ${endMonth})`,
            shortLabel: `Fine (${end} ${endMonth})`,
            value: endFormatted,
            tag: 'Fine',
            type: 'session_day',
          });
        }
      } else if (sessLore) {
        // Single day session with loreDate
        list.push({
          label: `${sessNumberStr}: ${sessLore}`,
          shortLabel: `${sessNumberStr} (${sessLore})`,
          value: sessLore,
          tag: sessNumberStr,
          type: 'session_single',
        });
      }
    }

    // 2. Calendar Today suggestion
    list.push({
      label: `Oggi nel Mondo: ${calendarTodayString}`,
      shortLabel: `Oggi Lore (${calendar.currentDay} ${calendar.months[calendar.currentMonthIndex]?.name || ''})`,
      value: calendarTodayString,
      tag: 'Calendario Attuale',
      type: 'calendar_today',
    });

    return list;
  }, [activeSession, calendar, calendarTodayString]);

  // Track the previous session ID to detect session switches
  const prevSessionIdRef = useRef<string | undefined>(sessionId);
  const isFirstMountRef = useRef<boolean>(true);

  // Auto-fill logic when session changes
  useEffect(() => {
    if (!autoFillOnSessionChange) return;

    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    if (activeSession) {
      const sessLore = activeSession.loreDate?.trim();

      // If user selected a new session, or if value is currently empty, auto-populate from session
      if (sessionChanged || !value.trim()) {
        if (sessLore) {
          onChange(sessLore);
        } else if (!value.trim()) {
          onChange(calendarTodayString);
        }
      }
    } else if (isFirstMountRef.current && !value.trim()) {
      onChange(calendarTodayString);
    }

    isFirstMountRef.current = false;
  }, [sessionId, activeSession, autoFillOnSessionChange, calendarTodayString, onChange, value]);

  // Click outside to close quick picker
  useEffect(() => {
    if (!isQuickPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickPickerRef.current && !quickPickerRef.current.contains(e.target as Node)) {
        setIsQuickPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQuickPickerOpen]);

  // Mini picker internal states
  const parsedValue = useMemo(() => {
    return parseLoreDateString(value, calendar.months, calendar.currentYear, calendar.yearSuffix);
  }, [value, calendar]);

  const [pickerMonthIdx, setPickerMonthIdx] = useState<number>(() => {
    return parsedValue ? parsedValue.monthIndex : calendar.currentMonthIndex || 0;
  });
  const [pickerDay, setPickerDay] = useState<number>(() => {
    return parsedValue ? parsedValue.startDay : calendar.currentDay || 1;
  });
  const [pickerDayInput, setPickerDayInput] = useState<string>(() => {
    return String(parsedValue ? parsedValue.startDay : calendar.currentDay || 1);
  });
  const [pickerYear, setPickerYear] = useState<number>(() => {
    return parsedValue ? parsedValue.year : calendar.currentYear || 1492;
  });
  const [pickerYearInput, setPickerYearInput] = useState<string>(() => {
    return String(parsedValue ? parsedValue.year : calendar.currentYear || 1492);
  });

  // Keep mini-picker in sync if parsed value changes
  useEffect(() => {
    if (parsedValue) {
      setPickerMonthIdx(parsedValue.monthIndex);
      setPickerDay(parsedValue.startDay);
      setPickerDayInput(String(parsedValue.startDay));
      setPickerYear(parsedValue.year);
      setPickerYearInput(String(parsedValue.year));
    }
  }, [parsedValue]);

  const selectedMonthObj = calendar.months[pickerMonthIdx] || calendar.months[0] || { name: 'Mese', days: 30 };
  const maxDaysInPickerMonth = selectedMonthObj.days || 30;

  const handlePickerDayInputChange = (raw: string) => {
    setPickerDayInput(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const clamped = Math.min(maxDaysInPickerMonth, parsed);
      setPickerDay(clamped);
    }
  };

  const handlePickerDayBlur = () => {
    const parsed = parseInt(pickerDayInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setPickerDay(1);
      setPickerDayInput('1');
    } else {
      const clamped = Math.min(maxDaysInPickerMonth, parsed);
      setPickerDay(clamped);
      setPickerDayInput(String(clamped));
    }
  };

  const handlePickerYearInputChange = (raw: string) => {
    setPickerYearInput(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      setPickerYear(parsed);
    }
  };

  const handlePickerYearBlur = () => {
    const parsed = parseInt(pickerYearInput, 10);
    if (isNaN(parsed)) {
      const fallback = calendar.currentYear || 1492;
      setPickerYear(fallback);
      setPickerYearInput(String(fallback));
    } else {
      setPickerYear(parsed);
      setPickerYearInput(String(parsed));
    }
  };

  const handleApplyMiniPicker = () => {
    const formatted = formatLoreDate(
      pickerDay,
      undefined,
      selectedMonthObj.name,
      pickerYear,
      calendar.yearSuffix || 'CV'
    );
    onChange(formatted);
    setIsQuickPickerOpen(false);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {!hideLabel && (
        <div className="flex items-center justify-between">
          <label className="block font-medium text-content-2 text-[11px] font-mono uppercase tracking-wider">
            {label} {required && <span className="text-primary">*</span>}
          </label>

          {activeSession && (
            <span className="text-[10px] text-content-3 font-mono flex items-center gap-1">
              <Sparkles size={10} className="text-primary" />
              Sess. #{activeSession.number}
            </span>
          )}
        </div>
      )}

      {/* Input row with Quick Picker Button */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none font-mono text-xs pr-9 transition-colors ${inputClassName}`}
        />

        <button
          type="button"
          onClick={() => setIsQuickPickerOpen((prev) => !prev)}
          className={`absolute right-1.5 p-1.5 rounded text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer ${
            isQuickPickerOpen ? 'text-primary bg-primary/10' : ''
          }`}
          title="Selettore rapido Calendario Lore"
        >
          <Calendar size={14} />
        </button>

        {/* Quick Mini-Calendar Popover */}
        {isQuickPickerOpen && (
          <div
            ref={quickPickerRef}
            className="absolute right-0 top-full mt-1 z-50 w-72 bg-surface-1 border border-surface-2 rounded-lg shadow-2xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between border-b border-surface-2 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-content-1">
                <CalendarDays size={13} className="text-primary" />
                <span>Calendario di Campagna</span>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPickerOpen(false)}
                className="text-content-3 hover:text-content-1 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-mono text-content-3 mb-1">
                  Mese Lore
                </label>
                <select
                  value={pickerMonthIdx}
                  onChange={(e) => {
                    const nextM = parseInt(e.target.value, 10);
                    setPickerMonthIdx(nextM);
                    const limit = calendar.months[nextM]?.days || 30;
                    if (pickerDay > limit) {
                      setPickerDay(limit);
                      setPickerDayInput(String(limit));
                    }
                  }}
                  className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded px-2 py-1.5 text-xs text-content-1 outline-none cursor-pointer"
                >
                  {calendar.months.map((m, idx) => (
                    <option key={m.id || idx} value={idx}>
                      {m.name} ({m.days}gg)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-content-3 mb-1">
                    Giorno (1-{maxDaysInPickerMonth})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pickerDayInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handlePickerDayInputChange(e.target.value)}
                    onBlur={handlePickerDayBlur}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded px-2 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-content-3 mb-1">
                    Anno ({calendar.yearSuffix || 'CV'})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pickerYearInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handlePickerYearInputChange(e.target.value)}
                    onBlur={handlePickerYearBlur}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded px-2 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(calendarTodayString);
                    setIsQuickPickerOpen(false);
                  }}
                  className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                >
                  Imposta Oggi
                </button>
                <button
                  type="button"
                  onClick={handleApplyMiniPicker}
                  className="px-3 py-1 bg-primary text-surface-0 font-medium rounded text-xs hover:bg-primary-hover transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check size={12} /> Applica
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hint && <p className="text-[10px] text-content-3 leading-tight">{hint}</p>}

      {/* Suggestion Chips Bar */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-content-3 font-mono flex items-center gap-1 shrink-0 mr-0.5">
            <Sparkles size={10} className="text-primary" /> Suggeriti:
          </span>
          {suggestions.map((sug, idx) => {
            const isCurrent = value.trim().toLowerCase() === sug.value.trim().toLowerCase();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(sug.value)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] transition-all flex items-center gap-1 cursor-pointer border ${
                  isCurrent
                    ? 'bg-primary/15 border-primary/40 text-primary font-semibold shadow-2xs'
                    : 'bg-surface-2 hover:bg-surface-3 border-surface-2 text-content-2 hover:text-content-1'
                }`}
                title={`Imposta data su: "${sug.value}"`}
              >
                {isCurrent && <Check size={10} className="text-primary shrink-0" />}
                <span className="truncate max-w-[200px]">{sug.shortLabel || sug.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
