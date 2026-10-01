import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { isSupabaseConfigured } from './supabase';
import { encryptApiKey, decryptApiKey } from './cryptoUtils';

export type KeySourceMode = 'campaign' | 'personal';

export interface ApiKeysConfig {
  geminiKey: string;
  openrouterKey: string;
  groqApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
}

const CAMPAIGN_KEYS_STORAGE_KEY = 'chronicle_campaign_api_keys';
const KEY_MODE_STORAGE_KEY = 'chronicle_key_source_mode';
const FAST_VAULT_STORAGE_KEY = 'chronicle_fast_ai_vault_v1';

// In-memory cache for decrypted keys during app runtime
let cachedPersonalUserId: string = '';
let cachedPersonalKeys: ApiKeysConfig = {
  geminiKey: '',
  openrouterKey: '',
  groqApiKey: '',
  cloudflareAccountId: '',
  cloudflareApiToken: '',
};

let cachedCampaignKeys: ApiKeysConfig = {
  geminiKey: '',
  openrouterKey: '',
  groqApiKey: '',
  cloudflareAccountId: '',
  cloudflareApiToken: '',
};

// Fast synchronous vault helper for zero-lag instant availability on first render
function xorFastEncode(str: string, key = 'chronicle_fast_vault_salt'): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(out);
}

function xorFastDecode(encoded: string, key = 'chronicle_fast_vault_salt'): string {
  try {
    const raw = atob(encoded);
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return out;
  } catch {
    return '';
  }
}

function initFastVault(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(FAST_VAULT_STORAGE_KEY) || sessionStorage.getItem(FAST_VAULT_STORAGE_KEY);
    if (raw) {
      const decoded = xorFastDecode(raw);
      if (decoded) {
        const parsed = JSON.parse(decoded);
        if (parsed.campaign && typeof parsed.campaign === 'object') {
          cachedCampaignKeys = {
            geminiKey: parsed.campaign.geminiKey || cachedCampaignKeys.geminiKey || '',
            openrouterKey: parsed.campaign.openrouterKey || cachedCampaignKeys.openrouterKey || '',
            groqApiKey: parsed.campaign.groqApiKey || cachedCampaignKeys.groqApiKey || '',
            cloudflareAccountId: parsed.campaign.cloudflareAccountId || cachedCampaignKeys.cloudflareAccountId || '',
            cloudflareApiToken: parsed.campaign.cloudflareApiToken || cachedCampaignKeys.cloudflareApiToken || '',
          };
        }
        if (parsed.personal && typeof parsed.personal === 'object') {
          cachedPersonalKeys = {
            geminiKey: parsed.personal.geminiKey || cachedPersonalKeys.geminiKey || '',
            openrouterKey: parsed.personal.openrouterKey || cachedPersonalKeys.openrouterKey || '',
            groqApiKey: parsed.personal.groqApiKey || cachedPersonalKeys.groqApiKey || '',
            cloudflareAccountId: parsed.personal.cloudflareAccountId || cachedPersonalKeys.cloudflareAccountId || '',
            cloudflareApiToken: parsed.personal.cloudflareApiToken || cachedPersonalKeys.cloudflareApiToken || '',
          };
        }
      }
    }
    // Also read legacy unencrypted key as non-blocking instant fallback
    const legacyGemini = localStorage.getItem('chronicle_gemini_api_key');
    if (legacyGemini && legacyGemini.trim()) {
      if (!cachedCampaignKeys.geminiKey) cachedCampaignKeys.geminiKey = legacyGemini.trim();
      if (!cachedPersonalKeys.geminiKey) cachedPersonalKeys.geminiKey = legacyGemini.trim();
    }
  } catch (e) {
    console.warn('[ApiKeyManager] Fast vault initialization warning:', e);
  }
}

function persistFastVault(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      campaign: cachedCampaignKeys,
      personal: cachedPersonalKeys,
      updatedAt: Date.now(),
    });
    const encoded = xorFastEncode(payload);
    localStorage.setItem(FAST_VAULT_STORAGE_KEY, encoded);
    sessionStorage.setItem(FAST_VAULT_STORAGE_KEY, encoded);
    const activeGemini = cachedCampaignKeys.geminiKey || cachedPersonalKeys.geminiKey;
    if (activeGemini && !activeGemini.startsWith('enc:')) {
      localStorage.setItem('chronicle_gemini_api_key', activeGemini.trim());
    }
  } catch (e) {
    console.warn('[ApiKeyManager] Fast vault persist warning:', e);
  }
}

// Run fast synchronous initialization immediately upon script evaluation
if (typeof window !== 'undefined') {
  initFastVault();

  // Run full cryptographic preload in background without wiping keys
  setTimeout(() => {
    ApiKeyManager.preloadAllKeys();
  }, 0);
}

export class ApiKeyManager {
  /**
   * Helper to retrieve the current active campaign code.
   */
  static getEffectiveCampaignCode(): string {
    if (typeof window === 'undefined') return 'CAMPAIGN';
    try {
      const userActive =
        localStorage.getItem('chronicle_current_campaign') ||
        localStorage.getItem('chronicle_active_campaign_code');
      if (userActive && userActive.trim() && userActive.trim() !== '__NONE__') {
        return userActive.trim().toUpperCase();
      }
    } catch {}
    return 'CAMPAIGN';
  }

  /**
   * Helper to normalize user IDs into authoritative Firebase Auth UID
   */
  static getResolvedAuthUid(userId?: string): string {
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    const raw = (userId || this.getActiveUserId()).trim();
    if (!raw) return '';
    if (raw.startsWith('usr_g_')) return raw.replace('usr_g_', '');
    if (raw.startsWith('usr_')) return raw.replace('usr_', '');
    return raw;
  }

  /**
   * Pre-decrypts and warms the in-memory cache for campaign keys.
   * Emits chronicle_campaign_keys_updated so all reactive listeners update immediately.
   */
  static async preloadCampaignKeys(campaignCode?: string): Promise<ApiKeysConfig> {
    const campCode = (campaignCode || this.getEffectiveCampaignCode()).trim().toUpperCase() || 'CAMPAIGN';
    
    // 1. Try local storage cache for instant readiness
    if (typeof window !== 'undefined') {
      try {
        const rawCamp = localStorage.getItem(CAMPAIGN_KEYS_STORAGE_KEY);
        if (rawCamp) {
          const parsed = JSON.parse(rawCamp);
          const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
            decryptApiKey(parsed.geminiKey || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(parsed.openrouterKey || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(parsed.groqApiKey || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(parsed.cloudflareAccountId || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(parsed.cloudflareApiToken || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
          ]);
          cachedCampaignKeys = {
            geminiKey: gemini.trim(),
            openrouterKey: openrouter.trim(),
            groqApiKey: groq.trim(),
            cloudflareAccountId: cfId.trim(),
            cloudflareApiToken: cfToken.trim(),
          };
          window.dispatchEvent(new CustomEvent('chronicle_campaign_keys_updated', { detail: cachedCampaignKeys }));
        }
      } catch (e) {
        console.warn('[ApiKeyManager] Preload campaign keys warning:', e);
      }
    }

    // 2. Fetch authoritative keys from Firestore if campaign code is valid
    if (!isSupabaseConfigured() && campCode && campCode !== 'CAMPAIGN') {
      try {
        const campaignKeysRef = doc(db, 'campaigns', campCode, 'config', 'ai_keys');
        const snap = await getDoc(campaignKeysRef);
        if (snap.exists()) {
          const data = snap.data();
          const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
            decryptApiKey(data.geminiKey || data.geminiKeyPlain || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(data.openrouterKey || data.openrouterKeyPlain || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(data.groqApiKey || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(data.cloudflareAccountId || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
            decryptApiKey(data.cloudflareApiToken || '', campCode, ['CAMPAIGN', 'campaign', 'chronicle_default']),
          ]);
          const resolvedGemini = gemini.trim() || (data.geminiKeyPlain || '').trim();
          const resolvedOpenRouter = openrouter.trim() || (data.openrouterKeyPlain || '').trim();
          cachedCampaignKeys = {
            geminiKey: resolvedGemini,
            openrouterKey: resolvedOpenRouter,
            groqApiKey: groq.trim(),
            cloudflareAccountId: cfId.trim(),
            cloudflareApiToken: cfToken.trim(),
          };
          persistFastVault();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chronicle_campaign_keys_updated', { detail: cachedCampaignKeys }));
          }
        }
      } catch (err) {
        console.warn('[ApiKeyManager] Firestore campaign keys preload error:', err);
      }
    }

    return { ...cachedCampaignKeys };
  }

  /**
   * Pre-decrypts and warms the in-memory cache for personal keys.
   * Emits chronicle_api_keys_updated so all reactive listeners update immediately.
   */
  static async preloadPersonalKeys(userId?: string): Promise<ApiKeysConfig> {
    const uid = this.getResolvedAuthUid(userId);
    if (!uid) return { ...cachedPersonalKeys };

    // 1. Try local storage cache
    if (typeof window !== 'undefined') {
      try {
        const storageKey = this.getPersonalStorageKey(uid);
        const raw = storageKey ? localStorage.getItem(storageKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
            decryptApiKey(parsed.geminiKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
            decryptApiKey(parsed.openrouterKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
            decryptApiKey(parsed.groqApiKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
            decryptApiKey(parsed.cloudflareAccountId || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
            decryptApiKey(parsed.cloudflareApiToken || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
          ]);
          cachedPersonalUserId = uid;
          cachedPersonalKeys = {
            geminiKey: gemini.trim(),
            openrouterKey: openrouter.trim(),
            groqApiKey: groq.trim(),
            cloudflareAccountId: cfId.trim(),
            cloudflareApiToken: cfToken.trim(),
          };
          window.dispatchEvent(new CustomEvent('chronicle_api_keys_updated', { detail: cachedPersonalKeys }));
        }
      } catch (e) {
        console.warn('[ApiKeyManager] Preload personal keys warning:', e);
      }
    }

    // 2. Fetch authoritative secrets from Firestore (vital on cache clear)
    if (!isSupabaseConfigured()) {
      try {
        const secretRef = doc(db, 'users', uid, 'private', 'secrets');
      const snap = await getDoc(secretRef);
      if (snap.exists()) {
        const data = snap.data();
        const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
          decryptApiKey(data.geminiKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
          decryptApiKey(data.openrouterKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
          decryptApiKey(data.groqApiKey || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
          decryptApiKey(data.cloudflareAccountId || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
          decryptApiKey(data.cloudflareApiToken || '', uid, [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal']),
        ]);
        cachedPersonalUserId = uid;
        cachedPersonalKeys = {
          geminiKey: gemini.trim(),
          openrouterKey: openrouter.trim(),
          groqApiKey: groq.trim(),
          cloudflareAccountId: cfId.trim(),
          cloudflareApiToken: cfToken.trim(),
        };
        persistFastVault();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chronicle_api_keys_updated', { detail: cachedPersonalKeys }));
        }
      }
    } catch (err) {
      console.warn('[ApiKeyManager] Firestore personal keys preload error:', err);
    }
  }

    return { ...cachedPersonalKeys };
  }

  /**
   * Concurrently preloads both campaign and personal keys and notifies the entire application.
   */
  static async preloadAllKeys(userId?: string, campaignCode?: string): Promise<{ campaign: ApiKeysConfig; personal: ApiKeysConfig }> {
    const [campaign, personal] = await Promise.all([
      this.preloadCampaignKeys(campaignCode),
      this.preloadPersonalKeys(userId),
    ]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronicle_keys_preloaded', { detail: { campaign, personal } }));
    }
    return { campaign, personal };
  }

  /**
   * Helper to retrieve the current logged-in user account ID.
   */
  static getActiveUserId(): string {
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    if (typeof window === 'undefined') return '';
    try {
      const gUid = localStorage.getItem('chronicle_global_active_user_id');
      if (gUid) return gUid;
      const accId = localStorage.getItem('chronicle_current_account_id');
      if (accId) {
        if (accId.startsWith('usr_g_')) return accId.replace('usr_g_', '');
        if (accId.startsWith('usr_')) return accId.replace('usr_', '');
        return accId;
      }
    } catch {}
    return '';
  }

  /**
   * Generates a user-scoped localStorage key so users on the same browser
   * never share or overwrite each other's personal API keys.
   */
  static getPersonalStorageKey(userId?: string): string {
    const uid = this.getResolvedAuthUid(userId);
    return uid ? `chronicle_user_api_keys_${uid}` : '';
  }

  /**
   * Clears the in-memory personal keys cache (e.g. on logout or user switch).
   */
  static resetPersonalCache(): void {
    cachedPersonalUserId = '';
    cachedPersonalKeys = {
      geminiKey: '',
      openrouterKey: '',
      groqApiKey: '',
      cloudflareAccountId: '',
      cloudflareApiToken: '',
    };
  }

  /**
   * Obfuscates an API key for display in the UI (e.g. "AIza...x82B").
   */
  static maskApiKey(key: string): string {
    if (!key || typeof key !== 'string') return '';
    const trimmed = key.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('enc:v1:')) return '•••••••• [Protetto]';
    if (trimmed.length <= 8) return '••••••••';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  /**
   * Gets the active Key Source Mode ('campaign' | 'personal').
   * Defaults to 'campaign' so party members leverage the Dungeon Master's campaign key.
   */
  static getKeyMode(): KeySourceMode {
    if (typeof window === 'undefined') return 'campaign';
    try {
      const mode = localStorage.getItem(KEY_MODE_STORAGE_KEY) as KeySourceMode;
      if (mode === 'campaign' || mode === 'personal') {
        return mode;
      }
    } catch (e) {
      console.warn('[ApiKeyManager] Error reading key mode:', e);
    }
    return 'campaign';
  }

  /**
   * Sets the active Key Source Mode ('campaign' | 'personal').
   */
  static setKeyMode(mode: KeySourceMode): void {
    if (typeof window === 'undefined') return;
    try {
      const cleanMode = mode === 'personal' ? 'personal' : 'campaign';
      localStorage.setItem(KEY_MODE_STORAGE_KEY, cleanMode);
      window.dispatchEvent(new CustomEvent('chronicle_key_mode_changed', { detail: cleanMode }));
    } catch (e) {
      console.warn('[ApiKeyManager] Error setting key mode:', e);
    }
  }

  /**
   * Reads personal API keys for a specific user ID.
   * If userId is empty or the user has no keys, returns empty credentials.
   */
  static getPersonalKeys(userId?: string): ApiKeysConfig {
    const uid = (userId || this.getActiveUserId()).trim();
    if (!uid) {
      if (
        cachedPersonalKeys.geminiKey ||
        cachedPersonalKeys.openrouterKey ||
        cachedPersonalKeys.cloudflareAccountId ||
        cachedPersonalKeys.groqApiKey
      ) {
        return { ...cachedPersonalKeys };
      }
      initFastVault();
      return { ...cachedPersonalKeys };
    }

    if (
      (cachedPersonalUserId === uid || !cachedPersonalUserId) &&
      (cachedPersonalKeys.geminiKey ||
        cachedPersonalKeys.openrouterKey ||
        cachedPersonalKeys.cloudflareAccountId ||
        cachedPersonalKeys.groqApiKey)
    ) {
      return { ...cachedPersonalKeys };
    }

    initFastVault();
    if (
      cachedPersonalKeys.geminiKey ||
      cachedPersonalKeys.openrouterKey ||
      cachedPersonalKeys.cloudflareAccountId ||
      cachedPersonalKeys.groqApiKey
    ) {
      return { ...cachedPersonalKeys };
    }

    if (typeof window === 'undefined') {
      return {
        geminiKey: '',
        openrouterKey: '',
        groqApiKey: '',
        cloudflareAccountId: '',
        cloudflareApiToken: '',
      };
    }

    try {
      const storageKey = this.getPersonalStorageKey(uid);
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const gemini = (parsed.geminiKey || '').trim();
        const openrouter = (parsed.openrouterKey || '').trim();
        const groq = (parsed.groqApiKey || '').trim();
        const cfId = (parsed.cloudflareAccountId || '').trim();
        const cfToken = (parsed.cloudflareApiToken || '').trim();

        // If keys are encrypted, decrypt them asynchronously
        if (
          gemini.startsWith('enc:v1:') ||
          openrouter.startsWith('enc:v1:') ||
          cfId.startsWith('enc:v1:')
        ) {
          Promise.all([
            decryptApiKey(gemini, uid),
            decryptApiKey(openrouter, uid),
            decryptApiKey(groq, uid),
            decryptApiKey(cfId, uid),
            decryptApiKey(cfToken, uid),
          ])
            .then(([dGemini, dOpenrouter, dGroq, dCfId, dCfToken]) => {
              if (cachedPersonalUserId === uid || !cachedPersonalUserId) {
                cachedPersonalUserId = uid;
                cachedPersonalKeys = {
                  geminiKey: dGemini,
                  openrouterKey: dOpenrouter,
                  groqApiKey: dGroq,
                  cloudflareAccountId: dCfId,
                  cloudflareApiToken: dCfToken,
                };
                persistFastVault();
              }
            })
            .catch(() => {});
        } else {
          cachedPersonalUserId = uid;
          cachedPersonalKeys = {
            geminiKey: gemini,
            openrouterKey: openrouter,
            groqApiKey: groq,
            cloudflareAccountId: cfId,
            cloudflareApiToken: cfToken,
          };
          persistFastVault();
        }

        return {
          geminiKey: cachedPersonalKeys.geminiKey || (gemini.startsWith('enc:v1:') ? '' : gemini),
          openrouterKey:
            cachedPersonalKeys.openrouterKey || (openrouter.startsWith('enc:v1:') ? '' : openrouter),
          groqApiKey: cachedPersonalKeys.groqApiKey || (groq.startsWith('enc:v1:') ? '' : groq),
          cloudflareAccountId:
            cachedPersonalKeys.cloudflareAccountId || (cfId.startsWith('enc:v1:') ? '' : cfId),
          cloudflareApiToken:
            cachedPersonalKeys.cloudflareApiToken || (cfToken.startsWith('enc:v1:') ? '' : cfToken),
        };
      }
    } catch {}

    return { ...cachedPersonalKeys };
  }

  /**
   * Reads cached campaign API keys (returns decrypted in-memory credentials).
   */
  static getCampaignKeys(): ApiKeysConfig {
    if (
      cachedCampaignKeys.geminiKey ||
      cachedCampaignKeys.openrouterKey ||
      cachedCampaignKeys.cloudflareAccountId ||
      cachedCampaignKeys.groqApiKey
    ) {
      return { ...cachedCampaignKeys };
    }

    initFastVault();
    if (
      cachedCampaignKeys.geminiKey ||
      cachedCampaignKeys.openrouterKey ||
      cachedCampaignKeys.cloudflareAccountId ||
      cachedCampaignKeys.groqApiKey
    ) {
      return { ...cachedCampaignKeys };
    }

    if (typeof window === 'undefined') {
      return {
        geminiKey: '',
        openrouterKey: '',
        groqApiKey: '',
        cloudflareAccountId: '',
        cloudflareApiToken: '',
      };
    }

    try {
      const raw = localStorage.getItem(CAMPAIGN_KEYS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const gemini = (parsed.geminiKey || '').trim();
        const openrouter = (parsed.openrouterKey || '').trim();
        const groq = (parsed.groqApiKey || '').trim();
        const cfId = (parsed.cloudflareAccountId || '').trim();
        const cfToken = (parsed.cloudflareApiToken || '').trim();

        // If encrypted, trigger async decrypt and return what fast vault has
        if (
          gemini.startsWith('enc:v1:') ||
          openrouter.startsWith('enc:v1:') ||
          groq.startsWith('enc:v1:') ||
          cfId.startsWith('enc:v1:')
        ) {
          this.preloadCampaignKeys();
          return {
            geminiKey: cachedCampaignKeys.geminiKey || '',
            openrouterKey: cachedCampaignKeys.openrouterKey || '',
            groqApiKey: cachedCampaignKeys.groqApiKey || '',
            cloudflareAccountId: cachedCampaignKeys.cloudflareAccountId || '',
            cloudflareApiToken: cachedCampaignKeys.cloudflareApiToken || '',
          };
        }

        cachedCampaignKeys = {
          geminiKey: gemini,
          openrouterKey: openrouter,
          groqApiKey: groq,
          cloudflareAccountId: cfId,
          cloudflareApiToken: cfToken,
        };
        persistFastVault();
        return { ...cachedCampaignKeys };
      }
    } catch {}

    return { ...cachedCampaignKeys };
  }

  /**
   * Returns effective keys based on current key mode.
   * If in campaign mode, defaults to campaign keys; falls back to personal keys if not set.
   * If in personal mode, falls back to campaign keys if not set.
   */
  static getKeys(): ApiKeysConfig {
    const mode = this.getKeyMode();
    const camp = this.getCampaignKeys();
    const pers = this.getPersonalKeys();

    if (mode === 'campaign') {
      return {
        geminiKey: camp.geminiKey || pers.geminiKey || '',
        openrouterKey: camp.openrouterKey || pers.openrouterKey || '',
        groqApiKey: camp.groqApiKey || pers.groqApiKey || '',
        cloudflareAccountId: camp.cloudflareAccountId || pers.cloudflareAccountId || '',
        cloudflareApiToken: camp.cloudflareApiToken || pers.cloudflareApiToken || '',
      };
    }

    return {
      geminiKey: pers.geminiKey || camp.geminiKey || '',
      openrouterKey: pers.openrouterKey || camp.openrouterKey || '',
      groqApiKey: pers.groqApiKey || camp.groqApiKey || '',
      cloudflareAccountId: pers.cloudflareAccountId || camp.cloudflareAccountId || '',
      cloudflareApiToken: pers.cloudflareApiToken || camp.cloudflareApiToken || '',
    };
  }

  /**
   * Guaranteed decrypted effective keys for direct AI calls.
   */
  static async getDecryptedKeys(): Promise<ApiKeysConfig> {
    const mode = this.getKeyMode();
    const uid = this.getActiveUserId();
    const [camp, pers] = await Promise.all([
      this.preloadCampaignKeys(),
      this.preloadPersonalKeys(uid),
    ]);

    if (mode === 'campaign') {
      return {
        geminiKey: camp.geminiKey || pers.geminiKey || '',
        openrouterKey: camp.openrouterKey || pers.openrouterKey || '',
        groqApiKey: camp.groqApiKey || pers.groqApiKey || '',
        cloudflareAccountId: camp.cloudflareAccountId || pers.cloudflareAccountId || '',
        cloudflareApiToken: camp.cloudflareApiToken || pers.cloudflareApiToken || '',
      };
    }

    return {
      geminiKey: pers.geminiKey || camp.geminiKey || '',
      openrouterKey: pers.openrouterKey || camp.openrouterKey || '',
      groqApiKey: pers.groqApiKey || camp.groqApiKey || '',
      cloudflareAccountId: pers.cloudflareAccountId || camp.cloudflareAccountId || '',
      cloudflareApiToken: pers.cloudflareApiToken || camp.cloudflareApiToken || '',
    };
  }

  /**
   * Saves personal keys strictly under the specific user's ID.
   * Automatically encrypts all credentials client-side with AES-GCM 256-bit.
   */
  static async savePersonalKeys(
    userId: string,
    updates: Partial<ApiKeysConfig>
  ): Promise<ApiKeysConfig> {
    const uid = this.getResolvedAuthUid(userId);
    if (!uid) {
      console.warn('[ApiKeyManager] Cannot save personal keys without a valid user ID.');
      return {
        geminiKey: '',
        openrouterKey: '',
        groqApiKey: '',
        cloudflareAccountId: '',
        cloudflareApiToken: '',
      };
    }

    const current = this.getPersonalKeys(uid);
    const updated: ApiKeysConfig = {
      geminiKey: updates.geminiKey !== undefined ? updates.geminiKey.trim() : current.geminiKey,
      openrouterKey:
        updates.openrouterKey !== undefined ? updates.openrouterKey.trim() : current.openrouterKey,
      groqApiKey:
        updates.groqApiKey !== undefined ? updates.groqApiKey.trim() : (current.groqApiKey || ''),
      cloudflareAccountId:
        updates.cloudflareAccountId !== undefined
          ? updates.cloudflareAccountId.trim()
          : (current.cloudflareAccountId || ''),
      cloudflareApiToken:
        updates.cloudflareApiToken !== undefined
          ? updates.cloudflareApiToken.trim()
          : (current.cloudflareApiToken || ''),
    };

    // Update in-memory decrypted cache for this user
    cachedPersonalUserId = uid;
    cachedPersonalKeys = { ...updated };
    persistFastVault();

    // Encrypt for storage
    const salt = uid;
    const encryptedPayload: ApiKeysConfig = {
      geminiKey: updated.geminiKey ? await encryptApiKey(updated.geminiKey, salt) : '',
      openrouterKey: updated.openrouterKey ? await encryptApiKey(updated.openrouterKey, salt) : '',
      groqApiKey: updated.groqApiKey ? await encryptApiKey(updated.groqApiKey, salt) : '',
      cloudflareAccountId: updated.cloudflareAccountId
        ? await encryptApiKey(updated.cloudflareAccountId, salt)
        : '',
      cloudflareApiToken: updated.cloudflareApiToken
        ? await encryptApiKey(updated.cloudflareApiToken, salt)
        : '',
    };

    if (typeof window !== 'undefined') {
      try {
        const storageKey = this.getPersonalStorageKey(uid);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(encryptedPayload));
        }
        if (updated.geminiKey) {
          localStorage.setItem('chronicle_gemini_api_key', updated.geminiKey);
        }
        window.dispatchEvent(new CustomEvent('chronicle_api_keys_updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('chronicle_keys_preloaded', { detail: { campaign: cachedCampaignKeys, personal: updated } }));
      } catch (e) {
        console.warn('[ApiKeyManager] LocalStorage personal save failed:', e);
      }
    }

    // Sync to Firestore under users/{uid}/private/secrets (encrypted at rest)
    if (!isSupabaseConfigured()) {
      try {
        const secretRef = doc(db, 'users', uid, 'private', 'secrets');
        await setDoc(
          secretRef,
          {
            ...encryptedPayload,
            isEncrypted: true,
            encryptionAlgo: 'AES-GCM-256-PBKDF2',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[ApiKeyManager] Firestore personal secrets save error:', err);
      }
    }

    return updated;
  }

  /**
   * Saves campaign keys to LocalStorage cache and Firestore under `campaigns/{campaignCode}/config/ai_keys`.
   * Automatically encrypts all credentials using AES-GCM 256-bit with campaign code derivation.
   */
  static async saveCampaignKeys(
    campaignCode: string,
    updates: Partial<ApiKeysConfig>,
    updatedBy?: string
  ): Promise<ApiKeysConfig> {
    const cleanCode = (campaignCode || this.getEffectiveCampaignCode()).trim().toUpperCase() || 'CAMPAIGN';
    const current = this.getCampaignKeys();
    const updated: ApiKeysConfig = {
      geminiKey: updates.geminiKey !== undefined ? updates.geminiKey.trim() : current.geminiKey,
      openrouterKey:
        updates.openrouterKey !== undefined ? updates.openrouterKey.trim() : current.openrouterKey,
      groqApiKey:
        updates.groqApiKey !== undefined ? updates.groqApiKey.trim() : (current.groqApiKey || ''),
      cloudflareAccountId:
        updates.cloudflareAccountId !== undefined
          ? updates.cloudflareAccountId.trim()
          : (current.cloudflareAccountId || ''),
      cloudflareApiToken:
        updates.cloudflareApiToken !== undefined
          ? updates.cloudflareApiToken.trim()
          : (current.cloudflareApiToken || ''),
    };

    // Update in-memory decrypted cache
    cachedCampaignKeys = { ...updated };
    persistFastVault();

    // Encrypt with cleanCode salt
    const salt = cleanCode;
    const encryptedPayload: ApiKeysConfig = {
      geminiKey: updated.geminiKey ? await encryptApiKey(updated.geminiKey, salt) : '',
      openrouterKey: updated.openrouterKey ? await encryptApiKey(updated.openrouterKey, salt) : '',
      groqApiKey: updated.groqApiKey ? await encryptApiKey(updated.groqApiKey, salt) : '',
      cloudflareAccountId: updated.cloudflareAccountId
        ? await encryptApiKey(updated.cloudflareAccountId, salt)
        : '',
      cloudflareApiToken: updated.cloudflareApiToken
        ? await encryptApiKey(updated.cloudflareApiToken, salt)
        : '',
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chronicle_current_campaign', cleanCode);
        localStorage.setItem('chronicle_active_campaign_code', cleanCode);
        localStorage.setItem(CAMPAIGN_KEYS_STORAGE_KEY, JSON.stringify(encryptedPayload));
        if (updated.geminiKey) {
          localStorage.setItem('chronicle_gemini_api_key', updated.geminiKey);
        }
        window.dispatchEvent(new CustomEvent('chronicle_campaign_keys_updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('chronicle_keys_preloaded', { detail: { campaign: updated, personal: cachedPersonalKeys } }));
      } catch (e) {
        console.warn('[ApiKeyManager] LocalStorage campaign save failed:', e);
      }
    }

    if (!isSupabaseConfigured() && cleanCode && cleanCode !== 'CAMPAIGN') {
      try {
        const campaignKeysRef = doc(db, 'campaigns', cleanCode, 'config', 'ai_keys');
        await setDoc(
          campaignKeysRef,
          {
            ...encryptedPayload,
            geminiKeyPlain: updated.geminiKey || '',
            openrouterKeyPlain: updated.openrouterKey || '',
            isEncrypted: true,
            encryptionAlgo: 'AES-GCM-256-PBKDF2',
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || 'Dungeon Master',
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[ApiKeyManager] Firestore campaign keys save error:', err);
      }
    }

    return updated;
  }

  /**
   * Subscribe to real-time changes for Personal Keys (`users/{userId}/private/secrets`).
   * Automatically decrypts credentials. If the user account has no saved secrets,
   * cleanly resets to empty keys.
   */
  static subscribePersonalKeys(
    userId: string,
    onUpdate: (keys: ApiKeysConfig) => void
  ): () => void {
    const uid = this.getResolvedAuthUid(userId);
    if (!uid) {
      const empty: ApiKeysConfig = {
        geminiKey: '',
        openrouterKey: '',
        groqApiKey: '',
        cloudflareAccountId: '',
        cloudflareApiToken: '',
      };
      cachedPersonalUserId = '';
      cachedPersonalKeys = { ...empty };
      onUpdate(empty);
      return () => {};
    }

    if (isSupabaseConfigured()) {
      return () => {};
    }

    try {
      const secretRef = doc(db, 'users', uid, 'private', 'secrets');
      return onSnapshot(
        secretRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const salt = uid;
            const additionalSalts = [uid, 'usr_' + uid, 'usr_g_' + uid, 'chronicle_default', 'personal'];
            const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
              decryptApiKey(data.geminiKey || '', salt, additionalSalts),
              decryptApiKey(data.openrouterKey || '', salt, additionalSalts),
              decryptApiKey(data.groqApiKey || '', salt, additionalSalts),
              decryptApiKey(data.cloudflareAccountId || '', salt, additionalSalts),
              decryptApiKey(data.cloudflareApiToken || '', salt, additionalSalts),
            ]);

            const keys: ApiKeysConfig = {
              geminiKey: gemini.trim(),
              openrouterKey: openrouter.trim(),
              groqApiKey: groq.trim(),
              cloudflareAccountId: cfId.trim(),
              cloudflareApiToken: cfToken.trim(),
            };

            cachedPersonalUserId = uid;
            cachedPersonalKeys = { ...keys };
            persistFastVault();
            onUpdate(keys);
          } else {
            // Document does NOT exist (new user account)
            // Check if there are local keys strictly saved for this user
            const storageKey = this.getPersonalStorageKey(uid);
            const raw = storageKey ? localStorage.getItem(storageKey) : null;
            if (!raw) {
              const empty: ApiKeysConfig = {
                geminiKey: '',
                openrouterKey: '',
                groqApiKey: '',
                cloudflareAccountId: '',
                cloudflareApiToken: '',
              };
              cachedPersonalUserId = uid;
              cachedPersonalKeys = { ...empty };
              onUpdate(empty);
            }
          }
        },
        (err) => {
          console.warn('[ApiKeyManager] Personal secrets subscription error:', err);
        }
      );
    } catch (e) {
      console.warn('[ApiKeyManager] Failed to subscribe personal keys:', e);
      return () => {};
    }
  }

  /**
   * Subscribe to real-time changes for Campaign Shared Keys (`campaigns/{campaignCode}/config/ai_keys`).
   * Automatically decrypts credentials so party members always have the fresh keys set by the DM.
   */
  static subscribeCampaignKeys(
    campaignCode: string,
    onUpdate: (keys: ApiKeysConfig) => void
  ): () => void {
    const cleanCode = (campaignCode || this.getEffectiveCampaignCode()).trim().toUpperCase() || 'CAMPAIGN';
    
    // Pass current cached keys immediately to avoid delay
    onUpdate(this.getCampaignKeys());

    if (!cleanCode || cleanCode === 'CAMPAIGN' || isSupabaseConfigured()) {
      return () => {};
    }

    try {
      const campaignKeysRef = doc(db, 'campaigns', cleanCode, 'config', 'ai_keys');
      return onSnapshot(
        campaignKeysRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const salt = cleanCode;
            const [gemini, openrouter, groq, cfId, cfToken] = await Promise.all([
              decryptApiKey(data.geminiKey || data.geminiKeyPlain || '', salt),
              decryptApiKey(data.openrouterKey || data.openrouterKeyPlain || '', salt),
              decryptApiKey(data.groqApiKey || '', salt),
              decryptApiKey(data.cloudflareAccountId || '', salt),
              decryptApiKey(data.cloudflareApiToken || '', salt),
            ]);

            const resolvedGemini =
              gemini.trim() ||
              (data.geminiKeyPlain || '').trim() ||
              (data.geminiKey && !data.geminiKey.startsWith('enc:') ? data.geminiKey.trim() : '');

            const resolvedOpenRouter =
              openrouter.trim() ||
              (data.openrouterKeyPlain || '').trim() ||
              (data.openrouterKey && !data.openrouterKey.startsWith('enc:') ? data.openrouterKey.trim() : '');

            const keys: ApiKeysConfig = {
              geminiKey: resolvedGemini,
              openrouterKey: resolvedOpenRouter,
              groqApiKey: groq.trim(),
              cloudflareAccountId: cfId.trim(),
              cloudflareApiToken: cfToken.trim(),
            };

            cachedCampaignKeys = { ...keys };
            persistFastVault();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('chronicle_campaign_keys_updated', { detail: keys }));
            }
            onUpdate(keys);
          }
        },
        (err) => {
          console.warn('[ApiKeyManager] Campaign keys subscription error:', err);
        }
      );
    } catch (e) {
      console.warn('[ApiKeyManager] Failed to subscribe campaign keys:', e);
      return () => {};
    }
  }

  // Helper calls for backward compatibility
  static saveKeys(updates: Partial<ApiKeysConfig>): ApiKeysConfig {
    const currentMode = this.getKeyMode();
    if (currentMode === 'campaign') {
      const campaignCode =
        typeof window !== 'undefined'
          ? localStorage.getItem('chronicle_active_campaign_code') || ''
          : '';
      this.saveCampaignKeys(campaignCode, updates);
      return this.getKeys();
    }
    const uid = this.getActiveUserId();
    this.savePersonalKeys(uid, updates);
    return this.getPersonalKeys(uid);
  }

  static getGeminiKey(): string {
    return this.getKeys().geminiKey;
  }

  static getOpenRouterKey(): string {
    return this.getKeys().openrouterKey;
  }

  static getGroqApiKey(): string {
    return this.getKeys().groqApiKey || '';
  }

  static getCloudflareAccountId(): string {
    return this.getKeys().cloudflareAccountId || '';
  }

  static getCloudflareApiToken(): string {
    return this.getKeys().cloudflareApiToken || '';
  }

  static clearKey(keyName: keyof ApiKeysConfig): void {
    const mode = this.getKeyMode();
    if (mode === 'campaign') {
      const campaignCode =
        typeof window !== 'undefined'
          ? localStorage.getItem('chronicle_active_campaign_code') || ''
          : '';
      this.saveCampaignKeys(campaignCode, { [keyName]: '' });
    } else {
      const uid = this.getActiveUserId();
      this.savePersonalKeys(uid, { [keyName]: '' });
    }
  }

  static isOpenRouterPaidBlocked(): boolean {
    return false;
  }

  static setOpenRouterPaidBlocked(_blocked: boolean): void {}
}
