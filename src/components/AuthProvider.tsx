import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Player, UserAccount, UserPreferences } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { CloudSyncService } from '../lib/cloudSync';
import { UserPreferencesService, DEFAULT_USER_PREFERENCES } from '../lib/userPreferencesService';
import { UserProfileSyncService } from '../lib/userProfileSync';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  account: UserAccount | null;
  player: Player | null;
  allPlayers: Player[];
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    characterName: string;
    color?: string;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshAccount: () => void;
  updateAccountProfile: (updates: Partial<UserAccount>) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  account: null,
  player: null,
  allPlayers: [],
  loading: false,
  error: null,
  login: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  register: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  logout: () => {},
  refreshAccount: () => {},
  updateAccountProfile: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<UserAccount | null>(() => CampaignManager.getCurrentAccount());
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => CampaignManager.getStoredPlayers());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlayers = useCallback(() => {
    setAllPlayers(CampaignManager.getStoredPlayers());
  }, []);

  const refreshAccount = useCallback(() => {
    const curr = CampaignManager.getCurrentAccount();
    setAccount(curr ? { ...curr } : null);
    refreshPlayers();
  }, [refreshPlayers]);

  useEffect(() => {
    // Start global sync for accounts & campaigns index from Firestore
    CloudSyncService.initGlobalSync();
    ApiKeyManager.preloadAllKeys();

    const handleDataUpdated = () => {
      refreshAccount();
      ApiKeyManager.preloadAllKeys();
    };

    window.addEventListener('chronicle_accounts_updated', handleDataUpdated);
    window.addEventListener('chronicle_campaigns_updated', handleDataUpdated);
    window.addEventListener('chronicle_campaign_changed', handleDataUpdated);
    window.addEventListener('chronicle_data_updated', handleDataUpdated);

    return () => {
      window.removeEventListener('chronicle_accounts_updated', handleDataUpdated);
      window.removeEventListener('chronicle_campaigns_updated', handleDataUpdated);
      window.removeEventListener('chronicle_campaign_changed', handleDataUpdated);
      window.removeEventListener('chronicle_data_updated', handleDataUpdated);
    };
  }, [refreshAccount]);

  // Real-time Cloud UserPreferences Sync (Multi-Device)
  useEffect(() => {
    if (!account?.id) return;

    const unsub = UserPreferencesService.subscribeUserPreferences(account.id, (prefs: UserPreferences) => {
      setAccount((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          preferences: prefs,
        };
      });
    });

    return () => {
      unsub();
    };
  }, [account?.id]);

  // Authoritative Multi-Provider Auth session state listener (Supabase + Firebase)
  useEffect(() => {
    let isMounted = true;

    const syncUser = async (uid: string, email: string, displayName?: string, photoURL?: string) => {
      if (!isMounted || !uid) return;
      try {
        const userEmail = (email || '').trim().toLowerCase();
        let existingSupa: any = null;

        if (isSupabaseConfigured()) {
          try {
            existingSupa = await SupabaseSyncService.getUserAccount(uid, userEmail);
          } catch (e) {
            console.warn('[Supabase] getUserAccount failed:', e);
          }
        }

        let userAccount: UserAccount;

        if (existingSupa) {
          userAccount = {
            id: existingSupa.id || uid,
            email: existingSupa.email || userEmail,
            characterName: existingSupa.characterName || existingSupa.character_name || displayName || (userEmail ? userEmail.split('@')[0] : 'Player'),
            color: existingSupa.color || '#6366f1',
            avatarUrl: existingSupa.avatarUrl || existingSupa.avatar_url || photoURL || '',
            isDm: Boolean(existingSupa.isDm || existingSupa.is_dm || (existingSupa.dmCampaigns && existingSupa.dmCampaigns.length > 0)),
            dmCampaigns: Array.isArray(existingSupa.dmCampaigns) ? existingSupa.dmCampaigns : [],
            joinedCampaigns: Array.isArray(existingSupa.joinedCampaigns) ? existingSupa.joinedCampaigns : [],
            campaignProfiles: existingSupa.campaignProfiles || existingSupa.campaign_profiles || {},
            preferences: (existingSupa.preferences && existingSupa.preferences.theme) ? existingSupa.preferences : DEFAULT_USER_PREFERENCES,
            createdAt: existingSupa.createdAt || existingSupa.created_at || new Date().toISOString(),
          };
        } else {
          let accounts = CampaignManager.getAccounts();
          let matched = accounts.find((a) => a.id === uid || (userEmail && a.email && a.email.toLowerCase() === userEmail));
          if (matched) {
            userAccount = { ...matched, id: uid };
          } else {
            let dmCampaigns: string[] = [];
            let joinedCampaigns: string[] = [];
            if (isSupabaseConfigured()) {
              try {
                const res = await SupabaseSyncService.getUserCampaigns(uid, userEmail);
                dmCampaigns = res.dmCampaigns;
                joinedCampaigns = res.joinedCampaigns;
              } catch {}
            }
            userAccount = {
              id: uid,
              email: userEmail,
              characterName: displayName || (userEmail ? userEmail.split('@')[0] : 'Player'),
              color: '#6366f1',
              avatarUrl: photoURL || '',
              isDm: dmCampaigns.length > 0,
              dmCampaigns,
              joinedCampaigns,
              campaignProfiles: {},
              preferences: DEFAULT_USER_PREFERENCES,
              createdAt: new Date().toISOString(),
            };
          }
          if (isSupabaseConfigured()) {
            SupabaseSyncService.saveUserAccount(userAccount).catch(() => {});
          }
        }

        CampaignManager.saveAccount(userAccount);
        CampaignManager.setCurrentAccount(userAccount.id);

        setAccount(userAccount);
        refreshPlayers();
        ApiKeyManager.preloadAllKeys(uid);

        let activeCode = CampaignManager.getActiveCampaignCode();
        if (!activeCode) {
          const defaultCode =
            userAccount.lastCampaignCode ||
            (userAccount.joinedCampaigns && userAccount.joinedCampaigns[0]) ||
            (userAccount.dmCampaigns && userAccount.dmCampaigns[0]) ||
            null;
          if (defaultCode) {
            CampaignManager.setActiveCampaignCode(defaultCode);
          }
        }
        CloudSyncService.init();
      } catch (err) {
        console.error('[Auth] Error syncing user:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Supabase Auth session state listener
    let supaSubscription: any = null;
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          const meta = (session.user.user_metadata || {}) as Record<string, any>;
          syncUser(
            session.user.id,
            session.user.email || '',
            meta.full_name || meta.name || (session.user as any).displayName,
            meta.avatar_url || meta.picture || (session.user as any).photoURL
          );
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          const meta = (session.user.user_metadata || {}) as Record<string, any>;
          await syncUser(
            session.user.id,
            session.user.email || '',
            meta.full_name || meta.name || (session.user as any).displayName,
            meta.avatar_url || meta.picture || (session.user as any).photoURL
          );
        } else if (event === 'SIGNED_OUT') {
          CampaignManager.clearCurrentAccount();
          setAccount(null);
          refreshPlayers();
          setLoading(false);
        }
      });
      supaSubscription = subscription;
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (supaSubscription) supaSubscription.unsubscribe();
    };
  }, [refreshPlayers]);

  const login = useCallback(
    async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
      setError(null);
      const email = emailInput.trim().toLowerCase();
      const password = passwordInput.trim();

      if (!email || !password) {
        const err = 'Inserisci sia email che password.';
        setError(err);
        return { success: false, error: err };
      }

      try {
        await CloudSyncService.fetchGlobalAccountsNow();

        // 1. Try Supabase Auth Sign-In first if configured
        if (isSupabaseConfigured()) {
          const { data: supaAuthData, error: supaErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!supaErr && supaAuthData.user) {
            const uid = supaAuthData.user.id;
            const meta = (supaAuthData.user.user_metadata || {}) as Record<string, any>;
            const result = CampaignManager.handleEmailAuthSuccess({
              uid,
              email: supaAuthData.user.email || email,
              characterName: meta.full_name || meta.name,
            });
            setAccount(result.account);
            refreshPlayers();
            UserProfileSyncService.syncUserProfile(result.account, uid);
            return { success: true };
          }
        }

        // Fallback: check local accounts / user_accounts in Supabase
        const accounts = CampaignManager.getAccounts();
        const matched = accounts.find((a) => a.email && a.email.toLowerCase() === email);
        if (matched) {
          CampaignManager.setCurrentAccount(matched.id);
          setAccount(matched);
          refreshPlayers();
          return { success: true };
        }

        const err = 'Email o password non trovate. Verifica le credenziali o registrati.';
        setError(err);
        return { success: false, error: err };
      } catch (err: any) {
        console.error('Login error:', err);
        const msg = err?.message || 'Errore durante l\'accesso.';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [refreshPlayers]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      characterName: string;
      color?: string;
      avatarUrl?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      setError(null);
      const email = data.email.trim().toLowerCase();
      const password = data.password.trim();
      const characterName = data.characterName.trim();

      if (!email || !email.includes('@')) {
        const err = 'Inserisci un indirizzo email valido.';
        setError(err);
        return { success: false, error: err };
      }
      if (!password || password.length < 6) {
        const err = 'La password deve contenere almeno 6 caratteri.';
        setError(err);
        return { success: false, error: err };
      }
      if (!characterName) {
        const err = 'Inserisci il tuo nome o username.';
        setError(err);
        return { success: false, error: err };
      }

      try {
        await CloudSyncService.fetchGlobalAccountsNow();
        let uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        if (isSupabaseConfigured()) {
          const { data: supaData, error: supaErr } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: characterName },
            },
          });

          if (supaErr) {
            console.warn('[Supabase Auth] Registration notice:', supaErr.message);
          } else if (supaData.user) {
            uid = supaData.user.id;
          }
        }

        const result = CampaignManager.handleEmailAuthSuccess({
          uid,
          email,
          characterName,
          color: data.color,
          avatarUrl: data.avatarUrl,
        });

        setAccount(result.account);
        refreshPlayers();
        UserProfileSyncService.syncUserProfile(result.account, uid);
        return { success: true };
      } catch (err: any) {
        console.error('Registration error:', err);
        const msg = err?.message || 'Impossibile completare la registrazione.';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [refreshPlayers]
  );

  const loginWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        console.error('[Supabase] Google Sign-in error:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Supabase Google Sign-in error:', err);
      const msg = err?.message || "Errore durante l'accesso con Google. Riprova più tardi.";
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const changePassword = useCallback(
    async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
      setError(null);
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'La nuova password deve contenere almeno 6 caratteri.' };
      }
      try {
        if (isSupabaseConfigured()) {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) {
            return { success: false, error: error.message };
          }
        }
        return { success: true };
      } catch (err: any) {
        console.error('Change password error:', err);
        return { success: false, error: err?.message || 'Impossibile aggiornare la password.' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Supabase] Sign out warning:', e);
      }
    }
    CampaignManager.clearCurrentAccount();
    CloudSyncService.stop();
    ApiKeyManager.resetPersonalCache();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('chronicle_current_account_id');
      localStorage.removeItem('chronicle_global_active_user_id');
      localStorage.removeItem('chronicle_current_campaign');
    }
    setAccount(null);
    setError(null);
    refreshPlayers();
  }, [refreshPlayers]);

  const updateAccountProfile = useCallback(
    (updates: Partial<UserAccount>): boolean => {
      if (!account) return false;
      const updated = CampaignManager.updateAccount(account.id, updates);
      if (updated) {
        setAccount(updated);
        refreshPlayers();
        UserProfileSyncService.syncUserProfile(updated);
        return true;
      }
      return false;
    },
    [account, refreshPlayers]
  );

  const player: Player | null = account ? CampaignManager.accountToPlayer(account) : null;

  return (
    <AuthContext.Provider
      value={{
        account,
        player,
        allPlayers,
        loading,
        error,
        login,
        loginWithGoogle,
        register,
        changePassword,
        logout,
        refreshAccount,
        updateAccountProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
