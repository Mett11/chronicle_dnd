import React, { useState } from 'react';
import { CampaignCalendar, CalendarMonth } from '../types';
import { HARPTOS_CALENDAR, CUSTOM_DEFAULT_CALENDAR } from '../lib/calendarPresets';
import { CampaignManager } from '../store/campaignStore';
import { Calendar, Plus, Trash2, Check, RotateCcw, Sparkles, Clock, ArrowRight, Sun, Moon, Shield } from 'lucide-react';

interface CalendarManagerProps {
 onSaved?: () => void;
}

export function CalendarManager({ onSaved }: CalendarManagerProps) {
 const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());
 const [dayInput, setDayInput] = useState<string>(() => String(CampaignManager.getCalendar().currentDay || 15));
 const [yearInput, setYearInput] = useState<string>(() => String(CampaignManager.getCalendar().currentYear || 1492));
 const [saveSuccess, setSaveSuccess] = useState(false);
 const [activeTab, setActiveTab] = useState<'current' | 'structure' | 'presets'>('current');

 // New month temp inputs
 const [newMonthName, setNewMonthName] = useState('');
 const [newMonthDays, setNewMonthDays] = useState(30);
 const [newMonthSeason, setNewMonthSeason] = useState('Primavera');

 const handleSave = (newCal?: CampaignCalendar) => {
 const calToSave = newCal || calendar;
 CampaignManager.saveCalendar(calToSave);
 setCalendar(calToSave);
 setSaveSuccess(true);
 if (onSaved) onSaved();
 setTimeout(() => setSaveSuccess(false), 2500);
 };

 const handleLoadPreset = (preset: CampaignCalendar) => {
 handleSave(preset);
 };

 const handleAdvanceDays = (days: number) => {
 const updated = CampaignManager.advanceCalendar(days);
 setCalendar(updated);
 setSaveSuccess(true);
 if (onSaved) onSaved();
 setTimeout(() => setSaveSuccess(false), 2000);
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

 const updated = {
 ...calendar,
 months: [...calendar.months, newM],
 };

 setCalendar(updated);
 setNewMonthName('');
 setNewMonthDays(30);
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
 };

 const currentMonth = calendar.months[calendar.currentMonthIndex] || calendar.months[0];

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-surface-3 flex items-center justify-center text-primary">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-content-1 uppercase">
              Calendario di Campagna (Lore Calendar)
            </h2>
            <p className="text-xs text-content-2">
              {calendar.name} &bull; <strong className="text-primary">Giorno {calendar.currentDay} {currentMonth?.name}, {calendar.currentYear} {calendar.yearSuffix}</strong>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-0/70 p-1 rounded-xl border border-surface-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'current' ? 'bg-primary text-surface-0 shadow' : 'text-content-2 hover:text-content-1'
            }`}
          >
            Data Attuale
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'structure' ? 'bg-primary text-surface-0 shadow' : 'text-content-2 hover:text-content-1'
            }`}
          >
            Mesi &amp; Struttura
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'presets' ? 'bg-primary text-surface-0 shadow' : 'text-content-2 hover:text-content-1'
            }`}
          >
            Preset
          </button>
        </div>
      </div>

      {/* TAB 1: CURRENT IN-GAME DATE */}
      {activeTab === 'current' && (
        <div className="space-y-5">
          <div className="p-4 bg-surface-2/60 rounded-2xl border border-surface-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest block">
                Momento Narrativo Attuale della Campagna
              </span>
              <p className="text-xl sm:text-2xl font-heading text-balance font-semibold text-content-1 mt-1">
                Giorno {calendar.currentDay} di {currentMonth?.name}
              </p>
              <p className="text-xs text-content-2 font-mono mt-0.5">
                Anno {calendar.currentYear} {calendar.yearSuffix} &bull; Stagione: {currentMonth?.season || 'Non specificata'}
              </p>
            </div>

            {/* Advance day buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-mono text-content-3 uppercase block w-full sm:w-auto">Avanza:</span>
              <button
                type="button"
                onClick={() => handleAdvanceDays(1)}
                className="bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-primary text-xs font-bold px-3 py-1.5 rounded-lg text-content-1 transition-all flex items-center gap-1"
              >
                +1 Giorno
              </button>
              <button
                type="button"
                onClick={() => handleAdvanceDays(3)}
                className="bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-primary text-xs font-bold px-3 py-1.5 rounded-lg text-content-1 transition-all flex items-center gap-1"
              >
                +3 Giorni
              </button>
              <button
                type="button"
                onClick={() => handleAdvanceDays(10)}
                className="bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-primary text-xs font-bold px-3 py-1.5 rounded-lg text-content-1 transition-all flex items-center gap-1"
              >
                +10 Giorni
              </button>
            </div>
          </div>

          {/* Quick Manual Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2 mb-1.5">
                Mese Attuale
              </label>
              <select
                value={calendar.currentMonthIndex}
                onChange={(e) =>
                  setCalendar({
                    ...calendar,
                    currentMonthIndex: parseInt(e.target.value),
                    currentDay: Math.min(
                      calendar.currentDay,
                      calendar.months[parseInt(e.target.value)]?.days || 30
                    ),
                  })
                }
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 outline-none"
              >
                {calendar.months.map((m, idx) => (
                  <option key={m.id || idx} value={idx}>
                    #{idx + 1} {m.name} ({m.days} giorni)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2 mb-1.5">
                Giorno Attuale (Max {currentMonth?.days || 30})
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={dayInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setDayInput(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed >= 1) {
                    const clamped = Math.min(currentMonth?.days || 30, parsed);
                    setCalendar((prev) => ({ ...prev, currentDay: clamped }));
                  }
                }}
                onBlur={() => {
                  const parsedNum = parseInt(dayInput, 10);
                  if (isNaN(parsedNum) || parsedNum < 1) {
                    setCalendar((prev) => ({ ...prev, currentDay: 1 }));
                    setDayInput('1');
                  } else {
                    const clamped = Math.min(currentMonth?.days || 30, parsedNum);
                    setCalendar((prev) => ({ ...prev, currentDay: clamped }));
                    setDayInput(String(clamped));
                  }
                }}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2 mb-1.5">
                Anno Attuale
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={yearInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setYearInput(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed)) {
                    setCalendar((prev) => ({ ...prev, currentYear: parsed }));
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(yearInput, 10);
                  if (isNaN(parsed)) {
                    setCalendar((prev) => ({ ...prev, currentYear: 1492 }));
                    setYearInput('1492');
                  } else {
                    setCalendar((prev) => ({ ...prev, currentYear: parsed }));
                    setYearInput(String(parsed));
                  }
                }}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 font-mono outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STRUCTURE & MONTHS */}
      {activeTab === 'structure' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2 mb-1.5">
                Nome del Calendario
              </label>
              <input
                type="text"
                value={calendar.name}
                onChange={(e) => setCalendar({ ...calendar, name: e.target.value })}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2 mb-1.5">
                Suffisso / Nome dell'Era
              </label>
              <input
                type="text"
                placeholder="Es. CV, Anno del Drago, Anno Solare"
                value={calendar.yearSuffix}
                onChange={(e) => setCalendar({ ...calendar, yearSuffix: e.target.value })}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 outline-none"
              />
            </div>
          </div>

          {/* Month list */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-content-2">
              Mesi Configurate ({calendar.months.length} mesi)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {calendar.months.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="p-3 bg-surface-2/60 border border-surface-3 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="text-[10px] text-primary font-mono font-bold mr-1">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-content-1">{m.name}</span>
                    <p className="text-[10px] text-content-3 font-mono mt-0.5">
                      {m.days} giorni {m.season ? `• ${m.season}` : ''}
                    </p>
                  </div>
                  {calendar.months.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMonth(idx)}
                      className="text-content-3 hover:text-red-400 p-1"
                      title="Rimuovi mese"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add month inline form */}
          <form onSubmit={handleAddMonth} className="p-3.5 bg-surface-2/60 border border-surface-3 rounded-xl flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold uppercase text-content-2 mb-1">Nome Mese</label>
              <input
                type="text"
                placeholder="Es. Mese dell'Aurora"
                value={newMonthName}
                onChange={(e) => setNewMonthName(e.target.value)}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 outline-none"
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-bold uppercase text-content-2 mb-1">Giorni</label>
              <input
                type="number"
                min={1}
                max={365}
                value={newMonthDays}
                onChange={(e) => setNewMonthDays(parseInt(e.target.value) || 30)}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs text-content-1 font-mono text-center outline-none"
              />
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-bold uppercase text-content-2 mb-1">Stagione</label>
              <select
                value={newMonthSeason}
                onChange={(e) => setNewMonthSeason(e.target.value)}
                className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-lg px-2 py-1.5 text-xs text-content-1 outline-none"
              >
                <option value="Primavera">Primavera</option>
                <option value="Estate">Estate</option>
                <option value="Autunno">Autunno</option>
                <option value="Inverno">Inverno</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-surface-3 hover:bg-surface-4 text-primary border border-surface-3 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} /> Aggiungi Mese
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: PRESETS */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <p className="text-xs text-content-2">
            Seleziona uno schema di calendario fantasy già pronto per applicarlo istantaneamente alla campagna:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Harptos Preset */}
            <div className="p-4 bg-surface-2/60 border border-surface-3 hover:border-primary rounded-xl space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-content-1">
                    Calendario di Harptos (Faerûn)
                  </h4>
                  <span className="text-[9px] font-bold text-primary px-2 py-0.5 bg-primary/15 rounded">
                    D&amp;D 5e Standard
                  </span>
                </div>
                <p className="text-xs text-content-2 mt-1">
                  12 mesi da 30 giorni (Hammer, Alturiak, Ches, Tarsakh...) con festività speciali come Mezzestate e Granraccolto. Anno 1492 CV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLoadPreset(HARPTOS_CALENDAR)}
                className="mt-3 w-full py-2 bg-surface-3 hover:bg-primary text-content-1 hover:text-surface-0 font-bold text-xs uppercase rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} /> Applica Harptos
              </button>
            </div>

            {/* Standard Custom Fantasy Preset */}
            <div className="p-4 bg-surface-2/60 border border-surface-3 hover:border-primary rounded-xl space-y-2 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-content-1">
                    Calendario Solare Semplificato
                  </h4>
                  <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                    Universale
                  </span>
                </div>
                <p className="text-xs text-content-2 mt-1">
                  12 mesi descrittivi stagionali (Mese del Gelo, Mese dei Germogli, Mese del Sole...) con 30 giorni ciascuno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLoadPreset(CUSTOM_DEFAULT_CALENDAR)}
                className="mt-3 w-full py-2 bg-surface-3 hover:bg-primary text-content-1 hover:text-surface-0 font-bold text-xs uppercase rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} /> Applica Solare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-2">
        <span className="text-[10px] text-content-3 font-mono">
          Le date delle sessioni e la storyline si collegheranno a questo calendario.
        </span>
        <button
          type="button"
          onClick={() => handleSave()}
          className="bg-primary hover:bg-primary text-surface-0 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center gap-2"
        >
          {saveSuccess ? (
            <>
              <Check size={16} />
              <span>Calendario Salvato!</span>
            </>
          ) : (
            <>
              <Calendar size={14} />
              <span>Salva Modifiche Calendario</span>
            </>
          )}
        </button>
      </div>
    </div>
 );
}
