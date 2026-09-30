import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Calendar,
  MapPin,
  Sparkles,
  Clock,
  BookOpen,
  Play,
  Pause,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Compass,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
  FileText,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Portal } from './Portal';

export interface StorylineSlide {
  imageUrl: string;
  nodeId: string;
  nodeTitle: string;
  nodeDescription?: string;
  nodeType: 'session' | 'event';
  loreDate: string;
  sessionNumber: number;
  sessionTitle: string;
  chapterName?: string;
  location?: string;
  eventType?: string;
  impact?: 'normal' | 'major' | 'secret';
  imageIndexInNode: number; // 0-based
  nodeTotalImages: number;
  globalIndex: number; // 0-based
  totalGlobalImages: number;
  sessionId?: string;
  sessionObj?: any;
  isPlaceholder?: boolean;
}

interface StorylineFullscreenViewerProps {
  slides: StorylineSlide[];
  initialSlideIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

// Dedicated Mobile Cronaca Viewer (Direct Fullscreen Card & Artwork with Reading Mode)
const MobileCronacaViewer: React.FC<{
  slides: StorylineSlide[];
  initialSlideIndex: number;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}> = ({ slides, initialSlideIndex, onClose, onSelectNode }) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [isReadingMode, setIsReadingMode] = useState(false);

  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialSlideIndex, slides.length - 1)));
    setIsReadingMode(false);
  }, [initialSlideIndex, slides.length]);

  const currentSlide: StorylineSlide | undefined = slides[currentIndex];
  if (!currentSlide) return null;

  // Identify all slides belonging to the current session (for photo counter badge)
  const sessionSlides = useMemo(() => {
    if (!currentSlide) return [];
    return slides.filter(
      (s) =>
        s.nodeId === currentSlide.nodeId ||
        (s.sessionId && currentSlide.sessionId && s.sessionId === currentSlide.sessionId)
    );
  }, [slides, currentSlide]);

  const hasMultiplePhotosInSession = sessionSlides.length > 1;
  const currentPhotoIndexInSession = sessionSlides.findIndex(
    (s) => s.globalIndex === currentSlide.globalIndex || s.imageIndexInNode === currentSlide.imageIndexInNode
  );

  // Linear Horizontal Navigation (Next / Prev Slide like desktop)
  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
    setIsReadingMode(false);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
    setIsReadingMode(false);
  };

  const hasImage = Boolean(currentSlide.imageUrl && !currentSlide.isPlaceholder);

  // Horizontal swipe detection only on the stage (NOT during reading mode)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (isReadingMode) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleStageTouchEnd = (e: React.TouchEvent) => {
    if (isReadingMode || !touchStartRef.current) return;
    const diffX = touchStartRef.current.x - e.changedTouches[0].clientX;
    const diffY = touchStartRef.current.y - e.changedTouches[0].clientY;
    touchStartRef.current = null;

    // Only respond to distinct horizontal swipes (ignore vertical movement completely)
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Clean raw excerpt without mentions or markdown syntax
  const cleanExcerpt = useMemo(() => {
    if (!currentSlide.nodeDescription) return '';
    return currentSlide.nodeDescription
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/(?<!\[)@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
      .replace(/#+/g, '')
      .replace(/\*+/g, '')
      .trim();
  }, [currentSlide.nodeDescription]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-surface-0 select-none flex flex-col justify-between overflow-hidden">
        {/* Top Minimal Bar */}
        <div className="relative z-30 flex items-center justify-between p-4 pt-safe shrink-0 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-surface-1/80 backdrop-blur-md text-xs font-mono font-semibold text-primary border border-primary/30">
              Cap. #{currentSlide.sessionNumber}
            </span>
            <span className="text-xs font-mono text-content-3">
              {currentIndex + 1} / {slides.length}
            </span>
            {hasMultiplePhotosInSession && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-semibold border border-primary/30">
                Foto {currentPhotoIndexInSession + 1}/{sessionSlides.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-surface-1/80 hover:bg-surface-2 text-content-1 backdrop-blur-md border border-surface-3 transition-colors cursor-pointer shadow-lg active:scale-95"
              title="Chiudi Cronaca"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Central Stage (Artwork or Consistent Dark Fantasy Placeholder with horizontal Dx/Sx navigation) */}
        <div
          className="relative flex-1 flex items-center justify-center overflow-hidden p-3"
          onTouchStart={handleStageTouchStart}
          onTouchEnd={handleStageTouchEnd}
        >
          {/* Left / Right Slide Navigation Arrows */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-content-1 backdrop-blur-md border border-surface-3/50 shadow-xl active:scale-95 transition-all cursor-pointer"
                title="Slide precedente (Sx)"
              >
                <ChevronLeft size={22} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-content-1 backdrop-blur-md border border-surface-3/50 shadow-xl active:scale-95 transition-all cursor-pointer"
                title="Slide successiva (Dx)"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {hasImage ? (
            <>
              {/* Blurred Ambient Backdrop */}
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-35 pointer-events-none"
                style={{ backgroundImage: `url(${currentSlide.imageUrl})` }}
              />

              {/* Foreground Image with tap-to-read */}
              <div
                className="relative z-10 max-h-[64vh] max-w-[90vw] flex items-center justify-center cursor-pointer"
                onClick={() => setIsReadingMode(true)}
              >
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.sessionTitle || currentSlide.nodeTitle}
                  className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-2xl border border-surface-3/50 select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </>
          ) : (
            /* CONSISTENT PLACEHOLDER FRAME FOR SESSIONS WITHOUT IMAGES */
            <div
              className="relative z-10 w-full max-w-[88vw] h-[55vh] flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-1/90 border border-surface-2/80 shadow-2xl cursor-pointer group text-center space-y-3"
              onClick={() => setIsReadingMode(true)}
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-2/80 border border-surface-3 flex items-center justify-center text-primary shadow-inner">
                <BookOpen size={28} />
              </div>

              <div className="space-y-1 max-w-xs">
                <p className="text-xs font-mono font-semibold text-primary uppercase tracking-wider">
                  Capitolo #{currentSlide.sessionNumber}
                </p>
                <h3 className="text-base font-heading font-bold text-content-1 leading-snug">
                  {currentSlide.sessionTitle || currentSlide.nodeTitle}
                </h3>
                <p className="text-xs text-content-3 line-clamp-2 pt-1">
                  Nessuna immagine memorizzata per questa sessione.
                </p>
              </div>

              <div className="pt-2 flex flex-col items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-surface-2 text-content-1 text-xs font-medium border border-surface-3 group-hover:bg-surface-3 transition-colors shadow-xs">
                  Tocca per aprire la cronaca intera
                </span>
                {currentSlide.sessionId && (
                  <Link
                    to={`/sessions?select=${currentSlide.sessionId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Aggiungi immagini nel Diario
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Narrative Caption Bar (Consistent layout on all chapters) */}
        <div
          onClick={() => setIsReadingMode(true)}
          className="relative z-30 p-4 pb-safe bg-gradient-to-t from-black/95 via-black/85 to-transparent cursor-pointer"
        >
          <div className="space-y-1.5 max-w-md mx-auto">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-primary">
              <span>Capitolo #{currentSlide.sessionNumber}</span>
              {currentSlide.loreDate && (
                <>
                  <span className="text-content-3">&bull;</span>
                  <span className="text-content-2">{currentSlide.loreDate}</span>
                </>
              )}
              {currentSlide.location && (
                <>
                  <span className="text-content-3">&bull;</span>
                  <span className="text-accent-secondary truncate max-w-[120px]">{currentSlide.location}</span>
                </>
              )}
            </div>

            <h4 className="font-heading font-bold text-sm sm:text-base text-content-1 leading-snug drop-shadow-md truncate">
              {currentSlide.sessionTitle || currentSlide.nodeTitle}
            </h4>

            {cleanExcerpt && (
              <p className="text-xs text-content-2 line-clamp-2 leading-relaxed drop-shadow-sm">
                {cleanExcerpt}
              </p>
            )}

            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-primary font-semibold flex items-center gap-1">
                <span>Tocca per leggere la cronaca intera</span>
                <ChevronRight size={13} />
              </span>

              <div className="flex items-center gap-1 text-[11px] font-mono text-content-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  className="p-1 hover:text-content-1 active:scale-95 transition-transform cursor-pointer"
                  title="Precedente"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>{currentIndex + 1}/{slides.length}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="p-1 hover:text-content-1 active:scale-95 transition-transform cursor-pointer"
                  title="Successiva"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FULLSCREEN READING OVERLAY (Pure vertical scrollable text, no gesture conflicts) */}
        <AnimatePresence>
          {isReadingMode && (
            <div
              className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex flex-col justify-between overflow-hidden"
              onClick={() => setIsReadingMode(false)}
            >
              {/* Reading Header */}
              <div
                className="p-4 pt-safe border-b border-surface-2/80 bg-surface-1/80 flex items-center justify-between shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="min-w-0 pr-3">
                  <span className="text-xs font-mono font-bold text-primary">
                    Capitolo #{currentSlide.sessionNumber} {currentSlide.loreDate ? `• ${currentSlide.loreDate}` : ''}
                  </span>
                  <h3 className="font-heading font-bold text-base text-content-1 truncate mt-0.5">
                    {currentSlide.sessionTitle || currentSlide.nodeTitle}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReadingMode(false)}
                  className="p-2 rounded-full bg-surface-2 text-content-1 hover:bg-surface-3 transition-colors cursor-pointer shrink-0"
                  title="Chiudi lettura"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Markdown Body (Clean native vertical scroll without any touch interception) */}
              <div
                className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 text-xs sm:text-sm text-content-1 leading-relaxed overscroll-contain"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {currentSlide.nodeDescription ? (
                  <MarkdownRenderer content={currentSlide.nodeDescription} showMentions={false} />
                ) : (
                  <p className="text-content-3 italic">Nessun resoconto narrativo per questa sessione.</p>
                )}
              </div>

              {/* Reading Footer */}
              <div
                className="p-3 pb-safe border-t border-surface-2/80 bg-surface-1/90 flex items-center justify-between gap-3 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {currentSlide.sessionId && (
                  <Link
                    to={`/sessions?select=${currentSlide.sessionId}`}
                    onClick={() => {
                      setIsReadingMode(false);
                      onClose();
                    }}
                    className="flex-1 py-2 px-4 rounded-xl bg-primary text-surface-0 font-medium text-xs text-center shadow-sm"
                  >
                    Apri Scheda nel Diario
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsReadingMode(false)}
                  className="py-2 px-4 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 font-medium text-xs transition-colors cursor-pointer"
                >
                  Chiudi Lettura
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
};

export const StorylineFullscreenViewer: React.FC<StorylineFullscreenViewerProps> = ({
  slides,
  initialSlideIndex = 0,
  isOpen,
  onClose,
  onSelectNode,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);

  // Dynamic resizable panel width (range 280px to 850px)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storyline_presentation_panel_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 280 && parsed <= 900) return parsed;
      }
    }
    return 440;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Resize handler via dragging splitter
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent | React.TouchEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const startX = 'touches' in mouseDownEvent ? mouseDownEvent.touches[0].clientX : mouseDownEvent.clientX;
    const startWidth = panelWidth;

    const onPointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = startX - currentX; // moving mouse left expands right panel
      const minW = 280;
      const maxW = Math.min(window.innerWidth * 0.75, 950);
      const newWidth = Math.round(Math.max(minW, Math.min(maxW, startWidth + deltaX)));
      setPanelWidth(newWidth);
      try {
        localStorage.setItem('storyline_presentation_panel_width', String(newWidth));
      } catch {}
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);
  }, [panelWidth]);

  // Sync initial index when opening
  useEffect(() => {
    if (isOpen) {
      const safeIndex = Math.max(0, Math.min(initialSlideIndex, slides.length - 1));
      setCurrentIndex(safeIndex);
      setScale(1);
      setRotation(0);
      setIsPlaying(false);
    }
  }, [isOpen, initialSlideIndex, slides.length]);

  const currentSlide: StorylineSlide | undefined = slides[currentIndex];

  const handlePrev = useCallback(() => {
    setScale(1);
    setRotation(0);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  }, [slides.length]);

  const handleNext = useCallback(() => {
    setScale(1);
    setRotation(0);
    setCurrentIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (theaterMode) {
          setTheaterMode(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 't' || e.key === 'T' || e.key === 'i' || e.key === 'I') {
        setShowSidePanel((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H' || e.key === 'f' || e.key === 'F') {
        setTheaterMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose, theaterMode]);

  // Slideshow auto-advancement
  useEffect(() => {
    if (!isOpen || !isPlaying || slides.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 6000);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, slides.length, handleNext]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Responsive detection for mobile
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen || !currentSlide || slides.length === 0) return null;

  if (isMobile) {
    return (
      <MobileCronacaViewer
        slides={slides}
        initialSlideIndex={initialSlideIndex}
        onClose={onClose}
        onSelectNode={onSelectNode}
      />
    );
  }

  // Find previous and next node titles for helpful transition cues
  const prevSlide = slides[currentIndex > 0 ? currentIndex - 1 : slides.length - 1];
  const nextSlide = slides[currentIndex < slides.length - 1 ? currentIndex + 1 : 0];
  const isChangingNodeForward = nextSlide && nextSlide.nodeId !== currentSlide.nodeId;
  const isChangingNodeBackward = prevSlide && prevSlide.nodeId !== currentSlide.nodeId;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-surface-0/95 backdrop-blur-xl text-content-1 select-none overflow-hidden h-[100dvh]"
      >
        {/* TOP HEADER CONTROLS (Hidden in Theater Mode) */}
        <AnimatePresence>
          {!theaterMode && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-surface-1/90 backdrop-blur-md border-b border-surface-3/60 shadow-lg shrink-0 gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: Presentation Title & Chapter / Session Context */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shrink-0 shadow-sm">
                  <Film size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-content-1 truncate">
                      {currentSlide.nodeTitle}
                    </span>
                    {currentSlide.impact === 'major' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Snodo Cruciale
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-content-3 font-mono">
                    <span>Sessione #{currentSlide.sessionNumber}</span>
                    {currentSlide.chapterName && (
                      <>
                        <span>&bull;</span>
                        <span className="text-content-2">{currentSlide.chapterName}</span>
                      </>
                    )}
                    {currentSlide.loreDate && (
                      <>
                        <span>&bull;</span>
                        <span className="text-primary font-medium">{currentSlide.loreDate}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Center: Global Progress Bar & Counter */}
              <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-surface-2/80 border border-surface-3 text-xs font-mono">
                <span className="text-content-3">Snodo:</span>
                <span className="text-content-1 font-bold">
                  Foto {currentSlide.imageIndexInNode + 1}/{currentSlide.nodeTotalImages}
                </span>
                <div className="w-[1px] h-3 bg-surface-3" />
                <span className="text-content-3">Totale Storyline:</span>
                <span className="text-primary font-bold">
                  {currentIndex + 1} / {slides.length}
                </span>
              </div>

              {/* Right: Actions (Autoplay, Split Drawer Toggle, Filmstrip, Zoom, Theater, Close) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Autoplay Slideshow */}
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-primary text-surface-0 border-primary shadow-sm'
                      : 'bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border-surface-3'
                  }`}
                  title="Avvia / Ferma riproduzione automatica per il party (Spazio)"
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  <span className="hidden sm:inline">{isPlaying ? 'Pausa' : 'Presentazione'}</span>
                </button>

                {/* Toggle Split Narrative Side Drawer */}
                <button
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showSidePanel
                      ? 'bg-primary/15 text-primary border-primary/40'
                      : 'bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 border-surface-3'
                  }`}
                  title="Mostra / Nascondi pannello narrativo laterale (T o I)"
                >
                  {showSidePanel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                  <span className="hidden sm:inline font-mono text-[11px]">
                    {showSidePanel ? 'Chiudi Testo' : 'Mostra Testo'}
                  </span>
                </button>

                {/* Toggle Filmstrip */}
                <button
                  type="button"
                  onClick={() => setShowFilmstrip(!showFilmstrip)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    showFilmstrip
                      ? 'bg-surface-3 text-primary border-surface-3'
                      : 'bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 border-surface-3'
                  }`}
                  title="Mostra / Nascondi pellicola miniature"
                >
                  <ImageIcon size={15} />
                </button>

                {/* Zoom controls */}
                <div className="hidden lg:flex items-center bg-surface-2 border border-surface-3 rounded-xl p-0.5">
                  <button
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                    className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                    title="Rimpicciolisci"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setScale(1);
                      setRotation(0);
                    }}
                    className="px-2 text-[11px] font-mono text-content-2 hover:text-content-1 cursor-pointer"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                    className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                    title="Ingrandisci"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                    title="Ruota"
                  >
                    <RotateCw size={14} />
                  </button>
                </div>

                {/* Theater Mode Button */}
                <button
                  type="button"
                  onClick={() => setTheaterMode(true)}
                  className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-3 hover:text-content-1 border border-surface-3 transition-colors cursor-pointer"
                  title="Modalità Teatro a Tutto Schermo (H)"
                >
                  <Maximize2 size={15} />
                </button>

                <div className="w-[1px] h-5 bg-surface-3 mx-1" />

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-content-2 hover:text-rose-400 border border-surface-3 transition-colors cursor-pointer"
                  title="Chiudi visualizzatore (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating exit theater mode button */}
        {theaterMode && (
          <button
            type="button"
            onClick={() => setTheaterMode(false)}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-surface-1/80 hover:bg-surface-1 text-content-1 backdrop-blur-md border border-surface-3 shadow-xl transition-all cursor-pointer"
            title="Esci dalla modalità teatro (Esc o H)"
          >
            <Minimize2 size={18} />
          </button>
        )}

        {/* MAIN BODY: SPLIT VIEW (Artwork Center + Narrative Drawer Right) */}
        <div className="relative flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden">
          {/* ARTWORK VIEWPORT (Expands smoothly when side panel is closed) */}
          <div className="relative flex-1 flex items-center justify-center min-h-0 min-w-0 p-4 sm:p-6 overflow-hidden">
            {/* Large Navigation Arrow: PREV */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-3.5 rounded-2xl bg-surface-1/80 hover:bg-surface-1 text-content-1 hover:text-primary backdrop-blur-md border border-surface-3 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title={`Precedente (Freccia Sinistra)${isChangingNodeBackward ? ` • Passa allo snodo: ${prevSlide.nodeTitle}` : ''}`}
            >
              <ChevronLeft size={26} />
              {isChangingNodeBackward && (
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface-1 border border-surface-3 text-[10px] font-medium text-content-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                  Snodo Prec: {prevSlide.nodeTitle}
                </span>
              )}
            </button>

            {/* Large Navigation Arrow: NEXT */}
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-3.5 rounded-2xl bg-surface-1/80 hover:bg-surface-1 text-content-1 hover:text-primary backdrop-blur-md border border-surface-3 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title={`Successiva (Freccia Destra)${isChangingNodeForward ? ` • Passa al prossimo snodo: ${nextSlide.nodeTitle}` : ''}`}
            >
              <ChevronRight size={26} />
              {isChangingNodeForward && (
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface-1 border border-surface-3 text-[10px] font-medium text-content-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                  Prossimo Snodo: {nextSlide.nodeTitle}
                </span>
              )}
            </button>

            {/* The Slide Image or Placeholder Card */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={(currentSlide.imageUrl || 'placeholder') + currentIndex}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="relative max-w-full max-h-full flex items-center justify-center"
                >
                  {currentSlide.imageUrl && !currentSlide.isPlaceholder ? (
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.nodeTitle}
                      className="max-h-[82vh] max-w-full object-contain select-none shadow-2xl rounded-2xl border border-surface-3/50 transition-transform duration-200"
                      style={{
                        transform: `scale(${scale}) rotate(${rotation}deg)`,
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full max-w-lg bg-surface-1/95 backdrop-blur-md border border-surface-3 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3">
                        <Sparkles size={26} />
                      </div>
                      <span className="text-[11px] font-mono tracking-wider uppercase text-primary mb-1">
                        Capitolo #{currentSlide.sessionNumber} • {currentSlide.loreDate || 'Data Ignota'}
                      </span>
                      <h3 className="text-lg sm:text-xl font-heading font-bold text-content-1 mb-2">
                        {currentSlide.sessionTitle || currentSlide.nodeTitle}
                      </h3>
                      {currentSlide.chapterName && (
                        <span className="text-xs font-serif text-accent mb-2">
                          {currentSlide.chapterName}
                        </span>
                      )}
                      <p className="text-xs text-content-3 max-w-md mb-6 line-clamp-3 leading-relaxed">
                        {currentSlide.nodeDescription || 'Nessun riepilogo testuale registrato per questa sessione.'}
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Quick Floater to open Drawer if closed */}
            {!showSidePanel && !theaterMode && (
              <button
                type="button"
                onClick={() => setShowSidePanel(true)}
                className="absolute bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1/90 hover:bg-surface-1 text-content-1 hover:text-primary backdrop-blur-md border border-surface-3 shadow-xl transition-all cursor-pointer text-xs font-medium"
                title="Apri descrizione completa e dettagli snodo (T)"
              >
                <FileText size={14} className="text-primary" />
                <span>Leggi Cronaca &amp; Dettagli</span>
              </button>
            )}
          </div>

          {/* DRAGGABLE RESIZER SPLITTER (Between artwork and narrative drawer) */}
          {showSidePanel && !theaterMode && (
            <div
              onMouseDown={startResizing}
              onTouchStart={startResizing}
              className={`relative z-30 group cursor-col-resize flex items-center justify-center w-3 -mr-1.5 -ml-1.5 shrink-0 select-none touch-none hover:bg-primary/20 transition-colors ${
                isResizing ? 'bg-primary/30' : ''
              }`}
              title="Trascina per ridimensionare il testo e l'immagine"
            >
              <div
                className={`w-1 h-12 rounded-full transition-all flex items-center justify-center ${
                  isResizing
                    ? 'bg-primary shadow-lg ring-2 ring-primary/40'
                    : 'bg-surface-3 group-hover:bg-primary/70'
                }`}
              >
                <GripVertical
                  size={10}
                  className="text-surface-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          )}

          {/* DEDICATED NARRATIVE DRAWER (Option A - Right Side Column with dynamic width) */}
          <AnimatePresence>
            {showSidePanel && !theaterMode && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: panelWidth, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={isResizing ? { duration: 0 } : { duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                style={{ width: `${panelWidth}px`, maxWidth: '85vw' }}
                className="relative z-20 border-l border-surface-3/80 bg-surface-1/95 backdrop-blur-xl h-full flex flex-col shrink-0 shadow-2xl overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 border-b border-surface-3/60 bg-surface-1/60 shrink-0 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/15 text-primary border border-primary/25">
                        {currentSlide.nodeType === 'session' ? 'Capitolo / Sessione' : 'Snodo Narrativo'}
                      </span>
                      <span className="text-[11px] font-mono text-content-3">
                        Illustrazione {currentSlide.imageIndexInNode + 1} di {currentSlide.nodeTotalImages}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowSidePanel(false)}
                        className="p-1 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Comprimi pannello (T)"
                      >
                        <PanelRightClose size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-lg sm:text-xl text-content-1 leading-snug">
                    {currentSlide.nodeTitle}
                  </h3>

                  {/* Metadata Chips: Date, Location, Session */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-content-2 pt-1">
                    {currentSlide.loreDate && (
                      <div className="flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-surface-3 font-mono text-[11px]">
                        <Calendar size={12} className="text-primary shrink-0" />
                        <span>{currentSlide.loreDate}</span>
                      </div>
                    )}
                    {currentSlide.location && (
                      <div className="flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-surface-3 text-[11px]">
                        <MapPin size={12} className="text-accent-secondary shrink-0" />
                        <span>{currentSlide.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-surface-3 text-[11px] font-mono">
                      <BookOpen size={12} className="text-content-3 shrink-0" />
                      <span>Sessione #{currentSlide.sessionNumber}</span>
                    </div>
                  </div>

                  {/* PANEL WIDTH SLIDER & PRESETS CONTROL */}
                  <div className="pt-2 border-t border-surface-3/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <SlidersHorizontal size={12} className="text-primary" />
                      <span>Dimensione colonna:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={280}
                        max={Math.min(900, typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.72) : 800)}
                        step={10}
                        value={panelWidth}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPanelWidth(val);
                          try {
                            localStorage.setItem('storyline_presentation_panel_width', String(val));
                          } catch {}
                        }}
                        className="w-24 sm:w-28 h-1.5 bg-surface-3 rounded-lg appearance-none cursor-ew-resize accent-primary"
                        title="Regola la proporzione tra testo e immagine"
                      />
                      <span className="font-mono text-[10px] text-content-2 w-10 text-right">
                        {panelWidth}px
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drawer Content: Full Story Text & Markdown (Full Height Scrollable) */}
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold text-content-3 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                      <FileText size={12} className="text-primary" /> Cronaca dell'Evento
                    </div>
                    {currentSlide.nodeDescription ? (
                      <div className="text-sm text-content-1 leading-relaxed space-y-2 bg-surface-0/40 p-3.5 rounded-xl border border-surface-3/50 shadow-inner">
                        <MarkdownRenderer content={currentSlide.nodeDescription} />
                      </div>
                    ) : (
                      <p className="text-xs text-content-3 italic bg-surface-0/30 p-4 rounded-xl border border-surface-3/40">
                        Nessuna descrizione testuale registrata per questo momento di trama.
                      </p>
                    )}
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-3 sm:p-4 border-t border-surface-3/60 bg-surface-1/80 shrink-0 space-y-2">
                  {onSelectNode && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectNode(currentSlide.nodeId);
                        onClose();
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      title="Apri i dettagli completi dello snodo nella Storyline"
                    >
                      <span>Visualizza Snodo nella Timeline</span>
                      <Compass size={14} />
                    </button>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM FILMSTRIP THUMBNAILS (Chronological Storyline Track - Hidden in Theater Mode) */}
        <AnimatePresence>
          {showFilmstrip && !theaterMode && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="relative z-30 bg-surface-1/90 backdrop-blur-md border-t border-surface-3/60 px-4 py-2 shadow-2xl shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1 text-[11px] text-content-3 font-mono">
                <span className="flex items-center gap-1.5">
                  <Compass size={12} className="text-primary" />
                  <span>Nastro Cronologico Ricordi ({slides.length} illustrazioni)</span>
                </span>
                <span>
                  Usa le frecce &larr; &rarr; della tastiera o scorri la pellicola
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
                {slides.map((s, idx) => {
                  const isSelected = idx === currentIndex;
                  const isFirstOfNode = idx === 0 || slides[idx - 1].nodeId !== s.nodeId;

                  return (
                    <div key={idx} className="flex items-center gap-2 shrink-0">
                      {/* Node Divider pill if it's the start of a new node */}
                      {isFirstOfNode && (
                        <div className="px-2 py-1 rounded-lg bg-surface-2 border border-surface-3 text-[10px] font-semibold text-content-2 max-w-[120px] truncate shadow-sm">
                          {s.nodeTitle}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setScale(1);
                          setRotation(0);
                          setCurrentIndex(idx);
                        }}
                        className={`relative w-14 h-11 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/50 scale-105 shadow-md'
                            : 'border-surface-3 opacity-60 hover:opacity-100 hover:scale-102'
                        }`}
                        title={`${s.nodeTitle} (${s.loreDate || `Sess. #${s.sessionNumber}`})`}
                      >
                        {s.imageUrl && !s.isPlaceholder ? (
                          <img
                            src={s.imageUrl}
                            alt={`Slide ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-2 flex flex-col items-center justify-center p-0.5 text-content-3">
                            <Sparkles size={13} className="text-primary/70 mb-0.5" />
                            <span className="text-[8px] font-mono leading-none">#{s.sessionNumber}</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-surface-0/70 text-[9px] font-mono text-center text-content-1 py-0.2">
                          {idx + 1}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
};

export default StorylineFullscreenViewer;
