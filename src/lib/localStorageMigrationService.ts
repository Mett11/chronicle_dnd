/**
 * LocalStorage Migration Service
 * Deduplicates and standardizes localStorage keys on application startup.
 * 
 * Rules:
 * 1. Single source for active campaign: chronicle_current_campaign
 *    Legacy keys migrated:
 *    - chronicle_active_campaign_code
 *    - chronicle_user_{userId}_active_campaign
 * 
 * 2. DM is player flag: chronicle_{code}_dm_is_player
 *    Legacy keys migrated:
 *    - chronicle_dm_is_player_{code}
 *    - chronicle_is_dm_player_{code}
 * 
 * 3. Campaign AI config: chronicle_{code}_campaign_ai_config
 *    Legacy keys migrated:
 *    - chronicle_campaign_ai_config (global) migrated into active campaign's key
 * 
 * 4. User Preferences: chronicle_user_prefs_{userId}
 *    Legacy flat keys migrated:
 *    - chronicle_theme_class -> preferences.theme
 *    - chronicle_oracle_provider, chronicle_oracle_gemini_model, etc. -> preferences.ai
 *    - chronicle_show_mention_tags, chronicle_profile_view_mode -> preferences.reading
 */

export class LocalStorageMigrationService {
  private static MIGRATION_FLAG_KEY = 'chronicle_storage_migrated_v2';

  static runMigrations(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      this.migrateActiveCampaignKey();
      this.migrateDmIsPlayerKeys();
      this.migrateCampaignAiConfigKeys();
      this.migrateLegacyFlatPreferences();
      localStorage.setItem(this.MIGRATION_FLAG_KEY, 'true');
    } catch (err) {
      console.warn('[LocalStorageMigration] Migration warning:', err);
    }
  }

  /**
   * Consolidates active campaign to `chronicle_current_campaign`
   */
  private static migrateActiveCampaignKey(): void {
    const canonicalCurrent = localStorage.getItem('chronicle_current_campaign');

    if (!canonicalCurrent || canonicalCurrent === '__NONE__') {
      // Check legacy global active campaign key
      const legacyActive = localStorage.getItem('chronicle_active_campaign_code');
      if (legacyActive && legacyActive.trim() && legacyActive.trim() !== '__NONE__') {
        const clean = legacyActive.trim().toUpperCase();
        localStorage.setItem('chronicle_current_campaign', clean);
      } else {
        // Check legacy per-user keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('chronicle_user_') && key.endsWith('_active_campaign')) {
            const val = localStorage.getItem(key);
            if (val && val.trim() && val.trim() !== '__NONE__') {
              localStorage.setItem('chronicle_current_campaign', val.trim().toUpperCase());
              break;
            }
          }
        }
      }
    }

    // Clean up obsolete keys
    localStorage.removeItem('chronicle_active_campaign_code');
    const userKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chronicle_user_') && key.endsWith('_active_campaign')) {
        userKeysToRemove.push(key);
      }
    }
    userKeysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  /**
   * Consolidates DM-as-player flag to `chronicle_${code}_dm_is_player`
   */
  private static migrateDmIsPlayerKeys(): void {
    const keysToMigrate: { oldKey: string; code: string; val: string }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Handle legacy format: chronicle_dm_is_player_{code} or chronicle_is_dm_player_{code}
      if (key.startsWith('chronicle_dm_is_player_')) {
        const code = key.replace('chronicle_dm_is_player_', '').trim().toUpperCase();
        const val = localStorage.getItem(key) || 'false';
        if (code) keysToMigrate.push({ oldKey: key, code, val });
      } else if (key.startsWith('chronicle_is_dm_player_')) {
        const code = key.replace('chronicle_is_dm_player_', '').trim().toUpperCase();
        const val = localStorage.getItem(key) || 'false';
        if (code) keysToMigrate.push({ oldKey: key, code, val });
      }
    }

    keysToMigrate.forEach(({ oldKey, code, val }) => {
      const targetKey = `chronicle_${code}_dm_is_player`;
      if (localStorage.getItem(targetKey) === null) {
        localStorage.setItem(targetKey, val);
      }
      localStorage.removeItem(oldKey);
    });
  }

  /**
   * Consolidates campaign AI configuration to `chronicle_${code}_campaign_ai_config`
   */
  private static migrateCampaignAiConfigKeys(): void {
    const globalLegacy = localStorage.getItem('chronicle_campaign_ai_config');
    const currentCampaign = localStorage.getItem('chronicle_current_campaign');

    if (globalLegacy && currentCampaign && currentCampaign !== '__NONE__') {
      const cleanCode = currentCampaign.trim().toUpperCase();
      const targetKey = `chronicle_${cleanCode}_campaign_ai_config`;
      if (!localStorage.getItem(targetKey)) {
        localStorage.setItem(targetKey, globalLegacy);
      }
    }

    // Remove legacy generic key
    localStorage.removeItem('chronicle_campaign_ai_config');
  }

  /**
   * Migrates legacy flat preference keys into structured preferences
   */
  private static migrateLegacyFlatPreferences(): void {
    // Only migrate if active user exists and needs backfill
    const activeUserId = localStorage.getItem('chronicle_global_active_user_id') ||
                          localStorage.getItem('chronicle_current_account_id');
    if (!activeUserId) return;

    const norm = activeUserId.replace(/^(usr_g_|usr_)/, '');
    const prefsKey = `chronicle_user_prefs_${norm}`;
    let existingPrefs: any = {};
    try {
      const raw = localStorage.getItem(prefsKey);
      if (raw) existingPrefs = JSON.parse(raw);
    } catch {}

    let modified = false;

    // Theme migration
    const legacyThemeClass = localStorage.getItem('chronicle_theme_class');
    if (legacyThemeClass && !existingPrefs?.theme?.colorPalette) {
      if (!existingPrefs.theme) existingPrefs.theme = {};
      existingPrefs.theme.themeId = legacyThemeClass;
      modified = true;
    }

    // AI migration
    const legacyOracleProv = localStorage.getItem('chronicle_oracle_provider');
    const legacyOracleGemini = localStorage.getItem('chronicle_oracle_gemini_model');
    const legacyOracleOpenrouter = localStorage.getItem('chronicle_oracle_openrouter_model');
    const legacyOracleCloudflare = localStorage.getItem('chronicle_oracle_cloudflare_model');
    const legacyExtrGemini = localStorage.getItem('chronicle_extraction_gemini_model');

    if (legacyOracleProv || legacyOracleGemini || legacyOracleOpenrouter || legacyExtrGemini) {
      if (!existingPrefs.ai) existingPrefs.ai = {};
      if (legacyOracleProv && !existingPrefs.ai.preferredProvider) {
        existingPrefs.ai.preferredProvider = legacyOracleProv;
        modified = true;
      }
      if (legacyOracleGemini && !existingPrefs.ai.oracleGeminiModel) {
        existingPrefs.ai.oracleGeminiModel = legacyOracleGemini;
        modified = true;
      }
      if (legacyOracleOpenrouter && !existingPrefs.ai.oracleOpenrouterModel) {
        existingPrefs.ai.oracleOpenrouterModel = legacyOracleOpenrouter;
        modified = true;
      }
      if (legacyOracleCloudflare && !existingPrefs.ai.oracleCloudflareModel) {
        existingPrefs.ai.oracleCloudflareModel = legacyOracleCloudflare;
        modified = true;
      }
      if (legacyExtrGemini && !existingPrefs.ai.extractorGeminiModel) {
        existingPrefs.ai.extractorGeminiModel = legacyExtrGemini;
        modified = true;
      }
    }

    // Reading migration
    const legacyMentionTags = localStorage.getItem('chronicle_show_mention_tags');
    const legacyViewMode = localStorage.getItem('chronicle_profile_view_mode');
    if (legacyMentionTags !== null || legacyViewMode) {
      if (!existingPrefs.reading) existingPrefs.reading = {};
      if (legacyMentionTags !== null && existingPrefs.reading.pillTagsEnabled === undefined) {
        existingPrefs.reading.pillTagsEnabled = legacyMentionTags === 'true';
        modified = true;
      }
      if (legacyViewMode && !existingPrefs.reading.dossierViewMode) {
        existingPrefs.reading.dossierViewMode = legacyViewMode;
        modified = true;
      }
    }

    if (modified) {
      try {
        localStorage.setItem(prefsKey, JSON.stringify(existingPrefs));
      } catch {}
    }

    // Remove legacy flat keys now that they are migrated
    [
      'chronicle_oracle_provider',
      'chronicle_extraction_provider',
      'chronicle_oracle_gemini_model',
      'chronicle_oracle_openrouter_model',
      'chronicle_oracle_cloudflare_model',
      'chronicle_extraction_gemini_model',
      'chronicle_extraction_openrouter_model',
      'chronicle_extraction_cloudflare_model',
      'chronicle_show_mention_tags',
      'chronicle_profile_view_mode',
      'chronicle_theme_class',
    ].forEach((k) => localStorage.removeItem(k));
  }
}
