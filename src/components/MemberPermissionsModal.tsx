import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  X,
  Check,
  Crown,
  BookOpen,
  Scroll,
  Users,
  MapPin,
  Trash2,
  Edit3,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { CampaignMemberPermissions, CampaignMemberRecord, Player } from '../types';
import { CampaignManager } from '../store/campaignStore';

interface MemberPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  campaignCode: string;
}

const PRESET_PLAYER: CampaignMemberPermissions = {
  canCreateSessions: false,
  canEditSessions: false,
  canDeleteSessions: false,
  canCreateEntities: false,
  canEditEntities: false,
  canDeleteEntities: false,
  canCreateLore: false,
  canEditLore: false,
  canDeleteLore: false,
  canManageMaps: false,
};

const PRESET_SCRIBE: CampaignMemberPermissions = {
  canCreateSessions: true,
  canEditSessions: true,
  canDeleteSessions: false,
  canCreateEntities: false,
  canEditEntities: false,
  canDeleteEntities: false,
  canCreateLore: true,
  canEditLore: true,
  canDeleteLore: false,
  canManageMaps: false,
};

const PRESET_SAGE: CampaignMemberPermissions = {
  canCreateSessions: false,
  canEditSessions: false,
  canDeleteSessions: false,
  canCreateEntities: true,
  canEditEntities: true,
  canDeleteEntities: false,
  canCreateLore: true,
  canEditLore: true,
  canDeleteLore: false,
  canManageMaps: true,
};

const PRESET_CO_DM: CampaignMemberPermissions = {
  canCreateSessions: true,
  canEditSessions: true,
  canDeleteSessions: false,
  canCreateEntities: true,
  canEditEntities: true,
  canDeleteEntities: false,
  canCreateLore: true,
  canEditLore: true,
  canDeleteLore: false,
  canManageMaps: true,
};

export const MemberPermissionsModal: React.FC<MemberPermissionsModalProps> = ({
  isOpen,
  onClose,
  player,
  campaignCode,
}) => {
  const [permissions, setPermissions] = useState<CampaignMemberPermissions>(PRESET_PLAYER);
  const [isSaving, setIsSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<'player' | 'scribe' | 'sage' | 'codm' | 'custom'>('custom');

  useEffect(() => {
    if (!isOpen || !player || !campaignCode) return;
    const member = CampaignManager.getCampaignMember(campaignCode, player._id, player.email);
    const existing = member?.permissions || {};
    setPermissions({
      canCreateSessions: Boolean(existing.canCreateSessions),
      canEditSessions: Boolean(existing.canEditSessions),
      canDeleteSessions: Boolean(existing.canDeleteSessions),
      canCreateEntities: Boolean(existing.canCreateEntities),
      canEditEntities: Boolean(existing.canEditEntities),
      canDeleteEntities: Boolean(existing.canDeleteEntities),
      canCreateLore: Boolean(existing.canCreateLore),
      canEditLore: Boolean(existing.canEditLore),
      canDeleteLore: Boolean(existing.canDeleteLore),
      canManageMaps: Boolean(existing.canManageMaps),
    });
    detectPreset(existing);
  }, [isOpen, player, campaignCode]);

  const detectPreset = (perms: CampaignMemberPermissions) => {
    if (
      perms.canCreateSessions &&
      perms.canEditSessions &&
      perms.canCreateLore &&
      perms.canEditLore &&
      perms.canCreateEntities &&
      perms.canEditEntities &&
      perms.canManageMaps &&
      !perms.canDeleteSessions
    ) {
      setActivePreset('codm');
    } else if (
      perms.canCreateSessions &&
      perms.canEditSessions &&
      perms.canCreateLore &&
      perms.canEditLore &&
      !perms.canCreateEntities
    ) {
      setActivePreset('scribe');
    } else if (
      !perms.canCreateSessions &&
      perms.canCreateEntities &&
      perms.canCreateLore &&
      perms.canManageMaps
    ) {
      setActivePreset('sage');
    } else if (
      !perms.canCreateSessions &&
      !perms.canEditSessions &&
      !perms.canCreateEntities &&
      !perms.canCreateLore
    ) {
      setActivePreset('player');
    } else {
      setActivePreset('custom');
    }
  };

  const applyPreset = (preset: 'player' | 'scribe' | 'sage' | 'codm') => {
    setActivePreset(preset);
    if (preset === 'player') setPermissions({ ...PRESET_PLAYER });
    if (preset === 'scribe') setPermissions({ ...PRESET_SCRIBE });
    if (preset === 'sage') setPermissions({ ...PRESET_SAGE });
    if (preset === 'codm') setPermissions({ ...PRESET_CO_DM });
  };

  const togglePermission = (key: keyof CampaignMemberPermissions) => {
    setActivePreset('custom');
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!player || !campaignCode) return;
    setIsSaving(true);
    try {
      CampaignManager.updateMemberPermissions(campaignCode, player._id, permissions);
      onClose();
    } catch (err) {
      console.error('Error saving member permissions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !player) return null;

  const campaign = CampaignManager.getCampaigns().find(
    (c) => c.code.toUpperCase() === campaignCode.toUpperCase()
  );
  const isMaster = Boolean(
    (campaign?.dmId && (campaign.dmId === player._id || campaign.dmId === (player as any).id)) ||
    (campaign?.dmEmail && player.email && campaign.dmEmail.toLowerCase() === player.email.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-surface-1 border border-surface-2 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-2 flex items-center justify-between bg-surface-1/90 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-surface-0 shrink-0 shadow-md"
              style={{ backgroundColor: player.color || '#6366f1' }}
            >
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                player.characterName?.charAt(0).toUpperCase() || 'P'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-content-1 truncate flex items-center gap-2">
                <span>Permessi: {player.characterName}</span>
                {isMaster && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                    <Crown size={10} /> Master
                  </span>
                )}
              </h3>
              <p className="text-xs text-content-3 truncate">
                Definisci cosa può creare, modificare o eliminare in questa campagna.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-xs">
          {isMaster ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
              <Crown size={18} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-sm">Dungeon Master della Campagna</p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Questo utente è il creatore/Master della campagna e possiede automaticamente il controllo assoluto su tutte le sessioni, le entità, il lore e le mappe. I suoi permessi non possono essere limitati.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Preset Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-content-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" />
                  <span>Preset Rapidi di Ruolo</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('player')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'player'
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs'
                        : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2 text-content-2'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1">
                      <Users size={12} /> Base
                    </p>
                    <p className="text-[10px] text-content-3 mt-0.5">Solo lettura &amp; note sue</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('scribe')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'scribe'
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs'
                        : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2 text-content-2'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1">
                      <Scroll size={12} /> Scriba
                    </p>
                    <p className="text-[10px] text-content-3 mt-0.5">Scrive sessioni &amp; lore</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('sage')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'sage'
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs'
                        : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2 text-content-2'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1">
                      <BookOpen size={12} /> Saggio
                    </p>
                    <p className="text-[10px] text-content-3 mt-0.5">Gestisce codex &amp; mappe</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('codm')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'codm'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold shadow-xs'
                        : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2 text-content-2'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1">
                      <Shield size={12} /> Co-Master
                    </p>
                    <p className="text-[10px] text-content-3 mt-0.5">Quasi tutti i poteri</p>
                  </button>
                </div>
              </div>

              {/* Granular Permission Toggles */}
              <div className="space-y-4 pt-1">
                {/* 1. SESSIONS */}
                <div className="bg-surface-2/40 border border-surface-3/70 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-content-1">
                    <BookOpen size={15} className="text-primary" />
                    <span>Sessioni di Gioco</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <PlusCircle size={13} className="text-emerald-400" />
                        <span>Crea</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canCreateSessions)}
                        onChange={() => togglePermission('canCreateSessions')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Edit3 size={13} className="text-amber-400" />
                        <span>Modifica</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canEditSessions)}
                        onChange={() => togglePermission('canEditSessions')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Trash2 size={13} className="text-rose-400" />
                        <span>Elimina</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canDeleteSessions)}
                        onChange={() => togglePermission('canDeleteSessions')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* 2. WORLD LORE */}
                <div className="bg-surface-2/40 border border-surface-3/70 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-content-1">
                    <Scroll size={15} className="text-indigo-400" />
                    <span>World Lore &amp; Articoli</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <PlusCircle size={13} className="text-emerald-400" />
                        <span>Crea</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canCreateLore)}
                        onChange={() => togglePermission('canCreateLore')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Edit3 size={13} className="text-amber-400" />
                        <span>Modifica</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canEditLore)}
                        onChange={() => togglePermission('canEditLore')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Trash2 size={13} className="text-rose-400" />
                        <span>Elimina</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canDeleteLore)}
                        onChange={() => togglePermission('canDeleteLore')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* 3. CODEX / ENTITIES */}
                <div className="bg-surface-2/40 border border-surface-3/70 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-content-1">
                    <Users size={15} className="text-emerald-400" />
                    <span>Codex &amp; Entità (PNG, Mostri, Luoghi)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <PlusCircle size={13} className="text-emerald-400" />
                        <span>Crea</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canCreateEntities)}
                        onChange={() => togglePermission('canCreateEntities')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Edit3 size={13} className="text-amber-400" />
                        <span>Modifica</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canEditEntities)}
                        onChange={() => togglePermission('canEditEntities')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-content-2">
                        <Trash2 size={13} className="text-rose-400" />
                        <span>Elimina</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canDeleteEntities)}
                        onChange={() => togglePermission('canDeleteEntities')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* 4. MAPS */}
                <div className="bg-surface-2/40 border border-surface-3/70 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-content-1">
                    <MapPin size={15} className="text-rose-400" />
                    <span>Mappe &amp; Cartografia</span>
                  </div>
                  <div>
                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-surface-1/60 border border-surface-3/50 hover:bg-surface-1 cursor-pointer">
                      <div>
                        <p className="font-semibold text-content-1">Gestione Pin e Mappe</p>
                        <p className="text-[10px] text-content-3">Può piazzare segnalini, modificare scale e organizzare cartelle.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.canManageMaps)}
                        onChange={() => togglePermission('canManageMaps')}
                        className="rounded border-surface-3 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-2 bg-surface-1/90 backdrop-blur-md flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-content-2 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Annulla
          </button>
          {!isMaster && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="bg-primary hover:bg-primary-hover text-surface-0 font-semibold px-5 py-2 rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Salvataggio...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Salva Permessi</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
