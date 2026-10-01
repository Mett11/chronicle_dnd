import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, Palette, Moon, Sun, Search as SearchIcon } from 'lucide-react';
import { CLASS_THEMES, ClassTheme, getStoredTheme, applyTheme } from '../lib/theme';
import { CampaignManager } from '../store/campaignStore';
import { Portal } from './Portal';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelectorModal({ isOpen, onClose }: ThemeSelectorModalProps) {
  const [currentTheme, setCurrentTheme] = useState<ClassTheme>(getStoredTheme);
  const [modeFilter, setModeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getStoredTheme());
      }
    };
    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('chronicle_theme_changed', handleThemeChange);
    };
  }, []);

  const handleSelectTheme = (theme: ClassTheme) => {
    applyTheme(theme.id);
    setCurrentTheme(theme);
    CampaignManager.saveUserPreferences({ themeId: theme.id });
  };

  const filteredThemes = useMemo(() => {
    return CLASS_THEMES.filter((theme) => {
      const matchesMode =
        modeFilter === 'all'
          ? true
          : modeFilter === 'light'
          ? theme.isLight === true
          : !theme.isLight;

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        theme.name.toLowerCase().includes(q) ||
        theme.vibe.toLowerCase().includes(q) ||
        theme.mainColorLabel.toLowerCase().includes(q) ||
        theme.accentColorLabel.toLowerCase().includes(q);

      return matchesMode && matchesQuery;
    });
  }, [modeFilter, searchQuery]);

  const darkCount = useMemo(() => CLASS_THEMES.filter((t) => !t.isLight).length, []);
  const lightCount = useMemo(() => CLASS_THEMES.filter((t) => t.isLight).length, []);

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col shadow-2xl overflow-hidden shrink-0"
            >
              {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-surface-2 flex items-center justify-between bg-surface-0/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Palette size={20} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-heading font-semibold text-content-1 flex items-center gap-2">
                    Temi D&amp;D
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                      28 Temi (Dark &amp; Light)
                    </span>
                  </h2>
                  <p className="text-xs text-content-3 mt-0.5">
                    Personalizza l'intera interfaccia con le varianti Dark e Light tematiche del Dungeon Master e di ciascuna classe
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Bar & Search */}
            <div className="px-4 sm:px-6 py-3 border-b border-surface-2 bg-surface-0/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-surface-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModeFilter('all')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    modeFilter === 'all'
                      ? 'bg-primary text-surface-0 font-semibold shadow-sm'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                  }`}
                >
                  Tutti ({CLASS_THEMES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModeFilter('dark')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modeFilter === 'dark'
                      ? 'bg-primary text-surface-0 font-semibold shadow-sm'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                  }`}
                >
                  <Moon size={13} />
                  Dark Mode ({darkCount})
                </button>
                <button
                  type="button"
                  onClick={() => setModeFilter('light')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modeFilter === 'light'
                      ? 'bg-primary text-surface-0 font-semibold shadow-sm'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                  }`}
                >
                  <Sun size={13} />
                  Light Mode ({lightCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca classe, colore..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-2 border border-surface-3 rounded-xl text-content-1 placeholder-content-3 focus:outline-none focus:border-primary transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content - Grid of Themes */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
              {filteredThemes.length === 0 ? (
                <div className="text-center py-12 text-content-3 space-y-2">
                  <Palette size={32} className="mx-auto opacity-40" />
                  <p className="text-sm">Nessun tema trovato per i filtri selezionati</p>
                  <button
                    type="button"
                    onClick={() => {
                      setModeFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs text-primary underline cursor-pointer"
                  >
                    Resetta filtri
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredThemes.map((theme) => {
                    const isSelected = currentTheme.id === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme)}
                        className={`group relative text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-surface-2 border-primary ring-2 ring-primary/40 shadow-lg scale-[1.01]'
                            : 'bg-surface-0/70 hover:bg-surface-2/80 border-surface-2 hover:border-surface-3'
                        }`}
                      >
                        {/* Top Bar: Icon + Name + Mode Badge + Selected Radio */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl" role="img" aria-label={theme.name}>
                                {theme.icon}
                              </span>
                              <div>
                                <h3 className="font-heading font-bold text-sm text-content-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                                  {theme.name}
                                  {theme.isLight ? (
                                    <span className="text-[10px] font-sans font-medium px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                                      <Sun size={10} />
                                      Light
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-sans font-medium px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                                      <Moon size={10} />
                                      Dark
                                    </span>
                                  )}
                                </h3>
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="w-6 h-6 rounded-full bg-primary text-surface-0 flex items-center justify-center shadow-md shrink-0">
                                <Check size={14} strokeWidth={3} />
                              </span>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-surface-3 group-hover:border-primary/50 transition-colors shrink-0" />
                            )}
                          </div>

                          {/* Vibe / Atmosphere description */}
                          <p className="text-xs text-content-3 line-clamp-1 italic mb-3">
                            "{theme.vibe}"
                          </p>
                        </div>

                        {/* Bottom Bar: Palette Swatches */}
                        <div className="pt-2.5 border-t border-surface-2/60 flex items-center justify-between text-[11px] text-content-3">
                          <div className="flex items-center gap-2">
                            {/* Main Color Swatch */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-black/20 shadow-inner shrink-0"
                                style={{ backgroundColor: theme.mainColor }}
                                title={`Principale: ${theme.mainColorLabel} (${theme.mainColor})`}
                              />
                              <span className="truncate max-w-[80px]">{theme.mainColorLabel}</span>
                            </div>

                            <span className="text-content-3/40">•</span>

                            {/* Accent Color Swatch */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-black/20 shadow-sm shrink-0"
                                style={{ backgroundColor: theme.accentColor }}
                                title={`Accento: ${theme.accentColorLabel} (${theme.accentColor})`}
                              />
                              <span
                                className="truncate max-w-[80px] font-medium"
                                style={{ color: isSelected ? theme.accentColor : undefined }}
                              >
                                {theme.accentColorLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-2 bg-surface-0/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-content-3">
                <Sparkles size={14} className="text-primary" />
                <span>
                  Tema attivo:{' '}
                  <strong className="text-content-1">
                    {currentTheme.icon} {currentTheme.name}
                  </strong>{' '}
                  <span className="opacity-70">
                    ({currentTheme.isLight ? 'Light' : 'Dark'} - {currentTheme.mainColorLabel} &amp; {currentTheme.accentColorLabel})
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-surface-0 font-medium text-xs shadow-md transition-colors cursor-pointer"
              >
                Fatto
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </Portal>
  );
}

export function ThemePickerInline() {
  const [currentTheme, setCurrentTheme] = useState<ClassTheme>(getStoredTheme);
  const [modeFilter, setModeFilter] = useState<'all' | 'dark' | 'light'>('all');

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getStoredTheme());
      }
    };
    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('chronicle_theme_changed', handleThemeChange);
    };
  }, []);

  const handleSelectTheme = (theme: ClassTheme) => {
    applyTheme(theme.id);
    setCurrentTheme(theme);
  };

  const filteredThemes = useMemo(() => {
    return CLASS_THEMES.filter((theme) => {
      if (modeFilter === 'all') return true;
      if (modeFilter === 'light') return theme.isLight === true;
      return !theme.isLight;
    });
  }, [modeFilter]);

  return (
    <div className="space-y-3">
      {/* Quick Mode Filters */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-surface-3 w-fit">
        <button
          type="button"
          onClick={() => setModeFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            modeFilter === 'all'
              ? 'bg-primary text-surface-0 font-semibold shadow-sm'
              : 'text-content-3 hover:text-content-1'
          }`}
        >
          Tutti ({CLASS_THEMES.length})
        </button>
        <button
          type="button"
          onClick={() => setModeFilter('dark')}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            modeFilter === 'dark'
              ? 'bg-primary text-surface-0 font-semibold shadow-sm'
              : 'text-content-3 hover:text-content-1'
          }`}
        >
          <Moon size={12} />
          Dark ({CLASS_THEMES.filter((t) => !t.isLight).length})
        </button>
        <button
          type="button"
          onClick={() => setModeFilter('light')}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            modeFilter === 'light'
              ? 'bg-primary text-surface-0 font-semibold shadow-sm'
              : 'text-content-3 hover:text-content-1'
          }`}
        >
          <Sun size={12} />
          Light ({CLASS_THEMES.filter((t) => t.isLight).length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredThemes.map((theme) => {
          const isSelected = currentTheme.id === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelectTheme(theme)}
              className={`group relative text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-surface-2 border-primary ring-2 ring-primary/40 shadow-lg scale-[1.01]'
                  : 'bg-surface-0/60 hover:bg-surface-2/70 border-surface-2 hover:border-surface-3'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label={theme.name}>
                      {theme.icon}
                    </span>
                    <span className="font-heading font-bold text-sm text-content-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {theme.name}
                      {theme.isLight ? (
                        <span className="text-[9px] font-sans font-medium px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-0.5">
                          <Sun size={9} />
                          Light
                        </span>
                      ) : (
                        <span className="text-[9px] font-sans font-medium px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-0.5">
                          <Moon size={9} />
                          Dark
                        </span>
                      )}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-primary text-surface-0 flex items-center justify-center shadow-md shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-surface-3 group-hover:border-primary/50 transition-colors shrink-0" />
                  )}
                </div>

                <p className="text-[11px] text-content-3 line-clamp-1 italic mb-2">
                  "{theme.vibe}"
                </p>
              </div>

              <div className="pt-2 border-t border-surface-2/60 flex items-center justify-between text-[10px] text-content-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner shrink-0"
                    style={{ backgroundColor: theme.mainColor }}
                  />
                  <span className="truncate max-w-[70px]">{theme.mainColorLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm shrink-0"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                  <span
                    className="truncate max-w-[70px] font-medium"
                    style={{ color: isSelected ? theme.accentColor : undefined }}
                  >
                    {theme.accentColorLabel}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

