import { ConfirmModal } from '../components/ConfirmModal';
import { PlayerTagsModal } from '../components/PlayerTagsModal';
import { LlmCatalogModal } from '../components/OpenRouterCatalogModal';
import { MemberPermissionsModal } from '../components/MemberPermissionsModal';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { Player, PlayerPartyStatus, CampaignMeta } from '../types';
import {
  Database,
  User,
  Users,
  Check,
  LogOut,
  Crown,
  DoorOpen,
  Copy,
  Sparkles,
  Shield,
  Key,
  Download,
  UploadCloud,
  RefreshCw,
  Eye,
  EyeOff,
  Cpu,
  Lock,
  X,
  UserX,
  CheckCircle2,
  AlertCircle,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAiKeys } from '../hooks/useAiKeys';
import { KeyModeSelector } from '../components/KeyModeSelector';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { SingleImageUploader } from '../components/SingleImageUploader';
import { LegalModal, LegalTab } from '../components/legal/LegalModal';
import { Cookie, FileText, CheckCircle } from 'lucide-react';

export function Settings() {
  const navigate = useNavigate();
  const activeCampaignCode = CampaignManager.getActiveCampaignCode();
  const [allCampaigns, setAllCampaigns] = useState<CampaignMeta[]>(() => CampaignManager.getCampaigns());
  const activeCampaign = allCampaigns.find((c) => c.code === activeCampaignCode);

  const {
    account,
    player,
    allPlayers,
    logout,
    refreshAccount,
    updateAccountProfile,
  } = useAuth();

  const isDm = Boolean(
    player?.isDm ||
    (activeCampaign?.dmId && activeCampaign.dmId === account?.id) ||
    CampaignManager.isCurrentUserDm()
  );

  // Tab State: 'personale' | 'dm' | 'dati' | 'provider' | 'legale'
  const [activeTab, setActiveTab] = useState<'personale' | 'dm' | 'dati' | 'provider' | 'legale'>('personale');

  // Legal / Privacy / Cookie Modal State
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');

  const handleOpenLegal = (tab: LegalTab = 'privacy') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  // Personal Character Profile Edit State
  const [charNameInput, setCharNameInput] = useState(() => player?.characterName || account?.characterName || '');
  const [charAvatarInput, setCharAvatarInput] = useState(() => player?.avatarUrl || account?.avatarUrl || '');
  const [charColorInput, setCharColorInput] = useState(() => player?.color || account?.color || '#6366f1');
  const [charSavedMsg, setCharSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (player || account) {
      setCharNameInput(player?.characterName || account?.characterName || '');
      setCharAvatarInput(player?.avatarUrl || account?.avatarUrl || '');
      setCharColorInput(player?.color || account?.color || '#6366f1');
    }
  }, [player?.characterName, player?.avatarUrl, player?.color, account?.characterName, account?.avatarUrl, account?.color]);

  const handleSaveCharacterProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!account) return;
    const ok = updateAccountProfile({
      characterName: charNameInput.trim(),
      avatarUrl: charAvatarInput.trim(),
      color: charColorInput,
    });
    if (ok) {
      setCharSavedMsg('Profilo del personaggio aggiornato e sincronizzato sul Database Cloud!');
      setTimeout(() => setCharSavedMsg(null), 3500);
    }
  };

  // Supabase Data Sync Stats State
  const [supabaseStats, setSupabaseStats] = useState<{
    local: Record<string, number>;
    remote: Record<string, number>;
    loading: boolean;
    syncing: boolean;
    error: string | null;
    successMsg: string | null;
  }>({
    local: {},
    remote: {},
    loading: false,
    syncing: false,
    error: null,
    successMsg: null,
  });

  const loadSupabaseStats = async () => {
    if (!isSupabaseConfigured() || !activeCampaignCode) return;
    setSupabaseStats((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [supaData, remoteAccounts] = await Promise.all([
        SupabaseSyncService.fetchCampaignData(activeCampaignCode),
        SupabaseSyncService.fetchAllUserAccounts().catch(() => []),
      ]);

      const local = {
        accounts: CampaignManager.getAccounts().length,
        sessions: CampaignManager.getSessions().length,
        chapters: CampaignManager.getChapters().length,
        notes: CampaignManager.getNotes().length,
        entities: CampaignManager.getEntities().length,
        maps: CampaignManager.getMaps().length,
        scrapbookItems: CampaignManager.getScrapbookItems().length,
        audioLogs: CampaignManager.getAudioLogs().length,
        characterBios: CampaignManager.getAllCharacterBios().length,
        familyRelations: CampaignManager.getAllFamilyRelations().length,
        worldLoreArticles: CampaignManager.getWorldLoreArticles().length,
      };

      if (supaData) {
        if (supaData.aiConfig && typeof supaData.aiConfig === 'object') {
          CampaignManager.updateCampaignAiConfigFromRemote(activeCampaignCode, supaData.aiConfig);
          setCampaignAiConfig(CampaignManager.getCampaignAiConfig(activeCampaignCode));
        }
        setSupabaseStats({
          local,
          remote: {
            accounts: Array.isArray(remoteAccounts) ? remoteAccounts.length : 0,
            sessions: Array.isArray(supaData.sessions) ? supaData.sessions.length : 0,
            chapters: Array.isArray(supaData.chapters) ? supaData.chapters.length : 0,
            notes: Array.isArray(supaData.notes) ? supaData.notes.length : 0,
            entities: Array.isArray(supaData.entities) ? supaData.entities.length : 0,
            maps: Array.isArray(supaData.maps) ? supaData.maps.length : 0,
            scrapbookItems: Array.isArray(supaData.scrapbookItems) ? supaData.scrapbookItems.length : 0,
            audioLogs: Array.isArray(supaData.audioLogs) ? supaData.audioLogs.length : 0,
            characterBios: Array.isArray(supaData.characterBios) ? supaData.characterBios.length : 0,
            familyRelations: Array.isArray(supaData.familyRelations) ? supaData.familyRelations.length : 0,
            worldLoreArticles: Array.isArray(supaData.worldLoreArticles) ? supaData.worldLoreArticles.length : 0,
          },
          loading: false,
          syncing: false,
          error: null,
          successMsg: null,
        });
      } else {
        setSupabaseStats((prev) => ({ ...prev, loading: false, error: 'Nessun dato trovato per questa campagna sul Database Cloud.' }));
      }
    } catch (err: any) {
      setSupabaseStats((prev) => ({ ...prev, loading: false, error: err?.message || 'Impossibile connettersi al Database Cloud.' }));
    }
  };

  const handleSupabaseBulkSync = async () => {
    if (!isSupabaseConfigured() || !activeCampaignCode) return;
    setSupabaseStats((prev) => ({ ...prev, syncing: true, error: null, successMsg: null }));
    try {
      const allAccounts = CampaignManager.getAccounts();
      if (allAccounts && allAccounts.length > 0) {
        await SupabaseSyncService.saveAllUserAccounts(allAccounts);
      }

      // Strictly only sync players belonging to THIS campaign
      const campaignPlayers = CampaignManager.getPlayers();
      if (campaignPlayers && campaignPlayers.length > 0) {
        await SupabaseSyncService.saveActivePlayers(activeCampaignCode, campaignPlayers);
      }

      const payload = {
        sessions: CampaignManager.getSessions(),
        chapters: CampaignManager.getChapters(),
        notes: CampaignManager.getNotes(),
        entities: CampaignManager.getEntities(),
        maps: CampaignManager.getMaps(),
        scrapbookItems: CampaignManager.getScrapbookItems(),
        audioLogs: CampaignManager.getAudioLogs(),
        characterBios: CampaignManager.getAllCharacterBios(),
        familyRelations: CampaignManager.getAllFamilyRelations(),
        worldLoreArticles: CampaignManager.getWorldLoreArticles(),
      };

      const res = await SupabaseSyncService.bulkUpsertCampaignData(activeCampaignCode, payload);
      if (res.success) {
        setSupabaseStats((prev) => ({
          ...prev,
          syncing: false,
          successMsg: `Allineamento completato! Sincronizzati sul Database Cloud: ${allAccounts.length} account giocatori, ${res.stats.entities || 0} entità codex, ${res.stats.sessions || 0} sessioni, ${res.stats.notes || 0} note e ${res.stats.characterBios || 0} biografie.`,
        }));
        await loadSupabaseStats();
      } else {
        setSupabaseStats((prev) => ({
          ...prev,
          syncing: false,
          error: `Errore durante la sincronizzazione: ${res.errors.join(', ')}`,
        }));
      }
    } catch (err: any) {
      setSupabaseStats((prev) => ({
        ...prev,
        syncing: false,
        error: err?.message || 'Impossibile completare l\'allineamento.',
      }));
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured() && activeCampaignCode) {
      loadSupabaseStats();
    }
  }, [activeCampaignCode]);

  // AI Keys & Config
  const {
    keyMode,
    setKeyMode,
    campaignKeys,
    personalKeys,
    savePersonalKeys,
    saveCampaignKeys,
  } = useAiKeys();

  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [cfAccountIdInput, setCfAccountIdInput] = useState('');
  const [cfApiTokenInput, setCfApiTokenInput] = useState('');
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);

  const [isAiCatalogOpen, setIsAiCatalogOpen] = useState(false);
  const [catalogTarget, setCatalogTarget] = useState<'oracle' | 'party'>('oracle');
  const [campaignAiConfig, setCampaignAiConfig] = useState(() => CampaignManager.getCampaignAiConfig());
  const allowedPartyModels = campaignAiConfig.allowedPartyModels || [];

  const [dmIsPlayer, setDmIsPlayer] = useState(() => CampaignManager.isDmPlayerCampaign());

  useEffect(() => {
    const handleCampaignUpdate = () => {
      setDmIsPlayer(CampaignManager.isDmPlayerCampaign());
    };
    window.addEventListener('chronicle_campaign_updated', handleCampaignUpdate);
    window.addEventListener('chronicle_campaigns_updated', handleCampaignUpdate);
    window.addEventListener('chronicle_data_updated', handleCampaignUpdate);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleCampaignUpdate);
      window.removeEventListener('chronicle_campaigns_updated', handleCampaignUpdate);
      window.removeEventListener('chronicle_data_updated', handleCampaignUpdate);
    };
  }, []);

  const handleToggleDmIsPlayer = (nextValue: boolean) => {
    setDmIsPlayer(nextValue);
    CampaignManager.setDmPlayerCampaign(nextValue);
    refreshAccount();
  };

  useEffect(() => {
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig(activeCampaignCode));
  }, [activeCampaignCode]);

  useEffect(() => {
    const handleAiConfigUpdated = () => {
      setCampaignAiConfig(CampaignManager.getCampaignAiConfig(activeCampaignCode));
    };
    window.addEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_campaign_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_data_updated', handleAiConfigUpdated);
    return () => {
      window.removeEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_campaign_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_data_updated', handleAiConfigUpdated);
    };
  }, [activeCampaignCode]);

  const prevKeyModeRef = React.useRef(keyMode);
  const isUserTypingRef = React.useRef(false);

  useEffect(() => {
    const target = keyMode === 'campaign' ? campaignKeys : personalKeys;
    if (prevKeyModeRef.current !== keyMode) {
      prevKeyModeRef.current = keyMode;
      isUserTypingRef.current = false;
      setGeminiKeyInput(target.geminiKey || '');
      setCfAccountIdInput(target.cloudflareAccountId || '');
      setCfApiTokenInput(target.cloudflareApiToken || '');
      setOpenrouterKeyInput(target.openrouterKey || '');
      return;
    }

    if (!isUserTypingRef.current) {
      setGeminiKeyInput(target.geminiKey || '');
      setCfAccountIdInput(target.cloudflareAccountId || '');
      setCfApiTokenInput(target.cloudflareApiToken || '');
      setOpenrouterKeyInput(target.openrouterKey || '');
    }
  }, [keyMode, campaignKeys, personalKeys]);

  const handleSetAiProvider = (prov: 'gemini' | 'openrouter') => {
    CampaignManager.setCampaignAiConfig({ provider: prov });
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
  };

  const [quickModelInput, setQuickModelInput] = useState('');
  const handleAddQuickModel = () => {
    const clean = quickModelInput.trim();
    if (!clean) return;
    const current = campaignAiConfig.allowedPartyModels || [];
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      CampaignManager.setCampaignAiConfig({ allowedPartyModels: updated });
      setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
    }
    setQuickModelInput('');
  };

  const handleRemovePartyModel = (modelId: string) => {
    const updated = (campaignAiConfig.allowedPartyModels || []).filter((id) => id !== modelId);
    CampaignManager.setCampaignAiConfig({ allowedPartyModels: updated });
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
  };

  const handleSaveAiKeys = async () => {
    isUserTypingRef.current = false;
    const payload = {
      geminiKey: geminiKeyInput.trim(),
      cloudflareAccountId: cfAccountIdInput.trim(),
      cloudflareApiToken: cfApiTokenInput.trim(),
      openrouterKey: openrouterKeyInput.trim(),
    };

    if (keyMode === 'campaign') {
      if (!isDm) {
        setKeySavedMessage('Solo il Dungeon Master può modificare e salvare le chiavi di campagna. Passa a "Chiave Personale" per usare le tue.');
        setTimeout(() => setKeySavedMessage(null), 4000);
        return;
      }
      await saveCampaignKeys(payload);
      setKeySavedMessage('Chiave verificata e salvata');
    } else {
      await savePersonalKeys(payload);
      setKeySavedMessage('Chiave verificata e salvata');
    }

    setTimeout(() => setKeySavedMessage(null), 4000);
  };

  // Campaign Name & Access Code Regeneration (DM Tab)
  const [campaignNameInput, setCampaignNameInput] = useState(() => activeCampaign?.name || '');
  const [campaignNameSavedMsg, setCampaignNameSavedMsg] = useState<string | null>(null);
  const [codeRegeneratedMsg, setCodeRegeneratedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeCampaign?.name) {
      setCampaignNameInput(activeCampaign.name);
    }
  }, [activeCampaign?.name]);

  const handleSaveCampaignName = () => {
    if (!activeCampaign || !campaignNameInput.trim()) return;
    const updated = CampaignManager.updateCampaignMeta(activeCampaign.code, {
      name: campaignNameInput.trim(),
    });
    if (updated) {
      setCampaignNameSavedMsg('Nome della campagna aggiornato con successo!');
      setTimeout(() => setCampaignNameSavedMsg(null), 3000);
      setAllCampaigns(CampaignManager.getCampaigns());
    }
  };

  const handleRegenerateAccessCode = () => {
    if (!activeCampaignCode) return;
    const newCode = CampaignManager.regenerateCampaignCode(activeCampaignCode);
    if (newCode) {
      setCodeRegeneratedMsg(`Nuovo codice generato: ${newCode}`);
      setTimeout(() => setCodeRegeneratedMsg(null), 4000);
      setAllCampaigns(CampaignManager.getCampaigns());
    }
  };

  // Switch Campaign Handler
  const handleSwitchCampaign = () => {
    CampaignManager.setActiveCampaignCode(null);
    try {
      navigate('/campaigns', { replace: true });
    } catch {
      window.location.href = '/';
    }
  };

  // Modals state
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isDeleteCampModalOpen, setIsDeleteCampModalOpen] = useState(false);
  const [isDeletingCamp, setIsDeletingCamp] = useState(false);
  const [isLeaveCampModalOpen, setIsLeaveCampModalOpen] = useState(false);
  const [isLeavingCamp, setIsLeavingCamp] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Player Tags Modal
  const [tagsModalTargetPlayer, setTagsModalTargetPlayer] = useState<Player | null>(null);

  // Member Permissions Modal
  const [permissionsTargetPlayer, setPermissionsTargetPlayer] = useState<Player | null>(null);

  // Backup & Restore
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    try {
      CampaignManager.downloadBackupFile();
    } catch (err) {
      console.error('Backup download error:', err);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBackup(true);
    setSyncStatusMsg(null);
    try {
      const text = await file.text();
      const res = await CampaignManager.importFullBackup(text);
      if (res.success) {
        const stats = res.stats;
        const statsStr = stats
          ? ` (${stats.entities || 0} entità codex, ${stats.sessions || 0} sessioni, ${stats.notes || 0} note, ${stats.maps || 0} mappe)`
          : '';
        setSyncStatusMsg({
          type: 'success',
          text: `Backup ripristinato con successo${statsStr} e allineato sul Database Cloud!`,
        });
        setAllCampaigns(CampaignManager.getCampaigns());
        if (isSupabaseConfigured()) {
          setTimeout(() => loadSupabaseStats(), 800);
        }
      } else {
        setSyncStatusMsg({ type: 'error', text: res.error || 'File di backup non valido.' });
      }
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: err?.message || 'Impossibile leggere il file.' });
    } finally {
      setIsImportingBackup(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Party Management
  const [removeTargetPlayer, setRemoveTargetPlayer] = useState<Player | null>(null);

  const handleToggleCoMaster = (targetPlayerId: string) => {
    if (!activeCampaignCode) return;
    CampaignManager.toggleCoMaster(targetPlayerId, activeCampaignCode);
  };

  const handleRemovePlayerConfirm = () => {
    if (!activeCampaignCode || !removeTargetPlayer) return;
    CampaignManager.removePlayerFromCampaign(removeTargetPlayer._id, activeCampaignCode);
    setRemoveTargetPlayer(null);
    refreshAccount();
  };

  const handleDeleteActiveCampaign = async () => {
    if (!activeCampaignCode) return;
    setIsDeletingCamp(true);
    try {
      await CampaignManager.deleteCampaign(activeCampaignCode, account.id);
    } catch (e) {
      console.error('Errore cancellazione campagna attiva:', e);
    } finally {
      setIsDeletingCamp(false);
      setIsDeleteCampModalOpen(false);
    }
  };

  const handleLeaveActiveCampaign = async () => {
    if (!activeCampaignCode || !account) return;
    setIsLeavingCamp(true);
    try {
      CampaignManager.leaveCampaign(account.id, activeCampaignCode);
    } catch (e) {
      console.error('Errore abbandono campagna:', e);
    } finally {
      setIsLeavingCamp(false);
      setIsLeaveCampModalOpen(false);
    }
  };

  const copyCampaignCode = () => {
    if (activeCampaignCode) {
      navigator.clipboard.writeText(activeCampaignCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!account || !player) return null;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 w-full">
      {/* Top Banner Header with Prominent "Cambia Campagna" Button */}
      <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-heading font-semibold text-content-1 truncate">
              {activeCampaign?.name || 'Impostazioni & Campagna'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider shrink-0">
              Codice: {activeCampaignCode || 'N/A'}
            </span>
          </div>
          <p className="text-xs text-content-3">
            Gestisci il tuo profilo personaggio, la campagna attiva, i dati e i provider AI.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSwitchCampaign}
          className="bg-primary text-surface-0 hover:bg-primary-hover font-semibold shadow-lg border border-primary-hover flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer transition-all hover:scale-102 active:scale-95 shrink-0"
        >
          <DoorOpen size={18} />
          <span>Cambia Campagna</span>
        </button>
      </div>

      {/* Main Macro Navigation Tabs (No infinite scrolling) */}
      <div className="flex items-center gap-2 border-b border-surface-2 pb-2 overflow-x-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('personale')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'personale'
              ? 'bg-primary text-surface-0 shadow-md font-bold'
              : 'bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-2'
          }`}
        >
          <User size={15} />
          <span>Profilo &amp; Personaggio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dm')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'dm'
              ? 'bg-primary text-surface-0 shadow-md font-bold'
              : 'bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-2'
          }`}
        >
          <Crown size={15} className={isDm ? 'text-amber-400' : ''} />
          <span>Gestione Campagna {isDm ? '(Master)' : '(Info)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dati')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'dati'
              ? 'bg-primary text-surface-0 shadow-md font-bold'
              : 'bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-2'
          }`}
        >
          <Database size={15} />
          <span>Sincronizzazione &amp; Backup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('provider')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'provider'
              ? 'bg-primary text-surface-0 shadow-md font-bold'
              : 'bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-2'
          }`}
        >
          <Sparkles size={15} />
          <span>Provider AI &amp; Chiavi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('legale')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'legale'
              ? 'bg-primary text-surface-0 shadow-md font-bold'
              : 'bg-surface-1/60 hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-2'
          }`}
        >
          <Shield size={15} />
          <span>Privacy &amp; GDPR</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: PROFILO & PERSONAGGIO (IMPOSTAZIONI PERSONALI)
         ========================================================================= */}
      {activeTab === 'personale' && (
        <div className="space-y-6 animate-fade-in">
          {/* Form Modifica PG */}
          <form onSubmit={handleSaveCharacterProfile} className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-2 pb-4">
              <div>
                <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                  <User size={18} className="text-primary" />
                  <span>Modifica Nome Personaggio &amp; Profilo</span>
                </h2>
                <p className="text-xs text-content-3 mt-0.5">
                  Modifica il nome e l'aspetto del tuo personaggio per questa campagna. Il cambio si sincronizza in cloud e con il party.
                </p>
              </div>

              <button
                type="submit"
                className="bg-primary hover:bg-primary-hover text-surface-0 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer transition-all shrink-0"
              >
                <Check size={14} />
                <span>Salva Profilo</span>
              </button>
            </div>

            {charSavedMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} />
                <span>{charSavedMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-content-2">
                  Nome Personaggio (PG)
                </label>
                <input
                  type="text"
                  value={charNameInput}
                  onChange={(e) => setCharNameInput(e.target.value)}
                  placeholder="Es. Vaelin Starfall"
                  className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3.5 py-2.5 text-sm text-content-1 focus:outline-none focus:border-primary transition-colors"
                  required
                />
                <p className="text-[11px] text-content-3">
                  Il nome visibile agli altri giocatori nel roster della campagna attiva.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-content-2">
                  Colore Identificativo PG
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={charColorInput}
                    onChange={(e) => setCharColorInput(e.target.value)}
                    className="w-10 h-10 rounded-xl bg-transparent border border-surface-3 cursor-pointer shrink-0"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#14b8a6'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCharColorInput(hex)}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                          charColorInput.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-1 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-mono font-medium text-content-2">
                  Ritratto / Avatar Personaggio
                </label>
                <SingleImageUploader
                  value={charAvatarInput}
                  onChange={(url) => setCharAvatarInput(url)}
                  placeholder="Carica un ritratto o inserisci un URL..."
                />
              </div>
            </div>
          </form>

          {/* Credenziali Account */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="border-b border-surface-2 pb-4">
              <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                <span>Account personale</span>
              </h2>
              <p className="text-xs text-content-3 mt-0.5">
                Autenticazione gestita tramite Google OAuth.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-surface-2/40 rounded-xl border border-surface-3/50 text-xs">
                <span className="text-content-3">Email Google Collegata:</span>
                <span className="font-mono font-semibold text-content-1">{account.email}</span>
              </div>

              <div className="pt-3 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={logout}
                  className="hover:bg-error/10 text-error border border-error/20 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Disconnetti Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(true)}
                  className="hover:bg-error/20 text-error border border-error/30 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Elimina Il Mio Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: GESTIONE CAMPAGNA (DM / INFO)
         ========================================================================= */}
      {activeTab === 'dm' && (
        <div className="space-y-6 animate-fade-in">
          {isDm ? (
            <>
              {/* Rinomina & Codice Permante Campagna (DM) */}
              <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-5">
                <div className="border-b border-surface-2 pb-3">
                  <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                    <Crown size={18} className="text-amber-400" />
                    <span>Impostazioni Campagna (Riservato al Master)</span>
                  </h2>
                  <p className="text-xs text-content-3 mt-0.5">
                    Gestisci il titolo ufficiale del tavolo. Il codice di accesso univoco è permanente e non modificabile.
                  </p>
                </div>

                {campaignNameSavedMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{campaignNameSavedMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-medium text-content-2">
                      Nome Ufficiale Campagna
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={campaignNameInput}
                        onChange={(e) => setCampaignNameInput(e.target.value)}
                        placeholder="Titolo della campagna..."
                        className="flex-1 bg-surface-2 border border-surface-3 rounded-xl px-3.5 py-2 text-xs text-content-1 focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCampaignName}
                        className="bg-primary hover:bg-primary-hover text-surface-0 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0"
                      >
                        Salva Nome
                      </button>
                    </div>
                  </div>

                  {/* Access code (Permanent) */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-medium text-content-2">
                      Codice Accesso Univoco (Permanente)
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-surface-2 border border-surface-3 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-primary flex items-center justify-between">
                        <span>{activeCampaignCode}</span>
                        <button
                          type="button"
                          onClick={copyCampaignCode}
                          className="text-content-3 hover:text-content-1 cursor-pointer p-1"
                          title="Copia Codice"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-content-3 italic">
                      Il codice di accesso è generato in modo permanente e non è modificabile.
                    </p>
                  </div>
                </div>

                {/* DM as Player Setting for whole campaign */}
                <div className="pt-4 border-t border-surface-2">
                  <div
                    onClick={() => handleToggleDmIsPlayer(!dmIsPlayer)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      dmIsPlayer
                        ? 'bg-primary/10 border-primary/40 shadow-xs'
                        : 'bg-surface-2/40 border-surface-3 hover:border-surface-3/80'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                          <Crown size={14} className={dmIsPlayer ? 'text-amber-400' : 'text-content-3'} />
                          <span>Il Dungeon Master partecipa anche come PG Giocante nella Campagna</span>
                        </span>
                        {dmIsPlayer ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                            ATTIVO PER TUTTA LA CAMPAGNA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-surface-3 text-content-3 text-[10px] font-mono">
                            Solo Narratore
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-content-3 leading-relaxed">
                        Attiva questa casella se il Dungeon Master guida anche un personaggio giocante (DMPC/PG) al tavolo. Il personaggio del Master comparirà automaticamente nell'elenco dei partecipanti a ogni sessione, nel ruolino della compagnia e nell'evoluzione di memorie e relazioni IA del party.
                      </p>
                    </div>

                    <div className="shrink-0">
                      <input
                        type="checkbox"
                        checked={dmIsPlayer}
                        onChange={(e) => handleToggleDmIsPlayer(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Roster Partecipanti & Co-Master */}
              <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                      <Users size={18} className="text-primary" />
                      <span>Giocatori della Campagna ({allPlayers.length})</span>
                    </h2>
                    <p className="text-xs text-content-3 mt-0.5">
                      Assegna il ruolo di Co-Master ed espelli partecipanti dal tavolo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyCampaignCode}
                    className="bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Copy size={13} />
                    <span>{copiedCode ? 'Copiato!' : `Codice: ${activeCampaignCode}`}</span>
                  </button>
                </div>

                {/* Table list of players */}
                <div className="space-y-2.5">
                  {allPlayers.map((p) => {
                    const isSelf = p._id === account.id || p.email === account.email;
                    const isMainDm = Boolean(
                      (activeCampaign?.dmId && (activeCampaign.dmId === p._id || activeCampaign.dmId === (p as any).id)) ||
                      (activeCampaign?.dmEmail && p.email && activeCampaign.dmEmail.toLowerCase() === p.email.toLowerCase()) ||
                      (p.isDm && !p.isCoDm && !p.isCoMaster)
                    );
                    const isCoMaster = Boolean(p.isCoDm || p.isCoMaster || p.tags?.includes('Co-Master'));

                    return (
                      <div
                        key={p._id}
                        className="p-3.5 bg-surface-2/40 border border-surface-3/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-surface-0 shrink-0 overflow-hidden shadow-xs"
                            style={{ backgroundColor: p.color || '#6366f1' }}
                          >
                            {p.avatarUrl && p.avatarUrl.trim() ? (
                              <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.characterName?.charAt(0).toUpperCase() || 'P'
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-semibold text-content-1 truncate flex items-center gap-2">
                              <span>{p.characterName}</span>
                              {isMainDm && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono font-semibold flex items-center gap-1">
                                  <Crown size={11} /> Master
                                </span>
                              )}
                              {!isMainDm && isCoMaster && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md font-mono font-semibold flex items-center gap-1">
                                  <Shield size={11} /> Co-Master
                                </span>
                              )}
                              {isSelf && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-mono">(Tu)</span>}
                            </p>

                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">

                          {/* Granular Permissions Button (for DMs) */}
                          {isDm && !isMainDm && (
                            <button
                              type="button"
                              onClick={() => setPermissionsTargetPlayer(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Gestisci permessi granulari"
                            >
                              <Key size={12} className="text-primary" />
                              <span>Permessi</span>
                            </button>
                          )}

                          {/* Toggle Co-Master button (for non-main DMs) */}
                          {!isMainDm && (
                            <button
                              type="button"
                              onClick={() => handleToggleCoMaster(p._id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                                isCoMaster
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
                                  : 'bg-surface-2 hover:bg-surface-3 text-content-2 border-surface-3'
                              }`}
                            >
                              <Shield size={12} />
                              <span>{isCoMaster ? 'Co-Master Attivo' : 'Rendi Co-Master'}</span>
                            </button>
                          )}

                          {/* Kick player button */}
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => setRemoveTargetPlayer(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-error border border-error/20 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              title="Espelli dalla campagna"
                            >
                              <UserX size={12} />
                              <span>Espelli</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zona Pericolosa Campagna */}
              <div className="bg-surface-1 border border-error/20 rounded-2xl p-6 space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-error flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>Eliminazione Campagna</span>
                </h3>
                <div className="flex items-center justify-between gap-4 pt-1">
                  <p className="text-xs text-content-3">
                    Elimina permanentemente questa campagna sia sul Cloud che in locale per tutti i partecipanti.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteCampModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-error/15 hover:bg-error/25 text-error border border-error/30 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    Elimina Campagna
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Giocatore Normale View */
            <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-5">
              <div className="border-b border-surface-2 pb-3">
                <h2 className="text-base font-semibold text-content-1">Informazioni Campagna</h2>
                <p className="text-xs text-content-3">Dettagli della campagna a cui stai partecipando.</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-surface-2/40 rounded-xl">
                  <span className="text-content-3">Nome Campagna:</span>
                  <span className="font-semibold text-content-1">{activeCampaign?.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-2/40 rounded-xl">
                  <span className="text-content-3">Codice Accesso:</span>
                  <span className="font-mono font-bold text-primary">{activeCampaignCode}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsLeaveCampModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Abbandona Questa Campagna
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SINCRONIZZAZIONE & BACKUP DATI (NO GERGO TECNICO)
         ========================================================================= */}
      {activeTab === 'dati' && (
        <div className="space-y-6 animate-fade-in">
          {/* Action Bar: Download, Restore, Sync side-by-side */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="border-b border-surface-2 pb-3">
              <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                <Database size={18} className="text-primary" />
                <span>Gestione Backup &amp; Allineamento Dati</span>
              </h2>
              <p className="text-xs text-content-3 mt-0.5">
                Scarica una copia dei tuoi dati, ripristina un backup salvato o forza la sincronizzazione col Database Cloud.
              </p>
            </div>

            {syncStatusMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  syncStatusMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-error/10 border border-error/30 text-error'
                }`}
              >
                {syncStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{syncStatusMsg.text}</span>
              </div>
            )}

            {/* Side-by-Side Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="p-3.5 bg-surface-2/60 hover:bg-surface-2 text-content-1 border border-surface-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Download size={16} className="text-primary" />
                <span>Scarica Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImportingBackup}
                className="p-3.5 bg-surface-2/60 hover:bg-surface-2 text-content-1 border border-surface-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <UploadCloud size={16} className="text-primary" />
                <span>{isImportingBackup ? 'Ripristino...' : 'Ripristina da Backup'}</span>
              </button>

              <button
                type="button"
                onClick={handleSupabaseBulkSync}
                disabled={supabaseStats.syncing}
                className="p-3.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw size={16} className={supabaseStats.syncing ? 'animate-spin' : ''} />
                <span>{supabaseStats.syncing ? 'Allineamento...' : 'Forza Allineamento Database'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>
          </div>

          {/* Table Stats: Memoria Locale vs Database Cloud */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-content-1">Stato Sincronizzazione Elementi</h3>
                <p className="text-xs text-content-3">
                  Verifica il conteggio dei record salvati sul dispositivo e nel Database Cloud.
                </p>
              </div>

              <button
                type="button"
                onClick={loadSupabaseStats}
                disabled={supabaseStats.loading}
                className="p-2 bg-surface-2 hover:bg-surface-3 text-content-2 rounded-xl text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                title="Ricarica conteggi"
              >
                <RefreshCw size={13} className={supabaseStats.loading ? 'animate-spin' : ''} />
                <span>Aggiorna</span>
              </button>
            </div>

            {supabaseStats.error && (
              <p className="text-xs text-error bg-error/10 border border-error/20 p-3 rounded-xl">
                {supabaseStats.error}
              </p>
            )}

            {supabaseStats.successMsg && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                {supabaseStats.successMsg}
              </p>
            )}

            <div className="divide-y divide-surface-2 text-xs">
              <div className="grid grid-cols-3 py-2 text-content-3 font-mono font-semibold uppercase tracking-wider text-[11px]">
                <span>Categoria Dati</span>
                <span className="text-center">Memoria Locale</span>
                <span className="text-right">Database Cloud</span>
              </div>

              {[
                { key: 'accounts', label: 'Account Utenti & PG' },
                { key: 'entities', label: 'Codex & Entità (NPC, Nemici, Luoghi)' },
                { key: 'sessions', label: 'Sessioni di Gioco' },
                { key: 'notes', label: 'Note di Campagna' },
                { key: 'chapters', label: 'Capitoli Storia' },
                { key: 'maps', label: 'Mappe dell\'Atlante' },
                { key: 'scrapbookItems', label: 'Scrapbook (Momenti Foto)' },
                { key: 'audioLogs', label: 'Diari Audio' },
                { key: 'characterBios', label: 'Biografie Personaggi' },
                { key: 'familyRelations', label: 'Relazioni Familiari' },
                { key: 'worldLoreArticles', label: 'Articoli Lore del Mondo' },
              ].map(({ key, label }) => {
                const loc = supabaseStats.local[key] ?? 0;
                const rem = supabaseStats.remote[key] ?? 0;
                const isSynced = loc === rem;
                return (
                  <div key={key} className="grid grid-cols-3 py-2.5 items-center">
                    <span className="font-medium text-content-1">{label}</span>
                    <span className="text-center font-mono font-bold text-content-2">{loc}</span>
                    <span className="text-right font-mono font-bold text-primary flex items-center justify-end gap-1.5">
                      <span>{rem}</span>
                      {isSynced ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-semibold">
                          Allineato
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.2 rounded font-mono font-semibold">
                          Da Allineare
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: PROVIDER AI & CHIAVI API (TAB DEDICATO)
         ========================================================================= */}
      {activeTab === 'provider' && (
        <div className="space-y-6 animate-fade-in">
          {/* Selection of Active Provider */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="border-b border-surface-2 pb-3">
              <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <span>Provider AI Predefinito per la Campagna</span>
              </h2>
              <p className="text-xs text-content-3 mt-0.5">
                Scegli quale motore di Intelligenza Artificiale utilizzare per la narrazione, l'Oracolo e la creazione di contenuti.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!isDm}
                onClick={() => isDm && handleSetAiProvider('gemini')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  !isDm ? 'cursor-default opacity-85' : 'cursor-pointer'
                } ${
                  campaignAiConfig.provider === 'gemini' || !campaignAiConfig.provider
                    ? 'bg-primary/10 border-primary ring-1 ring-primary'
                    : 'bg-surface-2/40 border-surface-3 hover:border-surface-3/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-content-1">Google Gemini API</span>
                  {(campaignAiConfig.provider === 'gemini' || !campaignAiConfig.provider) && (
                    <span className="text-[10px] bg-primary text-surface-0 font-bold px-2 py-0.5 rounded-full">
                      Attivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-3">
                  Modelli Flash di Google per la narrazione in tempo reale e il Codex.
                </p>
              </button>

              <button
                type="button"
                disabled={!isDm}
                onClick={() => isDm && handleSetAiProvider('openrouter')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  !isDm ? 'cursor-default opacity-85' : 'cursor-pointer'
                } ${
                  campaignAiConfig.provider === 'openrouter'
                    ? 'bg-primary/10 border-primary ring-1 ring-primary'
                    : 'bg-surface-2/40 border-surface-3 hover:border-surface-3/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-content-1">OpenRouter AI</span>
                  {campaignAiConfig.provider === 'openrouter' && (
                    <span className="text-[10px] bg-primary text-surface-0 font-bold px-2 py-0.5 rounded-full">
                      Attivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-3">
                  Accesso a un vasto catalogo di modelli (Claude, Llama, DeepSeek, Mistral).
                </p>
              </button>
            </div>
            {!isDm && (
              <p className="text-[11px] text-content-3 italic">
                * Il provider AI principale e i modelli consentiti sono impostati dal Dungeon Master.
              </p>
            )}
          </div>

          {/* Configurazione Modelli per Party & Oracolo */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-content-1">Modello Oracolo &amp; Modelli Consentiti</h3>
                <p className="text-xs text-content-3">
                  Imposta i modelli che i giocatori e l'Oracolo possono utilizzare.
                </p>
              </div>

              {isDm && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogTarget('oracle');
                    setIsAiCatalogOpen(true);
                  }}
                  className="bg-surface-2 hover:bg-surface-3 border border-surface-3 text-content-1 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Cpu size={14} />
                  <span>Catalogo Modelli</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-2/40 rounded-xl text-xs">
                <span className="text-content-3">Modello Oracolo Corrente:</span>
                <span className="font-mono font-bold text-primary">
                  {campaignAiConfig.oracleModel || campaignAiConfig.modelId || 'gemini-flash-latest'}
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono font-medium text-content-2 block">
                  Modelli Consentiti al Party
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allowedPartyModels.length === 0 ? (
                    <span className="text-xs text-content-3 italic">
                      {isDm
                        ? 'Nessun modello specifico limitato. I giocatori possono usare i modelli gratuiti standard.'
                        : 'Nessun modello limitato dal Master. Sono disponibili i modelli gratuiti standard.'}
                    </span>
                  ) : (
                    allowedPartyModels.map((m) => (
                      <span
                        key={m}
                        className="px-2.5 py-1 bg-surface-2 border border-surface-3 rounded-lg text-xs font-mono text-content-1 flex items-center gap-1.5"
                      >
                        <span>{m}</span>
                        {isDm && (
                          <button
                            type="button"
                            onClick={() => handleRemovePartyModel(m)}
                            className="hover:text-error text-content-3 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {isDm && (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Aggiungi ID modello (es. meta-llama/llama-3-70b)..."
                      value={quickModelInput}
                      onChange={(e) => setQuickModelInput(e.target.value)}
                      className="flex-1 bg-surface-2 border border-surface-3 rounded-xl px-3 py-1.5 text-xs text-content-1 focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={handleAddQuickModel}
                      className="bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Aggiungi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Key Mode Selector & Input Forms */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-5">
            <div className="border-b border-surface-2 pb-3">
              <h3 className="text-sm font-semibold text-content-1">Gestione Chiavi API</h3>
              <p className="text-xs text-content-3">
                Scegli se usare la chiave impostata dal Dungeon Master per tutta la campagna o la tua personale.
              </p>
            </div>

            <KeyModeSelector currentMode={keyMode} onModeChange={setKeyMode} isDm={isDm} />

            {keySavedMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{keySavedMessage}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-content-2 block">
                  Chiave API Google Gemini
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => {
                      isUserTypingRef.current = true;
                      setGeminiKeyInput(e.target.value);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3.5 py-2.5 text-xs text-content-1 focus:outline-none focus:border-primary font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                  >
                    {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-content-2 block">
                  Chiave API OpenRouter
                </label>
                <div className="relative">
                  <input
                    type={showOpenrouterKey ? 'text' : 'password'}
                    value={openrouterKeyInput}
                    onChange={(e) => {
                      isUserTypingRef.current = true;
                      setOpenrouterKeyInput(e.target.value);
                    }}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-surface-2 border border-surface-3 rounded-xl px-3.5 py-2.5 text-xs text-content-1 focus:outline-none focus:border-primary font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                  >
                    {showOpenrouterKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAiKeys}
                  className="bg-primary hover:bg-primary-hover text-surface-0 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-md"
                >
                  Salva Credenziali AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PRIVACY, COOKIE & GDPR (NOTE LEGALI & TUTELA DATI)
         ========================================================================= */}
      {activeTab === 'legale' && (
        <div className="space-y-6 animate-fade-in">
          {/* Overview Banner */}
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-4">
              <div>
                <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                  <Shield size={18} className="text-primary" />
                  <span>Tutela della Privacy &amp; Conformità GDPR</span>
                </h2>
                <p className="text-xs text-content-2 mt-1">
                  Chronicle è progettato nel pieno rispetto del Regolamento Generale sulla Protezione dei Dati (GDPR - UE 2016/679) e della Direttiva ePrivacy.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle size={14} />
                <span>GDPR Compliant</span>
              </span>
            </div>

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Privacy Policy Card */}
              <div className="bg-surface-2/60 border border-surface-2 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Shield size={18} />
                  </div>
                  <h3 className="text-sm font-semibold text-content-1">Informativa Privacy</h3>
                  <p className="text-xs text-content-2 leading-relaxed">
                    Come raccogliamo, proteggiamo e trattiamo unicamente l'email e i dati di gioco necessari al funzionamento delle campagne.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('privacy')}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-surface-0 border border-primary/40 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileText size={14} />
                  <span>Leggi Informativa Privacy</span>
                </button>
              </div>

              {/* Cookie Policy Card */}
              <div className="bg-surface-2/60 border border-surface-2 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Cookie size={18} />
                  </div>
                  <h3 className="text-sm font-semibold text-content-1">Politica sui Cookie</h3>
                  <p className="text-xs text-content-2 leading-relaxed">
                    Utilizzo esclusivo di cookie tecnici essenziali e LocalStorage per sessione e preferenze visive. Zero cookie di tracciamento o profilazione.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('cookie')}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-surface-0 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Cookie size={14} />
                  <span>Leggi Politica Cookie</span>
                </button>
              </div>

              {/* Terms & GDPR Rights Card */}
              <div className="bg-surface-2/60 border border-surface-2 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FileText size={18} />
                  </div>
                  <h3 className="text-sm font-semibold text-content-1">Termini &amp; Diritti GDPR</h3>
                  <p className="text-xs text-content-2 leading-relaxed">
                    Esercizio dei tuoi diritti (accesso, rettifica, cancellazione dell'account o oblio) e conformità Open Game License / SRD 5.1.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('terms')}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-surface-0 border border-cyan-500/40 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Shield size={14} />
                  <span>Leggi Termini &amp; Diritti</span>
                </button>
              </div>
            </div>

            {/* Summary Principles List */}
            <div className="border-t border-surface-2 pt-4 mt-2 space-y-2">
              <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider font-mono">
                Sintesi dei tuoi diritti e trasparenza dati
              </h4>
              <ul className="text-xs text-content-2 space-y-1.5 list-disc list-inside">
                <li><strong className="text-content-1 font-medium">Nessun dato venduto a terzi:</strong> Le informazioni delle campagne rimangono private e crittografate.</li>
                <li><strong className="text-content-1 font-medium">Diritto all'Oblio:</strong> Puoi eliminare in qualunque momento il tuo account e tutti i dati correlati dalla scheda "Profilo &amp; Personaggio" o "Sincronizzazione &amp; Backup".</li>
                <li><strong className="text-content-1 font-medium">Archiviazione Sicura:</strong> Le comunicazioni e il database utilizzano protocolli con crittografia in transito HTTPS/TLS e a riposo.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONFIRMATION MODALS & DIALOGS
         ========================================================================= */}

      {/* Wipe Own Account / Database Confirmation */}
      <ConfirmModal
        isOpen={isWipeModalOpen}
        title="Elimina Il Mio Account Personale"
        message="Sei sicuro di voler eliminare il tuo account utente personale? L'account verrà rimosso permanentemente."
        confirmLabel={isWiping ? 'Eliminazione...' : 'Elimina Definitivamente Il Mio Account'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={async () => {
          setIsWiping(true);
          try {
            CampaignManager.deleteAccount(account.id);
            logout();
          } catch (e) {
            console.error(e);
            logout();
          } finally {
            setIsWiping(false);
            setIsWipeModalOpen(false);
          }
        }}
        onCancel={() => !isWiping && setIsWipeModalOpen(false)}
      />

      {/* Delete Campaign Confirmation Modal (DM Only) */}
      <ConfirmModal
        isOpen={isDeleteCampModalOpen}
        title="Elimina Campagna Definitivamente"
        message={`Sei sicuro di voler eliminare la campagna "${activeCampaign?.name || activeCampaignCode}" (${activeCampaignCode})? Tutti i dati associati (sessioni, note, codex, mappe) verranno rimossi permanentemente sia in locale che sul Database Cloud.`}
        confirmLabel={isDeletingCamp ? 'Eliminazione in corso...' : 'Elimina Campagna per Tutti'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleDeleteActiveCampaign}
        onCancel={() => !isDeletingCamp && setIsDeleteCampModalOpen(false)}
      />

      {/* Leave Campaign Confirmation Modal */}
      <ConfirmModal
        isOpen={isLeaveCampModalOpen}
        title="Abbandona Campagna"
        message={`Vuoi davvero abbandonare la campagna "${activeCampaign?.name || activeCampaignCode}" (${activeCampaignCode})? Verrà rimossa dal tuo elenco e il tuo personaggio non sarà più collegato ad essa.`}
        confirmLabel={isLeavingCamp ? 'Uscita in corso...' : 'Abbandona Campagna'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleLeaveActiveCampaign}
        onCancel={() => !isLeavingCamp && setIsLeaveCampModalOpen(false)}
      />

      {/* Remove Player From Campaign Modal (DM Only) */}
      <ConfirmModal
        isOpen={Boolean(removeTargetPlayer)}
        title="Espelli Giocatore dalla Campagna"
        message={`Vuoi davvero espellere "${removeTargetPlayer?.characterName}" (${removeTargetPlayer?.email || 'Nessuna email'}) da questa campagna? L'utente non vedrà più questa campagna, ma il suo account personale rimarrà intatto.`}
        confirmLabel="Espelli dalla Campagna"
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleRemovePlayerConfirm}
        onCancel={() => setRemoveTargetPlayer(null)}
      />

      {/* Player Tags Modal */}
      <PlayerTagsModal
        isOpen={Boolean(tagsModalTargetPlayer)}
        onClose={() => setTagsModalTargetPlayer(null)}
        player={tagsModalTargetPlayer}
        campaignCode={activeCampaignCode || ''}
      />

      {/* Member Permissions Modal */}
      <MemberPermissionsModal
        isOpen={Boolean(permissionsTargetPlayer)}
        onClose={() => setPermissionsTargetPlayer(null)}
        player={permissionsTargetPlayer}
        campaignCode={activeCampaignCode || ''}
      />

      {/* AI Models Catalog Modal */}
      <LlmCatalogModal
        isOpen={isAiCatalogOpen}
        onClose={() => setIsAiCatalogOpen(false)}
        activeProvider={campaignAiConfig.provider || 'gemini'}
        onSelectProvider={(prov) => handleSetAiProvider(prov)}
        currentModelId={
          catalogTarget === 'oracle'
            ? (campaignAiConfig.oracleModel || campaignAiConfig.modelId || 'gemini-flash-latest')
            : ''
        }
        onSelectModel={(modelId, provider) => {
          if (catalogTarget === 'oracle') {
            CampaignManager.setCampaignAiConfig({
              oracleModel: modelId,
              modelId: modelId,
              ...(provider ? { provider } : {}),
            });
            setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
          } else {
            const current = campaignAiConfig.allowedPartyModels || [];
            if (!current.includes(modelId)) {
              const updated = [...current, modelId];
              CampaignManager.setCampaignAiConfig({ allowedPartyModels: updated });
              setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
            }
          }
        }}
        isDm={isDm}
      />
      {/* Legal, Privacy, Cookie & GDPR Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </div>
  );
}
