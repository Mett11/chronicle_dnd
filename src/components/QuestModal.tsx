import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  Users,
  User,
  Lock,
  Eye,
  Crown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Entity, Player } from '../types';
import { useAuth } from './AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { MentionInput } from './MentionInput';
import { ImageGalleryUploader } from './ImageGalleryUploader';
import { OcrButton } from './OcrButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Portal } from './Portal';

export interface QuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuest?: Entity | null;
  defaultValues?: Partial<{
    name: string;
    progressNote: string;
    questScope: 'party' | 'personal';
    questPrivacy: 'public' | 'private';
    assigneePlayerId: string;
    sharedWithDm: boolean;
    status: 'open' | 'completed' | 'failed';
    images: string[];
  }>;
  customTitle?: string;
  onSaved?: (savedQuest: Entity) => void;
}

export function QuestModal({
  isOpen,
  onClose,
  initialQuest,
  defaultValues,
  customTitle,
  onSaved,
}: QuestModalProps) {
  const { player } = useAuth();
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => CampaignManager.getPlayers());

  // Form states
  const [name, setName] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [questScope, setQuestScope] = useState<'party' | 'personal'>('party');
  const [questPrivacy, setQuestPrivacy] = useState<'public' | 'private'>('public');
  const [assigneePlayerId, setAssigneePlayerId] = useState('');
  const [sharedWithDm, setSharedWithDm] = useState(true);
  const [status, setStatus] = useState<'open' | 'completed' | 'failed'>('open');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const players = CampaignManager.getPlayers();
    setAllPlayers(players);

    if (initialQuest) {
      setName(initialQuest.name || '');
      setProgressNote(initialQuest.progressNote || '');
      setQuestScope(initialQuest.questScope || 'party');
      setQuestPrivacy(initialQuest.questPrivacy || (initialQuest.questScope === 'personal' && !initialQuest.questPrivacy ? 'public' : 'public'));
      setAssigneePlayerId(initialQuest.assigneePlayerId || player?._id || players[0]?._id || '');
      setSharedWithDm(initialQuest.sharedWithDm !== undefined ? !!initialQuest.sharedWithDm : true);
      setStatus((initialQuest.status as any) || 'open');
      setImages(initialQuest.images || []);
    } else {
      setName(defaultValues?.name || '');
      setProgressNote(defaultValues?.progressNote || '');
      setQuestScope(defaultValues?.questScope || 'party');
      setQuestPrivacy(defaultValues?.questPrivacy || 'public');
      setAssigneePlayerId(defaultValues?.assigneePlayerId || player?._id || players[0]?._id || '');
      setSharedWithDm(defaultValues?.sharedWithDm !== undefined ? !!defaultValues?.sharedWithDm : true);
      setStatus(defaultValues?.status || 'open');
      setImages(defaultValues?.images || []);
    }
  }, [isOpen, initialQuest, defaultValues, player]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const selectedAssignee = allPlayers.find((p) => p._id === assigneePlayerId);
      const assigneeName = questScope === 'personal'
        ? selectedAssignee?.characterName || player?.characterName || 'Personaggio'
        : undefined;

      let savedQuest: Entity;

      if (initialQuest) {
        // Edit existing quest
        const updated = CampaignManager.updateEntity(initialQuest._id, {
          name: name.trim(),
          progressNote: progressNote.trim() || undefined,
          questScope: questScope,
          questPrivacy: questScope === 'personal' ? questPrivacy : undefined,
          assigneePlayerId: questScope === 'personal' ? assigneePlayerId : undefined,
          assigneePlayerName: assigneeName,
          sharedWithDm: questScope === 'personal' && questPrivacy === 'private' ? sharedWithDm : undefined,
          status: status,
          images: images.length > 0 ? images : undefined,
        });

        savedQuest = updated || initialQuest;
      } else {
        // Create new quest
        savedQuest = CampaignManager.addEntity({
          type: 'quest',
          name: name.trim(),
          status: status,
          progressNote: progressNote.trim() || undefined,
          questScope: questScope,
          questPrivacy: questScope === 'personal' ? questPrivacy : undefined,
          assigneePlayerId: questScope === 'personal' ? assigneePlayerId : undefined,
          assigneePlayerName: assigneeName,
          sharedWithDm: questScope === 'personal' && questPrivacy === 'private' ? sharedWithDm : undefined,
          images: images.length > 0 ? images : undefined,
        });
      }

      if (onSaved) {
        onSaved(savedQuest);
      }
      onClose();
    } catch (err) {
      console.error('Error saving quest:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="bg-surface-1 rounded-[2px] max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col border border-surface-2 shadow-2xl overflow-hidden shrink-0"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-2 bg-surface-1 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-[2px] bg-primary/10 text-primary">
                <Target size={18} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-content-1">
                  {customTitle || (initialQuest ? 'Modifica Missione / Obiettivo' : 'Nuova Missione / Obiettivo')}
                </h3>
                <p className="text-[11px] text-content-3">
                  {questScope === 'party'
                    ? 'Missione condivisa con l\'intera compagnia'
                    : questPrivacy === 'public'
                    ? 'Quest personale visibile ai compagni per lettura'
                    : 'Quest personale segreta (visibile solo al tuo PG)'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-[2px] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs">
            {/* Title / Name */}
            <div>
              <label className="block font-medium text-content-2 mb-1.5 text-[11px] font-mono uppercase tracking-wider">
                Titolo Missione / Obiettivo <span className="text-primary">*</span>
              </label>
              <MentionInput
                required
                placeholder="Es: Trovare la reliquia perduta di Neverwinter..."
                value={name}
                onValueChange={setName}
                className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3.5 py-2.5 text-content-1 outline-none text-xs"
              />
            </div>

            {/* Scope & Privacy Selection Box */}
            <div className="space-y-3 bg-surface-2/40 border border-surface-2 rounded-[2px] p-4">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-content-1 text-xs">
                  Ambito & Visibilità della Quest <span className="text-primary">*</span>
                </label>
                <span className="text-[10px] text-content-3 font-mono">
                  {questScope === 'party'
                    ? '🛡️ Di Gruppo'
                    : questPrivacy === 'public'
                    ? '👤 Personale (Leggibile da tutti)'
                    : '🔒 Personale (Segreta)'}
                </span>
              </div>

              {/* 1. Scope toggle: Party vs Personal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Party Quest */}
                <button
                  type="button"
                  onClick={() => setQuestScope('party')}
                  className={`p-3 rounded-[2px] border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    questScope === 'party'
                      ? 'bg-primary/10 border-primary text-content-1'
                      : 'bg-surface-2 border-surface-2 text-content-2 hover:text-content-1'
                  }`}
                >
                  <div
                    className={`p-2 rounded-[2px] shrink-0 ${
                      questScope === 'party'
                        ? 'bg-primary text-surface-0'
                        : 'bg-surface-3 text-content-3'
                    }`}
                  >
                    <Users size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-content-1 flex items-center gap-1.5">
                      Quest di Gruppo
                    </div>
                    <p className="text-[11px] text-content-3 mt-0.5 leading-snug">
                      Missione comune della compagnia, condivisa con tutti i membri
                    </p>
                  </div>
                </button>

                {/* Personal Quest */}
                <button
                  type="button"
                  onClick={() => setQuestScope('personal')}
                  className={`p-3 rounded-[2px] border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    questScope === 'personal'
                      ? 'bg-amber-500/10 border-amber-500 text-content-1'
                      : 'bg-surface-2 border-surface-2 text-content-2 hover:text-content-1'
                  }`}
                >
                  <div
                    className={`p-2 rounded-[2px] shrink-0 ${
                      questScope === 'personal'
                        ? 'bg-amber-500 text-surface-0'
                        : 'bg-surface-3 text-content-3'
                    }`}
                  >
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-content-1 flex items-center gap-1.5">
                      Quest Personale PG
                    </div>
                    <p className="text-[11px] text-content-3 mt-0.5 leading-snug">
                      Obiettivo specifico del personaggio singolo
                    </p>
                  </div>
                </button>
              </div>

              {/* 2. When Personal Quest is chosen: Personal Assignee & Reading Permissions */}
              {questScope === 'personal' && (
                <div className="pt-3 border-t border-surface-2 space-y-3 animate-in fade-in duration-150">
                  {/* Assignee Selection */}
                  <div>
                    <label className="block font-medium text-content-2 mb-1 text-[11px] font-mono uppercase tracking-wider">
                      Assegnata al Personaggio
                    </label>
                    <select
                      value={assigneePlayerId}
                      onChange={(e) => setAssigneePlayerId(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none text-xs"
                    >
                      {allPlayers.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.characterName} {p.isDm ? '(Dungeon Master)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reading Privacy Options for Personal Quest */}
                  <div>
                    <label className="block font-medium text-content-2 mb-1.5 text-[11px] font-mono uppercase tracking-wider">
                      Permessi di Lettura per gli altri Giocatori
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Public / Readable by Companions */}
                      <button
                        type="button"
                        onClick={() => setQuestPrivacy('public')}
                        className={`p-2.5 rounded-[2px] border text-left flex items-start gap-2 transition-all cursor-pointer ${
                          questPrivacy === 'public'
                            ? 'bg-cyan-500/10 border-cyan-500 text-content-1'
                            : 'bg-surface-2 border-surface-2 text-content-3 hover:text-content-1'
                        }`}
                      >
                        <Eye size={14} className={questPrivacy === 'public' ? 'text-cyan-400 mt-0.5' : 'text-content-3 mt-0.5'} />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-content-1">
                            Condivisa (Leggibile)
                          </div>
                          <div className="text-[10px] text-content-3 mt-0.5">
                            Gli altri compagni possono leggere l'obiettivo nel registro
                          </div>
                        </div>
                      </button>

                      {/* Private / Secret */}
                      <button
                        type="button"
                        onClick={() => setQuestPrivacy('private')}
                        className={`p-2.5 rounded-[2px] border text-left flex items-start gap-2 transition-all cursor-pointer ${
                          questPrivacy === 'private'
                            ? 'bg-purple-500/10 border-purple-500 text-content-1'
                            : 'bg-surface-2 border-surface-2 text-content-3 hover:text-content-1'
                        }`}
                      >
                        <Lock size={14} className={questPrivacy === 'private' ? 'text-purple-400 mt-0.5' : 'text-content-3 mt-0.5'} />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-content-1">
                            Riservata / Segreta
                          </div>
                          <div className="text-[10px] text-content-3 mt-0.5">
                            Invisibile agli altri compagni (solo tuo PG)
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* If Private: Option to share with DM */}
                  {questPrivacy === 'private' && (
                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-[2px] hover:bg-amber-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={sharedWithDm}
                          onChange={(e) => setSharedWithDm(e.target.checked)}
                          className="rounded-[2px] border-amber-500/50 text-amber-600 focus:ring-0"
                        />
                        <Crown size={14} className="text-amber-400 shrink-0" />
                        <span className="font-medium">
                          Condividi visibilità con il Dungeon Master (consigliato per intrecci di trama)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('open')}
                className={`py-2 px-3 rounded-[2px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  status === 'open'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold'
                    : 'bg-surface-2 border-surface-2 text-content-3 hover:text-content-1'
                }`}
              >
                <Clock size={13} />
                <span>In Corso (Aperta)</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`py-2 px-3 rounded-[2px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-semibold'
                    : 'bg-surface-2 border-surface-2 text-content-3 hover:text-content-1'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Completata</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('failed')}
                className={`py-2 px-3 rounded-[2px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  status === 'failed'
                    ? 'bg-red-500/10 border-red-500 text-red-400 font-semibold'
                    : 'bg-surface-2 border-surface-2 text-content-3 hover:text-content-1'
                }`}
              >
                <AlertCircle size={13} />
                <span>Fallita / Abbandonata</span>
              </button>
            </div>

            {/* Description & Progress Notes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-medium text-content-2 text-[11px] font-mono uppercase tracking-wider">
                  Descrizione, Tappe & Avanzamento
                </label>
                <OcrButton
                  compact
                  label="Trascrivi Foto (OCR)"
                  onScanComplete={(transcribed) => {
                    setProgressNote((prev) => (prev.trim() ? `${prev}\n\n${transcribed}` : transcribed));
                  }}
                />
              </div>
              <textarea
                rows={5}
                placeholder="Descrivi i dettagli della missione, indizi raccolti, tappe intermedie o ricompense promesse..."
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] p-3 text-content-1 outline-none text-xs leading-relaxed"
              />
            </div>

            {/* Image attachments */}
            <ImageGalleryUploader
              images={images}
              onChange={setImages}
              label="Illustrazioni, Mappe o Pergamene della Quest"
              maxImages={4}
              entityName={name}
              entityType="quest"
              contextDescription={progressNote}
            />
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-surface-2 flex justify-end gap-2 bg-surface-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 rounded-[2px] text-xs font-semibold bg-primary disabled:opacity-40 text-surface-0 hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
            >
              {initialQuest ? 'Salva Modifiche' : 'Crea Missione'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  </Portal>
  );
}
