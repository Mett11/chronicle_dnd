import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { CampaignCalendar } from '../types';
import { Calendar, Sparkles, Clock, ArrowRight, Layers } from 'lucide-react';
import { formatLoreDate, parseLoreDateString } from '../lib/loreDateUtils';

export interface LoreDateMeta {
  startDay: number;
  endDay?: number;
  month: string;
  endMonth?: string;
  year: number;
  endYear?: number;
}

interface LoreDatePickerProps {
  value: string;
  onChange: (formattedDate: string, meta?: LoreDateMeta) => void;
  label?: string;
  hint?: string;
  initialMeta?: {
    startDay?: number;
    endDay?: number;
    month?: string;
    endMonth?: string;
    year?: number;
    endYear?: number;
  };
  allowMultiDay?: boolean;
}

export function LoreDatePicker({
  value,
  onChange,
  label = 'Data Lore nel Calendario di Campagna',
  hint = 'Specifica il giorno o l’intervallo di giorni in-game vissuti dai personaggi',
  initialMeta,
  allowMultiDay = true,
}: LoreDatePickerProps) {
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());

  // Listen to calendar changes across the app
  useEffect(() => {
    const handleCalUpdate = () => {
      const updatedCal = CampaignManager.getCalendar();
      setCalendar(updatedCal);
    };
    window.addEventListener('chronicle_calendar_updated', handleCalUpdate);
    window.addEventListener('chronicle_data_updated', handleCalUpdate);
    return () => {
      window.removeEventListener('chronicle_calendar_updated', handleCalUpdate);
      window.removeEventListener('chronicle_data_updated', handleCalUpdate);
    };
  }, []);

  // Parse existing value if initialMeta is not fully provided
  const parsedFromValue = useMemo(() => {
    if (!value) return null;
    return parseLoreDateString(value, calendar.months, calendar.currentYear, calendar.yearSuffix);
  }, [value, calendar]);

  const resolvedMonth = initialMeta?.month || parsedFromValue?.monthName;
  const initialMonthIdx = resolvedMonth
    ? calendar.months.findIndex((m) => m.name.toLowerCase() === resolvedMonth.toLowerCase())
    : calendar.currentMonthIndex !== undefined
    ? calendar.currentMonthIndex
    : 0;

  const validMonthIdx = initialMonthIdx !== -1 ? initialMonthIdx : calendar.currentMonthIndex || 0;

  const resolvedEndMonth = initialMeta?.endMonth || parsedFromValue?.endMonthName;
  const initialEndMonthIdx = resolvedEndMonth
    ? calendar.months.findIndex((m) => m.name.toLowerCase() === resolvedEndMonth.toLowerCase())
    : validMonthIdx;

  const validEndMonthIdx = initialEndMonthIdx !== -1 ? initialEndMonthIdx : validMonthIdx;

  const resolvedStartDay =
    initialMeta?.startDay !== undefined
      ? initialMeta.startDay
      : parsedFromValue?.startDay !== undefined
      ? parsedFromValue.startDay
      : calendar.currentDay || 1;

  const resolvedEndDay =
    initialMeta?.endDay !== undefined
      ? initialMeta.endDay
      : parsedFromValue?.endDay !== undefined
      ? parsedFromValue.endDay
      : '';

  const resolvedYear =
    initialMeta?.year !== undefined
      ? initialMeta.year
      : parsedFromValue?.year !== undefined
      ? parsedFromValue.year
      : calendar.currentYear || 1492;

  const resolvedEndYear =
    initialMeta?.endYear !== undefined
      ? initialMeta.endYear
      : parsedFromValue?.endYear !== undefined
      ? parsedFromValue.endYear
      : resolvedYear;

  const [startMonthIndex, setStartMonthIndex] = useState<number>(validMonthIdx);
  const [endMonthIndex, setEndMonthIndex] = useState<number>(validEndMonthIdx);
  const [startDay, setStartDay] = useState<number>(resolvedStartDay);
  const [startDayInput, setStartDayInput] = useState<string>(String(resolvedStartDay));
  const [endDay, setEndDay] = useState<number | ''>(resolvedEndDay);
  const [endDayInput, setEndDayInput] = useState<string>(resolvedEndDay !== '' ? String(resolvedEndDay) : '');
  const [isMultiDay, setIsMultiDay] = useState(Boolean(resolvedEndDay || resolvedEndMonth && resolvedEndMonth !== resolvedMonth));
  const [year, setYear] = useState<number>(resolvedYear);
  const [yearInput, setYearInput] = useState<string>(String(resolvedYear));
  const [endYear, setEndYear] = useState<number>(resolvedEndYear);
  const [endYearInput, setEndYearInput] = useState<string>(String(resolvedEndYear));

  const currentStartMonth = calendar.months[startMonthIndex] || calendar.months[0] || { name: 'Hammer', days: 30 };
  const currentEndMonth = calendar.months[endMonthIndex] || calendar.months[0] || { name: 'Hammer', days: 30 };
  const maxStartDays = currentStartMonth?.days || 30;
  const maxEndDays = currentEndMonth?.days || 30;

  const isCrossMonth = isMultiDay && (endMonthIndex !== startMonthIndex || endYear !== year);

  const emitDate = useCallback(
    (
      sMIdx: number,
      eMIdx: number,
      sDay: number,
      eDayVal: number | '',
      isMulti: boolean,
      yr: number,
      eYr: number
    ) => {
      const sMonth = calendar.months[sMIdx] || calendar.months[0] || { name: 'Hammer', days: 30 };
      const eMonth = calendar.months[eMIdx] || calendar.months[0] || { name: 'Hammer', days: 30 };
      const crossMonth = isMulti && (eMIdx !== sMIdx || eYr !== yr);

      let eDayNum: number | undefined = undefined;
      if (isMulti && typeof eDayVal === 'number') {
        if (crossMonth) {
          eDayNum = eDayVal;
        } else if (eDayVal > sDay) {
          eDayNum = eDayVal;
        }
      }

      const formatted = formatLoreDate(
        sDay,
        eDayNum,
        sMonth.name,
        yr,
        calendar.yearSuffix || 'CV',
        crossMonth ? eMonth.name : undefined,
        crossMonth && eYr !== yr ? eYr : undefined
      );

      onChange(formatted, {
        startDay: sDay,
        endDay: eDayNum,
        month: sMonth.name,
        endMonth: crossMonth ? eMonth.name : undefined,
        year: yr,
        endYear: crossMonth && eYr !== yr ? eYr : undefined,
      });
    },
    [calendar, onChange]
  );

  // Sync state if initialMeta changes externally
  useEffect(() => {
    if (initialMeta) {
      if (initialMeta.month) {
        const mIdx = calendar.months.findIndex((m) => m.name.toLowerCase() === initialMeta.month!.toLowerCase());
        if (mIdx !== -1) setStartMonthIndex(mIdx);
      }
      if (initialMeta.endMonth) {
        const emIdx = calendar.months.findIndex((m) => m.name.toLowerCase() === initialMeta.endMonth!.toLowerCase());
        if (emIdx !== -1) setEndMonthIndex(emIdx);
      }
      if (initialMeta.startDay !== undefined) {
        setStartDay(initialMeta.startDay);
        setStartDayInput(String(initialMeta.startDay));
      }
      if (initialMeta.endDay !== undefined) {
        setEndDay(initialMeta.endDay);
        setEndDayInput(String(initialMeta.endDay));
        setIsMultiDay(true);
      }
      if (initialMeta.year !== undefined) {
        setYear(initialMeta.year);
        setYearInput(String(initialMeta.year));
      }
      if (initialMeta.endYear !== undefined) {
        setEndYear(initialMeta.endYear);
        setEndYearInput(String(initialMeta.endYear));
      }
    }
  }, [initialMeta, calendar]);

  const handleStartMonthChange = (newMIdx: number) => {
    setStartMonthIndex(newMIdx);
    const newMonth = calendar.months[newMIdx] || { days: 30 };
    let clampedStartDay = startDay;
    if (startDay > newMonth.days) {
      clampedStartDay = newMonth.days;
      setStartDay(clampedStartDay);
      setStartDayInput(String(clampedStartDay));
    }
    // If not cross-month or same month before, keep end month in sync if same
    let nextEndMIdx = endMonthIndex;
    if (!isCrossMonth && newMIdx > endMonthIndex) {
      nextEndMIdx = newMIdx;
      setEndMonthIndex(newMIdx);
    }
    emitDate(newMIdx, nextEndMIdx, clampedStartDay, endDay, isMultiDay, year, endYear);
  };

  const handleEndMonthChange = (newEMIdx: number) => {
    setEndMonthIndex(newEMIdx);
    const newMonth = calendar.months[newEMIdx] || { days: 30 };
    let clampedEndDay = endDay;
    if (typeof endDay === 'number' && endDay > newMonth.days) {
      clampedEndDay = newMonth.days;
      setEndDay(clampedEndDay);
      setEndDayInput(String(clampedEndDay));
    }
    emitDate(startMonthIndex, newEMIdx, startDay, clampedEndDay, isMultiDay, year, endYear);
  };

  // Start Day input handling (Mobile-friendly: permits clearing without immediately snapping to 1)
  const handleStartDayInputChange = (raw: string) => {
    setStartDayInput(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const clamped = Math.min(maxStartDays, parsed);
      setStartDay(clamped);
      emitDate(startMonthIndex, endMonthIndex, clamped, endDay, isMultiDay, year, endYear);
    }
  };

  const handleStartDayBlur = () => {
    const parsed = parseInt(startDayInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setStartDay(1);
      setStartDayInput('1');
      emitDate(startMonthIndex, endMonthIndex, 1, endDay, isMultiDay, year, endYear);
    } else {
      const clamped = Math.min(maxStartDays, parsed);
      setStartDay(clamped);
      setStartDayInput(String(clamped));
      emitDate(startMonthIndex, endMonthIndex, clamped, endDay, isMultiDay, year, endYear);
    }
  };

  // End Day input handling
  const handleEndDayInputChange = (raw: string) => {
    setEndDayInput(raw);
    if (raw === '') {
      setEndDay('');
      emitDate(startMonthIndex, endMonthIndex, startDay, '', isMultiDay, year, endYear);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const clamped = Math.min(maxEndDays, parsed);
      setEndDay(clamped);
      emitDate(startMonthIndex, endMonthIndex, startDay, clamped, isMultiDay, year, endYear);
    }
  };

  const handleEndDayBlur = () => {
    if (endDayInput === '') {
      setEndDay('');
      emitDate(startMonthIndex, endMonthIndex, startDay, '', isMultiDay, year, endYear);
      return;
    }
    const parsed = parseInt(endDayInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      const fallback = isCrossMonth ? 1 : Math.min(startDay + 1, maxStartDays);
      setEndDay(fallback);
      setEndDayInput(String(fallback));
      emitDate(startMonthIndex, endMonthIndex, startDay, fallback, isMultiDay, year, endYear);
    } else {
      const clamped = Math.min(maxEndDays, parsed);
      setEndDay(clamped);
      setEndDayInput(String(clamped));
      emitDate(startMonthIndex, endMonthIndex, startDay, clamped, isMultiDay, year, endYear);
    }
  };

  // Year handling
  const handleYearInputChange = (rawVal: string) => {
    setYearInput(rawVal);
    if (rawVal === '') return;
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) {
      setYear(parsed);
      emitDate(startMonthIndex, endMonthIndex, startDay, endDay, isMultiDay, parsed, endYear);
    }
  };

  const handleYearBlur = () => {
    const parsed = parseInt(yearInput, 10);
    if (isNaN(parsed)) {
      const fallback = calendar.currentYear || 1492;
      setYearInput(String(fallback));
      setYear(fallback);
      emitDate(startMonthIndex, endMonthIndex, startDay, endDay, isMultiDay, fallback, endYear);
    } else {
      setYear(parsed);
      setYearInput(String(parsed));
      emitDate(startMonthIndex, endMonthIndex, startDay, endDay, isMultiDay, parsed, endYear);
    }
  };

  const handleToggleMultiDay = (enable: boolean) => {
    setIsMultiDay(enable);
    if (enable) {
      const nextEndMIdx = endMonthIndex < startMonthIndex ? startMonthIndex : endMonthIndex;
      setEndMonthIndex(nextEndMIdx);
      const defaultEnd = endDay !== '' ? endDay : Math.min(startDay + 1, maxStartDays);
      setEndDay(defaultEnd);
      setEndDayInput(String(defaultEnd));
      emitDate(startMonthIndex, nextEndMIdx, startDay, defaultEnd, true, year, endYear);
    } else {
      setEndDay('');
      setEndDayInput('');
      setEndMonthIndex(startMonthIndex);
      emitDate(startMonthIndex, startMonthIndex, startDay, '', false, year, year);
    }
  };

  const handleSetCurrentCampaignDate = () => {
    const cal = CampaignManager.getCalendar();
    setCalendar(cal);
    const mIdx = cal.currentMonthIndex || 0;
    const cDay = cal.currentDay || 1;
    const cYr = cal.currentYear || 1492;

    setStartMonthIndex(mIdx);
    setEndMonthIndex(mIdx);
    setStartDay(cDay);
    setStartDayInput(String(cDay));
    setEndDay('');
    setEndDayInput('');
    setIsMultiDay(false);
    setYear(cYr);
    setYearInput(String(cYr));
    setEndYear(cYr);
    setEndYearInput(String(cYr));
    emitDate(mIdx, mIdx, cDay, '', false, cYr, cYr);
  };

  // Current formatted label
  const activeFormatted =
    value ||
    formatLoreDate(
      startDay,
      isMultiDay && typeof endDay === 'number' ? endDay : undefined,
      currentStartMonth.name,
      year,
      calendar.yearSuffix || 'CV',
      isCrossMonth ? currentEndMonth.name : undefined,
      isCrossMonth && endYear !== year ? endYear : undefined
    );

  return (
    <div className="p-3.5 bg-surface-1 border border-surface-3 rounded-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-content-1 flex items-center gap-1.5">
          <Calendar size={13} className="text-primary" />
          {label}
        </label>
        <button
          type="button"
          onClick={handleSetCurrentCampaignDate}
          className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold self-start sm:self-auto cursor-pointer"
        >
          <Sparkles size={11} /> Imposta Data Attuale Campagna ({calendar.currentDay}{' '}
          {calendar.months[calendar.currentMonthIndex]?.name}, {calendar.currentYear} {calendar.yearSuffix})
        </button>
      </div>

      {hint && <p className="text-[10px] text-content-3 leading-tight">{hint}</p>}

      {/* SINGLE DAY or START DATE SELECTORS */}
      {!isMultiDay ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          {/* Month Selector */}
          <div className="sm:col-span-6">
            <label className="block text-[9px] uppercase font-bold text-content-2 mb-1">
              Mese Lore ({calendar.name?.split('(')[0]?.trim() || 'Calendario'})
            </label>
            <select
              value={startMonthIndex}
              onChange={(e) => handleStartMonthChange(parseInt(e.target.value, 10))}
              className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none cursor-pointer"
            >
              {calendar.months.map((m, idx) => (
                <option key={m.id || idx} value={idx}>
                  {m.name} ({m.days}gg{m.season ? ` - ${m.season}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Day Input (Mobile safe text input) */}
          <div className="sm:col-span-3">
            <label className="block text-[9px] uppercase font-bold text-content-2 mb-1">
              Giorno (1-{maxStartDays})
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={startDayInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handleStartDayInputChange(e.target.value)}
              onBlur={handleStartDayBlur}
              placeholder="1"
              className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
            />
          </div>

          {/* Year */}
          <div className="sm:col-span-3">
            <label className="block text-[9px] uppercase font-bold text-content-2 mb-1">
              Anno ({calendar.yearSuffix || 'CV'})
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={yearInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handleYearInputChange(e.target.value)}
              onBlur={handleYearBlur}
              placeholder="Es. 1492"
              className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
            />
          </div>
        </div>
      ) : (
        /* MULTI-DAY DUAL DATE SELECTORS (Same Month or Across Months) */
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-surface-2/40 border border-surface-3/70 rounded-xl">
            {/* START DATE (DAL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold font-mono text-emerald-400 flex items-center gap-1">
                  <span>🟢 Inizio (Dal Giorno)</span>
                </span>
                <span className="text-[10px] text-content-3 font-mono">Max {maxStartDays}gg</span>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <label className="block text-[9px] uppercase font-bold text-content-3 mb-0.5">
                    Giorno
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={startDayInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleStartDayInputChange(e.target.value)}
                    onBlur={handleStartDayBlur}
                    placeholder="1"
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-[9px] uppercase font-bold text-content-3 mb-0.5">
                    Mese di Partenza
                  </label>
                  <select
                    value={startMonthIndex}
                    onChange={(e) => handleStartMonthChange(parseInt(e.target.value, 10))}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1.5 text-xs text-content-1 outline-none cursor-pointer"
                  >
                    {calendar.months.map((m, idx) => (
                      <option key={m.id || idx} value={idx}>
                        #{idx + 1} {m.name} ({m.days}gg)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* END DATE (AL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold font-mono text-amber-400 flex items-center gap-1">
                  <span>🏁 Fine (Al Giorno)</span>
                </span>
                <div className="flex items-center gap-1">
                  {startMonthIndex !== endMonthIndex && (
                    <button
                      type="button"
                      onClick={() => handleEndMonthChange(startMonthIndex)}
                      className="text-[9px] text-content-3 hover:text-primary underline cursor-pointer"
                    >
                      Allinea al mese di inizio
                    </button>
                  )}
                  {startMonthIndex === endMonthIndex && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextM = (startMonthIndex + 1) % calendar.months.length;
                        handleEndMonthChange(nextM);
                      }}
                      className="text-[9px] text-primary hover:underline cursor-pointer"
                    >
                      + Mese successivo
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <label className="block text-[9px] uppercase font-bold text-content-3 mb-0.5">
                    Giorno
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={endDayInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleEndDayInputChange(e.target.value)}
                    onBlur={handleEndDayBlur}
                    placeholder="Fine"
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2 py-1.5 text-xs text-content-1 font-mono text-center outline-none font-bold"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-[9px] uppercase font-bold text-content-3 mb-0.5">
                    Mese di Arrivo
                  </label>
                  <select
                    value={endMonthIndex}
                    onChange={(e) => handleEndMonthChange(parseInt(e.target.value, 10))}
                    className={`w-full bg-surface-1 border rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer ${
                      startMonthIndex !== endMonthIndex
                        ? 'border-amber-500/50 text-amber-300 font-semibold'
                        : 'border-surface-3 text-content-1 focus:border-primary'
                    }`}
                  >
                    {calendar.months.map((m, idx) => (
                      <option key={m.id || idx} value={idx}>
                        #{idx + 1} {m.name} ({m.days}gg)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Year selector for multi-day */}
          <div className="flex items-center justify-end gap-2">
            <label className="text-[10px] uppercase font-bold text-content-3 font-mono">
              Anno ({calendar.yearSuffix || 'CV'}):
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={yearInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handleYearInputChange(e.target.value)}
              onBlur={handleYearBlur}
              placeholder="1492"
              className="w-24 bg-surface-2 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1 text-xs text-content-1 font-mono text-center outline-none font-bold"
            />
          </div>
        </div>
      )}

      {/* Multi-day toggle & Live Formatted Result */}
      <div className={`flex flex-wrap items-center ${allowMultiDay ? 'justify-between' : 'justify-end'} gap-2 pt-2 border-t border-surface-3/60`}>
        {allowMultiDay && (
          <label className="flex items-center gap-2 text-[11px] text-content-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isMultiDay}
              onChange={(e) => handleToggleMultiDay(e.target.checked)}
              className="rounded bg-surface-2 border-surface-3 text-primary focus:ring-0 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <Layers size={12} className="text-primary" />
              Sessione/Evento su più giorni in-game (anche a cavallo tra mesi)
            </span>
          </label>
        )}

        {activeFormatted && (
          <div className="text-[11px] font-mono text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 flex items-center gap-1.5 shadow-2xs">
            <Clock size={11} /> {activeFormatted}
          </div>
        )}
      </div>
    </div>
  );
}
