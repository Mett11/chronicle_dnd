import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Entity, WorldMap as WorldMapType, MapFolder, EntitySecretItem } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { CATEGORY_DEFINITIONS } from '../pages/Entities';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EntityMentionText } from './EntityMentionText';
import { useAuth } from './AuthProvider';
import { Portal } from './Portal';
import {
  X,
  ExternalLink,
  MapPin,
  Map as MapIcon,
  Compass,
  Folder as FolderIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Skull,
  Users,
  ChevronRight,
  ArrowRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EntityDetailModalProps {
  entity: Entity | null;
  isOpen: boolean;
  onClose: () => void;
  sourceContextTitle?: string; // e.g. "Sessione 4: ..."
}

export function EntityDetailModal({
  entity,
  isOpen,
  onClose,
  sourceContextTitle,
}: EntityDetailModalProps) {
  const navigate = useNavigate();
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [maps, setMaps] = useState<WorldMapType[]>(() => CampaignManager.getMaps());
  const [folders, setFolders] = useState<MapFolder[]>(() => CampaignManager.getMapFolders());

  useEffect(() => {
    if (isOpen) {
      setMaps(CampaignManager.getMaps());
      setFolders(CampaignManager.getMapFolders());
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (activeLightboxImg) {
          setActiveLightboxImg(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeLightboxImg, onClose]);

  if (!isOpen || !entity) return null;

  const categoryConfig = CATEGORY_DEFINITIONS[entity.type || 'npc'] || CATEGORY_DEFINITIONS.npc;
  const CategoryIcon = categoryConfig.icon || Users;

  const handleNavigateToCodex = () => {
    onClose();
    navigate(`/entities/${entity.type}/${entity._id}`);
  };

  const renderStatusBadge = (status: Entity['status']) => {
    if (entity.type === 'quest') {
      const isCompleted = status === 'completed';
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            isCompleted
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
          }`}
        >
          {isCompleted ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          <span>{isCompleted ? 'Completata' : 'In Corso'}</span>
        </span>
      );
    }

    if (status === 'dead') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
          <Skull size={12} />
          <span>Caduto / Morto</span>
        </span>
      );
    }

    if (status === 'unknown') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-surface-3 text-content-3 border border-surface-4">
          <HelpCircle size={12} />
          <span>Stato Ignoto</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
        <CheckCircle2 size={12} />
        <span>Attivo / In Vita</span>
      </span>
    );
  };

  return (
    <Portal>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-0/80 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-surface-1 rounded-2xl max-w-3xl w-full max-h-[calc(100dvh-2rem)] my-auto flex flex-col overflow-hidden border border-surface-2 shadow-2xl shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context Breadcrumb / Alert Bar */}
            <div className="bg-surface-2/60 px-5 sm:px-6 py-2 border-b border-surface-2 flex items-center justify-between text-[11px] font-mono text-content-3">
              <span className="flex items-center gap-1.5 truncate">
                <span className="text-primary font-medium">Anteprima Rapida</span>
                <span>&bull;</span>
                <span className="truncate">{sourceContextTitle || 'Cronaca di Sessione'}</span>
              </span>
              <button
                type="button"
                onClick={handleNavigateToCodex}
                className="hover:text-primary transition-colors flex items-center gap-1 shrink-0 ml-2 cursor-pointer font-sans"
              >
                <span>Vai a {categoryConfig.title} Codex</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-surface-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                    categoryConfig.bgGlow || 'bg-surface-2 border-surface-3'
                  }`}
                >
                  <CategoryIcon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-content-3">
                      {categoryConfig.singular}
                    </span>
                    {categoryConfig.heraldicSigil && (
                      <span className="text-[10px] font-serif italic text-content-3/70 hidden sm:inline">
                        — {categoryConfig.heraldicSigil}
                      </span>
                    )}
                  </div>
                  <h2 className="font-heading font-bold text-lg sm:text-xl text-content-1 truncate">
                    <EntityMentionText text={entity.name} />
                  </h2>
                  {entity.aliases && entity.aliases.length > 0 && (
                    <p className="text-xs text-content-3 truncate">
                      Alias: {entity.aliases.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {entity.type === 'place' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/map');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-surface-2 text-content-1 hover:bg-surface-3 font-medium text-xs hidden sm:flex items-center gap-1.5 transition-colors border border-surface-3"
                    title="Visualizza nell'Atlante Cartografico"
                  >
                    <MapIcon size={13} className="text-primary" />
                    <span>Atlante</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNavigateToCodex}
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={`Apri la scheda completa in ${categoryConfig.title} nel Codex`}
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Vai a {categoryConfig.title}</span>
                  <span className="sm:hidden">Codex</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                  title="Chiudi e torna al testo della sessione"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
              {/* Meta & Status Row */}
              <div className="flex flex-wrap items-center gap-2">
                {renderStatusBadge(entity.status)}

                {entity.questScope && (
                  <span className="px-2.5 py-1 rounded-lg bg-surface-2 text-content-2 border border-surface-3 text-xs font-medium">
                    Ambito: {entity.questScope === 'party' ? 'Gruppo' : `Personale (${entity.assigneePlayerName || 'PG'})`}
                  </span>
                )}

                {entity.location && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-2 text-content-2 border border-surface-3 text-xs font-medium">
                    <MapPin size={12} className="text-sky-400" />
                    <span>{entity.location}</span>
                  </span>
                )}
              </div>

              {/* Cartography Link Box for Places */}
              {entity.type === 'place' && (() => {
                const placeMap = maps.find((m) => m.id === entity.mapId);
                const linkedFolder = folders.find(
                  (f) => f.placeEntityId === entity._id || (entity.folderId && f.id === entity.folderId)
                );
                const folderMaps = linkedFolder ? maps.filter((m) => m.folderId === linkedFolder.id) : [];

                return (
                  <div className="bg-surface-2/70 p-4 rounded-xl border border-surface-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-content-1 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                        <MapIcon size={14} className="text-primary" />
                        <span>Riferimento Cartografico</span>
                      </h4>
                      {entity.mapId || linkedFolder ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                          Collegato ad Atlante
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-content-3">
                          Non Collegato
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="space-y-1 bg-surface-1/70 p-2.5 rounded-lg border border-surface-3/70">
                        <span className="text-content-3 text-[11px] font-medium block">Mappa Collegata:</span>
                        <p className="text-content-1 font-medium flex items-center gap-1.5 truncate">
                          <Compass size={13} className="text-primary shrink-0" />
                          <span className="truncate">{placeMap?.title || 'Nessuna mappa selezionata'}</span>
                        </p>
                      </div>

                      {entity.pinX !== undefined && entity.pinY !== undefined && (
                        <div className="space-y-1 bg-surface-1/70 p-2.5 rounded-lg border border-surface-3/70">
                          <span className="text-content-3 text-[11px] font-medium block">Coordinate Segnaposto:</span>
                          <p className="text-content-1 font-mono text-[11px]">
                            X: {entity.pinX}% | Y: {entity.pinY}% ({entity.pinCategory || 'city'})
                          </p>
                        </div>
                      )}
                    </div>

                    {linkedFolder && (
                      <div className="p-2.5 rounded-lg bg-surface-1/70 border border-surface-3/70 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <FolderIcon size={13} style={{ color: linkedFolder.color || '#d4af37' }} />
                          <span className="font-semibold text-content-1 truncate">Cartella Atlante: {linkedFolder.name}</span>
                          <span className="text-[10px] text-content-3 ml-auto">({folderMaps.length} mappe)</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-3/70">
                      {entity.mapId ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/map?mapId=${entity.mapId}${entity.pinId ? `&pinId=${entity.pinId}` : ''}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-primary text-surface-0 hover:bg-primary-hover text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Compass size={13} />
                          <span>Centra sulla Mappa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/map?placeId=${entity._id}&action=place`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-surface-3 text-content-1 hover:bg-surface-4 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <MapPin size={13} />
                          <span>Piazza ora sull'Atlante</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Progress Note / Chronicle Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider font-mono">
                  Dettagli Narrativi &amp; Descrizione
                </h4>
                {entity.progressNote ? (
                  <div className="bg-surface-2/60 p-4 sm:p-5 rounded-xl border border-surface-3 text-sm text-content-2 leading-relaxed text-pretty">
                    <MarkdownRenderer content={entity.progressNote} />
                  </div>
                ) : (
                  <p className="text-xs text-content-3 italic bg-surface-2/30 p-4 rounded-xl border border-surface-3/60">
                    Nessuna nota descrittiva o cronaca memorizzata per questa voce.
                  </p>
                )}
              </div>

              {/* Present Status & Dynamic World Memory */}
              {entity.aiConfig?.currentStatus && (
                <div className="space-y-1.5 p-3.5 rounded-xl bg-surface-2/50 border border-primary/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary font-mono uppercase tracking-wider">
                    <CheckCircle2 size={13} />
                    <span>Stato Attuale nel Presente</span>
                  </div>
                  <p className="text-xs text-content-1 italic pl-5 leading-relaxed">
                    "{entity.aiConfig.currentStatus}"
                  </p>
                </div>
              )}

              {/* Timeline Memories Preview */}
              {entity.aiConfig?.timelineMemories && entity.aiConfig.timelineMemories.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>Cronologia Memorie &amp; Svolte Storiche ({entity.aiConfig.timelineMemories.length})</span>
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {entity.aiConfig.timelineMemories.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-2.5 rounded-lg bg-surface-2/60 border border-surface-3 text-xs space-y-1 hover:border-surface-4 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-content-1 truncate">{mem.title}</span>
                          {mem.loreDate && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                              {mem.loreDate}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-content-2 leading-relaxed">{mem.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolving Beliefs Preview */}
              {entity.aiConfig?.evolvingBeliefs && entity.aiConfig.evolvingBeliefs.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider font-mono">
                    Teorie &amp; Credenze Evolutive ({entity.aiConfig.evolvingBeliefs.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {entity.aiConfig.evolvingBeliefs.map((b) => (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-lg bg-surface-2/60 border border-surface-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-content-1">{b.subject}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                              b.status === 'proven_fact'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : b.status === 'shattered_belief'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : b.status === 'suspicion'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {b.status === 'proven_fact'
                              ? 'Fatto Accertato'
                              : b.status === 'shattered_belief'
                              ? 'Credenza Smentita'
                              : b.status === 'suspicion'
                              ? 'Forte Sospetto'
                              : 'Teoria Attiva'}
                          </span>
                        </div>
                        {b.previousBelief && (
                          <p className="text-[10px] text-content-3 line-through leading-relaxed">
                            {b.previousBelief}
                          </p>
                        )}
                        <p className="text-[11px] text-content-2 leading-relaxed">{b.currentTruth}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Gallery */}
              {entity.images && entity.images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-content-3 uppercase tracking-wider font-mono">
                    Ritratti &amp; Illustrazioni ({entity.images.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {entity.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveLightboxImg(img)}
                        className="aspect-video rounded-xl overflow-hidden cursor-pointer bg-surface-2 border border-surface-3 relative group"
                        title="Clicca per ingrandire"
                      >
                        <img
                          src={img}
                          alt={`${entity.name} illustrazione ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Primary User Action */}
            <div className="p-4 sm:p-5 border-t border-surface-2 bg-surface-1 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-content-3 font-sans">
                Chiudendo la scheda rimarrai al punto di lettura della sessione.
              </span>

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-content-2 hover:text-content-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer"
                >
                  Chiudi (Rimani sulla Sessione)
                </button>

                <button
                  type="button"
                  onClick={handleNavigateToCodex}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-primary text-surface-0 hover:bg-primary-hover shadow-sm transition-all flex items-center gap-1.5 cursor-pointer font-semibold"
                >
                  <span>Vai a {categoryConfig.title} Codex</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Lightbox for gallery images */}
        {activeLightboxImg && (
          <div
            className="fixed inset-0 z-60 bg-surface-0/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveLightboxImg(null)}
          >
            <div className="relative max-w-4xl max-h-[90dvh] flex items-center justify-center">
              <button
                type="button"
                onClick={() => setActiveLightboxImg(null)}
                className="absolute -top-10 right-0 text-content-3 hover:text-content-1 p-2 cursor-pointer"
              >
                <X size={24} />
              </button>
              <img
                src={activeLightboxImg}
                alt="Ingrandimento"
                className="max-h-[85dvh] w-auto max-w-full rounded-xl border border-surface-3 shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
