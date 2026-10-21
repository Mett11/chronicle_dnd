import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  Scroll,
  BookOpen,
  Layers,
  BookMarked,
  Globe,
  Sparkles,
  Map as MapIcon,
  Calendar,
  Crown,
  Search,
  Bell,
  Palette,
  Settings as SettingsIcon,
  Key,
  Sliders,
  HelpCircle,
  Users,
  Download,
  Shield,
  Dices,
  ArrowRight,
  Volume2,
  VolumeX,
  Sparkle,
  Hash,
  X,
  Flame,
  ChevronDown,
  Award,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { getStoredTheme, ClassTheme } from '../lib/theme';
import { getCampaignTitleClasses } from '../components/CampaignTypographyModal';
import { CampaignMeta } from '../types';

function getContrastTextColor(hexColor?: string): string {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#111827' : '#ffffff';
}

export interface D20FaceConfig {
  id: number; // 1 to 20
  title: string;
  subtitle: string;
  category: string;
  lucideIcon: React.ElementType;
  svgPath: string;
  route?: string;
  actionType?: 'navigate' | 'modal' | 'meme_roll';
  modalEvent?: string;
  resonanceStatus: string;
  description: string;
  badgeCount?: number;
}

export function D20Menu() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);

  const [activeFaceIndex, setActiveFaceIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('chronicle_d20_last_face') || sessionStorage.getItem('chronicle_d20_last_face');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < 20) {
          return parsed;
        }
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem('chronicle_d20_last_face', String(activeFaceIndex));
      sessionStorage.setItem('chronicle_d20_last_face', String(activeFaceIndex));
    } catch {}
  }, [activeFaceIndex]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentTheme, setCurrentTheme] = useState<ClassTheme>(getStoredTheme);
  const [campaignMeta, setCampaignMeta] = useState<CampaignMeta | null>(() => CampaignManager.getCampaignMeta());
  const [calendar, setCalendar] = useState(() => CampaignManager.getCalendar());
  const [unreadNotifs, setUnreadNotifs] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenMobileMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('chronicle_open_mobile_menu', handleOpenMobileMenu);
    return () => window.removeEventListener('chronicle_open_mobile_menu', handleOpenMobileMenu);
  }, []);

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const handleExecuteFaceRef = useRef<(faceConfig: D20FaceConfig) => void>(() => {});

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

      if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right -> face +1
          setActiveFaceIndex((prev) => (prev + 1) % faces.length);
          playClickSound();
        } else {
          // Swipe left -> face -1
          setActiveFaceIndex((prev) => (prev - 1 + faces.length) % faces.length);
          playClickSound();
        }
      } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
        // Tap on face -> enter view
        const active = faces[activeFaceIndex];
        if (active) {
          handleExecuteFaceRef.current(active);
        }
      }
    }
  };

  // Meme Roll Modal State
  const [memeRollResult, setMemeRollResult] = useState<{
    value: number;
    title: string;
    message: string;
    type: 'crit_success' | 'crit_fail' | 'success' | 'fail';
  } | null>(null);
  const [isRollingMeme, setIsRollingMeme] = useState<boolean>(false);

  const titleClasses = getCampaignTitleClasses(campaignMeta);

  // Sync theme changes
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getStoredTheme());
      }
    };
    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    return () => window.removeEventListener('chronicle_theme_changed', handleThemeChange);
  }, []);

  // Sync notifications & metadata
  useEffect(() => {
    if (player) {
      const count = CampaignManager.getUnreadNotificationsCount(player._id, player.isDm, player.email);
      setUnreadNotifs(count);
    }
  }, [player]);

  useEffect(() => {
    const updateMeta = () => {
      setCampaignMeta(CampaignManager.getCampaignMeta());
      setCalendar(CampaignManager.getCalendar());
    };
    window.addEventListener('chronicle_campaign_updated', updateMeta);
    window.addEventListener('chronicle_calendar_updated', updateMeta);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', updateMeta);
      window.removeEventListener('chronicle_calendar_updated', updateMeta);
    };
  }, []);

  // 20 D20 Faces Definition grouped into the 5 requested categories
  const faces: D20FaceConfig[] = useMemo(
    () => [
      // 1. La Cronaca
      {
        id: 1,
        title: 'Sessioni',
        subtitle: 'Registro narrativo, capitoli ed atti della campagna',
        category: 'LA CRONACA',
        lucideIcon: BookOpen,
        svgPath: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
        route: '/sessions',
        resonanceStatus: 'Risonanza Attiva',
        description: 'Consulta il grimorio delle sessioni giocate, gli atti, i riassunti narrativi ed i momenti salienti della saga.',
      },
      {
        id: 2,
        title: 'Diario',
        subtitle: 'Note personali, memorie di sessione e diario del giocatore',
        category: 'LA CRONACA',
        lucideIcon: Scroll,
        svgPath: 'M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4 M19 17V5a2 2 0 0 0-2-2H4',
        route: '/notes',
        resonanceStatus: 'Frequenza Sincronizzata',
        description: 'Scrivi e rileggi le tue note riservate, le teorie, gli indizi ed i diari privati della compagnia.',
      },
      {
        id: 3,
        title: 'Cronologia',
        subtitle: 'Mappa temporale interattiva degli eventi della saga',
        category: 'LA CRONACA',
        lucideIcon: Layers,
        svgPath: 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z M2 12l10 4.5 10-4.5 M2 17l10 4.5 10-4.5',
        route: '/storyline',
        resonanceStatus: 'Linea Temporale Fluida',
        description: 'Visualizza l\'evoluzione degli eventi, la sequenza dei capitoli e le ramificazioni narrative della campagna.',
      },
      {
        id: 4,
        title: 'Sendipietra',
        subtitle: 'Canale arcano di comunicazione e messaggi di gruppo',
        category: 'LA CRONACA',
        lucideIcon: Sparkles,
        svgPath: 'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z',
        route: '/sendipietra',
        resonanceStatus: 'Canale Arcano Aperto',
        description: 'Invia e ricevi dispacci arcani, messaggi telepatici ed annunci in tempo reale con i compagni ed il Master.',
      },

      // 2. La Compagnia
      {
        id: 5,
        title: 'Personaggio',
        subtitle: 'Scheda eroe, background, tratti e albero relazioni',
        category: 'LA COMPAGNIA',
        lucideIcon: Crown,
        svgPath: 'm2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14',
        route: '/character',
        resonanceStatus: 'Anima Eroica Pronta',
        description: 'Ispeziona e modifica il tuo personaggio, il background, le virtù, l\'albero genealogico ed i legami.',
      },
      {
        id: 6,
        title: 'Compagnia',
        subtitle: 'Roster degli eroi, statistiche del party e Hall of Fame',
        category: 'LA COMPAGNIA',
        lucideIcon: Users,
        svgPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
        route: '/party',
        resonanceStatus: 'Compagnia Unita',
        description: 'Presentazione cinematica degli eroi, statistiche persistenti di sessione, ruoli, trofei e colonna sonora del party.',
      },
      {
        id: 7,
        title: 'Recluta',
        subtitle: 'Codice invito, QR code e gestione giocatori del party',
        category: 'LA COMPAGNIA',
        lucideIcon: Users,
        svgPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
        actionType: 'modal',
        modalEvent: 'chronicle_open_invite_modal',
        resonanceStatus: 'Party Invocato',
        description: 'Genera il codice di invito o il QR Code per permettere a nuovi giocatori di unirsi al tavolo di gioco.',
      },
      {
        id: 8,
        title: 'Notifiche',
        subtitle: 'Richieste del Master, votazioni attive e quesiti',
        category: 'LA COMPAGNIA',
        lucideIcon: Bell,
        svgPath: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
        route: '/clarifications',
        resonanceStatus: unreadNotifs > 0 ? `${unreadNotifs} Avvisi Non Letti` : 'Nessuna Pendenza',
        description: 'Rispondi alle notifiche, chiarimenti di regole e quesiti inviati dal Master o dal party.',
        badgeCount: unreadNotifs > 0 ? unreadNotifs : undefined,
      },

      // 3. Il Mondo
      {
        id: 9,
        title: 'Mondo',
        subtitle: 'Geografia, storia antica, pantheon e miti del regno',
        category: 'IL MONDO',
        lucideIcon: Globe,
        svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
        route: '/world-lore',
        resonanceStatus: 'Conoscenza Arcana',
        description: 'Immergiti nella lore del regno, le ere leggendarie, le divinità ed i misteri del cosmo.',
      },
      {
        id: 10,
        title: 'Atlante',
        subtitle: 'Mappe del mondo, pin interattivi e territori esplorabili',
        category: 'IL MONDO',
        lucideIcon: MapIcon,
        svgPath: 'M14 5.5a2 2 0 0 0 1.8 0l3.7-1.8A1 1 0 0 1 21 4.6v12.8a1 1 0 0 1-.6.9l-4.5 2.3a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.7 1.8A1 1 0 0 1 3 19.4V6.6a1 1 0 0 1 .6-.9l4.5-2.3a2 2 0 0 1 1.8 0z M15 5.8v15 M9 3.2v15',
        route: '/map',
        resonanceStatus: 'Mappatura Territoriale',
        description: 'Esplora le mappe tattiche, le regioni, le città ed i punti di interesse registrati durante i viaggi.',
      },
      {
        id: 11,
        title: 'Calendario',
        subtitle: 'Calendario di campagna e avanzamento temporale',
        category: 'IL MONDO',
        lucideIcon: Calendar,
        svgPath: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
        route: '/calendar',
        resonanceStatus: 'Tempo Inserito',
        description: 'Tieni traccia dei giorni trascorsi nel mondo di gioco, festività, fasi lunari e scadenze narrative.',
      },
      {
        id: 12,
        title: 'Codex',
        subtitle: 'Bestiario, PNG, fazioni, luoghi e cimeli leggendari',
        category: 'IL MONDO',
        lucideIcon: BookMarked,
        svgPath: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z M10 2v10l3-2.5 3 2.5V2',
        route: '/codex',
        resonanceStatus: 'Archivio Completo',
        description: 'Sfoglia le schede dettagliate di tutti i personaggi incontrati, fazioni, mostri ed artefatti del mondo.',
      },

      // 4. Strumenti & Sistema
      {
        id: 13,
        title: 'Cerca',
        subtitle: 'Ricerca istantanea tra tutti i documenti della campagna',
        category: 'STRUMENTI & SISTEMA',
        lucideIcon: Search,
        svgPath: 'm21 21-4.3-4.3 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
        route: '/search',
        resonanceStatus: 'Indicizzazione Attiva',
        description: 'Trova istantaneamente qualsiasi nome, luogo, incantesimo, nota o evento menzionato nelle cronache.',
      },
      {
        id: 14,
        title: 'Campagne',
        subtitle: 'Seleziona o passa a un\'altra campagna attiva',
        category: 'STRUMENTI & SISTEMA',
        lucideIcon: Key,
        svgPath: 'm21 2-2 2m-1.5 1.5L12 11l4 4 1.5-1.5 1.5 1.5 3-3-1.5-1.5 2-2z M7.5 13a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
        actionType: 'modal',
        modalEvent: 'chronicle_switch_campaign',
        resonanceStatus: 'Gate Multiverso',
        description: 'Torna al Portale Gate per accedere ad altre campagne o inserire un nuovo codice di invito.',
      },
      {
        id: 15,
        title: 'Tema',
        subtitle: 'Personalizzazione visiva e tavolozza di classe',
        category: 'STRUMENTI & SISTEMA',
        lucideIcon: Palette,
        svgPath: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.7-1.7h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z M6.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
        actionType: 'modal',
        modalEvent: 'chronicle_open_theme_modal',
        resonanceStatus: `Stile: ${currentTheme.name}`,
        description: 'Scegli la veste grafica della tua classe (Paladino, Mago, Bardo, Barbaro, Chierico) e personalizza la palette.',
      },
      {
        id: 16,
        title: 'Tipografia',
        subtitle: 'Personalizza stile del titolo e carattere del logo',
        category: 'STRUMENTI & SISTEMA',
        lucideIcon: Sliders,
        svgPath: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
        actionType: 'modal',
        modalEvent: 'chronicle_open_typography_modal',
        resonanceStatus: 'Font Leggendario',
        description: 'Modifica il carattere tipografico del titolo della campagna (Cinzel, Medieval, Uncial, Modern) ed effetti visivi.',
      },

      // 5. Altro
      {
        id: 17,
        title: 'Manuale',
        subtitle: 'Manuale utente, sezioni e guida rapida',
        category: 'ALTRO',
        lucideIcon: HelpCircle,
        svgPath: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01',
        route: '/tutorial',
        resonanceStatus: 'Grimorio d\'Istruzione',
        description: 'Consulta il manuale della piattaforma, scopri le funzionalità avanzate ed i trucchi del tavolo.',
      },
      {
        id: 18,
        title: 'Impostazioni',
        subtitle: 'Configurazioni di sistema, AI e preferenze dell\'app',
        category: 'ALTRO',
        lucideIcon: SettingsIcon,
        svgPath: 'M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        route: '/settings',
        resonanceStatus: 'Parametri Nominali',
        description: 'Configura i modelli AI dell\'Oracolo, le opzioni di sincronizzazione cloud e le preferenze utente.',
      },
      {
        id: 19,
        title: 'Installa App',
        subtitle: 'Installazione come PWA su Windows, Android o iOS',
        category: 'ALTRO',
        lucideIcon: Download,
        svgPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
        actionType: 'modal',
        modalEvent: 'chronicle_open_install_modal',
        resonanceStatus: 'PWA Pronta',
        description: 'Installa direttamente sul tuo dispositivo per un\'esperienza nativa.',
      },
      {
        id: 20,
        title: 'Tiro del Giorno',
        subtitle: 'Tira il d20 della sorte per il responso quotidiano del destino',
        category: 'ALTRO',
        lucideIcon: Dices,
        svgPath: 'm21 16-4 4-4-4 4-4 4 4z M3 10l4-4 4 4-4 4-4-4z M10 3l4 4-4 4-4-4 4-4z',
        actionType: 'meme_roll',
        resonanceStatus: 'Lancio Meme della Sorte',
        description: 'Esegui il tiro del d20 della giornata! Un responso ironico o epico senza spostarti dal menu.',
      },
    ],
    [currentTheme, unreadNotifs, player]
  );

  const activeFace = faces[activeFaceIndex] || faces[0];

  // Ref to store 3D State
  const threeStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    meshGroup: THREE.Group;
    diceMesh: THREE.Mesh;
    wireMesh: THREE.LineSegments;
    faceNormals: THREE.Vector3[];
    faceUps: THREE.Vector3[];
    materials: THREE.MeshStandardMaterial[];
    rotVelX: number;
    rotVelY: number;
    targetQuaternion: THREE.Quaternion | null;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
  } | null>(null);

  const faceIdMapRef = useRef<number[]>(new Array(20).fill(1));

  // Play audio click
  const playClickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }, [soundEnabled]);

  // Handle Meme Roll Result
  const triggerMemeRoll = useCallback(() => {
    setIsRollingMeme(true);
    playClickSound();

    const val = Math.floor(Math.random() * 20) + 1;

    if (threeStateRef.current) {
      threeStateRef.current.rotVelX = (Math.random() - 0.5) * 0.6 + 0.4;
      threeStateRef.current.rotVelY = (Math.random() - 0.5) * 0.6 + 0.4;
    }

    setTimeout(() => {
      setActiveFaceIndex(val - 1);
      setIsRollingMeme(false);

      let title = '';
      let message = '';
      let type: 'crit_success' | 'crit_fail' | 'success' | 'fail' = 'success';

      if (val === 20) {
        type = 'crit_success';
        title = 'NAT 20! SUCCESSO CRITICO!';
        message = 'Gli Dei del Regno applaudono la tua impresa! Ricevi la benedizione dell\'Oracolo e la gloria del tavolo!';
      } else if (val === 1) {
        type = 'crit_fail';
        title = 'NAT 1! FALLIMENTO CRITICO!';
        message = 'La tua spada scivola e il bardo inciampa sulla sua liuto! Attento al risvolto del destino...';
      } else if (val >= 15) {
        type = 'success';
        title = `NAT ${val}! Tiro Eccellente!`;
        message = 'Il destino ti sorride. La fortuna guida le tue scelte per la sessione di oggi!';
      } else if (val >= 10) {
        type = 'success';
        title = `NAT ${val}! Prova Superata.`;
        message = 'Un esito equilibrato. Il cammino prosegue senza troppi intoppi.';
      } else {
        type = 'fail';
        title = `NAT ${val}! Prova Ardua...`;
        message = 'La sorte tentenna. Prepara gli elisi e mantieni la guardia alta!';
      }

      setMemeRollResult({ value: val, title, message, type });
      playClickSound();
    }, 800);
  }, [playClickSound]);

  // Execute Action for Face
  const handleExecuteFace = useCallback(
    (faceConfig: D20FaceConfig) => {
      try {
        const menuIdx = faces.findIndex((f) => f.id === faceConfig.id);
        const idxToSave = menuIdx !== -1 ? menuIdx : faceConfig.id - 1;
        localStorage.setItem('chronicle_d20_last_face', String(idxToSave));
        sessionStorage.setItem('chronicle_d20_last_face', String(idxToSave));
      } catch {}
      if (faceConfig.actionType === 'meme_roll') {
        triggerMemeRoll();
        return;
      }
      if (faceConfig.route) {
        navigate(faceConfig.route);
        return;
      }
      if (faceConfig.modalEvent) {
        window.dispatchEvent(new CustomEvent(faceConfig.modalEvent));
      }
    },
    [faces, navigate, triggerMemeRoll]
  );

  useEffect(() => {
    handleExecuteFaceRef.current = handleExecuteFace;
  }, [handleExecuteFace]);

  // Exact Upright Quaternion Alignment Math
  const snapToFaceUpright = useCallback((faceIdx: number) => {
    if (!threeStateRef.current) return;
    const state = threeStateRef.current;
    const faceNorm = state.faceNormals[faceIdx];
    const faceUp = state.faceUps[faceIdx];

    if (!faceNorm || !faceUp) return;

    const zAxis = faceNorm.clone().normalize();
    const yAxis = faceUp.clone().sub(zAxis.clone().multiplyScalar(faceUp.dot(zAxis))).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const invMat = basisMat.clone().invert();

    const targetQ = new THREE.Quaternion().setFromRotationMatrix(invMat);
    state.targetQuaternion = targetQ;
  }, []);

  useEffect(() => {
    const activeFaceConfig = faces[activeFaceIndex];
    if (activeFaceConfig && faceIdMapRef.current) {
      const geoFaceIdx = faceIdMapRef.current.indexOf(activeFaceConfig.id);
      if (geoFaceIdx !== -1) {
        snapToFaceUpright(geoFaceIdx);
      }
    }
  }, [activeFaceIndex, faces, snapToFaceUpright]);

  // Keyboard Shortcuts: Typing 1-20, Arrow navigation, Space/Enter, R for Roll
  useEffect(() => {
    let digitTimeout: NodeJS.Timeout | null = null;
    let digitBuffer = '';

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ignore modifier combinations so browser reloads (Ctrl+R, Cmd+R, Ctrl+Alt+R) work as expected
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        digitBuffer += key;

        if (digitTimeout) clearTimeout(digitTimeout);

        const parsed = parseInt(digitBuffer, 10);

        if (digitBuffer.length >= 2) {
          if (parsed >= 1 && parsed <= 20) {
            setActiveFaceIndex(parsed - 1);
            playClickSound();
          }
          digitBuffer = '';
        } else {
          digitTimeout = setTimeout(() => {
            let targetNum = parsed;
            if (targetNum === 0) targetNum = 10;
            if (targetNum >= 1 && targetNum <= 20) {
              setActiveFaceIndex(targetNum - 1);
              playClickSound();
            }
            digitBuffer = '';
          }, 450);
        }
        return;
      }

      if (key === 'ArrowRight' || key === 'ArrowDown') {
        e.preventDefault();
        setActiveFaceIndex((prev) => (prev + 1) % 20);
        playClickSound();
        return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        e.preventDefault();
        setActiveFaceIndex((prev) => (prev - 1 + 20) % 20);
        playClickSound();
        return;
      }

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        const active = faces[activeFaceIndex];
        if (active) {
          handleExecuteFace(active);
        }
        return;
      }

      if (key === 'r' || key === 'R') {
        e.preventDefault();
        triggerMemeRoll();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (digitTimeout) clearTimeout(digitTimeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFaceIndex, faces, handleExecuteFace, playClickSound, triggerMemeRoll]);

  // Generate Canvas Texture for Face i with theme colors and crisp vector SVG glyph
  const createThemeFaceTexture = useCallback(
    (faceCfg: D20FaceConfig, theme: ClassTheme) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.CanvasTexture(canvas);

      const mainHex = theme.accentColor || '#f59e0b';
      const isLight = Boolean(theme.isLight);

      // Background Gradient
      const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 270);
      if (isLight) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, theme.colors.surface1 || '#ffffff');
        grad.addColorStop(0.85, theme.colors.surface2 || '#f1e5d8');
        grad.addColorStop(1, theme.colors.surface3 || '#e2cfbd');
      } else {
        const bgSurface = theme.colors.surface0 || '#0b0d11';
        const bgSurface1 = theme.colors.surface1 || '#141820';
        grad.addColorStop(0, bgSurface1);
        grad.addColorStop(0.7, bgSurface);
        grad.addColorStop(1, '#050608');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Outer Triangular Border (Upright top at 256, 30)
      ctx.beginPath();
      ctx.moveTo(256, 30);
      ctx.lineTo(35, 450);
      ctx.lineTo(477, 450);
      ctx.closePath();
      ctx.strokeStyle = mainHex;
      ctx.lineWidth = 14;
      ctx.stroke();

      // Inner Hairline Border
      ctx.beginPath();
      ctx.moveTo(256, 52);
      ctx.lineTo(52, 438);
      ctx.lineTo(460, 438);
      ctx.closePath();
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Number #1..#20
      ctx.shadowColor = mainHex;
      ctx.shadowBlur = isLight ? 4 : 18;
      ctx.fillStyle = isLight ? theme.colors.content1 || '#111827' : '#ffffff';
      const isDoubleDigit = faceCfg.id >= 10;
      ctx.font = isDoubleDigit
        ? 'bold 80px "Cinzel", "Playfair Display", Georgia, serif'
        : 'bold 105px "Cinzel", "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${faceCfg.id}`, 256, isDoubleDigit ? 212 : 205);

      // Dedicated Vector SVG Glyph rendered directly onto canvas
      if (faceCfg.svgPath && typeof Path2D !== 'undefined') {
        ctx.save();
        ctx.translate(256, 310);
        ctx.scale(2.2, 2.2);
        ctx.translate(-12, -12); // Center 24x24 icon viewport
        ctx.strokeStyle = isLight ? theme.colors.content1 || '#111827' : mainHex;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = isLight ? 2 : 10;
        ctx.shadowColor = mainHex;
        const path = new Path2D(faceCfg.svgPath);
        ctx.stroke(path);
        ctx.restore();
      }

      // Title (Centered, uppercase, crisp)
      ctx.shadowBlur = isLight ? 2 : 6;
      ctx.fillStyle = isLight ? theme.colors.primary || mainHex : mainHex;
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      const displayTitle = faceCfg.title.length > 16 ? faceCfg.title.substring(0, 14) + '..' : faceCfg.title;
      ctx.fillText(displayTitle.toUpperCase(), 256, 365);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    },
    []
  );

  // Auto-scroll active item chip into view in the horizontal list
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (itemRefs.current[activeFaceIndex]) {
      itemRefs.current[activeFaceIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeFaceIndex]);

  // Initialize Three.js 3D Canvas
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const isMobile = width < 640;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, isMobile ? 8.2 : 7.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = currentTheme.isLight ? 1.4 : 1.3;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Lights with high-radiance light mode adaptation
    const ambientLight = new THREE.AmbientLight(0xffffff, currentTheme.isLight ? 2.4 : 1.5);
    scene.add(ambientLight);

    const themeLightColor = new THREE.Color(currentTheme.accentColor || '#f59e0b');
    const spotlight = new THREE.DirectionalLight(themeLightColor, currentTheme.isLight ? 2.2 : 2.8);
    spotlight.position.set(5, 6, 6);
    scene.add(spotlight);

    const rimLight = new THREE.PointLight(currentTheme.isLight ? 0x93c5fd : 0x38bdf8, currentTheme.isLight ? 1.2 : 2.0, 20);
    rimLight.position.set(-6, -4, 4);
    scene.add(rimLight);

    const frontLight = new THREE.PointLight(0xffffff, currentTheme.isLight ? 2.2 : 1.8, 15);
    frontLight.position.set(0, 0, 8);
    scene.add(frontLight);

    // 3. Sleek, Refined Icosahedron Base Geometry (1.25 radius on mobile, 1.65 on desktop)
    const diceRadius = width < 640 ? 1.25 : 1.65;
    const rawGeo = new THREE.IcosahedronGeometry(diceRadius, 0).toNonIndexed();
    const rawPos = rawGeo.attributes.position;

    const sortedPos = new Float32Array(60 * 3);
    const sortedUvs = new Float32Array(60 * 2);

    const faceNormals: THREE.Vector3[] = [];
    const faceUps: THREE.Vector3[] = [];

    const baseGeo = new THREE.BufferGeometry();

    for (let i = 0; i < 20; i++) {
      baseGeo.addGroup(i * 3, 3, i);

      const p0 = new THREE.Vector3(rawPos.getX(i * 3), rawPos.getY(i * 3), rawPos.getZ(i * 3));
      const p1 = new THREE.Vector3(rawPos.getX(i * 3 + 1), rawPos.getY(i * 3 + 1), rawPos.getZ(i * 3 + 1));
      const p2 = new THREE.Vector3(rawPos.getX(i * 3 + 2), rawPos.getY(i * 3 + 2), rawPos.getZ(i * 3 + 2));

      const center = new THREE.Vector3().add(p0).add(p1).add(p2).divideScalar(3);
      const faceNorm = center.clone().normalize();
      faceNormals.push(faceNorm);

      let worldRef = new THREE.Vector3(0, 1, 0);
      if (Math.abs(faceNorm.y) > 0.85) {
        worldRef.set(0, 0, -1);
      }

      // Pick the apex vertex that is closest to world UP / ref
      const verts = [p0, p1, p2];
      verts.sort((a, b) => b.dot(worldRef) - a.dot(worldRef));
      const vApex = verts[0];

      // Define faceUp precisely from center to apex
      const faceUp = vApex.clone().sub(center).normalize();
      faceUps.push(faceUp);

      // Correct cross product order: faceUp x faceNorm = +X (RIGHT in screen space)
      const faceRight = new THREE.Vector3().crossVectors(faceUp, faceNorm).normalize();

      // Separate the other two vertices into Left and Right
      const remaining = [verts[1], verts[2]].sort((a, b) => {
        return a.clone().sub(center).dot(faceRight) - b.clone().sub(center).dot(faceRight);
      });
      const vLeft = remaining[0];
      const vRight = remaining[1];

      let v0 = vApex;
      let uv0 = [0.5, 0.95];
      let v1 = vRight;
      let uv1 = [0.95, 0.10];
      let v2 = vLeft;
      let uv2 = [0.05, 0.10];

      // Check triangle outward winding order against face normal
      const edge1 = new THREE.Vector3().subVectors(v1, v0);
      const edge2 = new THREE.Vector3().subVectors(v2, v0);
      const triNorm = new THREE.Vector3().crossVectors(edge1, edge2);

      if (triNorm.dot(faceNorm) < 0) {
        v1 = vLeft;
        uv1 = [0.05, 0.10];
        v2 = vRight;
        uv2 = [0.95, 0.10];
      }

      sortedPos[i * 9 + 0] = v0.x;
      sortedPos[i * 9 + 1] = v0.y;
      sortedPos[i * 9 + 2] = v0.z;

      sortedPos[i * 9 + 3] = v1.x;
      sortedPos[i * 9 + 4] = v1.y;
      sortedPos[i * 9 + 5] = v1.z;

      sortedPos[i * 9 + 6] = v2.x;
      sortedPos[i * 9 + 7] = v2.y;
      sortedPos[i * 9 + 8] = v2.z;

      sortedUvs[i * 6 + 0] = uv0[0];
      sortedUvs[i * 6 + 1] = uv0[1];

      sortedUvs[i * 6 + 2] = uv1[0];
      sortedUvs[i * 6 + 3] = uv1[1];

      sortedUvs[i * 6 + 4] = uv2[0];
      sortedUvs[i * 6 + 5] = uv2[1];
    }

    baseGeo.setAttribute('position', new THREE.BufferAttribute(sortedPos, 3));
    baseGeo.setAttribute('uv', new THREE.BufferAttribute(sortedUvs, 2));
    baseGeo.computeVertexNormals();

    // Compute opposite pairs faceIdMap summing to 21
    const assigned = new Array(20).fill(false);
    const faceIdMap = new Array(20).fill(1);
    const oppositeIdPairs: [number, number][] = [
      [20, 1],
      [19, 2],
      [18, 3],
      [17, 4],
      [16, 5],
      [15, 6],
      [14, 7],
      [13, 8],
      [12, 9],
      [11, 10],
    ];

    let pairIdx = 0;
    for (let i = 0; i < 20; i++) {
      if (assigned[i]) continue;
      for (let j = i + 1; j < 20; j++) {
        if (!assigned[j] && faceNormals[i].dot(faceNormals[j]) < -0.99) {
          const [idA, idB] = oppositeIdPairs[pairIdx++];
          faceIdMap[i] = idA;
          faceIdMap[j] = idB;
          assigned[i] = true;
          assigned[j] = true;
          break;
        }
      }
      if (!assigned[i]) {
        faceIdMap[i] = pairIdx < 10 ? oppositeIdPairs[pairIdx][0] : 1;
        assigned[i] = true;
      }
    }
    faceIdMapRef.current = faceIdMap;

    // 4. Generate Materials with Theme Colors
    const materials: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 20; i++) {
      const faceId = faceIdMap[i];
      const faceCfg = faces.find((f) => f.id === faceId) || faces[0];
      const texture = createThemeFaceTexture(faceCfg, currentTheme);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: currentTheme.isLight ? 0.35 : 0.2,
        metalness: currentTheme.isLight ? 0.45 : 0.75,
        side: THREE.DoubleSide,
      });
      materials.push(mat);
    }

    const meshGroup = new THREE.Group();
    const diceMesh = new THREE.Mesh(baseGeo, materials);
    meshGroup.add(diceMesh);

    // 5. Wireframe Edges Overlay matching Theme Accent Color
    const edgesGeo = new THREE.EdgesGeometry(baseGeo, 15);
    const edgesMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(currentTheme.accentColor || '#f59e0b'),
      linewidth: 2,
      transparent: true,
      opacity: currentTheme.isLight ? 0.7 : 0.9,
    });
    const wireMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    meshGroup.add(wireMesh);

    scene.add(meshGroup);

    // Store state
    const state = {
      scene,
      camera,
      renderer,
      meshGroup,
      diceMesh,
      wireMesh,
      faceNormals,
      faceUps,
      materials,
      rotVelX: 0,
      rotVelY: 0,
      targetQuaternion: null as THREE.Quaternion | null,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      pointerStartX: 0,
      pointerStartY: 0,
      hasDragged: false,
    };
    threeStateRef.current = state;

    const initialFaceConfig = faces[activeFaceIndex];
    if (initialFaceConfig && faceIdMap) {
      const geoFaceIdx = faceIdMap.indexOf(initialFaceConfig.id);
      if (geoFaceIdx !== -1) {
        snapToFaceUpright(geoFaceIdx);
        if (state.targetQuaternion) {
          meshGroup.quaternion.copy(state.targetQuaternion);
        }
      }
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const domElem = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (isMobile) return;
      state.isDragging = true;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      state.pointerStartX = e.clientX;
      state.pointerStartY = e.clientY;
      state.hasDragged = false;
      state.targetQuaternion = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.lastMouseX;
      const dy = e.clientY - state.lastMouseY;

      if (Math.hypot(e.clientX - state.pointerStartX, e.clientY - state.pointerStartY) > 6) {
        state.hasDragged = true;
      }

      state.rotVelY += dx * 0.005;
      state.rotVelX += dy * 0.005;

      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!state.isDragging) return;
      state.isDragging = false;

      // Only handle click actions if pointer wasn't dragged to rotate
      if (!state.hasDragged) {
        const rect = domElem.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        mouse.set(x, y);

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(diceMesh);

        if (intersects.length > 0 && intersects[0].face) {
          const groupIndex = intersects[0].face.materialIndex;
          const selectedGeoIdx = groupIndex !== undefined ? groupIndex : Math.floor(intersects[0].faceIndex! / 2);

          if (selectedGeoIdx >= 0 && selectedGeoIdx < 20) {
            const clickedFaceId = faceIdMapRef.current[selectedGeoIdx];
            const menuIdx = faces.findIndex((f) => f.id === clickedFaceId);
            if (menuIdx !== -1) {
              if (clickedFaceId === 20 || faces[menuIdx].actionType === 'meme_roll') {
                triggerMemeRoll();
              } else if (menuIdx === activeFaceIndex) {
                const active = faces[menuIdx];
                if (active) {
                  handleExecuteFace(active);
                }
              } else {
                setActiveFaceIndex(menuIdx);
                playClickSound();
              }
            }
          }
        }
      }
    };

    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.position.z = w < 640 ? 8.2 : 7.5;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;

    const animate = () => {
      if (isDisposed) return;
      animId = requestAnimationFrame(animate);

      if (state.targetQuaternion) {
        meshGroup.quaternion.slerp(state.targetQuaternion, 0.1);
        state.rotVelX *= 0.7;
        state.rotVelY *= 0.7;
      } else {
        meshGroup.rotation.y += state.rotVelY;
        meshGroup.rotation.x += state.rotVelX;

        state.rotVelX *= 0.92;
        state.rotVelY *= 0.92;

        if (Math.abs(state.rotVelX) < 0.0001) state.rotVelX = 0;
        if (Math.abs(state.rotVelY) < 0.0001) state.rotVelY = 0;

        const currentMatrix = new THREE.Matrix4().makeRotationFromQuaternion(meshGroup.quaternion);
        let maxDot = -1;
        let closestGeoIdx = 0;

        for (let i = 0; i < 20; i++) {
          const transformedNorm = faceNormals[i].clone().applyMatrix4(currentMatrix);
          const dot = transformedNorm.dot(new THREE.Vector3(0, 0, 1));
          if (dot > maxDot) {
            maxDot = dot;
            closestGeoIdx = i;
          }
        }

        const closestFaceId = faceIdMap[closestGeoIdx];
        const closestMenuIdx = faces.findIndex((f) => f.id === closestFaceId);

        if (closestMenuIdx !== -1 && closestMenuIdx !== activeFaceIndex && state.isDragging) {
          setActiveFaceIndex(closestMenuIdx);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      baseGeo.dispose();
      edgesGeo.dispose();
      edgesMat.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      threeStateRef.current = null;
    };
  }, [currentTheme, createThemeFaceTexture, faces, handleExecuteFace, playClickSound, snapToFaceUpright, triggerMemeRoll]);

  // Mobile Shake Gesture Detection (Devicemotion API)
  useEffect(() => {
    let lastShakeTime = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;
      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      // Detection threshold for physical device shake
      if (magnitude > 17) {
        const now = Date.now();
        if (now - lastShakeTime > 1200) {
          lastShakeTime = now;
          triggerMemeRoll();
        }
      }
    };

    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, [triggerMemeRoll]);

  const ActiveIcon = activeFace.lucideIcon;

  return (
    <div
      className={`min-h-screen text-content-1 font-body select-none relative overflow-hidden flex flex-col justify-between w-full h-screen ${
        currentTheme.isLight ? 'bg-surface-0' : 'bg-[#07080d]'
      }`}
      style={{
        backgroundImage: currentTheme.isLight
          ? `radial-gradient(circle at 50% 50%, ${currentTheme.colors.surface1} 0%, ${currentTheme.colors.surface0} 90%)`
          : `radial-gradient(circle at 50% 50%, ${currentTheme.colors.primaryMuted || 'rgba(245, 158, 11, 0.12)'} 0%, rgba(7, 8, 13, 0.98) 75%)`,
      }}
    >
      {/* ATMOSPHERIC BACKGROUND GLOW */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full blur-[150px] transition-colors duration-500 ${
            currentTheme.isLight ? 'opacity-25' : 'opacity-60'
          }`}
          style={{ backgroundColor: currentTheme.accentColor || '#f59e0b' }}
        />
      </div>

      {/* IMMERSIVE CENTER 3D CANVAS & ROLL INDICATOR WITH TOUCH SWIPE */}
      <div
        className="relative flex-1 z-10 w-full h-full overflow-hidden flex flex-col items-center justify-between p-2 sm:p-4 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* TOP HINT & AUDIO TOGGLE */}
        <div className="relative z-25 flex items-center justify-end gap-3 px-4 sm:px-8 lg:px-10 pt-2 w-full">
          <span className="text-xs font-mono text-content-3/80 tracking-wide">
            Tira il d20 o premi R (o fai swipe left/right)
          </span>

          <button
            type="button"
            onClick={() => setSoundEnabled((p) => !p)}
            className="p-1.5 text-content-3 hover:text-content-1 rounded-lg transition-colors cursor-pointer"
            title={soundEnabled ? 'Disattiva Audio' : 'Attiva Audio'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>

        {/* TRUE CENTERED 3D CANVAS */}
        <div
          ref={mountRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10"
          title="Usa il mouse/touch per ruotare il D20, clicca una faccia per selezionarla o fai swipe"
        />

        {/* VERTICAL EDITORIAL TABLE OF CONTENTS MENU (DESKTOP ONLY) */}
        <aside className="absolute left-4 sm:left-8 lg:left-10 top-12 z-30 max-h-[calc(100vh-80px)] h-auto w-[280px] lg:w-[320px] pointer-events-auto select-none hidden md:flex flex-col justify-between">
          {/* Scrollable list container with scrollbars strictly disabled */}
          <div
            className="overflow-y-auto overflow-x-hidden no-scrollbar py-2 space-y-2 sm:space-y-2.5 pr-2 max-h-[calc(100vh-160px)]"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {faces.map((face, idx) => {
              const isActive = idx === activeFaceIndex;
              const faceNumber = String(face.id).padStart(2, '0');

              let categoryTitle = '';
              if (idx === 0) categoryTitle = '1. La Cronaca';
              else if (idx === 4) categoryTitle = '2. La Compagnia';
              else if (idx === 8) categoryTitle = '3. Il Mondo';
              else if (idx === 12) categoryTitle = '4. Strumenti & Sistema';
              else if (idx === 16) categoryTitle = '5. Altro';

              return (
                <React.Fragment key={face.id}>
                  {categoryTitle && (
                    <div className="pt-3 pb-1 first:pt-0">
                      <span
                        className="text-[11px] font-cinzel font-bold tracking-wider uppercase"
                        style={{ color: currentTheme.accentColor }}
                      >
                        {categoryTitle}
                      </span>
                    </div>
                  )}

                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        handleExecuteFace(face);
                      } else {
                        setActiveFaceIndex(idx);
                        playClickSound();
                      }
                    }}
                    className={`group/headline text-left w-full transition-all duration-300 cursor-pointer flex flex-col justify-center py-0.5 px-1 ${
                      isActive
                        ? 'translate-x-2'
                        : 'hover:translate-x-1.5 opacity-65 hover:opacity-100'
                    }`}
                    title={`#${face.id} ${face.title} - Clicca per ${isActive ? (face.actionType === 'meme_roll' ? 'Lanciare' : 'Aprire') : 'Selezionare'}`}
                  >
                    <div className="flex items-baseline gap-2.5 sm:gap-3">
                      {/* Numbering (01., 02., etc.) */}
                      <span
                        className="font-mono text-xs sm:text-sm font-semibold tracking-wider transition-colors shrink-0"
                        style={{ color: isActive ? currentTheme.accentColor : 'var(--color-content-3)' }}
                      >
                        {faceNumber}.
                      </span>

                      {/* Title in Editorial Cinzel Typography */}
                      <span
                        className={`font-cinzel tracking-wider uppercase transition-all duration-300 leading-tight ${
                          isActive
                            ? 'text-lg sm:text-xl font-bold drop-shadow-md'
                            : 'text-sm sm:text-base font-semibold text-content-1 group-hover/headline:text-primary'
                        }`}
                        style={isActive ? { color: currentTheme.accentColor, textShadow: `0 0 16px ${currentTheme.accentColor}50` } : undefined}
                      >
                        {face.title}
                      </span>
                    </div>

                    {/* Subtitle & Action descriptor when active */}
                    {isActive && (
                      <div className="pl-7 sm:pl-8 pt-1 flex items-center gap-2 animate-fadeIn">
                        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-content-3 font-medium truncate max-w-[180px]">
                          {face.subtitle || face.category}
                        </span>
                        <span
                          className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs shrink-0"
                          style={{ backgroundColor: `${currentTheme.accentColor}25`, color: currentTheme.accentColor }}
                        >
                          {face.actionType === 'meme_roll' ? 'Lancia →' : 'Apri →'}
                        </span>
                      </div>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* DOWN ARROW SCROLL INDICATOR: PINNED AT BOTTOM OF ASIDE (IMMEDIATELY VISIBLE ON SCREEN) */}
          <div className="pt-2 pb-1 pl-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-content-3/90 pointer-events-none shrink-0 border-t border-surface-2/40 mt-1">
            <ChevronDown size={14} className="animate-bounce" style={{ color: currentTheme.accentColor }} />
            <span>SCORRI PER ALTRE VOCI</span>
          </div>
        </aside>
      </div>

      {/* MEME ROLL MODAL TOAST */}
      <AnimatePresence>
        {memeRollResult && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              className="bg-surface-1 border border-surface-3 rounded-2xl p-6 max-w-md w-full text-center relative shadow-2xl overflow-hidden text-content-1"
            >
              <button
                type="button"
                onClick={() => setMemeRollResult(null)}
                className="absolute top-4 right-4 text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-2"
              >
                <X size={18} />
              </button>

              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-primary shadow-lg border"
                style={{
                  backgroundColor: `${currentTheme.accentColor}20`,
                  borderColor: currentTheme.accentColor,
                  color: currentTheme.accentColor,
                }}
              >
                {memeRollResult.type === 'crit_success' ? (
                  <Sparkles size={36} />
                ) : memeRollResult.type === 'crit_fail' ? (
                  <Flame size={36} />
                ) : (
                  <Dices size={36} />
                )}
              </div>

              <span className="text-[10px] font-mono uppercase tracking-widest text-content-3 block mb-1">
                • RESPONSO DELLA SORTE DI OGGI •
              </span>

              <h3
                className="text-2xl font-bold font-heading mb-2"
                style={{ color: currentTheme.accentColor }}
              >
                {memeRollResult.title}
              </h3>

              <p className="text-xs text-content-2 leading-relaxed mb-6 bg-surface-2/60 p-3 rounded-xl border border-surface-3">
                {memeRollResult.message}
              </p>

              <button
                type="button"
                onClick={() => setMemeRollResult(null)}
                className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider cursor-pointer shadow-sm"
                style={{
                  backgroundColor: currentTheme.accentColor,
                  color: getContrastTextColor(currentTheme.accentColor),
                }}
              >
                CHIUDI RESPONSO
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE EXTENDED MENU MODAL (TRIGGERED BY HAMBURGER) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col md:hidden p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-surface-2 mb-4 shrink-0">
              <span className="font-cinzel text-lg font-bold text-primary tracking-wider uppercase" style={{ color: currentTheme.accentColor }}>
                Menu D20 & Campagna
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl text-content-3 hover:text-content-1 bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 pb-12">
              {faces.map((face, idx) => {
                const faceNumber = String(face.id).padStart(2, '0');
                let categoryTitle = '';
                if (idx === 0) categoryTitle = '1. La Cronaca';
                else if (idx === 4) categoryTitle = '2. La Compagnia';
                else if (idx === 8) categoryTitle = '3. Il Mondo';
                else if (idx === 12) categoryTitle = '4. Strumenti & Sistema';
                else if (idx === 16) categoryTitle = '5. Altro';

                return (
                  <React.Fragment key={face.id}>
                    {categoryTitle && (
                      <div className="pt-2 pb-1">
                        <span
                          className="text-xs font-cinzel font-bold tracking-wider uppercase"
                          style={{ color: currentTheme.accentColor }}
                        >
                          {categoryTitle}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setActiveFaceIndex(idx);
                        handleExecuteFace(face);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-surface-1/90 border border-surface-3 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-content-3">
                          {faceNumber}.
                        </span>
                        <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-content-1 group-hover:text-primary transition-colors">
                          {face.title}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded"
                        style={{ backgroundColor: `${currentTheme.accentColor}25`, color: currentTheme.accentColor }}
                      >
                        Apri →
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
