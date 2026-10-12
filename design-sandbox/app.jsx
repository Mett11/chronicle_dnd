/* CHRONICLE DND — VISUAL DESIGN SANDBOX REACT APPLICATION
 * Art Direction: Contemporary Arcane Instrument
 */

const { useState, useEffect } = React;

function App() {
  const [activeScreen, setActiveScreen] = useState('overview'); // 'overview', 'codex', 'sessions', 'storyline', 'atlas', 'search', 'themes'
  const [currentTheme, setCurrentTheme] = useState('dungeon-master-dark');
  const [selectedEntityId, setSelectedEntityId] = useState('ent_maelis_silverwing');
  const [selectedSessionId, setSelectedSessionId] = useState('sess_24');
  const [selectedChapterId, setSelectedChapterId] = useState('chap_02');
  const [selectedPoiId, setSelectedPoiId] = useState('poi_forte_eclissi');
  const [searchQuery, setSearchQuery] = useState('');

  const data = window.SANDBOX_DATA;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Keyboard shortcut listener for Quick Search (⌘K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveScreen('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-surface-0 text-content-1 font-body selection:bg-primary/30">
      
      {/* ========================================================================= */}
      {/* TOP INSTRUMENT DOCK & TELEMETRY HEADER */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-surface-1/90 backdrop-blur-md border-b border-surface-3/60 shadow-2xl">
        {/* Top Telemetry Ticker */}
        <div className="px-4 py-1.5 bg-surface-0/90 border-b border-surface-3/40 text-xs font-mono-tech text-content-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              {data.campaign.code} // {data.campaign.title}
            </span>
            <span className="hidden sm:inline-block text-content-3/40">|</span>
            <span className="hidden sm:inline-block">EPOCH: {data.campaign.currentDateHarptos}</span>
            <span className="hidden md:inline-block text-content-3/40">|</span>
            <span className="hidden md:inline-block text-primary/80">{data.campaign.planarAlignment}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-content-3">
              TEMA D&D: <strong className="text-content-1 font-mono-tech uppercase">{currentTheme.replace('-', ' ')}</strong>
            </span>
            <button
              onClick={() => setActiveScreen('themes')}
              className="px-2 py-0.5 rounded bg-surface-2 hover:bg-surface-3 border border-surface-3 text-[10px] font-mono-tech uppercase transition-colors text-primary"
            >
              Seleziona Tema
            </button>
          </div>
        </div>

        {/* Navigation Mode Switcher Bar */}
        <div className="px-4 py-3 flex items-center justify-between gap-4 overflow-x-auto">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-display font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="font-display font-bold tracking-wider text-sm text-content-1 leading-none">
                CHRONICLE D&D
              </h1>
              <span className="text-[10px] font-mono-tech uppercase tracking-widest text-content-3">
                ARCANE INSTRUMENT SANDBOX
              </span>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <nav className="flex items-center gap-1 bg-surface-0/70 p-1 rounded-lg border border-surface-3/50 text-xs font-heading">
            <button
              onClick={() => setActiveScreen('overview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'overview'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [01] OVERVIEW
            </button>

            <button
              onClick={() => setActiveScreen('codex')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'codex'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [02] CODEX
            </button>

            <button
              onClick={() => setActiveScreen('sessions')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'sessions'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [03] SESSIONS
            </button>

            <button
              onClick={() => setActiveScreen('storyline')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'storyline'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [04] STORYLINE
            </button>

            <button
              onClick={() => setActiveScreen('atlas')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'atlas'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [05] ATLAS
            </button>

            <button
              onClick={() => setActiveScreen('search')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                activeScreen === 'search'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              <span>[06] SEARCH</span>
              <kbd className="px-1.5 py-0.2 bg-surface-2 text-[10px] font-mono-tech rounded text-content-3 border border-surface-3">⌘K</kbd>
            </button>

            <button
              onClick={() => setActiveScreen('themes')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScreen === 'themes'
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow'
                  : 'text-content-2 hover:text-content-1 hover:bg-surface-2/50'
              }`}
            >
              [07] TEMI D&D
            </button>
          </nav>
        </div>
      </header>


      {/* ========================================================================= */}
      {/* MAIN SANDBOX VIEWPORT */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 1: CAMPAIGN OVERVIEW / NOTES */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header / Identity Banner */}
            <div className="p-6 rounded-xl bg-surface-1 border border-surface-3/80 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-wrap items-start justify-between gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono-tech text-xs text-primary uppercase tracking-widest">
                    <span>SECTOR: FAERÛN</span> // <span>CAMPAIGN ID: {data.campaign.code}</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-display font-bold text-content-1 tracking-wide">
                    {data.campaign.title}
                  </h2>
                  <p className="text-sm font-body text-content-2 mt-1">
                    {data.campaign.subtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-3 py-2 rounded bg-surface-2/80 border border-surface-3 text-center min-w-[100px]">
                    <span className="block text-[10px] font-mono-tech uppercase text-content-3">SESSIONI</span>
                    <strong className="text-lg font-mono-tech text-primary">{data.campaign.sessionsCount}</strong>
                  </div>
                  <div className="px-3 py-2 rounded bg-surface-2/80 border border-surface-3 text-center min-w-[100px]">
                    <span className="block text-[10px] font-mono-tech uppercase text-content-3">ENTITÀ CODEX</span>
                    <strong className="text-lg font-mono-tech text-content-1">{data.campaign.entitiesCount}</strong>
                  </div>
                  <div className="px-3 py-2 rounded bg-surface-2/80 border border-surface-3 text-center min-w-[100px]">
                    <span className="block text-[10px] font-mono-tech uppercase text-content-3">ARTICOLI LORE</span>
                    <strong className="text-lg font-mono-tech text-content-1">{data.campaign.worldLoreArticlesCount}</strong>
                  </div>
                </div>
              </div>

              {/* Status Ticker Bar */}
              <div className="mt-6 pt-4 border-t border-surface-3/50 flex flex-wrap items-center justify-between text-xs font-mono-tech text-content-3 gap-4">
                <div>
                  CAPITOLO ATTIVO: <strong className="text-primary">{data.campaign.currentChapter}</strong>
                </div>
                <div>
                  DUNGEON MASTER: <span className="text-content-1">{data.campaign.dmName}</span>
                </div>
                <div>
                  SISTEMA: <span className="text-content-2">{data.campaign.system}</span>
                </div>
              </div>
            </div>

            {/* Asymmetric 3-Column Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Campaign Metadata & Parameters */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-5 rounded-xl bg-surface-1 border border-surface-3/80">
                  <h3 className="text-xs font-heading uppercase tracking-widest text-primary mb-4 flex items-center justify-between">
                    <span>PARAMETRI DI CAMPO</span>
                    <span className="font-mono-tech text-[10px] text-content-3">LIVE TELEMETRY</span>
                  </h3>

                  <div className="space-y-3 font-mono-tech text-xs">
                    <div className="flex justify-between py-2 border-b border-surface-3/40">
                      <span className="text-content-3">Allineamento Planare:</span>
                      <span className="text-primary font-semibold">{data.campaign.planarAlignment}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-surface-3/40">
                      <span className="text-content-3">Membri Party Attivi:</span>
                      <span className="text-content-1 font-semibold">{data.campaign.activePlayersCount} Giocatori</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-surface-3/40">
                      <span className="text-content-3">Grado Pericolo Regione:</span>
                      <span className="text-red-400 font-semibold">Grado 12 (Molto Alto)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-surface-3/40">
                      <span className="text-content-3">Ultima Sessione:</span>
                      <span className="text-content-1">Sessione 24 ({data.campaign.currentDateHarptos})</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-surface-3/60">
                    <button
                      onClick={() => setActiveScreen('sessions')}
                      className="w-full py-2.5 rounded bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary font-heading text-xs uppercase tracking-wider font-semibold transition-all text-center"
                    >
                      Apri Registro Ultima Sessione →
                    </button>
                  </div>
                </div>

                {/* Quick Map Widget */}
                <div className="p-5 rounded-xl bg-surface-1 border border-surface-3/80">
                  <h3 className="text-xs font-heading uppercase tracking-widest text-content-2 mb-3">
                    UBICAZIONE TATTICA
                  </h3>
                  <div className="relative rounded-lg overflow-hidden border border-surface-3 aspect-video bg-surface-2 flex items-center justify-center group cursor-pointer" onClick={() => setActiveScreen('atlas')}>
                    <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/40 to-transparent"></div>
                    <div className="relative z-10 text-center p-4">
                      <span className="font-mono-tech text-[10px] text-primary uppercase block">REGIONE CORRENTE</span>
                      <strong className="font-display text-base text-content-1 block">Sottomonte (Cripta Bassa)</strong>
                      <span className="inline-block mt-2 px-2 py-1 rounded bg-primary/20 text-primary border border-primary/40 text-[10px] font-mono-tech uppercase">Apri Atlante Mappa →</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center & Right Column: Notes & Field Records */}
              <div className="lg:col-span-8 space-y-6">
                <div className="p-6 rounded-xl bg-surface-1 border border-surface-3/80">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-3">
                    <div>
                      <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-content-1">
                        NOTE DI CAMPO COLLABORATIVE
                      </h3>
                      <p className="text-xs font-body text-content-3 mt-0.5">
                        Registrazioni sul campo con disciplina tipografica e zero pill-badges
                      </p>
                    </div>
                    <span className="font-mono-tech text-xs text-primary">{data.notes.length} NOTE REGISTRATE</span>
                  </div>

                  <div className="space-y-6">
                    {data.notes.map((note) => (
                      <div key={note.id} className="p-5 rounded-lg bg-surface-2/50 border border-surface-3 hover:border-primary/40 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 uppercase">
                              {note.category}
                            </span>
                            <span className="font-mono-tech text-xs text-content-3">
                              AUTORE: <strong className="text-content-2">{note.author}</strong>
                            </span>
                          </div>
                          <span className="font-mono-tech text-xs text-content-3">{note.date}</span>
                        </div>

                        <h4 className="font-heading font-bold text-lg text-content-1 mb-2">
                          {note.title}
                        </h4>

                        <div className="font-serif-reading text-base leading-relaxed text-content-2/90 mb-4">
                          {note.contentMarkdown}
                        </div>

                        {note.dmReply && (
                          <div className="p-4 rounded bg-primary-muted/20 border-l-2 border-primary text-xs font-mono-tech text-content-2 space-y-1">
                            <span className="text-primary font-semibold block uppercase">RISPOSTA DEL DUNGEON MASTER:</span>
                            <p className="italic">{note.dmReply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 2: CODEX: ENTITY DETAIL */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'codex' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-3">
              <div>
                <span className="font-mono-tech text-xs text-primary uppercase tracking-widest block">COMPENDIO CODEX // D&D 5E</span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                  ENTITÀ & REPERTORIO DI CAMPAGNA
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filtra entità..."
                  className="px-3 py-1.5 rounded bg-surface-1 border border-surface-3 text-xs font-mono-tech text-content-1 focus:outline-none focus:border-primary w-48 sm:w-64"
                />
              </div>
            </div>

            {/* Split Screen Master-Detail Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Entity Index Table */}
              <div className="lg:col-span-4 space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {data.entities.map((ent) => {
                  const isSelected = ent.id === selectedEntityId;
                  return (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntityId(ent.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-lg'
                          : 'bg-surface-1 border-surface-3/70 hover:border-surface-4 hover:bg-surface-2/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono-tech text-[10px] text-content-3 uppercase">{ent.typeLabel}</span>
                        <span
                          className="font-mono-tech text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold"
                          style={{ color: ent.statusColor, backgroundColor: `${ent.statusColor}18`, border: `1px solid ${ent.statusColor}40` }}
                        >
                          {ent.statusLabel}
                        </span>
                      </div>
                      
                      <h4 className="font-heading font-bold text-base text-content-1">
                        {ent.name}
                      </h4>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {ent.tags.map((t, idx) => (
                          <span key={idx} className="font-mono-tech text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-content-3 border border-surface-3 uppercase">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: High-Density Entity Dossier */}
              <div className="lg:col-span-8">
                {(() => {
                  const ent = data.entities.find((e) => e.id === selectedEntityId) || data.entities[0];
                  return (
                    <div className="p-6 rounded-xl bg-surface-1 border border-surface-3/80 space-y-6">
                      
                      {/* Entity Header Banner */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-surface-3">
                        <img
                          src={ent.avatarUrl}
                          alt={ent.name}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-primary/40 shadow-xl shrink-0"
                        />
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono-tech text-xs text-primary uppercase tracking-widest">{ent.typeLabel}</span>
                            <span
                              className="font-mono-tech text-xs px-2 py-0.5 rounded uppercase font-semibold"
                              style={{ color: ent.statusColor, backgroundColor: `${ent.statusColor}20`, border: `1px solid ${ent.statusColor}50` }}
                            >
                              {ent.statusLabel}
                            </span>
                          </div>

                          <h3 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                            {ent.name}
                          </h3>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {ent.tags.map((t, i) => (
                              <span key={i} className="font-mono-tech text-xs px-2 py-0.5 rounded bg-surface-2 text-content-2 border border-surface-3 uppercase">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Attributes Matrix Grid */}
                      <div>
                        <h4 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
                          MATRICE ATTRIBUTI
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(ent.attributes).map(([k, v], idx) => (
                            <div key={idx} className="p-3 rounded bg-surface-2/60 border border-surface-3/60 font-mono-tech text-xs">
                              <span className="block text-[10px] text-content-3 uppercase mb-0.5">{k}</span>
                              <strong className="text-content-1 font-semibold">{v}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Relationships Network Lattice */}
                      <div>
                        <h4 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
                          RETE DI RELAZIONI E LEGAMI
                        </h4>
                        <div className="space-y-2">
                          {ent.relationships.map((rel, idx) => {
                            const target = data.entities.find((e) => e.id === rel.targetId);
                            return (
                              <div key={idx} className="p-3 rounded bg-surface-2/40 border border-surface-3/50 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-primary">➔</span>
                                  <strong className="text-content-1">{target ? target.name : rel.targetId}</strong>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-content-3 font-body">{rel.relation}</span>
                                  <span className="px-2 py-0.5 rounded bg-surface-3/60 text-content-2 text-[10px] uppercase font-semibold">
                                    {rel.trust}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bio Markdown Narrative */}
                      <div>
                        <h4 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
                          DOSSIER NARRATIVO & STORIA
                        </h4>
                        <div className="p-4 rounded-lg bg-surface-2/30 border border-surface-3/50 font-serif-reading text-base leading-relaxed text-content-2">
                          {ent.bioMarkdown}
                        </div>
                      </div>

                      {/* Session Mentions Footnote */}
                      <div className="pt-4 border-t border-surface-3/60 text-xs font-mono-tech text-content-3 flex flex-wrap items-center justify-between gap-2">
                        <span>APPARIZIONI IN SESSIONE:</span>
                        <div className="flex flex-wrap gap-2">
                          {ent.sessionsMentioned.map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-surface-2 text-primary border border-surface-3">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 3: SESSIONS: SESSION DETAIL */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'sessions' && (
          <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
            {(() => {
              const sess = data.sessions.find((s) => s.id === selectedSessionId) || data.sessions[0];
              return (
                <div className="p-6 sm:p-8 rounded-xl bg-surface-1 border border-surface-3/80 space-y-8 shadow-2xl">
                  
                  {/* Session Header */}
                  <div className="pb-6 border-b border-surface-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
                      <span className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/30 uppercase font-semibold">
                        SESSIONE #{sess.number}
                      </span>
                      <span className="text-content-3 uppercase">DATA HARPTOS: <strong className="text-content-1">{sess.dateHarptos}</strong></span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                      {sess.title}
                    </h2>

                    <div className="text-xs font-mono-tech text-content-3">
                      CAPITOLO: <span className="text-primary">{sess.chapterName}</span>
                    </div>
                  </div>

                  {/* Audio Waveform Player Bar */}
                  <div className="p-4 rounded-lg bg-surface-2/80 border border-surface-3 flex items-center justify-between gap-4 font-mono-tech text-xs">
                    <div className="flex items-center gap-3">
                      <button className="w-10 h-10 rounded-full bg-primary text-surface-0 flex items-center justify-center font-bold hover:scale-105 transition-transform">
                        ▶
                      </button>
                      <div>
                        <strong className="block text-content-1 text-xs">REGISTRAZIONE AUDIO SESSIONE #{sess.number}</strong>
                        <span className="text-[10px] text-content-3">DURATA: 02:45:12 // FORMATO HIGH-QUALITY AUDIO</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 h-6">
                      {[40, 70, 30, 90, 60, 80, 20, 50, 100, 60, 40, 80, 50, 30, 70].map((h, i) => (
                        <span key={i} className="w-1 bg-primary/60 rounded-full" style={{ height: `${h}%` }}></span>
                      ))}
                    </div>
                  </div>

                  {/* Long-Form Narrative Summary */}
                  <div>
                    <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
                      SINOSSI E CRONACA NARRATIVA
                    </h3>
                    <div className="font-serif-reading text-lg leading-relaxed text-content-1/90 space-y-4">
                      <p>{sess.summary}</p>
                    </div>
                  </div>

                  {/* Plot Events Timeline Wire */}
                  <div>
                    <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-4">
                      SEQUENZA EVENTI CHIAVE (PLOT EVENTS)
                    </h3>
                    <div className="space-y-3 relative pl-6 border-l-2 border-primary/30">
                      {sess.plotEvents.map((evt, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-surface-1"></span>
                          <p className="font-heading font-medium text-sm text-content-2">
                            {evt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Quotes Block */}
                  <div>
                    <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
                      CITAZIONI MEMORABILI
                    </h3>
                    <div className="space-y-3">
                      {sess.quotes.map((q, idx) => (
                        <div key={idx} className="p-4 rounded bg-surface-2/40 border-l-2 border-primary font-serif-reading text-base italic text-content-2">
                          {q.text}
                          <span className="block mt-1 font-mono-tech text-xs not-italic text-primary font-semibold">
                            — {q.speaker}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Open Questions */}
                  {sess.openQuestions.length > 0 && (
                    <div>
                      <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-amber-400 mb-3">
                        QUESITI APERTI & PISTE DA SEGUIRE
                      </h3>
                      <div className="space-y-2">
                        {sess.openQuestions.map((q, idx) => (
                          <div key={idx} className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono-tech text-amber-200">
                            ? {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 4: STORYLINE / CHAPTERS */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'storyline' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="pb-4 border-b border-surface-3">
              <span className="font-mono-tech text-xs text-primary uppercase tracking-widest block">STRATIGRAFIA DELLA SAGA</span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                CAPITOLI & PROGRESSIONE DELLA STORIA
              </h2>
            </div>

            {/* Layered Chapter Strata */}
            <div className="space-y-6">
              {data.chapters.map((chap) => (
                <div key={chap.id} className="p-6 rounded-xl bg-surface-1 border border-surface-3/80 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono-tech text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 uppercase font-semibold">
                          CAPITOLO 0{chap.number}
                        </span>
                        <span className="font-mono-tech text-xs text-content-3 uppercase">
                          {chap.statusLabel}
                        </span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-display font-bold text-content-1">
                        {chap.title}
                      </h3>
                    </div>

                    <div className="text-right font-mono-tech text-xs text-content-3">
                      <div>PERIODO: <span className="text-content-2">{chap.startDate} - {chap.endDate}</span></div>
                      <div>SESSIONI COMPRESE: <strong className="text-primary">{chap.sessionsCount} Sessioni</strong></div>
                    </div>
                  </div>

                  <p className="font-serif-reading text-base text-content-2 leading-relaxed">
                    {chap.synopsis}
                  </p>

                  {/* Connected Sessions Nodes Bar */}
                  <div className="pt-4 border-t border-surface-3/60">
                    <span className="block font-mono-tech text-[10px] text-content-3 uppercase mb-2">SESSIONI AGGANCIATE A QUESTO CAPITOLO:</span>
                    <div className="flex flex-wrap gap-2">
                      {data.sessions.filter((s) => s.chapterId === chap.id).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedSessionId(s.id);
                            setActiveScreen('sessions');
                          }}
                          className="px-3 py-1.5 rounded bg-surface-2 hover:bg-primary/20 hover:border-primary/40 border border-surface-3 text-xs font-mono-tech text-content-1 transition-colors"
                        >
                          #{s.number} — {s.title}
                        </button>
                      ))}
                      {chap.sessionsCount === 0 && (
                        <span className="font-mono-tech text-xs text-content-3 italic">Nessuna sessione ancora giocata in questo capitolo.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 5: ATLAS / MAP */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'atlas' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-3">
              <div>
                <span className="font-mono-tech text-xs text-primary uppercase tracking-widest block">CARTOGRAFIA & ATLANTE PLANARE</span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                  MAPPA INTERATTIVA DI FAERÛN
                </h2>
              </div>
              <div className="font-mono-tech text-xs text-content-3">
                SCALA CARTOGRAFICA: <span className="text-primary font-semibold">1:50.000 LEGHE</span>
              </div>
            </div>

            {/* Map Viewport Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main Full-Bleed Map Canvas Mockup */}
              <div className="lg:col-span-8 relative rounded-xl border border-surface-3/80 overflow-hidden bg-surface-1 min-h-[500px] flex items-center justify-center shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80"
                  alt="Mappa del Mondo"
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                />
                
                {/* Cartographic Coordinate Overlay Grid */}
                <div className="absolute inset-0 arcane-grid-bg pointer-events-none"></div>

                {/* POI Pins Overlay */}
                {data.mapPois.map((poi) => {
                  const isSelected = poi.id === selectedPoiId;
                  return (
                    <div
                      key={poi.id}
                      onClick={() => setSelectedPoiId(poi.id)}
                      style={{ top: `${poi.coords[0]}%`, left: `${poi.coords[1]}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-transform ${
                        isSelected ? 'bg-primary text-surface-0 scale-125 ring-4 ring-primary/40' : 'bg-surface-0/90 text-primary border border-primary group-hover:scale-110'
                      }`}>
                        📍
                      </div>
                      <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-0/90 px-2 py-0.5 rounded border border-surface-3 text-[10px] font-mono-tech text-content-1 shadow">
                        {poi.name}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Left Coordinate Bar */}
                <div className="absolute bottom-3 left-3 bg-surface-0/90 border border-surface-3 px-3 py-1.5 rounded text-[11px] font-mono-tech text-content-2">
                  POSIZIONE RILEVATA: <span className="text-primary">LAT 44.12 // LON -12.84</span>
                </div>
              </div>

              {/* Right Side: Location Detail Drawer */}
              <div className="lg:col-span-4">
                {(() => {
                  const poi = data.mapPois.find((p) => p.id === selectedPoiId) || data.mapPois[0];
                  return (
                    <div className="p-6 rounded-xl bg-surface-1 border border-surface-3/80 space-y-5">
                      <div className="pb-4 border-b border-surface-3">
                        <span className="font-mono-tech text-xs text-primary uppercase block mb-1">{poi.type}</span>
                        <h3 className="text-xl font-display font-bold text-content-1">{poi.name}</h3>
                        <span className="font-mono-tech text-xs text-content-3 block mt-1">{poi.coordLabel}</span>
                      </div>

                      <div className="space-y-3 font-mono-tech text-xs">
                        <div className="flex justify-between py-2 border-b border-surface-3/40">
                          <span className="text-content-3">REGIONE:</span>
                          <span className="text-content-1">{poi.region}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-surface-3/40">
                          <span className="text-content-3">PERICOLO:</span>
                          <span className="text-amber-400 font-semibold">{poi.danger}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-2">DESCRIZIONE CARTOGRAFICA</h4>
                        <p className="font-serif-reading text-sm leading-relaxed text-content-2">{poi.description}</p>
                      </div>

                      <div className="pt-4 border-t border-surface-3/60">
                        <button
                          onClick={() => {
                            setSelectedEntityId(poi.linkedEntityId);
                            setActiveScreen('codex');
                          }}
                          className="w-full py-2 rounded bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary font-heading text-xs uppercase tracking-wider font-semibold transition-colors"
                        >
                          Apri Dossier Codex Correlato →
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 6: CAMPAIGN SEARCH / QUICK SEARCH (⌘K) */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'search' && (
          <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
            <div className="p-6 rounded-xl bg-surface-1 border border-surface-3/80 shadow-2xl space-y-6">
              
              {/* Search Bar Input */}
              <div>
                <div className="flex items-center justify-between mb-2 font-mono-tech text-xs text-content-3">
                  <span>RICERCA RAPIDA NEL GRIMORIO</span>
                  <span>PREMI <kbd className="px-1.5 py-0.5 bg-surface-2 border border-surface-3 rounded text-content-1">ESC</kbd> PER USCIRE</span>
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca entità, sessioni, capitoli, luoghi, note..."
                  className="w-full px-4 py-3 rounded-lg bg-surface-2 border-2 border-primary/50 text-content-1 text-base font-body focus:outline-none focus:border-primary shadow-inner"
                  autoFocus
                />
              </div>

              {/* Categorized Search Results */}
              <div className="space-y-4">
                <span className="block font-mono-tech text-xs text-primary uppercase tracking-widest">
                  RISULTATI TROVATI NEL COMPENDIO ({data.entities.length + data.sessions.length + data.notes.length})
                </span>

                {/* Entity Results Section */}
                <div className="space-y-2">
                  <span className="font-mono-tech text-[10px] text-content-3 uppercase block">ENTITÀ & PERSONAGGI CODEX</span>
                  {data.entities.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => {
                        setSelectedEntityId(e.id);
                        setActiveScreen('codex');
                      }}
                      className="p-3 rounded bg-surface-2/60 hover:bg-primary/10 border border-surface-3 hover:border-primary/40 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                    >
                      <div>
                        <strong className="font-heading text-sm text-content-1 block">{e.name}</strong>
                        <span className="font-mono-tech text-[10px] text-content-3 uppercase">{e.typeLabel}</span>
                      </div>
                      <span className="font-mono-tech text-xs text-primary">Apri Dossier →</span>
                    </div>
                  ))}
                </div>

                {/* Session Results Section */}
                <div className="space-y-2 pt-2">
                  <span className="font-mono-tech text-[10px] text-content-3 uppercase block">REGISTRI DI SESSIONE</span>
                  {data.sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        setActiveScreen('sessions');
                      }}
                      className="p-3 rounded bg-surface-2/60 hover:bg-primary/10 border border-surface-3 hover:border-primary/40 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                    >
                      <div>
                        <strong className="font-heading text-sm text-content-1 block">Sessione #{s.number}: {s.title}</strong>
                        <span className="font-mono-tech text-[10px] text-content-3 uppercase">DATA: {s.dateHarptos}</span>
                      </div>
                      <span className="font-mono-tech text-xs text-primary">Leggi Sessione →</span>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* SCREEN 7: D&D CLASS THEME EXPLORATION */}
        {/* ----------------------------------------------------------------------- */}
        {activeScreen === 'themes' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="pb-4 border-b border-surface-3">
              <span className="font-mono-tech text-xs text-primary uppercase tracking-widest block">SISTEMA CROMATICO DI CLASSE</span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-content-1">
                ESPLORAZIONE TEMI D&D (28 VARIANTI)
              </h2>
            </div>

            {/* Theme Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div
                onClick={() => setCurrentTheme('dungeon-master-dark')}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'dungeon-master-dark' ? 'ring-2 ring-primary border-primary bg-surface-1' : 'bg-surface-1 border-surface-3 hover:border-surface-4'
                }`}
              >
                <div className="w-8 h-8 rounded bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-lg mb-3">🐉</div>
                <strong className="font-heading text-base text-content-1 block">Dungeon Master (Dark)</strong>
                <span className="font-mono-tech text-xs text-content-3 block mt-1">Ossidiana & Oro D&D</span>
              </div>

              <div
                onClick={() => setCurrentTheme('dungeon-master-light')}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'dungeon-master-light' ? 'ring-2 ring-primary border-primary bg-surface-1' : 'bg-surface-1 border-surface-3 hover:border-surface-4'
                }`}
              >
                <div className="w-8 h-8 rounded bg-[#B91C1C]/20 border border-[#B91C1C] flex items-center justify-center text-lg mb-3">📜</div>
                <strong className="font-heading text-base text-content-1 block">Dungeon Master (Light)</strong>
                <span className="font-mono-tech text-xs text-content-3 block mt-1">Pergamena & Cremisi</span>
              </div>

              <div
                onClick={() => setCurrentTheme('warlock-dark')}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'warlock-dark' ? 'ring-2 ring-primary border-primary bg-surface-1' : 'bg-surface-1 border-surface-3 hover:border-surface-4'
                }`}
              >
                <div className="w-8 h-8 rounded bg-[#BA78FF]/20 border border-[#BA78FF] flex items-center justify-center text-lg mb-3">🔮</div>
                <strong className="font-heading text-base text-content-1 block">Warlock (Dark)</strong>
                <span className="font-mono-tech text-xs text-content-3 block mt-1">Ossidiana & Neon Eldritch</span>
              </div>

              <div
                onClick={() => setCurrentTheme('paladin-dark')}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'paladin-dark' ? 'ring-2 ring-primary border-primary bg-surface-1' : 'bg-surface-1 border-surface-3 hover:border-surface-4'
                }`}
              >
                <div className="w-8 h-8 rounded bg-[#38BDF8]/20 border border-[#38BDF8] flex items-center justify-center text-lg mb-3">🛡️</div>
                <strong className="font-heading text-base text-content-1 block">Paladin (Dark)</strong>
                <span className="font-mono-tech text-xs text-content-3 block mt-1">Zaffiro & Argento Solare</span>
              </div>

            </div>

            {/* Live Preview Box */}
            <div className="p-6 rounded-xl bg-surface-1 border border-surface-3 space-y-4">
              <span className="font-mono-tech text-xs text-primary uppercase block">ANTEPRIMA DAL VIVO DEL TEMA SELEZIONATO</span>
              <p className="font-serif-reading text-lg text-content-2">
                Come puoi notare, il cambio del tema altera istantaneamente i colori principali, le superfici, le sfumature degli accenti ed i bordi di calibrazione, mantenendo al 100% inalterati il layout, i margini e la leggibilità tipografica.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Footer Status */}
      <footer className="py-4 border-t border-surface-3/50 text-center font-mono-tech text-xs text-content-3">
        CHRONICLE DND DESIGN SANDBOX — STANDALONE PROTOTYPE // ZERO PRODUCTION CODE TOUCHED
      </footer>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
