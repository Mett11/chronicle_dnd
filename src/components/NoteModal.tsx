import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  HelpCircle,
  Edit3,
  Users,
  User,
  Lock,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  Check,
  Clock,
} from 'lucide-react';
import { Note, Session, Category } from '../types';
import { useAuth } from './AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { RichTextEditor } from './RichTextEditor';
import { MentionInput } from './MentionInput';
import { ImageGalleryUploader } from './ImageGalleryUploader';
import { OcrButton } from './OcrButton';
import { LoreDateInput } from './LoreDateInput';
import { motion, AnimatePresence } from 'framer-motion';
import { Portal } from './Portal';

export interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNote?: Note | null;
  defaultValues?: Partial<{
    title: string;
    content: string;
    categoryId: string;
    sessionId: string;
    visibility: 'group' | 'personal';
    dmOnly: boolean;
    askDm: boolean;
    canonState: 'canon' | 'theory' | 'unknown';
    loreDate: string;
    images: string[];
  }>;
  customTitle?: string;
  onSaved?: (savedNote: Note) => void;
}

export function NoteModal({
  isOpen,
  onClose,
  initialNote,
  defaultValues,
  customTitle,
  onSaved,
}: NoteModalProps) {
  const { player } = useAuth();

  const [categories, setCategories] = useState<Category[]>(() => CampaignManager.getCategories());
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loreDate, setLoreDate] = useState('');
  const [visibility, setVisibility] = useState<'group' | 'personal'>('group');
  const [dmOnly, setDmOnly] = useState(false);
  const [askDm, setAskDm] = useState(false);
  const [canonState, setCanonState] = useState<'canon' | 'theory' | 'unknown'>('canon');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync data when modal opens or props change
  useEffect(() => {
    if (!isOpen) return;

    // Refresh categories and sessions from store
    setCategories(CampaignManager.getCategories());
    setSessions(CampaignManager.getSessions());

    if (initialNote) {
      // Editing existing note
      setTitle(initialNote.title || '');
      setContent(initialNote.content || '');
      setCategoryId(initialNote.category?._id || '');
      setSessionId(initialNote.session?._id || '');
      setLoreDate(initialNote.loreDate || '');
      setVisibility(initialNote.visibility || 'group');
      setDmOnly(!!initialNote.dmOnly);
      setAskDm(!!initialNote.askDm);
      setCanonState(initialNote.canonState || 'canon');
      setImages(initialNote.images || []);
    } else {
      // Creating new note
      setTitle(defaultValues?.title || '');
      setContent(defaultValues?.content || '');
      setCategoryId(defaultValues?.categoryId || '');
      setSessionId(defaultValues?.sessionId || '');
      setLoreDate(defaultValues?.loreDate || '');
      setVisibility(defaultValues?.visibility || 'group');
      setDmOnly(!!defaultValues?.dmOnly);
      setAskDm(!!defaultValues?.askDm);
      setCanonState(defaultValues?.canonState || 'canon');
      setImages(defaultValues?.images || []);
    }
  }, [isOpen, initialNote, defaultValues]);

  if (!isOpen) return null;

  const isEditing = !!initialNote;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !player) return;

    setIsSubmitting(true);
    try {
      const selectedCategory = categories.find((c) => c._id === categoryId);
      const selectedSession = sessions.find((s) => s._id === sessionId);

      let savedNote: Note;

      if (isEditing && initialNote) {
        const updated = CampaignManager.updateNote(initialNote._id, {
          title: title.trim(),
          content: content.trim() || undefined,
          category: selectedCategory,
          session: selectedSession,
          visibility: visibility,
          dmOnly: dmOnly,
          askDm: askDm,
          canonState: canonState,
          images: images,
          loreDate: loreDate.trim() || undefined,
        });

        if (updated) {
          savedNote = updated;
        } else {
          // If note wasn't in array, create it
          savedNote = CampaignManager.addNote(
            {
              title: title.trim(),
              content: content.trim() || undefined,
              category: selectedCategory,
              session: selectedSession,
              visibility: visibility,
              dmOnly: dmOnly,
              askDm: askDm,
              canonState: canonState,
              images: images,
              loreDate: loreDate.trim() || undefined,
            },
            player
          );
        }
      } else {
        // Create new note
        savedNote = CampaignManager.addNote(
          {
            title: title.trim(),
            content: content.trim() || undefined,
            category: selectedCategory,
            session: selectedSession,
            visibility: visibility,
            dmOnly: dmOnly,
            askDm: askDm,
            canonState: canonState,
            pinned: false,
            images: images,
            loreDate: loreDate.trim() || undefined,
          },
          player
        );
      }

      // Notify other components
      window.dispatchEvent(new CustomEvent('chronicle_notes_updated'));
      window.dispatchEvent(new CustomEvent('chronicle_data_updated'));

      if (onSaved) {
        onSaved(savedNote);
      }
      onClose();
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalHeaderTitle = customTitle || (
    isEditing
      ? 'Modifica Nota'
      : askDm
      ? 'Domanda Riservata al Dungeon Master'
      : visibility === 'personal'
      ? 'Nuovo Appunto Personale'
      : 'Nuova Nota nel Diario'
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="bg-surface-1 rounded-[2px] max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] my-auto flex flex-col border border-surface-2 shadow-2xl overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-2 bg-surface-1 shrink-0">
            <h3 className="font-serif font-bold text-base text-content-1 flex items-center gap-2">
              {isEditing ? (
                <Edit3 size={16} className="text-primary" />
              ) : askDm ? (
                <HelpCircle size={16} className="text-amber-400" />
              ) : (
                <BookOpen size={16} className="text-primary" />
              )}
              <span>{modalHeaderTitle}</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-content-3 hover:text-content-1 rounded-md transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs">
            {/* Title */}
            <div>
              <label className="block font-medium text-content-2 mb-1 text-[11px] font-mono uppercase tracking-wider">
                Titolo Nota <span className="text-primary">*</span>
              </label>
              <MentionInput
                required
                placeholder={
                  askDm
                    ? 'Es: Chiarimento sul mio background o una visione...'
                    : visibility === 'personal'
                    ? 'Es: Teoria sulla tomba a nord o segreto...'
                    : 'Es: Resoconto dell\'incursione o accordo stipulato...'
                }
                value={title}
                onValueChange={setTitle}
                className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none text-xs"
              />
            </div>

            {/* Visibility & Destination */}
            <div className="space-y-2.5 bg-surface-2/40 border border-surface-2 rounded-[2px] p-4">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-content-1 text-xs">
                  Visibilità & Destinazione <span className="text-primary">*</span>
                </label>
                <span className="text-[10px] text-content-3 font-mono">
                  {player?.isDm && dmOnly
                    ? '🔒 Segreto del Master'
                    : visibility === 'personal'
                    ? dmOnly
                      ? '👤 Personale + Condivisa con DM'
                      : '👤 Personale Riservata'
                    : '👥 Condivisa col Gruppo'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Group Note */}
                <button
                  type="button"
                  onClick={() => {
                    setVisibility('group');
                    setDmOnly(false);
                  }}
                  className={`p-3 rounded-[2px] border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    visibility === 'group' && !dmOnly
                      ? 'bg-primary/10 border-primary text-content-1'
                      : 'bg-surface-2 border-surface-2 text-content-2 hover:text-content-1'
                  }`}
                >
                  <div
                    className={`p-2 rounded-[2px] shrink-0 ${
                      visibility === 'group' && !dmOnly
                        ? 'bg-primary text-surface-0'
                        : 'bg-surface-3 text-content-3'
                    }`}
                  >
                    <Users size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-content-1 flex items-center gap-1.5">
                      Nota di Gruppo
                    </div>
                    <p className="text-[11px] text-content-3 mt-0.5 leading-snug">
                      Visibile a tutti i compagni della campagna
                    </p>
                  </div>
                </button>

                {/* Personal Note */}
                <button
                  type="button"
                  onClick={() => {
                    setVisibility('personal');
                  }}
                  className={`p-3 rounded-[2px] border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    visibility === 'personal' && !(player?.isDm && dmOnly)
                      ? 'bg-amber-500/10 border-amber-500 text-content-1'
                      : 'bg-surface-2 border-surface-2 text-content-2 hover:text-content-1'
                  }`}
                >
                  <div
                    className={`p-2 rounded-[2px] shrink-0 ${
                      visibility === 'personal' && !(player?.isDm && dmOnly)
                        ? 'bg-amber-500 text-surface-0'
                        : 'bg-surface-3 text-content-3'
                    }`}
                  >
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-content-1 flex items-center gap-1.5">
                      Nota Personale PG
                    </div>
                    <p className="text-[11px] text-content-3 mt-0.5 leading-snug">
                      Privata, visibile solo al tuo personaggio
                    </p>
                  </div>
                </button>
              </div>

              {/* Special options */}
              <div className="pt-2 border-t border-surface-2 flex flex-wrap items-center gap-3">
                {player?.isDm ? (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-[2px] hover:bg-purple-500/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={dmOnly}
                      onChange={(e) => {
                        setDmOnly(e.target.checked);
                        if (e.target.checked) setVisibility('personal');
                      }}
                      className="rounded-[2px] border-purple-500/50 text-purple-600 focus:ring-0"
                    />
                    <Lock size={13} className="text-purple-400 shrink-0" />
                    <span className="font-medium">Segreto del DM (invisibile ai giocatori)</span>
                  </label>
                ) : (
                  <>
                    {visibility === 'personal' && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-[2px] hover:bg-amber-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={dmOnly}
                          onChange={(e) => setDmOnly(e.target.checked)}
                          className="rounded-[2px] border-amber-500/50 text-amber-600 focus:ring-0"
                        />
                        <Eye size={13} className="text-amber-400 shrink-0" />
                        <span className="font-medium">Condividi lettura col Master</span>
                      </label>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-[2px] hover:bg-cyan-500/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={askDm}
                        onChange={(e) => setAskDm(e.target.checked)}
                        className="rounded-[2px] border-cyan-500/50 text-cyan-600 focus:ring-0"
                      />
                      <HelpCircle size={13} className="text-cyan-400 shrink-0" />
                      <span className="font-medium">Richiedi chiarimento/risposta al DM</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Lore Date & Session Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-content-2 mb-1 text-[11px] font-mono uppercase tracking-wider">
                  Sessione Collegata
                </label>
                <select
                  value={sessionId}
                  onChange={(e) => {
                    const newSessId = e.target.value;
                    setSessionId(newSessId);
                  }}
                  className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none text-xs cursor-pointer"
                >
                  <option value="">Nessuna sessione specifica</option>
                  {sessions.map((s) => (
                    <option key={s._id} value={s._id}>
                      Sessione #{s.number} - {s.title} {s.loreDate ? `(${s.loreDate})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <LoreDateInput
                  value={loreDate}
                  onChange={setLoreDate}
                  sessionId={sessionId}
                  sessions={sessions}
                  placeholder="Es: 31 Kindolin 589 IV era"
                />
              </div>
            </div>

            {/* Category & Canon State Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-content-2 mb-1 text-[11px] font-mono uppercase tracking-wider">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none text-xs cursor-pointer"
                >
                  <option value="">Nessuna categoria</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-content-2 mb-1 text-[11px] font-mono uppercase tracking-wider">
                  Stato Narrativo
                </label>
                <select
                  value={canonState}
                  onChange={(e) => setCanonState(e.target.value as 'canon' | 'theory')}
                  className="w-full bg-surface-2 border border-surface-2 focus:border-primary rounded-[2px] px-3 py-2 text-content-1 outline-none text-xs cursor-pointer"
                >
                  <option value="canon">Fatto Accertato (Canone)</option>
                  <option value="theory">Ipotesi / Teoria del Personaggio</option>
                </select>
              </div>
            </div>

            {/* Rich Note Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-medium text-content-2 text-[11px] font-mono uppercase tracking-wider">
                  Contenuto dell&apos;Appunto
                </label>
                <OcrButton
                  compact
                  label="Trascrivi Foto (OCR)"
                  onScanComplete={(transcribed) => {
                    setContent((prev) => (prev.trim() ? `${prev}\n\n${transcribed}` : transcribed));
                  }}
                />
              </div>
              <RichTextEditor
                placeholder="Scrivi note, indizi, descrizioni o trascrivi da foto..."
                value={content}
                onChange={setContent}
              />
            </div>

            {/* Illustrations and Attachments */}
            <ImageGalleryUploader
              images={images}
              onChange={setImages}
              label="Illustrazioni & Allegati"
              maxImages={6}
              entityName={title}
              entityType={categoryId ? 'note_categorized' : 'note'}
              contextDescription={content}
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-surface-2 flex justify-end gap-2 bg-surface-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-5 py-2 rounded-[2px] text-xs font-semibold bg-primary disabled:opacity-40 text-surface-0 hover:bg-primary-hover transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{isEditing ? 'Salva Modifiche' : askDm ? 'Invia al DM' : 'Salva Nota'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  </Portal>
  );
}
