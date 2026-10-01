import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Key,
  Sparkles,
  LogIn,
  LogOut,
  User,
  Plus,
  Crown,
  Shield,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
  Edit3,
  Palette,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { useAuth } from './AuthProvider';
import { CampaignMeta, CampaignProfile } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';

const PG_COLOR_PRESETS = [
  { name: 'Indaco Arcano', hex: '#6366f1' },
  { name: 'Blu Cobalto', hex: '#3B82F6' },
  { name: 'Verde Smeraldo', hex: '#10B981' },
  { name: 'Rosso Scarlatto', hex: '#EF4444' },
  { name: 'Viola Ametista', hex: '#8B5CF6' },
  { name: 'Oro Regale', hex: '#f59e0b' },
  { name: 'Ciano Cristallo', hex: '#06B6D4' },
  { name: 'Rosa Mistico', hex: '#EC4899' },
  { name: 'Ambra Fuoco', hex: '#f97316' },
  { name: 'Ardesia Ombra', hex: '#64748b' },
];

interface CampaignGateProps {
  onEnter: (code: string) => void;
}

export function CampaignGate({ onEnter }: CampaignGateProps) {
  const { logout, account, refreshAccount } = useAuth();

  // Campaign State
  const [myCampaigns, setMyCampaigns] = useState<CampaignMeta[]>([]);

  // Join Form State
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCampName, setNewCampName] = useState('');
  const [newCampCode, setNewCampCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Character (PG) Setup / Edit Modal State
  const [isPgModalOpen, setIsPgModalOpen] = useState(false);
  const [targetCampaign, setTargetCampaign] = useState<CampaignMeta | null>(null);
  const [pgCharacterName, setPgCharacterName] = useState('');
  const [pgColor, setPgColor] = useState('#D4AF37');
  const [pgAvatarUrl, setPgAvatarUrl] = useState('');
  const [pgError, setPgError] = useState<string | null>(null);
  const [isEditModeOnly, setIsEditModeOnly] = useState(false);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Delete Campaign State (DM only)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignMeta | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);

  // Leave Campaign State (Player personal removal)
  const [campaignToLeave, setCampaignToLeave] = useState<CampaignMeta | null>(null);
  const [isLeavingCampaign, setIsLeavingCampaign] = useState(false);

  const reloadCampaignList = () => {
    if (!account) return;
    const allCamp = CampaignManager.getCampaigns();
    const expelledCodes = new Set(
      allCamp
        .filter((c) => c.expelledAccountIds?.includes(account.id))
        .map((c) => c.code.toUpperCase())
    );

    const joined = (account.joinedCampaigns || []).filter((c) => !expelledCodes.has(c.toUpperCase()));
    const dmList = (account.dmCampaigns || []).filter((c) => !expelledCodes.has(c.toUpperCase()));

    const campMap = new Map<string, CampaignMeta>();
    allCamp.forEach((c) => {
      if (c && c.code && !expelledCodes.has(c.code.toUpperCase())) {
        if (joined.includes(c.code) || dmList.includes(c.code) || c.dmId === account.id) {
          campMap.set(c.code.toUpperCase(), c);
        }
      }
    });

    // Make sure all joined and dm codes are represented in the list
    [...joined, ...dmList].forEach((code) => {
      const clean = code.toUpperCase();
      if (clean && !expelledCodes.has(clean) && !campMap.has(clean)) {
        campMap.set(clean, {
          code: clean,
          name: `Campagna ${clean}`,
          createdAt: new Date().toISOString(),
        });
      }
    });

    setMyCampaigns(Array.from(campMap.values()));
  };

  useEffect(() => {
    reloadCampaignList();
    const handleUpdate = () => {
      reloadCampaignList();
    };
    window.addEventListener('chronicle_campaigns_updated', handleUpdate);
    window.addEventListener('chronicle_accounts_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_campaigns_updated', handleUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
    };
  }, [account]);

  const isDmOf = (camp: CampaignMeta) => {
    if (!account) return false;
    return Boolean(
      account.dmCampaigns?.includes(camp.code) ||
      camp.dmId === account.id ||
      (camp.dmEmail && camp.dmEmail.toLowerCase() === account.email.toLowerCase())
    );
  };

  const getProfileForCampaign = (code: string): CampaignProfile | null => {
    if (!account?.campaignProfiles) return null;
    return account.campaignProfiles[code.toUpperCase()] || null;
  };

  // Generate a fresh campaign code whenever modal opens or name changes
  const handleOpenCreateModal = () => {
    const freshCode = CampaignManager.generateCampaignCode(newCampName);
    setNewCampCode(freshCode);
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleRegenerateCode = () => {
    const freshCode = CampaignManager.generateCampaignCode(newCampName);
    setNewCampCode(freshCode);
  };

  const handleOpenPgModal = (camp: CampaignMeta, editOnly = false) => {
    setTargetCampaign(camp);
    setIsEditModeOnly(editOnly);
    setPgError(null);

    const existingProfile = getProfileForCampaign(camp.code);
    if (existingProfile) {
      setPgCharacterName(existingProfile.characterName || '');
      setPgColor(existingProfile.color || account?.color || '#D4AF37');
      setPgAvatarUrl(existingProfile.avatarUrl || '');
    } else {
      setPgCharacterName('');
      setPgColor(account?.color || '#D4AF37');
      setPgAvatarUrl('');
    }

    setIsPgModalOpen(true);
  };

  const handleJoinCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode) {
      setJoinError('Inserisci un codice campagna.');
      return;
    }

    setIsSearching(true);
    try {
      const allCamp = CampaignManager.getCampaigns();
      let existing = allCamp.find((c) => c.code === cleanCode);

      // Check remote Cloud if not found locally
      if (!existing && isSupabaseConfigured()) {
        try {
          const supaData = await SupabaseSyncService.fetchCampaignData(cleanCode);
          if (
            supaData &&
            ((supaData.sessions && supaData.sessions.length > 0) ||
              (supaData.notes && supaData.notes.length > 0) ||
              (supaData.entities && supaData.entities.length > 0))
          ) {
            existing = CampaignManager.createCampaign(cleanCode, `Campagna ${cleanCode}`);
          }
        } catch (supaErr) {
          console.warn('Errore verifica supabase campagna:', supaErr);
        }
      }

      if (!existing) {
        setJoinError(
          `Nessuna campagna trovata con il codice "${cleanCode}". Verifica il codice con il tuo Dungeon Master o creane una nuova.`
        );
        setIsSearching(false);
        return;
      }

      if (account && existing.expelledAccountIds?.includes(account.id)) {
        setJoinError(
          `Non hai i permessi per accedere alla campagna "${cleanCode}". Contatta il Dungeon Master.`
        );
        setIsSearching(false);
        return;
      }

      // Check if user is DM of this campaign
      const isDm = isDmOf(existing);
      const existingProfile = getProfileForCampaign(cleanCode);

      if (isDm || (existingProfile && existingProfile.characterName?.trim())) {
        // Already configured or is DM: join & enter directly!
        if (account) {
          CampaignManager.joinCampaign(account.id, cleanCode);
          refreshAccount();
        }
        CampaignManager.setActiveCampaignCode(cleanCode);
        onEnter(cleanCode);
      } else {
        // First time joining this campaign: ask for character name (PG)!
        handleOpenPgModal(existing, false);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handlePgModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPgError(null);

    if (!targetCampaign) return;
    const cleanName = pgCharacterName.trim();

    if (!cleanName) {
      setPgError('Inserisci il nome del tuo personaggio (PG).');
      return;
    }

    if (account) {
      CampaignManager.setCampaignProfile(account.id, targetCampaign.code, {
        characterName: cleanName,
        color: pgColor,
        avatarUrl: pgAvatarUrl.trim(),
      });
      CampaignManager.joinCampaign(account.id, targetCampaign.code);
      refreshAccount();
    }

    setIsPgModalOpen(false);

    if (!isEditModeOnly) {
      CampaignManager.setActiveCampaignCode(targetCampaign.code);
      onEnter(targetCampaign.code);
    } else {
      reloadCampaignList();
    }
  };

  const handleCreateCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const cleanName = newCampName.trim();
    const cleanCode = newCampCode.trim().toUpperCase().replace(/\s/g, '');

    if (!cleanName) {
      setCreateError('Inserisci il nome della campagna.');
      return;
    }
    if (!cleanCode) {
      setCreateError('Inserisci o genera un codice campagna valido.');
      return;
    }

    const allCamp = CampaignManager.getCampaigns();
    if (allCamp.some((c) => c.code === cleanCode)) {
      setCreateError('Questo codice è già in uso. Generane uno diverso.');
      return;
    }

    // Create the campaign with the user as the automatic Dungeon Master
    CampaignManager.createCampaign(cleanCode, cleanName, account);
    if (account) {
      CampaignManager.makeDmOfCampaign(account.id, cleanCode);
      // Initialize DM profile for this campaign
      CampaignManager.setCampaignProfile(account.id, cleanCode, {
        characterName: account.characterName || 'Dungeon Master',
        color: account.color || '#D4AF37',
        avatarUrl: account.avatarUrl || '',
      });
      refreshAccount();
    }

    CampaignManager.setActiveCampaignCode(cleanCode);
    setIsCreateModalOpen(false);
    onEnter(cleanCode);
  };

  const handleSelectCampaign = (camp: CampaignMeta) => {
    const isDm = isDmOf(camp);
    const existingProfile = getProfileForCampaign(camp.code);

    if (isDm || (existingProfile && existingProfile.characterName?.trim())) {
      if (account) {
        CampaignManager.joinCampaign(account.id, camp.code);
        refreshAccount();
      }
      CampaignManager.setActiveCampaignCode(camp.code);
      onEnter(camp.code);
    } else {
      // Prompt user to configure character name for this campaign first
      handleOpenPgModal(camp, false);
    }
  };

  const handleCopyCode = (e: React.MouseEvent, campCode: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(campCode);
    setCopiedCode(campCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteCampaignConfirm = async () => {
    if (!campaignToDelete) return;
    setIsDeletingCampaign(true);
    try {
      await CampaignManager.deleteCampaign(campaignToDelete.code, account?.id);
      if (targetCampaign?.code === campaignToDelete.code) {
        setTargetCampaign(null);
        setIsPgModalOpen(false);
      }
      refreshAccount();
      reloadCampaignList();
      setCampaignToDelete(null);
    } catch (err) {
      console.error('Errore durante l\'eliminazione della campagna:', err);
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleLeaveCampaignConfirm = async () => {
    if (!campaignToLeave || !account) return;
    setIsLeavingCampaign(true);
    try {
      CampaignManager.leaveCampaign(account.id, campaignToLeave.code);
      if (targetCampaign?.code === campaignToLeave.code) {
        setTargetCampaign(null);
        setIsPgModalOpen(false);
      }
      refreshAccount();
      reloadCampaignList();
      setCampaignToLeave(null);
    } catch (err) {
      console.error('Errore durante l\'uscita dalla campagna:', err);
    } finally {
      setIsLeavingCampaign(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-content-1 flex flex-col items-center justify-center p-4 sm:p-6 font-body relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl" />
      </div>

      {/* Top Bar with Account Profile and Logout */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5 bg-surface-2 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-surface-3 shadow-lg">
          <div
            className="w-7 h-7 rounded-full text-surface-0 font-bold text-xs flex items-center justify-center shadow-sm"
            style={{ backgroundColor: account?.color || '#D4AF37' }}
          >
            {account?.characterName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-content-1 leading-tight">
              {account?.characterName}
            </span>
            <span className="text-[10px] text-content-2 font-mono leading-tight">
              {account?.email}
            </span>
          </div>
        </div>

        <button
          id="btn-logout"
          onClick={() => {
            logout();
          }}
          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 px-3.5 py-2 rounded-xl border border-red-800/30 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <LogOut size={14} />
          <span>Disconnetti</span>
        </button>
      </header>

      {/* Main Campaign Hub */}
      <main className="w-full max-w-xl relative z-10 my-16">
        {/* Title Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#27272A] to-[#18181B] border border-surface-3 flex items-center justify-center mb-3 shadow-xl shadow-black/80">
            <BookOpen size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading text-balance font-semibold text-content-1 uppercase tracking-wider">
            Portale delle Campagne
          </h1>
          <p className="text-xs text-content-2 mt-1">
            Seleziona un reame attivo, unisciti con un codice o crea una nuova avventura.
          </p>
        </div>

        <div className="bg-surface-1 backdrop-blur-2xl border border-surface-3 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 border border-white/5 space-y-7">
          {/* ================= SECTION 1: LE TUE CAMPAGNE ================= */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-medium text-primary flex items-center gap-2">
                <BookOpen size={14} />
                Le Tue Campagne ({myCampaigns.length})
              </h2>
              <button
                id="btn-open-create-modal"
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary text-surface-0 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus size={14} />
                <span>Crea Campagna</span>
              </button>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="bg-surface-1/70 border border-dashed border-surface-3 rounded-2xl p-6 text-center">
                <p className="text-xs text-content-2 leading-relaxed">
                  Non partecipi ancora a nessuna campagna. Inserisci il codice fornito dal tuo DM o creane una nuova cliccando su{' '}
                  <strong className="text-primary">Crea Campagna</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {myCampaigns.map((camp) => {
                  const isDm = isDmOf(camp);
                  const profile = getProfileForCampaign(camp.code);
                  const hasProfile = Boolean(profile?.characterName?.trim());

                  return (
                    <div
                      key={camp.code}
                      onClick={() => handleSelectCampaign(camp)}
                      className="bg-surface-1 hover:bg-surface-2 border border-surface-3 hover:border-primary/50 rounded-2xl p-4 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
                    >
                      <div className="space-y-1.5 min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-content-1 truncate group-hover:text-white">
                            {camp.name}
                          </h3>
                          {isDm ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/15 text-primary border border-surface-2 shrink-0">
                              <Crown size={10} /> Dungeon Master
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                              <Shield size={10} /> Giocatore
                            </span>
                          )}
                        </div>

                        {/* Character PG Profile in this campaign */}
                        {!isDm && (
                          <div className="flex items-center gap-2 text-xs">
                            {hasProfile ? (
                              <div className="flex items-center gap-1.5 text-content-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: profile?.color || '#D4AF37' }}
                                />
                                <span className="text-[11px]">
                                  PG: <strong className="text-content-1">{profile?.characterName}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-400/90 flex items-center gap-1 font-medium">
                                <AlertCircle size={11} />
                                PG: Clicca per impostare
                              </span>
                            )}

                            {/* Edit PG Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPgModal(camp, true);
                              }}
                              title="Modifica il tuo PG in questa campagna"
                              className="p-1 text-content-3 hover:text-primary hover:bg-content-1/5 rounded transition-colors"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] font-mono text-content-3 uppercase tracking-wider">
                            Codice: <strong className="text-content-2">{camp.code}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(e, camp.code)}
                            title="Copia codice campagna"
                            className="p-1 rounded text-content-3 hover:text-primary hover:bg-content-1/5 transition-colors"
                          >
                            {copiedCode === camp.code ? (
                              <Check size={11} className="text-green-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDm ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToDelete(camp);
                            }}
                            title="Elimina definitivamente per tutti i giocatori (Solo Master)"
                            className="w-8 h-8 rounded-xl bg-red-950/20 hover:bg-red-900/40 text-content-3 hover:text-red-400 border border-transparent hover:border-red-800/40 flex items-center justify-center transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToLeave(camp);
                            }}
                            title="Abbandona campagna (Elimina per me)"
                            className="w-8 h-8 rounded-xl bg-surface-2 hover:bg-red-950/30 text-content-3 hover:text-red-400 border border-surface-3 hover:border-red-800/30 flex items-center justify-center transition-all cursor-pointer"
                          >
                            <LogOut size={13} />
                          </button>
                        )}
                        <span className="text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                          Entra
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-content-1/5 group-hover:bg-primary group-hover:text-surface-0 text-content-1/40 flex items-center justify-center transition-all">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= SECTION 2: UNISCITI CON CODICE ================= */}
          <div className="pt-6 border-t border-surface-3">
            <h2 className="text-sm font-medium text-content-2 mb-2 flex items-center gap-2">
              <Key size={14} className="text-primary" />
              Unisciti a una Campagna Esistente
            </h2>
            <p className="text-xs text-content-3 mb-3">
              Hai ricevuto un codice dal tuo Dungeon Master? Inseriscilo qui per accedere al tavolo e creare il tuo personaggio.
            </p>

            {joinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2 mb-3">
                <AlertCircle size={15} className="shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinCampaign} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  id="input-join-code"
                  type="text"
                  placeholder="Es. WATERDEEP-2026"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none font-mono uppercase tracking-wider text-center sm:text-left transition-colors"
                />
              </div>
              <button
                id="btn-submit-join"
                type="submit"
                disabled={!joinCode.trim() || isSearching}
                className="px-5 py-3 bg-surface-2 hover:bg-primary hover:text-surface-0 border border-surface-3 hover:border-transparent text-content-1 font-bold text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-95"
              >
                {isSearching ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifica...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={14} />
                    <span>Unisciti ed Entra</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ================= MODAL: CONFIGURA PERSONAGGIO (PG) ================= */}
      {isPgModalOpen && targetCampaign && (
        <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsPgModalOpen(false)}
              className="absolute top-5 right-5 text-content-2 hover:text-content-1 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-surface-0 font-bold text-base shadow-md"
                style={{ backgroundColor: pgColor }}
              >
                {pgCharacterName?.trim() ? pgCharacterName.trim().charAt(0).toUpperCase() : <Shield size={20} />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-content-1">
                  {isEditModeOnly ? 'Modifica Personaggio (PG)' : 'Crea il tuo Personaggio'}
                </h3>
                <span className="text-[11px] text-primary font-medium">
                  Campagna: {targetCampaign.name} ({targetCampaign.code})
                </span>
              </div>
            </div>

            <p className="text-xs text-content-2 mb-5 leading-relaxed">
              Come si chiama il tuo personaggio in questa campagna? Ogni campagna in cui giochi può avere un personaggio diverso.
            </p>

            {pgError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2 mb-4">
                <AlertCircle size={15} className="shrink-0" />
                <span>{pgError}</span>
              </div>
            )}

            <form onSubmit={handlePgModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Nome del Personaggio (PG) <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="input-pg-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Es. Varis Shadowalker, Thorin, Lyra..."
                    value={pgCharacterName}
                    onChange={(e) => setPgCharacterName(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-content-2 mb-2 flex items-center gap-1.5">
                  <Palette size={13} className="text-content-3" />
                  Colore / Emblema Personaggio
                </label>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {PG_COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setPgColor(col.hex)}
                      title={col.name}
                      style={{ backgroundColor: col.hex }}
                      className={`w-7 h-7 rounded-xl transition-transform cursor-pointer flex items-center justify-center text-white ${
                        pgColor.toLowerCase() === col.hex.toLowerCase()
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-surface-1'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {pgColor.toLowerCase() === col.hex.toLowerCase() && <Check size={12} />}
                    </button>
                  ))}
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={pgColor}
                      onChange={(e) => setPgColor(e.target.value)}
                      className="w-7 h-7 rounded-xl cursor-pointer border border-surface-3 bg-transparent p-0 overflow-hidden"
                      title="Scegli colore personalizzato"
                    />
                  </div>
                </div>
              </div>

              {/* Avatar URL (Optional) */}
              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-content-3" />
                  URL Avatar (Opzionale)
                </label>
                <input
                  id="input-pg-avatar"
                  type="url"
                  placeholder="https://esempio.com/avatar.jpg"
                  value={pgAvatarUrl}
                  onChange={(e) => setPgAvatarUrl(e.target.value)}
                  className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPgModalOpen(false)}
                  className="flex-1 py-3 bg-surface-1 hover:bg-surface-2 text-content-1 font-bold text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  id="btn-submit-pg-profile"
                  type="submit"
                  disabled={!pgCharacterName.trim()}
                  className="flex-2 py-3 bg-primary hover:bg-primary text-surface-0 font-bold text-sm font-medium rounded-xl shadow-lg shadow-[#3B82F6]/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={15} />
                  <span>{isEditModeOnly ? 'Salva Modifiche' : 'Entra nella Campagna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREA NUOVA CAMPAGNA ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-content-2 hover:text-content-1 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-surface-2 flex items-center justify-center text-primary">
                <Crown size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-content-1">
                  Crea Nuova Campagna
                </h3>
                <span className="text-[11px] text-primary font-medium">
                  Sarai automaticamente il Dungeon Master (DM)
                </span>
              </div>
            </div>

            <p className="text-xs text-content-2 mb-5 leading-relaxed">
              Verrà generato un codice esclusivo da condividere con i tuoi giocatori per farli accedere al tuo tavolo.
            </p>

            {createError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2 mb-4">
                <AlertCircle size={15} className="shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Nome della Campagna <span className="text-primary">*</span>
                </label>
                <input
                  id="create-camp-name-input"
                  type="text"
                  required
                  placeholder="Es. La Maledizione di Strahd"
                  value={newCampName}
                  onChange={(e) => {
                    setNewCampName(e.target.value);
                    if (!newCampCode || newCampCode.startsWith('REALM-') || newCampCode.startsWith('CHRONICLE-')) {
                      setNewCampCode(CampaignManager.generateCampaignCode(e.target.value));
                    }
                  }}
                  className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-4 py-2.5 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-content-2">
                    Codice Campagna Generato
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={10} /> Genera altro
                  </button>
                </div>
                <input
                  id="create-camp-code-input"
                  type="text"
                  required
                  placeholder="Es. STRAHD-4821"
                  value={newCampCode}
                  onChange={(e) => setNewCampCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-4 py-2.5 text-xs text-content-1 font-mono uppercase tracking-wider outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 bg-surface-1 hover:bg-surface-2 text-content-1 font-bold text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  id="btn-submit-create-campaign"
                  type="submit"
                  disabled={!newCampName.trim() || !newCampCode.trim()}
                  className="flex-2 py-3 bg-primary hover:bg-primary text-surface-0 font-bold text-sm font-medium rounded-xl shadow-lg shadow-[#3B82F6]/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={15} />
                  <span>Crea & Entra come Master</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal (DM Only) */}
      <ConfirmModal
        isOpen={Boolean(campaignToDelete)}
        title="Elimina Campagna Definitivamente"
        message={`Sei sicuro di voler eliminare la campagna "${campaignToDelete?.name}" (${campaignToDelete?.code})? Questa operazione è irreversibile e cancellerà sessioni, PNG, luoghi, note e dati associati sia in locale che sul Cloud Firestore per tutti i giocatori.`}
        confirmLabel={isDeletingCampaign ? 'Eliminazione in corso...' : 'Elimina Campagna'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleDeleteCampaignConfirm}
        onCancel={() => {
          if (!isDeletingCampaign) setCampaignToDelete(null);
        }}
      />

      {/* Leave Campaign Confirmation Modal (Player) */}
      <ConfirmModal
        isOpen={Boolean(campaignToLeave)}
        title="Abbandona Campagna"
        message={`Vuoi davvero rimuovere la campagna "${campaignToLeave?.name}" (${campaignToLeave?.code}) dal tuo account? Il tuo personaggio non sarà più collegato ad essa e non la vedrai più nell'elenco. La campagna e tutti i suoi dati rimarranno intatti per il Dungeon Master e gli altri giocatori.`}
        confirmLabel={isLeavingCampaign ? 'Uscita in corso...' : 'Abbandona Campagna'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleLeaveCampaignConfirm}
        onCancel={() => {
          if (!isLeavingCampaign) setCampaignToLeave(null);
        }}
      />
    </div>
  );
}
