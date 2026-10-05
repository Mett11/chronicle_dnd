import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  Compass,
  MessageSquare,
  Sparkles,
  Brain,
  Zap,
  ShieldCheck,
} from 'lucide-react';

interface ClassFolio {
  id: string;
  name: string;
  title: string;
  latinEpigraph: string;
  fileName: string;
  filePath: string;
  loreQuote: string;
  chronicleFolio: {
    heading: string;
    text: string;
  }[];
  specifications: string;
}

const ALL_CLASSES_FOLIO: ClassFolio[] = [
  {
    id: 'wizard',
    name: 'Mago',
    title: 'Custode della Trama & delle Formule Arcane',
    latinEpigraph: 'Verba Manent, Incantamenta Vivunt',
    fileName: 'class-wizard.webp',
    filePath: '/blueprints/class-wizard.webp',
    loreQuote: 'Non vi è incantesimo che non sia prima un pensiero inciso sulla pergamena. Il diario del mago è la sua sola immortalità.',
    chronicleFolio: [
      {
        heading: 'Trascrizione Fedele del Grimorio',
        text: 'Registra le formule apprese nei tomi sepolti, le componenti materiali e i rituali direttamente all’interno dei capitoli di sessione.',
      },
      {
        heading: 'Compendio dei Manufatti & Pergamene',
        text: 'Associa le pergamene ritrovate e le reliquie esaminate alle schede enciclopediche del reame con note sul loro potere latente.',
      },
    ],
    specifications: 'Scuola di Trasmutazione & Evocazione · Studio dei Cerchi a 8 Nodi',
  },
  {
    id: 'warlock',
    name: 'Warlock',
    title: 'Vincolato ai Patti delle Stelle Lontane',
    latinEpigraph: 'Pactum Tenebrarum Non Obliviscitur',
    fileName: 'class-warlock.webp',
    filePath: '/blueprints/class-warlock.webp',
    loreQuote: 'Il sapere proibito non si apprende: si riceve in dono pagando con l’ombra. Ogni clausola deve rimanere celata al party.',
    chronicleFolio: [
      {
        heading: 'Visibilità Riservata del Master',
        text: 'Sfrutta le annotazioni segrete per dialogare con il tuo patrono all’insaputa degli altri avventurieri seduti al tuo tavolo.',
      },
      {
        heading: 'Cronistoria della Corruzione',
        text: 'Traccia capitolo dopo capitolo le visioni notturne, i debiti d’anima e le promesse sussurrate tra le pagine della campagna.',
      },
    ],
    specifications: 'Vincolo del Patto Extra-Planare · Invocazioni dell’Antico',
  },
  {
    id: 'cleric',
    name: 'Chierico',
    title: 'Canale della Luce & Custode dei Giuramenti',
    latinEpigraph: 'In Lumine Eorum Lux Nostra',
    fileName: 'class-cleric.webp',
    filePath: '/blueprints/class-cleric.webp',
    loreQuote: 'Gli dei parlano attraverso gli esiti del dado e il sacrificio dei giusti. La cronaca è la liturgia vivente delle loro gesta.',
    chronicleFolio: [
      {
        heading: 'Pantheon & Santuari Consacrati',
        text: 'Piazza indicatori devozionali sulle mappe della campagna: templi benedetti, altari dissacrati e luoghi sacri di pellegrinaggio.',
      },
      {
        heading: 'Registro dei Miracoli & Fardelli',
        text: 'Cataloga le suppliche accolte, le resurrezioni officiate e gli anatemi divini nel libro delle relazioni tra mortali e divinità.',
      },
    ],
    specifications: 'Liturgia delle Sfere Celesti · Consacrazione dei Reliquiari',
  },
  {
    id: 'druid',
    name: 'Druido',
    title: 'Sentinella dei Circoli & delle Forme Antiche',
    latinEpigraph: 'Radices Terrae Sanguinem Clamant',
    fileName: 'class-druid.webp',
    filePath: '/blueprints/class-druid.webp',
    loreQuote: 'La terra ricorda ogni passo calpestato, ogni albero sradicato e ogni bestia che ha prestato la propria carne alla furia del circolo.',
    chronicleFolio: [
      {
        heading: 'Bestiario delle Forme Selvatiche',
        text: 'Cataloga le creature studiate durante i viaggi, le loro abitudini e le mutazioni anatomiche adottabili in combattimento.',
      },
      {
        heading: 'Cartografia Silvana & Cicli Lunari',
        text: 'Registra i passaggi nascosti tra le radici, le radure dei monoliti e la convergenza delle maree telluriche.',
      },
    ],
    specifications: 'Morfologia Animale · Calendario dei Solstizi & Circolo Primordiale',
  },
  {
    id: 'rogue',
    name: 'Ladro',
    title: 'Ombra tra i Pilastri & Maestro dei Punti Ciechi',
    latinEpigraph: 'Silentium Est Telum Letale',
    fileName: 'class-rogue.webp',
    filePath: '/blueprints/class-rogue.webp',
    loreQuote: 'Un impero può crollare per una serratura scassinata al momento giusto. Chi non annota le vie di fuga è già sepolto vivo.',
    chronicleFolio: [
      {
        heading: 'Piante dei Sotterranei & Trappole',
        text: 'Disegna e consulta le planimetrie dei palazzi, i cunicoli di scarico e i punti deboli delle fortificazioni prima di fare irruzione.',
      },
      {
        heading: 'Il Grafo del Sottobosco Criminale',
        text: 'Mantieni i legami con ricettatori fidati, gilde mercenarie e informatori segreti tramite l’albero sociale dei PNG.',
      },
    ],
    specifications: 'Meccanica di Precisione · Cinematica delle Fessure & Anatomia Furtiva',
  },
  {
    id: 'fighter',
    name: 'Guerriero',
    title: 'Baluardo della Schiera & Maestro delle Lame',
    latinEpigraph: 'Ferrum Flectitur, Non Frangitur',
    fileName: 'class-fighter.webp',
    filePath: '/blueprints/class-fighter.webp',
    loreQuote: 'L’acciaio non mente mai: risponde al peso del pugno e alla precisione del cuore. Registra l’onore dei caduti e la gloria delle battaglie vinte.',
    chronicleFolio: [
      {
        heading: 'Memoriale delle Grandi Battaglie',
        text: 'Documenta la caduta dei tiranni, le manovre tattiche decisive e il tributo di sangue versato negli scontri nei tomi storici.',
      },
      {
        heading: 'Forgiatura & Armerie Leggendarie',
        text: 'Traccia le armi uniche, i marchi di fabbrica e le armature forgiate dai maestri nani assegnate ai membri del party.',
      },
    ],
    specifications: 'Scienza degli Impatti · Balistica delle Armi & Geometria della Parata',
  },
  {
    id: 'bard',
    name: 'Bardo',
    title: 'Cantore della Leggenda & Tessitore di Dicerie',
    latinEpigraph: 'Vox Populi, Vox Fatorum',
    fileName: 'class-bard.webp',
    filePath: '/blueprints/class-bard.webp',
    loreQuote: 'Un eroe muore due volte: la prima per la spada, la seconda quando nessuno canta più le sue imprese nelle taverne del regno.',
    chronicleFolio: [
      {
        heading: 'Ballate di Sessione & Ispirazione Bardica',
        text: 'Componi il racconto epico della serata e assegna i riconoscimenti ai compagni che hanno brillato nelle trattative o nel duello.',
      },
      {
        heading: 'Rete di Dicerie & Segreti di Corte',
        text: 'Raccogli i pettegolezzi dei locandieri, le canzoni profetiche e le debolezze dei potenti nel registro delle fazioni.',
      },
    ],
    specifications: 'Armonia delle Sfere · Acustica delle Parole di Potere',
  },
  {
    id: 'paladin',
    name: 'Paladino',
    title: 'Giuramento Vivente & Scudo dei Giusti',
    latinEpigraph: 'Iustitia Nemini Neganda Est',
    fileName: 'class-paladin.webp',
    filePath: '/blueprints/class-paladin.webp',
    loreQuote: 'La mia parola è la mia armatura, il mio giuramento è la mia spada. Non vi è oscurità che possa infrangere la volontà incisa.',
    chronicleFolio: [
      {
        heading: 'I Giuramenti Sacri & Codici d’Onore',
        text: 'Definisci i dogmi del tuo ordine e tieni traccia delle sfide morali che mettono alla prova la fedeltà del tuo cavaliere.',
      },
      {
        heading: 'Crociate & Fortezze Liberate',
        text: 'Segna le terre purificate dalla piaga, i bastioni consacrati e gli ordini cavallereschi alleati del gruppo.',
      },
    ],
    specifications: 'Geometria dell’Aura di Protezione · Catalizzazione Punizione Divina',
  },
  {
    id: 'barbarian',
    name: 'Barbaro',
    title: 'Furia degli Antenati & Tempesta Primordiale',
    latinEpigraph: 'Ira Furor Brevis Est',
    fileName: 'class-barbarian.webp',
    filePath: '/blueprints/class-barbarian.webp',
    loreQuote: 'Le vostre pergamene ingiallite non fermeranno un’ascia bipenne. Ma se volete scrivere la mia furia, usate l’inchiostro rosso.',
    chronicleFolio: [
      {
        heading: 'I Totem Ancestrali & Leggende Tribali',
        text: 'Documenta i miti della tua gente selvaggia, le visioni di sangue e il tributo di bestie leggendarie abbattute nelle terre desolate.',
      },
      {
        heading: 'Cronache della Furia Implacabile',
        text: 'Segna le prove di forza sovrumana, le ferite mortali ignorate e i duelli all’ultimo sangue che hanno terrorizzato i nemici.',
      },
    ],
    specifications: 'Resistenza dei Tessuti · Scarica Adrenalinica Primordiale',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'Tracciatore delle Frontiere & Custode delle Piste',
    latinEpigraph: 'Vestigia Nunquam Fallunt',
    fileName: 'class-ranger.webp',
    filePath: '/blueprints/class-ranger.webp',
    loreQuote: 'Ogni ramo spezzato è un presagio, ogni impronta nella fanghiglia è una confessione. Nessuna preda svanisce per sempre.',
    chronicleFolio: [
      {
        heading: 'Atlante dei Nemici Prescelti',
        text: 'Raccogli anatomie, debolezze elementali e tattiche di caccia contro draghi, aberrazioni e mostruosità che infestano le terre.',
      },
      {
        heading: 'Mappe dei Sentieri Segreti',
        text: 'Traccia piste montane impervie, guadi sicuri e rifugi nascosti tra le foreste inaccessibili alle pattuglie nemiche.',
      },
    ],
    specifications: 'Balistica a Lungo Raggio · Tracciamento Territoriale',
  },
  {
    id: 'monk',
    name: 'Monaco',
    title: 'Maestro del Ki & Equilibrio delle Forze',
    latinEpigraph: 'Mens Sana In Corpore Forti',
    fileName: 'class-monk.webp',
    filePath: '/blueprints/class-monk.webp',
    loreQuote: 'Il corpo è il tempio, il Ki è la corrente, la mente è la quiete prima dell’impatto. Non cerchiamo gloria, ma perfezione.',
    chronicleFolio: [
      {
        heading: 'Insegnamenti del Monastero',
        text: 'Trascrivi le massime dei maestri, i koan filosofici e le discipline spirituali che guidano il tuo cammino d’illuminazione.',
      },
      {
        heading: 'Mappa dei Punti di Pressione Vitale',
        text: 'Conserva lo studio delle energie vitali e le tecniche per disarmare o paralizzare gli avversari senza versare sangue.',
      },
    ],
    specifications: 'Canalizzazione del Ki · Meridiani Energetici & Posture Tattiche',
  },
  {
    id: 'sorcerer',
    name: 'Stregone',
    title: 'Origine del Sangue & Trama Indomita',
    latinEpigraph: 'Sanguis Magiam Progenerat',
    fileName: 'class-sorcerer.webp',
    filePath: '/blueprints/class-sorcerer.webp',
    loreQuote: 'Non ho mai aperto un libro di magia in vita mia. Il potere non l’ho studiato: scorre nelle mie vene come fuoco vivo.',
    chronicleFolio: [
      {
        heading: 'Lignaggio Draconico o del Caos',
        text: 'Esplora le origini della tua magia innata nell’albero genealogico, scoprendo le entità leggendarie che hanno segnato il tuo sangue.',
      },
      {
        heading: 'Metamagia & Fluttuazioni della Magia Selvaggia',
        text: 'Registra le anomalie dimensionali e le manipolazioni della trama arcana scatenate durante i momenti di massima tensione.',
      },
    ],
    specifications: 'Manipolazione Metamagica · Densità Magica nel Flusso Ematico',
  },
  {
    id: 'artificer',
    name: 'Artefice',
    title: 'Ingegnere Arcano & Maestro delle Infusioni',
    latinEpigraph: 'Scientia Et Magia Coniunguntur',
    fileName: 'class-artificer.webp',
    filePath: '/blueprints/class-artificer.webp',
    loreQuote: 'Dove il mago vede un mistero insolubile, io vedo un problema di cablaggio e una formula alchemica da perfezionare.',
    chronicleFolio: [
      {
        heading: 'Schemi Progettuali & Infusioni',
        text: 'Documenta i progetti delle tue invenzioni, pistole a polvere arcana, servitori meccanici e armature potenziate con cristalli.',
      },
      {
        heading: 'Laboratorio & Ricerca Alchemica',
        text: 'Traccia i reagenti rari, i metalli celestiali e gli estratti mostruosi necessari per forgiare equipaggiamento prodigioso.',
      },
    ],
    specifications: 'Circuiti di Canalizzazione Rune · Dinamica delle Leghe Alchemiche',
  },
];

export function SanityLogin() {
  const { loginWithGoogle } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('wizard');
  const [imageError, setImageError] = useState<boolean>(false);

  const selectedClass =
    ALL_CLASSES_FOLIO.find((c) => c.id === selectedClassId) || ALL_CLASSES_FOLIO[0];

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && res.error) {
        setLoginError(res.error);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const scrollToRegister = () => {
    const el = document.getElementById('frontespizio-registro');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#070709] text-[#e8e1d5] selection:bg-[#c49a45]/30 selection:text-[#f8ecd0]"
      style={{ fontFamily: "'Newsreader', 'Lora', Georgia, serif" }}
    >
      {/* Texture filigrana pergamena scura d'inchiostro a schermo intero */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#c49a45_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Bagliori d'atmosfera ambrata */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] bg-[#966d28]/12 rounded-full blur-[180px]" />
        <div className="absolute top-[35%] -left-32 w-[700px] h-[700px] bg-[#3a1d48]/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-10 -right-32 w-[800px] h-[800px] bg-[#1a2f48]/10 rounded-full blur-[220px]" />
      </div>

      {/* ================= CORNICE SUPERIORE DI PAGINA (WIDE) ================= */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 border-b border-[#2a241b] bg-[#070709]/85 backdrop-blur-md"
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span
              className="text-2xl sm:text-3xl text-[#d4af37] font-normal tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
            >
              Chronicle
            </span>
          </div>

          <nav className="flex items-center gap-6 sm:gap-10 text-xs tracking-widest uppercase text-[#a99982]">
            <a
              href="#tavole-classi"
              className="hover:text-[#d4af37] transition-colors"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Le Classi
            </a>
            <a
              href="#png-intelligenti"
              className="hover:text-[#d4af37] transition-colors text-[#d4af37] flex items-center gap-1.5"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              <Sparkles size={13} className="text-[#d4af37]" />
              <span>PNG Viventi & AI</span>
            </a>
            <a
              href="#capitoli-compendio"
              className="hidden sm:inline hover:text-[#d4af37] transition-colors"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              I Quattro Canti
            </a>
            <button
              type="button"
              onClick={scrollToRegister}
              className="text-[#d4af37] hover:text-[#f3dfa2] transition-colors cursor-pointer border border-[#a38043]/40 px-3.5 py-1.5 hover:border-[#d4af37]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Apponi Sigillo &rarr;
            </button>
          </nav>
        </div>
      </motion.header>

      {/* ================= IL FRONTESPIZIO MAESTOSO (HERO WIDE SPREAD) ================= */}
      <motion.section
        id="frontespizio-registro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-[1440px] mx-auto px-6 sm:px-12 pt-16 sm:pt-24 pb-20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Colonna Sinistra: Invocazione & Visione Narrativa */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6 text-left"
          >
            <div className="flex items-center gap-3">
              <span
                className="text-xs tracking-[0.3em] uppercase text-[#a38043] font-medium"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                ✦ &nbsp; Liber Primus &nbsp; · &nbsp; Registrum Aventurarum
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#a38043]/40 to-transparent" />
            </div>

            <h1
              className="text-4xl sm:text-6xl lg:text-7xl text-[#f3ebd9] tracking-[0.06em] font-normal leading-[1.12]"
              style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
            >
              Ogni avventura merita la propria leggenda.
            </h1>

            <p className="text-lg sm:text-xl text-[#b8a994] font-light leading-relaxed italic max-w-2xl">
              Dimentica fogli strappati, note discordanti e recap improvvisati.
              Chronicle è il grande tomo comune dove il Dungeon Master e la compagnia
              incidono capitoli, cartografano reami sconosciuti, danno voce a PNG parlanti tramite intelligenza narrativa e tracciano genealogie d’eroi.
            </p>

            {/* Quick Pillars Overview */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#a89983]">
              <div className="flex items-start gap-2.5">
                <span className="text-[#d4af37] text-sm leading-none mt-0.5">✦</span>
                <span><strong>Diario & Sessioni:</strong> cronache organizzate in atti con calendari di lore.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#d4af37] text-sm leading-none mt-0.5">✦</span>
                <span><strong>PNG Viventi con AI:</strong> dialoga con personaggi dotati di memoria propria.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#d4af37] text-sm leading-none mt-0.5">✦</span>
                <span><strong>Cartografia con Pin:</strong> terre emerse, dungeon e punti d'interesse.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#d4af37] text-sm leading-none mt-0.5">✦</span>
                <span><strong>Alberi di Sangue:</strong> grafi sociali di alleanze, debiti e fazioni.</span>
              </div>
            </div>
          </motion.div>

          {/* Colonna Destra: Il Sigillo d'Accesso (Registro dei Viaggiatori) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="p-8 sm:p-10 border border-[#3a3020] bg-[#0c0b0f]/95 shadow-2xl relative">
              {/* Fregi agli angoli del registro */}
              <div className="absolute top-2 left-2 text-[#a38043]/50 text-xs select-none">⌜</div>
              <div className="absolute top-2 right-2 text-[#a38043]/50 text-xs select-none">⌝</div>
              <div className="absolute bottom-2 left-2 text-[#a38043]/50 text-xs select-none">⌞</div>
              <div className="absolute bottom-2 right-2 text-[#a38043]/50 text-xs select-none">⌟</div>

              <div className="text-center space-y-2 mb-8">
                <p
                  className="text-xs uppercase tracking-[0.3em] text-[#d4af37] font-medium"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Registro dei Viaggiatori
                </p>
                <h2
                  className="text-xl sm:text-2xl text-[#f3ebd9] tracking-wider font-normal"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Entra nella Campagna
                </h2>
                <p className="text-xs text-[#8c7b64] italic leading-relaxed pt-1">
                  Apponi il tuo nome per accedere alle tue cronache attive o inserire il codice invito del tuo Dungeon Master.
                </p>
              </div>

              {/* Tasto Google Accesso Ufficiale */}
              <button
                id="btn-google-login"
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full py-4 px-6 bg-[#16131a] hover:bg-[#201c26] border border-[#52442e] hover:border-[#d4af37] text-[#f5ede0] text-xs sm:text-sm tracking-[0.15em] uppercase transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#d4af37]" />
                    <span>Verifica Sigillo Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                      <path
                        fill="#d4af37"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#b8932f"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#e6c66e"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#c99732"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Apponi il Sigillo Google</span>
                    <ArrowRight size={14} className="ml-auto text-[#a38043] group-hover:text-[#d4af37] transition-colors" />
                  </>
                )}
              </button>

              {loginError && (
                <div className="mt-4 p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-start gap-2 text-left italic">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p>{loginError}</p>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-[#231d14] flex items-center justify-between text-[11px] text-[#786a55] italic">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-[#a38043]" />
                  <span>Sincronizzazione Cloud Supabase</span>
                </span>
                <span>Nessuna password</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ================= SEZIONE DI SPICCO: PNG VIVENTI & INTELLIGENZA NARRATIVA ================= */}
      <motion.section
        id="png-intelligenti"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 border-t border-[#2a241b] bg-[#09080c] py-20"
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12">
          {/* Intestazione Sezione AI */}
          <div className="max-w-3xl mb-14 text-left">
            <div className="flex items-center gap-2 text-xs tracking-[0.25em] uppercase text-[#d4af37] mb-2 font-medium">
              <Brain size={15} />
              <span style={{ fontFamily: "'Cinzel', Georgia, serif" }}>Il Cuore Vivente di Chronicle</span>
            </div>
            <h2
              className="text-3xl sm:text-5xl text-[#f3ebd9] tracking-[0.05em] font-normal leading-tight"
              style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
            >
              PNG che Ricordano, Parlano e Vivono.
            </h2>
            <p className="text-base sm:text-lg text-[#b8a994] font-light leading-relaxed italic mt-4">
              Non semplici schede biografiche inerti. I Personaggi Non Giocanti creati nel compendio sono dotati di <strong>memoria contestuale, conoscenze specifiche e sentimenti</strong> derivati dalle informazioni che inserisci tu e il tuo Dungeon Master.
            </p>
          </div>

          {/* I Tre Pilastri dell'Intelligenza Narrativa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 text-left">
            {/* Pilastro 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-[#3a3020] pt-6 space-y-3"
            >
              <div className="flex items-center gap-2.5 text-[#d4af37]">
                <MessageSquare size={18} strokeWidth={1.5} />
                <h3
                  className="text-lg text-[#f3ebd9] tracking-wide font-normal"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Dialoga con i Tuoi PNG
                </h3>
              </div>
              <p className="text-sm text-[#a89983] font-light leading-relaxed">
                Interroga direttamente l’oste della taverna, la sacerdotessa del tempio o il nobile corrotto. Tramite l’AI integrata, il PNG risponde in prima persona attingendo esclusivamente a ciò che sa della campagna, alle sue paure e alle sue fedeltà.
              </p>
            </motion.div>

            {/* Pilastro 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-[#3a3020] pt-6 space-y-3"
            >
              <div className="flex items-center gap-2.5 text-[#d4af37]">
                <Zap size={18} strokeWidth={1.5} />
                <h3
                  className="text-lg text-[#f3ebd9] tracking-wide font-normal"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  Estrazione Istantanea delle Note
                </h3>
              </div>
              <p className="text-sm text-[#a89983] font-light leading-relaxed">
                Trascrivi gli appunti confusi presi durante la sessione senza perdere tempo: l’intelligenza analizza il testo grezzo ed estrae automaticamente PNG citati, luoghi svelati, indizi cruciali e promesse, ordinandoli nel compendio.
              </p>
            </motion.div>

            {/* Pilastro 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-[#3a3020] pt-6 space-y-3"
            >
              <div className="flex items-center gap-2.5 text-[#d4af37]">
                <Sparkles size={18} strokeWidth={1.5} />
                <h3
                  className="text-lg text-[#f3ebd9] tracking-wide font-normal"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  L’Oracolo del Dungeon Master
                </h3>
              </div>
              <p className="text-sm text-[#a89983] font-light leading-relaxed">
                Ti trovi in un vicolo cieco durante una trattativa imprevista? Interroga l’Oracolo per ricevere risposte coerenti con l’ambientazione, generare dicerie al volo o formulare enigmi calibrati sul livello del party.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ================= LE CLASSI DELLA CAMPAGNA (TUTTE LE 13 CLASSI D&D) ================= */}
      <motion.section
        id="tavole-classi"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-[1440px] mx-auto px-6 sm:px-12 py-20 border-t border-[#2a241b]"
      >
        <div className="text-center mb-10">
          <p
            className="text-xs tracking-[0.3em] uppercase text-[#a38043] mb-2"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Tavole Panoramiche & Disegni Tecnici
          </p>
          <h2
            className="text-3xl sm:text-5xl text-[#f3ebd9] tracking-[0.06em] font-normal"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
          >
            Le Classi della Campagna
          </h2>
          <p className="text-base text-[#8c7b64] italic mt-2 max-w-xl mx-auto">
            Esplora le 13 classi di Dungeons & Dragons e visualizza la loro tavola tecnica d'incisione.
          </p>
        </div>

        {/* Nastro delle classi impaginato senza ritagli */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-3.5 text-xs sm:text-sm tracking-[0.2em] uppercase pb-6 mb-12 border-b border-[#241f17] px-4 max-w-5xl mx-auto">
          {ALL_CLASSES_FOLIO.map((cls) => {
            const isSelected = cls.id === selectedClassId;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassId(cls.id);
                  setImageError(false);
                }}
                className={`transition-all duration-300 cursor-pointer whitespace-nowrap relative py-2 ${
                  isSelected
                    ? 'text-[#d4af37] font-semibold scale-105'
                    : 'text-[#8c7b64] hover:text-[#c49a45]'
                }`}
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                <span>{cls.name}</span>
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4af37]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tavola a due colonne WIDE: Sinistra Solo Immagine + Scritta sotto, Destra Lore & Compendio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Pagina Sinistra: Solo l'immagine pura e la didascalia sotto (senza wrap/cornice) con transizione fluida */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedClass.id}
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -12 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center"
              >
                {!imageError ? (
                  <img
                    src={selectedClass.filePath}
                    alt={selectedClass.name}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.endsWith('.webp')) {
                        target.src = selectedClass.filePath.replace(/\.webp$/, '.png');
                      } else {
                        setImageError(true);
                      }
                    }}
                    className="w-full max-h-[500px] object-contain drop-shadow-[0_12px_36px_rgba(0,0,0,0.85)] filter contrast-110 select-none"
                  />
                ) : (
                  /* Fallback minimale per tavola in attesa di file */
                  <div className="w-full aspect-[16/9] max-h-[460px] flex flex-col items-center justify-center text-center p-6 text-[#8c7b64]">
                    <div className="w-12 h-12 rounded-full border border-[#52442d]/60 flex items-center justify-center text-[#d4af37]/70 mb-3">
                      <Compass size={24} strokeWidth={1.2} />
                    </div>
                    <p
                      className="text-xs uppercase tracking-[0.25em] text-[#d4af37]"
                      style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                    >
                      {selectedClass.name}
                    </p>
                    <p className="text-xs text-[#8c7b64] italic mt-1 font-mono">
                      public/blueprints/{selectedClass.fileName}
                    </p>
                  </div>
                )}

                {/* Scritta / Didascalia tecnica pulita sotto l'immagine */}
                <div className="w-full mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8c7b64] pt-3 border-t border-[#241f17]/70">
                  <span
                    className="tracking-[0.2em] uppercase text-[#a38043]"
                    style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                  >
                    Tavola Incisa &bull; {selectedClass.latinEpigraph}
                  </span>
                  <span className="italic text-[11px] text-[#6e604d]">
                    {selectedClass.specifications}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagina Destra: Il Testo del Compendio & Approfondimento con transizione fluida */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedClass.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div>
                  <p
                    className="text-xs uppercase tracking-[0.25em] text-[#a38043] mb-1"
                    style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                  >
                    Classe di Gioco &bull; {selectedClass.name}
                  </p>
                  <h3
                    className="text-2xl sm:text-3xl text-[#f3ebd9] font-normal leading-tight"
                    style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
                  >
                    {selectedClass.title}
                  </h3>
                </div>

                {/* Citazione della Classe */}
                <blockquote className="border-l-2 border-[#a38043]/60 pl-4 py-1 italic text-base sm:text-lg text-[#b8a994] leading-relaxed">
                  "{selectedClass.loreQuote}"
                </blockquote>

                {/* Ruolo nel diario di campagna */}
                <div className="space-y-4 pt-2">
                  <p
                    className="text-xs tracking-[0.2em] uppercase text-[#d4af37]"
                    style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                  >
                    ✦ &nbsp; Nel Diario di Campagna Chronicle
                  </p>
                  {selectedClass.chronicleFolio.map((folio, idx) => (
                    <div key={idx} className="space-y-1">
                      <h4
                        className="text-sm text-[#e6ded1] font-semibold tracking-wide"
                        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                      >
                        {folio.heading}
                      </h4>
                      <p className="text-sm text-[#9e8f7a] font-light leading-relaxed">
                        {folio.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 text-[#a38043]/30 text-xs tracking-[0.4em]">
                  ✦ · · · · · · · · · · · · · · · ✦
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* ================= I QUATTRO CANTI DEL COMPENDIO (WIDE) ================= */}
      <motion.section
        id="capitoli-compendio"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-[1440px] mx-auto px-6 sm:px-12 py-24 border-t border-[#2a241b]"
      >
        <div className="text-center mb-16">
          <p
            className="text-xs tracking-[0.3em] uppercase text-[#a38043] mb-2"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            L'Architettura del Tomo
          </p>
          <h2
            className="text-3xl sm:text-5xl text-[#f3ebd9] tracking-[0.06em] font-normal"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
          >
            I Quattro Canti della Cronaca
          </h2>
          <p className="text-base text-[#8c7b64] italic mt-2 max-w-xl mx-auto">
            Come Chronicle preserva ogni sfumatura della narrazione al tavolo.
          </p>
        </div>

        {/* Layout a 4 ampie colonne animate */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
          {/* Canto I */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3 border-l border-[#3a3020] pl-6"
          >
            <span
              className="text-xs uppercase tracking-[0.25em] text-[#a38043] block"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Canto I &bull; La Scrittura
            </span>
            <h3
              className="text-xl text-[#f3ebd9] font-normal tracking-wide"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Diario & Tomi di Sessione
            </h3>
            <p className="text-sm text-[#a89983] font-light leading-relaxed">
              Atti e tomi ordinati con calendari di lore (Forgotten Realms, Greyhawk o personalizzati). Assegna l’oratore ufficiale della serata e ripercorri i dialoghi memorabili prima di lanciare il primo dado.
            </p>
          </motion.div>

          {/* Canto II */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3 border-l border-[#3a3020] pl-6"
          >
            <span
              className="text-xs uppercase tracking-[0.25em] text-[#a38043] block"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Canto II &bull; I Reami
            </span>
            <h3
              className="text-xl text-[#f3ebd9] font-normal tracking-wide"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Cartografia Vivente
            </h3>
            <p className="text-sm text-[#a89983] font-light leading-relaxed">
              Carica mappe del mondo, regionali o piante di sotterranei. Fissa pin per locande, santuari e dungeon.
            </p>
          </motion.div>

          {/* Canto III */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3 border-l border-[#3a3020] pl-6"
          >
            <span
              className="text-xs uppercase tracking-[0.25em] text-[#a38043] block"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Canto III &bull; I Volti
            </span>
            <h3
              className="text-xl text-[#f3ebd9] font-normal tracking-wide"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Dossier PNG & Alberi di Sangue
            </h3>
            <p className="text-sm text-[#a89983] font-light leading-relaxed">
              Traccia ogni PNG incrociato lungo la via. Esplora le parentele nell’albero genealogico e ricostruisci il grafo sociale di favori, debiti e fazioni che muove i fili della politica del reame.
            </p>
          </motion.div>

          {/* Canto IV */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3 border-l border-[#3a3020] pl-6"
          >
            <span
              className="text-xs uppercase tracking-[0.25em] text-[#a38043] block"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Canto IV &bull; La Parola
            </span>
            <h3
              className="text-xl text-[#f3ebd9] font-normal tracking-wide"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Audio Opus & Oracolo Istantaneo
            </h3>
            <p className="text-sm text-[#a89983] font-light leading-relaxed">
              Cattura i discorsi chiave del Dungeon Master con registrazioni compresse ad altissima fedeltà vocale. Interroga l’Oracolo nei momenti d’impasse per trarre ispirazione immediata.
            </p>
          </motion.div>
        </div>

        {/* Chiusura Esortazione Finale */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 pt-12 border-t border-[#241f17] text-center max-w-2xl mx-auto space-y-4"
        >
          <p
            className="text-xs tracking-[0.3em] uppercase text-[#a38043]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            ✦ &nbsp; La Compagnia ti Attende &nbsp; ✦
          </p>
          <p className="text-lg text-[#b8a994] font-light italic">
            "Colui che non annota le cronache è destinato a vederle dissolvere come brina al sorgere del sole."
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={scrollToRegister}
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#16131a] hover:bg-[#201c26] border border-[#a38043] hover:border-[#d4af37] text-[#f5ede0] text-xs tracking-[0.2em] uppercase transition-all duration-300 cursor-pointer shadow-xl active:scale-[0.98]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              <span>Vedi il Registro & Entra</span>
              <ArrowRight size={14} className="text-[#d4af37]" />
            </button>
          </div>
        </motion.div>
      </motion.section>

      {/* ================= COLOPHON & FOOTER ================= */}
      <footer className="relative z-10 border-t border-[#201b13] bg-[#050406] py-10 text-xs text-[#6e604d]">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="text-[#d4af37] text-sm tracking-widest uppercase font-semibold"
              style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif" }}
            >
              Chronicle
            </span>
            <span>&bull;</span>
            <span className="italic">Finito di imprimere per i tavoli di Dungeons & Dragons e dei Grandi Giochi di Ruolo.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
