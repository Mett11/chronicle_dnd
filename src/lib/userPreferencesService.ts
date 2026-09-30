import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserPreferences } from '../types';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: {
    colorPalette: '#6366f1',
    darkMode: true,
    campaignTitleFont: 'cinzel',
    campaignTitleEffect: 'gold',
    titleUppercase: true,
    titleTracking: 'normal',
  },
  ai: {
    preferredProvider: 'gemini',
    oracleModel: 'gemini-3.8-flash',
    oracleProvider: 'gemini',
    oracleGeminiModel: 'gemini-3.8-flash',
    oracleOpenrouterModel: 'openrouter/free',
    oracleCloudflareModel: '@cf/meta/llama-3.3-70b-instruct-fp8',
    loreProvider: 'gemini',
    loreGeminiModel: 'gemini-2.5-flash',
    loreOpenrouterModel: 'openrouter/free',
    loreCloudflareModel: '@cf/meta/llama-3.3-70b-instruct-fp8',
    extractorProvider: 'gemini',
    extractorModel: 'gemini-3.8-flash',
    extractorGeminiModel: 'gemini-3.8-flash',
    extractorOpenrouterModel: 'openrouter/free',
    extractorCloudflareModel: '@cf/meta/llama-3.3-70b-instruct-fp8',
    favoriteModels: [],
    temperature: 0.2,
    maxTokens: 4096,
  },
  reading: {
    pillTagsEnabled: true,
    dossierViewMode: 'edit',
    includeDmAsPlayer: false,
  },
  notifications: {
    dismissedByCampaign: {},
  },
  updatedAt: new Date().toISOString(),
};

function normalizeUserId(userId?: string): string {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const raw = (userId || '').trim();
  if (!raw) return 'guest';
  if (raw.startsWith('usr_g_')) return raw.replace('usr_g_', '');
  if (raw.startsWith('usr_')) return raw.replace('usr_', '');
  return raw;
}

function getStorageKey(userId?: string): string {
  const norm = normalizeUserId(userId);
  return `chronicle_user_prefs_${norm}`;
}

/**
 * Clean data for Firestore write (prevent undefined error)
 */
function sanitizeFirestorePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
}

export class UserPreferencesService {
  private static activeUnsubscribe: (() => void) | null = null;
  private static activeUserId: string | null = null;

  /**
   * Reads user preferences from LocalStorage or returns default fallback.
   */
  static getLocalPreferences(userId?: string): UserPreferences {
    const norm = normalizeUserId(userId);
    try {
      const raw = localStorage.getItem(getStorageKey(norm));
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_USER_PREFERENCES,
          ...parsed,
          theme: { ...DEFAULT_USER_PREFERENCES.theme, ...(parsed.theme || {}) },
          ai: { ...DEFAULT_USER_PREFERENCES.ai, ...(parsed.ai || {}) },
          reading: { ...DEFAULT_USER_PREFERENCES.reading, ...(parsed.reading || {}) },
          notifications: {
            dismissedByCampaign: {
              ...(DEFAULT_USER_PREFERENCES.notifications?.dismissedByCampaign || {}),
              ...(parsed.notifications?.dismissedByCampaign || {}),
            },
          },
        };
      }
    } catch (e) {
      console.warn('[UserPreferencesService] Error reading local prefs:', e);
    }
    return DEFAULT_USER_PREFERENCES;
  }

  /**
   * Applies theme settings to document DOM element.
   */
  static applyThemeToDOM(theme: UserPreferences['theme']) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (theme.darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    if (theme.colorPalette) {
      root.style.setProperty('--primary-color', theme.colorPalette);
    }
  }

  /**
   * Saves user preferences locally and syncs to Firestore document `user_preferences/{userId}`.
   */
  static async saveUserPreferences(
    userId: string,
    updates: {
      theme?: Partial<UserPreferences['theme']>;
      ai?: Partial<UserPreferences['ai']>;
      reading?: Partial<UserPreferences['reading']>;
      notifications?: Partial<UserPreferences['notifications']>;
    }
  ): Promise<UserPreferences> {
    const norm = normalizeUserId(userId);
    const current = this.getLocalPreferences(norm);

    const merged: UserPreferences = {
      theme: { ...current.theme, ...(updates.theme || {}) },
      ai: { ...current.ai, ...(updates.ai || {}) },
      reading: { ...current.reading, ...(updates.reading || {}) },
      notifications: {
        dismissedByCampaign: {
          ...(current.notifications?.dismissedByCampaign || {}),
          ...(updates.notifications?.dismissedByCampaign || {}),
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to LocalStorage instantly
    try {
      localStorage.setItem(getStorageKey(norm), JSON.stringify(merged));
    } catch (e) {
      console.warn('[UserPreferencesService] LocalStorage save failed:', e);
    }

    // 2. Apply theme to DOM
    this.applyThemeToDOM(merged.theme);

    // 3. Dispatch event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('chronicle_user_preferences_updated', {
          detail: { userId: norm, preferences: merged },
        })
      );
    }

    // 4. Sync to Firestore in real time
    if (norm && norm !== 'guest') {
      try {
        const prefRef = doc(db, 'user_preferences', norm);
        const payload = sanitizeFirestorePayload(merged);
        await setDoc(prefRef, payload, { merge: true });
      } catch (err) {
        console.warn('[UserPreferencesService] Firestore sync error:', err);
      }
    }

    return merged;
  }

  /**
   * Saves AI model preferences specifically and persists to Firestore.
   */
  static async saveAiPreferences(
    aiUpdates: Partial<UserPreferences['ai']>,
    userId?: string
  ): Promise<UserPreferences> {
    return this.saveUserPreferences(userId || '', { ai: aiUpdates });
  }

  /**
   * Gets dismissed notification IDs for a specific campaign, synced to Firestore.
   */
  static getDismissedNotificationIds(campaignCode: string, userId?: string): string[] {
    const code = (campaignCode || 'default').trim().toUpperCase();
    const prefs = this.getLocalPreferences(userId);
    const fromPrefs = prefs.notifications?.dismissedByCampaign?.[code];
    if (Array.isArray(fromPrefs)) return fromPrefs;

    // Fallback: check localStorage legacy key
    if (typeof window !== 'undefined') {
      try {
        const norm = normalizeUserId(userId);
        const raw = localStorage.getItem(`chronicle_dismissed_notifs_${code}_${norm}`) ||
                    localStorage.getItem(`chronicle_dismissed_notifs_${code}_anon`);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  }

  /**
   * Saves dismissed notification IDs for a campaign and syncs to Firestore.
   */
  static async saveDismissedNotificationIds(
    campaignCode: string,
    dismissedIds: string[],
    userId?: string
  ): Promise<void> {
    const code = (campaignCode || 'default').trim().toUpperCase();
    const norm = normalizeUserId(userId);
    const current = this.getLocalPreferences(norm);
    const existing = current.notifications?.dismissedByCampaign || {};

    const updatedMap = {
      ...existing,
      [code]: Array.from(new Set(dismissedIds)),
    };

    // Save legacy key for instant local compatibility
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`chronicle_dismissed_notifs_${code}_${norm}`, JSON.stringify(dismissedIds));
      } catch {}
    }

    await this.saveUserPreferences(norm, {
      notifications: {
        dismissedByCampaign: updatedMap,
      },
    });
  }

  /**
   * Fetches preferences from Firestore once.
   */
  static async fetchPreferencesFromFirestore(userId: string): Promise<UserPreferences | null> {
    const norm = normalizeUserId(userId);
    if (!norm || norm === 'guest') return null;
    try {
      const ref = doc(db, 'user_preferences', norm);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as UserPreferences;
        const merged: UserPreferences = {
          ...DEFAULT_USER_PREFERENCES,
          ...data,
          theme: { ...DEFAULT_USER_PREFERENCES.theme, ...(data.theme || {}) },
          ai: { ...DEFAULT_USER_PREFERENCES.ai, ...(data.ai || {}) },
          reading: { ...DEFAULT_USER_PREFERENCES.reading, ...(data.reading || {}) },
          notifications: {
            dismissedByCampaign: {
              ...(DEFAULT_USER_PREFERENCES.notifications?.dismissedByCampaign || {}),
              ...(data.notifications?.dismissedByCampaign || {}),
            },
          },
        };
        localStorage.setItem(getStorageKey(norm), JSON.stringify(merged));
        this.applyThemeToDOM(merged.theme);
        return merged;
      }
    } catch (e) {
      console.warn('[UserPreferencesService] Error fetching preferences:', e);
    }
    return null;
  }

  /**
   * Listens for real-time changes on Firestore path `user_preferences/{userId}`.
   */
  static subscribeUserPreferences(
    userId: string,
    onUpdate: (prefs: UserPreferences) => void
  ): () => void {
    const norm = normalizeUserId(userId);
    if (!norm || norm === 'guest') {
      onUpdate(DEFAULT_USER_PREFERENCES);
      return () => {};
    }

    if (this.activeUnsubscribe && this.activeUserId === norm) {
      // Already subscribed to this user
      return this.activeUnsubscribe;
    }

    if (this.activeUnsubscribe) {
      this.activeUnsubscribe();
      this.activeUnsubscribe = null;
    }

    this.activeUserId = norm;

    // Load initial local preference first
    const initialLocal = this.getLocalPreferences(norm);
    this.applyThemeToDOM(initialLocal.theme);
    onUpdate(initialLocal);

    try {
      const prefRef = doc(db, 'user_preferences', norm);
      this.activeUnsubscribe = onSnapshot(
        prefRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserPreferences;
            const merged: UserPreferences = {
              ...DEFAULT_USER_PREFERENCES,
              ...data,
              theme: { ...DEFAULT_USER_PREFERENCES.theme, ...(data.theme || {}) },
              ai: { ...DEFAULT_USER_PREFERENCES.ai, ...(data.ai || {}) },
              reading: { ...DEFAULT_USER_PREFERENCES.reading, ...(data.reading || {}) },
              notifications: {
                dismissedByCampaign: {
                  ...(DEFAULT_USER_PREFERENCES.notifications?.dismissedByCampaign || {}),
                  ...(data.notifications?.dismissedByCampaign || {}),
                },
              },
            };

            localStorage.setItem(getStorageKey(norm), JSON.stringify(merged));
            this.applyThemeToDOM(merged.theme);
            onUpdate(merged);

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('chronicle_user_preferences_updated', {
                  detail: { userId: norm, preferences: merged },
                })
              );
            }
          }
        },
        (error) => {
          console.warn('[UserPreferencesService] Subscription error:', error);
        }
      );
    } catch (err) {
      console.warn('[UserPreferencesService] Failed to subscribe:', err);
    }

    return () => {
      if (this.activeUnsubscribe) {
        this.activeUnsubscribe();
        this.activeUnsubscribe = null;
        this.activeUserId = null;
      }
    };
  }
}
