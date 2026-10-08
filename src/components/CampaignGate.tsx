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
  QrCode,
  Share2,
} from 'lucide-react';
import { CampaignManager } from '../store/campaignStore';
import { useAuth } from './AuthProvider';
import { CampaignMeta, CampaignProfile } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { CampaignInviteModal } from './CampaignInviteModal';
import { hasUserSavedTheme, getStoredTheme } from '../lib/theme';
import { LegalModal, LegalTab } from './legal/LegalModal';

const PG_COLOR_PRESETS = [
  { name: 'Indaco Arcano', hex: '#6366f1' },
  { name: 'Oro Antico', hex: '#D4AF37' },
  { name: 'Smeraldo Silvano', hex: '#10b981' },
  { name: 'Rubino di Sangue', hex: '#ef4444' },
  { name: 'Ametista d’Ombra', hex: '#a855f7' },
  { name: 'Ambra Solare', hex: '#f59e0b' },
  { name: 'Ciano Celestiale', hex: '#06b6d4' },
  { name: 'Ferro & Ossidiana', hex: '#64748b' },
];

function extractCampaignCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  try {
    if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const codeFromParam =
        url.searchParams.get('join') ||
        url.searchParams.get('campaign') ||
        url.searchParams.get('code');
      if (codeFromParam) return codeFromParam.trim().toUpperCase();
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last && last.length >= 3 && !['join', 'campaign'].includes(last.toLowerCase())) {
          return last.trim().toUpperCase();
        }
      }
    }
  } catch {}
  return trimmed.toUpperCase().replace(/\s/g, '');
}

interface CampaignGateProps {
  onEnter: (campaignCode: string) => void;
}

export function CampaignGate({ onEnter }: CampaignGateProps) {
  const { logout, account, refreshAccount } = useAuth();

  // Campaign State
  const [myCampaigns, setMyCampaigns] = useState<CampaignMeta[]>(() => {
    const acc = account || CampaignManager.getCurrentAccount();
    if (!acc) return [];
    const all = CampaignManager.getCampaigns();
    const expelledCodes = new Set(
      all.filter((c) => c.expelledAccountIds?.includes(acc.id)).map((c) => c.code.toUpperCase())
    );
    const joined = (acc.joinedCampaigns || []).filter((c) => !expelledCodes.has(c.toUpperCase()));
    const dmList = (acc.dmCampaigns || []).filter((c) => !expelledCodes.has(c.toUpperCase()));
    const profileCodes = Object.keys(acc.campaignProfiles || {}).filter((c) => !expelledCodes.has(c.toUpperCase()));
    const validCodesSet = new Set([
      ...joined.map((c) => c.toUpperCase()),
      ...dmList.map((c) => c.toUpperCase()),
      ...profileCodes.map((c) => c.toUpperCase()),
    ]);
    const campMap = new Map<string, CampaignMeta>();
    const userEmail = (acc.email || '').toLowerCase().trim();
    all.forEach((c) => {
      if (c && c.code && !expelledCodes.has(c.code.toUpperCase())) {
        const clean = c.code.toUpperCase();
        const cDmEmail = (c.dmEmail || '').toLowerCase().trim();
        const isUserDm = c.dmId === acc.id || (cDmEmail && userEmail && cDmEmail === userEmail);
        const isUserActivePlayer = Array.isArray((c as any).activePlayerEmails) && (c as any).activePlayerEmails.includes(userEmail);
        if (validCodesSet.has(clean) || isUserDm || isUserActivePlayer) {
          campMap.set(clean, c);
        }
      }
    });
    return Array.from(campMap.values());
  });

  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  // Join by Link or Code State
  const [joinCode, setJoinCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoinInputOpen, setIsJoinInputOpen] = useState(false);

  // Create Campaign Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCampName, setNewCampName] = useState('');
  const [newCampCode, setNewCampCode] = useState('');
  const [isCreateAsDm, setIsCreateAsDm] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Invite Modal State (QR & Link)
  const [inviteCampaign, setInviteCampaign] = useState<CampaignMeta | null>(null);

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

  // Legal / Privacy / Cookie Modal State
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');

  const handleOpenLegal = (tab: LegalTab = 'privacy') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  const reloadCampaignList = async (forceShowLoading = false) => {
    if (!account) {
      setIsLoadingCampaigns(false);
      return;
    }

    if (forceShowLoading || myCampaigns.length === 0) {
      setIsLoadingCampaigns(true);
    }

    try {
      let allCamp = CampaignManager.getCampaigns();

      if (isSupabaseConfigured()) {
        try {
          const [remoteCamps, userCamps] = await Promise.all([
            SupabaseSyncService.fetchAllCampaigns(),
            SupabaseSyncService.getUserCampaigns(account.id, account.email),
          ]);
          if (remoteCamps && Array.isArray(remoteCamps)) {
            // When Supabase is connected, database campaigns are authoritative
            const remoteMap = new Map<string, CampaignMeta>();
            remoteCamps.forEach((rc) => {
              if (rc && rc.code) {
                const clean = rc.code.toUpperCase();
                const existingLocal = allCamp.find((l) => l.code.toUpperCase() === clean);
                const dmIsPlayer = rc.dmIsPlayer !== undefined ? rc.dmIsPlayer : existingLocal?.dmIsPlayer;
                remoteMap.set(clean, {
                  code: clean,
                  name: rc.name || rc.title || existingLocal?.name || clean,
                  createdAt: rc.createdAt || rc.created_at || existingLocal?.createdAt || new Date().toISOString(),
                  dmId: rc.dmId || rc.dm_id || existingLocal?.dmId,
                  dmEmail: rc.dmEmail || existingLocal?.dmEmail,
                  dmName: rc.dmName || existingLocal?.dmName,
                  dmIsPlayer: dmIsPlayer,
                  activePlayerEmails: rc.activePlayerEmails || (existingLocal as any)?.activePlayerEmails || [],
                  expelledAccountIds: rc.expelledAccountIds || existingLocal?.expelledAccountIds || [],
                });
                if (dmIsPlayer !== undefined && typeof window !== 'undefined') {
                  localStorage.setItem(`chronicle_${clean}_dm_is_player`, String(dmIsPlayer));
                }
              }
            });
            // Update local store: remove any obsolete campaigns that no longer exist in Supabase
            allCamp = Array.from(remoteMap.values());
            CampaignManager.saveCampaignsLocalOnly(allCamp);
          }

          if (userCamps) {
            let userUpdated = false;
            if (Array.isArray(userCamps.joinedCampaigns) && userCamps.joinedCampaigns.length > 0) {
              const mergedJoined = Array.from(new Set([...(account.joinedCampaigns || []), ...userCamps.joinedCampaigns]));
              if (mergedJoined.length !== (account.joinedCampaigns || []).length) {
                account.joinedCampaigns = mergedJoined;
                userUpdated = true;
              }
            }
            if (Array.isArray(userCamps.dmCampaigns) && userCamps.dmCampaigns.length > 0) {
              const mergedDm = Array.from(new Set([...(account.dmCampaigns || []), ...userCamps.dmCampaigns]));
              if (mergedDm.length !== (account.dmCampaigns || []).length) {
                account.dmCampaigns = mergedDm;
                userUpdated = true;
              }
            }
            if (userUpdated) {
              CampaignManager.saveAccountLocalOnly(account);
            }
          }
        } catch (e) {
          console.warn('Error fetching remote campaigns:', e);
        }
      }

      const existingCodes = new Set(allCamp.map((c) => c.code.toUpperCase()));
      const expelledCodes = new Set(
        allCamp
          .filter((c) => c.expelledAccountIds?.includes(account.id))
          .map((c) => c.code.toUpperCase())
      );

      // Clean up orphaned campaign references from current user account
      let accountModified = false;
      const cleanedJoined = (account.joinedCampaigns || []).filter(
        (c) => existingCodes.has(c.toUpperCase()) && !expelledCodes.has(c.toUpperCase())
      );
      if (cleanedJoined.length !== (account.joinedCampaigns || []).length) {
        account.joinedCampaigns = cleanedJoined;
        accountModified = true;
      }

      const cleanedDm = (account.dmCampaigns || []).filter(
        (c) => existingCodes.has(c.toUpperCase()) && !expelledCodes.has(c.toUpperCase())
      );
      if (cleanedDm.length !== (account.dmCampaigns || []).length) {
        account.dmCampaigns = cleanedDm;
        accountModified = true;
      }

      if (account.campaignProfiles) {
        const cleanedProfiles: Record<string, any> = {};
        for (const [codeKey, prof] of Object.entries(account.campaignProfiles)) {
          if (existingCodes.has(codeKey.toUpperCase()) && !expelledCodes.has(codeKey.toUpperCase())) {
            cleanedProfiles[codeKey] = prof;
          } else {
            accountModified = true;
          }
        }
        if (accountModified) {
          account.campaignProfiles = cleanedProfiles;
        }
      }

      if (accountModified) {
        CampaignManager.saveAccountLocalOnly(account);
      }

      const userEmail = (account.email || '').toLowerCase().trim();
      const validCodesSet = new Set([
        ...(account.joinedCampaigns || []).map((c) => c.toUpperCase()),
        ...(account.dmCampaigns || []).map((c) => c.toUpperCase()),
        ...Object.keys(account.campaignProfiles || {}).map((c) => c.toUpperCase()),
      ]);

      const campMap = new Map<string, CampaignMeta>();
      allCamp.forEach((c) => {
        if (c && c.code && !expelledCodes.has(c.code.toUpperCase())) {
          const clean = c.code.toUpperCase();
          const cDmEmail = (c.dmEmail || '').toLowerCase().trim();
          const isUserDm = c.dmId === account.id || (cDmEmail && userEmail && cDmEmail === userEmail);
          const isUserActivePlayer = Array.isArray((c as any).activePlayerEmails) && (c as any).activePlayerEmails.includes(userEmail);

          // Only display campaigns the user is actually DM of or member of
          if (validCodesSet.has(clean) || isUserDm || isUserActivePlayer) {
            campMap.set(clean, c);
          }
        }
      });

      // Do NOT synthesize fake ghost campaigns for missing codes
      setMyCampaigns(Array.from(campMap.values()));
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    reloadCampaignList();

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const pending =
        searchParams.get('join') ||
        searchParams.get('campaign') ||
        hashParams.get('join') ||
        localStorage.getItem('chronicle_pending_join_code');

      if (pending) {
        const code = extractCampaignCode(pending);
        if (code) {
          setJoinCode(code);
          localStorage.removeItem('chronicle_pending_join_code');
        }
      }
    } catch {}

    const handleUpdate = () => {
      reloadCampaignList();
    };
    window.addEventListener('chronicle_campaigns_updated', handleUpdate);
    window.addEventListener('chronicle_accounts_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_campaigns_updated', handleUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleUpdate);
    };
  }, [account?.id, account?.email, account?.joinedCampaigns?.length, account?.dmCampaigns?.length]);

  const isDmOf = (camp: CampaignMeta) => {
    if (!account) return false;
    const cleanCode = camp.code.toUpperCase();
    if (account.dmCampaigns?.some((code) => code.toUpperCase() === cleanCode)) {
      return true;
    }
    if (camp.dmId && camp.dmId === account.id) return true;
    const userEmail = (account.email || '').toLowerCase().trim();
    const campDmEmail = (camp.dmEmail || '').toLowerCase().trim();
    if (campDmEmail && userEmail && campDmEmail === userEmail) return true;
    const member = CampaignManager.getCampaignMember(cleanCode, account.id, account.email);
    if (member && (member.role === 'dm' || member.role === 'co-dm' || member.role === 'comaster')) return true;
    const profile = account.campaignProfiles?.[cleanCode];
    if (profile && (profile.isCoDm || profile.isCoMaster || profile.tags?.includes('Co-Master'))) return true;
    return false;
  };

  const getProfileForCampaign = (code: string): CampaignProfile | null => {
    if (!account) return null;
    const clean = code.toUpperCase();
    if (account.campaignProfiles && account.campaignProfiles[clean]) {
      return account.campaignProfiles[clean];
    }
    // Also check if account is already marked as joined
    const isJoined = account.joinedCampaigns?.some((c) => c.toUpperCase() === clean);
    // Also check character_bios
    const bio = CampaignManager.getCharacterBio(account.id);
    if (bio && (bio.characterName || bio.name)) {
      return {
        characterName: bio.characterName || bio.name || account.characterName,
        avatarUrl: bio.avatarUrl || account.avatarUrl,
        color: bio.color || account.color,
      };
    }
    if (isJoined && account.characterName) {
      return {
        characterName: account.characterName,
        avatarUrl: account.avatarUrl,
        color: account.color,
      };
    }
    return null;
  };

  const handleOpenCreateModal = () => {
    const freshCode = CampaignManager.generateCampaignCode(newCampName);
    setNewCampCode(freshCode);
    setIsCreateAsDm(true);
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
    const cleanCode = extractCampaignCode(joinCode);

    if (!cleanCode) {
      setJoinError('Inserisci o incolla un link d’invito o un codice campagna valido.');
      return;
    }

    setIsSearching(true);
    try {
      const allCamp = CampaignManager.getCampaigns();
      let existing = allCamp.find((c) => c.code.toUpperCase() === cleanCode.toUpperCase());

      if (!existing && isSupabaseConfigured()) {
        try {
          const supaData = await SupabaseSyncService.fetchCampaignMeta(cleanCode);
          if (supaData) {
            existing = CampaignManager.createCampaign(
              cleanCode,
              supaData.name || `Campagna ${cleanCode}`,
              null,
              {
                dmId: supaData.dmId,
                dmEmail: supaData.dmEmail,
                dmName: supaData.dmName,
                dmIsPlayer: supaData.dmIsPlayer,
                expelledAccountIds: supaData.expelledAccountIds,
              }
            );
            const dmIsPlayer = supaData.dmIsPlayer !== undefined ? Boolean(supaData.dmIsPlayer) : undefined;
            if (dmIsPlayer !== undefined) {
              existing.dmIsPlayer = dmIsPlayer;
              CampaignManager.updateCampaignMeta(cleanCode, { dmIsPlayer });
              if (typeof window !== 'undefined') {
                localStorage.setItem(`chronicle_${cleanCode}_dm_is_player`, String(dmIsPlayer));
              }
            }
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

      const isDm = isDmOf(existing);
      const existingProfile = getProfileForCampaign(cleanCode);

      if (isDm || (existingProfile && existingProfile.characterName?.trim())) {
        if (account) {
          CampaignManager.joinCampaign(account.id, cleanCode);
          refreshAccount();
        }
        CampaignManager.setActiveCampaignCode(cleanCode);
        onEnter(cleanCode);
      } else {
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

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
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

    if (isSupabaseConfigured()) {
      try {
        const alreadyExistsOnCloud = await SupabaseSyncService.hasCampaign(cleanCode);
        if (alreadyExistsOnCloud) {
          setCreateError('Questo codice è già in uso da un altro tavolo su Cloud. Clicca su "Rigenera" per ottenerne uno nuovo.');
          return;
        }
      } catch (err) {
        console.warn('Verifica esistenza campagna cloud fallita:', err);
      }
    }

    const newCamp = CampaignManager.createCampaign(
      cleanCode,
      cleanName,
      isCreateAsDm ? account : null,
    );

    if (isSupabaseConfigured()) {
      try {
        await SupabaseSyncService.saveCampaign(cleanCode, {
          title: cleanName,
          dmId: isCreateAsDm ? (account?.id || '') : '',
          dmName: isCreateAsDm ? (account?.characterName || account?.email?.split('@')[0] || 'Dungeon Master') : '',
          dmEmail: isCreateAsDm ? (account?.email || '') : '',
        });
      } catch (e) {
        console.warn('Errore salvataggio campagna su cloud:', e);
      }
    }

    if (account) {
      if (isCreateAsDm) {
        CampaignManager.makeDmOfCampaign(account.id, cleanCode);
      }
      CampaignManager.joinCampaign(account.id, cleanCode);
      refreshAccount();
    }

    setIsCreateModalOpen(false);

    if (isCreateAsDm) {
      CampaignManager.setActiveCampaignCode(cleanCode);
      onEnter(cleanCode);
    } else {
      // Created as player: open PG modal to configure character
      handleOpenPgModal(newCamp, false);
    }
  };

  const handleSelectCampaign = (camp: CampaignMeta) => {
    const isDm = isDmOf(camp);
    const profile = getProfileForCampaign(camp.code);

    if (!isDm && (!profile || !profile.characterName?.trim())) {
      handleOpenPgModal(camp, false);
      return;
    }

    if (account) {
      CampaignManager.joinCampaign(account.id, camp.code);
      refreshAccount();
    }
    CampaignManager.setActiveCampaignCode(camp.code);
    onEnter(camp.code);
  };

  const handleCopyCode = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const handleDeleteCampaignConfirm = async () => {
    if (!campaignToDelete) return;
    setIsDeletingCampaign(true);
    try {
      await CampaignManager.deleteCampaign(campaignToDelete.code, account?.id);
      refreshAccount();
      setCampaignToDelete(null);
      await reloadCampaignList(true);
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
      refreshAccount();
      setCampaignToLeave(null);
      await reloadCampaignList(true);
    } catch (err) {
      console.error('Errore durante l\'uscita dalla campagna:', err);
    } finally {
      setIsLeavingCampaign(false);
    }
  };

  // UNIFIED THEME-AWARE PALETTE
  const userHasCustomTheme = hasUserSavedTheme();
  const activeTheme = getStoredTheme();

  const palette = userHasCustomTheme
    ? {
        accent: activeTheme.colors.primary,
        accentHover: activeTheme.colors.primaryHover,
        accentMuted: activeTheme.colors.primaryMuted,
        accentDark: activeTheme.accentColor || activeTheme.colors.primary,
        glow: activeTheme.accentColor || activeTheme.colors.primary,
        dotColor: `${activeTheme.colors.primary}25`,
        borderHeader: `${activeTheme.colors.primary}2c`,
        borderCard: `${activeTheme.colors.primary}38`,
        borderSubtle: `${activeTheme.colors.primary}18`,
        bgBase: '#070709',
        bgCard: '#0c0b0f',
        bgInput: '#131118',
        bgModal: '#0c0b0f',
        textMain: '#f3ebd9',
        textSub: '#b8a994',
        textMuted: '#958876',
        fleuron: `${activeTheme.colors.primary}50`,
      }
    : {
        accent: '#d4af37',
        accentHover: '#f3cf55',
        accentMuted: 'rgba(212, 175, 55, 0.15)',
        accentDark: '#a38043',
        glow: '#966d28',
        dotColor: 'rgba(212, 175, 55, 0.15)',
        borderHeader: '#2a241b',
        borderCard: '#342b1f',
        borderSubtle: '#231d14',
        bgBase: '#070709',
        bgCard: '#0c0b0f',
        bgInput: '#16131a',
        bgModal: '#0c0b0f',
        textMain: '#f3ebd9',
        textSub: '#b8a994',
        textMuted: '#8c7b64',
        fleuron: 'rgba(163, 128, 67, 0.35)',
      };

  return (
    <div
      className="min-h-screen w-full text-[#e8e1d5] relative flex flex-col justify-between"
      style={{
        backgroundColor: palette.bgBase,
        fontFamily: "'Newsreader', 'Lora', Georgia, serif",
      }}
    >
      {/* Background Subtle Grimoire Grain dynamically tinted */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(${palette.dotColor} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Atmospheric Altar Glows (dynamically tinted with user's theme if chosen) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[180px] transition-colors duration-700"
          style={{ backgroundColor: `${palette.glow}18` }}
        />
        <div
          className="absolute top-[40%] -right-32 w-[600px] h-[600px] rounded-full blur-[200px] transition-colors duration-700"
          style={{ backgroundColor: `${palette.glow}10` }}
        />
      </div>

      {/* Top Header: Brand on left, User Badge and Logout on right */}
      <header
        className="relative z-20 border-b backdrop-blur-md"
        style={{
          borderColor: palette.borderHeader,
          backgroundColor: `${palette.bgBase}d9`,
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-12 h-16 sm:h-20 flex justify-between items-center w-full gap-2">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className="text-lg sm:text-2xl font-normal tracking-[0.15em] sm:tracking-[0.2em] uppercase transition-colors"
              style={{
                fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
                color: palette.accent,
              }}
            >
              Chronicle
            </span>
            <span
              className="hidden md:inline text-xs italic tracking-widest pl-3 border-l"
              style={{
                color: palette.textMuted,
                borderColor: palette.borderHeader,
              }}
            >
              Tavolo delle Campagne
            </span>
          </div>

          {/* User Account and Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            {/* Truncated User Email Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-mono shadow-xs max-w-[120px] xs:max-w-[180px] sm:max-w-xs transition-colors shrink min-w-0 overflow-hidden"
              style={{
                backgroundColor: palette.bgInput,
                borderColor: palette.borderCard,
                color: palette.textSub,
              }}
              title={account?.email}
            >
              <User size={13} className="shrink-0 text-amber-400/90" />
              <span className="truncate">{account?.email}</span>
            </div>

            {/* Logout Button */}
            <button
              id="btn-logout"
              onClick={() => logout()}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/40 bg-red-950/20 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl border border-red-900/50 text-[11px] sm:text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm active:scale-95"
              title="Disconnetti account"
            >
              <LogOut size={13} className="shrink-0" />
              <span className="hidden xs:inline">Disconnetti</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Campaign Hub */}
      <main className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 py-12 relative z-10 flex-1">
        {/* Page Title & Action Bar */}
        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 mb-10 border-b"
          style={{ borderColor: palette.borderHeader }}
        >
          <div className="space-y-2 text-left">
            <p
              className="text-xs tracking-[0.3em] uppercase transition-colors"
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                color: palette.accent,
              }}
            >
              ✦ &nbsp; Liber Campagnarum &nbsp; · &nbsp; I Tomi Attivi
            </p>
            <h1
              className="text-3xl sm:text-5xl tracking-[0.06em] font-normal"
              style={{
                fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
                color: palette.textMain,
              }}
            >
              Il Tavolo delle Cronache
            </h1>
            <p
              className="text-sm sm:text-base font-light italic max-w-2xl"
              style={{ color: palette.textSub }}
            >
              Seleziona un tomo per entrare nella cronaca del tuo party, consulta i tuoi compagni d’avventura o forgia una nuova saga.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isJoinInputOpen ? (
              <form
                onSubmit={handleJoinCampaign}
                className="inline-flex items-center gap-2 p-1.5 rounded-xl border shadow-lg animate-fade-in"
                style={{
                  backgroundColor: palette.bgInput,
                  borderColor: palette.accent,
                }}
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Codice o Link (es. WATERDEEP)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="bg-transparent px-3 py-1.5 text-xs outline-none font-mono tracking-wider w-44 sm:w-60"
                  style={{ color: palette.textMain }}
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim() || isSearching}
                  className="px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wider font-semibold border flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    backgroundColor: palette.accentMuted,
                    borderColor: palette.accent,
                    color: palette.accent,
                  }}
                >
                  {isSearching ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                  <span>Entra</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsJoinInputOpen(false);
                    setJoinCode('');
                    setJoinError(null);
                  }}
                  className="p-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ color: palette.textMuted }}
                  title="Annulla"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsJoinInputOpen(true);
                  setJoinError(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-3 text-xs tracking-[0.1em] uppercase rounded-xl transition-all shadow-md active:scale-95 cursor-pointer border hover:border-[#d4af37]"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderCard,
                  color: palette.textMain,
                }}
                title="Inserisci un codice invito o link per unirti al party"
              >
                <QrCode size={15} style={{ color: palette.accent }} />
                <span>Inserisci Codice Invito</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => reloadCampaignList(true)}
              disabled={isLoadingCampaigns}
              className="p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-50 hover:border-[#d4af37]"
              style={{
                backgroundColor: palette.bgInput,
                borderColor: palette.borderCard,
                color: palette.textMuted,
              }}
              title="Aggiorna elenco campagne"
            >
              <RefreshCw
                size={15}
                className={isLoadingCampaigns ? 'animate-spin' : ''}
                style={{ color: palette.accent }}
              />
            </button>

            <button
              id="btn-open-create-modal"
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-3 text-white font-semibold text-xs tracking-[0.15em] uppercase rounded-xl transition-all shadow-xl active:scale-95 cursor-pointer border"
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                backgroundColor: palette.bgInput,
                borderColor: `${palette.accent}70`,
              }}
            >
              <Crown size={15} style={{ color: palette.accent }} />
              <span>Forgia Nuova Campagna</span>
            </button>
          </div>
        </div>

        {isJoinInputOpen && joinError && (
          <div className="mb-6 -mt-6 flex justify-end">
            <div className="p-2.5 bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-center gap-2 italic rounded-lg">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <span>{joinError}</span>
            </div>
          </div>
        )}

        {/* ================= SECTION 1: LE TUE CAMPAGNE (GRID OF TOMES) ================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2
              className="text-xs uppercase tracking-[0.25em] flex items-center gap-2 font-medium transition-colors"
              style={{ fontFamily: "'Cinzel', Georgia, serif", color: palette.accent }}
            >
              <BookOpen size={14} />
              <span>I Tuoi Tomi Registrati ({myCampaigns.length})</span>
            </h2>
            {isLoadingCampaigns && (
              <span
                className="text-[11px] font-mono flex items-center gap-1.5 animate-pulse"
                style={{ color: palette.accentDark }}
              >
                <Loader2 size={12} className="animate-spin" />
                <span>Sincronizzazione in corso...</span>
              </span>
            )}
          </div>

          {isLoadingCampaigns && myCampaigns.length === 0 ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((sk) => (
                <div
                  key={sk}
                  className="p-7 border animate-pulse space-y-4 rounded-xl"
                  style={{
                    backgroundColor: palette.bgCard,
                    borderColor: palette.borderHeader,
                  }}
                >
                  <div className="h-4 w-28 bg-white/5 rounded" />
                  <div className="h-6 w-48 bg-white/10 rounded" />
                  <div className="h-4 w-32 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : myCampaigns.length === 0 ? (
            /* Empty State */
            <div
              className="p-12 border border-dashed text-center max-w-xl mx-auto space-y-4 my-8 rounded-xl"
              style={{
                backgroundColor: palette.bgCard,
                borderColor: palette.borderCard,
              }}
            >
              <div
                className="w-14 h-14 mx-auto rounded-full border flex items-center justify-center shadow-sm"
                style={{
                  borderColor: palette.borderCard,
                  color: palette.accent,
                }}
              >
                <BookOpen size={24} strokeWidth={1.3} />
              </div>
              <h3
                className="text-xl font-normal"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  color: palette.textMain,
                }}
              >
                Nessun Tomo Aperto
              </h3>
              <p
                className="text-xs sm:text-sm italic leading-relaxed"
                style={{ color: palette.textMuted }}
              >
                Non appartieni ancora ad alcuna campagna. Forgia una nuova saga come Dungeon Master oppure inserisci qui sotto il codice inviato dal tuo Master per registrare il tuo personaggio.
              </p>
            </div>
          ) : (
            /* Rich Responsive Grid of Grimoires */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {myCampaigns.map((camp) => {
                const isDm = isDmOf(camp);
                const profile = getProfileForCampaign(camp.code);
                const hasProfile = Boolean(profile?.characterName?.trim());
                const isDmAndPlayer = isDm && (
                  Boolean(camp.dmIsPlayer) ||
                  CampaignManager.isDmPlayerCampaign(camp.code) ||
                  hasProfile ||
                  (account?.joinedCampaigns || []).some((code) => code.toUpperCase() === camp.code.toUpperCase())
                );

                return (
                  <div
                    key={camp.code}
                    onClick={() => handleSelectCampaign(camp)}
                    className="p-6 sm:p-7 border transition-all duration-300 shadow-xl group flex flex-col justify-between cursor-pointer relative rounded-xl"
                    style={{
                      backgroundColor: palette.bgCard,
                      borderColor: palette.borderCard,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = palette.accent;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 30px ${palette.accent}18`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = palette.borderCard;
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    {/* Corner Fleurons */}
                    <div
                      className="absolute top-1.5 left-1.5 text-xs select-none"
                      style={{ color: palette.fleuron }}
                    >
                      ⌜
                    </div>
                    <div
                      className="absolute top-1.5 right-1.5 text-xs select-none"
                      style={{ color: palette.fleuron }}
                    >
                      ⌝
                    </div>
                    <div
                      className="absolute bottom-1.5 left-1.5 text-xs select-none"
                      style={{ color: palette.fleuron }}
                    >
                      ⌞
                    </div>
                    <div
                      className="absolute bottom-1.5 right-1.5 text-xs select-none"
                      style={{ color: palette.fleuron }}
                    >
                      ⌟
                    </div>

                    <div>
                      {/* Top Role Badge & Code Copy */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        {isDmAndPlayer ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-wider font-semibold uppercase rounded"
                            style={{
                              fontFamily: "'Cinzel', Georgia, serif",
                              color: palette.accent,
                              backgroundColor: palette.accentMuted,
                              borderColor: `${palette.accent}45`,
                              borderWidth: '1px',
                            }}
                          >
                            <Crown size={12} /> DM / Giocatore
                          </span>
                        ) : isDm ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-wider font-semibold uppercase rounded"
                            style={{
                              fontFamily: "'Cinzel', Georgia, serif",
                              color: palette.accent,
                              backgroundColor: palette.accentMuted,
                              borderColor: `${palette.accent}45`,
                              borderWidth: '1px',
                            }}
                          >
                            <Crown size={12} /> Dungeon Master
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-wider font-semibold text-[#8da5be] bg-[#8da5be]/10 border border-[#8da5be]/30 uppercase rounded"
                            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                          >
                            <Shield size={12} /> Giocatore
                          </span>
                        )}

                        {/* Quick Code Badge */}
                        <div
                          onClick={(e) => handleCopyCode(e, camp.code)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition-colors cursor-pointer select-none"
                          style={{
                            backgroundColor: palette.bgInput,
                            borderColor: palette.borderCard,
                            color: palette.textSub,
                          }}
                          title="Copia codice campagna"
                        >
                          <span>{camp.code}</span>
                          {copiedCode === camp.code ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} style={{ color: palette.accent }} />
                          )}
                        </div>
                      </div>

                      {/* Campaign Title */}
                      <h3
                        className="text-xl sm:text-2xl transition-colors leading-tight font-normal mb-3"
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          color: palette.textMain,
                        }}
                      >
                        {camp.name}
                      </h3>

                      {/* Character PG Profile in this campaign */}
                      {(!isDm || isDmAndPlayer || hasProfile) && (
                        <div
                          className="my-3 p-3 rounded-lg border text-xs"
                          style={{
                            backgroundColor: palette.bgInput,
                            borderColor: palette.borderSubtle,
                          }}
                        >
                          {hasProfile ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: profile?.color || palette.accent }}
                                />
                                <span className="text-xs" style={{ color: palette.textSub }}>
                                  PG: <strong style={{ color: palette.textMain }}>{profile?.characterName}</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPgModal(camp, true);
                                }}
                                title="Modifica il tuo PG in questa campagna"
                                className="p-1 transition-colors cursor-pointer"
                                style={{ color: palette.textMuted }}
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPgModal(camp, false);
                              }}
                              className="flex items-center gap-1.5 text-xs italic cursor-pointer"
                              style={{ color: palette.accent }}
                            >
                              <AlertCircle size={13} />
                              <span>Clicca per creare il tuo Personaggio</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Row: Actions & Open Button */}
                    <div
                      className="pt-4 mt-6 border-t flex items-center justify-between gap-2"
                      style={{ borderColor: palette.borderSubtle }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Invite & QR */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInviteCampaign(camp);
                          }}
                          className="px-2.5 py-1.5 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          style={{
                            backgroundColor: palette.bgInput,
                            borderColor: palette.borderCard,
                            color: palette.textSub,
                          }}
                          title="Condividi codice & QR con il party"
                        >
                          <QrCode size={13} style={{ color: palette.accent }} />
                          <span className="hidden sm:inline text-[11px] font-mono">Invito</span>
                        </button>

                        {/* Delete or Leave */}
                        {isDm ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToDelete(camp);
                            }}
                            className="p-1.5 text-[#6e604d] hover:text-red-400 transition-colors cursor-pointer"
                            title="Elimina definitivamente campagna (Solo Master)"
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
                            className="p-1.5 text-[#6e604d] hover:text-red-400 transition-colors cursor-pointer"
                            title="Abbandona campagna"
                          >
                            <LogOut size={13} />
                          </button>
                        )}
                      </div>

                      {/* Enter Tomo CTA */}
                      <div
                        className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] transition-colors"
                        style={{
                          fontFamily: "'Cinzel', Georgia, serif",
                          color: palette.accent,
                        }}
                      >
                        <span>Apri Tomo</span>
                        <ChevronRight size={15} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= SECTION 2: UNISCITI CON LINK O CODICE (FULLY THEMED) ================= */}
        <div
          className="mt-16 pt-12 border-t max-w-2xl mx-auto text-left"
          style={{ borderColor: palette.borderHeader }}
        >
          <div
            className="p-8 border shadow-xl relative space-y-4 rounded-2xl"
            style={{
              backgroundColor: palette.bgCard,
              borderColor: palette.borderCard,
            }}
          >
            <div className="flex items-center gap-2.5" style={{ color: palette.accent }}>
              <QrCode size={17} />
              <h2
                className="text-base font-normal uppercase tracking-wider"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  color: palette.textMain,
                }}
              >
                Unisciti a un Party Esistente
              </h2>
            </div>

            <p
              className="text-xs sm:text-sm italic leading-relaxed"
              style={{ color: palette.textMuted }}
            >
              Hai ricevuto un link d'invito o un codice dal tuo Dungeon Master? Incolla qui il codice per registrare il tuo personaggio nel compendio di quel tavolo.
            </p>

            {joinError && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-center gap-2 italic rounded-lg">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinCampaign} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                id="input-join-code"
                type="text"
                placeholder="Incolla Link o Codice (es. WATERDEEP)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 rounded-xl px-4 py-3 text-xs outline-none font-mono tracking-wider transition-colors border"
                style={{
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderCard,
                  color: palette.textMain,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = palette.accent;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = palette.borderCard;
                }}
              />
              <button
                id="btn-submit-join"
                type="submit"
                disabled={!joinCode.trim() || isSearching}
                className="px-6 py-3 border text-xs uppercase tracking-[0.15em] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg active:scale-95"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  backgroundColor: palette.bgInput,
                  borderColor: palette.accent,
                  color: palette.textMain,
                }}
              >
                {isSearching ? (
                  <>
                    <Loader2 size={14} className="animate-spin" style={{ color: palette.accent }} />
                    <span>Verifica...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={14} style={{ color: palette.accent }} />
                    <span>Entra nel Party</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ================= SECTION 3: ACCOUNT PROFILE & LOGOUT CARD ================= */}
        <div className="mt-12 pt-8 border-t max-w-2xl mx-auto text-left" style={{ borderColor: palette.borderHeader }}>
          <div
            className="p-5 sm:p-6 rounded-2xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              backgroundColor: palette.bgCard,
              borderColor: palette.borderCard,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-bold text-sm shadow-xs"
                style={{
                  backgroundColor: palette.accentMuted,
                  borderColor: `${palette.accent}40`,
                  color: palette.accent,
                }}
              >
                <User size={20} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: palette.textMain }}>
                    Account Connesso
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Sincronizzato" />
                </div>
                <p className="text-xs font-mono truncate" style={{ color: palette.textSub }}>
                  {account?.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-900/50 bg-red-950/20 hover:bg-red-950/50 text-red-300 text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm active:scale-95"
            >
              <LogOut size={14} />
              <span>Disconnetti Account</span>
            </button>
          </div>
        </div>
      </main>

      {/* ================= MODAL: CONFIGURA PERSONAGGIO (PG) ================= */}
      {isPgModalOpen && targetCampaign && (
        <div className="fixed inset-0 z-50 bg-[#050406]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="border rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative"
            style={{
              backgroundColor: palette.bgModal,
              borderColor: palette.borderCard,
            }}
          >
            <button
              type="button"
              onClick={() => setIsPgModalOpen(false)}
              className="absolute top-5 right-5 p-1 transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-[#070709] font-bold text-base shadow-md font-cinzel"
                style={{ backgroundColor: pgColor }}
              >
                {pgCharacterName?.trim() ? pgCharacterName.trim().charAt(0).toUpperCase() : <Shield size={20} />}
              </div>
              <div>
                <h3
                  className="text-lg font-normal"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textMain,
                  }}
                >
                  {isEditModeOnly ? 'Modifica Personaggio' : 'Crea il tuo Personaggio'}
                </h3>
                <span className="text-xs font-mono" style={{ color: palette.accent }}>
                  Campagna: {targetCampaign.name}
                </span>
              </div>
            </div>

            <p className="text-xs italic mb-5 leading-relaxed" style={{ color: palette.textMuted }}>
              Come si chiama il tuo eroe in questa campagna? Ogni campagna in cui giochi può avere un personaggio diverso.
            </p>

            {pgError && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-center gap-2 mb-4 italic rounded-lg">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{pgError}</span>
              </div>
            )}

            <form onSubmit={handlePgModalSubmit} className="space-y-4 text-left">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1.5"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textSub,
                  }}
                >
                  Nome del Personaggio (PG) <span style={{ color: palette.accent }}>*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e604d]" />
                  <input
                    id="input-pg-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Es. Varis Shadowalker, Thorin, Lyra..."
                    value={pgCharacterName}
                    onChange={(e) => setPgCharacterName(e.target.value)}
                    className="w-full rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none transition-colors border"
                    style={{
                      backgroundColor: palette.bgInput,
                      borderColor: palette.borderCard,
                      color: palette.textMain,
                    }}
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textSub,
                  }}
                >
                  <Palette size={13} style={{ color: palette.accent }} />
                  Emblema / Tinta Personaggio
                </label>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {PG_COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setPgColor(col.hex)}
                      title={col.name}
                      style={{ backgroundColor: col.hex }}
                      className={`w-7 h-7 rounded-lg transition-transform cursor-pointer flex items-center justify-center text-white ${
                        pgColor.toLowerCase() === col.hex.toLowerCase()
                          ? 'scale-110 ring-2 ring-offset-2'
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
                      className="w-7 h-7 rounded-lg cursor-pointer border bg-transparent p-0 overflow-hidden"
                      style={{ borderColor: palette.borderCard }}
                      title="Scegli colore personalizzato"
                    />
                  </div>
                </div>
              </div>

              {/* Avatar URL (Optional) */}
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textSub,
                  }}
                >
                  <ImageIcon size={13} style={{ color: palette.accent }} />
                  URL Ritratto Avatar (Opzionale)
                </label>
                <input
                  id="input-pg-avatar"
                  type="url"
                  placeholder="https://esempio.com/avatar.jpg"
                  value={pgAvatarUrl}
                  onChange={(e) => setPgAvatarUrl(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border"
                  style={{
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderCard,
                    color: palette.textMain,
                  }}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPgModalOpen(false)}
                  className="flex-1 py-3 text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderCard,
                    color: palette.textMuted,
                  }}
                >
                  Annulla
                </button>
                <button
                  id="btn-submit-pg-profile"
                  type="submit"
                  disabled={!pgCharacterName.trim()}
                  className="flex-2 py-3 border text-xs uppercase tracking-wider font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    backgroundColor: `${palette.accent}20`,
                    borderColor: palette.accent,
                    color: palette.textMain,
                  }}
                >
                  <Sparkles size={14} style={{ color: palette.accent }} />
                  <span>{isEditModeOnly ? 'Salva Modifiche' : 'Entra nella Campagna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREA NUOVA CAMPAGNA ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#050406]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="border rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative"
            style={{
              backgroundColor: palette.bgModal,
              borderColor: palette.borderCard,
            }}
          >
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 p-1 transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm"
                style={{
                  backgroundColor: palette.accentMuted,
                  borderColor: `${palette.accent}45`,
                  color: palette.accent,
                }}
              >
                <Crown size={20} />
              </div>
              <div>
                <h3
                  className="text-lg font-normal"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textMain,
                  }}
                >
                  Forgia Nuova Campagna
                </h3>
                <span className="text-xs font-mono" style={{ color: palette.accent }}>
                  {isCreateAsDm ? 'Creerai come Dungeon Master (DM)' : 'Creerai come Giocatore (Player)'}
                </span>
              </div>
            </div>

            <p className="text-xs italic mb-5 leading-relaxed" style={{ color: palette.textMuted }}>
              Verrà generato un codice esclusivo da condividere con i tuoi giocatori per farli accedere al tuo tavolo.
            </p>

            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-center gap-2 mb-4 italic rounded-lg">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-4 text-left">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1.5"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    color: palette.textSub,
                  }}
                >
                  Nome della Campagna <span style={{ color: palette.accent }}>*</span>
                </label>
                <input
                  id="create-camp-name-input"
                  type="text"
                  required
                  placeholder="Es. La Maledizione di Strahd"
                  value={newCampName}
                  onChange={(e) => {
                    setNewCampName(e.target.value);
                    if (!newCampCode) {
                      setNewCampCode(CampaignManager.generateCampaignCode());
                    }
                  }}
                  className="w-full rounded-xl px-4 py-2.5 text-xs outline-none transition-colors border"
                  style={{
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderCard,
                    color: palette.textMain,
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="block text-xs uppercase tracking-wider"
                    style={{
                      fontFamily: "'Cinzel', Georgia, serif",
                      color: palette.textSub,
                    }}
                  >
                    Codice Campagna Generato
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[10px] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                    style={{ color: palette.accent }}
                  >
                    <RefreshCw size={10} /> Rigenera
                  </button>
                </div>
                <input
                  id="create-camp-code-input"
                  type="text"
                  required
                  placeholder="Es. STRAHD-4821"
                  value={newCampCode}
                  onChange={(e) => setNewCampCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="w-full rounded-xl px-4 py-2.5 text-xs font-mono uppercase tracking-wider outline-none border"
                  style={{
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderCard,
                    color: palette.textMain,
                  }}
                />
              </div>

              {/* Checkbox / Toggle: Ruolo Master vs Player */}
              <div
                onClick={() => setIsCreateAsDm(!isCreateAsDm)}
                className="p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none"
                style={{
                  backgroundColor: isCreateAsDm ? `${palette.accent}15` : palette.bgInput,
                  borderColor: isCreateAsDm ? palette.accent : palette.borderCard,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-xs"
                    style={{
                      backgroundColor: isCreateAsDm ? palette.accent : 'transparent',
                      borderColor: isCreateAsDm ? palette.accent : palette.borderCard,
                      color: isCreateAsDm ? '#050406' : palette.textMuted,
                    }}
                  >
                    {isCreateAsDm ? <Crown size={15} /> : <User size={15} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: palette.textMain }}>
                      {isCreateAsDm ? 'Sono il Dungeon Master (DM)' : 'Creo come Giocatore (Player)'}
                    </p>
                    <p className="text-[11px] leading-tight" style={{ color: palette.textMuted }}>
                      {isCreateAsDm
                        ? 'Sarai il Master ufficiale con pieni poteri di gestione del tavolo'
                        : 'Entrerai come giocatore e configurerai il tuo personaggio'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isCreateAsDm}
                  onChange={(e) => setIsCreateAsDm(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: palette.accent }}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderCard,
                    color: palette.textMuted,
                  }}
                >
                  Annulla
                </button>
                <button
                  id="btn-submit-create-campaign"
                  type="submit"
                  disabled={!newCampName.trim() || !newCampCode.trim()}
                  className="flex-2 py-3 border text-xs uppercase tracking-wider font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{
                    fontFamily: "'Cinzel', Georgia, serif",
                    backgroundColor: `${palette.accent}20`,
                    borderColor: palette.accent,
                    color: palette.textMain,
                  }}
                >
                  {isCreateAsDm ? <Crown size={14} style={{ color: palette.accent }} /> : <Sparkles size={14} style={{ color: palette.accent }} />}
                  <span>{isCreateAsDm ? 'Crea & Entra come Master' : 'Crea & Configura Personaggio'}</span>
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
        message={`Sei sicuro di voler eliminare la campagna "${campaignToDelete?.name}" (${campaignToDelete?.code})? Questa operazione è irreversibile e cancellerà sessioni, PNG, luoghi, note e dati associati sia in locale che sul Cloud per tutti i giocatori.`}
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
        message={`Vuoi davvero rimuovere la campagna "${campaignToLeave?.name}" (${campaignToLeave?.code}) dal tuo account? Il tuo personaggio non sarà più collegato ad essa e non la vedrai più nell'elenco.`}
        confirmLabel={isLeavingCampaign ? 'Uscita in corso...' : 'Abbandona Campagna'}
        cancelLabel="Annulla"
        isDestructive={true}
        onConfirm={handleLeaveCampaignConfirm}
        onCancel={() => {
          if (!isLeavingCampaign) setCampaignToLeave(null);
        }}
      />

      {/* Campaign Invite & QR Code Modal */}
      {inviteCampaign && (
        <CampaignInviteModal
          isOpen={Boolean(inviteCampaign)}
          onClose={() => setInviteCampaign(null)}
          campaignCode={inviteCampaign.code}
          campaignName={inviteCampaign.name}
        />
      )}

      {/* Minimal Antique Colophon Footer */}
      <footer
        className="relative z-10 border-t py-6 text-xs"
        style={{
          backgroundColor: '#050406',
          borderColor: palette.borderHeader,
          color: palette.textMuted,
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs tracking-widest uppercase font-semibold transition-colors"
              style={{
                fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
                color: palette.accent,
              }}
            >
              Chronicle
            </span>
            <span>&bull;</span>
            <span className="italic">Portale delle Campagne</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => handleOpenLegal('privacy')}
              className="hover:text-[#f3ebd9] transition-colors cursor-pointer underline underline-offset-2"
              style={{ color: palette.textSub }}
            >
              Privacy Policy
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => handleOpenLegal('cookie')}
              className="hover:text-[#f3ebd9] transition-colors cursor-pointer underline underline-offset-2"
              style={{ color: palette.textSub }}
            >
              Cookie Policy
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => handleOpenLegal('terms')}
              className="hover:text-[#f3ebd9] transition-colors cursor-pointer underline underline-offset-2"
              style={{ color: palette.textSub }}
            >
              Termini & GDPR
            </button>
          </div>

          <span className="text-[11px] italic" style={{ color: palette.textMuted }}>
            Tavolo di Ruolo Attivo &bull; D&D 5E
          </span>
        </div>
      </footer>

      {/* Legal, Privacy & Cookie Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </div>
  );
}
