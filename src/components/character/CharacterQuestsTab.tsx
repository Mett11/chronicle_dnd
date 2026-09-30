import React from 'react';
import {
  Target,
  Plus,
  Lock,
  Eye,
  CheckCircle2,
  Edit3,
  Trash2,
  Shield,
  Clock,
} from 'lucide-react';
import { Entity, CharacterSectionPrivacy } from '../../types';

interface CharacterQuestsTabProps {
  quests: Entity[];
  isOtherPlayerView?: boolean;
  privacySettings?: CharacterSectionPrivacy;
  onTogglePrivacy?: (section: keyof CharacterSectionPrivacy) => void;
  onOpenCreateQuest: () => void;
  onEditQuest: (quest: Entity) => void;
  onToggleQuestStatus: (quest: Entity, newStatus: Entity['status']) => void;
  onRequestDeleteQuest: (questId: string) => void;
  characterName: string;
}

export function CharacterQuestsTab({
  quests,
  isOtherPlayerView = false,
  privacySettings,
  onTogglePrivacy,
  onOpenCreateQuest,
  onEditQuest,
  onToggleQuestStatus,
  onRequestDeleteQuest,
  characterName,
}: CharacterQuestsTabProps) {
  const isSectionVisibleToParty = privacySettings?.quests ?? true;

  // Filter quests visible to other player:
  // If entire section is private, other players cannot see it
  if (isOtherPlayerView && !isSectionVisibleToParty) {
    return (
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center mx-auto text-content-3">
          <Lock size={22} />
        </div>
        <h3 className="font-heading text-sm font-semibold text-content-1">
          Obiettivi &amp; Missioni Riservate
        </h3>
        <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
          {characterName} ha scelto di non condividere i propri obiettivi personali con il gruppo.
        </p>
      </div>
    );
  }

  // If section is visible to party, still respect individual quest privacy (e.g. personal quest with questPrivacy === 'private')
  const visibleQuests = isOtherPlayerView
    ? quests.filter((q) => {
        if (q.questScope === 'personal' && q.questPrivacy === 'private') return false;
        return true;
      })
    : quests;

  const activeQuests = visibleQuests.filter((q) => q.status !== 'completed');

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header bar with count & privacy control */}
      <div className="bg-surface-1 border border-surface-2 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Target size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm text-content-1">
                {isOtherPlayerView ? `Obiettivi di ${characterName}` : 'Obiettivi & Quest Personali'}
              </h2>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-2 border border-surface-3 text-content-2">
                {visibleQuests.length}
              </span>
              {activeQuests.length > 0 && (
                <span className="text-[11px] text-cyan-400 font-medium">
                  ({activeQuests.length} in corso)
                </span>
              )}
            </div>
            <p className="text-[11px] text-content-3">
              {isOtherPlayerView
                ? 'Missioni personali e scopi condivisi con il party'
                : 'Traccia desideri, scopi di background e missioni riservate'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isOtherPlayerView && onTogglePrivacy && (
            <button
              type="button"
              onClick={() => onTogglePrivacy('quests')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                isSectionVisibleToParty
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title={
                isSectionVisibleToParty
                  ? 'Sezione Quest visibile al party. Clicca per renderla privata.'
                  : 'Sezione Quest privata. Clicca per mostrarla al party.'
              }
            >
              {isSectionVisibleToParty ? <Eye size={13} /> : <Lock size={13} />}
              <span>{isSectionVisibleToParty ? 'Visibile al Party' : 'Privato al Giocatore'}</span>
            </button>
          )}

          {!isOtherPlayerView && (
            <button
              type="button"
              id="quests-tab-create-btn"
              onClick={onOpenCreateQuest}
              className="px-3 py-1.5 bg-primary text-surface-0 hover:bg-primary-hover rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Plus size={13} />
              <span>Nuovo Obiettivo</span>
            </button>
          )}
        </div>
      </div>

      {/* Quests List or Empty State */}
      {visibleQuests.length === 0 ? (
        <div className="bg-surface-1 border border-surface-2 rounded-xl p-10 text-center space-y-3">
          <Target size={32} className="mx-auto text-content-3 opacity-50" />
          <h3 className="font-heading text-sm font-semibold text-content-1">
            {isOtherPlayerView
              ? 'Nessun obiettivo condiviso visibile'
              : 'Nessuna quest o obiettivo personale attivo'}
          </h3>
          <p className="text-xs text-content-3 max-w-md mx-auto leading-relaxed">
            {isOtherPlayerView
              ? `${characterName} non ha condiviso missioni o scopi in questo momento.`
              : 'Aggiungi le tue quest personali, i desideri del tuo personaggio e le sue missioni secondarie.'}
          </p>
          {!isOtherPlayerView && (
            <button
              type="button"
              onClick={onOpenCreateQuest}
              className="px-3.5 py-1.5 bg-primary text-surface-0 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 mt-1 cursor-pointer shadow-xs"
            >
              <Plus size={13} /> Crea Obiettivo Personale
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleQuests.map((quest) => (
            <div
              key={quest._id}
              className="bg-surface-1 border border-surface-2 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:border-surface-3 shadow-xs"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading font-semibold text-sm text-content-1">
                    {quest.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                      quest.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : quest.status === 'failed'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    }`}
                  >
                    {quest.status === 'completed'
                      ? 'Completata'
                      : quest.status === 'failed'
                      ? 'Fallita'
                      : 'In Corso'}
                  </span>

                  {quest.questScope === 'personal' ? (
                    quest.questPrivacy === 'private' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Lock size={10} /> Personale (Riservata)
                        {quest.sharedWithDm && <span className="text-amber-300 font-bold ml-0.5">👑 DM</span>}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        <Eye size={10} /> Personale (Condivisa)
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <Shield size={10} /> Quest di Gruppo
                    </span>
                  )}
                </div>
                {quest.progressNote && (
                  <p className="text-xs text-content-3 leading-relaxed">
                    {quest.progressNote}
                  </p>
                )}
              </div>

              {!isOtherPlayerView && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      onToggleQuestStatus(
                        quest,
                        quest.status === 'completed' ? 'open' : 'completed'
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                      quest.status === 'completed'
                        ? 'bg-surface-2 text-content-2 border-surface-3'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    <span>{quest.status === 'completed' ? 'Riapri' : 'Completa'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditQuest(quest)}
                    className="p-1.5 text-content-3 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors cursor-pointer"
                    title="Modifica Obiettivo"
                  >
                    <Edit3 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDeleteQuest(quest._id)}
                    className="p-1.5 text-content-3 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                    title="Elimina Obiettivo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
