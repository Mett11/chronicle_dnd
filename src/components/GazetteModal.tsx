import React, { useState, useMemo, useEffect } from 'react';
import { Session, CampaignCalendar, GazetteBlock, GazetteConfig } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { getStoredTheme, ClassTheme } from '../lib/theme';
import {
  X,
  Printer,
  Calendar,
  Feather,
  Sparkles,
  Shield,
  MapPin,
  Users,
  Flame,
  Award,
  ExternalLink,
  Palette,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit3,
  BookOpen,
  Quote,
  Heading,
  Save,
  RotateCcw,
  Check,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize2,
  LayoutTemplate,
  Info,
} from 'lucide-react';
import { Portal } from './Portal';

interface GazetteModalProps {
  session: Session;
  calendar?: CampaignCalendar;
  onClose: () => void;
  onSaved?: (updatedSession: Session) => void;
}

/**
 * Helper to strip entity mentions and format clean text for printing and reading
 */
export function stripMentions(text: string): string {
  if (!text) return '';
  // 1. Replace @[Entity Name] with Entity Name
  let cleaned = text.replace(/@\[(.*?)\]/g, '$1');
  // 2. Replace @Entity_Name with Entity Name
  cleaned = cleaned.replace(/@([a-zA-Z0-9À-ÿ_-]+)/g, (_match, p1) => {
    return p1.replace(/_/g, ' ');
  });
  return cleaned;
}

/**
 * Helper to safely format recap text for authentic antique parchment rendering
 */
function cleanAndFormatParchmentText(text: string): { dropCap: string; body: string } {
  if (!text) return { dropCap: '', body: '' };

  // Strip all @ mentions and brackets for clean publication
  let cleaned = stripMentions(text).trim();

  // Check if first character is a standard alphabetic letter (A-Z)
  const firstChar = cleaned.charAt(0);
  const isAlpha = /^[a-zA-ZÀ-ÿ]$/.test(firstChar);

  if (isAlpha) {
    return {
      dropCap: firstChar.toUpperCase(),
      body: cleaned.slice(1),
    };
  }

  return {
    dropCap: '',
    body: cleaned,
  };
}

export function GazetteModal({ session, calendar, onClose, onSaved }: GazetteModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'editor'>('preview');
  const [gazetteTitle, setGazetteTitle] = useState(
    () => session.gazetteConfig?.title || 'LA GAZZETTA DELLE TERRE LIBERE'
  );
  const [gazetteSubtitle, setGazetteSubtitle] = useState(
    () => session.gazetteConfig?.subtitle || 'Cronache, Voci e Rivelazioni dal Fronte'
  );
  const [activeTheme, setActiveTheme] = useState<ClassTheme>(getStoredTheme);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extract all available session images (zero upload needed!)
  const sessionImages = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(session.images)) {
      session.images.forEach((img) => {
        if (img && typeof img === 'string' && !list.includes(img)) list.push(img);
      });
    }
    if (session.events && Array.isArray(session.events)) {
      session.events.forEach((evt) => {
        if (Array.isArray(evt.images)) {
          evt.images.forEach((img) => {
            if (img && typeof img === 'string' && !list.includes(img)) list.push(img);
          });
        }
      });
    }
    if (session.coverImage && typeof session.coverImage === 'string' && !list.includes(session.coverImage)) {
      list.push(session.coverImage);
    } else if (session.coverImage?.url && typeof session.coverImage.url === 'string' && !list.includes(session.coverImage.url)) {
      list.push(session.coverImage.url);
    }
    return list;
  }, [session]);

  // Extract raw recap paragraphs helper
  const getRawRecapParagraphs = (): string[] => {
    const paragraphs: string[] = [];
    if (session.recap && session.recap.length > 0) {
      session.recap.forEach((p) => {
        if (typeof p === 'string') {
          if (p.trim()) paragraphs.push(p.trim());
        } else if (p.children && Array.isArray(p.children)) {
          const joined = p.children.map((c: any) => c.text || '').join('').trim();
          if (joined) paragraphs.push(joined);
        }
      });
    }

    if (paragraphs.length === 0) {
      if (session.events && session.events.length > 0 && session.events[0].description) {
        paragraphs.push(session.events[0].description);
      } else {
        paragraphs.push('Nessun resoconto principale registrato per questo capitolo.');
      }
    }

    return paragraphs;
  };

  // Build initial blocks (or load saved gazetteConfig)
  const buildInitialBlocks = (): GazetteBlock[] => {
    if (session.gazetteConfig?.blocks && session.gazetteConfig.blocks.length > 0) {
      return session.gazetteConfig.blocks;
    }

    const rawParagraphs = getRawRecapParagraphs();
    const resultBlocks: GazetteBlock[] = [];
    let imgIdx = 0;

    rawParagraphs.forEach((para, idx) => {
      resultBlocks.push({
        id: `block_p_${Date.now()}_${idx}`,
        type: 'paragraph',
        text: para,
      });

      // Insert session image between paragraphs if available
      if (imgIdx < sessionImages.length) {
        const layoutOptions: GazetteBlock['imageLayout'][] = ['center', 'right', 'left', 'full'];
        const layout = layoutOptions[imgIdx % layoutOptions.length];
        resultBlocks.push({
          id: `block_img_${Date.now()}_${imgIdx}`,
          type: 'image',
          imageUrl: sessionImages[imgIdx],
          caption: `Illustrazione dagli archivi della Sessione #${session.number}`,
          imageLayout: layout,
        });
        imgIdx++;
      }
    });

    // If there are extra session images, append them
    while (imgIdx < sessionImages.length) {
      resultBlocks.push({
        id: `block_img_${Date.now()}_${imgIdx}`,
        type: 'image',
        imageUrl: sessionImages[imgIdx],
        caption: `Scorcio di sessione`,
        imageLayout: 'center',
      });
      imgIdx++;
    }

    return resultBlocks;
  };

  const [blocks, setBlocks] = useState<GazetteBlock[]>(() => buildInitialBlocks());

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setActiveTheme(e.detail.theme);
      } else {
        setActiveTheme(getStoredTheme());
      }
    };
    window.addEventListener('chronicle_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('chronicle_theme_changed', handleThemeChange);
    };
  }, []);

  const entities = useMemo(() => CampaignManager.getEntities(), []);
  const entityMap = useMemo(() => {
    const map = new Map<string, (typeof entities)[0]>();
    entities.forEach((e) => {
      map.set(e._id, e);
      if (e.name) map.set(e.name.toLowerCase().trim(), e);
    });
    return map;
  }, [entities]);

  // Extract linked entities from session and events
  const linkedEntities = useMemo(() => {
    const ids = new Set<string>(session.linkedEntityIds || []);
    if (session.events) {
      session.events.forEach((evt) => {
        if (evt.linkedEntityIds) {
          evt.linkedEntityIds.forEach((id) => ids.add(id));
        }
      });
    }
    return Array.from(ids)
      .map((id) => entityMap.get(id))
      .filter((e): e is (typeof entities)[0] => Boolean(e));
  }, [session, entityMap]);

  // Lore date formatted
  const loreDateFormatted = useMemo(() => {
    if (session.loreDate) return session.loreDate;
    if (session.loreStartDay && session.loreMonth && session.loreYear) {
      return `${session.loreStartDay} ${session.loreMonth}, ${session.loreYear} CV`;
    }
    return `Anno della Campagna`;
  }, [session]);

  // Block Manipulation Handlers
  const handleAddBlock = (type: GazetteBlock['type'], extra?: Partial<GazetteBlock>) => {
    const newBlock: GazetteBlock = {
      id: `block_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      text: type === 'paragraph' ? '' : type === 'heading' ? 'Nuova Sezione' : type === 'quote' ? 'Parole pronunciate durante la missione...' : undefined,
      imageUrl: type === 'image' ? (sessionImages[0] || '') : undefined,
      caption: type === 'image' ? 'Illustrazione della scena' : undefined,
      imageLayout: type === 'image' ? 'center' : undefined,
      ...extra,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleInsertSessionImageBlock = (imgUrl: string) => {
    handleAddBlock('image', {
      imageUrl: imgUrl,
      caption: `Illustrazione dalla Sessione #${session.number}`,
      imageLayout: 'center',
    });
  };

  const handleUpdateBlock = (id: string, updates: Partial<GazetteBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    setBlocks((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleResetToDefault = () => {
    const initial = buildInitialBlocks();
    setBlocks(initial);
  };

  const handleSaveGazette = () => {
    const config: GazetteConfig = {
      title: gazetteTitle.trim() || 'LA GAZZETTA DELLE TERRE LIBERE',
      subtitle: gazetteSubtitle.trim() || 'Cronache, Voci e Rivelazioni dal Fronte',
      blocks,
      updatedAt: new Date().toISOString(),
    };

    const updated = CampaignManager.updateSession(session._id, {
      gazetteConfig: config,
    });

    if (updated && onSaved) {
      onSaved(updated);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Render text cleanly without pills or @ tags for authentic, print-ready reading
  const renderAntiqueText = (rawText: string) => {
    if (!rawText) return null;
    return stripMentions(rawText);
  };

  const themeBorder = activeTheme.colors.gazetteBorder || '#8c642b';
  const themeAccent = activeTheme.colors.gazetteAccent || '#b8860b';

  // Lead story data (first paragraph with drop cap)
  const firstParagraphIndex = blocks.findIndex((b) => b.type === 'paragraph' && b.text?.trim());
  const leadStoryData = firstParagraphIndex !== -1 ? cleanAndFormatParchmentText(blocks[firstParagraphIndex].text || '') : null;

  const handlePrint = () => {
    const printableEl = document.getElementById('printable-parchment-sheet');
    if (!printableEl) {
      window.print();
      return;
    }

    const gazetteBorder = activeTheme.colors.gazetteBorder || '#8c642b';

    const parchmentHtml = `
      <!DOCTYPE html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>${gazetteTitle || 'Gazzetta di Campagna'} - Sessione #${session.number}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 1cm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 16px;
              background-color: #f6f0dd !important;
              color: #1a1109 !important;
              font-family: Georgia, Cambria, 'Times New Roman', serif;
            }
            #printable-parchment-sheet {
              box-shadow: none !important;
              border: 3px double ${gazetteBorder} !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              background-color: #f6f0dd !important;
              color: #1a1109 !important;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .clearfix::after {
              content: "";
              clear: both;
              display: table;
            }
          </style>
        </head>
        <body>
          ${printableEl.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                try {
                  window.focus();
                  window.print();
                } catch (e) {
                  console.warn(e);
                }
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    try {
      const existingFrame = document.getElementById('gazette-hidden-print-frame');
      if (existingFrame) existingFrame.remove();

      const printFrame = document.createElement('iframe');
      printFrame.id = 'gazette-hidden-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(parchmentHtml);
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print failed, attempting standard window.print', e);
            window.print();
          }
        }, 350);
        return;
      }
    } catch (err) {
      console.warn('Frame print attempt error', err);
    }

    try {
      window.print();
    } catch (e) {
      console.warn('Direct print error', e);
    }
  };

  const handleOpenInNewTab = () => {
    const printableEl = document.getElementById('printable-parchment-sheet');
    if (!printableEl) return;

    const gazetteBorder = activeTheme.colors.gazetteBorder || '#8c642b';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>${gazetteTitle || 'Gazzetta di Campagna'} - Sessione #${session.number}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 1cm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 24px;
              background-color: #ede5cf;
              color: #1a1109;
              font-family: Georgia, Cambria, 'Times New Roman', serif;
              display: flex;
              justify-content: center;
            }
            #printable-parchment-sheet {
              width: 100%;
              max-width: 900px;
              margin: 0 auto;
              background-color: #f6f0dd;
              border: 3px double ${gazetteBorder};
              box-shadow: 0 10px 30px rgba(0,0,0,0.15);
              padding: 36px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .clearfix::after {
              content: "";
              clear: both;
              display: table;
            }
            @media print {
              body {
                padding: 0;
                background-color: #f6f0dd;
              }
              #printable-parchment-sheet {
                border: 3px double ${gazetteBorder};
                box-shadow: none;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          ${printableEl.outerHTML}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (!tab) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gazzetta_Sessione_${session.number}.html`;
      a.click();
    }
  };

  return (
    <Portal>
      <div
        id="gazette-modal-root"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-surface-0/80 backdrop-blur-md overflow-y-auto animate-fade-in"
      >
        <div className="relative w-full max-w-5xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] overflow-hidden my-auto text-content-1 shrink-0 font-body">
          {/* Top Control Toolbar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-surface-2 bg-surface-1 print:hidden shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                <Feather size={18} />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm sm:text-base text-content-1 flex items-center gap-2">
                  <span>Gazzetta &amp; Cronache di Campagna</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                    Sessione #{session.number}
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-content-2 border border-surface-3">
                    <span>{activeTheme.icon}</span> {activeTheme.name}
                  </span>
                </h3>
                <p className="text-xs text-content-3 font-mono truncate max-w-md">
                  {session.title} &bull; {sessionImages.length} {sessionImages.length === 1 ? 'immagine disponibile' : 'immagini disponibili'}
                </p>
              </div>
            </div>

            {/* View Switcher Tabs & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center bg-surface-2 p-0.5 rounded-xl border border-surface-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <BookOpen size={13} />
                  <span>Anteprima</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'editor'
                      ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>Impagina &amp; Formatta</span>
                </button>
              </div>

              {activeTab === 'preview' ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="hidden sm:flex px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 font-medium items-center gap-1.5 transition-all border border-surface-3 text-xs cursor-pointer"
                    title="Apri il documento in una nuova finestra pulita per lettura e stampa"
                  >
                    <ExternalLink size={14} />
                    <span>Nuova Scheda</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-surface-0 font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer text-xs"
                    title="Stampa o salva in PDF"
                  >
                    <Printer size={14} />
                    <span>Stampa</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveGazette}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer text-xs"
                  title="Salva l'impaginazione della gazzetta per questa sessione"
                >
                  {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                  <span>{saveSuccess ? 'Salvato!' : 'Salva Impaginazione'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-content-3 hover:text-content-1 hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Sub-Header: Title and Subtitle Customization */}
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-2.5 bg-surface-2/40 border-b border-surface-3/50 text-xs print:hidden shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <span className="text-[11px] uppercase font-bold text-content-3 tracking-wider shrink-0 font-mono">
                Testata:
              </span>
              <input
                type="text"
                value={gazetteTitle}
                onChange={(e) => setGazetteTitle(e.target.value)}
                placeholder="Nome della testata giornalistica..."
                className="flex-1 bg-surface-1 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-primary font-bold outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <span className="text-[11px] uppercase font-bold text-content-3 tracking-wider shrink-0 font-mono">
                Sottotitolo:
              </span>
              <input
                type="text"
                value={gazetteSubtitle}
                onChange={(e) => setGazetteSubtitle(e.target.value)}
                placeholder="Motto o sottotitolo..."
                className="flex-1 bg-surface-1 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-content-2 outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* MAIN VIEWPORT */}
          {activeTab === 'editor' ? (
            /* ========================================================================= */
            /* TAB 2: INTERACTIVE FORMATTING & BLOCK LAYOUT BUILDER                      */
            /* ========================================================================= */
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-surface-0 space-y-6">
              {/* Session Images Gallery Drawer (Zero Upload Needed!) */}
              <div className="bg-surface-1 border border-surface-3 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-content-1">
                      Immagini Caricate per questa Sessione ({sessionImages.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-content-3 font-mono">
                    Nessun upload necessario: clicca per inserire nel testo
                  </span>
                </div>

                {sessionImages.length === 0 ? (
                  <div className="p-4 rounded-lg bg-surface-2/40 border border-surface-3 text-center space-y-1">
                    <p className="text-xs text-content-3 font-sans">
                      Non ci sono immagini caricate direttamente in questa sessione o nei suoi eventi.
                    </p>
                    <p className="text-[11px] text-content-3/80 font-mono">
                      Puoi caricare illustrazioni modificando la sessione, oppure inserire blocchi immagine personalizzati qui sotto.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                    {sessionImages.map((imgUrl, i) => (
                      <div
                        key={i}
                        className="group relative rounded-lg border border-surface-3 bg-surface-2 overflow-hidden aspect-video flex flex-col justify-end"
                      >
                        <img
                          src={imgUrl}
                          alt={`Session asset ${i + 1}`}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                          <button
                            type="button"
                            onClick={() => handleInsertSessionImageBlock(imgUrl)}
                            className="px-2 py-1 bg-primary text-surface-0 rounded text-[10px] font-mono font-bold shadow-md hover:bg-primary-hover flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>Inserisci</span>
                          </button>
                        </div>
                        <span className="absolute bottom-1 left-1 bg-black/70 px-1 py-0.5 rounded text-[9px] font-mono text-white/80">
                          #{i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Blocks Editor List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-surface-2 pb-2">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-primary" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-content-1">
                      Impaginazione Blocchi Articolo ({blocks.length})
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="px-2.5 py-1 text-[11px] font-mono text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg border border-surface-3 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Rigenera i blocchi dal testo del diario e dalle immagini"
                    >
                      <RotateCcw size={12} />
                      <span>Ripristina da Diario</span>
                    </button>
                  </div>
                </div>

                {blocks.length === 0 ? (
                  <div className="p-8 text-center bg-surface-1 border border-surface-3 rounded-xl space-y-3">
                    <Feather size={28} className="mx-auto text-content-3 opacity-40" />
                    <p className="text-xs text-content-3 font-sans">Nessun blocco di contenuto nell'articolo.</p>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="px-3 py-1.5 bg-primary text-surface-0 rounded-lg text-xs font-mono font-semibold hover:bg-primary-hover cursor-pointer"
                    >
                      Genera dal Diario di Sessione
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blocks.map((block, index) => (
                      <div
                        key={block.id}
                        className="p-3.5 sm:p-4 bg-surface-1 border border-surface-3 rounded-xl space-y-2.5 shadow-xs"
                      >
                        {/* Block Header */}
                        <div className="flex items-center justify-between gap-2 text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center text-[10px] text-content-2 font-bold">
                              {index + 1}
                            </span>
                            <span className="font-semibold uppercase tracking-wider text-primary text-[11px]">
                              {block.type === 'paragraph' && (index === firstParagraphIndex ? '👑 Paragrafo Principale (Capolettera)' : '📝 Paragrafo')}
                              {block.type === 'image' && '🖼️ Immagine Sessione'}
                              {block.type === 'heading' && '📌 Sottotitolo / Sezione'}
                              {block.type === 'quote' && '📜 Citazione / Voce'}
                            </span>
                          </div>

                          {/* Block Reorder & Delete Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(index, 'up')}
                              disabled={index === 0}
                              className="p-1 rounded text-content-3 hover:text-content-1 hover:bg-surface-2 disabled:opacity-20 cursor-pointer"
                              title="Sposta su"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(index, 'down')}
                              disabled={index === blocks.length - 1}
                              className="p-1 rounded text-content-3 hover:text-content-1 hover:bg-surface-2 disabled:opacity-20 cursor-pointer"
                              title="Sposta giù"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBlock(block.id)}
                              className="p-1 rounded text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer ml-1"
                              title="Elimina blocco"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Block Body Content Editor */}
                        {block.type === 'paragraph' && (
                          <textarea
                            rows={3}
                            value={block.text || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { text: e.target.value })}
                            placeholder="Scrivi qui il paragrafo della cronaca..."
                            className="w-full bg-surface-2/60 border border-surface-3 rounded-lg p-2.5 text-xs text-content-1 outline-none focus:border-primary font-sans leading-relaxed resize-y"
                          />
                        )}

                        {block.type === 'heading' && (
                          <input
                            type="text"
                            value={block.text || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { text: e.target.value })}
                            placeholder="Titolo della sezione..."
                            className="w-full bg-surface-2/60 border border-surface-3 rounded-lg px-2.5 py-1.5 text-xs text-content-1 font-bold outline-none focus:border-primary font-sans"
                          />
                        )}

                        {block.type === 'quote' && (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={block.text || ''}
                              onChange={(e) => handleUpdateBlock(block.id, { text: e.target.value })}
                              placeholder="Testo della citazione..."
                              className="w-full bg-surface-2/60 border border-surface-3 rounded-lg p-2.5 text-xs text-content-1 italic outline-none focus:border-primary font-sans leading-relaxed resize-y"
                            />
                            <input
                              type="text"
                              value={block.caption || ''}
                              onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })}
                              placeholder="Autore o fonte della citazione (es. 'Un locandiere di Phandalin')..."
                              className="w-full bg-surface-2/60 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-content-2 outline-none focus:border-primary font-sans"
                            />
                          </div>
                        )}

                        {block.type === 'image' && (
                          <div className="space-y-3 bg-surface-2/40 border border-surface-3 p-3 rounded-lg">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                              {/* Thumbnail preview */}
                              {block.imageUrl ? (
                                <div className="w-24 h-16 rounded-md overflow-hidden border border-surface-3 shrink-0 bg-surface-3">
                                  <img
                                    src={block.imageUrl}
                                    alt="Selected"
                                    className="w-full h-full object-cover object-center"
                                  />
                                </div>
                              ) : (
                                <div className="w-24 h-16 rounded-md border border-dashed border-surface-3 flex items-center justify-center text-content-3 text-[10px] shrink-0 font-mono">
                                  Nessuna img
                                </div>
                              )}

                              <div className="flex-1 w-full space-y-2">
                                {/* Image Selector Dropdown from Session Images */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-content-3 shrink-0">
                                    Scegli Immagine:
                                  </span>
                                  {sessionImages.length > 0 ? (
                                    <select
                                      value={block.imageUrl || ''}
                                      onChange={(e) => handleUpdateBlock(block.id, { imageUrl: e.target.value })}
                                      className="flex-1 bg-surface-1 border border-surface-3 text-content-1 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer"
                                    >
                                      <option value="">-- Seleziona Immagine della Sessione --</option>
                                      {sessionImages.map((img, idx) => (
                                        <option key={idx} value={img}>
                                          Immagine Sessione #{idx + 1}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={block.imageUrl || ''}
                                      onChange={(e) => handleUpdateBlock(block.id, { imageUrl: e.target.value })}
                                      placeholder="URL Immagine..."
                                      className="flex-1 bg-surface-1 border border-surface-3 rounded-lg px-2 py-1 text-xs text-content-1 outline-none"
                                    />
                                  )}
                                </div>

                                {/* Layout & Position Selector */}
                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                  <span className="text-[11px] text-content-3">Posizione:</span>
                                  <div className="flex items-center bg-surface-1 border border-surface-3 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(block.id, { imageLayout: 'center' })}
                                      className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                        block.imageLayout === 'center' || !block.imageLayout
                                          ? 'bg-primary text-surface-0 font-bold'
                                          : 'text-content-3 hover:text-content-1'
                                      }`}
                                    >
                                      <AlignCenter size={11} />
                                      <span>Centrata</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(block.id, { imageLayout: 'full' })}
                                      className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                        block.imageLayout === 'full'
                                          ? 'bg-primary text-surface-0 font-bold'
                                          : 'text-content-3 hover:text-content-1'
                                      }`}
                                    >
                                      <Maximize2 size={11} />
                                      <span>A Tutta Pagina</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(block.id, { imageLayout: 'left' })}
                                      className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                        block.imageLayout === 'left'
                                          ? 'bg-primary text-surface-0 font-bold'
                                          : 'text-content-3 hover:text-content-1'
                                      }`}
                                    >
                                      <AlignLeft size={11} />
                                      <span>Sinistra</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(block.id, { imageLayout: 'right' })}
                                      className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                                        block.imageLayout === 'right'
                                          ? 'bg-primary text-surface-0 font-bold'
                                          : 'text-content-3 hover:text-content-1'
                                      }`}
                                    >
                                      <AlignRight size={11} />
                                      <span>Destra</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Caption Input */}
                            <input
                              type="text"
                              value={block.caption || ''}
                              onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })}
                              placeholder="Didascalia dell'illustrazione per la gazzetta..."
                              className="w-full bg-surface-1 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-content-1 italic outline-none focus:border-primary font-sans"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Block Toolbar */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddBlock('paragraph')}
                    className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-3 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>+ Paragrafo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('image')}
                    className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-3 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ImageIcon size={13} className="text-amber-400" />
                    <span>+ Immagine Sessione</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('heading')}
                    className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-3 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Heading size={13} className="text-indigo-400" />
                    <span>+ Sottotitolo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('quote')}
                    className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 text-content-1 border border-surface-3 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Quote size={13} className="text-emerald-400" />
                    <span>+ Citazione</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* TAB 1: GORGEOUS PARCHMENT NEWSPAPER PREVIEW & PRINT READY SHEET           */
            /* ========================================================================= */
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-surface-0/60 print:p-0 print:bg-transparent print:overflow-visible">
              <div
                id="printable-parchment-sheet"
                className="w-full rounded-2xl shadow-xl relative mx-auto print:shadow-none print:border-none print:m-0 print:rounded-none"
                style={{
                  backgroundColor: '#f6f0dd',
                  color: '#1a1109',
                  border: `4px double ${themeBorder}`,
                  padding: '36px',
                  fontFamily: "Georgia, Cambria, 'Times New Roman', serif",
                  backgroundImage: `radial-gradient(#d6caa9 1px, transparent 1px), radial-gradient(#d6caa9 1px, #f6f0dd 1px)`,
                  backgroundSize: '32px 32px',
                  backgroundPosition: '0 0, 16px 16px',
                }}
              >
                {/* Ornate Inner Border Frame with active theme styling */}
                <div
                  style={{
                    border: `2px solid ${themeBorder}`,
                    borderRadius: '8px',
                    padding: '24px 28px',
                    position: 'relative',
                  }}
                >
                  {/* Top Banner Editorial Header */}
                  <div
                    style={{
                      borderBottom: `4px double ${themeBorder}`,
                      paddingBottom: '16px',
                      marginBottom: '20px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        fontFamily: "Courier, 'JetBrains Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: '#574127',
                        marginBottom: '10px',
                        borderBottom: `1px solid ${themeBorder}40`,
                        paddingBottom: '6px',
                      }}
                    >
                      <span>Vol. I &bull; Edizione #{session.number}</span>
                      <span style={{ fontWeight: 700, color: themeAccent }}>
                        {activeTheme.icon} {loreDateFormatted}
                      </span>
                      <span>Prezzo: 1 Rame</span>
                    </div>

                    {/* Newspaper Title */}
                    <h1
                      style={{
                        fontSize: '32px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        color: '#1a1006',
                        margin: '8px 0 4px 0',
                        letterSpacing: '1px',
                        lineHeight: 1.15,
                        fontFamily: "Georgia, 'Cinzel', serif",
                      }}
                    >
                      {gazetteTitle}
                    </h1>

                    <p
                      style={{
                        fontStyle: 'italic',
                        fontSize: '14px',
                        color: '#4f3b25',
                        margin: '4px 0 0 0',
                      }}
                    >
                      {gazetteSubtitle}
                    </p>
                  </div>

                  {/* Chapter Meta Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      fontFamily: "Courier, 'JetBrains Mono', monospace",
                      borderBottom: `1px solid ${themeBorder}60`,
                      paddingBottom: '8px',
                      marginBottom: '20px',
                      color: '#422f1b',
                    }}
                  >
                    <span>
                      <strong>Cronaca del Capitolo:</strong> {session.title}
                    </span>
                    <span>
                      <strong>Registrato il:</strong> {session.date}
                    </span>
                  </div>

                  {/* Main Article Section with formatted blocks & images */}
                  <div style={{ marginBottom: '24px' }} className="clearfix">
                    <h2
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#1a1006',
                        borderBottom: `2px solid ${themeBorder}`,
                        paddingBottom: '4px',
                        marginBottom: '14px',
                        letterSpacing: '0.5px',
                        fontFamily: "Georgia, 'Cinzel', serif",
                      }}
                    >
                      Gli Eventi Principali
                    </h2>

                    <div style={{ fontSize: '14.5px', lineHeight: 1.7, color: '#26170a', textAlign: 'justify' }} className="clearfix">
                      {blocks.map((block, idx) => {
                        // 1. Heading Block
                        if (block.type === 'heading') {
                          return (
                            <div
                              key={block.id}
                              style={{
                                marginTop: '18px',
                                marginBottom: '10px',
                                clear: 'both',
                              }}
                            >
                              <h3
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 800,
                                  color: '#38200b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  borderBottom: `1px solid ${themeBorder}80`,
                                  paddingBottom: '2px',
                                  margin: 0,
                                  fontFamily: "Georgia, 'Cinzel', serif",
                                }}
                              >
                                {block.text}
                              </h3>
                            </div>
                          );
                        }

                        // 2. Quote Block
                        if (block.type === 'quote') {
                          return (
                            <blockquote
                              key={block.id}
                              style={{
                                margin: '14px 0',
                                padding: '12px 16px',
                                backgroundColor: 'rgba(235, 222, 195, 0.75)',
                                borderLeft: `4px solid ${themeAccent}`,
                                borderRight: `1px solid ${themeBorder}60`,
                                borderTop: `1px solid ${themeBorder}60`,
                                borderBottom: `1px solid ${themeBorder}60`,
                                borderRadius: '6px',
                                fontStyle: 'italic',
                                color: '#38200b',
                                clear: 'both',
                              }}
                            >
                              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                                &ldquo;{renderAntiqueText(block.text || '')}&rdquo;
                              </div>
                              {block.caption && (
                                <div
                                  style={{
                                    marginTop: '6px',
                                    fontSize: '11px',
                                    fontFamily: "Courier, monospace",
                                    fontWeight: 700,
                                    textAlign: 'right',
                                    color: '#634726',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  &mdash; {block.caption}
                                </div>
                              )}
                            </blockquote>
                          );
                        }

                        // 3. Image Block (Formatted in the Gazette layout)
                        if (block.type === 'image' && block.imageUrl) {
                          const layout = block.imageLayout || 'center';

                          if (layout === 'full') {
                            return (
                              <figure
                                key={block.id}
                                style={{
                                  margin: '18px 0',
                                  clear: 'both',
                                  textAlign: 'center',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '5px',
                                    backgroundColor: '#fbf7ed',
                                    border: `2px solid ${themeBorder}`,
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <img
                                    src={block.imageUrl}
                                    alt={block.caption || 'Illustrazione'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '340px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      display: 'block',
                                    }}
                                  />
                                </div>
                                {block.caption && (
                                  <figcaption
                                    style={{
                                      fontSize: '11px',
                                      fontStyle: 'italic',
                                      color: '#5c4327',
                                      marginTop: '5px',
                                    }}
                                  >
                                    {block.caption}
                                  </figcaption>
                                )}
                              </figure>
                            );
                          }

                          if (layout === 'left') {
                            return (
                              <figure
                                key={block.id}
                                style={{
                                  float: 'left',
                                  width: '42%',
                                  margin: '6px 16px 10px 0',
                                  textAlign: 'center',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '4px',
                                    backgroundColor: '#fbf7ed',
                                    border: `2px solid ${themeBorder}`,
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <img
                                    src={block.imageUrl}
                                    alt={block.caption || 'Illustrazione'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '220px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      display: 'block',
                                    }}
                                  />
                                </div>
                                {block.caption && (
                                  <figcaption
                                    style={{
                                      fontSize: '10.5px',
                                      fontStyle: 'italic',
                                      color: '#5c4327',
                                      marginTop: '4px',
                                      lineHeight: 1.25,
                                    }}
                                  >
                                    {block.caption}
                                  </figcaption>
                                )}
                              </figure>
                            );
                          }

                          if (layout === 'right') {
                            return (
                              <figure
                                key={block.id}
                                style={{
                                  float: 'right',
                                  width: '42%',
                                  margin: '6px 0 10px 16px',
                                  textAlign: 'center',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '4px',
                                    backgroundColor: '#fbf7ed',
                                    border: `2px solid ${themeBorder}`,
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <img
                                    src={block.imageUrl}
                                    alt={block.caption || 'Illustrazione'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '220px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      display: 'block',
                                    }}
                                  />
                                </div>
                                {block.caption && (
                                  <figcaption
                                    style={{
                                      fontSize: '10.5px',
                                      fontStyle: 'italic',
                                      color: '#5c4327',
                                      marginTop: '4px',
                                      lineHeight: 1.25,
                                    }}
                                  >
                                    {block.caption}
                                  </figcaption>
                                )}
                              </figure>
                            );
                          }

                          // Default 'center'
                          return (
                            <figure
                              key={block.id}
                              style={{
                                margin: '16px auto',
                                maxWidth: '80%',
                                clear: 'both',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  padding: '5px',
                                  backgroundColor: '#fbf7ed',
                                  border: `2px solid ${themeBorder}`,
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                }}
                              >
                                <img
                                  src={block.imageUrl}
                                  alt={block.caption || 'Illustrazione'}
                                  style={{
                                    width: '100%',
                                    maxHeight: '280px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    display: 'block',
                                  }}
                                />
                              </div>
                              {block.caption && (
                                <figcaption
                                  style={{
                                    fontSize: '11px',
                                    fontStyle: 'italic',
                                    color: '#5c4327',
                                    marginTop: '5px',
                                  }}
                                >
                                  {block.caption}
                                </figcaption>
                              )}
                            </figure>
                          );
                        }

                        // 4. Paragraph Block
                        const isLead = idx === firstParagraphIndex;
                        const dropCapData = isLead ? leadStoryData : null;

                        if (isLead && dropCapData?.dropCap) {
                          return (
                            <div key={block.id} style={{ marginBottom: '12px' }}>
                              <span
                                style={{
                                  float: 'left',
                                  fontSize: '52px',
                                  lineHeight: '42px',
                                  paddingTop: '4px',
                                  paddingRight: '10px',
                                  paddingBottom: '2px',
                                  fontWeight: 900,
                                  color: themeAccent,
                                  fontFamily: "Georgia, serif",
                                }}
                              >
                                {dropCapData.dropCap}
                              </span>
                              <span>{renderAntiqueText(dropCapData.body)}</span>
                            </div>
                          );
                        }

                        return (
                          <p key={block.id} style={{ marginTop: '12px', marginBottom: '12px' }}>
                            {renderAntiqueText(block.text || '')}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Events Bulletin Section */}
                  {session.events && session.events.length > 0 && (
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: `2px solid ${themeBorder}80`, clear: 'both' }}>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#1a1006',
                          marginBottom: '14px',
                          fontFamily: "Georgia, 'Cinzel', serif",
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>⚔️</span> Bollettino dei Fatti Salienti
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {session.events.map((evt) => (
                          <div
                            key={evt.id}
                            style={{
                              backgroundColor: 'rgba(235, 222, 195, 0.7)',
                              border: `1px solid ${themeBorder}`,
                              borderRadius: '8px',
                              padding: '12px 14px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '6px',
                                marginBottom: '4px',
                              }}
                            >
                              <h4
                                style={{
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  color: '#1a1006',
                                  margin: 0,
                                  lineHeight: 1.3,
                                }}
                              >
                                {evt.title}
                              </h4>
                              {evt.impact === 'major' && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    backgroundColor: '#991b1b',
                                    color: '#fff',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontFamily: "Courier, 'JetBrains Mono', monospace",
                                  }}
                                >
                                  Cruciale
                                </span>
                              )}
                              {evt.impact === 'secret' && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    backgroundColor: activeTheme.colors.surface3 || '#581c87',
                                    color: '#fff',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontFamily: "Courier, 'JetBrains Mono', monospace",
                                  }}
                                >
                                  Segreto
                                </span>
                              )}
                            </div>

                            {evt.location && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#634726',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontFamily: "Courier, monospace",
                                }}
                              >
                                📍 <strong>{evt.location}</strong>
                              </div>
                            )}

                            {evt.description && (
                              <p
                                style={{
                                  fontSize: '12px',
                                  lineHeight: 1.45,
                                  color: '#2e1d0f',
                                  margin: 0,
                                }}
                              >
                                {renderAntiqueText(evt.description)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Entities & Attendees Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '14px',
                      marginTop: '20px',
                      paddingTop: '16px',
                      borderTop: `2px solid ${themeBorder}60`,
                      clear: 'both',
                    }}
                  >
                    {/* Entities */}
                    {linkedEntities.length > 0 && (
                      <div
                        style={{
                          backgroundColor: 'rgba(235, 222, 195, 0.5)',
                          border: `1px solid ${themeBorder}60`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#1a1006',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          👥 Protagonisti &amp; Fazioni Citati
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {linkedEntities.map((ent) => (
                            <span
                              key={ent._id}
                              style={{
                                fontSize: '11px',
                                fontFamily: "Courier, monospace",
                                fontWeight: 600,
                                color: '#3d2510',
                                backgroundColor: '#fbf7ed',
                                border: `1px solid ${themeBorder}`,
                                borderRadius: '4px',
                                padding: '2px 6px',
                              }}
                            >
                              {ent.name} [{ent.type.toUpperCase()}]
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attendees */}
                    {session.attendees && session.attendees.length > 0 && (
                      <div
                        style={{
                          backgroundColor: 'rgba(235, 222, 195, 0.5)',
                          border: `1px solid ${themeBorder}60`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#1a1006',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          🛡️ Avventurieri al Tavolo
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {session.attendees.map((att) => (
                            <span
                              key={att._id}
                              style={{
                                fontSize: '11px',
                                fontFamily: "Courier, monospace",
                                fontWeight: 700,
                                color: '#704818',
                                backgroundColor: '#fbf7ed',
                                border: `1px solid ${themeBorder}`,
                                borderRadius: '4px',
                                padding: '2px 6px',
                              }}
                            >
                              ⚔️ {att.characterName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scribe Signature & Wax Seal Footer */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '26px',
                      paddingTop: '16px',
                      borderTop: `4px double ${themeBorder}`,
                      clear: 'both',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Class Theme Wax Seal */}
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          backgroundColor: activeTheme.mainColor || '#8a1818',
                          border: `2px solid ${themeBorder}`,
                          color: activeTheme.accentColor || '#fef08a',
                          fontSize: '7.5px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          transform: 'rotate(-7deg)',
                          lineHeight: 1.15,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        }}
                      >
                        <span style={{ fontSize: '12px' }}>{activeTheme.icon}</span>
                        <span style={{ fontSize: '7px' }}>{activeTheme.name}</span>
                      </div>

                      <div>
                        <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#4f3b25' }}>
                          Certificato dagli Scribi Ufficiali del Tomo
                        </div>
                        <div
                          style={{
                            fontSize: '9.5px',
                            fontFamily: "Courier, monospace",
                            color: themeAccent,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          Cronache di Campagna &bull; {session.title}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#4f3b25' }}>
                      "Che la memoria rimanga viva nei secoli."
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
