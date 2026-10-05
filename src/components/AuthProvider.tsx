import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { Player, UserAccount, UserPreferences } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { CloudSyncService } from '../lib/cloudSync';
import { UserPreferencesService, DEFAULT_USER_PREFERENCES } from '../lib/userPreferencesService';
import { UserProfileSyncService } from '../lib/userProfileSync';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { auth, googleProvider } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

  // Authoritative Supabase Auth & fallback Firebase Auth session state listener
  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured()) {
      const syncSupabaseUser = async (user: any) => {
        if (!isMounted || !user) return;
        try {
          const uid = user.id;
          const userEmail = (user.email || '').trim().toLowerCase();
          const meta = user.user_metadata || {};
          const displayName = meta.full_name || meta.name || user.displayName || (userEmail ? userEmail.split('@')[0] : 'Player');
          const photoURL = meta.avatar_url || meta.picture || user.photoURL || undefined;

          // Fetch or create user account in public.user_accounts
          let existing = null;
          try {
            existing = await SupabaseSyncService.getUserAccount(uid);
          } catch (e) {
            console.warn('[Supabase] getUserAccount failed, creating fallback:', e);
          }

          let userAccount: UserAccount;

          if (existing) {
            userAccount = {
              id: existing.id,
              email: existing.email || userEmail,
              characterName: existing.characterName || displayName,
              color: existing.color || '#6366f1',
              avatarUrl: existing.avatarUrl || photoURL,
              isDm: Boolean(existing.isDm),
              dmCampaigns: existing.dmCampaigns || [],
              joinedCampaigns: existing.joinedCampaigns || [],
              campaignProfiles: existing.campaignProfiles || {},
              preferences: (existing.preferences && existing.preferences.theme) ? existing.preferences : DEFAULT_USER_PREFERENCES,
              createdAt: existing.createdAt || new Date().toISOString(),
            };
          } else {
            let dmCampaigns: string[] = [];
            let joinedCampaigns: string[] = [];
            try {
              const res = await SupabaseSyncService.getUserCampaigns(uid);
              dmCampaigns = res.dmCampaigns;
              joinedCampaigns = res.joinedCampaigns;
            } catch {}

            userAccount = {
              id: uid,
              email: userEmail,
              characterName: displayName,
              color: '#6366f1',
              avatarUrl: photoURL,
              isDm: dmCampaigns.length > 0,
              dmCampaigns,
              joinedCampaigns,
              campaignProfiles: {},
              preferences: DEFAULT_USER_PREFERENCES,
              createdAt: new Date().toISOString(),
            };
            SupabaseSyncService.saveUserAccount(userAccount).catch(() => {});
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
        } catch (err) {
          console.error('[Supabase Auth] Error in syncSupabaseUser:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      // Check current session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          syncSupabaseUser(session.user);
        } else {
          setLoading(false);
        }
      });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          await syncSupabaseUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          CampaignManager.clearCurrentAccount();
          setAccount(null);
          refreshPlayers();
          setLoading(false);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Authoritative Firebase Auth session state listener (fallback)
      const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!isMounted) return;

        if (firebaseUser) {
          const userEmail = (firebaseUser.email || '').trim().toLowerCase();
          let accounts = CampaignManager.getAccounts();
          if (accounts.length === 0) {
            await CloudSyncService.fetchGlobalAccountsNow();
            accounts = CampaignManager.getAccounts();
          }
          let matched = accounts.find((a) => a.id === firebaseUser.uid);

          if (!matched) {
            const isGoogle = firebaseUser.providerData.some((p) => p.providerId === 'google.com');
            if (isGoogle) {
              const res = CampaignManager.handleGoogleAuthSuccess({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              });
              matched = res.account;
            } else {
              const res = CampaignManager.handleEmailAuthSuccess({
                uid: firebaseUser.uid,
                email: userEmail,
                characterName: firebaseUser.displayName || userEmail.split('@')[0],
              });
              matched = res.account;
            }
          } else {
            CampaignManager.setCurrentAccount(matched.id);
          }

          setAccount(matched || null);
          refreshPlayers();
          ApiKeyManager.preloadAllKeys(firebaseUser.uid);
          if (matched) {
            SupabaseSyncService.saveUserAccount(matched).catch(() => {});
            let activeCode = CampaignManager.getActiveCampaignCode();
            if (!activeCode) {
              const defaultCode =
                matched.lastCampaignCode ||
                (matched.joinedCampaigns && matched.joinedCampaigns[0]) ||
                (matched.dmCampaigns && matched.dmCampaigns[0]) ||
                null;
              if (defaultCode) {
                CampaignManager.setActiveCampaignCode(defaultCode);
              }
            }
            CloudSyncService.init();
            UserProfileSyncService.syncUserProfile(matched, firebaseUser.uid);
          }
        } else {
          CampaignManager.clearCurrentAccount();
          setAccount(null);
          refreshPlayers();
        }

        setLoading(false);
      });

      return () => {
        isMounted = false;
        unsubAuth();
      };
    }
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

        // 1. Authoritative Firebase Email/Password Sign-In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const result = CampaignManager.handleEmailAuthSuccess({
          uid: user.uid,
          email: user.email || email,
        });

        setAccount(result.account);
        refreshPlayers();
        UserProfileSyncService.syncUserProfile(result.account, user.uid);
        return { success: true };
      } catch (err: any) {
        console.error('Firebase login error:', err);
        let msg = 'Credenziali non valide.';
        if (
          err?.code === 'auth/wrong-password' ||
          err?.code === 'auth/invalid-credential' ||
          err?.code === 'auth/invalid-login-credentials'
        ) {
          msg = 'Email o password errati. Verifica le credenziali.';
        } else if (err?.code === 'auth/user-not-found') {
          msg = 'Nessun account trovato con questa email. Registrati per iniziare!';
        } else if (err?.code === 'auth/invalid-email') {
          msg = 'Indirizzo email non valido.';
        } else if (err?.code === 'auth/too-many-requests') {
          msg = 'Troppi tentativi falliti. Riprova tra qualche minuto per sicurezza.';
        } else if (err?.code === 'auth/operation-not-allowed') {
          msg = "L'accesso con Email/Password non è abilitato nella console Firebase (Authentication > Provider di accesso).";
        } else if (err?.message) {
          msg = err.message;
        }
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

        // Strict Firebase Auth Registration
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const uid = user.uid;

        if (characterName) {
          await updateProfile(user, { displayName: characterName }).catch(() => {});
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
        let msg = 'Impossibile completare la registrazione.';
        if (err?.code === 'auth/email-already-in-use') {
          msg = 'Esiste già un account registrato con questa email. Accedi con la tua password.';
        } else if (err?.code === 'auth/weak-password') {
          msg = 'La password deve contenere almeno 6 caratteri.';
        } else if (err?.code === 'auth/invalid-email') {
          msg = 'Indirizzo email non valido.';
        } else if (err?.code === 'auth/operation-not-allowed') {
          msg = "La registrazione con Email/Password non è abilitata nella console Firebase (Authentication > Provider di accesso).";
        } else if (err?.message) {
          msg = err.message;
        }
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
        if (!auth.currentUser) {
          return { success: false, error: 'Devi essere autenticato per cambiare la password.' };
        }
        await updatePassword(auth.currentUser, newPassword);
        return { success: true };
      } catch (err: any) {
        console.error('Change password error:', err);
        let msg = 'Impossibile aggiornare la password.';
        if (err?.code === 'auth/requires-recent-login') {
          msg = 'Per motivi di sicurezza, disconnettiti e accedi di nuovo prima di cambiare la password.';
        } else if (err?.message) {
          msg = err.message;
        }
        return { success: false, error: msg };
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
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
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
