import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { MentionInput, MentionTextarea } from '../components/MentionInput';
import { EntityMentionText } from '../components/EntityMentionText';
import { LoreDateInput } from '../components/LoreDateInput';
import { parseLoreDateString, normalizeText } from '../lib/loreDateUtils';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Session, SessionEvent, CampaignCalendar, Entity, CampaignChapter } from '../types';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Search,
  Scroll,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Maximize2,
  Minimize2,
  ExternalLink,
  Swords,
  MessageSquare,
  Compass,
  SearchCode,
  Tag,
  Ghost,
  Shield,
  AtSign,
  Check,
  Bookmark,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageGalleryUploader } from '../components/ImageGalleryUploader';
import { StorylineFullscreenViewer, StorylineSlide } from '../components/StorylineFullscreenViewer';
import { motion, AnimatePresence } from 'framer-motion';

// Icons & labels for entities
const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  npc: Users,
  monster: Ghost,
  place: MapPin,
  quest: Tag,
  item: Sparkles,
  faction: Shield,
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  npc: 'NPC',
  monster: 'Mostro',
  place: 'Luogo',
  quest: 'Quest',
  item: 'Oggetto',
  faction: 'Fazione',
};

// Session & Event types config
export type EventCategoryType = 'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed';

const EVENT_TYPES_CONFIG: Record<
  EventCategoryType,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  combat: {
    label: 'Combattimento',
    icon: Swords,
    color: 'text-rose-400',
  },
  roleplay: {
    label: 'Interpretazione',
    icon: MessageSquare,
    color: 'text-blue-400',
  },
  exploration: {
    label: 'Esplorazione',
    icon: Compass,
    color: 'text-emerald-400',
  },
  investigation: {
    label: 'Investigazione',
    icon: SearchCode,
    color: 'text-amber-400',
  },
  lore: {
    label: 'Lore & Rivelazione',
    icon: Sparkles,
    color: 'text-purple-400',
  },
  mixed: {
    label: 'Sessione Mista',
    icon: Scroll,
    color: 'text-primary',
  },
};

export interface StorylineSessionEventItem {
  id: string;
  title: string;
  description: string;
  loreDate?: string;
  location?: string;
  impact?: 'major' | 'normal' | 'secret';
  eventType: EventCategoryType;
  involvedCharacters?: string[];
  linkedEntityIds?: string[];
  images?: string[];
}

export interface StorylineDaySession {
  session: Session;
  title: string;
  recapText: string;
  category: EventCategoryType;
  impact: 'major' | 'normal' | 'secret';
  location?: string;
  events: StorylineSessionEventItem[];
  involvedCharacters: string[];
  linkedEntityIds: string[];
  images: string[];
  dayProgress?: {
    currentDayNumber: number;
    totalDays: number;
    isMultiDay: boolean;
    spanLabel: string;
    fullSpanRange?: string;
  };
}

export interface StorylineDayNode {
  id: string;
  loreDate: string;
  shortDate: string;
  fullDate: string;
  dayTitle: string;
  sortKey: number;
  sessions: StorylineDaySession[];
  primaryEventType: EventCategoryType;
  impact: 'major' | 'normal' | 'secret';
  allLocations: string[];
  allLinkedEntityIds: string[];
  allInvolvedCharacters: string[];
  allImages: string[];
  order: number;
}

// Backward-compatible alias for slide/fullscreen types if referenced
export type TimelineNode = StorylineDayNode;

// Helper to deduce event type if not explicitly set
function deduceEventType(nodeTitle: string, nodeDesc: string, fallback?: EventCategoryType): EventCategoryType {
  if (fallback && EVENT_TYPES_CONFIG[fallback]) return fallback;
  const text = (nodeTitle + ' ' + nodeDesc).toLowerCase();
  if (
    text.includes('scontro') ||
    text.includes('battaglia') ||
    text.includes('combattuto') ||
    text.includes('attacco') ||
    text.includes('nemici') ||
    text.includes('combattimento') ||
    text.includes('ucciso')
  ) {
    return 'combat';
  }
  if (
    text.includes('indizio') ||
    text.includes('enigma') ||
    text.includes('investig') ||
    text.includes('mistero') ||
    text.includes('disattiv')
  ) {
    return 'investigation';
  }
  if (
    text.includes('esplor') ||
    text.includes('viaggio') ||
    text.includes('passo') ||
    text.includes('grotta') ||
    text.includes('catacombe') ||
    text.includes('mappa')
  ) {
    return 'exploration';
  }
  if (
    text.includes('sigillo') ||
    text.includes('antico') ||
    text.includes('rivel') ||
    text.includes('visione') ||
    text.includes('profezia') ||
    text.includes('lore')
  ) {
    return 'lore';
  }
  if (
    text.includes('dialogo') ||
    text.includes('trattativa') ||
    text.includes('corte') ||
    text.includes('alleat') ||
    text.includes('incontr')
  ) {
    return 'roleplay';
  }
  return 'mixed';
}

export interface ExtractedLoreDayInfo {
  dayKey: string;
  shortDate: string;
  fullDate: string;
  dayTitle: string;
  sortKey: number;
  matchedDayOfMonth?: number;
  matchedMonthIdx?: number;
  matchedYear?: number;
  dayProgress?: {
    currentDayNumber: number;
    totalDays: number;
    isMultiDay: boolean;
    spanLabel: string;
    fullSpanRange?: string;
  };
}

// Helper to extract all canonical lore day information from session (supports multi-day spans)
function extractLoreDaysForSession(
  session: Session,
  calendar: CampaignCalendar
): ExtractedLoreDayInfo[] {
  const allMonths = calendar.months || [];
  const currentYear = calendar.currentYear || 1492;
  const yearSuffix = calendar.yearSuffix || 'CV';

  // 1. Structured metadata on session
  if (session.loreMonth && session.loreStartDay !== undefined) {
    const sMonthNorm = normalizeText(session.loreMonth);
    const mIdx = allMonths.findIndex((m) => {
      const fn = normalizeText(m.name);
      const mn = normalizeText(m.name.split('(')[0]);
      return fn === sMonthNorm || (mn && sMonthNorm.includes(mn)) || sMonthNorm.includes(mn);
    });
    const resolvedMonthIdx = mIdx !== -1 ? mIdx : 0;
    const monthName = allMonths[resolvedMonthIdx]?.name.split('(')[0].trim() || session.loreMonth;
    const yr = session.loreYear || currentYear;
    const startDay = session.loreStartDay;
    const endDay = session.loreEndDay !== undefined && session.loreEndDay >= startDay ? session.loreEndDay : startDay;
    const totalDays = Math.min(60, endDay - startDay + 1);

    if (totalDays > 1) {
      const days: ExtractedLoreDayInfo[] = [];
      const spanRange = `${startDay} - ${endDay} ${monthName}, ${yr} ${yearSuffix}`.trim();
      for (let d = startDay; d <= endDay; d++) {
        const dayNum = d - startDay + 1;
        days.push({
          dayKey: `lore_${yr}_${resolvedMonthIdx}_${d}`,
          shortDate: `${d} ${monthName}`,
          fullDate: `${d} ${monthName}, ${yr} ${yearSuffix}`.trim(),
          dayTitle: `${d} ${monthName} ${yr} ${yearSuffix}`.trim(),
          sortKey: yr * 100000 + resolvedMonthIdx * 1000 + d,
          matchedDayOfMonth: d,
          matchedMonthIdx: resolvedMonthIdx,
          matchedYear: yr,
          dayProgress: {
            currentDayNumber: dayNum,
            totalDays: totalDays,
            isMultiDay: true,
            spanLabel: `Giorno ${dayNum} di ${totalDays}`,
            fullSpanRange: spanRange,
          },
        });
      }
      return days;
    }

    return [
      {
        dayKey: `lore_${yr}_${resolvedMonthIdx}_${startDay}`,
        shortDate: `${startDay} ${monthName}`,
        fullDate: session.loreDate?.trim() || `${startDay} ${monthName}, ${yr} ${yearSuffix}`.trim(),
        dayTitle: `${startDay} ${monthName} ${yr} ${yearSuffix}`.trim(),
        sortKey: yr * 100000 + resolvedMonthIdx * 1000 + startDay,
        matchedDayOfMonth: startDay,
        matchedMonthIdx: resolvedMonthIdx,
        matchedYear: yr,
      },
    ];
  }

  // 2. Free-text loreDate
  if (session.loreDate && session.loreDate.trim()) {
    const raw = session.loreDate.trim();
    const parsed = parseLoreDateString(raw, allMonths, currentYear, yearSuffix);
    if (parsed && parsed.startDay && parsed.monthIndex !== -1) {
      const yr = parsed.year || currentYear;
      const mIdx = parsed.monthIndex;
      const startDay = parsed.startDay;
      const endDay = parsed.endDay;
      const monthObj = allMonths[mIdx];
      const monthCleanName = monthObj ? monthObj.name.split('(')[0].trim() : parsed.monthName;

      if (endDay && endDay > startDay && !parsed.isCrossMonth) {
        const totalDays = Math.min(60, endDay - startDay + 1);
        const days: ExtractedLoreDayInfo[] = [];
        for (let d = startDay; d <= endDay; d++) {
          const dayNum = d - startDay + 1;
          days.push({
            dayKey: `lore_${yr}_${mIdx}_${d}`,
            shortDate: `${d} ${monthCleanName}`,
            fullDate: `${d} ${monthCleanName}, ${yr} ${yearSuffix}`.trim(),
            dayTitle: `${d} ${monthCleanName} ${yr}`,
            sortKey: yr * 100000 + mIdx * 1000 + d,
            matchedDayOfMonth: d,
            matchedMonthIdx: mIdx,
            matchedYear: yr,
            dayProgress: {
              currentDayNumber: dayNum,
              totalDays: totalDays,
              isMultiDay: true,
              spanLabel: `Giorno ${dayNum} di ${totalDays}`,
              fullSpanRange: parsed.formatted || raw,
            },
          });
        }
        return days;
      }

      if (parsed.isCrossMonth && endDay && parsed.endMonthIndex !== undefined) {
        const daysInFirstMonth = monthObj?.days || 30;
        const endMonthObj = allMonths[parsed.endMonthIndex];
        const endMonthCleanName = endMonthObj ? endMonthObj.name.split('(')[0].trim() : (parsed.endMonthName || '');
        const days: ExtractedLoreDayInfo[] = [];
        let dayCounter = 1;
        const endYr = parsed.endYear || yr;

        for (let d = startDay; d <= daysInFirstMonth; d++) {
          days.push({
            dayKey: `lore_${yr}_${mIdx}_${d}`,
            shortDate: `${d} ${monthCleanName}`,
            fullDate: `${d} ${monthCleanName}, ${yr} ${yearSuffix}`.trim(),
            dayTitle: `${d} ${monthCleanName} ${yr}`,
            sortKey: yr * 100000 + mIdx * 1000 + d,
            matchedDayOfMonth: d,
            matchedMonthIdx: mIdx,
            matchedYear: yr,
            dayProgress: {
              currentDayNumber: dayCounter++,
              totalDays: 0,
              isMultiDay: true,
              spanLabel: '',
              fullSpanRange: parsed.formatted || raw,
            },
          });
        }
        for (let d = 1; d <= endDay; d++) {
          days.push({
            dayKey: `lore_${endYr}_${parsed.endMonthIndex}_${d}`,
            shortDate: `${d} ${endMonthCleanName}`,
            fullDate: `${d} ${endMonthCleanName}, ${endYr} ${yearSuffix}`.trim(),
            dayTitle: `${d} ${endMonthCleanName} ${endYr}`,
            sortKey: endYr * 100000 + parsed.endMonthIndex * 1000 + d,
            matchedDayOfMonth: d,
            matchedMonthIdx: parsed.endMonthIndex,
            matchedYear: endYr,
            dayProgress: {
              currentDayNumber: dayCounter++,
              totalDays: 0,
              isMultiDay: true,
              spanLabel: '',
              fullSpanRange: parsed.formatted || raw,
            },
          });
        }
        const total = days.length;
        days.forEach((d) => {
          if (d.dayProgress) {
            d.dayProgress.totalDays = total;
            d.dayProgress.spanLabel = `Giorno ${d.dayProgress.currentDayNumber} di ${total}`;
          }
        });
        return days;
      }

      return [
        {
          dayKey: `lore_${yr}_${mIdx}_${startDay}`,
          shortDate: `${startDay} ${monthCleanName}`,
          fullDate: parsed.formatted || `${startDay} ${monthCleanName}, ${yr} ${yearSuffix}`.trim(),
          dayTitle: parsed.formatted || `${startDay} ${monthCleanName} ${yr}`,
          sortKey: yr * 100000 + mIdx * 1000 + startDay,
          matchedDayOfMonth: startDay,
          matchedMonthIdx: mIdx,
          matchedYear: yr,
        },
      ];
    }

    const norm = normalizeText(raw);
    return [
      {
        dayKey: `raw_${norm}`,
        shortDate: raw.length > 18 ? raw.substring(0, 16) + '...' : raw,
        fullDate: raw,
        dayTitle: raw,
        sortKey: 900000000 + session.number * 10,
      },
    ];
  }

  // 3. Fallback to session real-world date
  if (session.date) {
    return [
      {
        dayKey: `real_${session.date}`,
        shortDate: session.date,
        fullDate: `Sessione del ${session.date}`,
        dayTitle: `Data del ${session.date}`,
        sortKey: 950000000 + session.number * 10,
      },
    ];
  }

  // 4. Fallback to session ID
  return [
    {
      dayKey: `sess_${session._id}`,
      shortDate: `Cap. #${session.number}`,
      fullDate: `Capitolo #${session.number}: ${session.title}`,
      dayTitle: `Capitolo #${session.number}`,
      sortKey: 990000000 + session.number * 10,
    },
  ];
}

interface StorylineImageCarouselProps {
  images?: string[];
  title?: string;
  subtitle?: string;
  onOpenImage: (img: string, index: number) => void;
  onUpdateImages?: (newImages: string[]) => void;
  editable?: boolean;
  contextDescription?: string;
  compact?: boolean;
}

function StorylineImageCarousel({
  images = [],
  title = '',
  subtitle = '',
  onOpenImage,
  onUpdateImages,
  editable = false,
  contextDescription = '',
  compact = false,
}: StorylineImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const validImages = Array.isArray(images) ? images.filter(Boolean) : [];
  const activeIndex = validImages.length === 0 ? 0 : Math.min(currentIndex, validImages.length - 1);

  useEffect(() => {
    if (currentIndex >= validImages.length && validImages.length > 0) {
      setCurrentIndex(0);
    }
  }, [validImages.length, currentIndex]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
  };

  // If no images
  if (validImages.length === 0) {
    if (!editable || !onUpdateImages) return null;
    return (
      <div className="bg-surface-2 border border-dashed border-surface-3 rounded-2xl p-4 text-center space-y-2.5">
        <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-content-3">
          <ImageIcon size={20} className="text-primary/70 mb-0.5" />
          <p className="font-medium text-content-2">
            Nessun ricordo visivo o illustrazione {title ? `per ${title}` : 'allegata a questo snodo'}
          </p>
          <p className="text-[11px] text-content-3 max-w-sm">
            Carica illustrazioni, momenti o reference per arricchire questo capitolo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="px-3.5 py-1.5 rounded-xl bg-surface-1 hover:bg-surface-3 border border-surface-3 text-primary hover:text-primary-hover text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus size={13} />
          <span>{isEditing ? 'Chiudi Caricamento' : 'Aggiungi Immagini per questa Sessione'}</span>
        </button>

        {isEditing && (
          <div className="mt-3 pt-3 border-t border-surface-3 text-left">
            <ImageGalleryUploader
              images={validImages}
              onChange={(newImgs) => {
                onUpdateImages(newImgs);
                if (newImgs.length > 0) setIsEditing(false);
              }}
              label={`Carica o Genera Immagini per ${title || 'questa Sessione'}`}
              entityName={title}
              contextDescription={contextDescription}
            />
          </div>
        )}
      </div>
    );
  }

  // Compact version for node cards on the timeline
  if (compact) {
    return (
      <div className="space-y-1.5 pt-1">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-2/80 border border-surface-3 group">
          <img
            src={validImages[activeIndex]}
            alt={`Memoria ${activeIndex + 1}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
            referrerPolicy="no-referrer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage(validImages[activeIndex], activeIndex);
            }}
          />

          {/* Slide counter pill */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-surface-0/85 backdrop-blur-sm text-[10px] font-mono text-content-1 border border-surface-3/50 flex items-center gap-1 shadow-sm">
            <ImageIcon size={10} className="text-primary" />
            <span>{activeIndex + 1}/{validImages.length}</span>
          </div>

          {/* Quick zoom icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage(validImages[activeIndex], activeIndex);
            }}
            className="absolute top-2 right-2 p-1 rounded-full bg-surface-0/85 backdrop-blur-sm text-content-2 hover:text-content-1 opacity-0 group-hover:opacity-100 transition-opacity border border-surface-3/50 cursor-pointer"
            title="Ingrandisci a schermo intero"
          >
            <Maximize2 size={11} />
          </button>

          {/* Prev / Next controls if multiple images */}
          {validImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-surface-0/85 hover:bg-surface-0 text-content-1 backdrop-blur-sm border border-surface-3/60 transition-colors shadow-sm cursor-pointer"
                title="Immagine precedente"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-surface-0/85 hover:bg-surface-0 text-content-1 backdrop-blur-sm border border-surface-3/60 transition-colors shadow-sm cursor-pointer"
                title="Immagine successiva"
              >
                <ChevronRight size={13} />
              </button>

              {/* Indicator dots */}
              <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1 pointer-events-none">
                {validImages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 rounded-full transition-all ${
                      idx === activeIndex
                        ? 'w-3.5 bg-primary'
                        : 'w-1 bg-surface-0/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Full rich carousel for the inspected node modal / drawer
  return (
    <div className="space-y-3 bg-surface-2 border border-surface-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-surface-1 border border-surface-3 text-primary flex items-center justify-center shrink-0">
            <ImageIcon size={13} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-content-1 truncate">
              {title ? `Memorie Visive • ${title}` : 'Carosello & Ricordi Visivi'}
            </h4>
            <p className="text-[10px] text-content-3">
              {validImages.length} {validImages.length === 1 ? 'illustrazione memorizzata' : 'illustrazioni memorizzate'}
              {subtitle ? ` • ${subtitle}` : ''}
            </p>
          </div>
        </div>

        {editable && onUpdateImages && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {isEditing ? 'Chiudi' : '+ Carica / Gestisci Immagini'}
          </button>
        )}
      </div>

      {isEditing && editable && onUpdateImages && (
        <div className="p-3 bg-surface-1 rounded-xl border border-surface-3">
          <ImageGalleryUploader
            images={validImages}
            onChange={(newImgs) => onUpdateImages(newImgs)}
            label={`Carica o Genera Immagini per ${title || 'questa Sessione'}`}
            entityName={title}
            contextDescription={contextDescription}
          />
        </div>
      )}

      {/* Main Carousel View */}
      <div className="relative aspect-video sm:aspect-[16/9] max-h-[360px] w-full rounded-xl overflow-hidden bg-surface-1 border border-surface-3 group">
        <img
          src={validImages[activeIndex]}
          alt={`Illustrazione snodo ${activeIndex + 1}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain sm:object-cover bg-surface-0/40 cursor-pointer hover:scale-[1.01] transition-transform duration-300"
          referrerPolicy="no-referrer"
          onClick={() => onOpenImage(validImages[activeIndex], activeIndex)}
        />

        {/* Counter Badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-0/85 backdrop-blur-md text-xs font-mono text-content-1 border border-surface-3/80 flex items-center gap-1.5 shadow-sm">
          <ImageIcon size={12} className="text-primary" />
          <span>{activeIndex + 1} / {validImages.length}</span>
        </div>

        {/* Zoom Lightbox Button */}
        <button
          type="button"
          onClick={() => onOpenImage(validImages[activeIndex], activeIndex)}
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-surface-0/85 backdrop-blur-md text-content-2 hover:text-content-1 border border-surface-3/80 text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
          title="Schermo intero"
        >
          <Maximize2 size={12} />
          <span className="hidden sm:inline">Ingrandisci</span>
        </button>

        {/* Prev / Next buttons */}
        {validImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface-0/85 hover:bg-surface-0 text-content-1 backdrop-blur-md border border-surface-3/80 transition-colors shadow-md cursor-pointer"
              title="Precedente"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface-0/85 hover:bg-surface-0 text-content-1 backdrop-blur-md border border-surface-3/80 transition-colors shadow-md cursor-pointer"
              title="Successiva"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {validImages.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
          {validImages.map((img, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 scale-105'
                    : 'border-surface-3 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img}
                  alt={`Miniatura ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TimelineNodeCardProps {
  node: StorylineDayNode;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  calendar: CampaignCalendar;
  entityMap: Map<string, Entity>;
  onToggleExpansion: (id: string) => void;
  onInspect: (node: StorylineDayNode) => void;
  onJumpToEntity: (entity: Entity, e?: React.MouseEvent) => void;
  onOpenImage: (img: string, node: StorylineDayNode, imageIndex: number) => void;
}

const TimelineNodeCard = React.memo(function TimelineNodeCard({
  node,
  index,
  isFirst,
  isLast,
  isExpanded,
  calendar,
  entityMap,
  onToggleExpansion,
  onInspect,
  onJumpToEntity,
  onOpenImage,
}: TimelineNodeCardProps) {
  const isEven = index % 2 === 0;
  const isMajor = node.impact === 'major';
  const catConfig = EVENT_TYPES_CONFIG[node.primaryEventType] || EVENT_TYPES_CONFIG.mixed;
  const CatIcon = catConfig.icon;
  const [activeSessionIdx, setActiveSessionIdx] = useState<number>(0);

  const nodeEntities = useMemo(() => {
    return (node.allLinkedEntityIds || [])
      .map((id) => entityMap.get(id))
      .filter((e): e is Entity => Boolean(e));
  }, [node.allLinkedEntityIds, entityMap]);

  const hasMultipleSessions = node.sessions.length > 1;
  const currentSession = activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
    ? node.sessions[activeSessionIdx]
    : node.sessions[0];

  // High-performance clean excerpt for timeline card previews (avoids parsing heavy markdown AST across 25+ cards)
  const currentSessionExcerpt = useMemo(() => {
    if (!currentSession?.recapText) return '';
    const text = currentSession.recapText.trim();
    const cleaned = text
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\n\s*\n+/g, ' ')
      .trim();
    if (cleaned.length > 220) {
      return cleaned.substring(0, 210).trim() + '...';
    }
    return cleaned;
  }, [currentSession?.recapText]);

  const renderPanel = () => (
    <div
      className={`w-full p-4 sm:p-5 flex flex-col gap-2.5 bg-surface-1 rounded-2xl border transition-colors relative group ${
        isMajor ? 'border-primary/40' : 'border-surface-2 hover:border-surface-3'
      }`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {hasMultipleSessions ? (
            <span className="text-primary font-mono font-semibold text-xs bg-primary/10 border border-primary/25 px-2 py-0.5 rounded">
              {node.sessions.length} Sessioni nel giorno
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-primary font-mono font-semibold text-xs">
                Capitolo #{node.sessions[0]?.session.number}
              </span>
              {currentSession?.dayProgress?.isMultiDay && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono font-medium rounded bg-primary/10 text-primary border border-primary/20">
                  {currentSession.dayProgress.spanLabel}
                </span>
              )}
            </div>
          )}
          <span className="text-content-3 text-xs">&bull;</span>
          <span className="text-content-2 text-xs flex items-center gap-1">
            <CatIcon size={13} className={catConfig.color} /> {catConfig.label}
          </span>
          {isMajor && (
            <>
              <span className="text-content-3 text-xs">&bull;</span>
              <span className="text-rose-400 font-medium text-xs">
                Cruciale
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(node);
            }}
            className="p-1 rounded-md text-content-3 hover:text-content-1 transition-colors cursor-pointer"
            title="Dettaglio completo giorno"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpansion(node.id);
            }}
            className="p-1 rounded-md text-content-3 hover:text-content-1 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Date */}
      <div className="flex items-center gap-1.5 text-xs text-content-3">
        <Calendar size={12} className="text-primary shrink-0" />
        <span className="font-medium text-content-2">{node.fullDate}</span>
      </div>

      {/* Title */}
      <h3
        onClick={() => onToggleExpansion(node.id)}
        className="font-heading font-semibold text-sm text-content-1 hover:text-primary transition-colors cursor-pointer"
      >
        {hasMultipleSessions ? (
          <span>
            Sessioni del Giorno &bull; <span className="text-primary">Cap. #{node.sessions.map((s) => s.session.number).join(', #')}</span>
          </span>
        ) : (
          <EntityMentionText text={node.sessions[0]?.title || `Capitolo #${node.sessions[0]?.session.number}`} />
        )}
      </h3>

      {/* Locations */}
      {node.allLocations.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-content-3">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{node.allLocations.join(' &bull; ')}</span>
        </div>
      )}

      {/* Linked entities */}
      {nodeEntities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs text-content-3 flex items-center gap-1">
            <AtSign size={11} /> Entità:
          </span>
          {nodeEntities.map((ent) => {
            const EIcon = ENTITY_ICONS[ent.type] || Users;
            return (
              <button
                key={ent._id}
                type="button"
                onClick={(e) => onJumpToEntity(ent, e)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 text-xs transition-colors cursor-pointer"
                title={`Scheda di ${ent.name}`}
              >
                <EIcon size={11} className="text-primary" />
                <span className="font-medium">{ent.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden space-y-3 pt-2 border-t border-surface-2"
          >
            {/* If multiple sessions in this day, provide a clean tab switcher */}
            {hasMultipleSessions && (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-surface-2/70 border border-surface-3/60 rounded-xl">
                {node.sessions.map((sessItem, sIdx) => {
                  const isSelected = activeSessionIdx === sIdx;
                  return (
                    <button
                      key={sessItem.session._id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSessionIdx(sIdx);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer truncate max-w-[160px] ${
                        isSelected
                          ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                          : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                      }`}
                      title={`Capitolo #${sessItem.session.number}: ${sessItem.title}`}
                    >
                      Cap. #{sessItem.session.number}: {sessItem.title}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSessionIdx(-1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    activeSessionIdx === -1
                      ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                  }`}
                  title="Mostra tutte le sessioni del giorno"
                >
                  Tutte ({node.sessions.length})
                </button>
              </div>
            )}

            {/* Render selected session or all sessions */}
            {activeSessionIdx === -1 && hasMultipleSessions ? (
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {node.sessions.map((sessItem) => (
                  <div
                    key={sessItem.session._id}
                    className="p-3 bg-surface-2/50 border border-surface-3/50 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-surface-3/40 pb-1.5">
                      <span className="text-xs font-semibold text-primary font-mono">
                        Capitolo #{sessItem.session.number}: {sessItem.title}
                      </span>
                      <Link
                        to={`/sessions?select=${sessItem.session._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        Apri <ExternalLink size={10} />
                      </Link>
                    </div>

                    {sessItem.recapText && (
                      <p className="text-xs text-content-2 leading-relaxed line-clamp-3">
                        <EntityMentionText
                          text={
                            sessItem.recapText.length > 200
                              ? sessItem.recapText.substring(0, 190).trim() + '...'
                              : sessItem.recapText
                          }
                        />
                      </p>
                    )}

                    {sessItem.events.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-content-3">
                          Eventi salienti ({sessItem.events.length}):
                        </span>
                        <div className="space-y-1">
                          {sessItem.events.map((evt) => (
                            <div key={evt.id} className="text-xs text-content-2 bg-surface-1/60 p-1.5 rounded-lg border border-surface-3/40">
                              <span className="font-medium text-content-1">{evt.title}</span>
                              {evt.description && <p className="text-[11px] text-content-3 mt-0.5">{evt.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {hasMultipleSessions && currentSession && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-content-1">
                      Capitolo #{currentSession.session.number}: {currentSession.title}
                    </span>
                    <Link
                      to={`/sessions?select=${currentSession.session._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Vai alla sessione <ExternalLink size={10} />
                    </Link>
                  </div>
                )}

                {currentSessionExcerpt ? (
                  <p className="text-xs text-content-2 leading-relaxed line-clamp-3">
                    <EntityMentionText text={currentSessionExcerpt} />
                  </p>
                ) : (
                  <p className="text-xs text-content-3 italic">Nessun resoconto narrativo registrato.</p>
                )}

                {/* Structured events of the session */}
                {currentSession?.events && currentSession.events.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                      <Scroll size={11} /> Eventi della Sessione ({currentSession.events.length})
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {currentSession.events.map((evt) => {
                        const EvtIcon = EVENT_TYPES_CONFIG[evt.eventType]?.icon || Scroll;
                        const evtColor = EVENT_TYPES_CONFIG[evt.eventType]?.color || 'text-primary';
                        return (
                          <div
                            key={evt.id}
                            className="bg-surface-2/60 border border-surface-3/50 rounded-lg p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-1.5 font-medium text-content-1">
                              <span className="flex items-center gap-1.5">
                                <EvtIcon size={12} className={evtColor} />
                                <EntityMentionText text={evt.title} />
                              </span>
                              {evt.impact === 'major' && (
                                <span className="text-[10px] text-rose-400 font-semibold">Cruciale</span>
                              )}
                            </div>
                            {evt.description && (
                              <p className="text-[11px] text-content-2 mt-1 line-clamp-2">
                                {evt.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Involved Characters */}
                {currentSession?.involvedCharacters && currentSession.involvedCharacters.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {currentSession.involvedCharacters.map((charName, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-surface-2 text-xs text-content-3"
                      >
                        #{charName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Images Carousel */}
            {(() => {
              const displayImages =
                activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
                  ? node.sessions[activeSessionIdx].images
                  : node.allImages;
              const displayTitle =
                activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
                  ? `Capitolo #${node.sessions[activeSessionIdx].session.number}: ${node.sessions[activeSessionIdx].title}`
                  : node.dayTitle;

              if (!displayImages || displayImages.length === 0) return null;
              return (
                <StorylineImageCarousel
                  compact
                  images={displayImages}
                  title={displayTitle}
                  onOpenImage={(img, idx) => onOpenImage(img, node, idx)}
                />
              );
            })()}

            <div className="pt-1 flex items-center justify-between text-xs text-content-3">
              <button
                type="button"
                onClick={() => onInspect(node)}
                className="text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                Vedi scheda giorno completa <ExternalLink size={10} />
              </button>
              {currentSession?.session.date && currentSession.session.date !== node.fullDate && currentSession.session.date !== node.shortDate && (
                <span className="font-mono text-[11px] text-content-3">
                  Giocata: {currentSession.session.date}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      id={`timeline-node-${node.id}`}
      className="w-80 sm:w-96 shrink-0 relative flex flex-col items-center justify-center group"
      style={{
        height: '40px',
      }}
    >
      {/* Horizontal Axis Segments */}
      <div
        className={`absolute right-1/2 top-1/2 -translate-y-1/2 h-[2px] bg-primary/40 pointer-events-none z-0 ${
          isFirst
            ? 'w-24 -left-24 bg-gradient-to-r from-transparent to-primary/40'
            : 'w-[calc(50%+1.5rem)] sm:w-[calc(50%+2rem)] -left-6 sm:-left-8'
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-y-1/2 h-[2px] bg-primary/40 pointer-events-none z-0 ${
          isLast
            ? 'w-24 bg-gradient-to-r from-primary/40 to-transparent'
            : 'w-[calc(50%+1.5rem)] sm:w-[calc(50%+2rem)]'
        }`}
      />

      {/* TOP PANEL (Even indexes) */}
      {isEven && (
        <div className="absolute bottom-full mb-3 w-full flex flex-col items-center z-10 pointer-events-auto" data-interactive="true">
          {renderPanel()}
          <div className="w-0.5 h-8 bg-primary/30 mx-auto" />
        </div>
      )}

      {/* Central Interactive Timeline Marker */}
      <button
        type="button"
        onClick={() => onToggleExpansion(node.id)}
        data-interactive="true"
        className="relative flex flex-col items-center justify-center cursor-pointer my-auto z-20 group/marker bg-transparent border-none p-0 outline-none"
        title={isExpanded ? 'Comprimi sezione giorno' : 'Espandi sezione giorno'}
      >
        <div
          className={`px-3.5 py-1.5 rounded-full border bg-surface-1 flex items-center gap-2 transition-transform hover:scale-105 shadow-sm ${
            isMajor ? 'border-primary' : 'border-surface-3 hover:border-primary/50'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              isMajor ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-content-2'
            }`}
          >
            <CatIcon size={12} />
          </div>

          <div className="flex flex-col text-left pr-1">
            <span className="text-xs font-semibold text-content-1 leading-none font-mono">
              {node.shortDate}
            </span>
            <span className="text-[10px] text-content-3 leading-none mt-1">
              {hasMultipleSessions
                ? `${node.sessions.length} Sessioni (Cap. #${node.sessions.map((s) => s.session.number).join(', #')})`
                : node.sessions[0]?.dayProgress?.isMultiDay
                ? `Cap. #${node.sessions[0]?.session.number} (${node.sessions[0].dayProgress.spanLabel})`
                : `Cap. #${node.sessions[0]?.session.number}`}
            </span>
          </div>
        </div>
      </button>

      {/* BOTTOM PANEL (Odd indexes) */}
      {!isEven && (
        <div className="absolute top-full mt-3 w-full flex flex-col items-center z-10 pointer-events-auto" data-interactive="true">
          <div className="w-0.5 h-8 bg-primary/30 mx-auto" />
          {renderPanel()}
        </div>
      )}
    </div>
  );
});

interface StorylineMobileNodeCardProps {
  node: StorylineDayNode;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  calendar: CampaignCalendar;
  entityMap: Map<string, Entity>;
  onToggleExpansion: (id: string) => void;
  onInspect: (node: StorylineDayNode) => void;
  onJumpToEntity: (entity: Entity, e?: React.MouseEvent) => void;
  onOpenImage: (img: string, node: StorylineDayNode, imageIndex: number) => void;
}

const StorylineMobileNodeCard = React.memo(function StorylineMobileNodeCard({
  node,
  index,
  isFirst,
  isLast,
  isExpanded,
  calendar,
  entityMap,
  onToggleExpansion,
  onInspect,
  onJumpToEntity,
  onOpenImage,
}: StorylineMobileNodeCardProps) {
  const isMajor = node.impact === 'major';
  const catConfig = EVENT_TYPES_CONFIG[node.primaryEventType] || EVENT_TYPES_CONFIG.mixed;
  const CatIcon = catConfig.icon;
  const [activeSessionIdx, setActiveSessionIdx] = useState<number>(0);

  const nodeEntities = useMemo(() => {
    return (node.allLinkedEntityIds || [])
      .map((id) => entityMap.get(id))
      .filter((e): e is Entity => Boolean(e));
  }, [node.allLinkedEntityIds, entityMap]);

  const hasMultipleSessions = node.sessions.length > 1;
  const currentSession =
    activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
      ? node.sessions[activeSessionIdx]
      : node.sessions[0];

  const currentSessionExcerpt = useMemo(() => {
    if (!currentSession?.recapText) return '';
    const text = currentSession.recapText.trim();
    const cleaned = text
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\n\s*\n+/g, ' ')
      .trim();
    if (cleaned.length > 220) {
      return cleaned.substring(0, 210).trim() + '...';
    }
    return cleaned;
  }, [currentSession?.recapText]);

  return (
    <div className="relative pl-7 sm:pl-8 pb-5 last:pb-2">
      {/* Vertical connecting line */}
      {!isLast && (
        <div className="absolute left-[11px] sm:left-[13px] top-6 bottom-0 w-[2px] bg-primary/25 pointer-events-none" />
      )}

      {/* Marker button on vertical axis */}
      <button
        type="button"
        onClick={() => onToggleExpansion(node.id)}
        className={`absolute left-0 sm:left-0.5 top-2.5 w-6 h-6 rounded-full border flex items-center justify-center transition-transform active:scale-95 cursor-pointer z-10 ${
          isMajor
            ? 'bg-primary/20 border-primary text-primary shadow-xs'
            : 'bg-surface-2 border-surface-3 text-content-2'
        }`}
        title={isExpanded ? 'Comprimi snodo' : 'Espandi snodo'}
      >
        <CatIcon size={12} />
      </button>

      {/* Card Body */}
      <div
        className={`w-full p-3.5 sm:p-4 flex flex-col gap-2.5 bg-surface-1 rounded-2xl border transition-all ${
          isMajor ? 'border-primary/40 shadow-xs' : 'border-surface-2 hover:border-surface-3'
        }`}
      >
        {/* Header Badges & Action Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {hasMultipleSessions ? (
              <span className="text-primary font-mono font-semibold text-[11px] bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-md">
                {node.sessions.length} Sessioni
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-primary font-mono font-semibold text-[11px] bg-surface-2 px-2 py-0.5 rounded-md border border-surface-3">
                  Cap. #{node.sessions[0]?.session.number}
                </span>
                {currentSession?.dayProgress?.isMultiDay && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-primary/10 text-primary border border-primary/20">
                    {currentSession.dayProgress.spanLabel}
                  </span>
                )}
              </div>
            )}

            <span className="text-content-3 text-[10px]">&bull;</span>
            <span className="text-content-2 text-[11px] flex items-center gap-1">
              <CatIcon size={11} className={catConfig.color} /> {catConfig.label}
            </span>

            {isMajor && (
              <span className="text-rose-400 font-medium text-[10px] bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md">
                Cruciale
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onInspect(node)}
              className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
              title="Dettaglio completo"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => onToggleExpansion(node.id)}
              className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Date Row */}
        <div className="flex items-center gap-1.5 text-xs text-content-3">
          <Calendar size={12} className="text-primary shrink-0" />
          <span className="font-medium text-content-1 font-mono text-[11px]">{node.fullDate}</span>
        </div>

        {/* Title */}
        <h3
          onClick={() => onToggleExpansion(node.id)}
          className="font-heading font-semibold text-sm text-content-1 hover:text-primary transition-colors cursor-pointer leading-snug"
        >
          {hasMultipleSessions ? (
            <span>
              Sessioni del Giorno &bull;{' '}
              <span className="text-primary">
                Cap. #{node.sessions.map((s) => s.session.number).join(', #')}
              </span>
            </span>
          ) : (
            <EntityMentionText text={node.sessions[0]?.title || `Capitolo #${node.sessions[0]?.session.number}`} />
          )}
        </h3>

        {/* Locations */}
        {node.allLocations.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-content-3">
            <MapPin size={11} className="shrink-0 text-accent-secondary" />
            <span className="truncate text-[11px]">{node.allLocations.join(' • ')}</span>
          </div>
        )}

        {/* Linked entities pills */}
        {nodeEntities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {nodeEntities.map((ent) => {
              const EIcon = ENTITY_ICONS[ent.type] || Users;
              return (
                <button
                  key={ent._id}
                  type="button"
                  onClick={(e) => onJumpToEntity(ent, e)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 text-[11px] transition-colors cursor-pointer"
                  title={`Scheda di ${ent.name}`}
                >
                  <EIcon size={10} className="text-primary" />
                  <span className="font-medium truncate max-w-[120px]">{ent.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Expandable Content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden space-y-3 pt-2 border-t border-surface-2"
            >
              {/* If multiple sessions in this day, tab switcher */}
              {hasMultipleSessions && (
                <div className="flex flex-wrap items-center gap-1 p-1 bg-surface-2/70 border border-surface-3/60 rounded-xl">
                  {node.sessions.map((sessItem, sIdx) => {
                    const isSelected = activeSessionIdx === sIdx;
                    return (
                      <button
                        key={sessItem.session._id}
                        type="button"
                        onClick={() => setActiveSessionIdx(sIdx)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer truncate max-w-[150px] ${
                          isSelected
                            ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                            : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                        }`}
                      >
                        Cap. #{sessItem.session.number}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setActiveSessionIdx(-1)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      activeSessionIdx === -1
                        ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                        : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                    }`}
                  >
                    Tutte ({node.sessions.length})
                  </button>
                </div>
              )}

              {/* Excerpt / Story content */}
              {activeSessionIdx === -1 && hasMultipleSessions ? (
                <div className="space-y-2.5">
                  {node.sessions.map((sessItem) => (
                    <div
                      key={sessItem.session._id}
                      className="p-3 bg-surface-2/50 border border-surface-3/50 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-surface-3/40 pb-1">
                        <span className="text-xs font-semibold text-primary font-mono">
                          Capitolo #{sessItem.session.number}: {sessItem.title}
                        </span>
                        <Link
                          to={`/sessions?select=${sessItem.session._id}`}
                          className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                        >
                          Apri <ExternalLink size={10} />
                        </Link>
                      </div>

                      {sessItem.recapText && (
                        <p className="text-xs text-content-2 leading-relaxed line-clamp-3">
                          <EntityMentionText
                            text={
                              sessItem.recapText.length > 180
                                ? sessItem.recapText.substring(0, 170).trim() + '...'
                                : sessItem.recapText
                            }
                          />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {hasMultipleSessions && currentSession && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-content-1">
                        Capitolo #{currentSession.session.number}: {currentSession.title}
                      </span>
                      <Link
                        to={`/sessions?select=${currentSession.session._id}`}
                        className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                      >
                        Vai alla sessione <ExternalLink size={10} />
                      </Link>
                    </div>
                  )}

                  {currentSessionExcerpt ? (
                    <p className="text-xs text-content-2 leading-relaxed">
                      <EntityMentionText text={currentSessionExcerpt} />
                    </p>
                  ) : (
                    <p className="text-xs text-content-3 italic">Nessun resoconto narrativo registrato.</p>
                  )}

                  {/* Structured events */}
                  {currentSession?.events && currentSession.events.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-content-3 uppercase tracking-wider flex items-center gap-1">
                        <Scroll size={11} /> Eventi Salienti ({currentSession.events.length})
                      </span>
                      <div className="space-y-1">
                        {currentSession.events.map((evt) => {
                          const EvtIcon = EVENT_TYPES_CONFIG[evt.eventType]?.icon || Scroll;
                          const evtColor = EVENT_TYPES_CONFIG[evt.eventType]?.color || 'text-primary';
                          return (
                            <div
                              key={evt.id}
                              className="bg-surface-2/60 border border-surface-3/50 rounded-lg p-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-1.5 font-medium text-content-1">
                                <span className="flex items-center gap-1.5">
                                  <EvtIcon size={12} className={evtColor} />
                                  <EntityMentionText text={evt.title} />
                                </span>
                                {evt.impact === 'major' && (
                                  <span className="text-[10px] text-rose-400 font-semibold">Cruciale</span>
                                )}
                              </div>
                              {evt.description && (
                                <p className="text-[11px] text-content-2 mt-1">
                                  {evt.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Images Carousel */}
              {(() => {
                const displayImages =
                  activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
                    ? node.sessions[activeSessionIdx].images
                    : node.allImages;
                const displayTitle =
                  activeSessionIdx >= 0 && activeSessionIdx < node.sessions.length
                    ? `Capitolo #${node.sessions[activeSessionIdx].session.number}: ${node.sessions[activeSessionIdx].title}`
                    : node.dayTitle;

                if (!displayImages || displayImages.length === 0) return null;
                return (
                  <StorylineImageCarousel
                    compact
                    images={displayImages}
                    title={displayTitle}
                    onOpenImage={(img, idx) => onOpenImage(img, node, idx)}
                  />
                );
              })()}

              {/* Footer Actions */}
              <div className="pt-2 border-t border-surface-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onInspect(node)}
                  className="text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  Vedi scheda completa <ExternalLink size={10} />
                </button>
                {currentSession && (
                  <Link
                    to={`/sessions?select=${currentSession.session._id}`}
                    className="text-content-3 hover:text-content-1 font-mono text-[11px]"
                  >
                    Diario &rarr;
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export function Storyline() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const { allPlayers } = useAuth();
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());
  const [chapters, setChapters] = useState<CampaignChapter[]>(() => CampaignManager.getChapters());
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [calendar, setCalendar] = useState(() => CampaignManager.getCalendar());
  const [entities, setEntities] = useState<Entity[]>(() => CampaignManager.getEntities());

  useEffect(() => {
    const handleDataUpdate = () => {
      setSessions(CampaignManager.getSessions());
      setChapters(CampaignManager.getChapters());
      setCalendar(CampaignManager.getCalendar());
      setEntities(CampaignManager.getEntities());
    };
    window.addEventListener('chronicle_sessions_updated', handleDataUpdate);
    window.addEventListener('chronicle_chapters_updated', handleDataUpdate);
    window.addEventListener('chronicle_entities_updated', handleDataUpdate);
    window.addEventListener('chronicle_calendar_updated', handleDataUpdate);
    window.addEventListener('chronicle_data_updated', handleDataUpdate);
    window.addEventListener('chronicle_campaign_changed', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);
    return () => {
      window.removeEventListener('chronicle_sessions_updated', handleDataUpdate);
      window.removeEventListener('chronicle_chapters_updated', handleDataUpdate);
      window.removeEventListener('chronicle_entities_updated', handleDataUpdate);
      window.removeEventListener('chronicle_calendar_updated', handleDataUpdate);
      window.removeEventListener('chronicle_data_updated', handleDataUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, []);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<'all' | 'major'>('all');
  const [selectedEventType, setSelectedEventType] = useState<'all' | EventCategoryType>('all');

  // Node expansion
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  // Add event modal
  const [selectedSessionForEvent, setSelectedSessionForEvent] = useState<Session | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLoreDate, setEventLoreDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventImpact, setEventImpact] = useState<'major' | 'normal' | 'secret'>('normal');
  const [eventCategory, setEventCategory] = useState<EventCategoryType>('combat');
  const [eventCharacters, setEventCharacters] = useState<string[]>([]);
  const [eventLinkedEntities, setEventLinkedEntities] = useState<string[]>([]);
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [entitySearchInModal, setEntitySearchInModal] = useState('');

  // Modals
  const [inspectedNode, setInspectedNode] = useState<StorylineDayNode | null>(null);
  const [inspectedSessionIdx, setInspectedSessionIdx] = useState<number>(0);
  const [isFullscreenViewerOpen, setIsFullscreenViewerOpen] = useState(false);
  const [fullscreenInitialSlideIndex, setFullscreenInitialSlideIndex] = useState(0);

  // Canvas Zoom & Pan State (Ref-based for 60/120 FPS butter smoothness)
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.6, Number((prev + 0.1).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.4, Number((prev - 0.1).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  const handleFitZoom = () => {
    setZoomLevel(0.75);
    if (timelineScrollRef.current) {
      const el = timelineScrollRef.current;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoomLevel((prev) => Math.min(1.6, Math.max(0.4, Number((prev + delta).toFixed(2)))));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, textarea, [data-interactive="true"], [role="button"]')) return;
    if (!timelineScrollRef.current) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: timelineScrollRef.current.scrollLeft,
      scrollTop: timelineScrollRef.current.scrollTop,
    };
    setIsCursorGrabbing(true);
  };

  const handleMouseLeave = () => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      setIsCursorGrabbing(false);
    }
  };

  const handleMouseUp = () => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      setIsCursorGrabbing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.isDragging || !timelineScrollRef.current) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      e.preventDefault();
      timelineScrollRef.current.scrollLeft = dragRef.current.scrollLeft - deltaX;
      timelineScrollRef.current.scrollTop = dragRef.current.scrollTop - deltaY;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, textarea, [data-interactive="true"], [role="button"]')) return;
    if (!timelineScrollRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    dragRef.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      scrollLeft: timelineScrollRef.current.scrollLeft,
      scrollTop: timelineScrollRef.current.scrollTop,
    };
    setIsCursorGrabbing(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.isDragging || !timelineScrollRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      timelineScrollRef.current.scrollLeft = dragRef.current.scrollLeft - deltaX;
      timelineScrollRef.current.scrollTop = dragRef.current.scrollTop - deltaY;
    }
  };

  const handleTouchEnd = () => {
    dragRef.current.isDragging = false;
    setIsCursorGrabbing(false);
  };

  const refreshData = () => {
    setSessions(CampaignManager.getSessions());
    setChapters(CampaignManager.getChapters());
    setCalendar(CampaignManager.getCalendar());
    setEntities(CampaignManager.getEntities());
  };

  const entityMap = useMemo(() => {
    // Privacy Fix Applied: Entities isolation
    const map = new Map<string, Entity>();
    entities.forEach((e) => {
      // Privacy filter
      if (e.type === 'quest' && e.questScope === 'personal') {
        if (e.assigneePlayerId !== player?._id && !(e.sharedWithDm && player?.isDm)) {
          return; // Skip adding this to the map
        }
      }
      map.set(e._id, e);
    });
    return map;
  }, [entities, player]);

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForEvent || !eventTitle.trim()) return;

    CampaignManager.addEventToSession(selectedSessionForEvent._id, {
      title: eventTitle.trim(),
      description: eventDesc.trim(),
      loreDate: eventLoreDate.trim() || undefined,
      location: eventLocation.trim() || undefined,
      impact: eventImpact,
      eventType: eventCategory,
      involvedCharacters: eventCharacters,
      linkedEntityIds: eventLinkedEntities,
      images: eventImages,
    });

    setEventTitle('');
    setEventDesc('');
    setEventLoreDate('');
    setEventLocation('');
    setEventImpact('normal');
    setEventCategory('combat');
    setEventCharacters([]);
    setEventLinkedEntities([]);
    setEventImages([]);
    setSelectedSessionForEvent(null);
    refreshData();
  };

  const filteredSessionsByChapter = useMemo(() => {
    if (selectedChapterId === 'all') return sessions;
    if (selectedChapterId === 'unassigned') {
      return sessions.filter((s) => !s.chapterId && !s.chapterName);
    }
    return sessions.filter(
      (s) => s.chapterId === selectedChapterId || s.chapterName === selectedChapterId
    );
  }, [sessions, selectedChapterId]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessionsByChapter].sort((a, b) => a.number - b.number);
  }, [filteredSessionsByChapter]);

  const allTimelineNodes = useMemo(() => {
    const dayMap = new Map<string, StorylineDayNode>();

    sortedSessions.forEach((sess) => {
      const sessionDays = extractLoreDaysForSession(sess, calendar);

      const recapText =
        sess.recap && sess.recap[0]?.children?.[0]?.text
          ? sess.recap[0].children[0].text
          : 'Sessione di campagna registrata.';

      const sessionCategory = deduceEventType(sess.title, recapText, sess.sessionType);

      const allEventsList: StorylineSessionEventItem[] = (sess.events || []).map((evt, idx) => ({
        id: evt.id || `evt_${sess._id}_${idx}`,
        title: evt.title,
        description: evt.description || '',
        loreDate: evt.loreDate || sess.loreDate || sess.date,
        location: evt.location,
        impact: evt.impact || 'normal',
        eventType: evt.eventType || deduceEventType(evt.title, evt.description, sess.sessionType),
        involvedCharacters: evt.involvedCharacters || [],
        linkedEntityIds: Array.from(new Set([...(sess.linkedEntityIds || []), ...(evt.linkedEntityIds || [])])),
        images: evt.images || [],
      }));

      const involvedChars = Array.from(
        new Set([
          ...(sess.attendees?.map((a) => a.characterName) || []),
          ...allEventsList.flatMap((e) => e.involvedCharacters || []),
        ])
      ).filter(Boolean);

      const linkedEntities = Array.from(
        new Set([...(sess.linkedEntityIds || []), ...allEventsList.flatMap((e) => e.linkedEntityIds || [])])
      ).filter(Boolean);

      const sessImages = Array.from(
        new Set([...(sess.images || []), ...allEventsList.flatMap((e) => e.images || [])])
      ).filter(Boolean);

      const sessionImpact =
        sess.events?.some((e) => e.impact === 'major') || allEventsList.some((e) => e.impact === 'major')
          ? 'major'
          : 'normal';

      const sessionLocation = sess.events?.find((e) => e.location)?.location;

      sessionDays.forEach((dayInfo) => {
        // Filter events specific to this day if specified, or include all if session is 1 day or event has no date
        let dayEvents = allEventsList;
        if (sessionDays.length > 1 && dayInfo.matchedDayOfMonth !== undefined) {
          const matchingEvents = allEventsList.filter((evt) => {
            if (!evt.loreDate) return false;
            const parsedEvt = parseLoreDateString(evt.loreDate, calendar.months || [], calendar.currentYear);
            if (parsedEvt && parsedEvt.startDay === dayInfo.matchedDayOfMonth) {
              if (dayInfo.matchedMonthIdx !== undefined && parsedEvt.monthIndex !== -1) {
                return parsedEvt.monthIndex === dayInfo.matchedMonthIdx;
              }
              return true;
            }
            return evt.loreDate.includes(`${dayInfo.matchedDayOfMonth}`);
          });

          // If specific events found for this day, use them; otherwise if start day, show unassigned events
          if (matchingEvents.length > 0) {
            dayEvents = matchingEvents;
          } else if (dayInfo.dayProgress?.currentDayNumber === 1) {
            // Unassigned events attached to start day
            dayEvents = allEventsList.filter((evt) => {
              if (!evt.loreDate) return true;
              const parsedEvt = parseLoreDateString(evt.loreDate, calendar.months || [], calendar.currentYear);
              return !parsedEvt || !parsedEvt.startDay;
            });
          } else {
            dayEvents = [];
          }
        }

        const sessionItem: StorylineDaySession = {
          session: sess,
          title: sess.title,
          recapText,
          category: sessionCategory,
          impact: sessionImpact,
          location: sessionLocation,
          events: dayEvents,
          involvedCharacters: involvedChars,
          linkedEntityIds: linkedEntities,
          images: sessImages,
          dayProgress: dayInfo.dayProgress,
        };

        if (dayMap.has(dayInfo.dayKey)) {
          const existingNode = dayMap.get(dayInfo.dayKey)!;
          existingNode.sessions.push(sessionItem);
          if (sessionImpact === 'major') {
            existingNode.impact = 'major';
          }
          if (sessionLocation && !existingNode.allLocations.includes(sessionLocation)) {
            existingNode.allLocations.push(sessionLocation);
          }
          sessionItem.events.forEach((evt) => {
            if (evt.location && !existingNode.allLocations.includes(evt.location)) {
              existingNode.allLocations.push(evt.location);
            }
          });
          existingNode.allLinkedEntityIds = Array.from(
            new Set([...existingNode.allLinkedEntityIds, ...sessionItem.linkedEntityIds])
          );
          existingNode.allInvolvedCharacters = Array.from(
            new Set([...existingNode.allInvolvedCharacters, ...sessionItem.involvedCharacters])
          );
          existingNode.allImages = Array.from(
            new Set([...existingNode.allImages, ...sessionItem.images])
          );
        } else {
          const allLocations: string[] = [];
          if (sessionLocation) allLocations.push(sessionLocation);
          sessionItem.events.forEach((evt) => {
            if (evt.location && !allLocations.includes(evt.location)) {
              allLocations.push(evt.location);
            }
          });

          const dayNode: StorylineDayNode = {
            id: `day_${dayInfo.dayKey}`,
            loreDate: dayInfo.fullDate,
            shortDate: dayInfo.shortDate,
            fullDate: dayInfo.fullDate,
            dayTitle: dayInfo.dayTitle,
            sortKey: dayInfo.sortKey,
            sessions: [sessionItem],
            primaryEventType: sessionCategory,
            impact: sessionImpact,
            allLocations,
            allLinkedEntityIds: sessionItem.linkedEntityIds,
            allInvolvedCharacters: sessionItem.involvedCharacters,
            allImages: sessionItem.images,
            order: 0,
          };
          dayMap.set(dayInfo.dayKey, dayNode);
        }
      });
    });

    const nodes = Array.from(dayMap.values()).sort((a, b) => a.sortKey - b.sortKey);
    nodes.forEach((n, idx) => {
      n.order = idx;
    });

    return nodes;
  }, [sortedSessions, calendar]);

  useEffect(() => {
    if (allTimelineNodes.length > 0) {
      setExpandedNodeIds((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, boolean> = {};
        allTimelineNodes.forEach((node) => {
          initial[node.id] = true;
        });
        return initial;
      });
    }
  }, [allTimelineNodes]);

  const filteredNodes = useMemo(() => {
    return allTimelineNodes.filter((node) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        node.dayTitle.toLowerCase().includes(q) ||
        node.fullDate.toLowerCase().includes(q) ||
        node.shortDate.toLowerCase().includes(q) ||
        node.allLocations.some((loc) => loc.toLowerCase().includes(q)) ||
        node.allInvolvedCharacters.some((c) => c.toLowerCase().includes(q)) ||
        node.sessions.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.recapText.toLowerCase().includes(q) ||
            s.events.some((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
        ) ||
        node.allLinkedEntityIds.some((entId) => {
          const ent = entityMap.get(entId);
          return ent && ent.name.toLowerCase().includes(q);
        });

      const matchChar =
        selectedCharacter === 'all' ||
        node.allInvolvedCharacters.includes(selectedCharacter);

      const matchImpact =
        filterImpact === 'all' ||
        node.impact === 'major' ||
        node.sessions.some((s) => s.impact === 'major');

      const matchType =
        selectedEventType === 'all' ||
        node.primaryEventType === selectedEventType ||
        node.sessions.some(
          (s) => s.category === selectedEventType || s.events.some((e) => e.eventType === selectedEventType)
        );

      return matchSearch && matchChar && matchImpact && matchType;
    });
  }, [allTimelineNodes, searchQuery, selectedCharacter, filterImpact, selectedEventType, entityMap]);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const current = prev[nodeId] !== false;
      return {
        ...prev,
        [nodeId]: !current,
      };
    });
  }, []);

  const expandAllNodes = () => {
    const next: Record<string, boolean> = {};
    filteredNodes.forEach((n) => {
      next[n.id] = true;
    });
    setExpandedNodeIds(next);
  };

  const collapseAllNodes = () => {
    const next: Record<string, boolean> = {};
    filteredNodes.forEach((n) => {
      next[n.id] = false;
    });
    setExpandedNodeIds(next);
  };

  const areAllExpanded = useMemo(() => {
    if (filteredNodes.length === 0) return false;
    return filteredNodes.every((n) => expandedNodeIds[n.id] !== false);
  }, [filteredNodes, expandedNodeIds]);

  const scrollTimeline = useCallback((offset: number) => {
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  }, []);

  const scrollToNode = useCallback((nodeId: string) => {
    const el = document.getElementById(`timeline-node-${nodeId}`);
    if (el && timelineScrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, []);

  // Center vertical scroll on mount and when changing chapter or filter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (timelineScrollRef.current) {
        const el = timelineScrollRef.current;
        const targetTop = (el.scrollHeight - el.clientHeight) / 2;
        if (targetTop > 0) {
          el.scrollTop = targetTop;
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedChapterId, filteredNodes.length]);

  const handleJumpToEntity = useCallback(
    (entity: Entity, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      navigate(`/entities/${entity.type}/${entity._id}`);
    },
    [navigate]
  );

  const handleInspectNode = useCallback((node: StorylineDayNode) => {
    setInspectedNode(node);
    setInspectedSessionIdx(0);
  }, []);

  const handleUpdateSessionImages = useCallback(
    (sessionId: string, newImages: string[]) => {
      if (!inspectedNode) return;

      CampaignManager.updateSession(sessionId, {
        images: newImages,
      });

      setInspectedNode((prev) => {
        if (!prev) return null;
        const nextSessions = prev.sessions.map((s) => {
          if (s.session._id === sessionId) {
            return {
              ...s,
              session: { ...s.session, images: newImages },
              images: newImages,
            };
          }
          return s;
        });
        const combinedImages = Array.from(new Set(nextSessions.flatMap((s) => s.images)));
        return {
          ...prev,
          sessions: nextSessions,
          allImages: combinedImages,
        };
      });

      refreshData();
    },
    [inspectedNode, refreshData]
  );

  // Chronological storyline slides across all nodes in current filtered view (or all nodes)
  const storylineSlides = useMemo<StorylineSlide[]>(() => {
    const slides: StorylineSlide[] = [];
    let globalIdx = 0;
    const targetNodes = filteredNodes.length > 0 ? filteredNodes : allTimelineNodes;

    targetNodes.forEach((node) => {
      node.sessions.forEach((s) => {
        const valid = (s.images || []).filter(Boolean);
        if (valid.length > 0) {
          const totalInSession = valid.length;
          valid.forEach((imgUrl, imgIdx) => {
            slides.push({
              imageUrl: imgUrl,
              nodeId: node.id,
              nodeTitle: `Capitolo #${s.session.number}: ${s.title}`,
              nodeDescription: s.recapText,
              nodeType: 'session',
              loreDate: node.fullDate || s.session.loreDate || s.session.date || '',
              sessionNumber: s.session.number,
              sessionTitle: s.session.title,
              chapterName: s.session.chapterName,
              location: s.location || node.allLocations[0],
              eventType: s.category,
              impact: s.impact,
              imageIndexInNode: imgIdx,
              nodeTotalImages: totalInSession,
              globalIndex: globalIdx,
              totalGlobalImages: 0,
              sessionId: s.session._id,
              sessionObj: s.session,
              isPlaceholder: false,
            });
            globalIdx++;
          });
        } else {
          // Session without photos: add a placeholder slide so presentation always works!
          slides.push({
            imageUrl: '',
            nodeId: node.id,
            nodeTitle: `Capitolo #${s.session.number}: ${s.title}`,
            nodeDescription: s.recapText,
            nodeType: 'session',
            loreDate: node.fullDate || s.session.loreDate || s.session.date || '',
            sessionNumber: s.session.number,
            sessionTitle: s.session.title,
            chapterName: s.session.chapterName,
            location: s.location || node.allLocations[0],
            eventType: s.category,
            impact: s.impact,
            imageIndexInNode: 0,
            nodeTotalImages: 0,
            globalIndex: globalIdx,
            totalGlobalImages: 0,
            sessionId: s.session._id,
            sessionObj: s.session,
            isPlaceholder: true,
          });
          globalIdx++;
        }
      });
    });

    return slides.map((s) => ({ ...s, totalGlobalImages: slides.length }));
  }, [filteredNodes, allTimelineNodes]);

  const handleOpenImage = useCallback(
    (img: string, node?: StorylineDayNode, imageIndexInNode = 0) => {
      if (storylineSlides.length === 0) return;
      if (node) {
        const foundIdx = storylineSlides.findIndex(
          (s) => s.nodeId === node.id && (s.imageIndexInNode === imageIndexInNode || s.imageUrl === img)
        );
        if (foundIdx !== -1) {
          setFullscreenInitialSlideIndex(foundIdx);
        } else {
          const firstByNode = storylineSlides.findIndex((s) => s.nodeId === node.id);
          setFullscreenInitialSlideIndex(firstByNode !== -1 ? firstByNode : 0);
        }
      } else {
        const imgIdx = storylineSlides.findIndex((s) => s.imageUrl === img);
        setFullscreenInitialSlideIndex(imgIdx !== -1 ? imgIdx : 0);
      }
      setIsFullscreenViewerOpen(true);
    },
    [storylineSlides]
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col p-3 sm:p-4 max-w-[1800px] mx-auto w-full gap-2.5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-surface-2 pb-2.5 shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-heading font-semibold text-content-1 flex items-center gap-2">
            Storyline
          </h1>
          <p className="text-[11px] sm:text-xs text-content-3">
            Nodi narrativi ed eventi scanditi dalle date del calendario di gioco
          </p>
        </div>

        <Link
          to="/calendar"
          className="bg-surface-1 border border-surface-2 hover:border-surface-3 px-3 py-1.5 rounded-xl flex items-center gap-2.5 transition-colors shrink-0"
        >
          <div className="w-6 h-6 rounded-lg bg-surface-2 border border-surface-3 text-primary flex items-center justify-center">
            <Clock size={13} />
          </div>
          <div>
            <span className="text-[9px] text-content-3 block font-mono leading-none">Data Corrente</span>
            <p className="text-[11px] font-semibold text-content-1 leading-tight mt-0.5">
              {calendar.currentDay} {calendar.months[calendar.currentMonthIndex]?.name}, {calendar.currentYear} {calendar.yearSuffix || ''}
            </p>
          </div>
        </Link>
      </div>

      {/* Filter and Control Bar */}
      <div className="space-y-2 shrink-0">
        {/* Chapter Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-1 rounded-xl px-3 py-2 border border-surface-2">
          <div className="flex items-center gap-2">
            <Bookmark size={14} className="text-primary shrink-0" />
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              className="bg-transparent text-xs font-medium text-content-1 outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-1">Tutta la Campagna ({sessions.length} sessioni)</option>
              {chapters.map((chap) => {
                const count = sessions.filter((s) => s.chapterId === chap.id || s.chapterName === chap.name).length;
                return (
                  <option key={chap.id} value={chap.id} className="bg-surface-1">
                    {chap.name} ({count} sessioni)
                  </option>
                );
              })}
              <option value="unassigned" className="bg-surface-1">
                Non Assegnate ({sessions.filter((s) => !s.chapterName && !s.chapterId).length})
              </option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedChapterId('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedChapterId === 'all'
                  ? 'bg-surface-2 text-content-1 border border-surface-3'
                  : 'text-content-3 hover:text-content-1'
              }`}
            >
              Tutti
            </button>
            {chapters.map((chap) => {
              const isSelected = selectedChapterId === chap.id;
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => setSelectedChapterId(chap.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-surface-2 text-content-1 border border-surface-3'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: chap.color || '#6366f1' }}
                  />
                  {chap.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Mobile Filter Bar (Clean & Compact) */}
          <div className="flex sm:hidden items-center justify-between gap-2 w-full">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
              <input
                type="text"
                placeholder="Cerca nella storyline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-1 border border-surface-2 focus:border-primary rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 placeholder-content-3 outline-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterImpact(filterImpact === 'all' ? 'major' : 'all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                filterImpact === 'major'
                  ? 'bg-primary text-surface-0 font-semibold'
                  : 'bg-surface-1 border border-surface-2 text-content-2'
              }`}
            >
              {filterImpact === 'major' ? 'Cruciali' : 'Tutti'}
            </button>

            {storylineSlides.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFullscreenInitialSlideIndex(0);
                  setIsFullscreenViewerOpen(true);
                }}
                className="bg-primary text-surface-0 hover:bg-primary-hover px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-sm cursor-pointer"
                title="Visualizza la cronaca a schermo intero"
              >
                <Film size={13} />
                <span>Cronaca ({storylineSlides.length})</span>
              </button>
            )}
          </div>

          {/* Desktop Search & Filters */}
          <div className="hidden sm:flex relative flex-1 w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
            <input
              type="text"
              placeholder="Cerca evento, luogo, NPC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-1 border border-surface-2 focus:border-primary rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 placeholder-content-3 outline-none transition-colors"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 w-auto">
            <div className="w-44 shrink-0">
              <select
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
                className="w-full bg-surface-1 border border-surface-2 focus:border-primary rounded-xl px-2.5 py-1.5 text-xs text-content-1 outline-none"
              >
                <option value="all" className="bg-surface-1">Tutti i Protagonisti ({allPlayers.length})</option>
                {allPlayers.map((p) => (
                  <option key={p._id} value={p.characterName} className="bg-surface-1">
                    {p.characterName} {p.isDm ? '(DM)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setFilterImpact(filterImpact === 'all' ? 'major' : 'all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                filterImpact === 'major'
                  ? 'bg-primary text-surface-0 font-semibold'
                  : 'bg-surface-1 border border-surface-2 text-content-2 hover:text-content-1'
              }`}
            >
              Solo Cruciali
            </button>

            {storylineSlides.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFullscreenInitialSlideIndex(0);
                  setIsFullscreenViewerOpen(true);
                }}
                className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-sm cursor-pointer"
                title="Ripercorri visivamente l'arco o la campagna a schermo intero con il party"
              >
                <Film size={13} />
                <span>Presentazione Party ({storylineSlides.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={areAllExpanded ? collapseAllNodes : expandAllNodes}
              className="bg-surface-1 hover:bg-surface-2 border border-surface-2 text-content-2 hover:text-content-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {areAllExpanded ? (
                <>
                  <Minimize2 size={13} /> Comprimi
                </>
              ) : (
                <>
                  <Maximize2 size={13} /> Espandi
                </>
              )}
            </button>

            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionForEvent(sessions[0]);
                  setEventLoreDate(sessions[0].loreDate || '');
                  setEventLinkedEntities(sessions[0].linkedEntityIds || []);
                }}
                className="bg-primary text-surface-0 hover:bg-primary-hover px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Nuovo Evento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      {filteredNodes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-surface-1 rounded-2xl border border-dashed border-surface-2 p-8">
          <Scroll size={36} className="mx-auto text-content-3 mb-2" />
          <p className="text-sm font-medium text-content-2">Nessun evento corrisponde ai filtri della storyline.</p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW (Dedicated Vertical Chronological Storyline Feed) */}
          <div className="md:hidden flex-1 min-h-0 bg-surface-1 border border-surface-2 rounded-2xl flex flex-col overflow-hidden shadow-sm">
            {/* Mobile Header / Count Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-surface-2 bg-surface-1/90 backdrop-blur-sm shrink-0">
              <span className="text-xs font-semibold text-content-2 font-mono">
                {filteredNodes.length} nodi cronologici
              </span>

              <button
                type="button"
                onClick={areAllExpanded ? collapseAllNodes : expandAllNodes}
                className="bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-2 hover:text-content-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title={areAllExpanded ? 'Comprimi tutti' : 'Espandi tutti'}
              >
                {areAllExpanded ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Comprimi</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} />
                    <span>Espandi</span>
                  </>
                )}
              </button>
            </div>

            {/* Mobile Vertical Feed Stream */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-1">
              {filteredNodes.map((node, index) => (
                <StorylineMobileNodeCard
                  key={`mobile_${node.id}`}
                  node={node}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === filteredNodes.length - 1}
                  isExpanded={expandedNodeIds[node.id] !== false}
                  calendar={calendar}
                  entityMap={entityMap}
                  onToggleExpansion={toggleNodeExpansion}
                  onInspect={handleInspectNode}
                  onJumpToEntity={handleJumpToEntity}
                  onOpenImage={handleOpenImage}
                />
              ))}
            </div>
          </div>

          {/* DESKTOP VIEW (Interactive Horizontal Canvas with Zoom & Pan) */}
          <div className="hidden md:flex flex-1 min-h-0 bg-surface-1 border border-surface-2 rounded-2xl flex-col overflow-hidden shadow-sm relative">
            {/* Canvas Toolbar with Zoom and Pan controls */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-2 bg-surface-1/90 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-content-2 font-mono">
                  {filteredNodes.length} nodi cronologici
                </span>
                <span className="text-[11px] text-content-3 bg-surface-2 px-2 py-0.5 rounded-md">
                  Ctrl + Rotellina per zoomare &bull; Trascina per scorrere
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-surface-2 border border-surface-3 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1.5 rounded-lg hover:bg-surface-3 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                    title="Rimpicciolisci / Zoom Out (Ctrl + Rotellina Giù)"
                  >
                    <ZoomOut size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 text-xs font-mono font-semibold text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer"
                    title="Reimposta al 100%"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1.5 rounded-lg hover:bg-surface-3 text-content-2 hover:text-content-1 transition-colors cursor-pointer"
                    title="Ingrandisci / Zoom In (Ctrl + Rotellina Su)"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Fit Overview Button */}
                <button
                  type="button"
                  onClick={handleFitZoom}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 text-xs font-medium transition-colors cursor-pointer"
                  title="Visualizzazione Panoramica Adattata"
                >
                  <RotateCcw size={12} />
                  <span>Panoramica</span>
                </button>

                {/* Horizontal Scroll Arrows */}
                <div className="flex items-center gap-1 pl-1 border-l border-surface-3">
                  <button
                    type="button"
                    onClick={() => scrollTimeline(-450)}
                    className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors cursor-pointer"
                    title="Scorri Sinistra"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollTimeline(450)}
                    className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors cursor-pointer"
                    title="Scorri Destra"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline Viewport */}
            <div
              ref={timelineScrollRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`overflow-auto flex-1 custom-scrollbar relative select-none bg-surface-0/30 touch-none ${
                isCursorGrabbing ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                scrollBehavior: isCursorGrabbing ? 'auto' : 'smooth',
                willChange: isCursorGrabbing ? 'scroll-position' : 'auto',
              }}
            >
              <div
                className="transition-transform duration-100 ease-out py-72 sm:py-80 px-16 sm:px-24 flex items-center gap-12 sm:gap-16 min-h-[1200px]"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'left center',
                  width: 'max-content',
                }}
              >
                {filteredNodes.map((node, index) => (
                  <TimelineNodeCard
                    key={node.id}
                    node={node}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === filteredNodes.length - 1}
                    isExpanded={expandedNodeIds[node.id] !== false}
                    calendar={calendar}
                    entityMap={entityMap}
                    onToggleExpansion={toggleNodeExpansion}
                    onInspect={handleInspectNode}
                    onJumpToEntity={handleJumpToEntity}
                    onOpenImage={handleOpenImage}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* INSPECTED NODE MODAL */}
      <AnimatePresence>
        {inspectedNode && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-surface-0/80 backdrop-blur-sm"
            onClick={() => setInspectedNode(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-1 border border-surface-2 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-surface-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono font-medium text-primary bg-surface-2 px-2 py-0.5 rounded">
                      {inspectedNode.sessions.length > 1
                        ? `Giorno di Lore &bull; ${inspectedNode.sessions.length} Sessioni`
                        : `Capitolo #${inspectedNode.sessions[0]?.session.number}`}
                    </span>
                    {inspectedNode.primaryEventType && (
                      <span className="text-xs text-content-2 bg-surface-2 px-2 py-0.5 rounded">
                        {EVENT_TYPES_CONFIG[inspectedNode.primaryEventType]?.label}
                      </span>
                    )}
                    {inspectedNode.impact === 'major' && (
                      <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded font-medium">
                        Cruciale
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-heading font-semibold text-content-1">
                    {inspectedNode.sessions.length > 1 ? (
                      <span>Sessioni del Giorno</span>
                    ) : (
                      <EntityMentionText text={inspectedNode.sessions[0]?.title || `Capitolo #${inspectedNode.sessions[0]?.session.number}`} />
                    )}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedNode(null)}
                  className="p-1 text-content-3 hover:text-content-1 rounded-md transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
                {/* Lore date and locations */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-content-3 bg-surface-2 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-primary shrink-0" />
                    <span className="font-medium text-content-1">{inspectedNode.fullDate}</span>
                  </div>
                  {inspectedNode.allLocations.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="shrink-0" />
                      <span>{inspectedNode.allLocations.join(' &bull; ')}</span>
                    </div>
                  )}
                </div>

                {/* If multiple sessions in day, tab navigation */}
                {inspectedNode.sessions.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-2/80 border border-surface-3/60 rounded-xl">
                    {inspectedNode.sessions.map((sessItem, sIdx) => {
                      const isSelected = inspectedSessionIdx === sIdx;
                      return (
                        <button
                          key={sessItem.session._id}
                          type="button"
                          onClick={() => setInspectedSessionIdx(sIdx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer truncate max-w-[200px] ${
                            isSelected
                              ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                              : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                          }`}
                        >
                          Cap. #{sessItem.session.number}: {sessItem.title}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setInspectedSessionIdx(-1)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        inspectedSessionIdx === -1
                          ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                          : 'text-content-3 hover:text-content-1 hover:bg-surface-3/50'
                      }`}
                    >
                      Tutte ({inspectedNode.sessions.length})
                    </button>
                  </div>
                )}

                {/* Linked Entities in this Day */}
                {inspectedNode.allLinkedEntityIds && inspectedNode.allLinkedEntityIds.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AtSign size={13} /> Entità Collegate al Giorno ({inspectedNode.allLinkedEntityIds.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {inspectedNode.allLinkedEntityIds.map((entId) => {
                        const ent = entityMap.get(entId);
                        if (!ent) return null;
                        const EIcon = ENTITY_ICONS[ent.type] || Users;
                        return (
                          <div
                            key={ent._id}
                            onClick={() => handleJumpToEntity(ent)}
                            className="bg-surface-2 hover:bg-surface-3 border border-surface-3 p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center shrink-0">
                                <EIcon size={14} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-content-1 truncate">
                                  {ent.name}
                                </p>
                                <span className="text-[10px] text-content-3">
                                  {ENTITY_TYPE_LABELS[ent.type] || ent.type}
                                </span>
                              </div>
                            </div>
                            <ExternalLink size={12} className="text-content-3 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Session(s) Narrative Content */}
                {inspectedSessionIdx === -1 && inspectedNode.sessions.length > 1 ? (
                  <div className="space-y-4">
                    {inspectedNode.sessions.map((sessItem) => (
                      <div
                        key={sessItem.session._id}
                        className="bg-surface-2 p-4 rounded-xl border border-surface-3 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-surface-3/50 pb-2">
                          <div>
                            <span className="text-xs font-mono font-bold text-primary">
                              Capitolo #{sessItem.session.number}
                            </span>
                            <h4 className="text-sm font-heading font-semibold text-content-1 mt-0.5">
                              {sessItem.title}
                            </h4>
                          </div>
                          <Link
                            to={`/sessions?select=${sessItem.session._id}`}
                            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            Apri sessione <ExternalLink size={11} />
                          </Link>
                        </div>

                        {sessItem.recapText && (
                          <div className="text-sm text-content-1 leading-relaxed">
                            <MarkdownRenderer content={sessItem.recapText} />
                          </div>
                        )}

                        {/* Involved Characters */}
                        {sessItem.involvedCharacters && sessItem.involvedCharacters.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sessItem.involvedCharacters.map((charName, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-surface-1 border border-surface-3/60 text-[11px] text-content-3"
                              >
                                #{charName}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Visual memories of this specific session */}
                        <div className="pt-2 border-t border-surface-3/50 space-y-2">
                          <StorylineImageCarousel
                            key={`carousel_item_${sessItem.session._id}`}
                            images={sessItem.images || []}
                            title={`Capitolo #${sessItem.session.number}: ${sessItem.title}`}
                            subtitle={`Sessione #${sessItem.session.number}`}
                            onOpenImage={(img, idx) => handleOpenImage(img, inspectedNode, idx)}
                            editable={true}
                            onUpdateImages={(newImgs) => handleUpdateSessionImages(sessItem.session._id, newImgs)}
                            contextDescription={sessItem.recapText}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const currentSess =
                      inspectedSessionIdx >= 0 && inspectedSessionIdx < inspectedNode.sessions.length
                        ? inspectedNode.sessions[inspectedSessionIdx]
                        : inspectedNode.sessions[0];
                    if (!currentSess) return null;

                    return (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider">
                              Dettagli Narrativi &bull; Capitolo #{currentSess.session.number}: {currentSess.title}
                            </h4>
                            <Link
                              to={`/sessions?select=${currentSess.session._id}`}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              Apri nel Diario <ExternalLink size={11} />
                            </Link>
                          </div>
                          <div className="bg-surface-2 p-4 rounded-xl text-sm text-content-1 leading-relaxed">
                            <MarkdownRenderer content={currentSess.recapText || 'Nessun resoconto registrato.'} />
                          </div>
                        </div>

                        {/* Events list */}
                        {currentSess.events.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Scroll size={13} /> Eventi Salienti del Capitolo ({currentSess.events.length})
                            </h4>
                            <div className="space-y-2">
                              {currentSess.events.map((evt) => {
                                const EvtIcon = EVENT_TYPES_CONFIG[evt.eventType]?.icon || Scroll;
                                const evtColor = EVENT_TYPES_CONFIG[evt.eventType]?.color || 'text-primary';
                                return (
                                  <div
                                    key={evt.id}
                                    className="bg-surface-2 p-3 rounded-xl border border-surface-3 space-y-1 text-xs"
                                  >
                                    <div className="flex items-center justify-between font-medium text-content-1">
                                      <span className="flex items-center gap-1.5">
                                        <EvtIcon size={13} className={evtColor} />
                                        <EntityMentionText text={evt.title} />
                                      </span>
                                      {evt.impact === 'major' && (
                                        <span className="text-[10px] text-rose-400 font-semibold">Cruciale</span>
                                      )}
                                    </div>
                                    {evt.description && (
                                      <p className="text-content-2 text-xs leading-relaxed mt-1">
                                        {evt.description}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Involved Characters */}
                        {currentSess.involvedCharacters.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider mb-2">
                              Personaggi Coinvolti
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {currentSess.involvedCharacters.map((charName, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-2 font-medium"
                                >
                                  #{charName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Visual memories of this specific session */}
                        <div className="pt-1 space-y-2">
                          <StorylineImageCarousel
                            key={`carousel_sess_${currentSess.session._id}`}
                            images={currentSess.images || []}
                            title={`Capitolo #${currentSess.session.number}: ${currentSess.title}`}
                            subtitle={`Sessione #${currentSess.session.number}`}
                            onOpenImage={(img, idx) => handleOpenImage(img, inspectedNode, idx)}
                            editable={true}
                            onUpdateImages={(newImgs) => handleUpdateSessionImages(currentSess.session._id, newImgs)}
                            contextDescription={currentSess.recapText}
                          />
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              <div className="p-4 border-t border-surface-2 bg-surface-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {inspectedNode.sessions.map((s) => (
                    <Link
                      key={s.session._id}
                      to={`/sessions?select=${s.session._id}`}
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      Cap. #{s.session.number} &rarr;
                    </Link>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedNode(null)}
                  className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-medium transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INSERT EVENT MODAL */}
      {selectedSessionForEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-surface-0/80 backdrop-blur-sm">
          <div className="bg-surface-1 border border-surface-2 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-surface-2 p-5">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-primary" />
                <div>
                  <h3 className="font-heading font-semibold text-base text-content-1">
                    Nuovo Evento nella Storyline
                  </h3>
                  <p className="text-xs text-content-3">
                    Capitolo #{selectedSessionForEvent.number} &bull; {selectedSessionForEvent.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionForEvent(null)}
                className="text-content-3 hover:text-content-1 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-content-2 mb-1">
                    Titolo Evento * (puoi usare @ per menzionare NPC o Quest)
                  </label>
                  <MentionInput
                    value={eventTitle}
                    onValueChange={setEventTitle}
                    placeholder="es. Scontro al Passo d'Inverno o Incontro con @[Lord Vane]"
                    required
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1">
                      Tipologia
                    </label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value as EventCategoryType)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-xs text-content-1 outline-none"
                    >
                      <option value="combat">Combattimento</option>
                      <option value="roleplay">Interpretazione</option>
                      <option value="exploration">Esplorazione</option>
                      <option value="investigation">Investigazione</option>
                      <option value="lore">Lore & Rivelazione</option>
                      <option value="mixed">Mista</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1">
                      Importanza
                    </label>
                    <select
                      value={eventImpact}
                      onChange={(e) => setEventImpact(e.target.value as any)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-xs text-content-1 outline-none"
                    >
                      <option value="normal">Normale</option>
                      <option value="major">Cruciale</option>
                      <option value="secret">Segreto</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <LoreDateInput
                      label="Data Lore Evento"
                      value={eventLoreDate}
                      onChange={setEventLoreDate}
                      session={selectedSessionForEvent}
                      placeholder="es. 14 Alturiak"
                      inputClassName="rounded-xl px-3.5 py-2 border-surface-3"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-content-2 mb-1">
                      Luogo
                    </label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="es. Cripta dei Sospiri"
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none"
                    />
                  </div>
                </div>

                {/* Link Entities */}
                <div className="space-y-2 bg-surface-2 p-3.5 rounded-xl border border-surface-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-content-2 flex items-center gap-1">
                      <AtSign size={12} /> Entità Collegate
                    </label>
                    <span className="text-xs text-content-3 font-mono">
                      {eventLinkedEntities.length} selezionate
                    </span>
                  </div>

                  <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                    {entities.map((ent) => {
                      const isSelected = eventLinkedEntities.includes(ent._id);
                      return (
                        <button
                          key={ent._id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setEventLinkedEntities((prev) => prev.filter((id) => id !== ent._id));
                            } else {
                              setEventLinkedEntities((prev) => [...prev, ent._id]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                            isSelected
                              ? 'bg-primary text-surface-0'
                              : 'bg-surface-1 text-content-2 hover:text-content-1 border border-surface-3'
                          }`}
                        >
                          <span>{ent.name}</span>
                          {isSelected && <Check size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-content-2 mb-1">
                    Descrizione Evento * (usa @ per menzioni)
                  </label>
                  <MentionTextarea
                    value={eventDesc}
                    onValueChange={setEventDesc}
                    placeholder="Descrivi cosa è successo durante l'evento..."
                    rows={3}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-3 text-xs text-content-1 outline-none resize-none"
                  />
                </div>

                {/* Event Images / Memories */}
                <div className="pt-1">
                  <ImageGalleryUploader
                    images={eventImages}
                    onChange={setEventImages}
                    label="Immagini &amp; Carosello Illustrazioni dello Snodo"
                    entityName={eventTitle}
                    contextDescription={eventDesc}
                  />
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-surface-2 bg-surface-1">
                <button
                  type="button"
                  onClick={() => setSelectedSessionForEvent(null)}
                  className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-medium text-xs shadow-sm transition-colors"
                >
                  Salva Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Storyline Fullscreen Presentation & Carousel Viewer */}
      <StorylineFullscreenViewer
        isOpen={isFullscreenViewerOpen}
        onClose={() => setIsFullscreenViewerOpen(false)}
        slides={storylineSlides}
        initialSlideIndex={fullscreenInitialSlideIndex}
        onSelectNode={(nodeId) => {
          scrollToNode(nodeId);
          const targetNode = allTimelineNodes.find((n) => n.id === nodeId);
          if (targetNode) {
            setInspectedNode(targetNode);
          }
        }}
      />
    </div>
  );
}
