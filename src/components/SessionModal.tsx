import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Scroll,
  Calendar,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  FolderPlus,
  Trash2,
  Check,
  MapPin,
  Clock,
  ShieldAlert,
  Layers,
  BookOpen,
  Map as MapIcon,
  Compass,
  Image as ImageIcon,
  Search,
  Plus,
  Users,
} from 'lucide-react';
import { Session, SessionEvent, CampaignChapter, WorldMap, Entity, Player } from '../types';
import { MentionInput, MentionTextarea } from './MentionInput';
import { LoreDatePicker } from './LoreDatePicker';
import { LoreDateInput } from './LoreDateInput';
import { useAuth } from './AuthProvider';
import { ImageGalleryUploader } from './ImageGalleryUploader';
import { OcrButton } from './OcrButton';
import { EntityExtractionModal } from './EntityExtractionModal';
import { CampaignManager } from '../store/campaignStore';
import { Portal } from './Portal';
import features from '../config/features.json';
import { extractTextFromContent } from '../lib/sanitize';

interface SessionModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialSession?: Session | null;
  existingSessions: Session[];
  chapters: CampaignChapter[];
  onClose: () => void;
  onSave: (sessionPayload: {
    number: number;
    title: string;
    sessionType: 'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed';
    chapterId?: string;
    chapterName?: string;
    date: string;
    loreDate?: string;
    loreMeta?: {
      startDay: number;
      endDay?: number;
      month: string;
      endMonth?: string;
      year: number;
      endYear?: number;
    };
    recapText: string;
    sessionImages: string[];
    eventsList: Omit<SessionEvent, 'id'>[];
    excludedPlayerIds?: string[];
    attendeePlayerIds?: string[];
    attendees?: Player[];
    entitiesExtracted?: boolean;
    entitiesExtractedAt?: string;
    memorySynced?: boolean;
    memorySyncedAt?: string;
  }) => void;
}

type ModalStep = 'details' | 'recap' | 'events_maps';

export function SessionModal({
  isOpen,
  isEditing,
  initialSession,
  existingSessions,
  chapters,
  onClose,
  onSave,
}: SessionModalProps) {
  const [activeStep, setActiveStep] = useState<ModalStep>('details');

  // Form State
  const [number, setNumber] = useState(1);
  const [numberInput, setNumberInput] = useState('1');
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<
    'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed'
  >('mixed');
  const [chapterId, setChapterId] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [isAddingNewChapterInline, setIsAddingNewChapterInline] = useState(false);
  const [inlineNewChapterName, setInlineNewChapterName] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loreDate, setLoreDate] = useState('');
  const [loreMeta, setLoreMeta] = useState<
    | {
        startDay: number;
        endDay?: number;
        month: string;
        endMonth?: string;
        year: number;
        endYear?: number;
      }
    | undefined
  >();
  const [recapText, setRecapText] = useState('');
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const [eventsList, setEventsList] = useState<Omit<SessionEvent, 'id'>[]>([]);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [hasExtractedEntities, setHasExtractedEntities] = useState(false);
  const [hasExtractedEntitiesAt, setHasExtractedEntitiesAt] = useState<string | undefined>(undefined);
  const [isMemorySynced, setIsMemorySynced] = useState(false);
  const [isMemorySyncedAt, setIsMemorySyncedAt] = useState<string | undefined>(undefined);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<string[]>([]);

  // Media Picker (from Campaign Maps & Codex Places)
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'maps' | 'places'>('maps');
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

  // Temp inline event input
  const [tempEventTitle, setTempEventTitle] = useState('');
  const [tempEventDesc, setTempEventDesc] = useState('');
  const [tempEventLoreDate, setTempEventLoreDate] = useState('');
  const [tempEventLocation, setTempEventLocation] = useState('');
  const [tempEventImpact, setTempEventImpact] = useState<'major' | 'normal' | 'secret'>('normal');
  const [tempEventType, setTempEventType] = useState<
    'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed'
  >('mixed');
  const [tempEventImages, setTempEventImages] = useState<string[]>([]);

  // Location suggestions popover
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const { player } = useAuth();
  
  // Campaign Maps & Entities
  const worldMaps = useMemo(() => CampaignManager.getMaps(), [isOpen]);
  const isDmPlayer = CampaignManager.isDmPlayerCampaign();
  const campaignPartyPlayers = useMemo(() => {
    const all = CampaignManager.getStoredPlayers();
    return all.filter((p) => !p.isDm || isDmPlayer);
  }, [isOpen, isDmPlayer]);
  const allEntities = useMemo(() => {
    return CampaignManager.getEntities().filter((e) => {
      if (e.type === 'quest' && e.questScope === 'personal' && e.assigneePlayerId !== player?._id && !player?.isDm) {
        return false;
      }
      return true;
    });
  }, [isOpen, player]);
  const placeEntities = useMemo(
    () => allEntities.filter((e) => e.type === 'place'),
    [allEntities]
  );
  const entitiesWithImages = useMemo(
    () => allEntities.filter((e) => e.images && e.images.length > 0),
    [allEntities]
  );

  // Filtered maps for the picker
  const filteredWorldMaps = useMemo(() => {
    if (!mediaSearchQuery.trim()) return worldMaps;
    const q = mediaSearchQuery.toLowerCase();
    return worldMaps.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [worldMaps, mediaSearchQuery]);

  // Filtered places/entities for the picker
  const filteredPlaceEntities = useMemo(() => {
    const list = entitiesWithImages;
    if (!mediaSearchQuery.trim()) return list;
    const q = mediaSearchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        e.type.toLowerCase().includes(q)
    );
  }, [entitiesWithImages, mediaSearchQuery]);

  // Media Picker Pagination (safe rendering for 1000+ codex/map items)
  const [mediaPage, setMediaPage] = useState(1);
  const mediaPageSize = 8;

  useEffect(() => {
    setMediaPage(1);
  }, [mediaPickerTab, mediaSearchQuery]);

  const activeMediaTotal = mediaPickerTab === 'maps' ? filteredWorldMaps.length : filteredPlaceEntities.length;
  const totalMediaPages = Math.max(1, Math.ceil(activeMediaTotal / mediaPageSize));

  const paginatedWorldMaps = useMemo(() => {
    const start = (mediaPage - 1) * mediaPageSize;
    return filteredWorldMaps.slice(start, start + mediaPageSize);
  }, [filteredWorldMaps, mediaPage, mediaPageSize]);

  const paginatedPlaceEntities = useMemo(() => {
    const start = (mediaPage - 1) * mediaPageSize;
    return filteredPlaceEntities.slice(start, start + mediaPageSize);
  }, [filteredPlaceEntities, mediaPage, mediaPageSize]);

  // Location suggestions for the Snodo location field
  const locationSuggestions = useMemo(() => {
    const query = tempEventLocation.toLowerCase().trim();
    // Unique list of places and map pin locations
    const names = new Set<string>();
    const results: { name: string; type: string; imageUrl?: string }[] = [];

    placeEntities.forEach((p) => {
      if (!names.has(p.name.toLowerCase())) {
        names.add(p.name.toLowerCase());
        results.push({
          name: p.name,
          type: 'Luogo Codex',
          imageUrl: p.images?.[0],
        });
      }
    });

    worldMaps.forEach((m) => {
      if (!names.has(m.title.toLowerCase())) {
        names.add(m.title.toLowerCase());
        results.push({
          name: m.title,
          type: 'Mappa del Mondo',
          imageUrl: m.imageUrl,
        });
      }
      m.pins?.forEach((pin) => {
        if (pin.title && !names.has(pin.title.toLowerCase())) {
          names.add(pin.title.toLowerCase());
          results.push({
            name: pin.title,
            type: `Punto su ${m.title}`,
          });
        }
      });
    });

    if (!query) return results.slice(0, 10);
    return results.filter((r) => r.name.toLowerCase().includes(query)).slice(0, 8);
  }, [tempEventLocation, placeEntities, worldMaps]);

  // Check if selected temp location has an image available
  const selectedLocationImageMatch = useMemo(() => {
    if (!tempEventLocation.trim()) return null;
    const clean = tempEventLocation.toLowerCase().trim();
    const foundPlace = placeEntities.find(
      (p) => p.name.toLowerCase().trim() === clean && p.images && p.images.length > 0
    );
    if (foundPlace && foundPlace.images?.[0]) {
      return {
        name: foundPlace.name,
        imageUrl: foundPlace.images[0],
        isAlreadyAttached: sessionImages.includes(foundPlace.images[0]),
      };
    }
    const foundMap = worldMaps.find(
      (m) => m.title.toLowerCase().trim() === clean && m.imageUrl
    );
    if (foundMap && foundMap.imageUrl) {
      return {
        name: foundMap.title,
        imageUrl: foundMap.imageUrl,
        isAlreadyAttached: sessionImages.includes(foundMap.imageUrl),
      };
    }
    return null;
  }, [tempEventLocation, placeEntities, worldMaps, sessionImages]);

  useEffect(() => {
    if (!isOpen) return;

    setActiveStep('details');
    setIsMediaPickerOpen(false);
    setShowLocationDropdown(false);

    if (isEditing && initialSession) {
      setNumber(initialSession.number);
      setNumberInput(String(initialSession.number));
      setTitle(initialSession.title);
      setSessionType(initialSession.sessionType || 'mixed');
      setChapterId(initialSession.chapterId || '');
      setChapterName(initialSession.chapterName || '');
      setIsAddingNewChapterInline(false);
      setInlineNewChapterName('');
      setDate(initialSession.date || new Date().toISOString().split('T')[0]);
      const loadedLoreDate = initialSession.loreDate || '';
      setLoreDate(loadedLoreDate);
      setTempEventLoreDate(loadedLoreDate);
      if (initialSession.loreMonth && initialSession.loreStartDay !== undefined) {
        setLoreMeta({
          startDay: initialSession.loreStartDay,
          endDay: initialSession.loreEndDay,
          month: initialSession.loreMonth,
          endMonth: initialSession.loreEndMonth,
          year: initialSession.loreYear || 1492,
          endYear: initialSession.loreEndYear,
        });
      } else {
        setLoreMeta(undefined);
      }
      setRecapText(extractTextFromContent(initialSession.recap));
      setSessionImages(initialSession.images || []);
      setEventsList(initialSession.events ? initialSession.events.map(({ id, ...rest }) => rest) : []);
      setHasExtractedEntities(Boolean(initialSession.entitiesExtracted));
      setHasExtractedEntitiesAt(initialSession.entitiesExtractedAt);
      setIsMemorySynced(Boolean(initialSession.memorySynced));
      setIsMemorySyncedAt(initialSession.memorySyncedAt);

      // Initialize excludedPlayerIds
      let initialExcluded = initialSession.excludedPlayerIds;
      if (!Array.isArray(initialExcluded) && Array.isArray(initialSession.attendeePlayerIds) && initialSession.attendeePlayerIds.length > 0) {
        const attendeeIds = new Set(initialSession.attendeePlayerIds);
        initialExcluded = campaignPartyPlayers.filter((p) => !attendeeIds.has(p._id)).map((p) => p._id);
      } else if (!Array.isArray(initialExcluded) && Array.isArray(initialSession.attendees) && initialSession.attendees.length > 0) {
        const attendeeIds = new Set(initialSession.attendees.map((a) => a._id));
        initialExcluded = campaignPartyPlayers.filter((p) => !attendeeIds.has(p._id)).map((p) => p._id);
      }
      setExcludedPlayerIds(Array.isArray(initialExcluded) ? [...initialExcluded] : []);
    } else {
      const nextNum =
        existingSessions.length > 0 ? Math.max(...existingSessions.map((s) => s.number)) + 1 : 1;
      const cal = CampaignManager.getCalendar();
      const curMonth = cal.months[cal.currentMonthIndex] || cal.months[0];
      const initialDay = cal.currentDay || 15;
      const initialYear = cal.currentYear || 1492;
      const initialFormatted = `Giorno ${initialDay} di ${curMonth.name}, ${initialYear} ${
        cal.yearSuffix || 'CV'
      }`;

      setNumber(nextNum);
      setNumberInput(String(nextNum));
      setTitle('');
      setSessionType('mixed');
      const defaultChap = chapters[0];
      setChapterId(defaultChap?.id || '');
      setChapterName(defaultChap?.name || '');
      setIsAddingNewChapterInline(false);
      setInlineNewChapterName('');
      setExcludedPlayerIds([]);
      setDate(new Date().toISOString().split('T')[0]);
      setLoreDate(initialFormatted);
      setHasExtractedEntities(false);
      setHasExtractedEntitiesAt(undefined);
      setIsMemorySynced(false);
      setIsMemorySyncedAt(undefined);
      setTempEventLoreDate(initialFormatted);
      setLoreMeta({
        startDay: initialDay,
        month: curMonth.name,
        year: initialYear,
      });
      setRecapText('');
      setSessionImages([]);
      setEventsList([]);
    }
  }, [isOpen, isEditing, initialSession]);

  if (!isOpen) return null;

  const handleToggleImage = (imageUrl: string) => {
    if (!imageUrl) return;
    if (sessionImages.includes(imageUrl)) {
      setSessionImages(sessionImages.filter((img) => img !== imageUrl));
    } else {
      setSessionImages([...sessionImages, imageUrl]);
    }
  };

  const handleAddEvent = () => {
    if (!tempEventTitle.trim()) return;
    setEventsList([
      ...eventsList,
      {
        title: tempEventTitle.trim(),
        description: tempEventDesc.trim(),
        loreDate: (tempEventLoreDate.trim() || loreDate.trim()) || undefined,
        location: tempEventLocation.trim() || undefined,
        impact: tempEventImpact,
        eventType: tempEventType,
        images: tempEventImages,
      },
    ]);
    setTempEventTitle('');
    setTempEventDesc('');
    setTempEventLoreDate(loreDate);
    setTempEventLocation('');
    setTempEventImpact('normal');
    setTempEventType('mixed');
    setTempEventImages([]);
    setShowLocationDropdown(false);
  };

  const handleRemoveEvent = (indexToRemove: number) => {
    setEventsList(eventsList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalChapterId = chapterId;
    let finalChapterName = chapterName;

    if (isAddingNewChapterInline && inlineNewChapterName.trim()) {
      const created = CampaignManager.addChapter({
        name: inlineNewChapterName.trim(),
        color: '#818cf8',
      });
      finalChapterId = created.id;
      finalChapterName = created.name;
    }

    const presentPlayers = campaignPartyPlayers.filter((p) => !excludedPlayerIds.includes(p._id));
    const attendeeIds = presentPlayers.map((p) => p._id);

    onSave({
      number,
      title: title.trim(),
      sessionType,
      chapterId: finalChapterId || undefined,
      chapterName: finalChapterName || undefined,
      date,
      loreDate: loreDate.trim() || undefined,
      loreMeta,
      recapText,
      sessionImages,
      eventsList,
      excludedPlayerIds,
      attendeePlayerIds: attendeeIds,
      attendees: presentPlayers,
      entitiesExtracted: hasExtractedEntities,
      entitiesExtractedAt: hasExtractedEntitiesAt,
      memorySynced: isMemorySynced,
      memorySyncedAt: isMemorySyncedAt,
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-fade-in">
        <div className="relative w-full max-w-4xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] overflow-hidden my-auto text-content-1 shrink-0">
          {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-2 bg-surface-1 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Scroll size={20} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-base sm:text-lg text-content-1">
                {isEditing ? `Modifica Sessione #${number}` : 'Nuova Cronaca di Sessione'}
              </h3>
              <p className="text-xs text-content-3">
                {isEditing
                  ? 'Aggiorna i dettagli, il diario narrativo e gli snodi di trama.'
                  : 'Compila i 3 passaggi guidati per registrare la sessione nel tomo.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Guided Step Bar */}
        <div className="grid grid-cols-3 border-b border-surface-2 bg-surface-0/50 text-xs shrink-0">
          {/* Step 1 Tab */}
          <button
            type="button"
            onClick={() => setActiveStep('details')}
            className={`flex items-center justify-center gap-2 py-3 px-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeStep === 'details'
                ? 'border-primary text-primary bg-primary/5 font-semibold'
                : 'border-transparent text-content-3 hover:text-content-2 hover:bg-surface-1/50'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                activeStep === 'details' ? 'bg-primary text-surface-0 font-bold' : 'bg-surface-3 text-content-3'
              }`}
            >
              1
            </div>
            <span className="truncate">1. Dettagli &amp; Date</span>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            onClick={() => setActiveStep('recap')}
            className={`flex items-center justify-center gap-2 py-3 px-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeStep === 'recap'
                ? 'border-primary text-primary bg-primary/5 font-semibold'
                : 'border-transparent text-content-3 hover:text-content-2 hover:bg-surface-1/50'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                activeStep === 'recap' ? 'bg-primary text-surface-0 font-bold' : 'bg-surface-3 text-content-3'
              }`}
            >
              2
            </div>
            <span className="truncate">2. Cronaca &amp; Diario</span>
            {recapText.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => setActiveStep('events_maps')}
            className={`flex items-center justify-center gap-2 py-3 px-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeStep === 'events_maps'
                ? 'border-primary text-primary bg-primary/5 font-semibold'
                : 'border-transparent text-content-3 hover:text-content-2 hover:bg-surface-1/50'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                activeStep === 'events_maps'
                  ? 'bg-primary text-surface-0 font-bold'
                  : 'bg-surface-3 text-content-3'
              }`}
            >
              3
            </div>
            <span className="truncate">3. Snodi &amp; Mappe</span>
            {(eventsList.length > 0 || sessionImages.length > 0) && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-mono font-bold">
                {eventsList.length + sessionImages.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-xs">
            {/* STEP 1: DETTAGLI & DATE */}
            {activeStep === 'details' && (
              <div className="space-y-4">
                <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    Intestazione &amp; Classificazione
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                    <div className="sm:col-span-1">
                      <label className="block font-medium text-content-2 mb-1">
                        Numero Sessione
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={numberInput}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          setNumberInput(e.target.value);
                          const parsed = parseInt(e.target.value, 10);
                          if (!isNaN(parsed) && parsed >= 1) {
                            setNumber(parsed);
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseInt(numberInput, 10);
                          if (isNaN(parsed) || parsed < 1) {
                            setNumber(1);
                            setNumberInput('1');
                          } else {
                            setNumber(parsed);
                            setNumberInput(String(parsed));
                          }
                        }}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 font-mono outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-medium text-content-2 mb-1">
                        Titolo Narrativo della Sessione <span className="text-primary">*</span>
                      </label>
                      <MentionInput
                        placeholder="Es. Le Cripte di Shadowfell, La Congiura dei Nobili..."
                        value={title}
                        onValueChange={setTitle}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="block font-medium text-content-2 mb-1">
                        Tipologia di Sessione
                      </label>
                      <select
                        value={sessionType}
                        onChange={(e) => setSessionType(e.target.value as any)}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none cursor-pointer"
                      >
                        <option value="mixed">Mista (Narrativa &amp; Azione)</option>
                        <option value="roleplay">Gioco di Ruolo &amp; Diplomazia</option>
                        <option value="combat">Combattimento &amp; Scontro</option>
                        <option value="exploration">Esplorazione &amp; Viaggio</option>
                        <option value="investigation">Investigazione &amp; Mistero</option>
                        <option value="lore">Lore &amp; Rivelazioni di Trama</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-medium text-content-2">
                          Capitolo / Arco Narrativo
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingNewChapterInline(!isAddingNewChapterInline)}
                          className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FolderPlus size={12} />
                          <span>{isAddingNewChapterInline ? 'Seleziona da lista' : '+ Nuovo Capitolo'}</span>
                        </button>
                      </div>

                      {isAddingNewChapterInline ? (
                        <input
                          type="text"
                          placeholder="Nome del nuovo capitolo..."
                          value={inlineNewChapterName}
                          onChange={(e) => setInlineNewChapterName(e.target.value)}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                        />
                      ) : (
                        <select
                          value={chapterId}
                          onChange={(e) => {
                            setChapterId(e.target.value);
                            const ch = chapters.find((c) => c.id === e.target.value);
                            setChapterName(ch?.name || '');
                          }}
                          className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none cursor-pointer"
                        >
                          <option value="">Nessun capitolo assegnato</option>
                          {chapters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unified Chronology / Dates Block */}
                <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-primary" />
                    Cronologia &amp; Date
                  </h4>

                  <div className="space-y-4">
                    {/* Real World Date */}
                    <div>
                      <label className="block font-medium text-content-2 mb-1">
                        Data Reale di Gioco (Al Tavolo)
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full sm:w-1/2 bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none font-mono"
                      />
                      <p className="text-[11px] text-content-3 mt-1">
                        La data del calendario reale in cui vi siete riuniti per giocare.
                      </p>
                    </div>

                    {/* In-Game Lore Date */}
                    <div className="pt-3 border-t border-surface-3/60">
                      <LoreDatePicker
                        label="Data nel Mondo di Gioco (Calendario Lore)"
                        hint="Specifica il giorno, mese e anno vissuti dai personaggi (Calendario di Faerûn / Harptos)."
                        value={loreDate}
                        initialMeta={loreMeta}
                        onChange={(formatted, meta) => {
                          setLoreDate(formatted);
                          setLoreMeta(meta);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Party Presence & Player Exclusion Block */}
                {campaignPartyPlayers.length > 0 && (
                  <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} className="text-primary" />
                        Presenza Personaggi del Party (PG)
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExcludedPlayerIds([])}
                          className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                        >
                          Tutti Presenti
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-content-3">
                      Seleziona i personaggi che hanno preso parte a questa sessione. Se un PG si è unito alla campagna in seguito (es. dopo 20 sessioni) o era assente, deselezionalo per escluderlo dai ricordi di questi eventi.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {campaignPartyPlayers.map((p) => {
                        const isExcluded = excludedPlayerIds.includes(p._id);
                        return (
                          <div
                            key={p._id}
                            onClick={() => {
                              setExcludedPlayerIds((prev) =>
                                isExcluded ? prev.filter((id) => id !== p._id) : [...prev, p._id]
                              );
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isExcluded
                                ? 'bg-surface-1/40 border-surface-3/50 text-content-3/70 opacity-65'
                                : 'bg-surface-1 border-primary/40 text-content-1 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold overflow-hidden shrink-0 border border-surface-3"
                                style={{ backgroundColor: p.color || '#6366f1' }}
                              >
                                {p.avatarUrl && p.avatarUrl.trim() ? (
                                  <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  p.characterName?.charAt(0).toUpperCase() || 'P'
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-semibold text-xs truncate block ${isExcluded ? 'line-through text-content-3' : 'text-content-1'}`}>
                                    {p.characterName}
                                  </span>
                                  {p.isDm && (
                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      [DM / Giocatore]
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-content-3">
                                  {isExcluded ? '🚫 Non presente (Escluso)' : '✅ Presente / Partecipe'}
                                </span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={(e) => {
                                const shouldBeExcluded = !e.target.checked;
                                setExcludedPlayerIds((prev) =>
                                  shouldBeExcluded
                                    ? [...prev.filter((id) => id !== p._id), p._id]
                                    : prev.filter((id) => id !== p._id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="accent-primary rounded cursor-pointer w-4 h-4"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: CRONACA & DIARIO */}
            {activeStep === 'recap' && (
              <div className="space-y-3">
                <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-3/60 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                        <Scroll size={14} className="text-primary" />
                        Resoconto Narrativo della Cronaca
                      </h4>
                      <p className="text-xs text-content-3 mt-0.5">
                        Scrivi il diario della sessione o trascrivi da appunti cartacei. Usa{' '}
                        <span className="text-primary font-mono font-bold">@</span> per menzionare
                        entità, luoghi o mostri.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {features.enableAiExtractor && (
                        <button
                          type="button"
                          onClick={() => setIsExtractModalOpen(true)}
                          disabled={!recapText.trim()}
                          className="px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                          title="Analizza il testo della cronaca ed estrai automaticamente NPC, Luoghi e Mostri con descrizioni"
                        >
                          <Sparkles size={13} />
                          <span>Analizza ed Estrai Entità (IA)</span>
                        </button>
                      )}

                      <OcrButton
                        label="Trascrivi Appunti Foto (OCR)"
                        onScanComplete={(transcribed) => {
                          setRecapText((prev) => (prev.trim() ? `${prev}\n\n${transcribed}` : transcribed));
                        }}
                      />
                    </div>
                  </div>

                  <MentionTextarea
                    rows={12}
                    placeholder="Racconta gli avvenimenti salienti della sessione, le battaglie affrontate e le interazioni chiave..."
                    value={recapText}
                    onValueChange={setRecapText}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-2xl p-4 text-content-1 outline-none font-body leading-relaxed resize-y min-h-[260px]"
                  />

                  <div className="flex items-center justify-between text-[11px] text-content-3 pt-1">
                    <span>
                      Supporta formattazione Markdown (**grassetto**, *corsivo*, elenchi, citazioni).
                    </span>
                    <span className="font-mono">{recapText.length} caratteri</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SNODI & MAPPE */}
            {activeStep === 'events_maps' && (
              <div className="space-y-5">
                {/* Images & Maps Section with Existing Picker */}
                <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-3/60 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                        <MapIcon size={14} className="text-primary" />
                        Mappe &amp; Illustrazioni della Sessione ({sessionImages.length})
                      </h4>
                      <p className="text-[11px] text-content-3 mt-0.5">
                        Allega mappe tattiche, scorci geografici o ritratti dei luoghi visitati in questa sessione.
                      </p>
                    </div>

                    {/* Quick Button to Open Existing Maps / Codex Places Picker */}
                    <button
                      type="button"
                      onClick={() => setIsMediaPickerOpen(!isMediaPickerOpen)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isMediaPickerOpen
                          ? 'bg-primary text-surface-0 border-primary shadow-sm'
                          : 'bg-surface-1 border-surface-3 hover:border-primary text-primary hover:bg-surface-2'
                      }`}
                    >
                      <Compass size={13} />
                      <span>
                        {isMediaPickerOpen
                          ? 'Nascondi Mappe & Codex'
                          : 'Scegli da Mappe Esplorate & Luoghi Codex'}
                      </span>
                    </button>
                  </div>

                  {/* MEDIA PICKER DRAWER / POPOVER */}
                  {isMediaPickerOpen && (
                    <div className="p-4 bg-surface-1 border border-primary/40 rounded-xl space-y-3.5 shadow-md animate-fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMediaPickerTab('maps')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              mediaPickerTab === 'maps'
                                ? 'bg-primary text-surface-0 shadow-xs'
                                : 'text-content-3 hover:text-content-1 bg-surface-2'
                            }`}
                          >
                            🗺️ Mappe del Mondo ({worldMaps.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setMediaPickerTab('places')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              mediaPickerTab === 'places'
                                ? 'bg-primary text-surface-0 shadow-xs'
                                : 'text-content-3 hover:text-content-1 bg-surface-2'
                            }`}
                          >
                            🏛️ Luoghi &amp; Codex ({entitiesWithImages.length})
                          </button>
                        </div>

                        {/* Search in existing media */}
                        <div className="relative flex-1 max-w-[200px]">
                          <Search
                            size={12}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-3"
                          />
                          <input
                            type="text"
                            placeholder="Cerca mappa/luogo..."
                            value={mediaSearchQuery}
                            onChange={(e) => setMediaSearchQuery(e.target.value)}
                            className="w-full bg-surface-2 border border-surface-3 rounded-lg pl-7 pr-2 py-1 text-[11px] text-content-1 outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Maps Grid */}
                      {mediaPickerTab === 'maps' && (
                        <div>
                          {filteredWorldMaps.length === 0 ? (
                            <div className="p-4 text-center text-content-3 text-[11px] bg-surface-2/40 rounded-lg">
                              Nessuna mappa trovata nel visualizzatore Mappe. Puoi caricarne una qui sotto!
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                              {paginatedWorldMaps.map((map) => {
                                const isSelected = sessionImages.includes(map.imageUrl);
                                return (
                                  <div
                                    key={map.id}
                                    onClick={() => handleToggleImage(map.imageUrl)}
                                    className={`relative group rounded-xl overflow-hidden border p-1.5 transition-all cursor-pointer flex flex-col gap-1.5 ${
                                      isSelected
                                        ? 'bg-primary/15 border-primary ring-1 ring-primary'
                                        : 'bg-surface-2 border-surface-3 hover:border-primary/50'
                                    }`}
                                  >
                                    <div className="w-full h-16 rounded-lg overflow-hidden bg-surface-3 relative">
                                      {map.imageUrl && map.imageUrl.trim() ? (
                                        <img
                                          src={map.imageUrl}
                                          alt={map.title}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-content-3">
                                          <ImageIcon size={18} />
                                        </div>
                                      )}
                                      {isSelected && (
                                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-surface-0 flex items-center justify-center shadow-xs">
                                          <Check size={12} strokeWidth={3} />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-1 text-[11px]">
                                      <span className="font-semibold text-content-1 truncate">
                                        {map.title}
                                      </span>
                                      <span className="text-[9px] font-mono text-content-3 shrink-0">
                                        {isSelected ? 'Allegata' : '+ Allega'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Codex Places & Entities Grid */}
                      {mediaPickerTab === 'places' && (
                        <div>
                          {filteredPlaceEntities.length === 0 ? (
                            <div className="p-4 text-center text-content-3 text-[11px] bg-surface-2/40 rounded-lg">
                              Nessun luogo o entità con immagini trovata nel Codex.
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                              {paginatedPlaceEntities.map((ent) => {
                                const firstImg = ent.images?.[0] || '';
                                const isSelected = sessionImages.includes(firstImg);
                                return (
                                  <div
                                    key={ent._id}
                                    onClick={() => handleToggleImage(firstImg)}
                                    className={`relative group rounded-xl overflow-hidden border p-1.5 transition-all cursor-pointer flex flex-col gap-1.5 ${
                                      isSelected
                                        ? 'bg-primary/15 border-primary ring-1 ring-primary'
                                        : 'bg-surface-2 border-surface-3 hover:border-primary/50'
                                    }`}
                                  >
                                    <div className="w-full h-16 rounded-lg overflow-hidden bg-surface-3 relative">
                                      {firstImg && firstImg.trim() ? (
                                        <img
                                          src={firstImg}
                                          alt={ent.name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-content-3">
                                          <ImageIcon size={18} />
                                        </div>
                                      )}
                                      {isSelected && (
                                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-surface-0 flex items-center justify-center shadow-xs">
                                          <Check size={12} strokeWidth={3} />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-1 text-[11px]">
                                      <span className="font-semibold text-content-1 truncate">
                                        {ent.name}
                                      </span>
                                      <span className="text-[9px] font-mono text-content-3 shrink-0 uppercase">
                                        {ent.type}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Media Pagination Controls */}
                      {totalMediaPages > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-surface-3/60 text-[11px] font-mono text-content-3">
                          <span>
                            {(mediaPage - 1) * mediaPageSize + 1}-
                            {Math.min(mediaPage * mediaPageSize, activeMediaTotal)} di {activeMediaTotal}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={mediaPage <= 1}
                              onClick={() => setMediaPage((p) => Math.max(1, p - 1))}
                              className="p-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:pointer-events-none text-content-2 cursor-pointer transition-colors"
                              title="Pagina precedente"
                            >
                              <ChevronLeft size={13} />
                            </button>
                            <span className="px-1.5 text-content-1 font-semibold">
                              {mediaPage} / {totalMediaPages}
                            </span>
                            <button
                              type="button"
                              disabled={mediaPage >= totalMediaPages}
                              onClick={() => setMediaPage((p) => Math.min(totalMediaPages, p + 1))}
                              className="p-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:pointer-events-none text-content-2 cursor-pointer transition-colors"
                              title="Pagina successiva"
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Image Gallery Uploader */}
                  <ImageGalleryUploader
                    images={sessionImages}
                    onChange={setSessionImages}
                    label="Galleria Immagini &amp; Mappe Allegati"
                    maxImages={8}
                    entityName={title ? `Sessione: ${title}` : 'Sessione D&D'}
                    entityType="session"
                    contextDescription={recapText}
                  />
                </div>

                {/* Narrative Events & Key Hubs */}
                <div className="bg-surface-2/60 border border-surface-3 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} className="text-primary" />
                      Snodi Narrativi ed Eventi Chiave ({eventsList.length})
                    </h4>
                    <span className="text-[11px] text-content-3">
                      I momenti decisivi e i punti di svolta vissuti dal party
                    </span>
                  </div>

                  {eventsList.length > 0 && (
                    <div className="space-y-2.5">
                      {eventsList.map((evt, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-surface-1 border border-surface-3 rounded-xl flex items-start justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-content-1 text-xs">{evt.title}</span>
                              {evt.impact === 'major' && (
                                <span className="px-2 py-0.2 bg-primary/20 text-primary text-[10px] font-mono font-bold rounded">
                                  Cruciale
                                </span>
                              )}
                              {evt.impact === 'secret' && (
                                <span className="px-2 py-0.2 bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold rounded flex items-center gap-0.5">
                                  <ShieldAlert size={10} /> Segreto
                                </span>
                              )}
                            </div>
                            {evt.description && (
                              <p className="text-[11px] text-content-3 line-clamp-2">{evt.description}</p>
                            )}
                            {evt.location && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                  <MapPin size={10} /> {evt.location}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(idx)}
                            className="text-content-3 hover:text-rose-400 p-1.5 transition-colors cursor-pointer rounded-lg hover:bg-surface-2"
                            title="Rimuovi snodo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Event Form with Smart Location Autocomplete */}
                  <div className="p-4 bg-surface-1/90 border border-surface-3 rounded-xl space-y-3">
                    <span className="font-semibold text-primary block text-xs">
                      + Registra Nuovo Snodo Narrativo
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-content-3 mb-1">
                          Titolo dello Snodo <span className="text-primary">*</span>
                        </label>
                        <MentionInput
                          placeholder="Es. Il Patto con la Strega delle Paludi..."
                          value={tempEventTitle}
                          onValueChange={setTempEventTitle}
                          className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-1.5 text-content-1 outline-none focus:border-primary"
                        />
                      </div>

                      {/* Location Input with Interactive Suggestions */}
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-medium text-content-3">
                            Luogo dello Snodo
                          </label>
                          {placeEntities.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-semibold"
                            >
                              <Compass size={10} />
                              <span>Luoghi Codex</span>
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            ref={locationInputRef}
                            type="text"
                            placeholder="Es. Baldur's Gate, Candlekeep..."
                            value={tempEventLocation}
                            onFocus={() => setShowLocationDropdown(true)}
                            onChange={(e) => {
                              setTempEventLocation(e.target.value);
                              setShowLocationDropdown(true);
                            }}
                            className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-1.5 text-content-1 outline-none focus:border-primary"
                          />
                          <MapPin
                            size={13}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-3"
                          />
                        </div>

                        {/* Dropdown Suggestions */}
                        {showLocationDropdown && locationSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-surface-1 border border-surface-3 rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto custom-scrollbar p-1">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-content-3 border-b border-surface-2">
                              Luoghi e Mappe Suggeriti
                            </div>
                            {locationSuggestions.map((item, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setTempEventLocation(item.name);
                                  setShowLocationDropdown(false);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                              >
                                <span className="font-medium text-content-1 truncate flex items-center gap-1.5">
                                  <MapPin size={12} className="text-primary shrink-0" />
                                  {item.name}
                                </span>
                                <span className="text-[10px] text-content-3 font-mono shrink-0">
                                  {item.type}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick suggestion banner if location has an image */}
                    {selectedLocationImageMatch && !selectedLocationImageMatch.isAlreadyAttached && selectedLocationImageMatch.imageUrl && selectedLocationImageMatch.imageUrl.trim() && (
                      <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between gap-3 text-xs animate-fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={selectedLocationImageMatch.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-primary/40"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-content-2 truncate text-[11px]">
                            Illustrazione/mappa disponibile per <strong>{selectedLocationImageMatch.name}</strong>.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleImage(selectedLocationImageMatch.imageUrl)}
                          className="px-2.5 py-1 rounded-lg bg-primary text-surface-0 text-[10px] font-bold shrink-0 hover:bg-primary-hover transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={11} /> Allega alla Sessione
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-content-3 mb-1">
                          Impatto sulla Trama
                        </label>
                        <select
                          value={tempEventImpact}
                          onChange={(e) => setTempEventImpact(e.target.value as any)}
                          className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3 py-1.5 text-content-1 outline-none cursor-pointer"
                        >
                          <option value="normal">Impatto Normale</option>
                          <option value="major">Impatto Cruciale (Svolta di Trama)</option>
                          <option value="secret">Segreto del Master (Non visibile a tutti)</option>
                        </select>
                      </div>

                      <div>
                        <LoreDateInput
                          label="Data Lore Specifica"
                          value={tempEventLoreDate}
                          onChange={setTempEventLoreDate}
                          session={{
                            _id: initialSession?._id || 'temp',
                            number: number || 1,
                            title: title || 'Sessione',
                            date: date,
                            loreDate: loreDate,
                            loreStartDay: loreMeta?.startDay,
                            loreEndDay: loreMeta?.endDay,
                            loreMonth: loreMeta?.month,
                            loreEndMonth: loreMeta?.endMonth,
                            loreYear: loreMeta?.year,
                            loreEndYear: loreMeta?.endYear,
                          }}
                          placeholder={loreDate || "Es. 15 Tarsakh 1492"}
                          inputClassName="rounded-xl px-3 py-1.5 border-surface-3"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-content-3 mb-1">
                        Descrizione Dettagliata dello Snodo
                      </label>
                      <MentionTextarea
                        rows={2}
                        placeholder="Cosa hanno deciso o scoperto i personaggi? Chi era presente?"
                        value={tempEventDesc}
                        onValueChange={setTempEventDesc}
                        className="w-full bg-surface-2 border border-surface-3 rounded-xl p-2.5 text-content-1 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <ImageGalleryUploader
                        images={tempEventImages}
                        onChange={setTempEventImages}
                        label="Illustrazioni & Ricordi Visivi dello Snodo"
                        entityName={tempEventTitle}
                        contextDescription={tempEventDesc}
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleAddEvent}
                        disabled={!tempEventTitle.trim()}
                        className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl font-semibold transition-colors disabled:opacity-40 cursor-pointer text-xs flex items-center gap-1.5"
                      >
                        <Plus size={13} />
                        <span>Aggiungi Snodo alla Cronaca</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-surface-2 bg-surface-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            >
              Annulla
            </button>

            <div className="flex items-center gap-2">
              {activeStep === 'details' && (
                <button
                  type="button"
                  onClick={() => setActiveStep('recap')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-2 border border-surface-3 text-content-1 hover:bg-surface-3 text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>Avanti: Cronaca</span>
                  <ChevronRight size={14} />
                </button>
              )}

              {activeStep === 'recap' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveStep('details')}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-content-3 hover:text-content-1 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    <span>Dettagli</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep('events_maps')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-2 border border-surface-3 text-content-1 hover:bg-surface-3 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span>Avanti: Snodi &amp; Mappe</span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}

              {activeStep === 'events_maps' && (
                <button
                  type="button"
                  onClick={() => setActiveStep('recap')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-content-3 hover:text-content-1 text-xs font-medium transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Cronaca</span>
                </button>
              )}

              <button
                type="submit"
                disabled={!title.trim()}
                className="bg-primary text-surface-0 hover:bg-primary-hover transition-colors px-5 py-2 rounded-xl font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isEditing ? 'Salva Modifiche' : 'Sigilla Cronaca'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {/* AI ENTITY EXTRACTION MODAL */}
    {features.enableAiExtractor && (
      <EntityExtractionModal
        key={initialSession?._id || 'new_session_modal'}
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
        rawText={recapText}
        onApplied={(_newEnts, updatedText) => {
          setHasExtractedEntities(true);
          setHasExtractedEntitiesAt(new Date().toISOString());
          if (updatedText) {
            setRecapText(updatedText);
          }
        }}
      />
    )}
  </Portal>
  );
}
