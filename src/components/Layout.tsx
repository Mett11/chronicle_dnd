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
  const { player, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('chronicle_theme_changed', handleThemeChange);
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    setMobileMenuOpen(false);
    CampaignManager.setActiveCampaignCode(null);
    try {
      navigate('/character', { replace: true });
    } catch {}
  };

  const handleSelectNoteFromNotification = (noteId: string) => {
    navigate(`/notes?select=${noteId}`);
  };

  const NavItem = ({
    to,
    icon: Icon,
    label,
    badge,
    badgeColor,
    shortcut,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
    badge?: string | number;
    badgeColor?: string;
    shortcut?: string;
  }) => {
    const isCodexLink = to === '/codex';
    const isCodexActive =
      isCodexLink &&
      (location.pathname === '/codex' ||
        location.pathname.startsWith('/codex/') ||
        location.pathname.startsWith('/entities'));

    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive || isCodexActive
              ? 'bg-primary/10 text-primary'
              : 'text-content-2 hover:bg-surface-2 hover:text-content-1'
          }`
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        {badge !== undefined && (
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-tight shrink-0 ${
              badgeColor || 'bg-primary text-surface-0'
            }`}
          >
            {badge}
          </span>
        )}
        {shortcut && (
          <kbd className="hidden lg:inline font-mono text-[10px] text-content-3 opacity-70">
            {shortcut}
          </kbd>
        )}
      </NavLink>
    );
  };

  const titleClasses = getCampaignTitleClasses(campaignMeta);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0 font-body text-content-2">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-1 border-r border-surface-2 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div
          className="px-3 border-b border-surface-2 flex items-center justify-between shrink-0 bg-surface-1 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2.5 h-auto lg:h-14 lg:pt-0"
        >
          <div className="flex-1 min-w-0 flex items-center justify-between group/sidebar-title px-3">
            <Link
              to="/character"
              className="flex items-center min-w-0 flex-1 focus:outline-none"
              title={campaignMeta?.name || 'Campagna'}
            >
              <span
                className={`text-sm sm:text-base font-bold select-none transition-all truncate block ${titleClasses.fullClass}`}
                style={titleClasses.style}
              >
                {campaignMeta?.name || 'Campagna'}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsTypographyModalOpen(true)}
              className="p-1 text-content-3 hover:text-primary hover:bg-surface-2 rounded-md transition-all opacity-0 group-hover/sidebar-title:opacity-100 cursor-pointer shrink-0 ml-1.5"
              title="Personalizza Tipografia & Stile Logo Campagna"
              aria-label="Personalizza Tipografia & Stile Logo Campagna"
            >
              <Sliders size={14} />
            </button>
          </div>

          <button
            className="lg:hidden p-1.5 text-content-3 hover:text-content-1 rounded-md hover:bg-surface-2 transition-colors ml-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Chiudi menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Central Section (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar flex flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-1">
              <NavItem to="/notes" icon={Scroll} label="Diario & Appunti" />
              <NavItem to="/sessions" icon={BookOpen} label="Tomo Sessioni" />
              <NavItem to="/storyline" icon={Layers} label="Storyline" />
              <NavItem to="/codex" icon={BookMarked} label="Codex" />
              <NavItem to="/world-lore" icon={Globe} label="World Lore" />
              <NavItem to="/sendipietra" icon={Sparkles} label="Sendipietra" />
            </div>

            <div>
              <h3 className="px-3 mb-2 text-[10px] font-semibold text-content-3 uppercase tracking-wider">
                Strumenti &amp; Esplorazione
              </h3>
              <div className="space-y-1">
                <NavItem to="/search" icon={Search} label="Cerca" shortcut="⌘K" />
                <NavItem
                  to="/clarifications"
                  icon={Bell}
                  label="Notifiche & Chiarimenti"
                  badge={unreadNotifsCount > 0 ? unreadNotifsCount : undefined}
                  badgeColor="bg-primary text-surface-0 font-bold"
                />
                <NavItem to="/map" icon={MapIcon} label="Atlante" />
                <NavItem to="/tutorial" icon={HelpCircle} label="Guida & Tutorial" />
              </div>
            </div>
          </div>

          {/* ULTIMO ELEMENTO DELLA SEZIONE CENTRALE: DATA DI LORE */}
          {calendar && (
            <div className="pt-3 border-t border-surface-2/60">
              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-primary/15 border-primary/40 text-primary font-semibold shadow-xs'
                      : 'bg-surface-0/70 hover:bg-surface-2 border-surface-2 text-content-2 hover:text-content-1'
                  }`
                }
                title="Data di Lore Corrente • Clicca per aprire il Calendario"
              >
                <Calendar size={15} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-content-3 font-mono block uppercase tracking-wider leading-none mb-0.5">
                    Data di Lore
                  </span>
                  <span className="truncate block font-semibold text-content-1 text-xs">
                    {calendar.currentDay} {calendar.months[calendar.currentMonthIndex]?.name} {calendar.currentYear}{' '}
                    {calendar.yearSuffix}
                  </span>
                </div>
              </NavLink>
            </div>
          )}
        </div>

        {/* Character Profile & Utilities Footer */}
        <div className="p-3 border-t border-surface-2 bg-surface-0/50 space-y-1">
          {/* Character Quick Card */}
          <Link
            to="/character"
            title="Profilo Personaggio & Background"
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-1/80 hover:bg-surface-2 border border-surface-2/80 hover:border-surface-3 transition-colors group mb-2 focus:outline-none"
          >
            <div
              className="w-8 h-8 rounded-lg bg-surface-2 border flex items-center justify-center shrink-0 overflow-hidden group-hover:border-primary transition-colors shadow-xs"
              style={{ borderColor: player.color || '#6366f1' }}
            >
              {player.avatarUrl && player.avatarUrl.trim() ? (
                <img src={player.avatarUrl} alt={player.characterName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-heading font-semibold text-xs text-content-1">
                  {player.characterName?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-content-1 truncate flex items-center gap-1 group-hover:text-primary transition-colors">
                {player.characterName}
                {player.isDm && <Crown size={12} className="text-primary shrink-0" />}
              </p>
              <p className="text-[10px] text-content-3 truncate">
                {player.isDm ? 'Dungeon Master' : 'Profilo Personaggio'}
              </p>
            </div>
          </Link>

          {/* Theme Selector Button */}
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-content-3 hover:bg-surface-2 hover:text-content-1 w-full transition-colors cursor-pointer"
            title={`Tema Classe: ${currentTheme.name} (${currentTheme.vibe})`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0" role="img" aria-label={currentTheme.name}>
                {currentTheme.icon}
              </span>
              <span className="truncate font-heading">Tema: {currentTheme.name}</span>
            </div>
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
              style={{ backgroundColor: currentTheme.accentColor }}
            />
          </button>

          {!pwaStatus.isStandalone && (
            <button
              type="button"
              onClick={() => setIsInstallModalOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary w-full text-left transition-colors cursor-pointer"
              title="Installa Chronicle come applicazione su Windows, Android o iOS"
            >
              <Download size={14} /> Installa App
            </button>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive ? 'bg-surface-2 text-content-1' : 'text-content-3 hover:bg-surface-2 hover:text-content-1'
              }`
            }
          >
            <SettingsIcon size={14} /> Impostazioni
          </NavLink>
          <button
            onClick={handleSwitchCampaign}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-content-3 hover:bg-surface-2 hover:text-content-1 w-full text-left transition-colors cursor-pointer"
          >
            <Key size={14} /> Cambia Campagna
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-error hover:bg-error/10 hover:text-error w-full text-left transition-colors cursor-pointer"
          >
            <LogOut size={14} /> Esci
          </button>
        </div>
      </aside>

      {/* Main Content Area (Full Screen with Safe Area support) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Desktop Top Navbar Bar */}
        <div className="hidden lg:flex shrink-0 bg-surface-1/90 backdrop-blur-md border-b border-surface-2 px-6 py-2.5 items-center justify-between z-30 select-none shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-0 border border-surface-3 text-xs text-content-3 hover:text-content-1 hover:border-surface-4 transition-all w-64 text-left cursor-pointer shadow-2xs"
            >
              <Search size={14} className="text-primary shrink-0" />
              <span className="truncate">Cerca in tutta la campagna...</span>
              <kbd className="ml-auto font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-content-3 border border-surface-3">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Invite Party Button */}
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-surface-3/80 text-content-2 hover:text-content-1 text-xs font-medium transition-all cursor-pointer shadow-2xs group"
              title="Invita giocatori nel party (Link & QR Code)"
            >
              <QrCode size={15} className="text-primary group-hover:scale-110 transition-transform" />
              <span>Invita Party</span>
            </button>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-surface-3/80 text-content-2 hover:text-content-1 transition-all cursor-pointer shadow-2xs group"
              title="Apri Centro Notifiche Campagna"
              aria-label="Centro Notifiche Campagna"
            >
              <Bell size={18} className={unreadNotifsCount > 0 ? 'text-primary animate-pulse' : 'text-content-3'} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary text-surface-0 border border-surface-1 shadow-xs">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Minimal Mobile Top Bar (Reserves space so content is never overlapped) */}
        <div className="lg:hidden shrink-0 bg-surface-1/95 backdrop-blur-md border-b border-surface-2 px-3.5 py-2 pt-[max(env(safe-area-inset-top,0px),0.5rem)] flex items-center justify-between z-30 select-none shadow-xs">
          <Link
            to="/notes"
            className="flex items-center min-w-0 focus:outline-none"
            title={campaignMeta?.name || 'Campagna'}
          >
            <span
              className={`text-sm font-bold transition-all truncate block ${titleClasses.fullClass}`}
              style={titleClasses.style}
            >
              {campaignMeta?.name || 'Campagna'}
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 transition-colors cursor-pointer shrink-0 shadow-2xs"
              aria-label="Notifiche"
              title="Notifiche"
            >
              <Bell size={18} className={unreadNotifsCount > 0 ? 'text-primary animate-pulse' : 'text-content-3'} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-primary text-surface-0">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 transition-colors cursor-pointer shrink-0 shadow-2xs"
              aria-label="Apri menu di navigazione"
              title="Apri Menu"
            >
              <Menu size={18} className="text-primary" />
            </button>
          </div>
        </div>

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
    </div>
  );
}
