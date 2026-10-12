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
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkle,
  Hash,
  X,
  Flame,
  Award,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { getStoredTheme, ClassTheme } from '../lib/theme';
import { getCampaignTitleClasses } from '../components/CampaignTypographyModal';
import { CampaignMeta } from '../types';

export interface D20FaceConfig {
  id: number; // 1 to 20
  title: string;
  subtitle: string;
  category: 'CAMPAGNA' | 'LORE & ARCHIVI' | 'ESPLORAZIONE' | 'SCHEDA EROE' | 'STRUMENTI' | 'SISTEMA' | 'PERSONALIZZAZIONE' | 'TAVOLO';
  icon: string;
  lucideIcon: React.ElementType;
  route?: string;
  actionType?: 'navigate' | 'modal' | 'meme_roll';
  modalEvent?: string;
  shortcutKey: string;
  resonanceStatus: string;
  description: string;
  badgeCount?: number;
}

export function D20Menu() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);

  const [activeFaceIndex, setActiveFaceIndex] = useState<number>(0); // 0..19
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentTheme, setCurrentTheme] = useState<ClassTheme>(getStoredTheme);
  const [campaignMeta, setCampaignMeta] = useState<CampaignMeta | null>(() => CampaignManager.getCampaignMeta());
  const [calendar, setCalendar] = useState(() => CampaignManager.getCalendar());
  const [unreadNotifs, setUnreadNotifs] = useState<number>(0);

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

  // 20 D20 Faces Definition
  const faces: D20FaceConfig[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Tomo Sessioni',
        subtitle: 'Registro narrativo, capitoli ed atti della campagna',
        category: 'CAMPAGNA',
        icon: '📖',
        lucideIcon: BookOpen,
        route: '/sessions',
        shortcutKey: '1',
        resonanceStatus: 'Risonanza Attiva',
        description: 'Consulta il grimorio delle sessioni giocate, gli atti, i riassunti narrativi ed i momenti salienti della saga.',
      },
      {
        id: 2,
        title: 'Diario & Appunti',
        subtitle: 'Note personali, memorie di sessione e diario del giocatore',
        category: 'CAMPAGNA',
        icon: '📜',
        lucideIcon: Scroll,
        route: '/notes',
        shortcutKey: '2',
        resonanceStatus: 'Frequenza Sincronizzata',
        description: 'Scrivi e rileggi le tue note riservate, le teorie, gli indizi ed i diari privati della compagnia.',
      },
      {
        id: 3,
        title: 'Codex & Archivi',
        subtitle: 'Bestiario, PNG, fazioni, luoghi e cimeli leggendari',
        category: 'LORE & ARCHIVI',
        icon: '📚',
        lucideIcon: BookMarked,
        route: '/codex',
        shortcutKey: '3',
        resonanceStatus: 'Archivio Completo',
        description: 'Sfoglia le schede dettagliate di tutti i personaggi incontrati, fazioni, mostri ed artefatti del mondo.',
      },
      {
        id: 4,
        title: 'Storyline Chrono',
        subtitle: 'Mappa temporale interattiva degli eventi della saga',
        category: 'CAMPAGNA',
        icon: '🌌',
        lucideIcon: Layers,
        route: '/storyline',
        shortcutKey: '4',
        resonanceStatus: 'Linea Temporale Fluida',
        description: 'Visualizza l\'evoluzione degli eventi, la sequenza dei capitoli e le ramificazioni narrative della campagna.',
      },
      {
        id: 5,
        title: 'World Lore',
        subtitle: 'Geografia, storia antica, pantheon e miti del regno',
        category: 'LORE & ARCHIVI',
        icon: '🌐',
        lucideIcon: Globe,
        route: '/world-lore',
        shortcutKey: '5',
        resonanceStatus: 'Conoscenza Arcana',
        description: 'Immergiti nella lore del regno, le ere leggendarie, le divinità ed i misteri del cosmo.',
      },
      {
        id: 6,
        title: 'Sendipietra',
        subtitle: 'Canale arcano di comunicazione e messaggi di gruppo',
        category: 'CAMPAGNA',
        icon: '✨',
        lucideIcon: Sparkles,
        route: '/sendipietra',
        shortcutKey: '6',
        resonanceStatus: 'Canale Arcano Aperto',
        description: 'Invia e ricevi dispacci arcani, messaggi telepatici ed annunci in tempo reale con i compagni ed il Master.',
      },
      {
        id: 7,
        title: 'Atlante Cartografico',
        subtitle: 'Mappe del mondo, pin interattivi e territori esplorabili',
        category: 'ESPLORAZIONE',
        icon: '🗺️',
        lucideIcon: MapIcon,
        route: '/map',
        shortcutKey: '7',
        resonanceStatus: 'Mappatura Territoriale',
        description: 'Esplora le mappe tattiche, le regioni, le città ed i punti di interesse registrati durante i viaggi.',
      },
      {
        id: 8,
        title: 'Calendario di Lore',
        subtitle: 'Calendario di campagna e avanzamento temporale',
        category: 'CAMPAGNA',
        icon: '📅',
        lucideIcon: Calendar,
        route: '/calendar',
        shortcutKey: '8',
        resonanceStatus: 'Tempo Inserito',
        description: 'Tieni traccia dei giorni trascorsi nel mondo di gioco, festività, fasi lunari e scadenze narrative.',
      },
      {
        id: 9,
        title: 'Profilo Personaggio',
        subtitle: 'Scheda eroe, background, tratti e albero relazioni',
        category: 'SCHEDA EROE',
        icon: '👑',
        lucideIcon: Crown,
        route: '/character',
        shortcutKey: '9',
        resonanceStatus: 'Anima Eroica Pronta',
        description: 'Ispeziona e modifica il tuo personaggio, il background, le virtù, l\'albero genealogico ed i legami.',
      },
      {
        id: 10,
        title: 'Cerca Globale (⌘K)',
        subtitle: 'Ricerca istantanea tra tutti i documenti della campagna',
        category: 'STRUMENTI',
        icon: '🔍',
        lucideIcon: Search,
        route: '/search',
        shortcutKey: '0',
        resonanceStatus: 'Indicizzazione Attiva',
        description: 'Trova istantaneamente qualsiasi nome, luogo, incantesimo, nota o evento menzionato nelle cronache.',
      },
      {
        id: 11,
        title: 'Notifiche & Avvisi',
        subtitle: 'Richieste del Master, votazioni attive e quesiti',
        category: 'SISTEMA',
        icon: '🔔',
        lucideIcon: Bell,
        route: '/clarifications',
        shortcutKey: 'U',
        resonanceStatus: unreadNotifs > 0 ? `${unreadNotifs} Avvisi Non Letti` : 'Nessuna Pendenza',
        description: 'Rispondi alle notifiche, chiarimenti di regole e quesiti inviati dal Master o dal party.',
        badgeCount: unreadNotifs > 0 ? unreadNotifs : undefined,
      },
      {
        id: 12,
        title: 'Tema & Tavolozza',
        subtitle: 'Personalizzazione visiva e tavolozza di classe',
        category: 'PERSONALIZZAZIONE',
        icon: '🎨',
        lucideIcon: Palette,
        actionType: 'modal',
        modalEvent: 'chronicle_open_theme_modal',
        shortcutKey: 'T',
        resonanceStatus: `Stile: ${currentTheme.name}`,
        description: 'Scegli la veste grafica della tua classe (Paladino, Mago, Bardo, Barbaro, Chierico) e personalizza la palette.',
      },
      {
        id: 13,
        title: 'Impostazioni',
        subtitle: 'Configurazioni di sistema, AI e preferenze dell\'app',
        category: 'SISTEMA',
        icon: '⚙️',
        lucideIcon: SettingsIcon,
        route: '/settings',
        shortcutKey: 'S',
        resonanceStatus: 'Parametri Nominali',
        description: 'Configura i modelli AI dell\'Oracolo, le opzioni di sincronizzazione cloud e le preferenze utente.',
      },
      {
        id: 14,
        title: 'Cambia Campagna',
        subtitle: 'Seleziona o passa a un\'altra campagna attiva',
        category: 'TAVOLO',
        icon: '🔑',
        lucideIcon: Key,
        actionType: 'modal',
        modalEvent: 'chronicle_switch_campaign',
        shortcutKey: 'C',
        resonanceStatus: 'Gate Multiverso',
        description: 'Torna al Portale Gate per accedere ad altre campagne o inserire un nuovo codice di invito.',
      },
      {
        id: 15,
        title: 'Tipografia & Logo',
        subtitle: 'Personalizza stile del titolo e carattere del logo',
        category: 'PERSONALIZZAZIONE',
        icon: '🔤',
        lucideIcon: Sliders,
        actionType: 'modal',
        modalEvent: 'chronicle_open_typography_modal',
        shortcutKey: 'F',
        resonanceStatus: 'Font Leggendario',
        description: 'Modifica il carattere tipografico del titolo della campagna (Cinzel, Medieval, Uncial, Modern) ed effetti visivi.',
      },
      {
        id: 16,
        title: 'Guida & Tutorial',
        subtitle: 'Manuale utente, scorciatoie e guida rapida',
        category: 'SISTEMA',
        icon: '❓',
        lucideIcon: HelpCircle,
        route: '/tutorial',
        shortcutKey: 'H',
        resonanceStatus: 'Grimorio d\'Istruzione',
        description: 'Consulta il manuale della piattaforma, scopri le scorciatoie da tastiera e le funzionalità avanzate.',
      },
      {
        id: 17,
        title: 'Invita Party',
        subtitle: 'Codice invito, QR code e gestione giocatori del party',
        category: 'TAVOLO',
        icon: '👥',
        lucideIcon: Users,
        actionType: 'modal',
        modalEvent: 'chronicle_open_invite_modal',
        shortcutKey: 'I',
        resonanceStatus: 'Party Invocato',
        description: 'Genera il codice di invito o il QR Code per permettere a nuovi giocatori di unirsi al tavolo di gioco.',
      },
      {
        id: 18,
        title: 'Installa Applicazione',
        subtitle: 'Installazione come PWA su Windows, Android o iOS',
        category: 'SISTEMA',
        icon: '📲',
        lucideIcon: Download,
        actionType: 'modal',
        modalEvent: 'chronicle_open_install_modal',
        shortcutKey: 'P',
        resonanceStatus: 'PWA Pronta',
        description: 'Installa Chronicle direttamente sul tuo dispositivo per un\'esperienza nativa ad alte prestazioni e offline.',
      },
      {
        id: 19,
        title: 'Strumenti Master',
        subtitle: 'Pannello oracolo arcanum ed estrazione AI per il DM',
        category: 'STRUMENTI',
        icon: '🛡️',
        lucideIcon: Shield,
        route: '/oracle',
        shortcutKey: 'M',
        resonanceStatus: player?.isDm ? 'Potere Master Attivo' : 'Accesso Custode',
        description: 'Strumenti avanzati di generazione AI per creare PNG istantanei, spunti di trama e consultare l\'Oracolo.',
      },
      {
        id: 20,
        title: 'Tiradado della Giornata',
        subtitle: 'Tira il d20 della sorte per il responso quotidiano del destino',
        category: 'TAVOLO',
        icon: '🎲',
        lucideIcon: Dices,
        actionType: 'meme_roll',
        shortcutKey: 'R',
        resonanceStatus: 'Lancio Meme della Sorte',
        description: 'Esegui il tiro del d20 della giornata! Un responso ironico o epico senza spostarti dalla vista.',
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
        title = '✨ NAT 20! SUCCESSO CRITICO!';
        message = 'Gli Dei del Regno applaudono la tua impresa! Ricevi la benedizione dell\'Oracolo e la gloria del tavolo!';
      } else if (val === 1) {
        type = 'crit_fail';
        title = '💀 NAT 1! FALLIMENTO CRITICO!';
        message = 'La tua spada scivola e il bardo inciampa sulla sua liuto! Attento al risvolto del destino...';
      } else if (val >= 15) {
        type = 'success';
        title = `🛡️ NAT ${val}! Tiro Eccellente!`;
        message = 'Il destino ti sorride. La fortuna guida le tue scelte per la sessione di oggi!';
      } else if (val >= 10) {
        type = 'success';
        title = `📜 NAT ${val}! Prova Superata.`;
        message = 'Un esito equilibrato. Il cammino prosegue senza troppi intoppi.';
      } else {
        type = 'fail';
        title = `⚔️ NAT ${val}! Prova Ardua...`;
        message = 'La sorte tentenna. Prepara gli elisi e mantieni la guardia alta!';
      }

      setMemeRollResult({ value: val, title, message, type });
      playClickSound();
    }, 800);
  }, [playClickSound]);

  // Execute Action for Face
  const handleExecuteFace = useCallback(
    (faceConfig: D20FaceConfig) => {
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
    [navigate, triggerMemeRoll]
  );

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
    snapToFaceUpright(activeFaceIndex);
  }, [activeFaceIndex, snapToFaceUpright]);

  // Generate Canvas Texture for Face i with theme colors
  const createThemeFaceTexture = useCallback(
    (faceCfg: D20FaceConfig, theme: ClassTheme) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.CanvasTexture(canvas);

      const mainHex = theme.accentColor || '#f59e0b';
      const bgSurface = theme.colors.surface0 || '#0b0d11';
      const bgSurface1 = theme.colors.surface1 || '#141820';

      // Background Radial Gradient
      const grad = ctx.createRadialGradient(256, 256, 15, 256, 256, 260);
      grad.addColorStop(0, bgSurface1);
      grad.addColorStop(0.7, bgSurface);
      grad.addColorStop(1, '#050608');
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Number #1..#20
      ctx.shadowColor = mainHex;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 128px "Cinzel", "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${faceCfg.id}`, 256, 215);

      // Emoji / Icon
      ctx.shadowBlur = 10;
      ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(faceCfg.icon, 256, 310);

      // Title (Centered, uppercase, crisp)
      ctx.shadowBlur = 6;
      ctx.fillStyle = mainHex;
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      const displayTitle = faceCfg.title.length > 16 ? faceCfg.title.substring(0, 14) + '..' : faceCfg.title;
      ctx.fillText(displayTitle.toUpperCase(), 256, 365);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    },
    []
  );

  // Initialize Three.js 3D Canvas
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const themeLightColor = new THREE.Color(currentTheme.accentColor || '#f59e0b');
    const spotlight = new THREE.DirectionalLight(themeLightColor, 2.8);
    spotlight.position.set(5, 6, 6);
    scene.add(spotlight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2.0, 20);
    rimLight.position.set(-6, -4, 4);
    scene.add(rimLight);

    const frontLight = new THREE.PointLight(0xffffff, 1.8, 15);
    frontLight.position.set(0, 0, 8);
    scene.add(frontLight);

    // 3. Icosahedron Base Geometry with Vertex-UV sorting for 100% Upright Text
    const rawGeo = new THREE.IcosahedronGeometry(2.35, 0).toNonIndexed();
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

      let refUp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(faceNorm.y) > 0.85) {
        refUp.set(0, 0, -1);
      }
      const faceUp = refUp.clone().sub(faceNorm.clone().multiplyScalar(refUp.dot(faceNorm))).normalize();
      faceUps.push(faceUp);

      const verts = [p0, p1, p2].map((v) => ({ pos: v, dot: v.dot(faceUp) }));
      verts.sort((a, b) => b.dot - a.dot);

      const vTop = verts[0].pos;
      const vBL = verts[1].pos;
      const vBR = verts[2].pos;

      sortedPos[i * 9 + 0] = vTop.x;
      sortedPos[i * 9 + 1] = vTop.y;
      sortedPos[i * 9 + 2] = vTop.z;

      sortedPos[i * 9 + 3] = vBL.x;
      sortedPos[i * 9 + 4] = vBL.y;
      sortedPos[i * 9 + 5] = vBL.z;

      sortedPos[i * 9 + 6] = vBR.x;
      sortedPos[i * 9 + 7] = vBR.y;
      sortedPos[i * 9 + 8] = vBR.z;

      sortedUvs[i * 6 + 0] = 0.5;
      sortedUvs[i * 6 + 1] = 0.96;

      sortedUvs[i * 6 + 2] = 0.04;
      sortedUvs[i * 6 + 3] = 0.08;

      sortedUvs[i * 6 + 4] = 0.96;
      sortedUvs[i * 6 + 5] = 0.08;
    }

    baseGeo.setAttribute('position', new THREE.BufferAttribute(sortedPos, 3));
    baseGeo.setAttribute('uv', new THREE.BufferAttribute(sortedUvs, 2));
    baseGeo.computeVertexNormals();

    // 4. Generate Materials with Theme Colors
    const materials: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 20; i++) {
      const faceCfg = faces[i] || faces[0];
      const texture = createThemeFaceTexture(faceCfg, currentTheme);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.2,
        metalness: 0.75,
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
      opacity: 0.9,
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
      rotVelY: 0, // NO AUTOMATIC ROTATION!
      targetQuaternion: null as THREE.Quaternion | null,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
    };
    threeStateRef.current = state;

    snapToFaceUpright(0);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const domElem = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      state.isDragging = true;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      state.targetQuaternion = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.lastMouseX;
      const dy = e.clientY - state.lastMouseY;

      state.rotVelY += dx * 0.005;
      state.rotVelX += dy * 0.005;

      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!state.isDragging) return;
      state.isDragging = false;

      const rect = domElem.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.set(x, y);

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(diceMesh);

      if (intersects.length > 0 && intersects[0].face) {
        const groupIndex = intersects[0].face.materialIndex;
        const selectedIdx = groupIndex !== undefined ? groupIndex : Math.floor(intersects[0].faceIndex! / 2);

        if (selectedIdx >= 0 && selectedIdx < 20) {
          setActiveFaceIndex(selectedIdx);
          playClickSound();
        }
      }
    };

    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop (NO AUTO ROTATION!)
    let animId: number;

    const animate = () => {
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
        let closestIdx = 0;

        for (let i = 0; i < 20; i++) {
          const transformedNorm = faceNormals[i].clone().applyMatrix4(currentMatrix);
          const dot = transformedNorm.dot(new THREE.Vector3(0, 0, 1));
          if (dot > maxDot) {
            maxDot = dot;
            closestIdx = i;
          }
        }

        if (closestIdx !== activeFaceIndex && state.isDragging) {
          setActiveFaceIndex(closestIdx);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      baseGeo.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    };
  }, [currentTheme, createThemeFaceTexture, playClickSound, snapToFaceUpright]);

  return (
    <div
      className={`min-h-screen bg-[#07080d] text-content-1 font-body select-none relative overflow-hidden flex flex-col justify-between ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-screen'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, ${currentTheme.colors.primaryMuted || 'rgba(245, 158, 11, 0.12)'} 0%, rgba(7, 8, 13, 0.98) 75%)`,
      }}
    >
      {/* ATMOSPHERIC BACKGROUND GLOW */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full blur-[150px] opacity-60 transition-colors duration-500"
          style={{ backgroundColor: currentTheme.accentColor || '#f59e0b' }}
        />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-20 px-6 py-3 border-b border-surface-2/80 bg-surface-1/80 backdrop-blur-md flex items-center justify-between gap-4">
        {/* Left: Campaign Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary shrink-0 shadow-xs border"
            style={{ backgroundColor: `${currentTheme.accentColor}20`, borderColor: `${currentTheme.accentColor}50` }}
          >
            <Sparkle size={16} />
          </div>
          <div className="min-w-0">
            <span
              className={`text-base font-bold select-none truncate block tracking-wider ${titleClasses.fullClass}`}
              style={titleClasses.style}
            >
              {campaignMeta?.name || 'NEW DIVINE ORDER'}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-content-3 block">
              CAMPAGNA {player?.isDm ? 'DM' : 'GIOCO'} • MENU TAVOLO PRINCIPALE D20
            </span>
          </div>
        </div>

        {/* Center: Lore Date Pill */}
        {calendar && (
          <button
            type="button"
            onClick={() => setActiveFaceIndex(7)} // Calendar #8
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-2/80 hover:bg-surface-3 border border-surface-3 text-xs font-semibold text-content-1 transition-all cursor-pointer shadow-xs group"
            title="Data di Lore Corrente • Clicca per selezionare il Calendario"
          >
            <span className="text-[10px] text-content-3 font-mono uppercase tracking-widest group-hover:text-primary">
              • DATA DI LORE •
            </span>
            <span
              className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border"
              style={{ backgroundColor: `${currentTheme.accentColor}20`, color: currentTheme.accentColor, borderColor: `${currentTheme.accentColor}40` }}
            >
              {calendar.currentDay} {calendar.months[calendar.currentMonthIndex]?.name} {calendar.currentYear}{' '}
              {calendar.yearSuffix}
            </span>
          </button>
        )}

        {/* Right: Character Profile Badge & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/character')}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-1/90 hover:bg-surface-2 border border-surface-3 transition-all cursor-pointer group"
          >
            <div
              className="w-7 h-7 rounded-lg bg-surface-2 border overflow-hidden flex items-center justify-center shrink-0"
              style={{ borderColor: currentTheme.accentColor }}
            >
              {CampaignManager.cleanAvatarString(player?.avatarUrl) ? (
                <img
                  src={CampaignManager.cleanAvatarString(player?.avatarUrl)}
                  alt={player?.characterName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-heading font-semibold text-xs text-primary">
                  {player?.characterName?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-xs font-semibold text-content-1 truncate flex items-center gap-1 group-hover:text-primary transition-colors">
                {player?.characterName}
                {player?.isDm && <Crown size={12} className="text-primary" />}
              </span>
              <span className="text-[10px] text-content-3 block">
                {player?.isDm ? 'Dungeon Master' : 'Giocatore'} • Tema {currentTheme.name}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((p) => !p)}
            className="p-2 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
            title={soundEnabled ? 'Disattiva Audio' : 'Attiva Audio'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((p) => !p)}
            className="p-2 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Esci da Schermo Intero' : 'Schermo Intero'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* SUB-HEADER INSTRUCTION BANNER */}
      <div className="relative z-20 py-2 px-4 bg-surface-1/50 border-b border-surface-2 text-center">
        <span
          className="text-[11px] font-mono uppercase tracking-[0.2em] font-medium inline-flex items-center gap-2"
          style={{ color: currentTheme.accentColor }}
        >
          <span className="w-2 h-2 rounded-full animate-ping inline-block" style={{ backgroundColor: currentTheme.accentColor }} />
          • TRASCINA CON IL MOUSE PER RUOTARE IL DADO // CLICCA UNA FACCIA PER ISPEZIONARE
        </span>
      </div>

      {/* FULL VIEWPORT: ABSOLUTE CENTER 3D CANVAS + FLOATING LEFT INSPECTION CARD */}
      <div className="relative flex-1 z-10 w-full h-full overflow-hidden">
        {/* TRUE CENTERED 3D CANVAS */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10" />

        {/* FLOATING LEFT INSPECTION CARD */}
        <div className="absolute top-6 left-6 lg:left-10 z-30 w-[340px] sm:w-[380px] lg:w-[400px] pointer-events-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFace.id}
              initial={{ opacity: 0, x: -25, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 25, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#090b10]/92 border rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden group"
              style={{ borderColor: `${currentTheme.accentColor}50`, boxShadow: `0 0 50px ${currentTheme.accentColor}15` }}
            >
              <div
                className="absolute top-0 inset-x-0 h-1"
                style={{ background: `linear-gradient(to right, transparent, ${currentTheme.accentColor}, transparent)` }}
              />

              {/* Meta Header */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: currentTheme.accentColor }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.accentColor }} />
                  {activeFace.category}
                </span>

                <span
                  className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold border"
                  style={{ backgroundColor: `${currentTheme.accentColor}18`, color: currentTheme.accentColor, borderColor: `${currentTheme.accentColor}40` }}
                >
                  FACCIA D20 #{activeFace.id}
                </span>
              </div>

              {/* Title & Icon */}
              <div className="flex items-start gap-3.5 mb-3">
                <div
                  className="w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 shadow-inner"
                  style={{ backgroundColor: `${currentTheme.accentColor}18`, borderColor: `${currentTheme.accentColor}40` }}
                >
                  {activeFace.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold font-heading text-content-1 tracking-tight">
                    {activeFace.title}
                  </h2>
                  <p className="text-xs text-content-2 mt-0.5 leading-snug">
                    {activeFace.subtitle}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-content-2 leading-relaxed mb-5 bg-surface-1/50 p-3 rounded-xl border border-surface-2">
                {activeFace.description}
              </p>

              {/* Meta Box */}
              <div className="bg-surface-0/90 border border-surface-2 rounded-xl p-3 mb-6 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-content-2">
                  <span className="text-content-3">Stato Faccia:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {activeFace.resonanceStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-content-2">
                  <span className="text-content-3">Tasto Scorciatoia:</span>
                  <kbd
                    className="px-2 py-0.5 rounded border font-bold text-[11px]"
                    style={{ backgroundColor: `${currentTheme.accentColor}20`, color: currentTheme.accentColor, borderColor: `${currentTheme.accentColor}40` }}
                  >
                    [{activeFace.shortcutKey}]
                  </kbd>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleExecuteFace(activeFace)}
                className="w-full py-3.5 px-5 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all duration-200 shadow-lg flex items-center justify-center gap-2.5 cursor-pointer group/btn"
                style={{
                  backgroundColor: currentTheme.accentColor,
                  color: currentTheme.isLight ? '#ffffff' : '#000000',
                }}
              >
                <span>ENTRA NELLA VISTA</span>
                <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* BOTTOM QUICK-FACE SELECTOR STRIP */}
      <footer className="relative z-20 px-4 py-3 border-t border-surface-2/80 bg-surface-1/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-content-3 shrink-0 mr-2 flex items-center gap-1">
            <Hash size={12} /> FACCE D20:
          </span>

          {faces.map((f, idx) => {
            const isActive = idx === activeFaceIndex;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFaceIndex(idx);
                  playClickSound();
                  if (f.actionType === 'meme_roll') {
                    triggerMemeRoll();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'shadow-md scale-105 border'
                    : 'bg-surface-0 hover:bg-surface-2 text-content-2 border border-surface-2'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: currentTheme.accentColor,
                        color: currentTheme.isLight ? '#ffffff' : '#000000',
                        borderColor: currentTheme.accentColor,
                      }
                    : {}
                }
                title={`Faccia #${f.id}: ${f.title}`}
              >
                <span>#{f.id}</span>
                <span className="text-xs">{f.icon}</span>
                <span className="hidden sm:inline font-sans text-[11px] font-medium max-w-[80px] truncate">
                  {f.title}
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      {/* MEME ROLL MODAL TOAST */}
      <AnimatePresence>
        {memeRollResult && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              className="bg-surface-1 border border-surface-3 rounded-2xl p-6 max-w-md w-full text-center relative shadow-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setMemeRollResult(null)}
                className="absolute top-4 right-4 text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-2"
              >
                <X size={18} />
              </button>

              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl shadow-lg border"
                style={{
                  backgroundColor: `${currentTheme.accentColor}20`,
                  borderColor: currentTheme.accentColor,
                }}
              >
                {memeRollResult.type === 'crit_success'
                  ? '✨'
                  : memeRollResult.type === 'crit_fail'
                  ? '💀'
                  : '🎲'}
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
                className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider cursor-pointer"
                style={{
                  backgroundColor: currentTheme.accentColor,
                  color: currentTheme.isLight ? '#ffffff' : '#000000',
                }}
              >
                CHIUDI RESPONSO
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
