import { UserPreferencesService } from '../lib/userPreferencesService';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import {
  BookOpen,
  Scroll,
  Calendar,
  Layers,
  Sparkles,
  Map as MapIcon,
  Shield,
  Crown,
  HelpCircle,
  BookMarked,
  User,
  Users,
  Search,
  MessageSquare,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  Key,
  Compass,
  Sliders,
  ChevronRight,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

export function Tutorial() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isDmUser = !!player?.isDm;
  const currentUserId = player?._id || (player as any)?.id || CampaignManager.getCurrentAccount()?.id || 'anon';

  // Default to user's role or query param
  const initialRole = searchParams.get('role') === 'dm' ? 'dm' : searchParams.get('role') === 'player' ? 'player' : isDmUser ? 'dm' : 'player';
  const [activeTab, setActiveTab] = useState<'player' | 'dm'>(initialRole);

  const [hasSeenInitial, setHasSeenInitial] = useState<boolean>(() => {
    try {
      const localPrefs = UserPreferencesService.getLocalPreferences(currentUserId);
      if (localPrefs?.reading?.tutorialSeen) return true;
      return localStorage.getItem(`chronicle_tutorial_seen_${currentUserId}`) === 'true';
    } catch {
      return false;
    }
  });

  const isFirstVisit = !hasSeenInitial;

  const handleCompleteTutorial = () => {
    try {
      localStorage.setItem(`chronicle_tutorial_seen_${currentUserId}`, 'true');
      UserPreferencesService.saveReadingPreferences({ tutorialSeen: true });
    } catch {}
    setHasSeenInitial(true);
    navigate('/character');
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 text-content-1 overflow-y-auto custom-scrollbar">
      {/* Top Hero Banner */}
      <div className="relative border-b border-surface-2 bg-gradient-to-b from-surface-1/90 via-surface-1/50 to-surface-0 px-4 sm:px-8 py-6 sm:py-8 shrink-0">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium">
                <BookOpen size={13} />
                <span>Manuale &amp; Guida Rapida di Chronicle</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-cinzel font-bold text-content-1 tracking-wide">
                Guida agli Strumenti della Campagna
              </h1>
              <p className="text-xs sm:text-sm text-content-3 max-w-2xl leading-relaxed">
                Scopri come annotare le sessioni, sincronizzare il calendario di lore, consultare il Codex, interrogare la Sendipietra e gestire i segreti del party.
              </p>
            </div>

            {/* Quick exit or dismiss button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCompleteTutorial}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-surface-0 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>{isFirstVisit ? "Inizia l'Avventura" : 'Torna alla Campagna'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* First access notification bar */}
          {isFirstVisit && (
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs text-content-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles size={16} className="text-primary shrink-0 animate-pulse" />
                <span className="truncate">
                  <strong>Benvenuto in Chronicle!</strong> Questa è la tua prima visita: esplora i moduli della guida o entra subito nella campagna.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCompleteTutorial}
                className="text-primary font-bold hover:underline shrink-0 text-xs font-mono"
              >
                Salta e Inizia
              </button>
            </div>
          )}

          {/* Role Switcher Tabs */}
          <div className="pt-2 flex items-center gap-2">
            <div className="inline-flex p-1 rounded-2xl bg-surface-1 border border-surface-2 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('player')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'player'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2/60'
                }`}
              >
                <Shield size={16} />
                <span>Guida per i Giocatori (PG)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dm')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'dm'
                    ? 'bg-primary text-surface-0 shadow-xs'
                    : 'text-content-3 hover:text-content-1 hover:bg-surface-2/60'
                }`}
              >
                <Crown size={16} />
                <span>Guida per il Dungeon Master (DM)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'player' ? (
            <motion.div
              key="guide_player"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Introduction Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-1/60 border border-surface-2 space-y-2">
                <h2 className="text-base font-cinzel font-bold text-content-1 flex items-center gap-2">
                  <Shield size={18} className="text-primary" />
                  <span>Il Ruolo del Giocatore in Chronicle</span>
                </h2>
                <p className="text-xs sm:text-sm text-content-2 leading-relaxed">
                  Come avventuriero, Chronicle è il tuo taccuino di viaggio condiviso e sicuro. Puoi redigere appunti personali, inviare domande riservate al Dungeon Master, esplorare i PNG del Codex, ripercorrere le sessioni passate e consultare l'oracolo per fare sintesi di indizi e lore.
                </p>
              </div>

              {/* Grid of Player Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. Diario & Note */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Scroll size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">1. Diario &amp; Note di Gioco</h3>
                      <p className="text-[11px] text-content-3">Appunti di sessione e menzioni rapide</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Personale vs Condivisa:</strong> Scegli se salvare la nota come diario privato (visibile solo a te) o condivisa col tavolo.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Menzioni Rapide con <kbd className="px-1 py-0.5 rounded bg-surface-2 text-primary font-mono text-[10px]">@</kbd>:</strong> Digita <kbd className="font-mono text-primary">@</kbd> per collegare istantaneamente PNG, luoghi, mostri o sessioni nel testo.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Markdown &amp; Immagini:</strong> Formatta i tuoi appunti con elenchi, citazioni, titoli e carica immagini illustrative.</span>
                    </li>
                  </ul>
                </div>

                {/* 2. Chiarimenti col DM */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <HelpCircle size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">2. Chiarimenti Riservati col DM</h3>
                      <p className="text-[11px] text-content-3">Domande su lore, regole e intuizioni</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Chiedi al Master:</strong> Spunta l'opzione <em>"Chiedi chiarimento al DM"</em> quando crei o modifichi un appunto.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Risposte Riservate:</strong> Solo tu e il DM potete leggere la risposta ufficiale del Master.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Gestione Indipendente:</strong> Puoi archiviare la risposta o rimuoverla dal tuo profilo quando hai chiarito il dubbio.</span>
                    </li>
                  </ul>
                </div>

                {/* 3. Codex & Entità */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <BookMarked size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">3. Il Codex del Mondo</h3>
                      <p className="text-[11px] text-content-3">PNG, Fazioni, Mostri, Luoghi &amp; Oggetti</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Enciclopedia di Campagna:</strong> Consulta le informazioni scoperte sul mondo di gioco, filtrate per categoria o tag.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Segreti Nascosti:</strong> I retroscena e le informazioni non ancora svelate rimangono invisibili ai giocatori finché il DM non le rivela.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Filtri Rapidi:</strong> Cerca toponimi o alleati con la barra di ricerca rapida (<kbd className="font-mono text-primary">⌘K</kbd>).</span>
                    </li>
                  </ul>
                </div>

                {/* 4. La Storyline & Cronaca */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">4. Cronaca &amp; Storyline</h3>
                      <p className="text-[11px] text-content-3">Linea temporale e sfogliatore a schermo intero</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Timeline della Campagna:</strong> Esplora i capitoli cronologici della saga, ordinati per data narrativa di lore.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Modalità Presentazione:</strong> Clicca su <em>"Presentazione"</em> per sfogliare le immagini e le artwork di sessione a schermo intero con le frecce laterali.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Lettura Estesa:</strong> Tocca la descrizione per aprire l'overlay di lettura immersivo del resoconto di sessione.</span>
                    </li>
                  </ul>
                </div>

                {/* 5. Sendipietra (Oracolo) */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">5. La Sendipietra (Oracolo)</h3>
                      <p className="text-[11px] text-content-3">Assistente di campagna radicato nella lore</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Interrogare la Memoria:</strong> Chiedi chi è un PNG, cosa è successo in una determinata sessione o riassumi gli indizi di una quest.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Personaggi &amp; Voci:</strong> Dialoga con diverse personalità narrative (il Saggio, il Bardo, il Cartografo o figure di lore).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Rispetto dei Segreti:</strong> La Sendipietra non rivela mai retroscena o note riservate del Dungeon Master ai giocatori.</span>
                    </li>
                  </ul>
                </div>

                {/* 6. Scheda Personaggio & Ricordi */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">6. Profilo, Relazioni &amp; Ricordi</h3>
                      <p className="text-[11px] text-content-3">Identità, albero genealogico e scrapbook</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Background &amp; Segreti:</strong> Imposta la privacy di ciascuna sezione (visibile solo al DM o a tutto il gruppo).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Albero Genealogico &amp; Relazioni:</strong> Traccia legami di sangue, alleanze e debiti morali con altri PG e PNG.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Album dei Ricordi (Scrapbook):</strong> Conserva frammenti visivi, lettere, manufatti e ricordi emotivi del personaggio.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="guide_dm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* DM Introduction Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-1/60 border border-surface-2 space-y-2">
                <h2 className="text-base font-cinzel font-bold text-content-1 flex items-center gap-2">
                  <Crown size={18} className="text-primary" />
                  <span>La Guida del Dungeon Master</span>
                </h2>
                <p className="text-xs sm:text-sm text-content-2 leading-relaxed">
                  Come Dungeon Master, hai il controllo completo sulla cronologia, sui segreti di trama, sul calendario di gioco, sulla pubblicazione delle sessioni e sull'atlante cartografico. Ecco come strutturare al meglio la tua campagna.
                </p>
              </div>

              {/* Grid of DM Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. Codice Campagna & Party */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Key size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">1. Codice Campagna &amp; Accesso</h3>
                      <p className="text-[11px] text-content-3">Condividi la campagna con i giocatori</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Codice Univoco:</strong> Fornisci il codice di 6-8 caratteri della campagna ai tuoi giocatori (visibile in Impostazioni).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Sincronizzazione Real-Time:</strong> Tutte le modifiche vengono sincronizzate in tempo reale sul cloud Firestore per l'intero tavolo.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Personalizzazione Nome &amp; Font:</strong> Personalizza il font del logo della campagna dall'icona <Sliders size={12} className="inline text-primary" /> nella sidebar.</span>
                    </li>
                  </ul>
                </div>

                {/* 2. Calendario di Lore */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">2. Calendario di Lore</h3>
                      <p className="text-[11px] text-content-3">Tracciamento del tempo nel mondo di gioco</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Calendario Ufficiale o Custom:</strong> Configura i mesi di Harptos (Faerûn), l'era (CV) o definisci un calendario personalizzato.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Avanzamento Giorni:</strong> Avanza il giorno corrente dal calendario; la data attiva comparirà sempre in basso nella sidebar.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span><strong>Associazione Sessioni &amp; Note:</strong> Collega ciascuna sessione o appunto a una data narrativa per ordinarli nella Storyline.</span>
                    </li>
                  </ul>
                </div>

                {/* 3. Tomo Sessioni & Storyline */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">3. Tomo Sessioni &amp; Verbali</h3>
                      <p className="text-[11px] text-content-3">Redazione dei capitoli e galleria visiva</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Numero di Sessione &amp; Titolo:</strong> Inserisci il verbale ufficiale, il riepilogo degli eventi e la data di gioco.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Cover &amp; Galleria Immagini:</strong> Carica le illustrazioni che alimenteranno automaticamente la modalità <em>Presentazione</em> della Storyline.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Capitoli Narrativi:</strong> Raggruppa le sessioni in archi narrativi (es. *Atto I: L'Arrivo a Neverwinter*).</span>
                    </li>
                  </ul>
                </div>

                {/* 4. Codex & Gestione Segreti */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">4. Codex &amp; Segreti del Master</h3>
                      <p className="text-[11px] text-content-3">Controllo della visibilità di PNG, fazioni e trame</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Entità Riservate (DM Only):</strong> Crea PNG o mostri nascosti al party fino al momento della rivelazione.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Note Segrete di Trama:</strong> Inserisci sezioni segrete nelle schede delle entità, visibili unicamente al Dungeon Master.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Supervisione Schede PG:</strong> Visualizza i background completi, i segreti e le relazioni compilate dai tuoi giocatori.</span>
                    </li>
                  </ul>
                </div>

                {/* 5. Centro Chiarimenti DM */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">5. Chiarimenti &amp; Responsi</h3>
                      <p className="text-[11px] text-content-3">Rispondi ai dubbi del party in modo riservato</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Notifiche di Domande PG:</strong> Quando un giocatore spunta <em>"Chiedi chiarimento al DM"</em>, ricevi un avviso dedicato.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Risposta Rapida:</strong> Rispondi direttamente dal Centro Notifiche, dalla pagina Chiarimenti o dal profilo del personaggio.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span><strong>Risoluzione &amp; Pulizia:</strong> Segna come risolto, modifica la risposta o rimuovi dal pannello del Master.</span>
                    </li>
                  </ul>
                </div>

                {/* 6. Atlante & Mappe Geografiche */}
                <div className="p-5 rounded-2xl bg-surface-1 border border-surface-2 space-y-3 shadow-xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <MapIcon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-content-1">6. Atlante &amp; Cartografia</h3>
                      <p className="text-[11px] text-content-3">Mappe regionali, cittadine e dungeon</p>
                    </div>
                  </div>
                  <ul className="text-xs text-content-2 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Cartelle Gerarchiche:</strong> Organizza le mappe per regioni, regni, città o piani di esistenza.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Pin &amp; Collegamento Codex:</strong> Posiziona indicatori interattivi sulla mappa che aprono la scheda del luogo correlato.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Zoom &amp; Pan Fluido:</strong> Navigazione ad alta risoluzione sia su desktop che su dispositivi touch/mobile.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Shortcuts & Best Practices Footer */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface-1 border border-surface-2 space-y-4 shadow-xs">
          <h3 className="text-sm font-cinzel font-bold text-content-1 flex items-center gap-2">
            <Compass size={16} className="text-primary" />
            <span>Scorciatoie &amp; Consigli Pratici</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-content-2">
            <div className="p-3 rounded-xl bg-surface-0 border border-surface-2/80 space-y-1">
              <div className="font-mono font-bold text-primary flex items-center gap-1.5 text-[11px]">
                <Search size={12} /> Cerca Ovunque
              </div>
              <p className="text-content-3">Premi <kbd className="font-mono text-content-1 px-1 py-0.5 rounded bg-surface-2 text-[10px]">⌘K</kbd> o <kbd className="font-mono text-content-1 px-1 py-0.5 rounded bg-surface-2 text-[10px]">Ctrl+K</kbd> per cercare istantaneamente in tutte le sessioni, note e PNG.</p>
            </div>

            <div className="p-3 rounded-xl bg-surface-0 border border-surface-2/80 space-y-1">
              <div className="font-mono font-bold text-primary flex items-center gap-1.5 text-[11px]">
                <Sparkles size={12} /> Collegamenti Rapidi
              </div>
              <p className="text-content-3">Scrivi <kbd className="font-mono text-content-1 px-1 py-0.5 rounded bg-surface-2 text-[10px]">@NomeEntità</kbd> in qualsiasi testo per creare un link interattivo al Codex.</p>
            </div>

            <div className="p-3 rounded-xl bg-surface-0 border border-surface-2/80 space-y-1">
              <div className="font-mono font-bold text-primary flex items-center gap-1.5 text-[11px]">
                <Layers size={12} /> Cronaca a Schermo Intero
              </div>
              <p className="text-content-3">Usa la vista <em>Storyline &gt; Presentazione</em> durante il riassunto di inizio sessione per proiettare le immagini al tavolo.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-surface-2/80 text-xs text-content-3">
            <span>Questa guida è sempre accessibile dal menu laterale sotto <strong>Guida &amp; Tutorial</strong>.</span>
            <button
              type="button"
              onClick={handleCompleteTutorial}
              className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              Chiudi Manuale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
