import { ConfirmModal } from '../components/ConfirmModal';
import { InstallAppModal } from '../components/InstallAppModal';
import { CampaignTypographyModal, getCampaignTitleClasses } from '../components/CampaignTypographyModal';
import { LlmCatalogModal } from '../components/OpenRouterCatalogModal';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { CloudSyncService } from '../lib/cloudSync';
import { getPwaStatus, promptPwaInstall, subscribePwa, PwaStatus } from '../lib/pwa';
import { Player, PlayerPartyStatus, CampaignMeta } from '../types';
import {
  Database,
  Key,
  User,
  Users,
  Check,
  RotateCcw,
  AlertTriangle,
  LogOut,
  Crown,
  Mail,
  DoorOpen,
  Copy,
  Sparkles,
  Trash2,
  Shield,
  ArrowRightLeft,
  UserX,
  UserCheck,
  Download,
  Smartphone,
  Monitor,
  Apple,
  AlertCircle,
  Loader2,
  Type,
  Sliders,
  RefreshCw,
  UploadCloud,
  HardDrive,
  FileCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Wand2,
  Zap,
  Cpu,
  Lock,
  Unlock,
} from 'lucide-react';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { useAiKeys } from '../hooks/useAiKeys';
import { KeyModeSelector } from '../components/KeyModeSelector';
import { ChevronRight, Palette, BookOpen, X } from 'lucide-react';

export function Settings() {
  const activeCampaignCode = CampaignManager.getActiveCampaignCode();
  const [allCampaigns, setAllCampaigns] = useState<CampaignMeta[]>(() => CampaignManager.getCampaigns());
  const activeCampaign = allCampaigns.find((c) => c.code === activeCampaignCode);
  const [isTypographyModalOpen, setIsTypographyModalOpen] = useState(false);

  const {
    account,
    player,
    allPlayers,
    logout,
    changePassword,
    updateAccountProfile,
  } = useAuth();
  const isDm = Boolean(
    player?.isDm ||
    (activeCampaign?.dmId && activeCampaign.dmId === account?.id) ||
    CampaignManager.isCurrentUserDm()
  );

  const {
    keyMode,
    setKeyMode,
    activeKeys,
    personalKeys,
    campaignKeys,
    savePersonalKeys,
    saveCampaignKeys,
    maskApiKey,
  } = useAiKeys();

  // AI Keys management inputs
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [cfAccountIdInput, setCfAccountIdInput] = useState('');
  const [cfApiTokenInput, setCfApiTokenInput] = useState('');
  const [showCfToken, setShowCfToken] = useState(false);
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);

  // Campaign AI Models configuration (DM sets providers & allowed party models)
  const [isAiCatalogOpen, setIsAiCatalogOpen] = useState(false);
  const [catalogTarget, setCatalogTarget] = useState<'oracle' | 'party'>('oracle');
  const [campaignAiConfig, setCampaignAiConfig] = useState(() => CampaignManager.getCampaignAiConfig());
  const allowedPartyModels = campaignAiConfig.allowedPartyModels || [];

  useEffect(() => {
    const handleAiConfigUpdated = () => {
      setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
    };
    window.addEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
    window.addEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
    return () => {
      window.removeEventListener('chronicle_ai_config_updated', handleAiConfigUpdated);
      window.removeEventListener('chronicle_campaigns_updated', handleAiConfigUpdated);
    };
  }, []);

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

  const handleSetAiProvider = (prov: 'gemini' | 'openrouter') => {
    CampaignManager.setCampaignAiConfig({ provider: prov });
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
  };

  const handleRemovePartyModel = (modelId: string) => {
    const updated = (campaignAiConfig.allowedPartyModels || []).filter((id) => id !== modelId);
    CampaignManager.setCampaignAiConfig({ allowedPartyModels: updated });
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
  };

  const handleResetRecommendedPartyModels = () => {
    const recommended = ['gemini-flash-latest', 'gemini-3.8-flash'];
    CampaignManager.setCampaignAiConfig({ allowedPartyModels: recommended });
    setCampaignAiConfig(CampaignManager.getCampaignAiConfig());
  };

  // Campaign name management for DM
  const [campaignNameInput, setCampaignNameInput] = useState(() => activeCampaign?.name || '');
  const [campaignNameSavedMsg, setCampaignNameSavedMsg] = useState<string | null>(null);

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
    }
  };

  // Track previous keyMode and user typing state so inputs are NEVER overwritten while typing
  const prevKeyModeRef = React.useRef(keyMode);
  const isUserTypingRef = React.useRef(false);

  // Sync inputs ONLY when keyMode changes or on initial mount, NEVER on every keystroke
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

  const [includeDmAsPlayer, setIncludeDmAsPlayer] = useState(() => {
    try {
      return localStorage.getItem('chronicle_include_dm_as_player') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleIncludeDmAsPlayer = (val: boolean) => {
    setIncludeDmAsPlayer(val);
    try {
      localStorage.setItem('chronicle_include_dm_as_player', String(val));
      // Dispatch event to make other opened components sync
      window.dispatchEvent(new CustomEvent('chronicle_include_dm_as_player_changed', { detail: val }));
    } catch {}
  };

  const [isVerifyingCf, setIsVerifyingCf] = useState(false);
  const [cfValidationResult, setCfValidationResult] = useState<{ valid: boolean; message?: string; error?: string } | null>(null);

  const [geminiValidationResult, setGeminiValidationResult] = useState<{
    valid: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [isVerifyingGemini, setIsVerifyingGemini] = useState(false);

  const [openrouterValidationResult, setOpenrouterValidationResult] = useState<{
    valid: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [isVerifyingOpenrouter, setIsVerifyingOpenrouter] = useState(false);

  const validateGeminiDirect = async (key: string) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && (data.candidates || data.text !== undefined)) {
        return { valid: true, message: 'Chiave API Google Gemini valida e operativa!' };
      }
      if (data.error) {
        const msg = data.error.message || JSON.stringify(data.error);
        if (msg.includes('API_KEY_INVALID') || response.status === 400 || response.status === 401) {
          return { valid: false, error: 'La chiave API di Google Gemini inserita non è valida o è stata revocata.' };
        }
        if (response.status === 429) {
          return { valid: true, warning: 'Chiave valida ma quota/frequenza temporaneamente esaurita (HTTP 429).' };
        }
        return { valid: false, error: `Errore Google Gemini (${response.status}): ${msg}` };
      }
      return { valid: false, error: `Risposta non valida dai server Google (HTTP ${response.status})` };
    } catch (err: any) {
      return { valid: false, error: `Impossibile raggiungere i server Google Gemini: ${err?.message || err}` };
    }
  };

  const validateOpenRouterDirect = async (key: string) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.data) {
        return { valid: true, message: 'Chiave OpenRouter valida e attiva!' };
      }
      return { valid: false, error: data?.error?.message || `Chiave OpenRouter non valida (HTTP ${response.status})` };
    } catch (err: any) {
      return { valid: false, error: `Impossibile connettersi a OpenRouter: ${err?.message || err}` };
    }
  };

  const validateCloudflareDirect = async (accountId: string, token: string) => {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/tokens/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        return { valid: true, message: 'Credenziali Cloudflare Workers AI valide!' };
      }
      return { valid: false, error: data?.errors?.[0]?.message || `Credenziali Cloudflare non valide (HTTP ${response.status})` };
    } catch (err: any) {
      return { valid: false, error: `Impossibile connettersi a Cloudflare: ${err?.message || err}` };
    }
  };

  const handleVerifyGemini = async () => {
    const keyToTest = geminiKeyInput.trim();
    if (!keyToTest) {
      setGeminiValidationResult({ valid: false, error: 'Inserisci prima una chiave API Gemini da verificare.' });
      return;
    }
    setIsVerifyingGemini(true);
    setGeminiValidationResult(null);
    try {
      let isSuccess = false;
      let errorMsg = '';

      try {
        const res = await fetch('/api/ai/gemini/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: keyToTest }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.valid) {
          isSuccess = true;
        } else if (data?.error) {
          errorMsg = data.error;
        }
      } catch {}

      if (!isSuccess && !errorMsg) {
        const directResult = await validateGeminiDirect(keyToTest);
        if (directResult.valid) {
          isSuccess = true;
        } else {
          errorMsg = directResult.error || 'Chiave non valida';
        }
      }

      if (isSuccess) {
        isUserTypingRef.current = false;
        const payload = { geminiKey: keyToTest };
        if (keyMode === 'campaign') {
          if (isDm) {
            await saveCampaignKeys(payload);
          } else {
            await savePersonalKeys(payload);
          }
        } else {
          await savePersonalKeys(payload);
        }
        setGeminiValidationResult({ valid: true, message: 'Chiave verificata e salvata' });
      } else {
        setGeminiValidationResult({
          valid: false,
          error: errorMsg || 'La chiave API di Google Gemini inserita non è valida o è stata revocata.',
        });
      }
    } catch (err: any) {
      setGeminiValidationResult({
        valid: false,
        error: `Errore durante la verifica: ${err?.message || err}`,
      });
    } finally {
      setIsVerifyingGemini(false);
    }
  };

  const handleVerifyOpenrouter = async () => {
    const keyToTest = openrouterKeyInput.trim();
    if (!keyToTest) {
      setOpenrouterValidationResult({ valid: false, error: 'Inserisci prima una chiave API OpenRouter da verificare.' });
      return;
    }
    setIsVerifyingOpenrouter(true);
    setOpenrouterValidationResult(null);
    try {
      let isSuccess = false;
      let errorMsg = '';

      try {
        const res = await fetch('/api/ai/openrouter/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: keyToTest }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.valid) {
          isSuccess = true;
        } else if (data?.error) {
          errorMsg = data.error;
        }
      } catch {}

      if (!isSuccess && !errorMsg) {
        const directResult = await validateOpenRouterDirect(keyToTest);
        if (directResult.valid) {
          isSuccess = true;
        } else {
          errorMsg = directResult.error || 'Chiave non valida';
        }
      }

      if (isSuccess) {
        isUserTypingRef.current = false;
        const payload = { openrouterKey: keyToTest };
        if (keyMode === 'campaign') {
          if (isDm) {
            await saveCampaignKeys(payload);
          } else {
            await savePersonalKeys(payload);
          }
        } else {
          await savePersonalKeys(payload);
        }
        setOpenrouterValidationResult({ valid: true, message: 'Chiave verificata e salvata' });
      } else {
        setOpenrouterValidationResult({
          valid: false,
          error: errorMsg || 'Chiave OpenRouter non valida.',
        });
      }
    } catch (err: any) {
      setOpenrouterValidationResult({
        valid: false,
        error: `Errore durante la verifica: ${err?.message || err}`,
      });
    } finally {
      setIsVerifyingOpenrouter(false);
    }
  };

  const handleVerifyCloudflare = async () => {
    if (!cfAccountIdInput.trim() || !cfApiTokenInput.trim()) {
      setCfValidationResult({ valid: false, error: "Inserisci sia l'Account ID che l'API Token prima di verificare." });
      return;
    }
    setIsVerifyingCf(true);
    setCfValidationResult(null);
    try {
      const res = await fetch('/api/ai/cloudflare/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: cfAccountIdInput.trim(),
          token: cfApiTokenInput.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCfValidationResult(data);
      } else {
        const directResult = await validateCloudflareDirect(cfAccountIdInput.trim(), cfApiTokenInput.trim());
        setCfValidationResult(directResult);
      }
    } catch (err: any) {
      const directResult = await validateCloudflareDirect(cfAccountIdInput.trim(), cfApiTokenInput.trim());
      setCfValidationResult(directResult);
    } finally {
      setIsVerifyingCf(false);
    }
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

  useEffect(() => {
    const handleCampUpdate = () => {
      setAllCampaigns(CampaignManager.getCampaigns());
    };
    window.addEventListener('chronicle_campaign_updated', handleCampUpdate);
    window.addEventListener('chronicle_campaign_changed', handleCampUpdate);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleCampUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleCampUpdate);
    };
  }, []);

  const navigate = useNavigate();

  const handleSwitchCampaign = () => {
    CampaignManager.setActiveCampaignCode(null);
    try {
      navigate('/character', { replace: true });
    } catch {}
  };

  // PWA State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(getPwaStatus);

  useEffect(() => {
    const update = () => setPwaStatus(getPwaStatus());
    update();
    return subscribePwa(update);
  }, []);

  // Password / Security State
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isDeleteCampModalOpen, setIsDeleteCampModalOpen] = useState(false);
  const [isDeletingCamp, setIsDeletingCamp] = useState(false);
  const [isLeaveCampModalOpen, setIsLeaveCampModalOpen] = useState(false);
  const [isLeavingCamp, setIsLeavingCamp] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Cloud Sync & Local Backup State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => CloudSyncService.getLastSyncTime());
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e?.detail?.time) {
        setLastSyncTime(e.detail.time);
      }
    };
    window.addEventListener('chronicle_cloud_sync_status', handleStatus);
    return () => window.removeEventListener('chronicle_cloud_sync_status', handleStatus);
  }, []);

  const handleManualSync = async () => {
    setIsSyncingCloud(true);
    setSyncStatusMsg(null);
    try {
      const res = await CloudSyncService.syncNow(true);
      if (res.success) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncStatusMsg({ type: 'success', text: `Sincronizzazione completata con successo alle ${timeStr}!` });
        setLastSyncTime(now.toISOString());
      } else {
        setSyncStatusMsg({ type: 'error', text: res.error || 'Errore durante la sincronizzazione.' });
      }
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: err?.message || 'Errore di connessione a Firestore.' });
    } finally {
      setIsSyncingCloud(false);
    }
  };

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
        setSyncStatusMsg({ type: 'success', text: 'Backup ripristinato con successo e sincronizzato nel Cloud!' });
        setLastSyncTime(new Date().toISOString());
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

  // Party Management & DM delegation state
  const [cleanDuplicatesMsg, setCleanDuplicatesMsg] = useState<string | null>(null);
  const [transferTargetPlayer, setTransferTargetPlayer] = useState<Player | null>(null);
  const [removeTargetPlayer, setRemoveTargetPlayer] = useState<Player | null>(null);
  const [deleteTargetPlayer, setDeleteTargetPlayer] = useState<Player | null>(null);
  const [isSelfDemoteModalOpen, setIsSelfDemoteModalOpen] = useState(false);

  if (!account || !player) return null;

  const handleCleanDuplicates = () => {
    const count = CampaignManager.cleanDuplicateAccounts();
    if (count > 0) {
      setCleanDuplicatesMsg(`Pulizia completata: ${count} account duplicati unificati!`);
    } else {
      setCleanDuplicatesMsg('Database sincronizzato: nessun account duplicato trovato.');
    }
    setTimeout(() => setCleanDuplicatesMsg(null), 4000);
  };

  const handlePromoteToDm = (targetPlayerId: string) => {
    if (!activeCampaignCode) return;
    CampaignManager.makeDmOfCampaign(targetPlayerId, activeCampaignCode);
  };

  const handleStatusChange = (targetPlayerId: string, newStatus: PlayerPartyStatus) => {
    if (!activeCampaignCode) return;
    CampaignManager.setPlayerPartyStatus(targetPlayerId, activeCampaignCode, newStatus);
  };

  const handleRevokeDm = (targetPlayerId: string) => {
    if (!activeCampaignCode) return;
    CampaignManager.revokeDmOfCampaign(targetPlayerId, activeCampaignCode);
  };

  const handleTransferDmConfirm = () => {
    if (!activeCampaignCode || !transferTargetPlayer || !account) return;
    CampaignManager.transferDmRole(account.id, transferTargetPlayer._id, activeCampaignCode);
    setTransferTargetPlayer(null);
  };

  const handleSelfDemoteConfirm = () => {
    if (!activeCampaignCode || !account) return;
    CampaignManager.revokeDmOfCampaign(account.id, activeCampaignCode);
    setIsSelfDemoteModalOpen(false);
  };

  const handleRemovePlayerConfirm = () => {
    if (!activeCampaignCode || !removeTargetPlayer) return;
    CampaignManager.removePlayerFromCampaign(removeTargetPlayer._id, activeCampaignCode);
    setRemoveTargetPlayer(null);
  };

  const handleDeleteAccountConfirm = () => {
    if (!deleteTargetPlayer) return;
    CampaignManager.deleteAccount(deleteTargetPlayer._id);
    setDeleteTargetPlayer(null);
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
      console.error('Errore durante l\'abbandono della campagna:', e);
    } finally {
      setIsLeavingCamp(false);
      setIsLeaveCampModalOpen(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    setPasswordError(null);
    setIsChangingPassword(true);
    try {
      const res = await changePassword(newPassword.trim());
      if (res.success) {
        setPasswordSuccess(true);
        setNewPassword('');
        setTimeout(() => setPasswordSuccess(false), 3500);
      } else {
        setPasswordError(res.error || 'Impossibile aggiornare la password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const copyCampaignCode = () => {
    if (activeCampaignCode) {
      navigator.clipboard.writeText(activeCampaignCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-semibold text-content-1 text-balance">
            Impostazioni &amp; Campagna
          </h1>
          <p className="text-xs text-content-3 mt-1">
            Gestione credenziali account, membri del party e sincronizzazione database cloud
          </p>
        </div>
        <button
          id="btn-settings-logout"
          type="button"
          onClick={logout}
          className="hover:bg-error/10 text-error border border-error/20 px-4 py-2 rounded-xl text-xs font-medium flex items-center justify-center space-x-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <LogOut size={14} />
          <span>Disconnetti ({account.email})</span>
        </button>
      </div>

      {/* Install App / PWA Banner Section */}
      <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shrink-0">
              <img src="/icons/icon.svg" alt="Chronicle Icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-semibold text-content-1">
                  Applicazione &amp; Installazione PWA
                </h2>
                {pwaStatus.isStandalone ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 flex items-center gap-1">
                    <Check size={12} /> App Installata
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-md border border-primary/20">
                    Disponibile
                  </span>
                )}
              </div>
              <p className="text-xs text-content-3 mt-0.5">
                Installa Chronicle sul tuo dispositivo per usarla a schermo intero come una vera app nativa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Download size={14} />
            <span>{pwaStatus.isStandalone ? 'Istruzioni & Gestione App' : 'Installa App (Windows, Android, iOS)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3 flex items-start gap-3">
            <Monitor size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-content-1">Windows Desktop</p>
              <p className="text-[11px] text-content-3 mt-0.5">Finestra dedicata, shortcut sul desktop e ancoraggio alla barra delle applicazioni.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3 flex items-start gap-3">
            <Smartphone size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-content-1">Android Mobile</p>
              <p className="text-[11px] text-content-3 mt-0.5">Installazione rapida tramite Chrome con icona personalizzata nella home.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3 flex items-start gap-3">
            <Apple size={18} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-content-1">Apple iOS (iPhone/iPad)</p>
              <p className="text-[11px] text-content-3 mt-0.5">Aggiunta a schermata Home da Safari in 2 semplici tocchi senza App Store.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Details & Firebase Cloud Sync */}
      <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-2 pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                className={`text-lg font-bold ${getCampaignTitleClasses(activeCampaign).fullClass}`}
                style={getCampaignTitleClasses(activeCampaign).style}
              >
                {activeCampaign ? activeCampaign.name : 'Campagna Attiva'}
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20 flex items-center gap-1">
                <Check size={12} /> Cloud Sync Attivo
              </span>
            </div>
            <p className="text-xs text-content-3 mt-1">
              Dati al sicuro e sincronizzati su Google Firestore Cloud
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeCampaign && (
              <button
                type="button"
                onClick={() => setIsTypographyModalOpen(true)}
                className="hover:bg-primary/10 text-primary border border-primary/30 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sliders size={14} />
                <span>Tipografia &amp; Stile Logo</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSwitchCampaign}
              className="hover:bg-surface-2 text-content-2 hover:text-content-1 border border-surface-3 px-4 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <DoorOpen size={14} />
              <span>Cambia Campagna</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-content-2 mb-1.5">
              Codice Accesso Campagna
            </label>
            <div className="flex items-center justify-between bg-surface-2 border border-surface-3 rounded-xl px-4 py-3">
              <span className="text-sm font-mono font-semibold text-primary tracking-wider">
                {activeCampaignCode}
              </span>
              <button
                type="button"
                onClick={copyCampaignCode}
                className="text-content-3 hover:text-content-1 transition-colors p-1 cursor-pointer"
                title="Copia codice"
              >
                {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-content-3 mt-2">
              Condividi questo codice con i tuoi giocatori per farli accedere alla campagna.
            </p>
          </div>

          <div className="bg-surface-2 border border-surface-3 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
                <Database size={14} />
                <span>Google Firestore Database</span>
              </div>
              <p className="text-xs text-content-3 leading-relaxed">
                Tutte le sessioni, le mappe, i PNG e le note sono memorizzate nel Cloud in tempo reale.
              </p>
            </div>
            <div className="text-xs text-content-3 font-mono mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>Stato:</span>
                <span className="text-emerald-400 font-medium">Connesso &amp; Protetto</span>
              </span>
              {lastSyncTime && (
                <span className="text-[11px] text-content-3">
                  Ultimo sync: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cloud Sync & Manual Backup Actions */}
        <div className="p-4 rounded-xl bg-surface-2/70 border border-surface-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-content-1 flex items-center gap-2">
                <HardDrive size={14} className="text-primary" />
                Sicurezza Dati: Salvataggio Cloud &amp; Backup Locale
              </h3>
              <p className="text-[11px] text-content-3 mt-0.5">
                Attualmente presenti: {CampaignManager.getSessions().length} sessioni, {CampaignManager.getEntities().length} elementi Codex, {CampaignManager.getNotes().length} note.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingCloud}
                className="px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                title="Forza l'invio immediato di tutte le sessioni e codex a Google Firestore"
              >
                {isSyncingCloud ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                <span>{isSyncingCloud ? 'Sincronizzazione in corso...' : 'Sincronizza su Cloud Ora'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-3 py-2 bg-surface-1 hover:bg-surface-3 text-content-1 border border-surface-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                title="Scarica un file JSON completo di tutta la campagna sul tuo computer"
              >
                <Download size={13} className="text-content-2" />
                <span>Scarica Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImportingBackup}
                className="px-3 py-2 bg-surface-1 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                title="Ripristina la campagna caricando un file di backup JSON"
              >
                {isImportingBackup ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                <span>Ripristina da Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileImport}
              />
            </div>
          </div>

          {syncStatusMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                  : 'bg-red-950/40 text-red-300 border border-red-800/50'
              }`}
            >
              {syncStatusMsg.type === 'success' ? <Check size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
              <span>{syncStatusMsg.text}</span>
            </div>
          )}
        </div>

        {activeCampaignCode && (
          <div className="pt-4 border-t border-surface-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {player?.isDm ? (
              <>
                <div>
                  <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
                    <Trash2 size={14} />
                    <span>Gestione Master: Elimina Campagna Definitivamente</span>
                  </div>
                  <p className="text-xs text-content-3 mt-0.5">
                    In qualità di Dungeon Master, puoi eliminare definitivamente questa campagna dal Cloud per tutti i giocatori.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteCampModalOpen(true)}
                  className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800/50 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shrink-0"
                >
                  <Trash2 size={13} />
                  <span>Elimina per Tutti</span>
                </button>
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                    <LogOut size={14} />
                    <span>Abbandona Campagna (Elimina per me)</span>
                  </div>
                  <p className="text-xs text-content-3 mt-0.5">
                    Rimuovi questa avventura dal tuo elenco. La campagna rimarrà attiva e intatta per il Dungeon Master e gli altri membri.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLeaveCampModalOpen(true)}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shrink-0"
                >
                  <LogOut size={13} />
                  <span>Abbandona Campagna</span>
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Motori AI & Gestione Chiavi (Fase 2) */}
      <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-semibold text-content-1">
                  Provider AI &amp; Gestione Chiavi
                </h2>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {keyMode === 'personal' ? 'Chiavi Personali (Account)' : 'Chiavi Campagna (Party)'}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-surface-3 text-content-3 border border-surface-3/80">
                  Protetto
                </span>
              </div>
              <p className="text-xs text-content-3">
                {keyMode === 'campaign'
                  ? 'Il Dungeon Master imposta le chiavi per la campagna, rendendole accessibili a tutto il party.'
                  : 'Usa le tue API Key personali salvate privatamente nel tuo profilo utente.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAiKeys}
            disabled={keyMode === 'campaign' && !isDm}
            className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer self-start sm:self-auto shrink-0"
          >
            {keyMode === 'campaign'
              ? isDm
                ? 'Salva Chiavi Campagna (DM)'
                : 'Gestita dal Dungeon Master'
              : 'Salva Chiavi Personali'}
          </button>
        </div>

        {/* DM Campaign Name Editing Card */}
        {isDm && activeCampaign && (
          <div className="p-4 bg-surface-2/60 border border-primary/30 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-primary" />
                <span className="text-xs font-bold text-content-1">
                  Nome Ufficiale della Campagna (Riservato al Master)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-3 text-content-2 border border-surface-4">
                Codice: {activeCampaign.code}
              </span>
            </div>
            <p className="text-[11px] text-content-3 leading-relaxed">
              Puoi rinominare il titolo della campagna in qualsiasi momento. Il nuovo nome si aggiornerà immediatamente nell'intestazione e nell'interfaccia di tutto il party.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={campaignNameInput}
                onChange={(e) => setCampaignNameInput(e.target.value)}
                placeholder="Inserisci il nuovo nome della campagna..."
                className="flex-1 bg-surface-1 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2 text-xs text-content-1 outline-none font-semibold transition-all"
              />
              <button
                type="button"
                onClick={handleSaveCampaignName}
                disabled={!campaignNameInput.trim() || campaignNameInput.trim() === activeCampaign.name}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Check size={14} />
                <span>Salva Nome</span>
              </button>
            </div>
            {campaignNameSavedMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-1.5 animate-fadeIn">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{campaignNameSavedMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* 2.1 Key Mode Selector Component */}
        <KeyModeSelector
          currentMode={keyMode}
          onModeChange={(newMode) => setKeyMode(newMode)}
          isDm={isDm}
        />

        {/* DM vs Player Role Banner */}
        {keyMode === 'campaign' ? (
          isDm ? (
            <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-xs flex items-center gap-3">
              <Crown size={20} className="text-primary shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold text-content-1 block">
                  Ruolo Master: Chiave di Campagna a Disposizione del Party
                </span>
                <span className="text-content-3 text-[11px] leading-relaxed">
                  In qualità di Dungeon Master, le chiavi che salvi qui sono sincronizzate in tempo reale con tutti i membri della campagna. Nessun giocatore dovrà configurare una propria chiave.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-surface-2/60 border border-surface-3 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary shrink-0" />
                  <span className="font-bold text-content-1">Chiave Condivisa della Campagna</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Condivisa dal DM
                </span>
              </div>
              <p className="text-[11px] text-content-3 leading-relaxed">
                ✅ Tutte le funzionalità IA (Oracolo, estrazione entità, Sendipietra e sincronizzazione memoria) sono attive. I modelli Google Gemini sono operativi tramite il server e la configurazione condivisa del Dungeon Master. Non è richiesta alcuna configurazione da parte del giocatore.
              </p>
              {Boolean(campaignKeys.geminiKey || campaignKeys.openrouterKey) && (
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px]">
                  {campaignKeys.geminiKey && (
                    <span className="px-2 py-0.5 rounded bg-surface-3 text-emerald-400 border border-emerald-500/20">
                      Gemini: Configurato
                    </span>
                  )}
                  {campaignKeys.openrouterKey && (
                    <span className="px-2 py-0.5 rounded bg-surface-3 text-indigo-400 border border-indigo-500/20">
                      OpenRouter: Configurato
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="p-3 bg-surface-2/60 border border-surface-3 rounded-xl text-xs flex items-center gap-2.5">
            <Lock size={15} className="text-primary shrink-0" />
            <span className="text-content-3 text-[11px]">
              Modalità <strong>Chiave Personale</strong>: Le chiavi impostate qui sono salvate privatamente nel tuo profilo utente. Solo tu puoi utilizzarle.
            </span>
          </div>
        )}

        {keySavedMessage && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{keySavedMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Google Gemini Key Card */}
          <div className="p-4 bg-surface-2/40 border border-surface-3 rounded-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  <span className="text-xs font-bold text-content-1">
                    Google Gemini
                  </span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                >
                  <span>Ottieni Chiave</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="text-[11px] text-content-3 leading-relaxed">
                Consente all'Oracolo, all'Archivista Arcano e alla Sincronizzazione Memoria di consultare i modelli Gemini per la campagna.
              </p>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-content-2">
                  API Key Gemini:
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    disabled={keyMode === 'campaign' && !isDm}
                    onChange={(e) => {
                      isUserTypingRef.current = true;
                      setGeminiKeyInput(e.target.value);
                    }}
                    placeholder={
                      keyMode === 'campaign' && !isDm
                        ? 'Chiave attivata dal Dungeon Master'
                        : 'Incolla la tua chiave Google Gemini (AIza...)...'
                    }
                    className="w-full bg-surface-1 border border-surface-3 rounded-lg px-3 py-2 text-xs text-content-1 pr-9 outline-none focus:border-primary font-mono disabled:opacity-90 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {keyMode === 'campaign' && !isDm && (
                  <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 pt-0.5">
                    <Check size={12} className="text-emerald-400 shrink-0" />
                    <span>
                      {geminiKeyInput.trim()
                        ? 'Chiave di campagna distribuita dal DM. Attiva e verificata per il party.'
                        : 'Modalità campagna attiva. In attesa della chiave dal Dungeon Master.'}
                    </span>
                  </p>
                )}
              </div>
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={handleVerifyGemini}
                  disabled={isVerifyingGemini || !geminiKeyInput.trim()}
                  className="w-full px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:bg-primary/10 cursor-pointer"
                >
                  {isVerifyingGemini ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-primary" />
                      <span>Verifica in corso...</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} className="text-primary" />
                      <span>Verifica Chiave</span>
                    </>
                  )}
                </button>
                {geminiValidationResult && (
                  <div className="mt-2 p-2.5 rounded-lg text-[11px] bg-surface-1 border border-surface-3">
                    {geminiValidationResult.valid ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Chiave verificata e salvata</span>
                      </div>
                    ) : (
                      <div className="text-red-400 font-medium">
                        ❌ {geminiValidationResult.error || 'Chiave non valida'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {geminiKeyInput && (
              <div className="flex items-center justify-between text-[10px] text-content-3 pt-2 border-t border-surface-3/50 mt-1">
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <span>● Configurato</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.2 bg-surface-3 text-content-2 rounded">
                    {maskApiKey(geminiKeyInput)}
                  </span>
                </span>
                {(isDm || keyMode === 'personal') && (
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiKeyInput('');
                      ApiKeyManager.clearKey('geminiKey');
                    }}
                    className="text-red-400 hover:underline cursor-pointer"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            )}
          </div>

          {/* OpenRouter Key Card */}
          <div className="p-4 bg-surface-2/40 border border-surface-3 rounded-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  <span className="text-xs font-bold text-content-1">
                    OpenRouter
                  </span>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                >
                  <span>Ottieni Chiave</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="text-[11px] text-content-3 leading-relaxed">
                Consente di utilizzare modelli alternativi per l'Oracolo durante la campagna.
              </p>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-content-2">
                  API Key OpenRouter:
                </label>
                <div className="relative">
                  <input
                    type={showOpenrouterKey ? 'text' : 'password'}
                    value={openrouterKeyInput}
                    disabled={keyMode === 'campaign' && !isDm}
                    onChange={(e) => {
                      isUserTypingRef.current = true;
                      setOpenrouterKeyInput(e.target.value);
                    }}
                    placeholder={keyMode === 'campaign' && !isDm ? "Chiave gestita dal Dungeon Master" : "Incolla la tua chiave OpenRouter (sk-or-...)..."}
                    className="w-full bg-surface-1 border border-surface-3 rounded-lg px-3 py-2 text-xs text-content-1 pr-9 outline-none focus:border-primary font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1 cursor-pointer"
                  >
                    {showOpenrouterKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {keyMode === 'campaign' && !isDm && (
                  <p className="text-[10px] text-content-3 italic">
                    Modificabile solo dal Dungeon Master. Per usare una tua chiave, seleziona &ldquo;Chiave Personale&rdquo;.
                  </p>
                )}
              </div>
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={handleVerifyOpenrouter}
                  disabled={isVerifyingOpenrouter || !openrouterKeyInput.trim()}
                  className="w-full px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:bg-indigo-500/10 cursor-pointer"
                >
                  {isVerifyingOpenrouter ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-indigo-400" />
                      <span>Verifica in corso...</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} className="text-indigo-400" />
                      <span>Verifica Chiave</span>
                    </>
                  )}
                </button>
                {openrouterValidationResult && (
                  <div className="mt-2 p-2.5 rounded-lg text-[11px] bg-surface-1 border border-surface-3">
                    {openrouterValidationResult.valid ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Chiave verificata e salvata</span>
                      </div>
                    ) : (
                      <div className="text-red-400 font-medium">
                        ❌ {openrouterValidationResult.error || 'Chiave non valida'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {openrouterKeyInput && (
              <div className="flex items-center justify-between text-[10px] text-content-3 pt-2 border-t border-surface-3/50 mt-1">
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <span>● Configurato</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.2 bg-surface-3 text-content-2 rounded">
                    {maskApiKey(openrouterKeyInput)}
                  </span>
                </span>
                {(isDm || keyMode === 'personal') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenrouterKeyInput('');
                      ApiKeyManager.clearKey('openrouterKey');
                    }}
                    className="text-red-400 hover:underline cursor-pointer"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Gestione Modelli IA della Campagna (Esclusivo DM con selezione modelli per il party) */}
        <div className="p-5 bg-surface-2/40 border border-surface-3 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-3/60 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-content-1 uppercase tracking-wider font-mono">
                  {isDm ? 'Modelli IA della Campagna (Configurazione DM)' : 'Modelli IA Attivi per il Tavolo'}
                </h3>
              </div>
              <p className="text-[11px] text-content-3 leading-relaxed">
                {isDm
                  ? 'Configura quale provider (Gemini o OpenRouter) e quali modelli sono abilitati per il party e per le consultazioni della campagna.'
                  : 'Il Dungeon Master gestisce i provider e i modelli disponibili per il tavolo, garantendo un\'esperienza focalizzata e senza complicazioni tecniche.'}
              </p>
            </div>

            {isDm && (
              <button
                type="button"
                onClick={() => {
                  setCatalogTarget('party');
                  setIsAiCatalogOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Users size={13} />
                <span>Gestisci Modelli nel Catalogo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider Attivo */}
            <div className="p-3.5 bg-surface-1 rounded-xl border border-surface-3 space-y-2">
              <span className="text-[10px] font-mono text-content-3 uppercase block font-bold">
                Provider Primario Campagna
              </span>
              {isDm ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetAiProvider('gemini')}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      campaignAiConfig.provider !== 'openrouter'
                        ? 'bg-primary/20 border-primary text-primary shadow-xs'
                        : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>Google Gemini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAiProvider('openrouter')}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      campaignAiConfig.provider === 'openrouter'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs'
                        : 'bg-surface-2 text-content-3 border-surface-3 hover:text-content-1'
                    }`}
                  >
                    <Zap size={13} />
                    <span>OpenRouter</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-content-1 pt-1">
                  {campaignAiConfig.provider === 'openrouter' ? (
                    <span className="px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                      <Zap size={13} /> OpenRouter
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-primary/15 text-primary border border-primary/30 flex items-center gap-1.5">
                      <Sparkles size={13} /> Google Gemini
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Modello Predefinito Campagna / Oracolo */}
            <div className="p-3.5 bg-surface-1 rounded-xl border border-surface-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-content-3 uppercase block font-bold">
                  Modello Oracolo &amp; Sendipietra
                </span>
                {isDm && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogTarget('oracle');
                      setIsAiCatalogOpen(true);
                    }}
                    className="text-[10px] text-primary hover:underline font-mono cursor-pointer"
                  >
                    Sfoglia Catalogo &rarr;
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-mono text-xs text-content-1 font-semibold px-2.5 py-1 rounded bg-surface-2 border border-surface-3 truncate max-w-full">
                  {campaignAiConfig.oracleModel || campaignAiConfig.modelId || 'gemini-flash-latest'}
                </span>
              </div>
            </div>
          </div>

          {/* Modelli Abilitati per il Party */}
          <div className="p-3.5 bg-surface-1 rounded-xl border border-surface-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-primary" />
                <span className="text-xs font-bold text-content-1 font-mono uppercase">
                  Modelli Selezionati per i Giocatori ({allowedPartyModels.length})
                </span>
              </div>

              {isDm && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetRecommendedPartyModels}
                    className="text-[10px] font-mono text-content-3 hover:text-content-1 px-2 py-0.5 rounded border border-surface-3 hover:border-primary/40 cursor-pointer"
                    title="Imposta Gemini Flash Latest e Gemini 3.8 Flash come modelli consentiti per i giocatori"
                  >
                    Reimposta Consigliati
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogTarget('party');
                      setIsAiCatalogOpen(true);
                    }}
                    className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Aggiungi dal Catalogo</span>
                  </button>
                </div>
              )}
            </div>

            {allowedPartyModels.length === 0 ? (
              <p className="text-xs text-content-3 italic">
                {isDm
                  ? 'Nessun modello specifico configurato: il party utilizzerà i modelli standard consigliati dal sistema.'
                  : 'I giocatori utilizzano i modelli consigliati standard approvati per la campagna.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {allowedPartyModels.map((mId) => (
                  <span
                    key={mId}
                    className="px-2.5 py-1 rounded-lg bg-surface-2 border border-surface-3 text-content-1 font-mono text-xs flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="truncate max-w-[200px]">{mId}</span>
                    {isDm && (
                      <button
                        type="button"
                        onClick={() => handleRemovePartyModel(mId)}
                        className="text-content-3 hover:text-red-400 cursor-pointer transition-colors p-0.5 -mr-1"
                        title="Rimuovi questo modello dall'elenco party"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {isDm && (
              <div className="pt-2 border-t border-surface-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Aggiungi modello per ID (es. gemini-3.8-flash o meta-llama/llama-3.3-70b-instruct:free)..."
                  value={quickModelInput}
                  onChange={(e) => setQuickModelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddQuickModel();
                    }
                  }}
                  className="flex-1 bg-surface-2/60 border border-surface-3 rounded-lg px-3 py-1.5 text-xs font-mono text-content-1 placeholder:text-content-3 outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddQuickModel}
                  disabled={!quickModelInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-surface-0 font-medium text-xs font-mono transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>+ Aggiungi al Party</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gestione Relazioni Co-Master / DM-Giocatore */}
        <div className="p-4 bg-surface-2/40 border border-surface-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <span className="text-xs font-bold text-content-1">
                Sincronizzazione Relazioni per il Dungeon Master
              </span>
            </div>
            <p className="text-[11px] text-content-3 leading-relaxed">
              Attiva questa opzione se stai giocando anche come personaggio attivo (D&D DM-Player o Co-Master) o se sostituisci il Master. In questo modo l'Archivista Arcano considererà il tuo personaggio come un normale membro del party per la sincronizzazione e l'evoluzione dei rapporti con i PNG nelle sessioni.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleIncludeDmAsPlayer(!includeDmAsPlayer)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
              includeDmAsPlayer
                ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
                : 'bg-surface-1 text-content-3 border-surface-3 hover:bg-surface-2'
            }`}
          >
            {includeDmAsPlayer ? 'Abilitato (DM trattato come Giocatore)' : 'Disabilitato (Ignora Relazioni DM)'}
          </button>
        </div>
      </section>

      {/* Account & Security Management */}
      <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex items-center gap-3 border-b border-surface-2 pb-4">
          {player?.avatarUrl ? (
            <img
              src={player?.avatarUrl}
              alt={player?.characterName || account.characterName}
              className="w-12 h-12 rounded-xl object-cover border border-surface-3"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-medium text-surface-0 text-base"
              style={{ backgroundColor: player?.color || account.color || '#6366f1' }}
            >
              {(player?.characterName || account.characterName).charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-heading font-semibold text-content-1">
                {account.email}
              </h2>
              {player.isDm ? (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-md border border-primary/20 flex items-center gap-1">
                  <Crown size={12} /> Dungeon Master
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-surface-2 text-content-2 text-xs font-medium rounded-md border border-surface-3">
                  Giocatore
                </span>
              )}
              {account.authProvider === 'google' && (
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-md border border-blue-500/20 flex items-center gap-1">
                  <Shield size={12} /> Google Auth
                </span>
              )}
            </div>
            <p className="text-xs text-content-3 font-mono mt-0.5 flex items-center gap-1.5">
              <Mail size={12} /> Personaggio attivo: <span className="text-content-1 font-semibold">{player?.characterName || account.characterName}</span>
            </p>
          </div>
        </div>

        {account.authProvider === 'google' ? (
          <div className="p-4 bg-surface-2/60 border border-surface-3 rounded-xl flex items-center gap-3 text-xs text-content-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Shield size={16} />
            </div>
            <div>
              <p className="font-semibold text-content-1">Accesso Protetto con Google</p>
              <p className="text-content-3 text-[11px] mt-0.5">
                Nessuna password memorizzata nel database. La sicurezza dell'accesso è gestita direttamente da Google.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-content-2 mb-1.5">
                Cambia Password Account
              </label>
              {passwordError && (
                <div className="mb-3 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="password"
                  placeholder="Inserisci la nuova password (min 6 caratteri)..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-content-1 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newPassword.trim() || isChangingPassword}
                  className="bg-primary disabled:opacity-50 text-surface-0 hover:bg-primary-hover px-5 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : passwordSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Password Aggiornata!</span>
                    </>
                  ) : (
                    <>
                      <Key size={14} />
                      <span>Aggiorna Password</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-content-3 mt-1.5">
                La sicurezza della password è protetta dai server crittografici di Firebase Authentication.
              </p>
            </div>
          </form>
        )}
      </section>

      {/* Party Roster & DM Role Management */}
      <section className="bg-surface-1 border border-surface-2 rounded-2xl p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-2 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 border border-surface-3 flex items-center justify-center text-primary">
              <User size={18} />
            </div>
            <div>
              <h2 className="text-base font-heading font-semibold text-content-1 flex items-center gap-2">
                Compagni di Campagna &amp; Gestione Ruoli
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-content-2 border border-surface-3">
                  {allPlayers.length} {allPlayers.length === 1 ? 'membro' : 'membri'}
                </span>
              </h2>
              <p className="text-xs text-content-3">
                Gestisci i partecipanti della campagna, assegna o cedi il ruolo di Dungeon Master e organizza il party.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCleanDuplicates}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cerca e unifica eventuali account duplicati con la stessa email"
            >
              <Sparkles size={13} className="text-primary" />
              <span>Unisci Duplicati</span>
            </button>
          </div>
        </div>

        {cleanDuplicatesMsg && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2 animate-fadeIn">
            <Check size={14} className="shrink-0" />
            <span>{cleanDuplicatesMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {allPlayers.map((p) => {
            const isCurrent = p._id === player._id;
            const isDm = Boolean(p.isDm);
            const canManage = Boolean(player.isDm);

            return (
              <div
                key={p._id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                  isCurrent
                    ? 'bg-surface-2/70 border-primary/40 shadow-sm'
                    : 'bg-surface-2 border-surface-3'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-surface-0 text-sm shrink-0 shadow-sm overflow-hidden"
                      style={{ backgroundColor: p.color || '#6366f1' }}
                    >
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.characterName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        p.characterName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-content-1 truncate">
                          {p.characterName}
                        </span>
                        {isDm ? (
                          <span className="px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-semibold rounded-md border border-primary/20 flex items-center gap-1 shrink-0">
                            <Crown size={10} /> Dungeon Master
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-medium rounded-md border border-blue-500/20 flex items-center gap-1 shrink-0">
                            <Shield size={10} /> Giocatore
                          </span>
                        )}
                        {/* Status Badge */}
                        {(p.status === 'inactive') && (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-medium rounded-md border border-amber-500/20 shrink-0">
                            Fuori Uso
                          </span>
                        )}
                        {(p.status === 'retired') && (
                          <span className="px-2 py-0.5 bg-surface-3 text-content-3 text-[10px] font-medium rounded-md border border-surface-3 shrink-0">
                            Ritirato
                          </span>
                        )}
                        {(p.status === 'dead') && (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-medium rounded-md border border-rose-500/20 shrink-0">
                            Caduto
                          </span>
                        )}
                        {(!p.status || p.status === 'active') && !isDm && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-medium rounded-md border border-emerald-500/20 shrink-0">
                            Attivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-content-3 font-mono mt-0.5 truncate">
                        {p.email || 'Nessuna email'}
                      </p>
                    </div>
                  </div>

                  {isCurrent && (
                    <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0 font-medium">
                      Il tuo Account
                    </span>
                  )}
                </div>

                {/* Status selector (for DM or own account) */}
                {(canManage || isCurrent) && (
                  <div className="pt-2 border-t border-surface-3/40 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-content-3">Stato nel Party:</span>
                    <select
                      value={p.status || 'active'}
                      onChange={(e) => handleStatusChange(p._id, e.target.value as PlayerPartyStatus)}
                      className="bg-surface-1 border border-surface-3 rounded-lg px-2.5 py-1 text-xs text-content-1 focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="active">🟢 Attivo nel Party</option>
                      <option value="inactive">🟡 Fuori Uso / Inattivo</option>
                      <option value="retired">⚪ Ritirato / Riserva</option>
                      <option value="dead">💀 Caduto in Battaglia</option>
                    </select>
                  </div>
                )}

                {/* Management Action Bar (Visible to DMs) */}
                {canManage && (
                  <div className="pt-2 border-t border-surface-3/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                    {!isCurrent ? (
                      <div className="flex items-center gap-1.5 flex-wrap w-full justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isDm ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePromoteToDm(p._id)}
                                className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                title="Conferisci il ruolo di Co-Dungeon Master a questo giocatore"
                              >
                                <Crown size={11} />
                                <span>Rendi Co-DM</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransferTargetPlayer(p)}
                                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                title="Cedi la guida principale della campagna a questo giocatore"
                              >
                                <ArrowRightLeft size={11} />
                                <span>Cedi Master</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevokeDm(p._id)}
                              className="px-2.5 py-1 bg-surface-3 hover:bg-surface-1 text-content-2 border border-surface-3 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              title="Rimuovi il ruolo di Dungeon Master (tornerà ad essere giocatore)"
                            >
                              <Shield size={11} />
                              <span>Rimuovi Ruolo DM</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={() => setRemoveTargetPlayer(p)}
                            className="p-1.5 text-content-3 hover:text-amber-400 hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Espelli partecipante dalla campagna"
                          >
                            <UserX size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetPlayer(p)}
                            className="p-1.5 text-content-3 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Elimina definitivamente l'account utente dal sistema"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Current user is DM: allow step-down if there's another DM
                      <div className="flex items-center justify-between w-full text-[11px] text-content-3">
                        <span>Sei un Dungeon Master di questa campagna</span>
                        {allPlayers.filter((x) => x.isDm).length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsSelfDemoteModalOpen(true)}
                            className="px-2 py-0.5 bg-surface-3 hover:bg-surface-1 text-content-2 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            Rinuncia al ruolo DM
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Wipe / Clean Database (MASTER ONLY) */}
      {player?.isDm && (
        <section className="bg-surface-1 border border-error/20 rounded-2xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3 border-b border-error/10 pb-4">
            <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center text-error">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-semibold text-error">
                  Area di Pulizia Dati (Solo Master)
                </h2>
                <span className="px-2 py-0.5 rounded bg-red-950/50 border border-red-800/40 text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                  Master
                </span>
              </div>
              <p className="text-xs text-content-3 mt-0.5">
                Svuota completamente i dati memorizzati in locale e nel Cloud per partire da una lavagna totalmente pulita.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <p className="text-xs text-content-3 max-w-lg leading-relaxed">
              Attenzione: questa azione cancellerà tutte le note, sessioni, mappe, capitoli ed entità registrate. Riservata al Dungeon Master.
            </p>
            <button
              type="button"
              onClick={() => setIsWipeModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-error/10 hover:bg-error/20 border border-error/30 text-error text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Svuota Database (Cloud &amp; Locale)</span>
            </button>
          </div>
        </section>
      )}

      {/* Svuota DB Confirm Modal */}
      {player?.isDm && (
        <ConfirmModal
          isOpen={isWipeModalOpen}
          title="Svuota Database Completo (Solo Master)"
          message="Sei sicuro di voler svuotare completamente il Database (Cloud Firestore & Locale)? Tutte le note, le sessioni, le mappe, i capitoli e gli account registrati verranno eliminati per partire da una lavagna totalmente vuota."
          confirmLabel={isWiping ? 'Svuotamento in corso...' : 'Svuota Tutto il DB'}
          onConfirm={async () => {
            if (!player?.isDm) return;
            setIsWiping(true);
            try {
              await CloudSyncService.wipeCloudCampaign();
              localStorage.clear();
              window.location.href = '/';
            } catch (e) {
              console.error(e);
              localStorage.clear();
              window.location.href = '/';
            }
          }}
          onCancel={() => !isWiping && setIsWipeModalOpen(false)}
        />
      )}

      {/* Delete Campaign Confirmation Modal (DM Only) */}
      <ConfirmModal
        isOpen={isDeleteCampModalOpen}
        title="Elimina Campagna Definitivamente (Solo Master)"
        message={`Sei sicuro di voler eliminare la campagna "${activeCampaign?.name || activeCampaignCode}" (${activeCampaignCode})? Tutti i dati associati (sessioni, note, codex, mappe, PNG) verranno rimossi permanentemente sia in locale che sul cloud per te e tutti i giocatori.`}
        confirmLabel={isDeletingCamp ? 'Eliminazione in corso...' : 'Elimina Campagna per Tutti'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleDeleteActiveCampaign}
        onCancel={() => !isDeletingCamp && setIsDeleteCampModalOpen(false)}
      />

      {/* Leave Campaign Confirmation Modal (Player) */}
      <ConfirmModal
        isOpen={isLeaveCampModalOpen}
        title="Abbandona Campagna"
        message={`Vuoi davvero abbandonare la campagna "${activeCampaign?.name || activeCampaignCode}" (${activeCampaignCode})? Verrà rimossa dal tuo elenco personale e il tuo personaggio non sarà più collegato ad essa. La campagna rimarrà attiva e intatta per il Dungeon Master e gli altri giocatori.`}
        confirmLabel={isLeavingCamp ? 'Uscita in corso...' : 'Abbandona Campagna'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleLeaveActiveCampaign}
        onCancel={() => !isLeavingCamp && setIsLeaveCampModalOpen(false)}
      />

      {/* Transfer Master Role Modal */}
      <ConfirmModal
        isOpen={Boolean(transferTargetPlayer)}
        title="Cedi il Ruolo di Dungeon Master"
        message={`Sei sicuro di voler cedere la guida della campagna a "${transferTargetPlayer?.characterName}" (${transferTargetPlayer?.email})? Questo utente diventerà il Dungeon Master di riferimento e tu continuerai a partecipare come normale giocatore.`}
        confirmLabel="Conferma e Cedi Master"
        cancelLabel="Annulla"
        onConfirm={handleTransferDmConfirm}
        onCancel={() => setTransferTargetPlayer(null)}
      />

      {/* Self Demote DM Role Modal */}
      <ConfirmModal
        isOpen={isSelfDemoteModalOpen}
        title="Rinuncia al Ruolo di Dungeon Master"
        message="Sei sicuro di voler rinunciare al ruolo di Dungeon Master in questa campagna? Diventerai un normale giocatore con accesso alla scheda e note personali/di gruppo."
        confirmLabel="Rinuncia a DM"
        cancelLabel="Annulla"
        onConfirm={handleSelfDemoteConfirm}
        onCancel={() => setIsSelfDemoteModalOpen(false)}
      />

      {/* Remove Player From Campaign Modal */}
      <ConfirmModal
        isOpen={Boolean(removeTargetPlayer)}
        title="Espelli Partecipante dalla Campagna"
        message={`Vuoi davvero espellere "${removeTargetPlayer?.characterName}" (${removeTargetPlayer?.email || 'Nessuna email'}) da questa campagna? L'utente non vedrà più questa campagna tra le sue campagne attive.`}
        confirmLabel="Espelli dalla Campagna"
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleRemovePlayerConfirm}
        onCancel={() => setRemoveTargetPlayer(null)}
      />

      {/* Delete User Account Permanently Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetPlayer)}
        title="Elimina Account Utente Definitivamente"
        message={`Vuoi davvero eliminare definitivamente l'account "${deleteTargetPlayer?.characterName}" (${deleteTargetPlayer?.email || 'Nessuna email'})? L'account verrà cancellato permanentemente da tutte le campagne e dal sistema.`}
        confirmLabel="Elimina Definitivamente"
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleDeleteAccountConfirm}
        onCancel={() => setDeleteTargetPlayer(null)}
      />

      {/* PWA Install Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Campaign Typography Modal */}
      {activeCampaign && (
        <CampaignTypographyModal
          isOpen={isTypographyModalOpen}
          onClose={() => setIsTypographyModalOpen(false)}
          campaign={activeCampaign}
          onSaved={(updated) => {
            setAllCampaigns(CampaignManager.getCampaigns());
          }}
        />
      )}

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
            // target === 'party'
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
    </div>
  );
}
