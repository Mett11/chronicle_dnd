import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { LegalModal, LegalTab } from './legal/LegalModal';
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Compass,
  Crown,
  Shield,
  Feather,
} from 'lucide-react';

interface DispatchItem {
  location: string;
  act: string;
  quote: string;
  context: string;
}

const DISPATCH_STORIES: DispatchItem[] = [
  {
    location: 'Neverwinter',
    act: 'Atto IV · Le Fosse di Vetro',
    quote: '«La Spada di Vetro è stata spezzata nei bassifondi. Tre superstiti, un patto d’ombra stipulato all’alba.»',
    context: 'Registrato nel Diario Comune dal Bardo · Sessione 42',
  },
  {
    location: 'Underdark',
    act: 'Atto VI · Il Trono Sommerso',
    quote: '«L’Oracolo ha svelato il vero nome del Re Sommerso. Il Chierico ha invocato l’Intervento Divino sulle rovine di zaffiro.»',
    context: 'Cronaca di Campagna · Capitolo 22',
  },
  {
    location: 'Costa della Spada',
    act: 'Atto II · Il Passo della Tormenta',
    quote: '«Il drago antico ha accettato il tributo d’argento, ma la mappa cifrata è finita nelle mani della gilda dei ladri.»',
    context: 'Archivio degli Eroi · Capitolo 51',
  },
];

export function SanityLogin() {
  const { loginWithGoogle } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);

  // Legal Modal
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');

  const openLegal = (tab: LegalTab) => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Impossibile completare l\'accesso con Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const currentStory = DISPATCH_STORIES[activeStoryIdx];

  return (
    <div className="min-h-screen bg-[#070607] text-[#f5f5f5] selection:bg-[#b91c1c] selection:text-white relative overflow-x-hidden font-sans">
      
      {/* =========================================================================
          TOP NAVIGATION BAR
          ========================================================================= */}
      <header className="relative z-40 w-full border-b border-[#2d1b22]/70 bg-[#070607]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between gap-8">
          
          {/* Zone 1: Wordmark (Clean - span registrum aventurarum removed) */}
          <div className="flex items-center gap-3">
            <span
              className="text-xl sm:text-2xl font-bold tracking-[0.2em] text-[#fafafa] uppercase drop-shadow-[0_2px_12px_rgba(220,38,38,0.35)]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              CHRONICLE
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.2em] text-[#b3a4a9]">
            <a href="#storia" className="hover:text-white transition-colors">
              La Storia
            </a>
            <a href="#pilastri" className="hover:text-white transition-colors">
              I Tre Pilastri
            </a>
            <a href="#cronaca" className="hover:text-white transition-colors">
              Cronache
            </a>
          </nav>

          {/* Zone 3: Direct Action CTA (Audio button removed) */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('login-box');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-2 text-xs uppercase tracking-[0.15em] font-semibold text-white bg-[#b91c1c] hover:bg-[#991b1b] transition-all shadow-[0_0_20px_rgba(185,28,28,0.4)] cursor-pointer active:scale-95"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Accedi
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: HERO / THE ABYSSAL & CELESTIAL TOME (Dark Atmospheric)
          ========================================================================= */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-[#070607] via-[#120a0d] to-[#160a0f]">
        
        {/* Subtle Ambient Crimson Aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[550px] bg-gradient-to-b from-[#7f1d1d]/25 via-[#450a0a]/15 to-transparent blur-[120px] pointer-events-none -z-10" />

        {/* Ambient Floating Dust / Light Texture */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none -z-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 30%, #ef4444 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />

        <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center relative z-10 space-y-8">
          
          {/* Section Kicker */}
          <div className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#d4af37]">
            <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-[#d4af37]" />
            <span>D&amp;D Campaign Journal</span>
            <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#d4af37]" />
          </div>

          {/* Majestic Hero Title */}
          <div className="space-y-3">
            <h1
              className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[0.14em] uppercase text-white drop-shadow-[0_4px_30px_rgba(220,38,38,0.5)]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              CHRONICLE
            </h1>
            <p
              className="text-sm sm:text-base md:text-lg uppercase tracking-[0.25em] text-[#fca5a5]/90 font-medium"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Il Grande Tomo di Campagna &amp; Memoria dei Reami
            </p>
          </div>

          {/* Ornate Filigree Line */}
          <div className="flex items-center justify-center gap-4 text-[#d4af37]/70 py-1">
            <div className="w-16 sm:w-28 h-[1px] bg-gradient-to-r from-transparent to-[#d4af37]/60" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#d4af37]">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" fillOpacity="0.8" />
            </svg>
            <div className="w-16 sm:w-28 h-[1px] bg-gradient-to-l from-transparent to-[#d4af37]/60" />
          </div>

          {/* Central Narrative Hook */}
          <p
            className="max-w-2xl mx-auto text-base sm:text-lg text-[#d4c3c8] font-normal leading-relaxed text-balance"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            L’inchiostro non sbiadisce, i patti non si dimenticano. Uno spazio comune sacro per il Dungeon Master e la compagnia per forgiare sessioni, cartografie e destini condivisi.
          </p>

          {/* ================= HERO CTA: PROMINENT GOOGLE SIGN-IN ================= */}
          <div id="login-box" className="pt-4 max-w-md mx-auto space-y-4">
            <div className="relative group p-1 bg-gradient-to-r from-[#d4af37]/30 via-[#ef4444]/40 to-[#d4af37]/30 transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3.5 px-8 py-4 bg-[#ffffff] hover:bg-[#fafafa] text-[#0f172a] text-sm sm:text-base uppercase tracking-[0.16em] font-bold transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#0f172a]" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                    />
                  </svg>
                )}
                <span>
                  {isGoogleLoading ? 'Apertura in corso...' : 'Continua con Google'}
                </span>
                <ArrowRight
                  size={18}
                  className="text-[#64748b] group-hover:text-black group-hover:translate-x-1 transition-all"
                />
              </button>
            </div>

            {/* Error banner if login fails */}
            {loginError && (
              <div className="flex items-start gap-3 p-3.5 bg-[#300e12] border border-[#991b1b] text-[#fca5a5] text-xs text-left">
                <AlertCircle size={16} className="shrink-0 text-[#ef4444] mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Accesso non riuscito</p>
                  <p className="leading-relaxed">{loginError}</p>
                </div>
              </div>
            )}

            {/* Security Proof */}
            <div className="flex items-center justify-center gap-2 text-xs text-[#a8959c]">
              <ShieldCheck size={14} className="text-[#10b981]" />
              <span>Nessuna password da memorizzare · Crittografia sicura Firebase</span>
            </div>
          </div>

          {/* Live Recent Dispatch Teaser */}
          <div id="cronaca" className="pt-6">
            <div className="inline-block p-4 border border-[#3f1f28]/60 bg-[#160b10]/60 backdrop-blur-sm max-w-xl text-left">
              <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-wider text-[#d4af37] pb-2 border-b border-[#2d151c]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                  Ultima Cronaca Trascorsa
                </span>
                <span className="text-[#9e8b91]">{currentStory.location}</span>
              </div>
              <p
                className="pt-2 text-sm text-[#f5e6eb] italic leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {currentStory.quote}
              </p>
              <div className="pt-2 flex items-center justify-between text-[11px] text-[#8c7b81]">
                <span>{currentStory.act}</span>
                <div className="flex items-center gap-1">
                  {DISPATCH_STORIES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveStoryIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        i === activeStoryIdx ? 'bg-[#d4af37] scale-125' : 'bg-[#402a31]'
                      }`}
                      aria-label={`Vai alla cronaca ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SEAMLESS TORN PAPER TRANSITION
          SVG is explicitly colored with the dark tone (#160a0f) of the hero section above,
          cascading naturally down into the #fcfaf6 parchment section with ZERO break or seam.
          ========================================================================= */}
      <div className="relative w-full overflow-hidden leading-none z-20 -mb-[1px] bg-[#fcfaf6]">
        <svg
          viewBox="0 0 1440 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 sm:h-20 text-[#160a0f] block"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 L1440,0 L1440,30 C1360,65 1260,20 1120,40 C980,60 880,5 740,35 C600,65 500,20 360,45 C220,70 120,40 0,25 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* =========================================================================
          SECTION 2: THE STORY & LORE (Parchment & Charcoal Ink)
          100% High Contrast: Headings explicitly styled with dark ink (#110e0e)
          ========================================================================= */}
      <section id="storia" className="relative py-16 sm:py-24 bg-[#fcfaf6] text-[#1a1412] px-6 sm:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Narrative Prose */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Section Header Kicker */}
            <div className="flex items-center gap-3">
              <span className="w-8 h-[2px] bg-[#854d0e]" />
              <span
                className="text-xs uppercase tracking-[0.25em] font-bold !text-[#854d0e]"
                style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#854d0e' }}
              >
                Story &amp; Visione
              </span>
            </div>

            {/* Main Headline - Bold Deep Ink Black with explicit color override */}
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !text-[#110e0e] leading-[1.15] text-balance"
              style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#110e0e' }}
            >
              OGNI AVVENTURA MERITA LA PROPRIA LEGGENDA.
            </h2>

            {/* Editorial Paragraphs - Deep legible charcoal */}
            <div
              className="space-y-4 text-base sm:text-lg !text-[#2d2522] leading-relaxed"
              style={{ fontFamily: "'Newsreader', Georgia, serif", color: '#2d2522' }}
            >
              <p>
                Dimentica fogli strappati, note discordanti disperse su chat e recap improvvisati a inizio sessione. 
                <strong className="font-semibold !text-[#110e0e]" style={{ color: '#110e0e' }}> Chronicle</strong> è il grande tomo comune dove il Dungeon Master e la compagnia incidono capitoli, cartografano reami sconosciuti, danno voce a PNG memorabili e tracciano genealogie d’eroi.
              </p>
              <p>
                Dalle foreste nebbiose della Costa della Spada fino ai meandri senza luce dell’Underdark, ogni tiro di dado cruciale e ogni patto giurato rimangono scolpiti per sempre nella memoria viva della vostra campagna.
              </p>
            </div>

            {/* Editorial Quote Box */}
            <div className="pt-4 border-l-2 border-[#b91c1c] pl-6 my-6 space-y-2">
              <p
                className="text-lg sm:text-xl italic !text-[#1c1416] font-medium leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif", color: '#1c1416' }}
              >
                «Le storie non muoiono con l’ultimo tiro di dado; vivono nell’inchiostro di chi le ha scritte insieme attorno allo stesso tavolo.»
              </p>
              <span
                className="text-xs uppercase tracking-[0.2em] !text-[#854d0e] font-semibold block"
                style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#854d0e' }}
              >
                — Dal Prologo del Tomo
              </span>
            </div>

            {/* Key Value Points (Clean unboxed typography) */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#2d2522]">
              <div className="flex items-start gap-3">
                <Feather className="w-5 h-5 text-[#b91c1c] shrink-0 mt-0.5" />
                <div>
                  <h4
                    className="font-bold !text-[#110e0e]"
                    style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#110e0e' }}
                  >
                    Diario Unificato
                  </h4>
                  <p className="text-xs text-[#574843] leading-relaxed">
                    Sessioni sincronizzate in tempo reale tra Master e giocatori.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Compass className="w-5 h-5 text-[#b91c1c] shrink-0 mt-0.5" />
                <div>
                  <h4
                    className="font-bold !text-[#110e0e]"
                    style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#110e0e' }}
                  >
                    Cartografia Viva
                  </h4>
                  <p className="text-xs text-[#574843] leading-relaxed">
                    Mappe interattive con pin, note geografiche e punti d’interesse della campagna.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Antique Illuminated Manuscript Showcase */}
          <div className="lg:col-span-5 relative">
            
            {/* Illuminated Parchment Folio Frame */}
            <div className="relative p-6 sm:p-8 bg-[#f5ede1] border-2 border-[#d6c4aa] shadow-[0_20px_50px_rgba(40,25,20,0.15)] space-y-6">
              
              {/* Corner Ornaments */}
              <div className="absolute top-2 left-2 text-[#b45309] text-xs">✦</div>
              <div className="absolute top-2 right-2 text-[#b45309] text-xs">✦</div>
              <div className="absolute bottom-2 left-2 text-[#b45309] text-xs">✦</div>
              <div className="absolute bottom-2 right-2 text-[#b45309] text-xs">✦</div>

              {/* Folio Header - Explicit color overrides for dark text */}
              <div className="text-center border-b border-[#d6c4aa] pb-4 space-y-1">
                <span
                  className="text-[11px] uppercase tracking-[0.25em] font-semibold !text-[#854d0e]"
                  style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#854d0e' }}
                >
                  Folio XLII · Registro d’Atto
                </span>
                <h3
                  className="text-xl font-bold !text-[#1a1412]"
                  style={{ fontFamily: "'Cinzel', Georgia, serif", color: '#1a1412' }}
                >
                  IL PATTO DELLE CINQUE LAME
                </h3>
              </div>

              {/* Folio Excerpt */}
              <div
                className="space-y-3 text-sm !text-[#3b2f2b] leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif", color: '#3b2f2b' }}
              >
                <p>
                  <span className="float-left text-3xl sm:text-4xl font-bold text-[#b91c1c] leading-none pr-2 pt-1 font-serif">
                    N
                  </span>
                  elle cripte sottostanti la fortezza, il Bardo ha decifrato la filastrocca dei nani. Mentre il paladino reggeva la torcia contro il buio millenario, il dado ha decretato: un successo critico. Le porte ferrate si sono schiuse, rivelando il sepolcro dei re di rame.
                </p>
                <p className="italic text-xs !text-[#6e5850]" style={{ color: '#6e5850' }}>
                  «Non siamo entrati come eroi; ne siamo usciti come leggende.»
                </p>
              </div>

              {/* Active Campaign Status Strip */}
              <div className="pt-4 border-t border-[#d6c4aa] flex items-center justify-between text-xs text-[#574843]">
                <div>
                  <span className="block font-bold !text-[#1a1412]" style={{ color: '#1a1412' }}>5 Eroi al Tavolo</span>
                  <span className="text-[11px]">Compagnia del Grifone</span>
                </div>
                <div className="text-right">
                  <span className="block font-bold !text-[#b91c1c]" style={{ color: '#b91c1c' }}>Sessione 42</span>
                  <span className="text-[11px]">In Corso</span>
                </div>
              </div>

              {/* Direct Login Button inside Folio */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-[#1a1412] hover:bg-[#2b1f1a] text-white text-xs uppercase tracking-[0.2em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <span>Inizia a Scrivere la Tua Storia</span>
                <ArrowRight size={14} />
              </button>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          TRANSITION TO PILLARS
          ========================================================================= */}
      <div className="relative w-full overflow-hidden leading-none z-20 -mt-[1px] bg-[#090809]">
        <svg
          viewBox="0 0 1440 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 sm:h-20 text-[#fcfaf6] block"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 L1440,0 L1440,25 C1360,65 1260,20 1120,45 C980,70 880,10 740,40 C600,70 500,20 360,50 C220,80 120,40 0,30 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* =========================================================================
          SECTION 3: THE THREE PILLARS (Lo Schermo, L'Anima, L'Eredità)
          Accurate Chronicle features only - removed unsupported bullet points
          ========================================================================= */}
      <section id="pilastri" className="relative py-20 sm:py-28 bg-[#090809] text-white px-6 sm:px-8 border-t border-[#23151b]">
        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* Section Heading */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span
              className="text-xs uppercase tracking-[0.3em] text-[#d4af37]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Architettura Narrativa
            </span>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              I Tre Pilastri del Tomo
            </h2>
            <p
              className="text-sm sm:text-base text-[#a8959c] leading-relaxed"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              Progettato specificamente per le esigenze reali del tavolo da gioco: separazione rigorosa tra segreti del DM e memoria condivisa.
            </p>
          </div>

          {/* 3 Pillars Grid - Editorial, Unboxed Columns with hairline dividers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 lg:gap-12">
            
            {/* Pillar 1: Lo Schermo del Master */}
            <div className="space-y-4 pt-6 border-t border-[#d4af37]/40 relative">
              <div className="flex items-center justify-between">
                <span
                  className="text-3xl font-bold text-[#d4af37]"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  I.
                </span>
                <Crown size={20} className="text-[#d4af37]" />
              </div>

              <h3
                className="text-xl font-bold text-white tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                Lo Schermo del Master
              </h3>

              <p
                className="text-sm text-[#b8a6ac] leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Segreti celati al riparo da sguardi indiscreti. Gestisci note confidenziali, nodi di trama non lineari, colpi di scena pronti e tiri dietro lo schermo con sicurezza crittografica.
              </p>

              <div className="pt-2 text-xs text-[#857177] space-y-1.5">
                <p>· Note invisibili ai giocatori</p>
                <p>· Gestione cronologia e colpi di scena</p>
                <p>· Archivio segreto dei PNG e delle fazioni</p>
              </div>
            </div>

            {/* Pillar 2: L'Anima della Compagnia */}
            <div className="space-y-4 pt-6 border-t border-[#10b981]/50 relative">
              <div className="flex items-center justify-between">
                <span
                  className="text-3xl font-bold text-[#10b981]"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  II.
                </span>
                <Shield size={20} className="text-[#10b981]" />
              </div>

              <h3
                className="text-xl font-bold text-white tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                L'Anima della Compagnia
              </h3>

              <p
                className="text-sm text-[#b8a6ac] leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Le schede dei personaggi vivono insieme agli eventi narrati. Legami tra eroi, patti giurati e annotazioni personali sempre sincronizzati e a portata di mano.
              </p>

              <div className="pt-2 text-xs text-[#857177] space-y-1.5">
                <p>· Schede e cronache degli eroi</p>
                <p>· Mappa delle relazioni tra avventurieri</p>
                <p>· Diario condiviso delle sessioni</p>
              </div>
            </div>

            {/* Pillar 3: L'Eredità dei Reami */}
            <div className="space-y-4 pt-6 border-t border-[#ef4444]/50 relative">
              <div className="flex items-center justify-between">
                <span
                  className="text-3xl font-bold text-[#ef4444]"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                >
                  III.
                </span>
                <BookOpen size={20} className="text-[#ef4444]" />
              </div>

              <h3
                className="text-xl font-bold text-white tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                L'Eredità dei Reami
              </h3>

              <p
                className="text-sm text-[#b8a6ac] leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Codex enciclopedico del mondo di gioco. Custodisci la memoria degli eventi, ritrova PNG e luoghi e mantieni viva la coerenza dell’universo di campagna.
              </p>

              <div className="pt-2 text-xs text-[#857177] space-y-1.5">
                <p>· Ricerca rapida negli archivi di campagna</p>
                <p>· Generazione timeline degli eventi</p>
                <p>· Memoria a lungo termine delle decisioni</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: FINAL CALL TO ACTION
          ========================================================================= */}
      <section className="relative py-20 bg-gradient-to-t from-[#140a0e] to-[#090809] border-t border-[#2d1b22] px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <span
            className="text-xs uppercase tracking-[0.3em] text-[#d4af37]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Inizia Ora la Tua Cronaca
          </span>

          <h2
            className="text-3xl sm:text-4xl font-bold text-white uppercase tracking-wider"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            La Tua Storia è Pronta per Essere Incisa.
          </h2>

          <p
            className="text-sm sm:text-base text-[#a8959c] leading-relaxed"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Accedi con il tuo account Google per creare la tua prima campagna o unirti al tavolo del tuo Dungeon Master con un codice invito.
          </p>

          <div className="pt-2 max-w-sm mx-auto">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-[#fafafa] text-[#0f172a] text-sm uppercase tracking-[0.16em] font-bold transition-all shadow-lg hover:shadow-2xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#0f172a]" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
              )}
              <span>Continua con Google</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER (Clean, quiet, zero clutter)
          ========================================================================= */}
      <footer className="border-t border-[#24171d] bg-[#070607] py-8 px-6 sm:px-8 text-xs text-[#8e7e84]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-[#b8a6ac]">Chronicle</span>
            <span className="mx-2">·</span>
            <span>Tutti i diritti riservati © 2026</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              type="button"
              onClick={() => openLegal('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => openLegal('cookie')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Cookie Policy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => openLegal('terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Termini di Servizio
            </button>
          </div>
        </div>
      </footer>

      {/* Legal Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </div>
  );
}
