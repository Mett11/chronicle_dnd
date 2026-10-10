import { UserPreferences, CampaignTitleFont, CampaignTitleEffect } from '../types';
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

export function normalizeUserId(userId?: string): string {
  const raw = (userId || (typeof window !== 'undefined' ? localStorage.getItem('chronicle_current_account_id') || localStorage.getItem('chronicle_global_active_user_id') : '') || '').trim();
  if (!raw) return 'guest';
  if (raw.startsWith('usr_g_')) return raw.replace('usr_g_', '');
  if (raw.startsWith('usr_')) return raw.replace('usr_', '');
  return raw;
}

export function getStorageKey(userId?: string): string {
  const norm = normalizeUserId(userId);
  return `chronicle_user_prefs_${norm}`;
}

/**
 * Normalizes any legacy flat or nested preferences object into the canonical UserPreferences structure.
 * Performs deep merge without overwriting valid existing nested preferences.
 */
export function normalizeUserPreferences(raw: any, existingFallback: UserPreferences = DEFAULT_USER_PREFERENCES): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...existingFallback };
  }

  // Deep merge theme
  const rawTheme = raw.theme || {};
  const theme: UserPreferences['theme'] = {
    colorPalette: rawTheme.colorPalette || raw.colorPalette || existingFallback.theme.colorPalette,
    darkMode: rawTheme.darkMode !== undefined ? Boolean(rawTheme.darkMode) : (raw.darkMode !== undefined ? Boolean(raw.darkMode) : existingFallback.theme.darkMode),
    campaignTitleFont: (rawTheme.campaignTitleFont || raw.campaignTitleFont || existingFallback.theme.campaignTitleFont) as CampaignTitleFont,
    campaignTitleEffect: (rawTheme.campaignTitleEffect || raw.campaignTitleEffect || existingFallback.theme.campaignTitleEffect) as CampaignTitleEffect,
    titleUppercase: rawTheme.titleUppercase !== undefined ? Boolean(rawTheme.titleUppercase) : (raw.titleUppercase !== undefined ? Boolean(raw.titleUppercase) : existingFallback.theme.titleUppercase),
    titleTracking: rawTheme.titleTracking || raw.titleTracking || existingFallback.theme.titleTracking,
  };

  // Deep merge ai
  const rawAi = raw.ai || {};
  const preferredProvider = rawAi.preferredProvider || raw.aiProvider || raw.preferredProvider || existingFallback.ai.preferredProvider;
  const oracleGeminiModel = rawAi.oracleGeminiModel || raw.oracleGeminiModel || existingFallback.ai.oracleGeminiModel;
  const oracleOpenrouterModel = rawAi.oracleOpenrouterModel || raw.oracleOpenrouterModel || existingFallback.ai.oracleOpenrouterModel;
  const oracleCloudflareModel = rawAi.oracleCloudflareModel || raw.oracleCloudflareModel || existingFallback.ai.oracleCloudflareModel;

  const extractorGeminiModel = rawAi.extractorGeminiModel || raw.extractionGeminiModel || raw.extractorGeminiModel || existingFallback.ai.extractorGeminiModel;
  const extractorOpenrouterModel = rawAi.extractorOpenrouterModel || raw.extractionOpenrouterModel || raw.extractorOpenrouterModel || existingFallback.ai.extractorOpenrouterModel;
  const extractorCloudflareModel = rawAi.extractorCloudflareModel || raw.extractionCloudflareModel || raw.extractorCloudflareModel || existingFallback.ai.extractorCloudflareModel;

  const ai: UserPreferences['ai'] = {
    preferredProvider,
    oracleModel: rawAi.oracleModel || raw.oracleModel || oracleGeminiModel || existingFallback.ai.oracleModel,
    extractorModel: rawAi.extractorModel || raw.extractorModel || raw.extractionModel || extractorGeminiModel || existingFallback.ai.extractorModel,
    loreModel: rawAi.loreModel || raw.loreModel || existingFallback.ai.loreModel,
    oracleProvider: rawAi.oracleProvider || preferredProvider,
    oracleGeminiModel,
    oracleOpenrouterModel,
    oracleCloudflareModel,
    loreProvider: rawAi.loreProvider || preferredProvider,
    loreGeminiModel: rawAi.loreGeminiModel || existingFallback.ai.loreGeminiModel,
    loreOpenrouterModel: rawAi.loreOpenrouterModel || existingFallback.ai.loreOpenrouterModel,
    loreCloudflareModel: rawAi.loreCloudflareModel || existingFallback.ai.loreCloudflareModel,
    extractorProvider: rawAi.extractorProvider || preferredProvider,
    extractorGeminiModel,
    extractorOpenrouterModel,
    extractorCloudflareModel,
    favoriteModels: Array.isArray(rawAi.favoriteModels) ? rawAi.favoriteModels : (Array.isArray(raw.favoriteModels) ? raw.favoriteModels : existingFallback.ai.favoriteModels),
    temperature: typeof rawAi.temperature === 'number' ? rawAi.temperature : (typeof raw.temperature === 'number' ? raw.temperature : existingFallback.ai.temperature),
    maxTokens: rawAi.maxTokens || raw.maxTokens || existingFallback.ai.maxTokens,
  };

  // Deep merge reading
  const rawReading = raw.reading || {};
  const reading: UserPreferences['reading'] = {
    pillTagsEnabled: rawReading.pillTagsEnabled !== undefined
      ? Boolean(rawReading.pillTagsEnabled)
      : (raw.showMentionTags !== undefined ? Boolean(raw.showMentionTags) : (raw.pillTagsEnabled !== undefined ? Boolean(raw.pillTagsEnabled) : existingFallback.reading.pillTagsEnabled)),
    dossierViewMode: (rawReading.dossierViewMode || raw.viewMode || raw.dossierViewMode || existingFallback.reading.dossierViewMode) as 'edit' | 'read',
    includeDmAsPlayer: rawReading.includeDmAsPlayer !== undefined ? Boolean(rawReading.includeDmAsPlayer) : (raw.includeDmAsPlayer !== undefined ? Boolean(raw.includeDmAsPlayer) : existingFallback.reading.includeDmAsPlayer),
    tutorialSeen: rawReading.tutorialSeen !== undefined ? Boolean(rawReading.tutorialSeen) : (raw.tutorialSeen !== undefined ? Boolean(raw.tutorialSeen) : existingFallback.reading.tutorialSeen),
  };

  // Deep merge notifications
  const rawNotifs = raw.notifications || {};
  const notifications: UserPreferences['notifications'] = {
    dismissedByCampaign: {
      ...(existingFallback.notifications?.dismissedByCampaign || {}),
      ...(rawNotifs.dismissedByCampaign || {}),
    },
  };

  return {
    theme,
    ai,
    reading,
    notifications,
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
  };
}

export class UserPreferencesService {
  private static userLastFetchedMap = new Map<string, number>();
  private static userSubscribersMap = new Map<string, Set<(prefs: UserPreferences) => void>>();
  private static isGlobalListenerRegistered = false;

  /**
   * Reads user preferences from LocalStorage or returns default fallback.
   */
  static getLocalPreferences(userId?: string): UserPreferences {
    const norm = normalizeUserId(userId);
    try {
      const raw = localStorage.getItem(getStorageKey(norm));
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeUserPreferences(parsed, DEFAULT_USER_PREFERENCES);
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
   * Saves user preferences locally and syncs to Supabase public.user_preferences table.
   * user_preferences is the Single Source of Truth.
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
   * Saves reading and UI preferences.
   */
  static async saveReadingPreferences(
    readingUpdates: Partial<UserPreferences['reading']>,
    userId?: string
  ): Promise<UserPreferences> {
    return this.saveUserPreferences(userId || '', { reading: readingUpdates });
  }

  /**
   * Saves theme preferences.
   */
  static async saveThemePreferences(
    themeUpdates: Partial<UserPreferences['theme']>,
    userId?: string
  ): Promise<UserPreferences> {
    return this.saveUserPreferences(userId || '', { theme: themeUpdates });
  }

  /**
   * Gets dismissed notification IDs for a specific campaign.
   */
  static getDismissedNotificationIds(campaignCode: string, userId?: string): string[] {
    const code = (campaignCode || 'default').trim().toUpperCase();
    const prefs = this.getLocalPreferences(userId);
    const fromPrefs = prefs.notifications?.dismissedByCampaign?.[code];
    if (Array.isArray(fromPrefs)) return fromPrefs;
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

    await this.saveUserPreferences(norm, {
      notifications: {
        dismissedByCampaign: updatedMap,
      },
    });
  }

  /**
   * Deep merges and backfills preferences from user_accounts.preferences into user_preferences
   * without overwriting valid preferences already present in user_preferences.
   */
  static async backfillFromUserAccount(
    userId: string,
    accountPreferences?: any
  ): Promise<UserPreferences> {
    const norm = normalizeUserId(userId);
    if (!norm || norm === 'guest') return DEFAULT_USER_PREFERENCES;

    // 1. Fetch current authoritative user_preferences from remote
    const remotePrefsRow = await SupabaseSyncService.fetchUserPreferences(norm);
    const localPrefs = this.getLocalPreferences(norm);

    // Baseline authoritative prefs
    const authoritativePrefs = remotePrefsRow
      ? normalizeUserPreferences(remotePrefsRow, DEFAULT_USER_PREFERENCES)
      : localPrefs;

    if (!accountPreferences || typeof accountPreferences !== 'object' || Object.keys(accountPreferences).length === 0) {
      return authoritativePrefs;
    }

    // 2. Perform deep merge of accountPreferences into authoritativePrefs, filling missing keys only
    const normalizedAccountPrefs = normalizeUserPreferences(accountPreferences, DEFAULT_USER_PREFERENCES);

    const mergedTheme: UserPreferences['theme'] = {
      colorPalette: authoritativePrefs.theme.colorPalette || normalizedAccountPrefs.theme.colorPalette,
      darkMode: authoritativePrefs.theme.darkMode !== undefined ? authoritativePrefs.theme.darkMode : normalizedAccountPrefs.theme.darkMode,
      campaignTitleFont: authoritativePrefs.theme.campaignTitleFont || normalizedAccountPrefs.theme.campaignTitleFont,
      campaignTitleEffect: authoritativePrefs.theme.campaignTitleEffect || normalizedAccountPrefs.theme.campaignTitleEffect,
      titleUppercase: authoritativePrefs.theme.titleUppercase !== undefined ? authoritativePrefs.theme.titleUppercase : normalizedAccountPrefs.theme.titleUppercase,
      titleTracking: authoritativePrefs.theme.titleTracking || normalizedAccountPrefs.theme.titleTracking,
    };

    const mergedAi: UserPreferences['ai'] = {
      ...normalizedAccountPrefs.ai,
      ...authoritativePrefs.ai,
      favoriteModels: Array.from(new Set([...(authoritativePrefs.ai.favoriteModels || []), ...(normalizedAccountPrefs.ai.favoriteModels || [])])),
    };

    const mergedReading: UserPreferences['reading'] = {
      pillTagsEnabled: authoritativePrefs.reading.pillTagsEnabled !== undefined ? authoritativePrefs.reading.pillTagsEnabled : normalizedAccountPrefs.reading.pillTagsEnabled,
      dossierViewMode: authoritativePrefs.reading.dossierViewMode || normalizedAccountPrefs.reading.dossierViewMode,
      includeDmAsPlayer: authoritativePrefs.reading.includeDmAsPlayer !== undefined ? authoritativePrefs.reading.includeDmAsPlayer : normalizedAccountPrefs.reading.includeDmAsPlayer,
      tutorialSeen: authoritativePrefs.reading.tutorialSeen !== undefined ? authoritativePrefs.reading.tutorialSeen : normalizedAccountPrefs.reading.tutorialSeen,
    };

    const mergedNotifications: UserPreferences['notifications'] = {
      dismissedByCampaign: {
        ...(normalizedAccountPrefs.notifications?.dismissedByCampaign || {}),
        ...(authoritativePrefs.notifications?.dismissedByCampaign || {}),
      },
    };

    const finalMerged: UserPreferences = {
      theme: mergedTheme,
      ai: mergedAi,
      reading: mergedReading,
      notifications: mergedNotifications,
      updatedAt: new Date().toISOString(),
    };

    // 3. Persist backfilled preferences to user_preferences
    await this.saveUserPreferences(norm, finalMerged);
    return finalMerged;
  }

  /**
   * Listens for preference changes with singleton subscriber pooling and no repeated network loops.
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

    // 1. Immediately emit current local preferences
    const initialLocal = this.getLocalPreferences(norm);
    this.applyThemeToDOM(initialLocal.theme);
    onUpdate(initialLocal);

    // 2. Register subscriber in singleton pool
    if (!this.userSubscribersMap.has(norm)) {
      this.userSubscribersMap.set(norm, new Set());
    }
    const subSet = this.userSubscribersMap.get(norm)!;
    subSet.add(onUpdate);

    // 3. Register global window listener only once across the entire application
    if (!this.isGlobalListenerRegistered && typeof window !== 'undefined') {
      this.isGlobalListenerRegistered = true;
      window.addEventListener('chronicle_user_preferences_updated', (e: Event) => {
        const customEvent = e as CustomEvent;
        const targetUser = customEvent.detail?.userId;
        const newPrefs = customEvent.detail?.preferences;
        if (targetUser && newPrefs) {
          const callbacks = UserPreferencesService.userSubscribersMap.get(targetUser);
          if (callbacks) {
            callbacks.forEach((cb) => cb(newPrefs));
          }
        }
      });
    }

    // 4. Fetch from remote ONLY ONCE every 10 minutes per user session
    const lastFetch = this.userLastFetchedMap.get(norm) || 0;
    const now = Date.now();
    if (now - lastFetch > 10 * 60 * 1000) {
      this.userLastFetchedMap.set(norm, now);
      SupabaseSyncService.fetchUserPreferences(norm)
        .then((remoteData) => {
          if (remoteData) {
            const mergedFromRemote = normalizeUserPreferences(remoteData, initialLocal);

            try {
              localStorage.setItem(getStorageKey(norm), JSON.stringify(mergedFromRemote));
            } catch {}

            this.applyThemeToDOM(mergedFromRemote.theme);
            const currentSubs = UserPreferencesService.userSubscribersMap.get(norm);
            if (currentSubs) {
              currentSubs.forEach((cb) => cb(mergedFromRemote));
            }
          }
        })
        .catch(() => {});
    }

    // Return unsubscriber that cleans up the set
    return () => {
      const subs = UserPreferencesService.userSubscribersMap.get(norm);
      if (subs) {
        subs.delete(onUpdate);
      }
    };
  }
}
