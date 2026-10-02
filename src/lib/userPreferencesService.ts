import { auth } from './firebase';
import { UserPreferences } from '../types';
import { SupabaseSyncService } from './supabaseSyncService';

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

    // 2. Sync to Supabase user_preferences table asynchronously
    if (norm && norm !== 'guest') {
      SupabaseSyncService.saveUserPreferences(norm, {
        theme: merged.theme,
        ai: merged.ai,
        reading: merged.reading,
        notifications: merged.notifications,
      }).catch((err) => {
        console.warn('[UserPreferencesService] Supabase cloud sync failed:', err);
      });
    }

    // 3. Apply theme to DOM
    this.applyThemeToDOM(merged.theme);

    // 4. Dispatch event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('chronicle_user_preferences_updated', {
          detail: { userId: norm, preferences: merged },
        })
      );
    }

    return merged;
  }

  /**
   * Saves AI model preferences specifically.
   */
  static async saveAiPreferences(
    aiUpdates: Partial<UserPreferences['ai']>,
    userId?: string
  ): Promise<UserPreferences> {
    return this.saveUserPreferences(userId || '', { ai: aiUpdates });
  }

  /**
   * Saves reading and UI preferences (e.g. tutorialSeen).
   */
  static async saveReadingPreferences(
    readingUpdates: Partial<UserPreferences['reading']>,
    userId?: string
  ): Promise<UserPreferences> {
    return this.saveUserPreferences(userId || '', { reading: readingUpdates });
  }

  /**
   * Gets dismissed notification IDs for a specific campaign.
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
   * Saves dismissed notification IDs for a campaign.
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
   * Fetches preferences from LocalStorage.
   */
  static async fetchPreferencesFromFirestore(userId: string): Promise<UserPreferences | null> {
    const norm = normalizeUserId(userId);
    return this.getLocalPreferences(norm);
  }

  /**
   * Listens for preference changes.
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

    // Load initial local preference
    const initialLocal = this.getLocalPreferences(norm);
    this.applyThemeToDOM(initialLocal.theme);
    onUpdate(initialLocal);

    // Asynchronously fetch preferences from Supabase to stay updated across devices
    SupabaseSyncService.fetchUserPreferences(norm).then((remoteData) => {
      if (remoteData) {
        const mergedFromRemote: UserPreferences = {
          ...DEFAULT_USER_PREFERENCES,
          theme: { ...DEFAULT_USER_PREFERENCES.theme, ...(initialLocal.theme || {}), ...(remoteData.theme || {}) },
          ai: { ...DEFAULT_USER_PREFERENCES.ai, ...(initialLocal.ai || {}), ...(remoteData.ai || {}) },
          reading: { ...DEFAULT_USER_PREFERENCES.reading, ...(initialLocal.reading || {}), ...(remoteData.reading || {}) },
          notifications: {
            dismissedByCampaign: {
              ...(initialLocal.notifications?.dismissedByCampaign || {}),
              ...(remoteData.notifications?.dismissedByCampaign || {}),
            },
          },
          updatedAt: remoteData.updated_at || new Date().toISOString(),
        };

        try {
          localStorage.setItem(getStorageKey(norm), JSON.stringify(mergedFromRemote));
        } catch {}

        this.applyThemeToDOM(mergedFromRemote.theme);
        onUpdate(mergedFromRemote);
      }
    }).catch(() => {});

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.userId === norm && customEvent.detail?.preferences) {
        onUpdate(customEvent.detail.preferences);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chronicle_user_preferences_updated', handler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chronicle_user_preferences_updated', handler);
      }
    };
  }
}
