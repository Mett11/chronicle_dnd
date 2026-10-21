import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import {
  Scroll,
  Layers,
  BookOpen,
  Map as MapIcon,
  Calendar,
  Users,
  Ghost,
  MapPin,
  Tag,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Sparkles,
  Shield,
  Crown,
  Menu,
  X,
  Key,
  Bell,
  HelpCircle,
  BookMarked,
  Palette,
  User,
  Globe,
  Database,
  QrCode,
  Dices,
} from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { NotificationsModal } from './NotificationsModal';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { InstallAppModal } from './InstallAppModal';
import { CampaignInviteModal } from './CampaignInviteModal';
import { CampaignTypographyModal, getCampaignTitleClasses } from './CampaignTypographyModal';
import { OrphanTagModal } from './OrphanTagModal';
import { getStoredTheme, ClassTheme } from '../lib/theme';
import { getPwaStatus, subscribePwa, PwaStatus } from '../lib/pwa';
import { CampaignMeta, Note } from '../types';
import { Download, Sliders } from 'lucide-react';

export function Layout() {
  const { player } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isTypographyModalOpen, setIsTypographyModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(getPwaStatus);
  const [currentTheme, setCurrentTheme] = useState<ClassTheme>(getStoredTheme);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [campaignMeta, setCampaignMeta] = useState<CampaignMeta | null>(() => CampaignManager.getCampaignMeta());
  const [orphanTagToResolve, setOrphanTagToResolve] = useState<string | null>(null);

  useEffect(() => {
    const handleResolve = (e: any) => {
      const tag = e?.detail?.tagName;
      if (tag) {
        setOrphanTagToResolve(tag);
      }
    };
    window.addEventListener('chronicle_resolve_orphan_tag', handleResolve);
    return () => window.removeEventListener('chronicle_resolve_orphan_tag', handleResolve);
  }, []);

  useEffect(() => {
    const updatePwa = () => setPwaStatus(getPwaStatus());
    updatePwa();
    return subscribePwa(updatePwa);
  }, []);

  const [calendar, setCalendar] = useState(() => CampaignManager.getCalendar());

  const isIOS = typeof window !== 'undefined' && typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  useEffect(() => {
    const handleCalendarUpdate = () => {
      setCalendar(CampaignManager.getCalendar());
    };
    window.addEventListener('chronicle_calendar_updated', handleCalendarUpdate);
    window.addEventListener('chronicle_data_updated', handleCalendarUpdate);
    window.addEventListener('chronicle_campaign_changed', handleCalendarUpdate);
    return () => {
      window.removeEventListener('chronicle_calendar_updated', handleCalendarUpdate);
      window.removeEventListener('chronicle_data_updated', handleCalendarUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleCalendarUpdate);
    };
  }, []);

  useEffect(() => {
    const handleCampaignUpdate = () => {
      setCampaignMeta(CampaignManager.getCampaignMeta());
    };
    window.addEventListener('chronicle_campaign_updated', handleCampaignUpdate);
    window.addEventListener('chronicle_campaign_changed', handleCampaignUpdate);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleCampaignUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleCampaignUpdate);
    };
  }, []);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getStoredTheme());
      }
    };
    const handleOpenTheme = () => setIsThemeModalOpen(true);
    const handleOpenTypography = () => setIsTypographyModalOpen(true);
    const handleOpenInvite = () => setIsInviteModalOpen(true);
    const handleOpenInstall = () => setIsInstallModalOpen(true);
    const handleSwitch = () => handleSwitchCampaign();

    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    window.addEventListener('chronicle_open_theme_modal', handleOpenTheme);
    window.addEventListener('chronicle_open_typography_modal', handleOpenTypography);
    window.addEventListener('chronicle_open_invite_modal', handleOpenInvite);
    window.addEventListener('chronicle_open_install_modal', handleOpenInstall);
    window.addEventListener('chronicle_switch_campaign', handleSwitch);

    return () => {
      window.removeEventListener('chronicle_theme_changed', handleThemeChange);
      window.removeEventListener('chronicle_open_theme_modal', handleOpenTheme);
      window.removeEventListener('chronicle_open_typography_modal', handleOpenTypography);
      window.removeEventListener('chronicle_open_invite_modal', handleOpenInvite);
      window.removeEventListener('chronicle_open_install_modal', handleOpenInstall);
      window.removeEventListener('chronicle_switch_campaign', handleSwitch);
    };
  }, []);

  const updateNotificationsCount = () => {
    if (!player) return;
    const count = CampaignManager.getUnreadNotificationsCount(player._id, player.isDm, player.email);
    setUnreadNotifsCount(count);
  };

  useEffect(() => {
    updateNotificationsCount();
    const handleNotesUpdate = () => updateNotificationsCount();
    window.addEventListener('chronicle_notes_updated', handleNotesUpdate);
    window.addEventListener('chronicle_notifications_updated', handleNotesUpdate);
    return () => {
      window.removeEventListener('chronicle_notes_updated', handleNotesUpdate);
      window.removeEventListener('chronicle_notifications_updated', handleNotesUpdate);
    };
  }, [player]);

  // Global ⌘K / Ctrl+K keyboard shortcut for Quick Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleSwitchCampaign = () => {
    CampaignManager.setActiveCampaignCode(null);
    try {
      navigate('/character', { replace: true });
    } catch {}
  };

  const handleSelectNoteFromNotification = (noteId: string) => {
    navigate(`/notes?select=${noteId}`);
  };

  const titleClasses = getCampaignTitleClasses(campaignMeta);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-0 font-body text-content-2">
      {/* Sleek Top Header Bar centered to match view content with hamburger button and campaign name */}
      <header className="shrink-0 bg-surface-1/95 backdrop-blur-md border-b border-surface-2 z-30 select-none shadow-xs pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="w-full h-full px-4 sm:px-8 lg:px-10 flex items-center justify-between gap-4 relative">
          {/* Left: Hamburger Menu Button & Campaign Name */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 z-10 min-w-0">
            <Link
              to="/table"
              onClick={(e) => {
                if (location.pathname === '/table') {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('chronicle_open_mobile_menu'));
                }
              }}
              className="p-2 rounded-xl text-content-1 hover:text-primary hover:bg-surface-2/50 transition-all cursor-pointer group flex items-center justify-center shrink-0"
              title="Menu Navigazione D20"
              aria-label="Menu Navigazione D20"
            >
              <Menu size={22} className="text-content-1 group-hover:text-primary group-hover:scale-105 transition-transform" />
            </Link>

            <div className="min-w-0 max-w-[130px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-[320px]">
              <span
                className={`text-sm sm:text-base font-bold select-none truncate block tracking-wider ${titleClasses.fullClass}`}
                style={titleClasses.style}
              >
                {campaignMeta?.name || 'NEW DIVINE ORDER'}
              </span>
            </div>
          </div>

          {/* Center: Search Button (⌘K) & Lore Date perfectly centered to view content */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-3 min-w-0 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl px-2 z-10">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-0 border border-surface-3 text-xs text-content-3 hover:text-content-1 hover:border-surface-4 transition-all w-full max-w-xs sm:max-w-sm text-left cursor-pointer shadow-2xs"
            >
              <Search size={14} className="text-primary shrink-0" />
              <span className="truncate">Cerca in tutta la campagna...</span>
              <kbd className="ml-auto font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-content-3 border border-surface-3">
                ⌘K
              </kbd>
            </button>

            {calendar && (
              <Link
                to="/calendar"
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2/80 hover:bg-surface-3 border border-surface-3 text-[11px] font-mono text-content-2 hover:text-primary transition-all shadow-2xs shrink-0"
                title="Calendario di Lore"
              >
                <Calendar size={13} className="text-primary" />
                <span>
                  {calendar.currentDay} {calendar.months[calendar.currentMonthIndex]?.name} {calendar.currentYear}{' '}
                  {calendar.yearSuffix}
                </span>
              </Link>
            )}
          </div>

          {/* Right: Theme, Search Icon (Mobile), Notifications, Character Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Theme Selector Button */}
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              className="p-2 rounded-xl text-content-2 hover:text-content-1 hover:bg-surface-2/50 transition-all cursor-pointer group"
              title={`Tema D&D: ${currentTheme.name} (Clicca per cambiare)`}
              aria-label="Cambia Tema D&D"
            >
              <Palette size={18} className="text-primary group-hover:scale-105 transition-transform" />
            </button>

            {/* Quick Search Icon for Mobile */}
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="md:hidden p-2 rounded-xl text-content-2 hover:text-content-1 hover:bg-surface-2/50 transition-all cursor-pointer"
              title="Cerca"
              aria-label="Cerca"
            >
              <Search size={18} className="text-primary" />
            </button>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 rounded-xl text-content-2 hover:text-content-1 hover:bg-surface-2/50 transition-all cursor-pointer group"
              title="Apri Centro Notifiche Campagna"
              aria-label="Centro Notifiche Campagna"
            >
              <Bell size={18} className={unreadNotifsCount > 0 ? 'text-primary animate-pulse' : 'text-content-3'} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary text-surface-0 shadow-xs">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Player Profile Link */}
            <Link
              to="/character"
              className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-content-1 hover:text-primary hover:bg-surface-2/50 transition-all cursor-pointer group"
              title={`Profilo: ${player?.characterName || 'Personaggio'}`}
            >
              <div
                className="w-7 h-7 rounded-lg bg-surface-3 border overflow-hidden flex items-center justify-center shrink-0"
                style={{ borderColor: currentTheme.accentColor }}
              >
                {CampaignManager.cleanAvatarString(player?.avatarUrl) ? (
                  <img
                    src={CampaignManager.cleanAvatarString(player?.avatarUrl)}
                    alt={player?.characterName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-heading font-semibold text-[11px] text-primary">
                    {player?.characterName?.charAt(0).toUpperCase() || 'P'}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline text-xs sm:text-sm font-semibold max-w-[110px] truncate group-hover:text-primary transition-colors">
                {player?.characterName}
              </span>
            </Link>
          </div>
        </div>
      </header>

        <main className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar relative flex flex-col pb-[env(safe-area-inset-bottom,0px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              className="flex-1 h-full min-h-0 flex flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <ThemeSelectorModal
          isOpen={isThemeModalOpen}
          onClose={() => setIsThemeModalOpen(false)}
        />

        <InstallAppModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />

        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => {
            setIsNotificationsOpen(false);
            updateNotificationsCount();
          }}
          currentUser={player}
          onSelectNote={handleSelectNoteFromNotification}
        />

        {campaignMeta && (
          <CampaignTypographyModal
            isOpen={isTypographyModalOpen}
            onClose={() => setIsTypographyModalOpen(false)}
            campaign={campaignMeta}
            onSaved={(updated) => setCampaignMeta(updated)}
          />
        )}

        {campaignMeta && (
          <CampaignInviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            campaignCode={campaignMeta.code}
            campaignName={campaignMeta.name}
          />
        )}

        <OrphanTagModal
          isOpen={Boolean(orphanTagToResolve)}
          onClose={() => setOrphanTagToResolve(null)}
          tagName={orphanTagToResolve || ''}
          onResolved={() => {
            setOrphanTagToResolve(null);
          }}
        />
    </div>
  );
}
