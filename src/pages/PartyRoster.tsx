import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sliders,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit3,
  Award,
  Scroll,
  FileText,
  RefreshCw,
  Quote,
  BookOpen,
  MessageSquare,
  Users,
  Compass,
  Check,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import {
  PartyCampaignConfig,
  PartyMemberStats,
  PartyBadge,
  CharacterBio,
  Session,
  Note,
  Entity,
} from '../types';

// Preset music stream links
const PRESET_TRACKS = [
  {
    title: 'Inno Trionfale dei Campioni',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c89e248b1d.mp3?filename=epic-hollywood-trailer-9489.mp3',
  },
  {
    title: 'Aria della Taverna & Avventure',
    url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3?filename=epic-heroic-11218.mp3',
  },
  {
    title: 'Marcia della Compagnia',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_249219b12a.mp3?filename=medieval-fantasy-142837.mp3',
  },
];

const PRESET_ROLES = [
  'Guardiano Indomito (Tank)',
  'Lama Tempestosa (DPS Mischia)',
  'Invocatore Arcano (DPS Magico)',
  'Tessitore di Vita (Support/Cure)',
  'Ombra Inafferrabile (Infiltratore)',
  'Mente Stratega (Tattico)',
  'Voce d\'Argento (Diplomazia/Face)',
  'Caotico Gremlin (Imprevedibile)',
  'Custode del Fato (Dungeon Master)',
];

const PRESET_BADGES = [
  { label: 'Sopravvissuto a 1 PF', description: 'Miracolosamente rimasto in piedi contro ogni pronostico' },
  { label: 'Diplomazia Saltata', description: 'Ha fatto fallire il negoziato prima della prima battuta' },
  { label: 'Finanziatore della Locanda', description: 'Più monete spese in pinte che in armature' },
  { label: 'Collezionista di Cose Inutili', description: 'Inventario colmo di pietruzze magiche e cianfrusaglie' },
  { label: 'Colpo di Grazia al Boss', description: 'Ha messo a segno il fendente finale per la gloria' },
  { label: 'Salva-Party dell\'Ultimo Secondo', description: 'Ha evitato il TPK con una mossa disperata' },
];

export function PartyRoster() {
  const { player, allPlayers } = useAuth();
  const navigate = useNavigate();

  // Campaign & Party State
  const activeCode = CampaignManager.getActiveCampaignCode();
  const [partyConfig, setPartyConfig] = useState<PartyCampaignConfig>(() =>
    CampaignManager.getPartyConfig()
  );
  const [attendanceData, setAttendanceData] = useState(() =>
    CampaignManager.getPartyAttendanceStats()
  );
  const [characterBios, setCharacterBios] = useState<Record<string, CharacterBio>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Audio Streaming State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.7);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Presentation Overlay State
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isAutoSlide, setIsAutoSlide] = useState(true);
  const [slideProgress, setSlideProgress] = useState(0);

  // AI Narrative Summaries per Player ID
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});

  // Modals
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Music form temp state
  const [customMusicUrl, setCustomMusicUrl] = useState(partyConfig.themeSongUrl || '');
  const [customMusicTitle, setCustomMusicTitle] = useState(partyConfig.themeSongTitle || '');

  // Hydrate Data
  const loadPartyData = () => {
    const config = CampaignManager.getPartyConfig(activeCode || undefined);
    setPartyConfig(config);
    setCustomMusicUrl(config.themeSongUrl || '');
    setCustomMusicTitle(config.themeSongTitle || '');

    const att = CampaignManager.getPartyAttendanceStats(activeCode || undefined);
    setAttendanceData(att);

    const biosMap: Record<string, CharacterBio> = {};
    (allPlayers || []).forEach((p) => {
      const b = CampaignManager.getCharacterBio(p._id);
      if (b) biosMap[p._id] = b;
    });
    setCharacterBios(biosMap);

    const loadedSessions = CampaignManager.getSessions();
    setSessions(loadedSessions);

    const loadedNotes = CampaignManager.getNotes();
    setNotes(loadedNotes);

    const loadedEntities = CampaignManager.getEntities();
    setEntities(loadedEntities);
  };

  useEffect(() => {
    loadPartyData();

    const handleUpdate = () => loadPartyData();
    window.addEventListener('chronicle_party_config_updated', handleUpdate);
    window.addEventListener('chronicle_campaign_updated', handleUpdate);
    window.addEventListener('chronicle_sessions_updated', handleUpdate);
    window.addEventListener('chronicle_notes_updated', handleUpdate);
    window.addEventListener('chronicle_entities_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_party_config_updated', handleUpdate);
      window.removeEventListener('chronicle_campaign_updated', handleUpdate);
      window.removeEventListener('chronicle_sessions_updated', handleUpdate);
      window.removeEventListener('chronicle_notes_updated', handleUpdate);
      window.removeEventListener('chronicle_entities_updated', handleUpdate);
    };
  }, [activeCode, allPlayers]);

  // Sync Audio Volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isAudioMuted ? 0 : audioVolume;
  }, [audioVolume, isAudioMuted]);

  const toggleAudioPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);

    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      const src = partyConfig.themeSongUrl || PRESET_TRACKS[0].url;
      if (audio.src !== src) {
        audio.src = src;
      }
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.warn('[Bacheca Audio] Errore stream:', err);
          setAudioError('Impossibile avviare il flusso audio. Verifica il link dello stream.');
          setIsPlayingAudio(false);
        });
    }
  };

  // Launch Presentation Ceremony
  const handleLaunchPresentation = () => {
    setActiveHeroIndex(0);
    setIsAutoSlide(true);
    setSlideProgress(0);
    setIsPresentationOpen(true);

    const audio = audioRef.current;
    const streamUrl = partyConfig.themeSongUrl || PRESET_TRACKS[0].url;
    if (audio && streamUrl) {
      if (audio.src !== streamUrl) {
        audio.src = streamUrl;
      }
      audio.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  // Auto-slide sequencer in Presentation
  useEffect(() => {
    if (!isPresentationOpen || !isAutoSlide) return;
    const interval = 100;
    const duration = 8500;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          const total = allPlayers?.length || 1;
          setActiveHeroIndex((c) => (c + 1) % total);
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPresentationOpen, isAutoSlide, allPlayers]);

  // Generate AI Narrative Summary from DB Data
  const handleGenerateAiSummary = async (
    heroId: string,
    heroName: string,
    bio?: CharacterBio,
    stats?: PartyMemberStats,
    att?: any
  ) => {
    setIsGeneratingAi((prev) => ({ ...prev, [heroId]: true }));
    const heroClass = bio?.characterClass || 'Avventuriero';
    const heroRace = bio?.characterRace || 'Eroe';
    const heroTitle = bio?.characterTitle || stats?.titleOrNickname || 'Campione';
    const totalSess = attendanceData.totalSessions || 1;
    const presenzeStr = att ? `${att.attendedCount}/${totalSess}` : 'tutte le';

    // Auto DB Metrics
    const userNotesCount = notes.filter((n) => n.author?.id === heroId || (n as any).authorId === heroId).length;
    const nameLow = heroName.toLowerCase();
    const heroQuotes = sessions
      .flatMap((s) => s.quotes || [])
      .filter(
        (q) =>
          q.speaker.toLowerCase().includes(nameLow) ||
          q.text.toLowerCase().includes(nameLow)
      );

    const prompt = `Sei il Bardo Cronista ufficiale della campagna GDR. Scrivi un epico, avvincente e conciso sunto narrativo (massimo 2-3 frasi) delle gesta finora compiute dal personaggio ${heroName}, ${heroRace} ${heroClass} ${heroTitle ? `(Titolo: "${heroTitle}")` : ''}.
Dati reali estratti dalla campagna:
- Presenze alle sessioni: ${presenzeStr} (${att?.attendanceRate ?? 0}%)
- Diari e note scritti dal personaggio: ${userNotesCount} pagine di cronaca
- Citazioni a verbale registrate: ${heroQuotes.length} perle pronunciate
${stats?.catchphrase ? `Frase celebre: "${stats.catchphrase}"` : ''}

Requisiti: Rispondi in lingua italiana con tono epico ma vivace e coinvolgente. Non includere preamboli o saluti, ma solo il sunto finale delle sue gesta.`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          const generatedText = data.text.trim();
          setAiSummaries((prev) => ({ ...prev, [heroId]: generatedText }));
          CampaignManager.updateMemberPartyStats(
            heroId,
            { notes: generatedText },
            activeCode || undefined
          );
          return;
        }
      }
      // Instant Fallback Chronicle Summary
      const fallbackText = `${heroName}, valoroso ${heroRace} ${heroClass}${heroTitle ? ` noto come "${heroTitle}"` : ''}. Presente in ${presenzeStr} sessioni della campagna, ha contribuito con ${userNotesCount} note di diario e ${heroQuotes.length} citazioni memorabili, scolpendo la propria leggenda nella saga.`;
      setAiSummaries((prev) => ({ ...prev, [heroId]: fallbackText }));
      CampaignManager.updateMemberPartyStats(
        heroId,
        { notes: fallbackText },
        activeCode || undefined
      );
    } catch {
      const fallbackText = `${heroName}, valoroso ${heroRace} ${heroClass}${heroTitle ? ` noto come "${heroTitle}"` : ''}. Presente in ${presenzeStr} sessioni della campagna, ha contribuito con ${userNotesCount} note di diario e ${heroQuotes.length} citazioni memorabili, scolpendo la propria leggenda nella saga.`;
      setAiSummaries((prev) => ({ ...prev, [heroId]: fallbackText }));
      CampaignManager.updateMemberPartyStats(
        heroId,
        { notes: fallbackText },
        activeCode || undefined
      );
    } finally {
      setIsGeneratingAi((prev) => ({ ...prev, [heroId]: false }));
    }
  };

  // Save Audio Config
  const handleSaveAudioConfig = () => {
    const updated: PartyCampaignConfig = {
      ...partyConfig,
      themeSongUrl: customMusicUrl.trim() || undefined,
      themeSongTitle: customMusicTitle.trim() || undefined,
    };
    CampaignManager.savePartyConfig(updated, activeCode || undefined);
    setPartyConfig(updated);
    setIsAudioModalOpen(false);

    if (audioRef.current && customMusicUrl.trim()) {
      audioRef.current.src = customMusicUrl.trim();
      if (isPlayingAudio) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // Current Hero in Fullscreen Presentation
  const presentationHero =
    allPlayers && allPlayers[activeHeroIndex] ? allPlayers[activeHeroIndex] : allPlayers?.[0];
  const presentationBio = presentationHero ? characterBios[presentationHero._id] : null;
  const presentationStats = presentationHero
    ? partyConfig.membersStats?.[presentationHero._id] || { playerId: presentationHero._id }
    : null;
  const presentationAtt = presentationHero ? attendanceData.playersStats[presentationHero._id] : null;

  // Auto DB Computed Metrics for Presentation Hero
  const presentationNotesCount = useMemo(() => {
    if (!presentationHero) return 0;
    return notes.filter(
      (n) => n.author?.id === presentationHero._id || (n as any).authorId === presentationHero._id
    ).length;
  }, [presentationHero, notes]);

  const presentationQuotes = useMemo(() => {
    if (!presentationHero) return [];
    const nameLow = presentationHero.characterName.toLowerCase();
    return sessions
      .flatMap((s) => (s.quotes || []).map((q) => ({ ...q, sessionNumber: s.number })))
      .filter(
        (q) =>
          q.speaker.toLowerCase().includes(nameLow) ||
          q.text.toLowerCase().includes(nameLow)
      );
  }, [presentationHero, sessions]);

  const presentationRelationsCount = useMemo(() => {
    if (!presentationHero) return 0;
    return entities.filter(
      (e) =>
        e.assigneePlayerId === presentationHero._id ||
        (e.aiConfig?.partyRelations && e.aiConfig.partyRelations[presentationHero._id])
    ).length;
  }, [presentationHero, entities]);

  const presentationLoreCount = useMemo(() => {
    if (!presentationBio) return 0;
    const beliefs = presentationBio.evolvingBeliefs?.length || 0;
    const bites = presentationBio.knownLoreBites?.length || 0;
    return beliefs + bites;
  }, [presentationBio]);

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6 w-full pb-28 font-serif select-none text-content-1">
      {/* Background audio stream player */}
      <audio
        ref={audioRef}
        src={partyConfig.themeSongUrl || PRESET_TRACKS[0].url}
        preload="none"
        onEnded={() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }}
      />

      {/* HEADER BAR WITHOUT BOX OR "FACCIA 19" */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-content-1">
          Bacheca degli Eroi
        </h1>

        {/* Audio Stream & Presentation Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Audio Player Pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-2/60 border border-surface-2 rounded-xl text-xs">
            <button
              type="button"
              id="party-audio-toggle-btn"
              onClick={toggleAudioPlay}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isPlayingAudio
                  ? 'bg-primary text-black shadow-xs ring-2 ring-primary/40 animate-pulse font-bold'
                  : 'bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-2'
              }`}
              title={isPlayingAudio ? 'Metti in pausa' : 'Riproduci inno'}
            >
              {isPlayingAudio ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>

            <div className="flex flex-col min-w-[110px] max-w-[150px]">
              <span className="text-xs font-serif font-semibold truncate text-content-1">
                {partyConfig.themeSongTitle || 'Inno del Party'}
              </span>
              <span className="text-[10px] text-content-2 font-mono">
                {isPlayingAudio ? 'In Riproduzione' : 'Musica Silente'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="p-1 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title={isAudioMuted ? 'Riattiva audio' : 'Silenzia'}
            >
              {isAudioMuted || audioVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <button
              type="button"
              id="party-audio-config-btn"
              onClick={() => setIsAudioModalOpen(true)}
              className="p-1 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
              title="Configura Stream Audio"
            >
              <Sliders size={14} />
            </button>
          </div>

          {/* Presentation Button */}
          <button
            type="button"
            id="launch-party-cinematic-btn"
            onClick={handleLaunchPresentation}
            className="flex items-center gap-2 px-4 py-2 bg-surface-1 hover:bg-surface-2 text-content-1 font-heading font-bold text-xs rounded-xl border border-surface-2 shadow-xs transition-all cursor-pointer"
          >
            <Sparkles size={15} className="text-primary" />
            <span>Presentazione</span>
          </button>
        </div>
      </div>

      {audioError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-content-1 text-xs rounded-xl font-serif">
          <span className="flex-1">{audioError}</span>
          <button
            type="button"
            onClick={() => setAudioError(null)}
            className="text-primary hover:text-content-1 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION HEADER                                                 */}
      {/* ============================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-2 pb-2">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="text-lg font-heading font-bold text-content-1 tracking-wide">
              Membri della Compagnia ({allPlayers?.length || 0})
            </h2>
          </div>
        </div>

        {/* 3:4 ASPECT RATIO CARDS GRID (NO FLIP & NO FALLBACK TITLES) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {(allPlayers || []).map((p) => {
            const bio = characterBios[p._id] || p.characterBio || p.bio;
            const mStats = partyConfig.membersStats?.[p._id] || { playerId: p._id };

            const cleanAvatar =
              (!p.isDm && CampaignManager.isDmAvatar(p.avatarUrl) ? '' : CampaignManager.cleanAvatarString(p.avatarUrl)) ||
              CampaignManager.cleanAvatarString(bio?.avatarUrl);

            // DYNAMIC PROFILE DATA FROM CHARACTER BIO & USER PARTY
            const heroClass = bio?.characterClass || (p.isDm ? 'Dungeon Master' : 'Avventuriero');
            const heroTitle = bio?.characterTitle || mStats.titleOrNickname || '';

            return (
              <div
                key={p._id}
                className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-surface-1 border-2 border-surface-2 hover:border-primary/60 shadow-md flex flex-col justify-end p-3.5 transition-colors group"
              >
                {/* Background Full Cover Image Stretched in 3:4 */}
                <div className="absolute inset-0 z-0 overflow-hidden bg-surface-2">
                  {cleanAvatar ? (
                    <img
                      src={cleanAvatar}
                      alt={p.characterName}
                      className="w-full h-full object-cover object-top grayscale contrast-115 transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-heading font-black text-6xl text-content-3 bg-surface-2">
                      {p.characterName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Top & Bottom Vignette Overlays for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                </div>

                {/* Bottom Front Info Overlay with Dynamic Class/Race/Title & Direct Profile Link */}
                <div className="relative z-10 space-y-1.5 text-center">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-primary font-bold block drop-shadow-md truncate">
                    «{(bio?.characterRace ? `${bio.characterRace} • ` : '') + heroClass}»
                  </span>

                  <h3 className="text-xl sm:text-2xl font-heading font-black text-primary tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,1)] uppercase truncate">
                    {p.characterName}
                  </h3>

                  {heroTitle ? (
                    <p className="text-xs font-serif italic text-white/90 drop-shadow-md truncate">
                      {heroTitle}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => navigate(`/character?player=${p._id}`)}
                    className="mt-2 w-full py-2 px-3 rounded-xl bg-primary text-black font-heading font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg hover:brightness-110 transition-all cursor-pointer z-20"
                  >
                    <ExternalLink size={14} />
                    <span>CONSULTA SCHEDA PG</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2-COLUMN DESKTOP PRESENTATION MODAL WITH AUTOMATIC DB METRICS  */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isPresentationOpen && presentationHero && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 overflow-y-auto font-serif"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-4 z-20 max-w-6xl w-full mx-auto">
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-surface-2 text-primary tracking-wider uppercase border border-surface-2">
                  HERO {activeHeroIndex + 1} / {allPlayers?.length || 1}
                </span>
                <span className="text-xs text-content-2 hidden sm:inline font-serif italic">
                  {partyConfig.themeSongTitle || 'Inno della Compagnia'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAutoSlide(!isAutoSlide)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-2 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isAutoSlide ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isAutoSlide ? 'Pausa Auto' : 'Riprendi Auto'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-2 transition-colors cursor-pointer"
                >
                  {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPresentationOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X size={15} />
                  <span>Chiudi</span>
                </button>
              </div>
            </div>

            {/* Timer Progress Bar */}
            {isAutoSlide && (
              <div className="max-w-6xl w-full mx-auto bg-surface-2 h-1 rounded-full overflow-hidden mt-2 mb-2 z-20">
                <div
                  className="bg-primary h-full transition-all duration-100 ease-linear"
                  style={{ width: `${slideProgress}%` }}
                />
              </div>
            )}

            {/* 2-COLUMN DESKTOP PRESENTATION LAYOUT */}
            <div className="flex-1 flex items-center justify-center my-4 z-10 max-w-6xl w-full mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={presentationHero._id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full select-none"
                >
                  {/* LEFT COLUMN (LG:COL-SPAN-5): 3:4 PHOTO CARD & QUICK AUTOMATIC DB STATS */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-surface-1 border-4 border-primary/70 shadow-2xl flex flex-col justify-end p-5 text-content-1">
                      {/* B&W Cover Photo */}
                      <div className="absolute inset-0 z-0 overflow-hidden bg-surface-2">
                        {((!presentationHero.isDm && CampaignManager.isDmAvatar(presentationHero.avatarUrl) ? '' : CampaignManager.cleanAvatarString(presentationHero.avatarUrl)) || CampaignManager.cleanAvatarString(presentationBio?.avatarUrl)) ? (
                          <img
                            src={(!presentationHero.isDm && CampaignManager.isDmAvatar(presentationHero.avatarUrl) ? '' : CampaignManager.cleanAvatarString(presentationHero.avatarUrl)) || CampaignManager.cleanAvatarString(presentationBio?.avatarUrl)}
                            alt=""
                            className="w-full h-full object-cover object-top grayscale contrast-115"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-heading font-black text-6xl text-content-3 bg-surface-2">
                            {presentationHero.characterName.charAt(0)}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />
                      </div>

                      {/* Bottom Character Info */}
                      <div className="relative z-10 text-center space-y-1">
                        <span className="text-xs font-mono tracking-widest uppercase text-primary font-bold block drop-shadow-md truncate">
                          «{(presentationBio?.characterRace ? `${presentationBio.characterRace} • ` : '') + (presentationBio?.characterClass || 'Avventuriero')}»
                        </span>

                        <h3 className="text-2xl sm:text-3xl font-heading font-black text-primary uppercase tracking-wide drop-shadow-md truncate">
                          {presentationHero.characterName}
                        </h3>

                        {(presentationBio?.characterTitle || presentationStats?.titleOrNickname) ? (
                          <p className="text-xs font-serif italic text-white/90 drop-shadow-md truncate">
                            {presentationBio?.characterTitle || presentationStats?.titleOrNickname}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Quick Automatic DB Stats Grid under left column photo */}
                    <div className="w-full max-w-sm grid grid-cols-4 gap-2 text-center text-xs font-mono">
                      <div className="bg-surface-1/90 border border-surface-2 rounded-xl p-2 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-primary uppercase font-bold block">Presenze</span>
                        <span className="font-black text-content-1 text-sm">{presentationAtt?.attendanceRate ?? 0}%</span>
                      </div>
                      <div className="bg-surface-1/90 border border-surface-2 rounded-xl p-2 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-primary uppercase font-bold block">Diari</span>
                        <span className="font-black text-content-1 text-sm">{presentationNotesCount}</span>
                      </div>
                      <div className="bg-surface-1/90 border border-surface-2 rounded-xl p-2 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-primary uppercase font-bold block">Citazioni</span>
                        <span className="font-black text-content-1 text-sm">{presentationQuotes.length}</span>
                      </div>
                      <div className="bg-surface-1/90 border border-surface-2 rounded-xl p-2 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-primary uppercase font-bold block">Sapere</span>
                        <span className="font-black text-content-1 text-sm">{presentationLoreCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN (LG:COL-SPAN-7): RECAP, CHRONICLE SUMMARY & REAL DB STATS */}
                  <div className="lg:col-span-7 bg-surface-1 border-2 border-primary/50 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2 pb-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-primary block">
                          CRONACA DELLE GESTA
                        </span>
                        <h3 className="text-2xl font-heading font-black text-primary uppercase tracking-wide">
                          {presentationHero.characterName}
                        </h3>
                        <p className="text-xs font-serif italic text-content-2">
                          {(presentationBio?.characterRace ? `${presentationBio.characterRace} • ` : '') + (presentationBio?.characterClass || 'Avventuriero')}
                        </p>
                      </div>

                      {/* AI Summary Generator Button */}
                      <button
                        type="button"
                        disabled={isGeneratingAi[presentationHero._id]}
                        onClick={() =>
                          handleGenerateAiSummary(
                            presentationHero._id,
                            presentationHero.characterName,
                            presentationBio || undefined,
                            presentationStats || undefined,
                            presentationAtt
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-primary/15 hover:bg-primary hover:text-black text-primary border border-primary/40 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
                      >
                        {isGeneratingAi[presentationHero._id] ? (
                          <RefreshCw size={14} className="animate-spin text-primary" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>
                          {isGeneratingAi[presentationHero._id] ? 'Generazione IA...' : '✨ Genera Sunto con IA'}
                        </span>
                      </button>
                    </div>

                    {/* Narrative Summary Box */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono font-bold text-primary">
                        <span>SUNTO FINORA DEL PERSONAGGIO</span>
                        <span className="text-[10px] text-content-3 font-serif italic">
                          (Generabile con IA o dal profilo)
                        </span>
                      </div>

                      <div className="relative rounded-xl bg-surface-2/80 border border-surface-2 p-4 font-serif text-sm italic text-content-1 leading-relaxed shadow-inner">
                        «
                        {aiSummaries[presentationHero._id] ||
                          presentationStats?.notes ||
                          presentationBio?.bio ||
                          presentationBio?.backstoryMarkdown ||
                          `${presentationHero.characterName} ha preso parte attivamente alle avventure della saga, lasciando il proprio segno indelebile in ogni sessione e combattimento.`}
                        »
                      </div>
                    </div>

                    {/* Citazioni Celebri (Real Session Quotes from DB) */}
                    {presentationQuotes.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-surface-2/60">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <Quote size={13} />
                          Citazioni celebri nelle sessioni ({presentationQuotes.length})
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                          {presentationQuotes.slice(0, 4).map((q, idx) => (
                            <div
                              key={idx}
                              className="text-xs font-serif italic text-content-1 bg-surface-2/50 border border-surface-2 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2"
                            >
                              <span className="truncate">"{q.text}"</span>
                              <span className="text-[10px] font-mono text-primary font-bold shrink-0">
                                Sess. {q.sessionNumber}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Automatic Real DB Metrics Highlights Grid */}
                    <div className="space-y-2 pt-1 border-t border-surface-2/60">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary block">
                        Statistiche Automatiche dal Database
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block flex items-center gap-1">
                            <Scroll size={12} />
                            Presenze
                          </span>
                          <span className="text-base font-black text-content-1 mt-1">
                            {presentationAtt?.attendedCount || 0}/{attendanceData.totalSessions} ({presentationAtt?.attendanceRate ?? 0}%)
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block flex items-center gap-1">
                            <BookOpen size={12} />
                            Diari & Note
                          </span>
                          <span className="text-base font-black text-content-1 mt-1">
                            {presentationNotesCount} scritti
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block flex items-center gap-1">
                            <MessageSquare size={12} />
                            Citazioni
                          </span>
                          <span className="text-base font-black text-content-1 mt-1">
                            {presentationQuotes.length} a verbale
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block flex items-center gap-1">
                            <Users size={12} />
                            Legami PNG
                          </span>
                          <span className="text-base font-black text-content-1 mt-1">
                            {presentationRelationsCount} relazioni
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block flex items-center gap-1">
                            <Compass size={12} />
                            Sapere & Verità
                          </span>
                          <span className="text-base font-black text-content-1 mt-1">
                            {presentationLoreCount} nozioni
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-2 flex flex-col justify-between">
                          <span className="text-[10px] text-primary uppercase font-bold block">Classe & Ruolo</span>
                          <span className="text-xs font-bold text-content-1 truncate block mt-1">
                            {presentationBio?.characterClass || (presentationHero.isDm ? 'Dungeon Master' : 'Avventuriero')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Unlocked Badges */}
                    {presentationStats?.customBadges && presentationStats.customBadges.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary block">
                          Distintivi & Riconoscimenti
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {presentationStats.customBadges.map((b) => (
                            <span
                              key={b.id}
                              className="px-2.5 py-1 rounded-lg bg-surface-2 border border-primary/30 text-xs font-serif text-content-1 flex items-center gap-1.5"
                            >
                              <Award size={12} className="text-primary" />
                              <span>{b.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button: Jump to Character Profile */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPresentationOpen(false);
                          navigate(`/character?player=${presentationHero._id}`);
                        }}
                        className="w-full py-2.5 rounded-xl bg-primary text-black font-heading font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition-all cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        <span>Consulta Scheda Completa PG</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between gap-4 z-20 max-w-6xl w-full mx-auto">
              <button
                type="button"
                onClick={() => {
                  const total = allPlayers?.length || 1;
                  setActiveHeroIndex((c) => (c - 1 + total) % total);
                  setSlideProgress(0);
                }}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft size={16} />
                <span>Precedente</span>
              </button>

              <div className="flex items-center gap-1.5">
                {(allPlayers || []).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveHeroIndex(idx);
                      setSlideProgress(0);
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activeHeroIndex
                        ? 'w-6 bg-primary'
                        : 'w-2 bg-surface-2 hover:bg-surface-3'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const total = allPlayers?.length || 1;
                  setActiveHeroIndex((c) => (c + 1) % total);
                  setSlideProgress(0);
                }}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Successivo</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT MEMBER STATS & TITLES MODAL */}
      <AnimatePresence>
        {editingMemberId && (
          <EditMemberStatsModal
            playerId={editingMemberId}
            onClose={() => setEditingMemberId(null)}
          />
        )}
      </AnimatePresence>

      {/* AUDIO STREAM CONFIG MODAL */}
      <AnimatePresence>
        {isAudioModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-serif"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-surface-1 border-2 border-surface-2 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-content-1"
            >
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="text-lg font-heading font-bold text-content-1 flex items-center gap-2">
                  <Sliders size={18} className="text-primary" />
                  <span>Configura Stream Audio</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAudioModalOpen(false)}
                  className="p-1 text-content-2 hover:text-content-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-mono font-bold text-primary mb-1 uppercase">
                    Seleziona Presets Audio
                  </label>
                  <div className="space-y-1.5">
                    {PRESET_TRACKS.map((track, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCustomMusicUrl(track.url);
                          setCustomMusicTitle(track.title);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          customMusicUrl === track.url
                            ? 'bg-primary/15 border-primary text-primary font-bold'
                            : 'bg-surface-2/60 border-surface-2 text-content-1 hover:bg-surface-2'
                        }`}
                      >
                        <span className="truncate">{track.title}</span>
                        {customMusicUrl === track.url && <Check size={14} className="text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono font-bold text-primary mb-1 uppercase">
                    Titolo del Brano / Inno
                  </label>
                  <input
                    type="text"
                    value={customMusicTitle}
                    onChange={(e) => setCustomMusicTitle(e.target.value)}
                    placeholder="es. Marcia Trionfale del Party"
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 text-content-1 focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div>
                  <label className="block font-mono font-bold text-primary mb-1 uppercase">
                    Link Stream Audio (URL MP3 / Web Audio Stream)
                  </label>
                  <input
                    type="url"
                    value={customMusicUrl}
                    onChange={(e) => setCustomMusicUrl(e.target.value)}
                    placeholder="https://.../audio.mp3"
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 text-content-1 focus:outline-none focus:border-primary text-xs font-mono"
                  />
                  <p className="text-[10px] text-content-3 mt-1 italic">
                    Nessun caricamento di file sul server: solo riproduzione tramite flusso stream da link.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setIsAudioModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-mono cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveAudioConfig}
                  className="px-4 py-2 rounded-xl bg-primary text-black font-heading font-bold text-xs shadow-md hover:brightness-110 cursor-pointer"
                >
                  Salva Modifiche
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent: Modal to Edit Character Titles & Badges
function EditMemberStatsModal({
  playerId,
  onClose,
}: {
  playerId: string;
  onClose: () => void;
}) {
  const activeCode = CampaignManager.getActiveCampaignCode();
  const partyConfig = CampaignManager.getPartyConfig(activeCode || undefined);
  const curStats = partyConfig.membersStats?.[playerId] || { playerId };

  const { allPlayers } = useAuth();
  const targetPlayer = allPlayers?.find((p) => p._id === playerId);
  const bio = CampaignManager.getCharacterBio(playerId);

  const [titleOrNickname, setTitleOrNickname] = useState(
    curStats.titleOrNickname || bio?.characterTitle || ''
  );
  const [roleInParty, setRoleInParty] = useState(
    curStats.roleInParty || bio?.characterClass || ''
  );
  const [catchphrase, setCatchphrase] = useState(curStats.catchphrase || '');
  const [notes, setNotes] = useState(curStats.notes || '');

  const [customBadges, setCustomBadges] = useState<PartyBadge[]>(
    curStats.customBadges || []
  );
  const [newBadgeLabel, setNewBadgeLabel] = useState('');

  const handleSave = () => {
    const updates: Partial<PartyMemberStats> = {
      titleOrNickname: titleOrNickname.trim(),
      roleInParty: roleInParty.trim(),
      catchphrase: catchphrase.trim(),
      notes: notes.trim(),
      customBadges,
    };

    CampaignManager.updateMemberPartyStats(playerId, updates, activeCode || undefined);
    onClose();
  };

  const handleAddBadge = (label: string) => {
    if (!label.trim()) return;
    const badge: PartyBadge = {
      id: `badge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: label.trim(),
    };
    setCustomBadges((prev) => [...prev, badge]);
    setNewBadgeLabel('');
  };

  const handleRemoveBadge = (id: string) => {
    setCustomBadges((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-serif"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-surface-1 border-2 border-surface-2 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-content-1 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between border-b border-surface-2 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-primary block">
              MODIFICA SCHEDA BACHECA
            </span>
            <h3 className="text-xl font-heading font-black text-primary uppercase">
              {targetPlayer?.characterName || 'Eroe'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-content-2 hover:text-content-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-mono font-bold text-primary mb-1 uppercase">
              Titolo Epico / Soprannome
            </label>
            <input
              type="text"
              value={titleOrNickname}
              onChange={(e) => setTitleOrNickname(e.target.value)}
              placeholder="es. Il Distruttore di Draghi"
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 text-content-1 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          <div>
            <label className="block font-mono font-bold text-primary mb-1 uppercase">
              Ruolo o Archetipo nel Party
            </label>
            <input
              type="text"
              value={roleInParty}
              onChange={(e) => setRoleInParty(e.target.value)}
              placeholder="es. Guardiano Indomito (Tank)"
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 text-content-1 focus:outline-none focus:border-primary text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {PRESET_ROLES.slice(0, 4).map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRoleInParty(r)}
                  className="px-2 py-0.5 rounded-md bg-surface-2 text-[10px] text-content-2 hover:text-primary transition-colors cursor-pointer"
                >
                  + {r.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono font-bold text-primary mb-1 uppercase">
              Frase Celebre / Motto
            </label>
            <input
              type="text"
              value={catchphrase}
              onChange={(e) => setCatchphrase(e.target.value)}
              placeholder='es. "Prima colpisco, poi faccio le domande!"'
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 text-content-1 focus:outline-none focus:border-primary text-xs italic"
            />
          </div>

          {/* Badges Section */}
          <div className="space-y-2 pt-2 border-t border-surface-2">
            <label className="block font-mono font-bold text-primary uppercase">
              Distintivi Riconosciuti
            </label>
            <div className="flex flex-wrap gap-1.5">
              {customBadges.map((b) => (
                <span
                  key={b.id}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 border border-primary/30 text-xs text-content-1 flex items-center gap-1.5"
                >
                  <Award size={12} className="text-primary" />
                  <span>{b.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBadge(b.id)}
                    className="text-content-3 hover:text-rose-400 cursor-pointer ml-1"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newBadgeLabel}
                onChange={(e) => setNewBadgeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBadge(newBadgeLabel);
                  }
                }}
                placeholder="Aggiungi nuovo distintivo..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-surface-2 border border-surface-2 text-content-1 text-xs focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => handleAddBadge(newBadgeLabel)}
                className="px-3 py-1.5 bg-primary text-black font-bold text-xs rounded-xl cursor-pointer hover:brightness-110"
              >
                + Aggiungi
              </button>
            </div>

            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_BADGES.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddBadge(b.label)}
                  className="px-2 py-0.5 rounded-md bg-surface-2/60 hover:bg-surface-2 text-[10px] text-content-2 transition-colors cursor-pointer"
                >
                  + {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-mono cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-primary text-black font-heading font-bold text-xs shadow-md hover:brightness-110 cursor-pointer"
          >
            Salva Dati Eroe
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
