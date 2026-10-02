import {
  Note,
  Session,
  Entity,
  Player,
  PlayerPartyStatus,
  Category,
  UserAccount,
  UserPreferences,
  CampaignCalendar,
  SessionEvent,
  CampaignMeta,
  WorldMap,
  MapPin,
  MapFolder,
  AudioLog,
  ScrapbookItem,
  CampaignChapter,
  CampaignProfile,
  DmResponse,
  CharacterBio,
  CharacterRelationship,
  RelationshipType,
  CampaignNotification,
  EntitySecretItem,
  TimelineMemoryEntry,
  EvolvingBelief,
  InterPartyRelation,
  WorldLoreArticle,
  WorldLoreBite,
  WorldLoreCategory,
  LoreBiteLevel,
  LoreBiteAssignee,
  CharacterKnownLoreItem,
} from "../types";
import {
  MOCK_CATEGORIES,
  MOCK_SESSIONS,
  MOCK_ENTITIES,
  MOCK_NOTES,
  MOCK_CHAPTERS,
} from "../lib/mockData";
import { HARPTOS_CALENDAR } from "../lib/calendarPresets";
import { parseLoreDateString, formatLoreDate } from "../lib/loreDateUtils";
import { CloudSyncService } from "../lib/cloudSync";
import { UserPreferencesService } from "../lib/userPreferencesService";
import { IndexedDbStorage } from "../lib/indexedDbStorage";
import { SupabaseSyncService } from "../lib/supabaseSyncService";
import { FirebaseStorageService } from "../lib/firebaseStorageService";
import { isSupabaseConfigured } from "../lib/supabase";

const DEFAULT_MAPS: WorldMap[] = [];

const MOCK_LEGACY_IDS = new Set<string>([]);

function sanitizeArray<T extends Record<string, any>>(arr: any): T[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== 'object') continue;
    const id = item._id || item.id;
    if (id) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(item as T);
      }
    }
  }
  return result;
}

// In-memory cache for ultra-fast zero-allocation synchronous reads
const memoryCache = new Map<string, any>();
let cachedEntityLookupMap: Map<string, Entity> | null = null;

function getCached<T>(key: string, loader: () => T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  const val = loader();
  memoryCache.set(key, val);
  return val;
}

function setCached<T>(key: string, value: T) {
  memoryCache.set(key, value);
  // Asynchronously persist to high-capacity IndexedDB storage layer
  try {
    IndexedDbStorage.setItem(key, value);
  } catch {}
}

function invalidateCacheKey(key: string) {
  memoryCache.delete(key);
}

/**
 * Emergency global eviction routine that strips heavy base64 images from localStorage
 * across all campaign keys to free up critical megabytes for text metadata.
 */
function runEmergencyGlobalStorageEviction(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let freedSpace = false;
  try {
    const totalKeys = localStorage.length;
    const keysToInspect: string[] = [];
    for (let i = 0; i < totalKeys; i++) {
      const k = localStorage.key(i);
      if (k) keysToInspect.push(k);
    }

    for (const k of keysToInspect) {
      // Lighten maps, scrapbook, audio logs, sessions, entities, accounts
      if (
        k.includes('_maps') ||
        k.includes('_scrapbook') ||
        k.includes('_audio_logs') ||
        k.includes('_sessions') ||
        k.includes('_entities') ||
        k.includes('chronicle_global_user_accounts')
      ) {
        const raw = localStorage.getItem(k);
        if (raw && raw.length > 50000) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const stripped = parsed.map((item: any) => {
                if (!item || typeof item !== 'object') return item;
                const clone = { ...item };
                if (clone.imageUrl && clone.imageUrl.length > 1000) clone.imageUrl = '';
                if (clone.avatarUrl && clone.avatarUrl.length > 1000) clone.avatarUrl = '';
                if (Array.isArray(clone.images) && clone.images.length > 0) clone.images = [];
                if (clone.dataUrl && clone.dataUrl.length > 1000) clone.dataUrl = '';
                if (clone.audioData && clone.audioData.length > 1000) clone.audioData = '';
                return clone;
              });
              localStorage.setItem(k, JSON.stringify(stripped));
              freedSpace = true;
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('[Storage] Emergency eviction warning:', e);
  }
  return freedSpace;
}

export function safeLocalStorageSetItem(key: string, value: string): boolean {
  // Always async write to IndexedDB
  try {
    const parsed = JSON.parse(value);
    IndexedDbStorage.setItem(key, parsed);
  } catch {}

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // 1. Run immediate global storage eviction across heavy keys in localStorage
    runEmergencyGlobalStorageEviction();

    // 2. Retry saving the requested key
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {}

    // 3. If accounts array exceeds browser storage quota due to large avatar strings
    if (key === 'chronicle_global_user_accounts') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const lightweight = parsed.map((acc) => {
            const isHeavyAvatar = acc.avatarUrl && acc.avatarUrl.length > 2000;
            const cleanProfiles = acc.campaignProfiles
              ? Object.entries(acc.campaignProfiles).reduce((accProf: any, [cCode, p]: any) => {
                  accProf[cCode] = {
                    ...p,
                    avatarUrl: p.avatarUrl && p.avatarUrl.length > 2000 ? '' : p.avatarUrl,
                  };
                  return accProf;
                }, {})
              : undefined;
            return {
              ...acc,
              avatarUrl: isHeavyAvatar ? '' : acc.avatarUrl,
              campaignProfiles: cleanProfiles,
            };
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch {}
    }

    // 4. If sessions array exceeds browser storage quota due to base64 images,
    // strip heavy images from older sessions in local cache while keeping ALL session records intact
    if (key.includes('_sessions')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const lightweight = parsed.map((s, idx) => {
            if (idx < parsed.length - 3) {
              return {
                ...s,
                images: [],
                events: (s.events || []).map((e: any) => ({ ...e, images: [] })),
              };
            }
            return s;
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch {}
    }

    // 5. If world lore articles exceed storage quota due to embedded media
    if (key.includes('world_lore_articles')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const lightweight = parsed.map((a: any) => ({
            ...a,
            images: [],
          }));
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch {}
    }

    // 6. If entities or notes exceed storage quota
    if (key.includes('_entities') || key.includes('_notes')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const lightweight = parsed.map((item: any) => ({
            ...item,
            images: [],
            avatarUrl: item.avatarUrl && item.avatarUrl.length > 2000 ? '' : item.avatarUrl,
          }));
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch {}
    }

    // 7. If maps exceed storage quota
    if (key.includes('_maps')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const lightweight = parsed.map((item: any) => ({
            ...item,
            imageUrl: item.imageUrl && item.imageUrl.length > 2000 ? '' : item.imageUrl,
          }));
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch {}
    }

    // 8. If scrapbook or audio exceed storage quota, strip base64 payloads instead of wiping items
    if (key.includes('_scrapbook')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const stripped = parsed.map((item: any) => ({
            ...item,
            imageUrl: item.imageUrl && item.imageUrl.startsWith('data:') ? '' : item.imageUrl,
          }));
          localStorage.setItem(key, JSON.stringify(stripped));
          return true;
        }
      } catch {}
    }
    if (key.includes('_audio_logs')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const stripped = parsed.map((item: any) => ({
            ...item,
            audioUrl: item.audioUrl && item.audioUrl.startsWith('data:') ? '' : item.audioUrl,
          }));
          localStorage.setItem(key, JSON.stringify(stripped));
          return true;
        }
      } catch {}
    }

    // Return true since IndexedDB + memoryCache successfully took over!
    return true;
  }
}

export class CampaignManager {
  /**
   * Pre-hydrates the memory cache from IndexedDB so the application has zero data loss
   * even if localStorage quota was reached or cleared.
   */
  static async hydrateFromIndexedDb(): Promise<void> {
    try {
      const allData = await IndexedDbStorage.getAll();
      if (allData && typeof allData === 'object') {
        Object.entries(allData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && !memoryCache.has(k)) {
            memoryCache.set(k, v);
          }
        });
      }
    } catch (err) {
      console.warn('[CampaignManager] IndexedDB hydration warning:', err);
    }
  }

  static getActiveCampaignCode(): string | null {
    const activeAccount = this.getCurrentAccount();
    if (activeAccount) {
      const userKey = `chronicle_user_${activeAccount.id}_active_campaign`;
      const stored = localStorage.getItem(userKey);
      if (stored !== null) {
        const trimmed = stored.trim();
        if (!trimmed || trimmed === '__NONE__') {
          return null;
        }
        return trimmed.toUpperCase();
      }
    }

    const globalStored = localStorage.getItem("chronicle_current_campaign");
    if (globalStored !== null) {
      const trimmed = globalStored.trim();
      if (!trimmed || trimmed === '__NONE__') {
        return null;
      }
      return trimmed.toUpperCase();
    }

    return null;
  }

  static setActiveCampaignCode(code: string | null) {
    const activeAccount = this.getCurrentAccount();
    if (code && code.trim() && code.trim() !== '__NONE__') {
      const cleanCode = code.trim().toUpperCase();
      localStorage.setItem("chronicle_current_campaign", cleanCode);
      setCached("chronicle_current_campaign", cleanCode);
      if (activeAccount) {
        localStorage.setItem(
          `chronicle_user_${activeAccount.id}_active_campaign`,
          cleanCode,
        );
        setCached(
          `chronicle_user_${activeAccount.id}_active_campaign`,
          cleanCode,
        );
        this.joinCampaign(activeAccount.id, cleanCode);
      }
    } else {
      localStorage.setItem("chronicle_current_campaign", "__NONE__");
      setCached("chronicle_current_campaign", "__NONE__");
      if (activeAccount) {
        localStorage.setItem(
          `chronicle_user_${activeAccount.id}_active_campaign`,
          "__NONE__",
        );
        setCached(`chronicle_user_${activeAccount.id}_active_campaign`, "__NONE__");
      }
    }
    // Invalidate campaign-specific caches
    memoryCache.clear();
    cachedEntityLookupMap = null;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_changed", {
          detail: { campaignCode: code && code.trim() !== '__NONE__' ? code.trim().toUpperCase() : null },
        }),
      );
    }
  }

  static getStorageKey(baseKey: string) {
    const code = CampaignManager.getActiveCampaignCode();
    return code
      ? `chronicle_${code}_${baseKey}`
      : `chronicle_legacy_${baseKey}`;
  }

  static getCampaignMeta(): CampaignMeta | null {
    const activeCode = CampaignManager.getActiveCampaignCode();
    if (!activeCode) return null;
    return CampaignManager.getCampaigns().find((c) => c.code === activeCode) || null;
  }

  // === DELETED TOMBSTONES (PREVENTS ACCIDENTAL OVERWRITES & RESTORES ON CONCURRENT SYNC) ===
  static getDeletedNoteIds(): string[] {
    const key = this.getStorageKey("deleted_notes");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedNoteId(id: string) {
    if (!id) return;
    const current = this.getDeletedNoteIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_notes");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static addMultipleDeletedNoteIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedNoteIds();
    const set = new Set(current);
    let changed = false;
    ids.forEach((id) => {
      if (id && !set.has(id)) {
        set.add(id);
        changed = true;
      }
    });
    if (changed) {
      const updated = Array.from(set).slice(-1000);
      const key = this.getStorageKey("deleted_notes");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static getDeletedEntityIds(): string[] {
    const key = this.getStorageKey("deleted_entities");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedEntityId(id: string) {
    if (!id) return;
    const current = this.getDeletedEntityIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_entities");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static addMultipleDeletedEntityIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedEntityIds();
    const set = new Set(current);
    let changed = false;
    ids.forEach((id) => {
      if (id && !set.has(id)) {
        set.add(id);
        changed = true;
      }
    });
    if (changed) {
      const updated = Array.from(set).slice(-1000);
      const key = this.getStorageKey("deleted_entities");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static getDeletedSessionIds(): string[] {
    const key = this.getStorageKey("deleted_sessions");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedSessionId(id: string) {
    if (!id) return;
    const current = this.getDeletedSessionIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_sessions");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static addMultipleDeletedSessionIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedSessionIds();
    const set = new Set(current);
    let changed = false;
    ids.forEach((id) => {
      if (id && !set.has(id)) {
        set.add(id);
        changed = true;
      }
    });
    if (changed) {
      const updated = Array.from(set).slice(-1000);
      const key = this.getStorageKey("deleted_sessions");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static getDeletedScrapbookIds(): string[] {
    const key = this.getStorageKey("deleted_scrapbook");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedScrapbookId(id: string) {
    if (!id) return;
    const current = this.getDeletedScrapbookIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_scrapbook");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static getDeletedNotificationIds(): string[] {
    const key = this.getStorageKey("deleted_notifications");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedNotificationId(id: string) {
    if (!id) return;
    const current = this.getDeletedNotificationIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_notifications");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
      CloudSyncService.triggerCloudSave();
    }
  }

  static addMultipleDeletedNotificationIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedNotificationIds();
    const set = new Set(current);
    let changed = false;
    ids.forEach((id) => {
      if (id && !set.has(id)) {
        set.add(id);
        changed = true;
      }
    });
    if (changed) {
      const updated = Array.from(set).slice(-1000);
      const key = this.getStorageKey("deleted_notifications");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
      CloudSyncService.triggerCloudSave();
    }
  }

  static getDeletedWorldLoreArticleIds(): string[] {
    const key = this.getStorageKey("deleted_world_lore_articles");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedWorldLoreArticleId(id: string) {
    if (!id) return;
    const current = this.getDeletedWorldLoreArticleIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = this.getStorageKey("deleted_world_lore_articles");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
      CloudSyncService.triggerCloudSave();
    }
  }

  static addMultipleDeletedWorldLoreArticleIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedWorldLoreArticleIds();
    const set = new Set(current);
    let changed = false;
    ids.forEach((id) => {
      if (id && !set.has(id)) {
        set.add(id);
        changed = true;
      }
    });
    if (changed) {
      const updated = Array.from(set).slice(-1000);
      const key = this.getStorageKey("deleted_world_lore_articles");
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
      CloudSyncService.triggerCloudSave();
    }
  }

  static getDeletedAccountIds(): string[] {
    const key = "chronicle_deleted_account_ids";
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
        } catch {}
      }
      return [];
    });
  }

  static addDeletedAccountId(id: string) {
    if (!id) return;
    const current = this.getDeletedAccountIds();
    if (!current.includes(id)) {
      const updated = [...current, id].slice(-1000);
      const key = "chronicle_deleted_account_ids";
      setCached(key, updated);
      safeLocalStorageSetItem(key, JSON.stringify(updated));
    }
  }

  static clearDeletedIds() {
    const keys = ["deleted_notes", "deleted_entities", "deleted_sessions", "deleted_scrapbook"];
    keys.forEach((base) => {
      const k = this.getStorageKey(base);
      localStorage.removeItem(k);
      memoryCache.delete(k);
    });
    localStorage.removeItem("chronicle_deleted_account_ids");
    memoryCache.delete("chronicle_deleted_account_ids");
  }

  // === GLOBAL CAMPAIGNS ===
  static getCampaigns(): CampaignMeta[] {
    return getCached("chronicle_global_campaigns", () => {
      const saved = localStorage.getItem("chronicle_global_campaigns");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
      return [];
    });
  }

  static saveCampaigns(campaigns: CampaignMeta[]) {
    setCached("chronicle_global_campaigns", campaigns);
    localStorage.setItem(
      "chronicle_global_campaigns",
      JSON.stringify(campaigns),
    );
    CloudSyncService.syncCampaignsToCloud(campaigns);
  }

  static saveCampaignsLocalOnly(campaigns: CampaignMeta[]) {
    setCached("chronicle_global_campaigns", campaigns);
    localStorage.setItem(
      "chronicle_global_campaigns",
      JSON.stringify(campaigns),
    );
  }

  static updateCampaignMeta(
    code: string,
    updates: Partial<CampaignMeta>,
  ): CampaignMeta | null {
    const cleanCode = code.trim().toUpperCase();
    const campaigns = CampaignManager.getCampaigns();
    const index = campaigns.findIndex((c) => c.code === cleanCode);
    if (index === -1) return null;
    campaigns[index] = { ...campaigns[index], ...updates };
    CampaignManager.saveCampaigns(campaigns);
    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_updated", {
          detail: { campaign: campaigns[index] },
        }),
      );
    }
    return campaigns[index];
  }

  static isCurrentUserDm(): boolean {
    const account = this.getCurrentAccount();
    if (!account) return false;
    const activeCode = this.getActiveCampaignCode();
    if (activeCode) {
      const cleanCode = activeCode.trim().toUpperCase();
      const campaign = this.getCampaigns().find((c) => c.code.toUpperCase() === cleanCode);
      if (campaign?.dmId === account.id) return true;
      const userEmail = (account.email || '').toLowerCase().trim();
      const campDmEmail = (campaign?.dmEmail || '').toLowerCase().trim();
      if (campDmEmail && userEmail && campDmEmail === userEmail) {
        if (!account.dmCampaigns?.some((c) => c.toUpperCase() === cleanCode)) {
          this.makeDmOfCampaign(account.id, cleanCode);
        }
        return true;
      }
      if (account.dmCampaigns?.some((c) => c.toUpperCase() === cleanCode)) return true;
    }
    return Boolean(account.isDm);
  }

  static getCampaignAiConfig(campaignCode?: string): {
    provider: 'gemini' | 'openrouter';
    modelId: string;
    oracleModel: string;
    extractionModel: string;
    allowedPartyModels: string[];
  } {
    const code = (campaignCode || this.getActiveCampaignCode() || '').trim().toUpperCase();
    const campaign = this.getCampaigns().find((c) => c.code.toUpperCase() === code);
    const conf = campaign?.aiConfig;
    const pref = this.getUserPreferences();

    let localFallback: any = {};
    if (typeof window !== 'undefined') {
      try {
        localFallback = JSON.parse(localStorage.getItem('chronicle_campaign_ai_config') || '{}');
      } catch {}
    }

    const prov: 'gemini' | 'openrouter' = (conf?.provider === 'openrouter' || localFallback.provider === 'openrouter' || pref.aiProvider === 'openrouter') ? 'openrouter' : 'gemini';
    const fallbackModel = prov === 'openrouter' ? 'openrouter/free' : 'gemini-flash-latest';

    const mergedParty = conf?.allowedPartyModels || localFallback.allowedPartyModels || [];

    return {
      provider: prov,
      modelId: conf?.modelId || conf?.oracleModel || localFallback.modelId || localFallback.oracleModel || (prov === 'openrouter' ? pref.oracleOpenrouterModel : pref.oracleGeminiModel) || fallbackModel,
      oracleModel: conf?.oracleModel || conf?.modelId || localFallback.oracleModel || localFallback.modelId || (prov === 'openrouter' ? pref.oracleOpenrouterModel : pref.oracleGeminiModel) || fallbackModel,
      extractionModel: conf?.extractionModel || conf?.modelId || localFallback.extractionModel || (prov === 'openrouter' ? pref.extractionOpenrouterModel : pref.extractionGeminiModel) || fallbackModel,
      allowedPartyModels: Array.isArray(mergedParty) ? mergedParty : [],
    };
  }

  static setCampaignAiConfig(
    updates: Partial<{
      provider: 'gemini' | 'openrouter';
      modelId: string;
      oracleModel: string;
      extractionModel: string;
      allowedPartyModels: string[];
    }>,
    campaignCode?: string
  ) {
    if (typeof window !== 'undefined') {
      try {
        const prev = JSON.parse(localStorage.getItem('chronicle_campaign_ai_config') || '{}');
        localStorage.setItem('chronicle_campaign_ai_config', JSON.stringify({ ...prev, ...updates }));
      } catch {}
    }

    const code = (campaignCode || this.getActiveCampaignCode() || '').trim().toUpperCase();
    const campaigns = this.getCampaigns();
    const idx = campaigns.findIndex((c) => c.code.toUpperCase() === code);
    if (idx !== -1) {
      const current = campaigns[idx].aiConfig || {};
      campaigns[idx].aiConfig = {
        ...current,
        ...updates,
      };
      this.saveCampaigns(campaigns);
      CloudSyncService.triggerCloudSave();
    }

    if (updates.provider) {
      this.saveUserPreferences({ aiProvider: updates.provider });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
      window.dispatchEvent(new CustomEvent('chronicle_ai_config_updated'));
    }
  }

  static generateCampaignCode(baseName?: string): string {
    const existing = this.getCampaigns().map((c) => c.code);
    let prefix = "REALM";
    if (baseName && baseName.trim()) {
      const clean = baseName
        .trim()
        .toUpperCase()
        .replace(/^(IL|LO|LA|I|GLI|LE|UN|UNO|UNA|THE|A|AN)\s+/i, "")
        .replace(/[^A-Z0-9]/g, "");
      if (clean.length >= 3) {
        prefix = clean.slice(0, 8);
      }
    }

    for (let i = 0; i < 50; i++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const code = `${prefix}-${randomSuffix}`;
      if (!existing.includes(code)) {
        return code;
      }
    }
    return `CHRONICLE-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  static createCampaign(
    code: string,
    name: string,
    dmAccount?: UserAccount | null,
  ): CampaignMeta {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const campaigns = this.getCampaigns();
    const existing = campaigns.find((c) => c.code === cleanCode);

    if (existing) {
      if (dmAccount && !existing.dmId) {
        existing.dmId = dmAccount.id;
        existing.dmName = dmAccount.characterName;
        existing.dmEmail = dmAccount.email;
        this.saveCampaigns(campaigns);
      }
      if (dmAccount) {
        this.makeDmOfCampaign(dmAccount.id, cleanCode);
        this.joinCampaign(dmAccount.id, cleanCode);
      }
      return existing;
    }

    const newCamp: CampaignMeta = {
      code: cleanCode,
      name: cleanName,
      createdAt: new Date().toISOString(),
      dmId: dmAccount?.id,
      dmName: dmAccount?.characterName,
      dmEmail: dmAccount?.email,
    };
    campaigns.push(newCamp);
    this.saveCampaigns(campaigns);

    if (dmAccount) {
      this.makeDmOfCampaign(dmAccount.id, cleanCode);
      this.joinCampaign(dmAccount.id, cleanCode);
    }

    return newCamp;
  }

  static async deleteCampaign(code: string, requesterAccountId?: string): Promise<boolean> {
    const cleanCode = code.trim().toUpperCase();
    const campaigns = this.getCampaigns();
    const targetCamp = campaigns.find((c) => c.code === cleanCode);

    // 1. Remove from campaigns list
    const updatedCampaigns = campaigns.filter((c) => c.code !== cleanCode);
    this.saveCampaigns(updatedCampaigns);

    // 2. Remove campaign references from all accounts
    const accounts = this.getAccounts();
    let accountsModified = false;
    accounts.forEach((acc) => {
      let touched = false;
      if (acc.dmCampaigns?.includes(cleanCode)) {
        acc.dmCampaigns = acc.dmCampaigns.filter((c) => c !== cleanCode);
        touched = true;
      }
      if (acc.joinedCampaigns?.includes(cleanCode)) {
        acc.joinedCampaigns = acc.joinedCampaigns.filter((c) => c !== cleanCode);
        touched = true;
      }
      if (acc.campaignProfiles && acc.campaignProfiles[cleanCode]) {
        delete acc.campaignProfiles[cleanCode];
        touched = true;
      }
      if (touched) accountsModified = true;
    });
    if (accountsModified) {
      this.saveAccounts(accounts);
    }

    // 3. Clear local storage keys associated with this campaign
    const storagePrefix = `chronicle_${cleanCode}_`;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(storagePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k);
        memoryCache.delete(k);
      });
    } catch (e) {
      console.warn('Error clearing localStorage for deleted campaign:', e);
    }

    // 4. Delete document and update globals in Firestore Cloud
    await CloudSyncService.deleteCampaignFromCloud(cleanCode, updatedCampaigns, accounts);

    // 5. If active campaign was this one, clear active code and route to campaign portal
    if (this.getActiveCampaignCode() === cleanCode) {
      this.setActiveCampaignCode(null);
    }

    window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
    return true;
  }

  static makeDmOfCampaign(accountId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      if (!accounts[idx].dmCampaigns) accounts[idx].dmCampaigns = [];
      if (!accounts[idx].dmCampaigns.includes(cleanCode)) {
        accounts[idx].dmCampaigns.push(cleanCode);
      }
      if (!accounts[idx].joinedCampaigns) accounts[idx].joinedCampaigns = [];
      if (!accounts[idx].joinedCampaigns.includes(cleanCode)) {
        accounts[idx].joinedCampaigns.push(cleanCode);
      }
      if (accounts[idx].campaignProfiles && accounts[idx].campaignProfiles[cleanCode]) {
        delete accounts[idx].campaignProfiles[cleanCode];
      }
      this.saveAccounts(accounts);

      // Update campaign DM info
      const campaigns = this.getCampaigns();
      const campIdx = campaigns.findIndex((c) => c.code === cleanCode);
      if (campIdx !== -1) {
        campaigns[campIdx].dmId = accounts[idx].id;
        campaigns[campIdx].dmName = accounts[idx].characterName;
        campaigns[campIdx].dmEmail = accounts[idx].email;
        this.saveCampaigns(campaigns);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
      }
    }
  }

  static revokeDmOfCampaign(accountId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      if (accounts[idx].dmCampaigns) {
        accounts[idx].dmCampaigns = accounts[idx].dmCampaigns.filter((c) => c !== cleanCode);
      }
      this.saveAccounts(accounts);

      // If this account was the main dmId on the campaign, check if there are other DMs or update
      const campaigns = this.getCampaigns();
      const campIdx = campaigns.findIndex((c) => c.code === cleanCode);
      if (campIdx !== -1 && campaigns[campIdx].dmId === accountId) {
        const otherDm = accounts.find((a) => a.id !== accountId && a.dmCampaigns?.includes(cleanCode));
        if (otherDm) {
          campaigns[campIdx].dmId = otherDm.id;
          campaigns[campIdx].dmName = otherDm.characterName;
          campaigns[campIdx].dmEmail = otherDm.email;
        } else {
          campaigns[campIdx].dmId = undefined;
          campaigns[campIdx].dmName = undefined;
          campaigns[campIdx].dmEmail = undefined;
        }
        this.saveCampaigns(campaigns);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
      }
    }
  }

  static transferDmRole(fromAccountId: string, toAccountId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const fromIdx = accounts.findIndex((a) => a.id === fromAccountId);
    const toIdx = accounts.findIndex((a) => a.id === toAccountId);

    if (toIdx !== -1) {
      if (!accounts[toIdx].dmCampaigns) accounts[toIdx].dmCampaigns = [];
      if (!accounts[toIdx].dmCampaigns.includes(cleanCode)) {
        accounts[toIdx].dmCampaigns.push(cleanCode);
      }
      if (!accounts[toIdx].joinedCampaigns) accounts[toIdx].joinedCampaigns = [];
      if (!accounts[toIdx].joinedCampaigns.includes(cleanCode)) {
        accounts[toIdx].joinedCampaigns.push(cleanCode);
      }
    }

    if (fromIdx !== -1 && accounts[fromIdx].dmCampaigns) {
      accounts[fromIdx].dmCampaigns = accounts[fromIdx].dmCampaigns.filter((c) => c !== cleanCode);
    }

    this.saveAccounts(accounts);

    // Update campaign DM info
    if (toIdx !== -1) {
      const campaigns = this.getCampaigns();
      const campIdx = campaigns.findIndex((c) => c.code === cleanCode);
      if (campIdx !== -1) {
        campaigns[campIdx].dmId = accounts[toIdx].id;
        campaigns[campIdx].dmName = accounts[toIdx].characterName;
        campaigns[campIdx].dmEmail = accounts[toIdx].email;
        this.saveCampaigns(campaigns);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
    }
  }

  // Deduplicate and consolidate accounts by normalized email
  static deduplicateAccounts(accounts: UserAccount[]): { accounts: UserAccount[]; modified: boolean } {
    if (!Array.isArray(accounts)) return { accounts: [], modified: false };
    const emailMap = new Map<string, UserAccount>();
    const currentAccId = typeof window !== 'undefined'
      ? (localStorage.getItem("chronicle_global_active_user_id") || localStorage.getItem("chronicle_current_account_id"))
      : null;
    const deletedIds = new Set(this.getDeletedAccountIds().map((id) => id.toLowerCase()));
    let modified = false;

    // Filter out mock accounts and deleted accounts
    const cleanList = accounts.filter(
      (a) => a && a.id && !deletedIds.has(a.id.toLowerCase()) && !["usr_dm", "usr_eldrin", "usr_thorgar", "usr_lyra"].includes(a.id)
    );
    if (cleanList.length !== accounts.length) modified = true;

    cleanList.forEach((acc) => {
      const emailKey = (acc.email || "").trim().toLowerCase();
      if (!emailKey) {
        if (!emailMap.has(acc.id)) {
          emailMap.set(acc.id, { ...acc });
        }
        return;
      }

      if (!emailMap.has(emailKey)) {
        emailMap.set(emailKey, { ...acc });
      } else {
        // Duplicate account detected! Merge into single canonical record
        modified = true;
        const existing = emailMap.get(emailKey)!;
        // If acc is the currently active account, it takes highest precedence over existing
        const isAccCurrent = Boolean(currentAccId && acc.id === currentAccId);
        const primary = isAccCurrent ? acc : existing;
        const secondary = isAccCurrent ? existing : acc;

        const targetId = isAccCurrent ? acc.id : (existing.id || acc.id);

        const mergedJoined = Array.from(
          new Set([...(existing.joinedCampaigns || []), ...(acc.joinedCampaigns || [])])
        );
        const mergedDm = Array.from(
          new Set([...(existing.dmCampaigns || []), ...(acc.dmCampaigns || [])])
        );

        // Merge campaignProfiles per campaign key
        const allCampKeys = Array.from(
          new Set([
            ...Object.keys(existing.campaignProfiles || {}),
            ...Object.keys(acc.campaignProfiles || {}),
          ])
        );
        const mergedProfiles: Record<string, CampaignProfile> = {};
        allCampKeys.forEach((k) => {
          const pPrimary = primary.campaignProfiles?.[k];
          const pSecondary = secondary.campaignProfiles?.[k];
          if (!pSecondary) {
            mergedProfiles[k] = { ...pPrimary! };
          } else if (!pPrimary) {
            mergedProfiles[k] = { ...pSecondary };
          } else {
            const resolvedTags =
              (pPrimary.tags && pPrimary.tags.length > 0)
                ? pPrimary.tags
                : (pSecondary.tags && pSecondary.tags.length > 0 ? pSecondary.tags : []);
            const resolvedAliases =
              (pPrimary.aliases && pPrimary.aliases.length > 0)
                ? pPrimary.aliases
                : (pSecondary.aliases && pSecondary.aliases.length > 0 ? pSecondary.aliases : []);
            const resolvedStatus =
              (pPrimary.status && pPrimary.status !== 'active')
                ? pPrimary.status
                : (pSecondary.status || pPrimary.status || 'active');

            mergedProfiles[k] = {
              characterName: pPrimary.characterName || pSecondary.characterName || 'Personaggio',
              color: pPrimary.color || pSecondary.color || '#6366f1',
              avatarUrl: pPrimary.avatarUrl !== undefined ? pPrimary.avatarUrl : pSecondary.avatarUrl,
              status: resolvedStatus,
              tags: resolvedTags,
              aliases: resolvedAliases,
            };
          }
        });

        // Resolve merged color: primary color takes priority
        const chosenColor = primary.color || secondary.color || '#6366f1';
        const chosenName = primary.characterName || secondary.characterName || 'Giocatore';
        const chosenAvatar = primary.avatarUrl !== undefined ? primary.avatarUrl : (secondary.avatarUrl || '');
        const finalTags =
          (primary.tags && primary.tags.length > 0)
            ? primary.tags
            : (secondary.tags && secondary.tags.length > 0 ? secondary.tags : []);
        const finalAliases =
          (primary.aliases && primary.aliases.length > 0)
            ? primary.aliases
            : (secondary.aliases && secondary.aliases.length > 0 ? secondary.aliases : []);

        emailMap.set(emailKey, {
          ...secondary,
          ...primary,
          id: targetId,
          email: emailKey,
          characterName: chosenName,
          color: chosenColor,
          avatarUrl: chosenAvatar,
          isDm: Boolean(primary.isDm || secondary.isDm || mergedDm.length > 0),
          joinedCampaigns: mergedJoined,
          dmCampaigns: mergedDm,
          campaignProfiles: mergedProfiles,
          lastCampaignCode: primary.lastCampaignCode || secondary.lastCampaignCode,
          tags: finalTags,
          aliases: finalAliases,
        });
      }
    });

    const result = Array.from(emailMap.values());
    return { accounts: result, modified };
  }

  static cleanDuplicateAccounts(): number {
    const raw = this.getAccounts();
    const { accounts: deduped, modified } = this.deduplicateAccounts(raw);
    const countRemoved = raw.length - deduped.length;
    if (modified || countRemoved > 0) {
      this.saveAccounts(deduped);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_accounts_updated'));
      }
    }
    return countRemoved;
  }

  // === USER ACCOUNTS & AUTH ===
  static getAccounts(): UserAccount[] {
    return getCached("chronicle_global_user_accounts", () => {
      const saved = localStorage.getItem("chronicle_global_user_accounts");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const { accounts: deduped, modified } = this.deduplicateAccounts(parsed);
            if (modified) {
              safeLocalStorageSetItem(
                "chronicle_global_user_accounts",
                JSON.stringify(deduped),
              );
              CloudSyncService.syncAccountsToCloud(deduped);
            }
            return deduped;
          }
        } catch {}
      }
      return [];
    });
  }

  static saveAccounts(accounts: UserAccount[]) {
    setCached("chronicle_global_user_accounts", accounts);
    safeLocalStorageSetItem(
      "chronicle_global_user_accounts",
      JSON.stringify(accounts),
    );
    CloudSyncService.syncAccountsToCloud(accounts);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
    }
  }

  static saveAccountsLocalOnly(accounts: UserAccount[]) {
    setCached("chronicle_global_user_accounts", accounts);
    safeLocalStorageSetItem(
      "chronicle_global_user_accounts",
      JSON.stringify(accounts),
    );
  }

  static registerAccount(data: {
    email: string;
    password: string;
    characterName: string;
    color?: string;
    avatarUrl?: string;
  }): { success: boolean; account?: UserAccount; error?: string } {
    const email = data.email.trim().toLowerCase();
    const password = data.password.trim();
    const characterName = data.characterName.trim();

    if (!email || !email.includes("@")) {
      return { success: false, error: "Inserisci un indirizzo email valido." };
    }
    if (!password || password.length < 4) {
      return {
        success: false,
        error: "La password deve contenere almeno 4 caratteri.",
      };
    }
    if (!characterName) {
      return { success: false, error: "Inserisci il tuo nome o username." };
    }

    const accounts = this.getAccounts();
    const existing = accounts.find((a) => a.email.toLowerCase() === email);
    if (existing) {
      return {
        success: false,
        error: "Esiste già un account con questa email.",
      };
    }

    const newAccount: UserAccount = {
      id: "usr_" + Date.now(),
      email,
      password,
      characterName,
      isDm: false,
      dmCampaigns: [],
      color: data.color || "#6366f1",
      avatarUrl: data.avatarUrl || "",
      createdAt: new Date().toISOString(),
      joinedCampaigns: [],
      campaignProfiles: {},
    };

    const updated = [...accounts, newAccount];
    this.saveAccounts(updated);
    this.setCurrentAccount(newAccount.id);
    this.setActiveCampaignCode(null);

    return { success: true, account: newAccount };
  }

  static addUnregisteredPlayer(characterName: string, color = "#6366f1"): UserAccount {
    const cleanName = characterName.trim();
    const activeCode = this.getActiveCampaignCode();
    const cleanCode = (activeCode || "").trim().toUpperCase();
    const accounts = this.getAccounts();

    // Check if an account or unregistered player with exact character name already exists
    const existing = accounts.find(
      (a) => a.characterName.toLowerCase().trim() === cleanName.toLowerCase()
    );
    if (existing) {
      if (cleanCode && (!existing.joinedCampaigns || !existing.joinedCampaigns.includes(cleanCode))) {
        if (!existing.joinedCampaigns) existing.joinedCampaigns = [];
        existing.joinedCampaigns.push(cleanCode);
        this.saveAccounts(accounts);
      }
      return existing;
    }

    const safeSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const newAccount: UserAccount = {
      id: "usr_pg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      email: `${safeSlug || "player"}@campaign.local`,
      password: "",
      characterName: cleanName,
      isDm: false,
      dmCampaigns: [],
      color,
      avatarUrl: "",
      createdAt: new Date().toISOString(),
      joinedCampaigns: cleanCode ? [cleanCode] : [],
      campaignProfiles: cleanCode
        ? {
            [cleanCode]: {
              characterName: cleanName,
              avatarUrl: "",
              color,
              status: "active",
              tags: [],
            },
          }
        : {},
    };

    const updated = [...accounts, newAccount];
    this.saveAccounts(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
    return newAccount;
  }

  static getCampaignProfile(
    accountId: string,
    campaignCode: string,
  ): CampaignProfile | null {
    const accounts = this.getAccounts();
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc || !acc.campaignProfiles) return null;
    return acc.campaignProfiles[campaignCode.trim().toUpperCase()] || null;
  }

  static setCampaignProfile(
    accountId: string,
    campaignCode: string,
    profile: Partial<CampaignProfile>,
  ): UserAccount | null {
    const cleanCode = campaignCode.trim().toUpperCase();
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === accountId);
    if (index === -1) return null;

    const account = { ...accounts[index] };
    if (!account.campaignProfiles) account.campaignProfiles = {};

    const prev = account.campaignProfiles[cleanCode] || {
      characterName: profile.characterName?.trim() || '',
      avatarUrl: account.avatarUrl || "",
      color: account.color || "#6366f1",
      status: profile.status || "active",
      tags: [],
    };

    account.campaignProfiles[cleanCode] = {
      characterName:
        profile.characterName !== undefined
          ? profile.characterName.trim()
          : prev.characterName,
      avatarUrl:
        profile.avatarUrl !== undefined
          ? profile.avatarUrl.trim()
          : prev.avatarUrl,
      color: profile.color !== undefined ? profile.color : prev.color,
      status: profile.status !== undefined ? profile.status : (prev.status || "active"),
      tags: profile.tags !== undefined ? profile.tags : (prev.tags || []),
    };

    // Do NOT overwrite other campaigns or the global user name if already set
    if (!account.characterName && profile.characterName) {
      account.characterName = profile.characterName.trim();
    }
    if (!account.avatarUrl && profile.avatarUrl) {
      account.avatarUrl = profile.avatarUrl.trim();
    }

    accounts[index] = account;
    this.saveAccounts(accounts);
    if (profile.characterName) {
      this.reconcileUnregisteredRelations(accountId, profile.characterName);
    }
    return accounts[index];
  }

  static setPlayerPartyStatus(
    accountId: string,
    campaignCode: string,
    status: PlayerPartyStatus,
    playerEmail?: string
  ): boolean {
    const cleanCode = (campaignCode || this.getActiveCampaignCode() || "").trim().toUpperCase();
    const accounts = this.getAccounts();
    const index = accounts.findIndex(
      (a) =>
        a.id === accountId ||
        (playerEmail && a.email && a.email.toLowerCase() === playerEmail.trim().toLowerCase()) ||
        (a.email && a.email.toLowerCase() === accountId.toLowerCase())
    );
    if (index === -1) return false;

    const account = { ...accounts[index] };
    if (!account.campaignProfiles) account.campaignProfiles = {};
    const prev = (cleanCode ? account.campaignProfiles[cleanCode] : null) || {
      characterName: account.characterName,
      avatarUrl: account.avatarUrl || "",
      color: account.color || "#6366f1",
      status: "active",
      tags: [],
      aliases: [],
    };

    if (cleanCode) {
      account.campaignProfiles[cleanCode] = {
        ...prev,
        status,
      };
    }
    accounts[index] = account;
    this.saveAccounts(accounts);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
    return true;
  }

  static setPlayerTags(
    accountId: string,
    campaignCode: string,
    tags: string[],
    playerEmail?: string
  ): boolean {
    const cleanCode = (campaignCode || this.getActiveCampaignCode() || "").trim().toUpperCase();
    const accounts = this.getAccounts();
    const index = accounts.findIndex(
      (a) =>
        a.id === accountId ||
        (playerEmail && a.email && a.email.toLowerCase() === playerEmail.trim().toLowerCase()) ||
        (a.email && a.email.toLowerCase() === accountId.toLowerCase())
    );
    if (index === -1) return false;

    const account = { ...accounts[index] };
    if (!account.campaignProfiles) account.campaignProfiles = {};
    const prev = (cleanCode ? account.campaignProfiles[cleanCode] : null) || {
      characterName: account.characterName,
      avatarUrl: account.avatarUrl || "",
      color: account.color || "#6366f1",
      status: "active",
      tags: [],
      aliases: [],
    };

    const cleanTags = Array.from(
      new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))
    );

    if (cleanCode) {
      account.campaignProfiles[cleanCode] = {
        ...prev,
        tags: cleanTags,
      };
    }
    // Also save directly on account.tags so it is immediately accessible
    account.tags = cleanTags;

    accounts[index] = account;
    this.saveAccounts(accounts);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
    return true;
  }

  static addPlayerAlias(
    accountId: string,
    campaignCode: string,
    rawAlias: string,
    playerEmail?: string
  ): boolean {
    const alias = rawAlias.trim();
    if (!alias) return false;
    const cleanCode = (campaignCode || this.getActiveCampaignCode() || "").trim().toUpperCase();
    const accounts = this.getAccounts();
    const index = accounts.findIndex(
      (a) =>
        a.id === accountId ||
        (playerEmail && a.email && a.email.toLowerCase() === playerEmail.trim().toLowerCase()) ||
        (a.email && a.email.toLowerCase() === accountId.toLowerCase())
    );
    if (index === -1) return false;

    const account = { ...accounts[index] };
    if (!account.campaignProfiles) account.campaignProfiles = {};
    const prev = (cleanCode ? account.campaignProfiles[cleanCode] : null) || {
      characterName: account.characterName,
      avatarUrl: account.avatarUrl || "",
      color: account.color || "#6366f1",
      status: "active",
      tags: [],
      aliases: [],
    };

    const currentAliases = Array.isArray(prev.aliases) ? [...prev.aliases] : [];
    if (!currentAliases.some((a) => a.toLowerCase() === alias.toLowerCase())) {
      currentAliases.push(alias);
      if (cleanCode) {
        account.campaignProfiles[cleanCode] = {
          ...prev,
          aliases: currentAliases,
        };
      }
      account.aliases = currentAliases;
      accounts[index] = account;
      this.saveAccounts(accounts);
      cachedEntityLookupMap = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      }
      return true;
    }
    return false;
  }

  static deleteAccount(accountId: string): boolean {
    if (!accountId) return false;
    this.addDeletedAccountId(accountId);
    const rawAccounts = this.getAccounts();
    const targetAccount = rawAccounts.find((a) => a.id === accountId);
    if (!targetAccount) return false;

    // Filter out deleted account
    const updatedAccounts = rawAccounts.filter((a) => a.id !== accountId);

    // Clean up any campaign dmId or references and record expulsion on all campaigns
    const campaigns = this.getCampaigns();
    let campaignsModified = false;
    campaigns.forEach((c) => {
      const currentExpelled = c.expelledAccountIds || [];
      if (!currentExpelled.includes(accountId)) {
        c.expelledAccountIds = [...currentExpelled, accountId];
        campaignsModified = true;
      }
      if (c.dmId === accountId) {
        const otherDm = updatedAccounts.find(
          (a) => a.id !== accountId && a.dmCampaigns?.some((dmCode) => dmCode.toUpperCase() === c.code.toUpperCase())
        );
        if (otherDm) {
          c.dmId = otherDm.id;
          c.dmName = otherDm.characterName;
          c.dmEmail = otherDm.email;
        } else {
          c.dmId = undefined;
          c.dmName = undefined;
          c.dmEmail = undefined;
        }
        campaignsModified = true;
      }
    });

    if (campaignsModified) {
      this.saveCampaigns(campaigns);
      CloudSyncService.syncCampaignsToCloud(campaigns);
    }

    this.saveAccounts(updatedAccounts);
    CloudSyncService.syncAccountsToCloud(updatedAccounts);
    CloudSyncService.triggerCloudSave();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_campaigns_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
    return true;
  }

  static removePlayerFromCampaign(accountId: string, code: string): boolean {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      if (accounts[idx].joinedCampaigns) {
        accounts[idx].joinedCampaigns = accounts[idx].joinedCampaigns.filter(
          (c) => c.toUpperCase() !== cleanCode
        );
      }
      if (accounts[idx].dmCampaigns) {
        accounts[idx].dmCampaigns = accounts[idx].dmCampaigns.filter(
          (c) => c.toUpperCase() !== cleanCode
        );
      }
      if (accounts[idx].campaignProfiles) {
        Object.keys(accounts[idx].campaignProfiles).forEach((k) => {
          if (k.toUpperCase() === cleanCode) {
            delete accounts[idx].campaignProfiles[k];
          }
        });
      }
      if (accounts[idx].lastCampaignCode?.toUpperCase() === cleanCode) {
        accounts[idx].lastCampaignCode = undefined;
      }
      this.saveAccounts(accounts);
      CloudSyncService.syncAccountsToCloud(accounts);
    }

    // Persist expulsion in CampaignMeta so other sync clients and queries immediately exclude this user
    const campaigns = this.getCampaigns();
    const campIdx = campaigns.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (campIdx !== -1) {
      const currentExpelled = campaigns[campIdx].expelledAccountIds || [];
      if (!currentExpelled.includes(accountId)) {
        campaigns[campIdx].expelledAccountIds = [...currentExpelled, accountId];
      }
      if (campaigns[campIdx].dmId === accountId) {
        const otherDm = accounts.find(
          (a) => a.id !== accountId && a.dmCampaigns?.some((dmCode) => dmCode.toUpperCase() === cleanCode)
        );
        if (otherDm) {
          campaigns[campIdx].dmId = otherDm.id;
          campaigns[campIdx].dmName = otherDm.characterName;
          campaigns[campIdx].dmEmail = otherDm.email;
        } else {
          campaigns[campIdx].dmId = undefined;
          campaigns[campIdx].dmName = undefined;
          campaigns[campIdx].dmEmail = undefined;
        }
      }
      this.saveCampaigns(campaigns);
      CloudSyncService.syncCampaignsToCloud(campaigns);
    }

    // Immediately trigger cloud save so campaign payload is updated in Firestore
    CloudSyncService.triggerCloudSave();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_campaigns_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
    return true;
  }

  static joinCampaign(accountId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      if (!accounts[idx].joinedCampaigns) accounts[idx].joinedCampaigns = [];
      if (!accounts[idx].joinedCampaigns.includes(cleanCode)) {
        accounts[idx].joinedCampaigns.push(cleanCode);
      }
      accounts[idx].lastCampaignCode = cleanCode;
      this.saveAccounts(accounts);
    }
    const campaigns = this.getCampaigns();
    const campIdx = campaigns.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (campIdx === -1) {
      campaigns.push({
        code: cleanCode,
        name: `Campagna ${cleanCode}`,
        createdAt: new Date().toISOString(),
        expelledAccountIds: [],
      });
      this.saveCampaigns(campaigns);
      CloudSyncService.syncCampaignsToCloud(campaigns);
    } else if (campaigns[campIdx].expelledAccountIds?.includes(accountId)) {
      campaigns[campIdx].expelledAccountIds = campaigns[campIdx].expelledAccountIds!.filter((id) => id !== accountId);
      this.saveCampaigns(campaigns);
      CloudSyncService.syncCampaignsToCloud(campaigns);
    }
    localStorage.setItem(
      `chronicle_user_${accountId}_active_campaign`,
      cleanCode,
    );
    setCached(`chronicle_user_${accountId}_active_campaign`, cleanCode);
    localStorage.setItem("chronicle_current_campaign", cleanCode);
    setCached("chronicle_current_campaign", cleanCode);
  }

  static leaveCampaign(accountId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      if (accounts[idx].joinedCampaigns) {
        accounts[idx].joinedCampaigns = accounts[idx].joinedCampaigns.filter(
          (c) => c !== cleanCode,
        );
      }
      if (accounts[idx].dmCampaigns) {
        accounts[idx].dmCampaigns = accounts[idx].dmCampaigns.filter(
          (c) => c !== cleanCode,
        );
      }
      if (accounts[idx].campaignProfiles && accounts[idx].campaignProfiles[cleanCode]) {
        delete accounts[idx].campaignProfiles[cleanCode];
      }
      if (accounts[idx].lastCampaignCode === cleanCode) {
        accounts[idx].lastCampaignCode = undefined;
      }
      this.saveAccounts(accounts);
    }

    // If active campaign was this one, reset it
    if (this.getActiveCampaignCode() === cleanCode) {
      this.setActiveCampaignCode(null);
    }

    // If this account was the main dmId on the campaign, check if there is another DM or clear
    const campaigns = this.getCampaigns();
    const campIdx = campaigns.findIndex((c) => c.code === cleanCode);
    if (campIdx !== -1 && campaigns[campIdx].dmId === accountId) {
      const otherDm = accounts.find((a) => a.id !== accountId && a.dmCampaigns?.includes(cleanCode));
      if (otherDm) {
        campaigns[campIdx].dmId = otherDm.id;
        campaigns[campIdx].dmName = otherDm.characterName;
        campaigns[campIdx].dmEmail = otherDm.email;
      } else {
        campaigns[campIdx].dmId = undefined;
        campaigns[campIdx].dmName = undefined;
        campaigns[campIdx].dmEmail = undefined;
      }
      this.saveCampaigns(campaigns);
    }

    // Clean user's active campaign storage keys
    localStorage.removeItem(`chronicle_user_${accountId}_active_campaign`);
    setCached(`chronicle_user_${accountId}_active_campaign`, null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_campaigns_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
    }
  }

  static handleEmailAuthSuccess(firebaseUser: {
    uid: string;
    email: string;
    characterName?: string;
    color?: string;
    avatarUrl?: string;
  }): { success: boolean; account: UserAccount } {
    const email = firebaseUser.email.toLowerCase().trim();
    const accounts = this.getAccounts();

    // Match by existing account email or id
    let existingIndex = accounts.findIndex(
      (a) => a.id === `usr_${firebaseUser.uid}` || (a.email && a.email.toLowerCase() === email)
    );

    let userAcc: UserAccount;

    if (existingIndex >= 0) {
      const existing = accounts[existingIndex];
      userAcc = {
        ...existing,
        email: existing.email || email,
        characterName: existing.characterName || firebaseUser.characterName || email.split('@')[0],
        avatarUrl: firebaseUser.avatarUrl !== undefined ? firebaseUser.avatarUrl : existing.avatarUrl || '',
        color: firebaseUser.color || existing.color || '#6366f1',
        authProvider: 'password',
        // Scrub plaintext password
        password: '',
      };
      accounts[existingIndex] = userAcc;
    } else {
      userAcc = {
        id: `usr_${firebaseUser.uid}`,
        email,
        password: '',
        characterName: firebaseUser.characterName || email.split('@')[0] || 'Giocatore',
        isDm: false,
        dmCampaigns: [],
        color: firebaseUser.color || '#6366f1',
        avatarUrl: firebaseUser.avatarUrl || '',
        createdAt: new Date().toISOString(),
        joinedCampaigns: [],
        campaignProfiles: {},
        authProvider: 'password',
      };
      accounts.push(userAcc);
    }

    this.saveAccounts(accounts);
    this.setCurrentAccount(userAcc.id);

    // On login, preserve or restore active campaign selection if available
    const existingActiveEmail = this.getActiveCampaignCode();
    const candidateCodeEmail =
      existingActiveEmail ||
      userAcc.lastCampaignCode ||
      (userAcc.joinedCampaigns && userAcc.joinedCampaigns[0]) ||
      (userAcc.dmCampaigns && userAcc.dmCampaigns[0]) ||
      null;

    if (candidateCodeEmail) {
      this.setActiveCampaignCode(candidateCodeEmail);
      CloudSyncService.init();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_changed", {
          detail: { campaignCode: candidateCodeEmail },
        }),
      );
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
    }

    return { success: true, account: userAcc };
  }

  static handleGoogleAuthSuccess(googleUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }): { success: boolean; account: UserAccount } {
    const email = (googleUser.email || `${googleUser.uid}@google.auth`).toLowerCase().trim();
    const accounts = this.getAccounts();

    // Match by Google UID first, or by existing email address
    let existingIndex = accounts.findIndex(
      (a) => a.id === `usr_g_${googleUser.uid}` || (a.email && a.email.toLowerCase() === email)
    );

    let userAcc: UserAccount;

    if (existingIndex >= 0) {
      const existing = accounts[existingIndex];
      userAcc = {
        ...existing,
        email: existing.email || email,
        characterName: existing.characterName || googleUser.displayName || 'Giocatore',
        avatarUrl: googleUser.photoURL || existing.avatarUrl || '',
        authProvider: 'google',
        // Clear plaintext password for enhanced privacy and security
        password: '',
      };
      accounts[existingIndex] = userAcc;
    } else {
      userAcc = {
        id: `usr_g_${googleUser.uid}`,
        email,
        password: '',
        characterName: googleUser.displayName || email.split('@')[0] || 'Giocatore',
        isDm: false,
        dmCampaigns: [],
        color: '#6366f1',
        avatarUrl: googleUser.photoURL || '',
        createdAt: new Date().toISOString(),
        joinedCampaigns: [],
        campaignProfiles: {},
        authProvider: 'google',
      };
      accounts.push(userAcc);
    }

    this.saveAccounts(accounts);
    this.setCurrentAccount(userAcc.id);

    // On login, preserve or restore active campaign selection if available
    const existingActiveGoogle = this.getActiveCampaignCode();
    const candidateCodeGoogle =
      existingActiveGoogle ||
      userAcc.lastCampaignCode ||
      (userAcc.joinedCampaigns && userAcc.joinedCampaigns[0]) ||
      (userAcc.dmCampaigns && userAcc.dmCampaigns[0]) ||
      null;

    if (candidateCodeGoogle) {
      this.setActiveCampaignCode(candidateCodeGoogle);
      CloudSyncService.init();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_changed", {
          detail: { campaignCode: candidateCodeGoogle },
        }),
      );
      window.dispatchEvent(new CustomEvent("chronicle_accounts_updated"));
    }

    return { success: true, account: userAcc };
  }

  static authenticate(
    emailInput: string,
    passwordInput: string,
  ): { success: boolean; account?: UserAccount; error?: string } {
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput.trim();

    const accounts = this.getAccounts();
    const match = accounts.find(
      (a) => a.email.toLowerCase() === email && a.password === password,
    );

    if (!match) {
      return { success: false, error: "Email o password non corretti." };
    }

    this.setCurrentAccount(match.id);

    // On login, reset active campaign selection so user always lands on the Campaign Selector list
    localStorage.removeItem(`chronicle_user_${match.id}_active_campaign`);
    setCached(`chronicle_user_${match.id}_active_campaign`, null);
    localStorage.removeItem("chronicle_current_campaign");
    setCached("chronicle_current_campaign", null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_changed", {
          detail: { campaignCode: null },
        }),
      );
    }

    return { success: true, account: match };
  }

  static getCurrentAccount(): UserAccount | null {
    const activeId = localStorage.getItem("chronicle_global_active_user_id");
    if (!activeId) return null;

    const accounts = this.getAccounts();
    return accounts.find((a) => a.id === activeId) || null;
  }

  static setCurrentAccount(accountId: string) {
    localStorage.setItem("chronicle_global_active_user_id", accountId);
    const acc = this.getAccounts().find((a) => a.id === accountId);
    if (acc) {
      this.hydrateUserPreferences(acc);
    }
  }

  static getUserPreferences(accountId?: string): UserPreferences {
    const targetId = accountId || localStorage.getItem("chronicle_global_active_user_id");
    const defaultPrefs: UserPreferences = {
      theme: {
        colorPalette: localStorage.getItem("chronicle_color_palette") || "indigo",
        darkMode: localStorage.getItem("chronicle_dark_mode") !== "false",
        campaignTitleFont: (localStorage.getItem("chronicle_campaign_title_font") as any) || "cinzel",
        campaignTitleEffect: (localStorage.getItem("chronicle_campaign_title_effect") as any) || "glow",
        titleUppercase: localStorage.getItem("chronicle_campaign_title_uppercase") !== "false",
        titleTracking: (localStorage.getItem("chronicle_campaign_title_tracking") as any) || "normal",
      },
      ai: {
        preferredProvider: (localStorage.getItem("chronicle_oracle_provider") as any) || "gemini",
        oracleModel: localStorage.getItem("chronicle_oracle_gemini_model") || "gemini-3.8-flash",
        extractorModel: localStorage.getItem("chronicle_extraction_gemini_model") || "gemini-3.8-flash",
        temperature: 0.7,
      },
      reading: {
        pillTagsEnabled: localStorage.getItem("chronicle_show_mention_tags") !== "false",
        dossierViewMode: (localStorage.getItem("chronicle_profile_view_mode") as any) || "edit",
        includeDmAsPlayer: localStorage.getItem("chronicle_reading_include_dm") !== "false",
      },
      themeId: localStorage.getItem("chronicle_theme_class") || "warlock",
      aiProvider: (localStorage.getItem("chronicle_oracle_provider") as any) || "gemini",
      oracleGeminiModel: localStorage.getItem("chronicle_oracle_gemini_model") || "gemini-3.8-flash",
      oracleCloudflareModel: localStorage.getItem("chronicle_oracle_cloudflare_model") || "@cf/meta/llama-3.3-70b-instruct-fp8",
      oracleOpenrouterModel: localStorage.getItem("chronicle_oracle_openrouter_model") || "openrouter/free",
      extractionGeminiModel: localStorage.getItem("chronicle_extraction_gemini_model") || "gemini-3.8-flash",
      extractionCloudflareModel: localStorage.getItem("chronicle_extraction_cloudflare_model") || "@cf/meta/llama-3.3-70b-instruct-fp8",
      extractionOpenrouterModel: localStorage.getItem("chronicle_extraction_openrouter_model") || "openrouter/free",
      showMentionTags: localStorage.getItem("chronicle_show_mention_tags") !== "false",
      viewMode: (localStorage.getItem("chronicle_profile_view_mode") as any) || "edit",
    };

    if (!targetId) return defaultPrefs;
    const accounts = this.getAccounts();
    const match = accounts.find((a) => a.id === targetId);
    if (!match?.preferences) return defaultPrefs;

    return {
      ...defaultPrefs,
      ...match.preferences,
    };
  }

  static saveUserPreferences(
    updates: Partial<UserPreferences>,
    accountId?: string
  ): UserPreferences {
    const targetId = accountId || localStorage.getItem("chronicle_global_active_user_id");
    const currentPrefs = this.getUserPreferences(targetId || undefined);
    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Keep localStorage in sync immediately for fast offline & synchronous access
    try {
      if (updatedPrefs.themeId) {
        localStorage.setItem("chronicle_theme_class", updatedPrefs.themeId);
      }
      if (updatedPrefs.aiProvider) {
        localStorage.setItem("chronicle_oracle_provider", updatedPrefs.aiProvider);
        localStorage.setItem("chronicle_extraction_provider", updatedPrefs.aiProvider);
      }
      if (updatedPrefs.oracleGeminiModel) {
        localStorage.setItem("chronicle_oracle_gemini_model", updatedPrefs.oracleGeminiModel);
      }
      if (updatedPrefs.oracleCloudflareModel) {
        localStorage.setItem("chronicle_oracle_cloudflare_model", updatedPrefs.oracleCloudflareModel);
      }
      if (updatedPrefs.oracleOpenrouterModel) {
        localStorage.setItem("chronicle_oracle_openrouter_model", updatedPrefs.oracleOpenrouterModel);
      }
      if (updatedPrefs.extractionGeminiModel) {
        localStorage.setItem("chronicle_extraction_gemini_model", updatedPrefs.extractionGeminiModel);
      }
      if (updatedPrefs.extractionCloudflareModel) {
        localStorage.setItem("chronicle_extraction_cloudflare_model", updatedPrefs.extractionCloudflareModel);
      }
      if (updatedPrefs.extractionOpenrouterModel) {
        localStorage.setItem("chronicle_extraction_openrouter_model", updatedPrefs.extractionOpenrouterModel);
      }
      if (updatedPrefs.showMentionTags !== undefined) {
        localStorage.setItem("chronicle_show_mention_tags", String(updatedPrefs.showMentionTags));
      }
      if (updatedPrefs.viewMode) {
        localStorage.setItem("chronicle_profile_view_mode", updatedPrefs.viewMode);
      }
    } catch {}

    if (targetId) {
      const accounts = this.getAccounts();
      const idx = accounts.findIndex((a) => a.id === targetId);
      if (idx !== -1) {
        accounts[idx] = {
          ...accounts[idx],
          preferences: updatedPrefs,
        };
        this.saveAccounts(accounts);
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("chronicle_preferences_updated", {
            detail: { preferences: updatedPrefs },
          })
        );
      } catch {}
    }

    return updatedPrefs;
  }

  static hydrateUserPreferences(account: UserAccount) {
    if (!account?.preferences) return;
    const p = account.preferences;
    try {
      if (p.themeId) {
        localStorage.setItem("chronicle_theme_class", p.themeId);
        import("../lib/theme").then(({ applyTheme }) => applyTheme(p.themeId!));
      }
      if (p.aiProvider) {
        localStorage.setItem("chronicle_oracle_provider", p.aiProvider);
        localStorage.setItem("chronicle_extraction_provider", p.aiProvider);
      }
      if (p.oracleGeminiModel) {
        localStorage.setItem("chronicle_oracle_gemini_model", p.oracleGeminiModel);
      }
      if (p.oracleCloudflareModel) {
        localStorage.setItem("chronicle_oracle_cloudflare_model", p.oracleCloudflareModel);
      }
      if (p.oracleOpenrouterModel) {
        localStorage.setItem("chronicle_oracle_openrouter_model", p.oracleOpenrouterModel);
      }
      if (p.extractionGeminiModel) {
        localStorage.setItem("chronicle_extraction_gemini_model", p.extractionGeminiModel);
      }
      if (p.extractionCloudflareModel) {
        localStorage.setItem("chronicle_extraction_cloudflare_model", p.extractionCloudflareModel);
      }
      if (p.extractionOpenrouterModel) {
        localStorage.setItem("chronicle_extraction_openrouter_model", p.extractionOpenrouterModel);
      }
      if (p.showMentionTags !== undefined) {
        localStorage.setItem("chronicle_show_mention_tags", String(p.showMentionTags));
      }
      if (p.viewMode) {
        localStorage.setItem("chronicle_profile_view_mode", p.viewMode);
      }
    } catch {}
  }

  static clearCurrentAccount() {
    const current = this.getCurrentAccount();
    if (current) {
      localStorage.removeItem(`chronicle_user_${current.id}_active_campaign`);
      setCached(`chronicle_user_${current.id}_active_campaign`, null);
    }
    localStorage.removeItem("chronicle_global_active_user_id");
    localStorage.removeItem("chronicle_current_campaign");
    setCached("chronicle_current_campaign", null);
    memoryCache.clear();
    cachedEntityLookupMap = null;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_campaign_changed", {
          detail: { campaignCode: null },
        }),
      );
    }
  }

  static updateAccount(
    accountId: string,
    updates: Partial<UserAccount>,
  ): UserAccount | null {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === accountId);
    if (index === -1) return null;

    const account = { ...accounts[index] };
    const activeCode = this.getActiveCampaignCode();

    if (updates.characterName !== undefined) account.characterName = updates.characterName.trim();
    if (updates.avatarUrl !== undefined) account.avatarUrl = updates.avatarUrl.trim();
    if (updates.color !== undefined) account.color = updates.color;

    if (activeCode) {
      if (!account.campaignProfiles) account.campaignProfiles = {};
      const prevProfile: Partial<CampaignProfile> = account.campaignProfiles[activeCode] || {};
      account.campaignProfiles[activeCode] = {
        characterName: updates.characterName !== undefined ? updates.characterName.trim() : (prevProfile.characterName || account.characterName),
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : (prevProfile.avatarUrl !== undefined ? prevProfile.avatarUrl : account.avatarUrl),
        color: updates.color !== undefined ? updates.color : (prevProfile.color || account.color || '#6366f1'),
      };
    }

    accounts[index] = account;
    this.saveAccounts(accounts);
    return accounts[index];
  }

  static accountToPlayer(account: UserAccount): Player {
    const activeCode = CampaignManager.getActiveCampaignCode();
    const cleanCode = (activeCode || '').trim().toUpperCase();
    const campaign = cleanCode
      ? this.getCampaigns().find((c) => c.code.toUpperCase() === cleanCode)
      : null;
    const profile =
      cleanCode && account.campaignProfiles
        ? (account.campaignProfiles[cleanCode] ||
           (activeCode ? account.campaignProfiles[activeCode] : null) ||
           Object.entries(account.campaignProfiles).find(([k]) => k.toUpperCase() === cleanCode)?.[1])
        : null;

    const isDm = Boolean(
      (cleanCode &&
        account.dmCampaigns &&
        account.dmCampaigns.some((c) => c.toUpperCase() === cleanCode)) ||
      (campaign?.dmId && campaign.dmId === account.id) ||
      (campaign?.dmEmail && account.email && campaign.dmEmail.toLowerCase() === account.email.toLowerCase()) ||
      account.isDm,
    );

    const resolvedColor = profile?.color || account.color || '#6366f1';
    const status: PlayerPartyStatus = profile?.status || 'active';
    const resolvedAliases: string[] = (profile?.aliases && profile.aliases.length > 0)
      ? profile.aliases
      : (account.aliases || []);
    const resolvedTags: string[] = (profile?.tags && profile.tags.length > 0)
      ? profile.tags
      : (account.tags || []);

    return {
      _id: account.id,
      characterName: profile?.characterName || account.characterName,
      email: account.email,
      isDm,
      color: resolvedColor,
      avatarUrl: profile?.avatarUrl !== undefined ? profile.avatarUrl : account.avatarUrl,
      status,
      tags: resolvedTags,
      aliases: resolvedAliases,
    };
  }

  static getStoredPlayers(): Player[] {
    const activeCode = this.getActiveCampaignCode();
    if (!activeCode) return [];
    const cleanActiveCode = activeCode.trim().toUpperCase();
    const campaign = this.getCampaigns().find((c) => c.code.toUpperCase() === cleanActiveCode);
    const expelledSet = new Set(
      (campaign?.expelledAccountIds || []).map((id) => id.toLowerCase())
    );
    const deletedAccounts = new Set(this.getDeletedAccountIds().map((id) => id.toLowerCase()));

    const accounts = this.getAccounts();
    return accounts
      .filter((a) => {
        if (!a || !a.id) return false;
        const lowId = a.id.toLowerCase();
        if (deletedAccounts.has(lowId) || expelledSet.has(lowId)) return false;
        const isJoined = a.joinedCampaigns?.some((c) => c.toUpperCase() === cleanActiveCode);
        const isDm = a.dmCampaigns?.some((c) => c.toUpperCase() === cleanActiveCode) || campaign?.dmId === a.id;
        return Boolean(isJoined || isDm);
      })
      .map((a) => this.accountToPlayer(a));
  }

  static getPlayers(): Player[] {
    return this.getStoredPlayers();
  }

  // === CAMPAIGN CALENDAR ===
  static getCalendar(): CampaignCalendar {
    const key = this.getStorageKey("calendar");
    return getCached(key, () => {
      let cal: CampaignCalendar = HARPTOS_CALENDAR;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && Array.isArray(parsed.months) && parsed.months.length > 0) {
            cal = {
              ...HARPTOS_CALENDAR,
              ...parsed,
              currentYear: typeof parsed.currentYear === "number" ? parsed.currentYear : 1492,
              currentDay: typeof parsed.currentDay === "number" ? parsed.currentDay : 1,
              currentMonthIndex: typeof parsed.currentMonthIndex === "number" ? parsed.currentMonthIndex : 0,
            };
          }
        } catch {}
      }

      // Safely auto-reconcile with sessions by reading raw sessions directly from localStorage to avoid circular recursion
      try {
        const rawSessionsStr = localStorage.getItem(this.getStorageKey("sessions"));
        if (rawSessionsStr) {
          const rawSessions = JSON.parse(rawSessionsStr);
          if (Array.isArray(rawSessions) && rawSessions.length > 0) {
            for (const s of rawSessions) {
              if (s && s.loreYear && s.loreMonth && s.loreStartDay !== undefined) {
                const monthIdx = cal.months.findIndex(
                  (m) => m && m.name && m.name.toLowerCase().trim() === String(s.loreMonth).toLowerCase().trim()
                );
                const targetDay = s.loreEndDay || s.loreStartDay || 1;

                // If session date is higher than current calendar date, advance calendar
                if (
                  s.loreYear > cal.currentYear ||
                  (s.loreYear === cal.currentYear && monthIdx > cal.currentMonthIndex) ||
                  (s.loreYear === cal.currentYear && monthIdx === cal.currentMonthIndex && targetDay > cal.currentDay)
                ) {
                  cal.currentYear = s.loreYear;
                  if (monthIdx !== -1) cal.currentMonthIndex = monthIdx;
                  cal.currentDay = targetDay;
                }
              }
            }
          }
        }
      } catch {}

      return cal;
    });
  }

  static saveCalendar(calendar: CampaignCalendar) {
    const key = this.getStorageKey("calendar");
    const sanitizedCalendar: CampaignCalendar = {
      ...calendar,
      currentYear: typeof calendar.currentYear === "number" ? calendar.currentYear : 1492,
      currentDay: typeof calendar.currentDay === "number" ? calendar.currentDay : 1,
      currentMonthIndex: typeof calendar.currentMonthIndex === "number" ? calendar.currentMonthIndex : 0,
    };
    setCached(key, sanitizedCalendar);
    safeLocalStorageSetItem(key, JSON.stringify(sanitizedCalendar));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode();
      if (code && code !== '__NONE__') {
        SupabaseSyncService.saveCalendar(code, sanitizedCalendar).catch(() => {});
      }
    }
    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_calendar_updated", { detail: sanitizedCalendar }),
      );
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
  }

  static saveCalendarLocalOnly(calendar: CampaignCalendar) {
    const key = this.getStorageKey("calendar");
    const sanitizedCalendar: CampaignCalendar = {
      ...calendar,
      currentYear: typeof calendar.currentYear === "number" ? calendar.currentYear : 1492,
      currentDay: typeof calendar.currentDay === "number" ? calendar.currentDay : 1,
      currentMonthIndex: typeof calendar.currentMonthIndex === "number" ? calendar.currentMonthIndex : 0,
    };
    setCached(key, sanitizedCalendar);
    safeLocalStorageSetItem(key, JSON.stringify(sanitizedCalendar));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chronicle_calendar_updated", { detail: sanitizedCalendar }),
      );
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
  }

  static advanceCalendar(days: number): CampaignCalendar {
    const cal = this.getCalendar();
    let currentDay = cal.currentDay + days;
    let currentMonthIndex = cal.currentMonthIndex;
    let currentYear = cal.currentYear;

    while (true) {
      const monthDays = cal.months[currentMonthIndex]?.days || 30;
      if (currentDay <= monthDays) break;

      currentDay -= monthDays;
      currentMonthIndex++;
      if (currentMonthIndex >= cal.months.length) {
        currentMonthIndex = 0;
        currentYear++;
      }
    }

    const updated: CampaignCalendar = {
      ...cal,
      currentDay,
      currentMonthIndex,
      currentYear,
    };
    this.saveCalendar(updated);
    return updated;
  }

  // === NOTES & ACCESS CONTROL ===
  static isNoteAccessible(note: Note, player: Player | null): boolean {
    if (!note) return false;
    // DM has master visibility over all notes in the campaign
    if (player?.isDm) return true;

    // Secret notes marked exclusively for the DM cannot be accessed by players
    if (note.dmOnly) return false;

    // Personal notes: accessible only by author or shared via askDm with DM
    if (note.visibility === 'personal') {
      const myId = player?._id || (player as any)?.id;
      const authorId = note.author?._id || (note.author as any)?.id;
      if (myId && authorId && myId === authorId) return true;
      if (note.askDm && player?.isDm) return true;
      return false;
    }

    return true;
  }

  static getAccessibleNotes(player: Player | null): Note[] {
    const allNotes = this.getNotes();
    return allNotes.filter((n) => this.isNoteAccessible(n, player));
  }

  static getNotes(): Note[] {
    const key = this.getStorageKey("notes");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return sanitizeArray<Note>(parsed);
        } catch {}
      }
      return [];
    });
  }

  static saveNotes(notes: Note[]) {
    const key = this.getStorageKey("notes");
    const sanitized = sanitizeArray<Note>(notes);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      sanitized.forEach((n) => SupabaseSyncService.saveNote(code, n));
    }
    try {
      window.dispatchEvent(new CustomEvent('chronicle_notes_updated', { detail: { notes: sanitized } }));
    } catch {}
  }

  static saveNotesLocalOnly(notes: Note[]) {
    const key = this.getStorageKey("notes");
    const sanitized = sanitizeArray<Note>(notes);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    try {
      window.dispatchEvent(new CustomEvent('chronicle_notes_updated', { detail: { notes: sanitized } }));
    } catch {}
  }

  static addNote(note: Partial<Note>, author: Player): Note {
    const notes = this.getNotes();
    const nowIso = new Date().toISOString();
    const newNote: Note = {
      _id:
        "note_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      _createdAt: nowIso,
      _updatedAt: nowIso,
      title: note.title || "Nuova Nota",
      content: note.content,
      visibility: note.visibility || "group",
      dmOnly: !!note.dmOnly,
      canonState: note.canonState || "canon",
      pinned: !!note.pinned,
      askDm: !!note.askDm,
      author: {
        _id: author._id,
        characterName: author.characterName,
        email: author.email,
        isDm: author.isDm,
        color: author.color,
        avatarUrl: author.avatarUrl,
      },
      category: note.category,
      session: note.session,
      loreDate: note.loreDate,
      images: note.images || [],
      tags: note.tags || [],
    };
    const updated = [newNote, ...notes];
    this.saveNotes(updated);

    // Auto-generate notification for group notes
    if (!newNote.dmOnly && newNote.visibility === 'group') {
      this.addCampaignNotification({
        category: 'note',
        title: 'Nuova Nota di Gruppo',
        message: `"${newNote.title}" registrata da ${author.characterName || 'Compagno'}`,
        authorId: author._id,
        authorName: author.characterName,
        targetUrl: '/notes',
        noteId: newNote._id,
      });

      // Detect @mentions
      const contentStr = typeof newNote.content === 'string' ? newNote.content : '';
      const allPlayers = this.getPlayers();
      allPlayers.forEach((p) => {
        if (p._id !== author._id && p.characterName && contentStr.toLowerCase().includes(`@${p.characterName.toLowerCase()}`)) {
          this.addCampaignNotification({
            category: 'note',
            title: 'Sei stato menzionato',
            message: `${author.characterName || 'Un compagno'} ti ha menzionato in "${newNote.title}"`,
            authorId: author._id,
            authorName: author.characterName,
            targetPlayerId: p._id,
            targetUrl: '/notes',
            noteId: newNote._id,
          });
        }
      });
    }

    return newNote;
  }

  static updateNote(id: string, updates: Partial<Note>): Note | null {
    const notes = this.getNotes();
    const idx = notes.findIndex((n) => n._id === id);
    if (idx === -1) return null;
    const updatedNote: Note = {
      ...notes[idx],
      ...updates,
      _updatedAt: new Date().toISOString(),
    };
    notes[idx] = updatedNote;
    this.saveNotes(notes);
    return updatedNote;
  }

  static deleteNote(id: string) {
    this.addDeletedNoteId(id);
    const note = this.getNotes().find((n) => n._id === id);
    if (note?.images && note.images.length > 0) {
      FirebaseStorageService.deleteMultipleMedia(note.images).catch(() => {});
    }
    const notes = this.getNotes().filter((n) => n._id !== id);
    this.saveNotes(notes);
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      SupabaseSyncService.deleteNote(id, code);
    }
  }

  static togglePinNote(id: string) {
    const notes = this.getNotes().map((n) =>
      n._id === id ? { ...n, pinned: !n.pinned, _updatedAt: new Date().toISOString() } : n,
    );
    this.saveNotes(notes);
  }

  static replyToDmClarification(
    noteId: string,
    replyText: string,
    dmName: string,
    isResolved = true,
  ): Note | null {
    const notes = this.getNotes();
    let updatedNote: Note | null = null;
    const nowIso = new Date().toISOString();
    const updated = notes.map((n) => {
      if (n._id === noteId) {
        const res: DmResponse = {
          text: replyText.trim(),
          answeredAt: nowIso,
          answeredBy: dmName,
          isResolved,
        };
        updatedNote = { ...n, dmResponse: res, _updatedAt: nowIso };
        return updatedNote;
      }
      return n;
    });
    if (updatedNote) {
      this.saveNotes(updated);
      this.addCampaignNotification({
        category: 'clarification',
        title: 'Risposta dal Dungeon Master',
        message: `Il DM ha risposto alla tua richiesta su "${(updatedNote as Note).title}"`,
        authorName: dmName,
        targetPlayerId: (updatedNote as Note).author?._id,
        targetUrl: '/clarifications',
        noteId: (updatedNote as Note)._id,
      });
    }
    return updatedNote;
  }

  static toggleDmClarificationResolved(noteId: string, isResolved?: boolean) {
    const notes = this.getNotes();
    const updated = notes.map((n) => {
      if (n._id === noteId && n.dmResponse) {
        return {
          ...n,
          dmResponse: {
            ...n.dmResponse,
            isResolved:
              isResolved !== undefined ? isResolved : !n.dmResponse.isResolved,
          },
        };
      }
      return n;
    });
    this.saveNotes(updated);
  }

  static setNoteAskDm(noteId: string, askDm: boolean) {
    const notes = this.getNotes();
    const updated = notes.map((n) => (n._id === noteId ? { ...n, askDm } : n));
    this.saveNotes(updated);
  }

  // === CLARIFICATION LIFECYCLE (DM & PLAYER INDEPENDENT DISMISSAL / REMOVAL) ===
  static removeClarificationForDm(noteId: string) {
    const notes = this.getNotes();
    const updated = notes.map((n) => {
      if (n._id === noteId) {
        return { ...n, hiddenForDm: true, _updatedAt: new Date().toISOString() };
      }
      return n;
    });
    this.saveNotes(updated);
    this.dismissNotification(noteId);
    this.deleteCampaignNotification(noteId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static removeClarificationForPlayer(noteId: string, playerId: string) {
    if (!playerId) return;
    const notes = this.getNotes();
    const updated = notes.map((n) => {
      if (n._id === noteId) {
        const currentHidden = Array.isArray(n.hiddenForPlayerIds) ? n.hiddenForPlayerIds : [];
        return {
          ...n,
          hiddenForPlayerIds: Array.from(new Set([...currentHidden, playerId])),
          _updatedAt: new Date().toISOString(),
        };
      }
      return n;
    });
    this.saveNotes(updated);
    this.dismissNotification(noteId, playerId);
    this.deleteCampaignNotification(noteId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static deleteDmReply(noteId: string) {
    const notes = this.getNotes();
    const updated = notes.map((n) => {
      if (n._id === noteId) {
        return { ...n, dmResponse: undefined, _updatedAt: new Date().toISOString() };
      }
      return n;
    });
    this.saveNotes(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static deleteClarificationRequest(noteId: string) {
    const notes = this.getNotes();
    const updated = notes.map((n) => {
      if (n._id === noteId) {
        return { ...n, askDm: false, dmResponse: undefined, _updatedAt: new Date().toISOString() };
      }
      return n;
    });
    this.saveNotes(updated);
    this.deleteCampaignNotification(noteId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  // === CAMPAIGN NOTIFICATIONS & NOTIFICATION BELL ===
  static getCampaignNotifications(): CampaignNotification[] {
    const key = this.getStorageKey("campaign_notifications");
    const deletedIds = new Set(this.getDeletedNotificationIds());
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const sanitized = sanitizeArray<CampaignNotification>(parsed);
          return sanitized.filter((n) => n && n.id && !deletedIds.has(n.id));
        } catch {}
      }
      return [];
    });
  }

  static saveCampaignNotifications(notifications: CampaignNotification[]) {
    const key = this.getStorageKey("campaign_notifications");
    const deletedIds = new Set(this.getDeletedNotificationIds());
    const filtered = sanitizeArray<CampaignNotification>(notifications)
      .filter((n) => n && n.id && !deletedIds.has(n.id))
      .slice(-300); // keep last 300 notifications
    setCached(key, filtered);
    safeLocalStorageSetItem(key, JSON.stringify(filtered));
    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("chronicle_notifications_updated", { detail: { notifications: filtered } }));
      } catch {}
    }
  }

  static deleteCampaignNotification(id: string) {
    if (!id) return;
    this.addDeletedNotificationId(id);
    const notifications = this.getCampaignNotifications().filter((n) => n.id !== id);
    const key = this.getStorageKey("campaign_notifications");
    setCached(key, notifications);
    safeLocalStorageSetItem(key, JSON.stringify(notifications));
    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("chronicle_notifications_updated", { detail: { notifications } }));
      } catch {}
    }
  }

  static clearAllCampaignNotifications(userId?: string) {
    const currentNotifs = this.getCampaignNotifications();
    const currentNotifIds = currentNotifs.map((n) => n.id).filter(Boolean);
    if (currentNotifIds.length > 0) {
      this.addMultipleDeletedNotificationIds(currentNotifIds);
    }

    // Also mark all current clarification notes as dismissed for this user so they don't bounce back
    const askDmNotes = this.getNotes().filter((n) => n.askDm || n.dmResponse);
    if (askDmNotes.length > 0) {
      this.dismissAllNotifications(askDmNotes.map((n) => n._id), userId);
    }

    const key = this.getStorageKey("campaign_notifications");
    setCached(key, []);
    safeLocalStorageSetItem(key, JSON.stringify([]));

    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("chronicle_notifications_updated", { detail: { notifications: [] } }));
      } catch {}
    }
  }

  static addCampaignNotification(
    notif: Omit<CampaignNotification, "id" | "createdAt" | "campaignCode"> & { id?: string; createdAt?: string; campaignCode?: string }
  ): CampaignNotification {
    const notifications = this.getCampaignNotifications();
    const code = notif.campaignCode || this.getActiveCampaignCode() || "default";
    const newNotif: CampaignNotification = {
      ...notif,
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      campaignCode: code,
      createdAt: notif.createdAt || new Date().toISOString(),
    };
    const updated = [newNotif, ...notifications.filter((n) => n.id !== newNotif.id)].slice(0, 300);
    this.saveCampaignNotifications(updated);
    return newNotif;
  }

  // === NOTIFICATION DISMISSAL / READ STATE ===
  static getDismissedNotificationIds(userId?: string): string[] {
    const code = this.getActiveCampaignCode() || "default";
    const account = this.getCurrentAccount();
    const userSuffix = userId || account?.id || "anon";
    
    // First try UserPreferencesService (persisted to Firestore & memory)
    const fromPrefs = UserPreferencesService.getDismissedNotificationIds(code, userSuffix);
    if (fromPrefs && fromPrefs.length > 0) {
      return fromPrefs;
    }

    const key = `chronicle_dismissed_notifs_${code}_${userSuffix}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
      const legacyKey = `chronicle_dismissed_notifs_${code}_anon`;
      const legacyStored = localStorage.getItem(legacyKey);
      return legacyStored ? JSON.parse(legacyStored) : [];
    } catch {
      return [];
    }
  }

  static dismissNotification(noteId: string, userId?: string) {
    if (!noteId) return;
    const code = this.getActiveCampaignCode() || "default";
    const account = this.getCurrentAccount();
    const userSuffix = userId || account?.id || "anon";
    const key = `chronicle_dismissed_notifs_${code}_${userSuffix}`;
    const current = this.getDismissedNotificationIds(userId);
    if (!current.includes(noteId)) {
      const updated = [...current, noteId];
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {}
      UserPreferencesService.saveDismissedNotificationIds(code, updated, userSuffix);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static dismissAllNotifications(noteIds: string[], userId?: string) {
    if (!Array.isArray(noteIds) || noteIds.length === 0) return;
    const code = this.getActiveCampaignCode() || "default";
    const account = this.getCurrentAccount();
    const userSuffix = userId || account?.id || "anon";
    const key = `chronicle_dismissed_notifs_${code}_${userSuffix}`;
    const current = this.getDismissedNotificationIds(userId);
    const set = new Set([...current, ...noteIds]);
    const updated = Array.from(set);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    UserPreferencesService.saveDismissedNotificationIds(code, updated, userSuffix);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static restoreNotification(noteId: string, userId?: string) {
    if (!noteId) return;
    const code = this.getActiveCampaignCode() || "default";
    const account = this.getCurrentAccount();
    const userSuffix = userId || account?.id || "anon";
    const key = `chronicle_dismissed_notifs_${code}_${userSuffix}`;
    const current = this.getDismissedNotificationIds(userId);
    const updated = current.filter((id) => id !== noteId);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    UserPreferencesService.saveDismissedNotificationIds(code, updated, userSuffix);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_notifications_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_notes_updated"));
    }
  }

  static getUnreadNotificationsCount(userId?: string, isDm?: boolean, userEmail?: string): number {
    const account = this.getCurrentAccount();
    const resolvedId = userId || account?.id || '';
    const resolvedIsDm = isDm !== undefined ? isDm : Boolean(account?.isDm);
    const resolvedEmail = (userEmail || account?.email || '').toLowerCase().trim();
    const dismissedIds = new Set(this.getDismissedNotificationIds(resolvedId));

    // 1. Unread Campaign Notifications (Codex, Sessions, Group Notes, Mentions)
    const campaignNotifs = this.getCampaignNotifications();
    const unreadCampaignNotifs = campaignNotifs.filter((cn) => {
      if (cn.targetPlayerId && cn.targetPlayerId !== resolvedId && !resolvedIsDm) return false;
      return !dismissedIds.has(cn.id);
    });

    // 2. Pending Clarifications / DM Answers
    const allNotes = this.getNotes();
    let pendingClarifications = 0;
    if (resolvedIsDm) {
      pendingClarifications = allNotes.filter((n) => {
        if (!n.askDm || n.hiddenForDm || dismissedIds.has(n._id)) return false;
        const isResolved = Boolean(n.dmResponse?.isResolved);
        return !isResolved;
      }).length;
    } else {
      pendingClarifications = allNotes.filter((n) => {
        if (!n.askDm || dismissedIds.has(n._id)) return false;
        const authorId = n.author?._id || (n.author as any)?.id;
        const authorEmail = (n.author?.email || '').toLowerCase().trim();
        const isAuthor = (resolvedId && authorId === resolvedId) || (resolvedEmail && authorEmail === resolvedEmail);
        if (!isAuthor) return false;
        if (resolvedId && n.hiddenForPlayerIds?.includes(resolvedId)) return false;
        // Unread for player only if DM has answered
        const hasResponse = Boolean(n.dmResponse?.text);
        return hasResponse;
      }).length;
    }

    return unreadCampaignNotifs.length + pendingClarifications;
  }

  // === SESSIONS & STORYLINE EVENTS ===
  static getSessions(): Session[] {
    const key = this.getStorageKey("sessions");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const raw: Session[] = JSON.parse(saved);
          const parsed = sanitizeArray<Session>(raw);
          if (Array.isArray(parsed)) {
            const cal = this.getCalendar();
            let hasRepairs = false;

            const repaired = parsed.map((s) => {
              // If session already has both structured metadata and loreDate, keep it
              if (s.loreMonth && s.loreStartDay !== undefined && s.loreDate) {
                return s;
              }

              // Try parsing existing loreDate or title or fallback to active campaign date
              const parsedDate = parseLoreDateString(
                s.loreDate || s.title,
                cal.months,
                cal.currentYear,
                cal.yearSuffix,
              );

              if (parsedDate) {
                hasRepairs = true;
                return {
                  ...s,
                  loreDate: s.loreDate || parsedDate.formatted,
                  loreStartDay:
                    s.loreStartDay !== undefined
                      ? s.loreStartDay
                      : parsedDate.startDay,
                  loreEndDay:
                    s.loreEndDay !== undefined
                      ? s.loreEndDay
                      : parsedDate.endDay,
                  loreMonth: s.loreMonth || parsedDate.monthName,
                  loreEndMonth: s.loreEndMonth || parsedDate.endMonthName,
                  loreYear: s.loreYear || parsedDate.year,
                  loreEndYear: s.loreEndYear || parsedDate.endYear,
                };
              }

              // Fallback: If session had no lore date at all, associate with current campaign calendar state
              const curMonth =
                cal.months[cal.currentMonthIndex] || cal.months[0];
              const defaultFormatted = formatLoreDate(
                cal.currentDay || 15,
                undefined,
                curMonth.name,
                cal.currentYear || 1492,
                cal.yearSuffix || "CV",
              );

              hasRepairs = true;
              return {
                ...s,
                loreDate: s.loreDate || defaultFormatted,
                loreStartDay:
                  s.loreStartDay !== undefined
                    ? s.loreStartDay
                    : cal.currentDay || 15,
                loreMonth: s.loreMonth || curMonth.name,
                loreYear: s.loreYear || cal.currentYear,
              };
            });

            if (hasRepairs) {
              // Persist repair quietly
              localStorage.setItem(key, JSON.stringify(repaired));
            }

            return repaired;
          }
        } catch {}
      }
      return [];
    });
  }

  static isSessionEventAccessible(event: SessionEvent, player: Player | null): boolean {
    if (!event) return false;
    // DM has visibility over all events including secret narrative revelations
    if (player?.isDm) return true;
    // Secret DM events are hidden from players until revealed
    if (event.impact === 'secret' || (event as any).isSecret) return false;
    return true;
  }

  static getAccessibleSessions(player: Player | null): Session[] {
    const sessions = this.getSessions();
    if (player?.isDm) return sessions;

    return sessions.map((s) => ({
      ...s,
      events: (s.events || []).filter((e) => this.isSessionEventAccessible(e, player)),
    }));
  }

  static saveSessions(sessions: Session[]) {
    const key = this.getStorageKey("sessions");
    const sanitized = sanitizeArray<Session>(sessions);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      sanitized.forEach((s) => SupabaseSyncService.saveSession(code, s));
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("chronicle_sessions_updated", {
            detail: { sessions: sanitized },
          }),
        );
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      } catch {}
    }
    CloudSyncService.triggerCloudSave();
  }

  static saveSessionsLocalOnly(sessions: Session[]) {
    const key = this.getStorageKey("sessions");
    const sanitized = sanitizeArray<Session>(sessions);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("chronicle_sessions_updated", {
            detail: { sessions: sanitized },
          }),
        );
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      } catch {}
    }
  }

  static addSession(session: Partial<Session>): Session {
    const sessions = this.getSessions();
    const players = this.getStoredPlayers();
    const cal = this.getCalendar();

    // Auto-complete lore metadata if missing
    let loreDate = session.loreDate?.trim();
    let loreStartDay = session.loreStartDay;
    let loreEndDay = session.loreEndDay;
    let loreMonth = session.loreMonth;
    let loreEndMonth = session.loreEndMonth;
    let loreYear = session.loreYear || cal.currentYear;
    let loreEndYear = session.loreEndYear;

    if (!loreMonth || loreStartDay === undefined) {
      if (loreDate) {
        const parsed = parseLoreDateString(
          loreDate,
          cal.months,
          cal.currentYear,
          cal.yearSuffix,
        );
        if (parsed) {
          loreStartDay = parsed.startDay;
          loreEndDay = parsed.endDay;
          loreMonth = parsed.monthName;
          loreEndMonth = parsed.endMonthName;
          loreYear = parsed.year;
          loreEndYear = parsed.endYear;
          loreDate = parsed.formatted;
        }
      } else {
        const curM = cal.months[cal.currentMonthIndex] || cal.months[0];
        loreStartDay = cal.currentDay || 15;
        loreMonth = curM.name;
        loreYear = cal.currentYear || 1492;
        loreDate = formatLoreDate(
          loreStartDay,
          undefined,
          loreMonth,
          loreYear,
          cal.yearSuffix || "CV",
        );
      }
    }

    const newSession: Session = {
      _id: "sess_" + Date.now(),
      number:
        session.number ||
        (sessions.length > 0
          ? Math.max(...sessions.map((s) => s.number)) + 1
          : 1),
      date: session.date || new Date().toISOString().split("T")[0],
      title: session.title || "Nuova Sessione",
      sessionType: session.sessionType || "mixed",
      chapterId: session.chapterId,
      chapterName: session.chapterName,
      loreDate: loreDate || "",
      loreStartDay,
      loreEndDay,
      loreMonth,
      loreEndMonth,
      loreYear,
      loreEndYear,
      recap: session.recap || [
        {
          _type: "block",
          children: [{ _type: "span", text: "Nessun riassunto inserito." }],
        },
      ],
      events: session.events || [],
      images: session.images || [],
      attendees: session.attendees || players,
    };
    const updated = [newSession, ...sessions].sort(
      (a, b) => b.number - a.number,
    );
    this.saveSessions(updated);

    this.addCampaignNotification({
      category: 'session',
      title: 'Nuova Sessione Pubblicata',
      message: `Sessione ${newSession.number}: "${newSession.title}" (${newSession.loreDate || 'Data registrata'})`,
      targetUrl: '/sessions',
      sessionId: newSession._id,
    });

    // If session has lore date, automatically update campaign calendar if higher
    if (newSession.loreStartDay && newSession.loreYear) {
      if (
        newSession.loreYear > cal.currentYear ||
        (newSession.loreYear === cal.currentYear &&
          (newSession.loreEndDay || newSession.loreStartDay || 1) >
            cal.currentDay)
      ) {
        const targetDay =
          newSession.loreEndDay || newSession.loreStartDay || cal.currentDay;
        this.saveCalendar({
          ...cal,
          currentDay: targetDay,
          currentYear: newSession.loreYear,
        });
      }
    }

    return newSession;
  }

  static updateSession(id: string, updates: Partial<Session>): Session | null {
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s._id === id);
    if (index === -1) return null;

    const cal = this.getCalendar();
    let updatedSession = { ...sessions[index], ...updates };

    // Ensure lore metadata is synchronized
    if (
      updates.loreDate &&
      (!updates.loreMonth || updates.loreStartDay === undefined)
    ) {
      const parsed = parseLoreDateString(
        updates.loreDate,
        cal.months,
        cal.currentYear,
        cal.yearSuffix,
      );
      if (parsed) {
        updatedSession.loreStartDay = parsed.startDay;
        updatedSession.loreEndDay = parsed.endDay;
        updatedSession.loreMonth = parsed.monthName;
        updatedSession.loreEndMonth = parsed.endMonthName;
        updatedSession.loreYear = parsed.year;
        updatedSession.loreEndYear = parsed.endYear;
      }
    }

    sessions[index] = updatedSession;
    this.saveSessions(sessions);
    return sessions[index];
  }

  static deleteSession(id: string) {
    this.addDeletedSessionId(id);
    const session = this.getSessions().find((s) => s._id === id);
    if (session?.images && session.images.length > 0) {
      FirebaseStorageService.deleteMultipleMedia(session.images).catch(() => {});
    }
    const sessions = this.getSessions().filter((s) => s._id !== id);
    this.saveSessions(sessions);
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      SupabaseSyncService.deleteSession(id, code);
    }
  }

  // === CHAPTERS / NARRATIVE ARCS ===
  static getChapters(): CampaignChapter[] {
    const key = this.getStorageKey("chapters");
    return getCached(key, () => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = sanitizeArray<CampaignChapter>(JSON.parse(stored));
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      // Derive in-memory from existing sessions if any has chapterName, without triggering an auto-save to cloud
      const sessions = this.getSessions();
      const distinctChapterNames = Array.from(
        new Set(sessions.map((s) => s.chapterName).filter(Boolean)),
      ) as string[];
      if (distinctChapterNames.length > 0) {
        const generated: CampaignChapter[] = distinctChapterNames.map(
          (name, idx) => ({
            id: "chap_" + idx,
            name,
            color:
              idx % 3 === 0 ? "#8B5CF6" : idx % 3 === 1 ? "#3B82F6" : "#10B981",
            order: idx + 1,
          }),
        );
        return generated;
      }

      return [];
    });
  }

  static deduplicateChapters(chapters: CampaignChapter[]): CampaignChapter[] {
    if (!Array.isArray(chapters)) return [];
    const map = new Map<string, CampaignChapter>();
    const seenNames = new Map<string, string>();

    chapters.forEach((c) => {
      if (!c || !c.name) return;
      const normName = c.name.trim().toLowerCase();
      if (!normName) return;

      const existingId = seenNames.get(normName);
      if (existingId && map.has(existingId)) {
        const prev = map.get(existingId)!;
        map.set(existingId, {
          ...c,
          ...prev,
          description: prev.description || c.description || "",
          coverImageUrl: prev.coverImageUrl || c.coverImageUrl || "",
          color: prev.color || c.color || "#D4AF37",
        });
      } else {
        const cleanId = c.id || "chap_" + Date.now();
        const item = { ...c, id: cleanId, name: c.name.trim() };
        map.set(cleanId, item);
        seenNames.set(normName, cleanId);
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  static saveChapters(chapters: CampaignChapter[]) {
    const key = this.getStorageKey("chapters");
    const deduped = this.deduplicateChapters(chapters);
    const sanitized = sanitizeArray<CampaignChapter>(deduped);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      sanitized.forEach((c) => SupabaseSyncService.saveChapter(code, c));
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("chronicle_chapters_updated", {
            detail: { chapters: sanitized },
          }),
        );
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      } catch {}
    }
    CloudSyncService.triggerCloudSave();
  }

  static saveChaptersLocalOnly(chapters: CampaignChapter[]) {
    const key = this.getStorageKey("chapters");
    const sanitized = sanitizeArray<CampaignChapter>(chapters);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("chronicle_chapters_updated", {
            detail: { chapters: sanitized },
          }),
        );
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      } catch {}
    }
  }

  static addChapter(chapter: Partial<CampaignChapter>): CampaignChapter {
    const chapters = this.getChapters();
    const newChapter: CampaignChapter = {
      id: chapter.id || "chap_" + Date.now(),
      name: chapter.name?.trim() || "Nuovo Capitolo",
      description: chapter.description?.trim() || "",
      color: chapter.color || "#D4AF37",
      coverImageUrl: chapter.coverImageUrl || "",
      order: chapter.order !== undefined ? chapter.order : chapters.length + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...chapters, newChapter].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    this.saveChapters(updated);
    return newChapter;
  }

  static updateChapter(
    id: string,
    updates: Partial<CampaignChapter>,
  ): CampaignChapter | null {
    const chapters = this.getChapters();
    const index = chapters.findIndex((c) => c.id === id);
    if (index === -1) return null;
    const oldName = chapters[index].name;
    const updated = { ...chapters[index], ...updates };
    chapters[index] = updated;
    this.saveChapters(chapters);

    // If chapter name changed, propagate to sessions that used old name
    if (updates.name && updates.name !== oldName) {
      const sessions = this.getSessions();
      let changed = false;
      const updatedSessions = sessions.map((s) => {
        if (s.chapterId === id || s.chapterName === oldName) {
          changed = true;
          return { ...s, chapterId: id, chapterName: updates.name };
        }
        return s;
      });
      if (changed) {
        this.saveSessions(updatedSessions);
      }
    }

    return updated;
  }

  static deleteChapter(id: string) {
    const chapters = this.getChapters().filter((c) => c.id !== id);
    this.saveChapters(chapters);
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      SupabaseSyncService.deleteChapter(id, code);
    }
  }

  static addEventToSession(
    sessionId: string,
    event: Omit<SessionEvent, "id">,
  ): SessionEvent | null {
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s._id === sessionId);
    if (index === -1) return null;

    const newEvt: SessionEvent = {
      ...event,
      id: "evt_" + Date.now(),
    };

    const currentEvents = sessions[index].events || [];
    sessions[index].events = [...currentEvents, newEvt];
    this.saveSessions(sessions);

    if (event.impact === 'major' || !event.impact || event.impact === 'normal') {
      this.addCampaignNotification({
        category: 'session',
        title: 'Nuovo Evento di Trama',
        message: `${newEvt.title}: ${(newEvt.description || '').slice(0, 80)}`,
        targetUrl: '/storyline',
        sessionId,
      });
    }

    return newEvt;
  }

  static updateEventInSession(
    sessionId: string,
    eventId: string,
    updates: Partial<SessionEvent>,
  ): SessionEvent | null {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex((s) => s._id === sessionId);
    if (sessionIndex === -1) return null;

    const session = sessions[sessionIndex];
    const events = session.events || [];
    const eventIndex = events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) {
      // If event was synthetic for whole session and not a sub-event, update session images directly
      if (sessionId === eventId || eventId.startsWith('sess_node_')) {
        if (updates.images) {
          session.images = updates.images;
          sessions[sessionIndex] = { ...session };
          this.saveSessions(sessions);
        }
      }
      return null;
    }

    const updatedEvt = { ...events[eventIndex], ...updates };
    events[eventIndex] = updatedEvt;
    session.events = [...events];
    sessions[sessionIndex] = { ...session };
    this.saveSessions(sessions);
    return updatedEvt;
  }

  static deleteEventFromSession(
    sessionId: string,
    eventId: string,
  ): boolean {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex((s) => s._id === sessionId);
    if (sessionIndex === -1) return false;

    const session = sessions[sessionIndex];
    const events = session.events || [];
    session.events = events.filter((e) => e.id !== eventId);
    sessions[sessionIndex] = { ...session };
    this.saveSessions(sessions);
    return true;
  }

  // === ENTITIES & QUESTS ===
  static getEntities(): Entity[] {
    const key = this.getStorageKey("entities");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = sanitizeArray<Entity>(JSON.parse(saved));
          // Deduplicate by _id to safeguard against legacy duplicates
          const seen = new Set<string>();
          const deduped: Entity[] = [];
          let hadDuplicates = false;
          for (const ent of parsed) {
            if (ent && ent._id) {
              if (!seen.has(ent._id)) {
                seen.add(ent._id);
                deduped.push(ent);
              } else {
                hadDuplicates = true;
              }
            }
          }
          if (hadDuplicates) {
            localStorage.setItem(key, JSON.stringify(deduped));
          }
          return deduped;
        } catch {}
      }
      return [];
    });
  }

  static getEntityById(id: string): Entity | undefined {
    if (!id) return undefined;
    const entities = this.getEntities();
    return entities.find((e) => e._id === id);
  }

  static saveEntities(entities: Entity[]) {
    const key = this.getStorageKey("entities");
    const sanitized = sanitizeArray<Entity>(entities);
    setCached(key, sanitized);
    cachedEntityLookupMap = null; // Invalidate memoized lookup map
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      if (sanitized.length === 0) {
        SupabaseSyncService.clearAllEntities(code).catch(() => {});
      } else {
        sanitized.forEach((e) => SupabaseSyncService.saveEntity(code, e));
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('chronicle_entities_updated', { detail: { entities: sanitized } }));
    } catch {}
  }

  static resetCompendiumAndRelations(): void {
    const code = this.getActiveCampaignCode() || 'default';
    this.saveEntities([]);
    this.saveAllFamilyRelations([]);
    if (isSupabaseConfigured()) {
      SupabaseSyncService.clearAllEntities(code).catch(() => {});
      SupabaseSyncService.saveFamilyRelations(code, []).catch(() => {});
    }
    CloudSyncService.triggerCloudSave();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_entities_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_family_tree_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
  }

  static saveEntitiesLocalOnly(entities: Entity[]) {
    const key = this.getStorageKey("entities");
    const sanitized = sanitizeArray<Entity>(entities);
    setCached(key, sanitized);
    cachedEntityLookupMap = null; // Invalidate memoized lookup map
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    try {
      window.dispatchEvent(new CustomEvent('chronicle_entities_updated', { detail: { entities: sanitized } }));
    } catch {}
  }

  /**
   * Evaluates if an entity (especially quests with party vs personal & public vs private visibility)
   * is accessible to the specified player.
   */
  static isEntityAccessible(entity: Entity, player: Player | null): boolean {
    if (!entity) return false;
    if (entity.type !== 'quest') return true;

    // Party-wide quests are open to all players & DM
    if (entity.questScope === 'party' || !entity.questScope) return true;

    // Personal quest check:
    const myId = player?._id || (player as any)?.id;
    const isAssignee = !!(myId && entity.assigneePlayerId === myId);
    if (isAssignee) return true;

    // If marked private/secret:
    if (entity.questPrivacy === 'private') {
      if (entity.sharedWithDm && player?.isDm) return true;
      return false;
    }

    // If marked public (personal quest visible to companions):
    if (entity.questPrivacy === 'public') return true;

    // Fallback for existing data: if player is DM and it's shared with DM
    if (entity.sharedWithDm && player?.isDm) return true;

    return false;
  }

  /**
   * Pre-indexed O(1) case-insensitive lookup Map for entity mentions across the entire app
   */
  static getEntityLookupMap(): Map<string, Entity> {
    if (cachedEntityLookupMap) return cachedEntityLookupMap;
    const map = new Map<string, Entity>();
    const entities = this.getEntities();
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (ent.name) {
        map.set(ent.name.toLowerCase().trim(), ent);
      }
      if (ent.aliases && Array.isArray(ent.aliases)) {
        for (let j = 0; j < ent.aliases.length; j++) {
          if (ent.aliases[j]) {
            map.set(ent.aliases[j].toLowerCase().trim(), ent);
          }
        }
      }
    }
    cachedEntityLookupMap = map;
    return map;
  }

  static createEntity(entity: Partial<Entity>): Entity {
    return this.addEntity(entity);
  }

  static addEntity(entity: Partial<Entity>): Entity {
    const entities = this.getEntities();
    const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 9);
    const newEntityId = `ent_${Date.now()}_${uniqueSuffix}`;
    let mapId = entity.mapId;
    let pinId = entity.pinId;
    let isMap = entity.isMap;

    // Bi-directional synchronization with Atlas
    if (entity.type === "place") {
      const maps = this.getMaps();

      // Case 1: Place is declared as a full Atlas Map
      if (isMap || (!mapId && entity.images && entity.images.length > 0 && isMap !== false)) {
        if (!mapId) {
          const newMapId = `map_${Date.now()}_${uniqueSuffix}`;
          const imageUrl = (entity.images && entity.images[0]) || "https://images.unsplash.com/photo-1524654458049-e36be0721fa2?q=80&w=1600&auto=format&fit=crop";
          const newMap: WorldMap = {
            id: newMapId,
            title: entity.name?.trim() || "Nuova Mappa",
            description: entity.progressNote?.trim() || "",
            imageUrl,
            pins: [],
            entityId: newEntityId,
            createdAt: new Date().toISOString(),
          };
          mapId = newMapId;
          isMap = true;
          this.saveMaps([...maps, newMap]);
        }
      } 
      // Case 2: Place is anchored as a Pin on an existing Map
      else if (mapId && !isMap) {
        const targetMapIdx = maps.findIndex((m) => m.id === mapId);
        if (targetMapIdx !== -1) {
          const newPinId = `pin_${Date.now()}_${uniqueSuffix}`;
          const newPin: MapPin = {
            id: newPinId,
            title: entity.name?.trim() || "Nuovo Luogo",
            description: entity.progressNote?.trim() || "",
            x: entity.pinX !== undefined ? entity.pinX : 50,
            y: entity.pinY !== undefined ? entity.pinY : 50,
            category: entity.pinCategory || 'city',
            entityId: newEntityId,
            entityType: 'place',
            discovered: true,
          };
          pinId = newPinId;
          maps[targetMapIdx].pins = [...(maps[targetMapIdx].pins || []), newPin];
          this.saveMaps(maps);
        }
      }
    }

    const newEntity: Entity = {
      _id: newEntityId,
      type: entity.type || "npc",
      name: entity.name?.trim() || "Nuova Entità",
      aliases: entity.aliases || [],
      status: entity.status || "alive",
      progressNote: entity.progressNote || "",
      color: entity.color || (entity.type === 'place' ? "#3B82F6" : "#D4AF37"),
      images: entity.images || [],
      questScope: entity.questScope || "party",
      assigneePlayerId: entity.assigneePlayerId,
      assigneePlayerName: entity.assigneePlayerName,
      location: entity.location,
      mapId,
      pinId,
      pinCategory: entity.pinCategory,
      pinX: entity.pinX,
      pinY: entity.pinY,
      isMap:
        entity.type === "place"
          ? isMap !== undefined
            ? isMap
            : Boolean(entity.images && entity.images.length > 0 && !mapId)
          : undefined,
    };
    const updated = [newEntity, ...entities];
    this.saveEntities(updated);

    this.addCampaignNotification({
      category: 'codex',
      title: 'Nuova Voce nel Codex',
      message: `Catalogato: ${newEntity.name} (${newEntity.type.toUpperCase()})`,
      targetUrl: `/codex/${newEntity.type}/${newEntity._id}`,
      entityId: newEntity._id,
    });

    return newEntity;
  }

  static updateEntityStatus(id: string, status: Entity["status"]) {
    const entities = this.getEntities().map((e) =>
      e._id === id ? { ...e, status } : e,
    );
    const target = entities.find((e) => e._id === id);
    this.saveEntities(entities);

    if (target) {
      const statusLabels: Record<string, string> = {
        alive: 'In Vita / Attivo',
        dead: 'Caduto / Deceduto',
        unknown: 'Stato Ignoto / Disperso',
        completed: 'Completata',
        failed: 'Fallita',
        destroyed: 'Distrutto',
      };
      this.addCampaignNotification({
        category: 'codex',
        title: 'Stato Aggiornato nel Codex',
        message: `${target.name} è ora: ${statusLabels[status] || status}`,
        targetUrl: `/codex/${target.type}/${target._id}`,
        entityId: target._id,
      });
    }
  }

  static revealEntitySecret(entityId: string, secretId: string, revealedBy?: string): boolean {
    const entities = this.getEntities();
    const ent = entities.find((e) => e._id === entityId);
    if (!ent) return false;

    let secretFound: EntitySecretItem | null = null;
    const currentSecrets: EntitySecretItem[] = ent.aiConfig?.secrets || [];
    const updatedSecrets = currentSecrets.map((s) => {
      if (s.id === secretId) {
        secretFound = {
          ...s,
          isRevealed: true,
          revealedAt: new Date().toISOString(),
          revealedBy: revealedBy || 'Dungeon Master',
        };
        return secretFound;
      }
      return s;
    });

    if (!secretFound) return false;

    const updatedEnt: Entity = {
      ...ent,
      aiConfig: {
        ...ent.aiConfig,
        secrets: updatedSecrets,
      },
    };

    this.saveEntities(entities.map((e) => (e._id === entityId ? updatedEnt : e)));

    this.addCampaignNotification({
      category: 'codex',
      title: 'Segreto Svelato nel Codex',
      message: `Svelato nuovo dettaglio su ${ent.name}: "${(secretFound as EntitySecretItem).title}"`,
      targetUrl: `/codex/${ent.type}/${ent._id}`,
      entityId: ent._id,
    });

    return true;
  }

  static concealEntitySecret(entityId: string, secretId: string): boolean {
    const entities = this.getEntities();
    const ent = entities.find((e) => e._id === entityId);
    if (!ent) return false;

    let secretFound = false;
    const currentSecrets: EntitySecretItem[] = ent.aiConfig?.secrets || [];
    const updatedSecrets = currentSecrets.map((s) => {
      if (s.id === secretId) {
        secretFound = true;
        return {
          ...s,
          isRevealed: false,
          revealedAt: undefined,
          revealedBy: undefined,
        };
      }
      return s;
    });

    if (!secretFound) return false;

    const updatedEnt: Entity = {
      ...ent,
      aiConfig: {
        ...ent.aiConfig,
        secrets: updatedSecrets,
      },
    };

    this.saveEntities(entities.map((e) => (e._id === entityId ? updatedEnt : e)));
    return true;
  }

  static updateEntity(id: string, updates: Partial<Entity>): Entity | null {
    const entities = this.getEntities();
    const index = entities.findIndex((e) => e._id === id);
    if (index === -1) return null;

    const oldEntity = entities[index];
    const updatedEntity = { ...oldEntity, ...updates };
    entities[index] = updatedEntity;
    this.saveEntities(entities);

    // Bi-directional synchronization with Atlas
    if (updatedEntity.type === "place") {
      const maps = this.getMaps();

      // Synchronize full Map representation
      if (updatedEntity.isMap) {
        const linkedMapIdx = maps.findIndex(
          (m) => m.id === updatedEntity.mapId || m.entityId === id,
        );
        if (linkedMapIdx !== -1) {
          maps[linkedMapIdx] = {
            ...maps[linkedMapIdx],
            title: updatedEntity.name || maps[linkedMapIdx].title,
            description:
              updatedEntity.progressNote !== undefined
                ? updatedEntity.progressNote
                : maps[linkedMapIdx].description,
            imageUrl:
              (updatedEntity.images && updatedEntity.images[0]) ||
              maps[linkedMapIdx].imageUrl,
            entityId: id,
          };
          this.saveMaps(maps);
        } else if (updates.images && updates.images.length > 0 && !updatedEntity.mapId) {
          const newMap: WorldMap = {
            id: "map_" + Date.now(),
            title: updatedEntity.name,
            description: updatedEntity.progressNote || "",
            imageUrl: updates.images[0],
            pins: [],
            entityId: id,
            createdAt: new Date().toISOString(),
          };
          updatedEntity.mapId = newMap.id;
          updatedEntity.isMap = true;
          this.saveEntities(entities);
          this.saveMaps([...maps, newMap]);
        }
      }

      // Synchronize Pin representation on an Atlas Map
      if (updatedEntity.mapId && updatedEntity.pinId && !updatedEntity.isMap) {
        const mapIdx = maps.findIndex((m) => m.id === updatedEntity.mapId);
        if (mapIdx !== -1) {
          const pinIdx = (maps[mapIdx].pins || []).findIndex((p) => p.id === updatedEntity.pinId);
          if (pinIdx !== -1) {
            maps[mapIdx].pins[pinIdx] = {
              ...maps[mapIdx].pins[pinIdx],
              title: updatedEntity.name || maps[mapIdx].pins[pinIdx].title,
              description:
                updatedEntity.progressNote !== undefined
                  ? updatedEntity.progressNote
                  : maps[mapIdx].pins[pinIdx].description,
              category: updatedEntity.pinCategory || maps[mapIdx].pins[pinIdx].category,
              x: updatedEntity.pinX !== undefined ? updatedEntity.pinX : maps[mapIdx].pins[pinIdx].x,
              y: updatedEntity.pinY !== undefined ? updatedEntity.pinY : maps[mapIdx].pins[pinIdx].y,
              entityId: id,
              entityType: 'place',
            };
            this.saveMaps(maps);
          }
        }
      }
    }

    return entities[index];
  }

  static addEntityTimelineMemory(entityId: string, entry: TimelineMemoryEntry): Entity | null {
    const entities = this.getEntities();
    const index = entities.findIndex((e) => e._id === entityId);
    if (index === -1) return null;

    const ent = entities[index];
    const aiConfig = { ...(ent.aiConfig || { enabled: true }) };
    const currentMemories = aiConfig.timelineMemories || [];
    const exists = currentMemories.some((m) => m.id === entry.id);
    const updatedMemories = exists
      ? currentMemories.map((m) => (m.id === entry.id ? entry : m))
      : [...currentMemories, entry];

    aiConfig.timelineMemories = updatedMemories;
    return this.updateEntity(entityId, { aiConfig });
  }

  static addEntityBelief(entityId: string, belief: EvolvingBelief): Entity | null {
    const entities = this.getEntities();
    const index = entities.findIndex((e) => e._id === entityId);
    if (index === -1) return null;

    const ent = entities[index];
    const aiConfig = { ...(ent.aiConfig || { enabled: true }) };
    const currentBeliefs = aiConfig.evolvingBeliefs || [];
    const exists = currentBeliefs.some((b) => b.id === belief.id || (b.subject.toLowerCase() === belief.subject.toLowerCase()));
    const updatedBeliefs = exists
      ? currentBeliefs.map((b) => (b.id === belief.id || b.subject.toLowerCase() === belief.subject.toLowerCase() ? belief : b))
      : [...currentBeliefs, belief];

    aiConfig.evolvingBeliefs = updatedBeliefs;
    return this.updateEntity(entityId, { aiConfig });
  }

  static addEntityAlias(entityId: string, rawAlias: string): boolean {
    const alias = rawAlias.trim();
    if (!alias) return false;
    const entities = this.getEntities();
    const index = entities.findIndex((e) => e._id === entityId);
    if (index === -1) return false;

    const ent = { ...entities[index] };
    const currentAliases = Array.isArray(ent.aliases) ? [...ent.aliases] : [];
    if (!currentAliases.some((a) => a.toLowerCase() === alias.toLowerCase())) {
      currentAliases.push(alias);
      ent.aliases = currentAliases;
      entities[index] = ent;
      this.saveEntities(entities);
      cachedEntityLookupMap = null;
      CloudSyncService.triggerCloudSave();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chronicle_entities_updated"));
        window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
      }
      return true;
    }
    return false;
  }

  static deleteEntity(id: string) {
    this.addDeletedEntityId(id);
    const entity = this.getEntities().find((e) => e._id === id);
    if (entity?.images && entity.images.length > 0) {
      FirebaseStorageService.deleteMultipleMedia(entity.images).catch(() => {});
    } else if ((entity as any)?.imageUrl) {
      FirebaseStorageService.deleteMedia((entity as any).imageUrl).catch(() => {});
    }
    const entities = this.getEntities().filter((e) => e._id !== id);
    this.saveEntities(entities);
    if (isSupabaseConfigured()) {
      SupabaseSyncService.deleteEntity(id);
    }

    if (entity?.type === "place") {
      const maps = this.getMaps();
      let mapsChanged = false;

      // 1. Remove map if this place entity was the map itself
      const remainingMaps = maps.filter((m) => {
        if (m.entityId === id || (entity.isMap && m.id === entity.mapId)) {
          mapsChanged = true;
          return false;
        }
        return true;
      });

      // 2. Remove any pins linked to this entity from all remaining maps
      remainingMaps.forEach((m) => {
        const initialPinCount = (m.pins || []).length;
        m.pins = (m.pins || []).filter((p) => p.entityId !== id && p.id !== entity.pinId);
        if (m.pins.length !== initialPinCount) {
          mapsChanged = true;
        }
      });

      if (mapsChanged) {
        this.saveMaps(remainingMaps);
      }
    }
  }

  static getCategories(): Category[] {
    return MOCK_CATEGORIES;
  }

  // === WORLD MAPS, FOLDERS & PINS ===
  static getMapFolders(): MapFolder[] {
    const key = this.getStorageKey("map_folders");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = sanitizeArray<MapFolder>(JSON.parse(saved));
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
      return [];
    });
  }

  static saveMapFolders(folders: MapFolder[]) {
    const key = this.getStorageKey("map_folders");
    const sanitized = sanitizeArray<MapFolder>(folders);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      SupabaseSyncService.saveMapFolders(code, sanitized).catch(() => {});
    }
    try {
      window.dispatchEvent(new CustomEvent('chronicle_map_folders_updated', { detail: { folders: sanitized } }));
    } catch {}
  }

  static saveMapFoldersLocalOnly(folders: MapFolder[]) {
    const key = this.getStorageKey("map_folders");
    const sanitized = sanitizeArray<MapFolder>(folders);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    try {
      window.dispatchEvent(new CustomEvent('chronicle_map_folders_updated', { detail: { folders: sanitized } }));
    } catch {}
  }

  static addMapFolder(data: {
    name: string;
    description?: string;
    color?: string;
    placeEntityId?: string;
  }): MapFolder {
    const folders = this.getMapFolders();
    const newFolderId = "folder_" + Date.now();
    const newFolder: MapFolder = {
      id: newFolderId,
      name: data.name.trim() || "Nuova Cartella Luogo",
      description: data.description?.trim() || "",
      color: data.color || "#3B82F6",
      placeEntityId: data.placeEntityId || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...folders, newFolder];
    this.saveMapFolders(updated);

    // If linked to a Codex place entity, sync
    if (data.placeEntityId) {
      const entities = this.getEntities();
      const entIdx = entities.findIndex((e) => e._id === data.placeEntityId);
      if (entIdx !== -1) {
        entities[entIdx] = {
          ...entities[entIdx],
          folderId: newFolderId,
        };
        this.saveEntities(entities);
      }
    }

    return newFolder;
  }

  static updateMapFolder(id: string, updates: Partial<MapFolder>): MapFolder | null {
    const folders = this.getMapFolders();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    const oldFolder = folders[idx];
    folders[idx] = { ...oldFolder, ...updates };
    this.saveMapFolders(folders);

    if (updates.placeEntityId !== undefined && updates.placeEntityId !== oldFolder.placeEntityId) {
      const entities = this.getEntities();
      if (oldFolder.placeEntityId) {
        const oldEntIdx = entities.findIndex((e) => e._id === oldFolder.placeEntityId);
        if (oldEntIdx !== -1 && entities[oldEntIdx].folderId === id) {
          entities[oldEntIdx].folderId = undefined;
        }
      }
      if (updates.placeEntityId) {
        const newEntIdx = entities.findIndex((e) => e._id === updates.placeEntityId);
        if (newEntIdx !== -1) {
          entities[newEntIdx].folderId = id;
        }
      }
      this.saveEntities(entities);
    }

    return folders[idx];
  }

  static deleteMapFolder(id: string) {
    const folders = this.getMapFolders().filter((f) => f.id !== id);
    this.saveMapFolders(folders);

    // Unassign folderId from maps inside this folder
    const maps = this.getMaps();
    let mapsModified = false;
    const updatedMaps = maps.map((m) => {
      if (m.folderId === id) {
        mapsModified = true;
        return { ...m, folderId: undefined };
      }
      return m;
    });
    if (mapsModified) {
      this.saveMaps(updatedMaps);
    }

    // Unassign folderId from place entities
    const entities = this.getEntities();
    let entsModified = false;
    const updatedEnts = entities.map((e) => {
      if (e.folderId === id) {
        entsModified = true;
        return { ...e, folderId: undefined };
      }
      return e;
    });
    if (entsModified) {
      this.saveEntities(updatedEnts);
    }
  }

  static getMaps(): WorldMap[] {
    const key = this.getStorageKey("maps");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = sanitizeArray<WorldMap>(JSON.parse(saved));
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      return DEFAULT_MAPS;
    });
  }

  static saveMaps(maps: WorldMap[]) {
    const key = this.getStorageKey("maps");
    const sanitized = sanitizeArray<WorldMap>(maps);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      sanitized.forEach((m) => SupabaseSyncService.saveMap(code, m));
    }
    try {
      window.dispatchEvent(new CustomEvent('chronicle_maps_updated', { detail: { maps: sanitized } }));
    } catch {}
  }

  static saveMapsLocalOnly(maps: WorldMap[]) {
    const key = this.getStorageKey("maps");
    const sanitized = sanitizeArray<WorldMap>(maps);
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    try {
      window.dispatchEvent(new CustomEvent('chronicle_maps_updated', { detail: { maps: sanitized } }));
    } catch {}
  }

  static addMap(data: {
    title: string;
    description?: string;
    imageUrl: string;
    scaleLabel?: string;
    entityId?: string;
    folderId?: string;
  }): WorldMap {
    const maps = this.getMaps();
    const newMapId = "map_" + Date.now();
    let entityId = data.entityId;

    // Bi-directional sync: If no existing linked entity, create a corresponding 'place' Entity in the Codex
    const entities = this.getEntities();
    if (!entityId) {
      const existingPlace = entities.find(
        (e) =>
          e.type === "place" &&
          e.name.toLowerCase().trim() === data.title.toLowerCase().trim(),
      );
      if (existingPlace) {
        entityId = existingPlace._id;
        existingPlace.mapId = newMapId;
        existingPlace.isMap = true;
        if (data.folderId && !existingPlace.folderId) {
          existingPlace.folderId = data.folderId;
        }
        if (!existingPlace.images || existingPlace.images.length === 0) {
          existingPlace.images = [data.imageUrl];
        }
        this.saveEntities(entities);
      } else {
        const newPlaceEntity: Entity = {
          _id: "ent_" + Date.now(),
          type: "place",
          name: data.title.trim() || "Nuovo Luogo",
          aliases: [],
          status: "alive",
          progressNote: data.description?.trim() || "",
          color: "#3B82F6",
          images: data.imageUrl ? [data.imageUrl.trim()] : [],
          mapId: newMapId,
          isMap: true,
          folderId: data.folderId || undefined,
        };
        entityId = newPlaceEntity._id;
        this.saveEntities([newPlaceEntity, ...entities]);
      }
    } else {
      const entIndex = entities.findIndex((e) => e._id === entityId);
      if (entIndex !== -1) {
        entities[entIndex] = {
          ...entities[entIndex],
          mapId: newMapId,
          isMap: true,
          folderId: data.folderId || entities[entIndex].folderId,
          images: entities[entIndex].images?.length
            ? entities[entIndex].images
            : [data.imageUrl],
        };
        this.saveEntities(entities);
      }
    }

    const newMap: WorldMap = {
      id: newMapId,
      title: data.title.trim() || "Nuova Mappa",
      description: data.description?.trim() || "",
      imageUrl:
        data.imageUrl.trim() ||
        "https://images.unsplash.com/photo-1524654458049-e36be0721fa2?q=80&w=1600&auto=format&fit=crop",
      scaleLabel: data.scaleLabel?.trim() || "",
      pins: [],
      entityId,
      folderId: data.folderId || undefined,
      createdAt: new Date().toISOString(),
    };
    const updated = [...maps, newMap];
    this.saveMaps(updated);
    return newMap;
  }

  static updateMap(id: string, updates: Partial<WorldMap>): WorldMap | null {
    const maps = this.getMaps();
    const idx = maps.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const oldMap = maps[idx];
    maps[idx] = { ...oldMap, ...updates };
    this.saveMaps(maps);

    // Bi-directional sync: Update corresponding Codex Place Entity
    const entityIdToUpdate = updates.entityId !== undefined ? updates.entityId : oldMap.entityId;
    const entities = this.getEntities();
    const entIdx = entities.findIndex(
      (e) => (entityIdToUpdate && e._id === entityIdToUpdate) || e.mapId === id,
    );
    if (entIdx !== -1) {
      entities[entIdx] = {
        ...entities[entIdx],
        name: updates.title !== undefined ? updates.title : entities[entIdx].name,
        progressNote:
          updates.description !== undefined
            ? updates.description
            : entities[entIdx].progressNote,
        folderId: updates.folderId !== undefined ? updates.folderId : entities[entIdx].folderId,
        images: updates.imageUrl
          ? [
              updates.imageUrl,
              ...(entities[entIdx].images || []).filter(
                (img) => img !== updates.imageUrl,
              ),
            ]
          : entities[entIdx].images,
        mapId: id,
        isMap: true,
      };
      this.saveEntities(entities);
    }

    return maps[idx];
  }

  static deleteMap(id: string) {
    const map = this.getMaps().find((m) => m.id === id);
    if (map?.imageUrl) {
      FirebaseStorageService.deleteMedia(map.imageUrl).catch(() => {});
    }
    const maps = this.getMaps().filter((m) => m.id !== id);
    this.saveMaps(maps);
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      SupabaseSyncService.deleteMap(id, code);
    }

    if (map) {
      const entities = this.getEntities();
      let changed = false;
      const updatedEnts = entities.map((e) => {
        if (e.mapId === id || (map.entityId && e._id === map.entityId)) {
          changed = true;
          return { ...e, mapId: undefined, isMap: false };
        }
        return e;
      });
      if (changed) {
        this.saveEntities(updatedEnts);
      }
    }
  }

  static addPinToMap(mapId: string, pin: Omit<MapPin, "id">): MapPin | null {
    const maps = this.getMaps();
    const idx = maps.findIndex((m) => m.id === mapId);
    if (idx === -1) return null;

    const newPinId = "pin_" + Date.now();
    let entityId = pin.entityId;
    const entities = this.getEntities();

    // Bi-directional sync: If an entity is selected, link and update it;
    // If no entity is selected, automatically register a new 'place' Entity in Codex!
    if (entityId) {
      const entIdx = entities.findIndex((e) => e._id === entityId);
      if (entIdx !== -1) {
        entities[entIdx] = {
          ...entities[entIdx],
          mapId: mapId,
          pinId: newPinId,
          pinCategory: pin.category,
          pinX: pin.x,
          pinY: pin.y,
          progressNote: entities[entIdx].progressNote || pin.description || "",
        };
        this.saveEntities(entities);
      }
    } else {
      // Check if a place with this exact name already exists in Codex
      const existingPlace = entities.find(
        (e) =>
          e.type === "place" &&
          e.name.toLowerCase().trim() === pin.title.toLowerCase().trim(),
      );
      if (existingPlace) {
        entityId = existingPlace._id;
        existingPlace.mapId = mapId;
        existingPlace.pinId = newPinId;
        existingPlace.pinCategory = pin.category;
        existingPlace.pinX = pin.x;
        existingPlace.pinY = pin.y;
        if (!existingPlace.progressNote && pin.description) {
          existingPlace.progressNote = pin.description;
        }
        this.saveEntities(entities);
      } else {
        // Automatically create Place Entity in Codex
        const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 9);
        const newPlaceEntity: Entity = {
          _id: `ent_${Date.now()}_${uniqueSuffix}`,
          type: "place",
          name: pin.title.trim() || "Nuovo Luogo",
          aliases: [],
          status: "alive",
          progressNote: pin.description?.trim() || "",
          color: "#3B82F6",
          images: [],
          mapId: mapId,
          pinId: newPinId,
          pinCategory: pin.category,
          pinX: pin.x,
          pinY: pin.y,
          isMap: false,
        };
        entityId = newPlaceEntity._id;
        this.saveEntities([newPlaceEntity, ...entities]);
      }
    }

    const newPin: MapPin = {
      ...pin,
      id: newPinId,
      entityId,
      entityType: pin.entityType || "place",
    };
    maps[idx].pins = [...(maps[idx].pins || []), newPin];
    this.saveMaps(maps);
    return newPin;
  }

  static updatePin(
    mapId: string,
    pinId: string,
    updates: Partial<MapPin>,
  ): MapPin | null {
    const maps = this.getMaps();
    const mapIdx = maps.findIndex((m) => m.id === mapId);
    if (mapIdx === -1) return null;

    const pinIdx = maps[mapIdx].pins.findIndex((p) => p.id === pinId);
    if (pinIdx === -1) return null;

    const oldPin = maps[mapIdx].pins[pinIdx];
    maps[mapIdx].pins[pinIdx] = { ...oldPin, ...updates };
    this.saveMaps(maps);

    // Bi-directional sync with Codex Entity
    const entityId = updates.entityId !== undefined ? updates.entityId : oldPin.entityId;
    if (entityId) {
      const entities = this.getEntities();
      const entIdx = entities.findIndex((e) => e._id === entityId);
      if (entIdx !== -1) {
        entities[entIdx] = {
          ...entities[entIdx],
          name: updates.title !== undefined ? updates.title : entities[entIdx].name,
          progressNote:
            updates.description !== undefined
              ? updates.description
              : entities[entIdx].progressNote,
          pinCategory: updates.category !== undefined ? updates.category : entities[entIdx].pinCategory,
          pinX: updates.x !== undefined ? updates.x : entities[entIdx].pinX,
          pinY: updates.y !== undefined ? updates.y : entities[entIdx].pinY,
          mapId: mapId,
          pinId: pinId,
        };
        this.saveEntities(entities);
      }
    }

    return maps[mapIdx].pins[pinIdx];
  }

  static deletePin(mapId: string, pinId: string) {
    const maps = this.getMaps();
    const mapIdx = maps.findIndex((m) => m.id === mapId);
    if (mapIdx === -1) return;

    const targetPin = maps[mapIdx].pins.find((p) => p.id === pinId);
    if (targetPin && targetPin.entityId) {
      const entities = this.getEntities();
      const entIdx = entities.findIndex((e) => e._id === targetPin.entityId);
      if (entIdx !== -1) {
        entities[entIdx] = {
          ...entities[entIdx],
          pinId: undefined,
          pinX: undefined,
          pinY: undefined,
          mapId: entities[entIdx].isMap ? entities[entIdx].mapId : undefined,
        };
        this.saveEntities(entities);
      }
    }

    maps[mapIdx].pins = maps[mapIdx].pins.filter((p) => p.id !== pinId);
    this.saveMaps(maps);
  }

  // === AUDIO LOGS & MEMORY BREAKS ===
  static getAudioLogs(): AudioLog[] {
    const key = this.getStorageKey("audio_logs");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
      return [];
    });
  }

  static saveAudioLogs(logs: AudioLog[]) {
    const key = this.getStorageKey("audio_logs");
    setCached(key, logs);
    safeLocalStorageSetItem(key, JSON.stringify(logs));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      logs.forEach((a) => SupabaseSyncService.saveAudioLog(code, a));
    }
  }

  static saveAudioLogsLocalOnly(logs: AudioLog[]) {
    const key = this.getStorageKey("audio_logs");
    setCached(key, logs);
    safeLocalStorageSetItem(key, JSON.stringify(logs));
  }

  static addAudioLog(data: Omit<AudioLog, "id" | "createdAt">): AudioLog {
    const logs = this.getAudioLogs();
    const newLog: AudioLog = {
      ...data,
      id: "aud_" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newLog, ...logs];
    this.saveAudioLogs(updated);
    return newLog;
  }

  static deleteAudioLog(id: string) {
    const logs = this.getAudioLogs().filter((l) => l.id !== id);
    this.saveAudioLogs(logs);
    if (isSupabaseConfigured()) {
      SupabaseSyncService.deleteAudioLog(id);
    }
  }

  // === SCRAPBOOK & VISUAL GALLERY ===
  static getScrapbookItems(): ScrapbookItem[] {
    const key = this.getStorageKey("scrapbook");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
      return [];
    });
  }

  static saveScrapbookItems(items: ScrapbookItem[]) {
    const key = this.getStorageKey("scrapbook");
    setCached(key, items);
    safeLocalStorageSetItem(key, JSON.stringify(items));
    CloudSyncService.triggerCloudSave();
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      items.forEach((s) => SupabaseSyncService.saveScrapbookItem(code, s));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_scrapbook_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
  }

  static saveScrapbookItemsLocalOnly(items: ScrapbookItem[]) {
    const key = this.getStorageKey("scrapbook");
    setCached(key, items);
    safeLocalStorageSetItem(key, JSON.stringify(items));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_scrapbook_updated"));
      window.dispatchEvent(new CustomEvent("chronicle_data_updated"));
    }
  }

  static addScrapbookItem(
    item: Omit<ScrapbookItem, "id" | "createdAt">,
  ): ScrapbookItem {
    const items = this.getScrapbookItems();
    const newItem: ScrapbookItem = {
      ...item,
      id: "scr_" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items];
    this.saveScrapbookItems(updated);

    // Auto-convert Base64 data URL to Supabase Storage public URL
    if (newItem.imageUrl && newItem.imageUrl.startsWith('data:')) {
      const activeCode = this.getActiveCampaignCode() || 'default';
      FirebaseStorageService.uploadMedia(activeCode, 'scrapbook', `${newItem.id}.webp`, newItem.imageUrl)
        .then((publicUrl) => {
          if (publicUrl && publicUrl.startsWith('http')) {
            const currentItems = this.getScrapbookItems();
            const withPublicUrl = currentItems.map((s) => s.id === newItem.id ? { ...s, imageUrl: publicUrl } : s);
            this.saveScrapbookItems(withPublicUrl);
          }
        })
        .catch(() => {});
    }

    return newItem;
  }

  static deleteScrapbookItem(id: string) {
    this.addDeletedScrapbookId(id);
    const item = this.getScrapbookItems().find((i) => i.id === id);
    if (item?.imageUrl) {
      FirebaseStorageService.deleteMedia(item.imageUrl).catch(() => {});
    }
    const items = this.getScrapbookItems().filter((i) => i.id !== id);
    this.saveScrapbookItems(items);
    if (isSupabaseConfigured()) {
      SupabaseSyncService.deleteScrapbookItem(id);
    }
  }

  /**
   * Aggregate all images from Sessions, Entities, Notes, and Scrapbook into a unified visual media stream
   */
  static getAllCampaignMedia(): ScrapbookItem[] {
    const customItems = this.getScrapbookItems();
    const aggregated: ScrapbookItem[] = [...customItems];

    // From Sessions
    const sessions = this.getSessions();
    sessions.forEach((s) => {
      if (s.images && s.images.length > 0) {
        s.images.forEach((img, idx) => {
          aggregated.push({
            id: `media_sess_${s._id}_${idx}`,
            title: `Sessione #${s.number}: ${s.title}`,
            caption: `Illustrazione allegata al Capitolo #${s.number}`,
            imageUrl: img,
            category: "moment",
            loreDate: s.loreDate,
            sessionId: s._id,
            createdAt: s.date,
          });
        });
      }
      if (s.events) {
        s.events.forEach((evt, evtIdx) => {
          if (evt.images && evt.images.length > 0) {
            evt.images.forEach((img, imgIdx) => {
              aggregated.push({
                id: `media_evt_${evt.id}_${imgIdx}`,
                title: evt.title,
                caption: `Evento dalla Sessione #${s.number}`,
                imageUrl: img,
                category: "moment",
                loreDate: evt.loreDate || s.loreDate,
                sessionId: s._id,
                createdAt: s.date,
              });
            });
          }
        });
      }
    });

    // From Entities
    const entities = this.getEntities();
    entities.forEach((ent) => {
      if (ent.images && ent.images.length > 0) {
        ent.images.forEach((img, idx) => {
          let cat: ScrapbookItem["category"] = "character";
          if (ent.type === "place") cat = "place";
          else if (ent.type === "monster") cat = "monster";
          else if (ent.type === "item") cat = "artifact";
          else if (ent.type === "quest") cat = "handout";

          aggregated.push({
            id: `media_ent_${ent._id}_${idx}`,
            title: ent.name,
            caption: `Codex [${ent.type.toUpperCase()}]`,
            imageUrl: img,
            category: cat,
            entityId: ent._id,
            entityType: ent.type,
            createdAt: new Date().toISOString(),
          });
        });
      }
    });

    // From Notes
    const notes = this.getNotes();
    notes.forEach((note) => {
      if (note.images && note.images.length > 0) {
        note.images.forEach((img, idx) => {
          aggregated.push({
            id: `media_note_${note._id}_${idx}`,
            title: note.title,
            caption: `Nota di ${note.author?.characterName || "Giocatore"}`,
            imageUrl: img,
            category: "handout",
            loreDate: note.loreDate,
            authorName: note.author?.characterName,
            createdAt: note._createdAt,
          });
        });
      }
    });

    return aggregated;
  }

  // === CHARACTER BIOGRAPHY & LORE ===
  static getAllCharacterBios(): CharacterBio[] {
    const key = this.getStorageKey("character_bios");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
      return [];
    });
  }

  static async saveAllCharacterBios(bios: CharacterBio[]): Promise<{ success: boolean; error?: string }> {
    const key = this.getStorageKey("character_bios");
    setCached(key, bios);
    safeLocalStorageSetItem(key, JSON.stringify(bios));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      const ok = await SupabaseSyncService.saveCharacterBios(code, bios);
      if (!ok) {
        return { success: false, error: "Errore di salvataggio dei personaggi su Supabase." };
      }
    }
    await CloudSyncService.syncNow(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_character_bio_updated"));
    }
    return { success: true };
  }

  static saveAllCharacterBiosLocalOnly(bios: CharacterBio[]) {
    const key = this.getStorageKey("character_bios");
    setCached(key, bios);
    safeLocalStorageSetItem(key, JSON.stringify(bios));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_character_bio_updated"));
    }
  }

  static getCharacterBio(playerId: string): CharacterBio | null {
    if (!playerId) return null;
    const bios = this.getAllCharacterBios();
    const found = bios.find((b) => b.playerId === playerId);
    if (found) return found;

    // Fallback: check localStorage for legacy/individual key
    const indKey = this.getStorageKey(`char_bio_${playerId}`);
    const indSaved = localStorage.getItem(indKey);
    if (indSaved) {
      try {
        const parsed = JSON.parse(indSaved);
        return parsed;
      } catch {}
    }
    return null;
  }

  static async saveCharacterBio(bio: CharacterBio): Promise<{ success: boolean; error?: string }> {
    if (!bio.playerId) return { success: false, error: "playerId non valido." };
    const bios = this.getAllCharacterBios();
    const idx = bios.findIndex((b) => b.playerId === bio.playerId);
    const updatedBio: CharacterBio = {
      ...bio,
      campaignCode: this.getActiveCampaignCode() || undefined,
      updatedAt: new Date().toISOString(),
    };

    if (idx !== -1) {
      bios[idx] = updatedBio;
    } else {
      bios.push(updatedBio);
    }
    return await this.saveAllCharacterBios(bios);
  }

  // === CHARACTER TIMELINE MEMORIES & BELIEFS (PG) ===
  static addCharacterTimelineMemory(playerId: string, entry: TimelineMemoryEntry): CharacterBio {
    const bio = this.getCharacterBio(playerId) || { playerId };
    const currentMemories = bio.timelineMemories || [];
    const exists = currentMemories.some((m) => m.id === entry.id);
    const updatedMemories = exists
      ? currentMemories.map((m) => (m.id === entry.id ? entry : m))
      : [...currentMemories, entry];

    const updatedBio: CharacterBio = {
      ...bio,
      timelineMemories: updatedMemories,
    };
    this.saveCharacterBio(updatedBio);
    return updatedBio;
  }

  static addCharacterBelief(playerId: string, belief: EvolvingBelief): CharacterBio {
    const bio = this.getCharacterBio(playerId) || { playerId };
    const currentBeliefs = bio.evolvingBeliefs || [];
    const exists = currentBeliefs.some((b) => b.id === belief.id || (b.subject.toLowerCase() === belief.subject.toLowerCase()));
    const updatedBeliefs = exists
      ? currentBeliefs.map((b) => (b.id === belief.id || b.subject.toLowerCase() === belief.subject.toLowerCase() ? belief : b))
      : [...currentBeliefs, belief];

    const updatedBio: CharacterBio = {
      ...bio,
      evolvingBeliefs: updatedBeliefs,
    };
    this.saveCharacterBio(updatedBio);
    return updatedBio;
  }

  static updateCharacterInterPartyRelation(playerId: string, relation: InterPartyRelation): CharacterBio {
    const bio = this.getCharacterBio(playerId) || { playerId };
    const currentRelations = { ...(bio.interPartyRelations || {}) };
    currentRelations[relation.targetPlayerId] = relation;

    const updatedBio: CharacterBio = {
      ...bio,
      interPartyRelations: currentRelations,
    };
    this.saveCharacterBio(updatedBio);
    return updatedBio;
  }

  // === FAMILY TREE & RELATIONSHIPS ===
  static getAllFamilyRelations(): CharacterRelationship[] {
    const key = this.getStorageKey("family_relations");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const seen = new Set<string>();
            return parsed.filter((item) => {
              if (!item || typeof item !== "object" || !item.id) return false;
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          }
        } catch {}
      }
      return [];
    });
  }

  static async saveAllFamilyRelations(relations: CharacterRelationship[]): Promise<{ success: boolean; error?: string }> {
    const key = this.getStorageKey("family_relations");
    // Ensure uniqueness by ID
    const seen = new Set<string>();
    const sanitized = relations.filter((r) => {
      if (!r || !r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      const ok = await SupabaseSyncService.saveFamilyRelations(code, sanitized);
      if (!ok) {
        return { success: false, error: "Errore di salvataggio delle relazioni su Supabase." };
      }
    }
    await CloudSyncService.syncNow(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_family_tree_updated"));
    }
    return { success: true };
  }

  static saveAllFamilyRelationsLocalOnly(relations: CharacterRelationship[]) {
    const key = this.getStorageKey("family_relations");
    const seen = new Set<string>();
    const sanitized = (relations || []).filter((r) => {
      if (!r || !r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_family_tree_updated"));
    }
  }

  static getFamilyRelations(playerId: string): CharacterRelationship[] {
    if (!playerId) return [];
    const all = this.getAllFamilyRelations();
    return all.filter((r) => r.playerId === playerId);
  }

  static async addFamilyRelation(relation: Omit<CharacterRelationship, "id"> & { id?: string }): Promise<{ success: boolean; relation: CharacterRelationship; error?: string }> {
    const id = relation.id || `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRelation: CharacterRelationship = {
      ...relation,
      id,
      createdAt: relation.createdAt || new Date().toISOString(),
    };
    const all = this.getAllFamilyRelations().filter((r) => r.id !== id);
    const updated = [newRelation, ...all];
    const res = await this.saveAllFamilyRelations(updated);
    return { success: res.success, relation: newRelation, error: res.error };
  }

  static async updateFamilyRelation(relation: CharacterRelationship): Promise<{ success: boolean; error?: string }> {
    const all = this.getAllFamilyRelations();
    const updated = all.map((r) => (r.id === relation.id ? relation : r));
    return await this.saveAllFamilyRelations(updated);
  }

  static async deleteFamilyRelation(relationId: string): Promise<{ success: boolean; error?: string }> {
    const all = this.getAllFamilyRelations();
    const targetRel = all.find((r) => r.id === relationId);
    const updated = all.filter((r) => r.id !== relationId);
    if (isSupabaseConfigured() && relationId) {
      SupabaseSyncService.deleteFamilyRelation(relationId, this.getActiveCampaignCode()).catch(() => {});
    }
    const res = await this.saveAllFamilyRelations(updated);

    // If this relationship was linked to a Codex entity or matches an entity, remove that relationship from the entity's partyRelations
    if (targetRel) {
      const entities = this.getEntities();
      let entitiesChanged = false;
      const cleanRelName = (targetRel.name || '').trim().toLowerCase();

      const updatedEntities = entities.map((ent) => {
        if (!ent.aiConfig?.partyRelations) return ent;
        const isTargetEntity =
          (targetRel.linkedEntityId && ent._id === targetRel.linkedEntityId) ||
          (cleanRelName && (ent.name || '').trim().toLowerCase() === cleanRelName);

        if (!isTargetEntity) return ent;

        const pRelations = { ...ent.aiConfig.partyRelations };
        let relModified = false;

        if (targetRel.playerId && pRelations[targetRel.playerId]) {
          delete pRelations[targetRel.playerId];
          relModified = true;
        }

        // Also check any unregistered keys matching the character
        const playerObj = this.getPlayers().find((p) => p._id === targetRel.playerId);
        const playerCharName = playerObj?.characterName?.trim().toLowerCase();
        if (playerCharName) {
          Object.entries(pRelations).forEach(([k, val]) => {
            if (
              k.startsWith('unregistered_') &&
              ((val && val.characterName && typeof val.characterName === 'string' && val.characterName.trim().toLowerCase() === playerCharName) ||
                k.includes(playerCharName.replace(/[^a-z0-9]/gi, '_')))
            ) {
              delete pRelations[k];
              relModified = true;
            }
          });
        }

        if (relModified) {
          entitiesChanged = true;
          return {
            ...ent,
            aiConfig: {
              ...ent.aiConfig,
              partyRelations: pRelations,
            },
          };
        }
        return ent;
      });

      if (entitiesChanged) {
        this.saveEntities(updatedEntities);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chronicle_entities_updated'));
        }
      }
    }
    return res;
  }

  private static _isReconcilingRelations = false;

  static reconcileUnregisteredRelations(playerId: string, characterName: string): number {
    if (!playerId || !characterName) return 0;
    if (this._isReconcilingRelations) return 0;

    const cleanName = characterName.trim().toLowerCase();
    if (!cleanName) return 0;

    this._isReconcilingRelations = true;
    try {
      const entities = this.getEntities();
      let modifiedCount = 0;
      const allFamilyRelations = this.getAllFamilyRelations();

      const updatedEntities = entities.map((ent) => {
        if (!ent.aiConfig || !ent.aiConfig.partyRelations) return ent;
        const partyRelations = { ...ent.aiConfig.partyRelations };
        let entChanged = false;

        // Find keys that match this character name or unregistered prefixes
        Object.entries(partyRelations).forEach(([key, rel]) => {
          if (!rel) return;
          const relCharName = (rel.characterName || '').trim().toLowerCase();
          const isMatch =
            key === playerId ||
            relCharName === cleanName ||
            key === `unregistered_${cleanName.replace(/[^a-z0-9]/gi, '_')}` ||
            (key.startsWith('unregistered_') && relCharName && cleanName.includes(relCharName));

          if (isMatch && (key !== playerId || rel.playerId !== playerId)) {
            // Migrate to playerId key
            partyRelations[playerId] = {
              ...rel,
              playerId,
              characterName: characterName.trim(),
            };
            if (key !== playerId) {
              delete partyRelations[key];
            }
            entChanged = true;
          }
        });

        if (entChanged) {
          modifiedCount++;
          return {
            ...ent,
            aiConfig: {
              ...ent.aiConfig,
              partyRelations,
            },
          };
        }
        return ent;
      });

      if (modifiedCount > 0) {
        this.saveEntities(updatedEntities);
      }

      // Synchronize each partyRelation into player's CharacterRelationship
      const updatedEntitiesList = modifiedCount > 0 ? updatedEntities : entities;
      let relationsChanged = false;
      const updatedFamilyRelations = [...allFamilyRelations];

      updatedEntitiesList.forEach((ent) => {
        const pRel = ent.aiConfig?.partyRelations?.[playerId];
        if (!pRel) return;

        const existingRelIndex = updatedFamilyRelations.findIndex(
          (r) =>
            r.playerId === playerId &&
            (r.linkedEntityId === ent._id ||
              ((r.name || '').trim().toLowerCase() === (ent.name || '').trim().toLowerCase() && (r.name || '').trim() !== ''))
        );

        const attitude = pRel.attitude || 'neutral';
        const relationType = pRel.relationType || '';
        const mappedRelType: RelationshipType =
          attitude === 'hostile' || relationType.toLowerCase().includes('nemico')
            ? 'enemy'
            : attitude === 'suspicious' || relationType.toLowerCase().includes('rivale')
            ? 'rival'
            : attitude === 'devoted' || relationType.toLowerCase().includes('mentore')
            ? 'mentor'
            : relationType.toLowerCase().includes('compagno')
            ? 'companion'
            : 'ally';

        if (existingRelIndex !== -1) {
          // Update existing relation only if fields have genuinely changed (strict diff check)
          const prev = updatedFamilyRelations[existingRelIndex];
          const isFamilyType = ['parent', 'sibling', 'ancestor', 'child', 'descendant', 'spouse'].includes(
            prev.relationshipType
          );
          const nextRelType = isFamilyType ? prev.relationshipType : mappedRelType;
          const nextCustomLabel = relationType || prev.customRelationshipLabel || 'Conoscenza di Campagna';
          const nextBio = pRel.notes || prev.bio || (ent.progressNote ? ent.progressNote.slice(0, 300) : '');
          const nextStatus = ent.status === 'dead' || ent.status === 'destroyed' ? 'deceased' : 'alive';
          const nextAvatar = ent.images?.[0] || prev.avatarUrl || '';

          const hasRealChanged =
            prev.linkedEntityId !== ent._id ||
            prev.name !== ent.name ||
            prev.customRelationshipLabel !== nextCustomLabel ||
            prev.relationshipType !== nextRelType ||
            prev.bio !== nextBio ||
            prev.status !== nextStatus ||
            (nextAvatar && prev.avatarUrl !== nextAvatar);

          if (hasRealChanged) {
            updatedFamilyRelations[existingRelIndex] = {
              ...prev,
              linkedEntityId: ent._id,
              name: ent.name,
              customRelationshipLabel: nextCustomLabel,
              relationshipType: nextRelType,
              bio: nextBio,
              status: nextStatus,
              avatarUrl: nextAvatar,
            };
            relationsChanged = true;
          }
        } else {
          // Create new CharacterRelationship linked to this Codex Entity
          const newRel: CharacterRelationship = {
            id: `rel_sync_${ent._id}_${playerId}`,
            playerId,
            name: ent.name,
            linkedEntityId: ent._id,
            relationshipType: mappedRelType,
            customRelationshipLabel: relationType || 'Conoscenza di Campagna',
            generationCategory: 'connections',
            status: ent.status === 'dead' || ent.status === 'destroyed' ? 'deceased' : 'alive',
            bio: pRel.notes || (ent.progressNote ? ent.progressNote.slice(0, 300) : ''),
            avatarUrl: ent.images?.[0] || '',
            sharedWithParty: true,
            createdAt: new Date().toISOString(),
          };
          updatedFamilyRelations.unshift(newRel);
          relationsChanged = true;
        }
      });

      if (relationsChanged) {
        this.saveAllFamilyRelations(updatedFamilyRelations);
      }

      return modifiedCount;
    } finally {
      this._isReconcilingRelations = false;
    }
  }

  // === WORLD LORE & KNOWLEDGE SYSTEM ===
  static getWorldLoreArticles(): WorldLoreArticle[] {
    const key = this.getStorageKey("world_lore_articles");
    return getCached(key, () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const seen = new Set<string>();
            return parsed.filter((item) => {
              if (!item || typeof item !== "object" || !item._id) return false;
              if (seen.has(item._id)) return false;
              seen.add(item._id);
              return true;
            });
          }
        } catch {}
      }
      return [];
    });
  }

  static getWorldLoreArticleById(id: string): WorldLoreArticle | null {
    if (!id) return null;
    const articles = this.getWorldLoreArticles();
    return articles.find((a) => a._id === id) || null;
  }

  static async saveAllWorldLoreArticles(articles: WorldLoreArticle[]): Promise<{ success: boolean; error?: string }> {
    const key = this.getStorageKey("world_lore_articles");
    const seen = new Set<string>();
    const sanitized = articles.filter((a) => {
      if (!a || !a._id) return false;
      if (seen.has(a._id)) return false;
      seen.add(a._id);
      return true;
    });
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (isSupabaseConfigured()) {
      const code = this.getActiveCampaignCode() || 'default';
      const ok = await SupabaseSyncService.saveWorldLoreArticles(code, sanitized);
      if (!ok) {
        return { success: false, error: "Errore di salvataggio degli articoli di lore su Supabase." };
      }
    }
    await CloudSyncService.syncNow(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_world_lore_updated"));
    }
    return { success: true };
  }

  static saveWorldLoreArticlesLocalOnly(articles: WorldLoreArticle[]) {
    const key = this.getStorageKey("world_lore_articles");
    const seen = new Set<string>();
    const sanitized = articles.filter((a) => {
      if (!a || !a._id) return false;
      if (seen.has(a._id)) return false;
      seen.add(a._id);
      return true;
    });
    setCached(key, sanitized);
    safeLocalStorageSetItem(key, JSON.stringify(sanitized));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chronicle_world_lore_updated"));
    }
  }

  static saveAllWorldLoreArticlesLocalOnly(articles: WorldLoreArticle[]) {
    this.saveWorldLoreArticlesLocalOnly(articles);
  }

  static saveWorldLoreArticle(article: WorldLoreArticle): WorldLoreArticle {
    const id = article._id || `lore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const cleanArticle: WorldLoreArticle = {
      ...article,
      _id: id,
      _createdAt: article._createdAt || now,
      _updatedAt: now,
      bites: (article.bites || []).map((b) => ({
        ...b,
        id: b.id || `bite_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        knownBy: Array.isArray(b.knownBy) ? b.knownBy : [],
      })),
    };

    const articles = this.getWorldLoreArticles();
    const existingIndex = articles.findIndex((a) => a._id === id);
    let updated: WorldLoreArticle[];
    if (existingIndex >= 0) {
      updated = [...articles];
      updated[existingIndex] = cleanArticle;
    } else {
      updated = [cleanArticle, ...articles];
    }

    this.saveAllWorldLoreArticles(updated);
    return cleanArticle;
  }

  static deleteWorldLoreArticle(articleId: string) {
    if (!articleId) return;
    this.addDeletedWorldLoreArticleId(articleId);
    const articles = this.getWorldLoreArticles();
    const targetArticle = articles.find((a) => a._id === articleId);
    const updated = articles.filter((a) => a._id !== articleId);
    if (isSupabaseConfigured() && articleId) {
      SupabaseSyncService.deleteWorldLoreArticle(articleId, this.getActiveCampaignCode()).catch(() => {});
    }
    this.saveAllWorldLoreArticles(updated);

    // Also remove any references from character bios
    if (targetArticle) {
      const bios = this.getAllCharacterBios();
      let biosChanged = false;
      const updatedBios = bios.map((bio) => {
        if (!bio.knownLoreBites || bio.knownLoreBites.length === 0) return bio;
        const filtered = bio.knownLoreBites.filter((b) => b.articleId !== articleId);
        if (filtered.length !== bio.knownLoreBites.length) {
          biosChanged = true;
          return { ...bio, knownLoreBites: filtered };
        }
        return bio;
      });
      if (biosChanged) {
        this.saveAllCharacterBios(updatedBios);
      }
    }
  }

  static assignLoreBiteToPlayer(
    articleId: string,
    biteId: string,
    playerId: string,
    playerName: string,
    acquisitionNote?: string
  ) {
    const articles = this.getWorldLoreArticles();
    const article = articles.find((a) => a._id === articleId);
    if (!article) return;

    const biteIndex = article.bites.findIndex((b) => b.id === biteId);
    if (biteIndex === -1) return;

    const bite = article.bites[biteIndex];
    const knownBy = [...(bite.knownBy || [])];
    const existingIndex = knownBy.findIndex((k) => k.id === playerId && k.type === 'player');

    const now = new Date().toISOString();
    const assigneeEntry: LoreBiteAssignee = {
      id: playerId,
      name: playerName,
      type: 'player',
      acquisitionNote: acquisitionNote || (existingIndex >= 0 ? knownBy[existingIndex].acquisitionNote : ''),
      addedAt: existingIndex >= 0 ? knownBy[existingIndex].addedAt : now,
    };

    if (existingIndex >= 0) {
      knownBy[existingIndex] = assigneeEntry;
    } else {
      knownBy.push(assigneeEntry);
    }

    const updatedBites = [...article.bites];
    updatedBites[biteIndex] = { ...bite, knownBy };
    const updatedArticle = { ...article, bites: updatedBites, _updatedAt: now };
    this.saveWorldLoreArticle(updatedArticle);

    // Sync into CharacterBio
    const bio = this.getCharacterBio(playerId) || { playerId };
    const currentKnown = [...(bio.knownLoreBites || [])];
    const itemIndex = currentKnown.findIndex((k) => k.articleId === articleId && k.biteId === biteId);
    const knownItem: CharacterKnownLoreItem = {
      articleId,
      biteId,
      articleTitle: article.title,
      biteTitle: bite.title,
      biteLevel: bite.level,
      note: acquisitionNote,
      addedAt: now,
    };

    if (itemIndex >= 0) {
      currentKnown[itemIndex] = knownItem;
    } else {
      currentKnown.push(knownItem);
    }

    this.saveCharacterBio({ ...bio, knownLoreBites: currentKnown });
  }

  static batchSyncArticleBitesToBios(article: WorldLoreArticle) {
    if (!article || !article._id || !Array.isArray(article.bites) || article.bites.length === 0) return;
    const bios = this.getAllCharacterBios();
    const biosMap = new Map<string, CharacterBio>();
    bios.forEach((b) => biosMap.set(b.playerId, { ...b }));

    let hasAnyBioChanged = false;
    const now = new Date().toISOString();

    article.bites.forEach((bite) => {
      if (!Array.isArray(bite.knownBy)) return;
      bite.knownBy.forEach((assignee) => {
        if (assignee.type !== 'player' || !assignee.id) return;
        const currentBio = biosMap.get(assignee.id) || { playerId: assignee.id };
        const currentKnown = [...(currentBio.knownLoreBites || [])];
        const existingIdx = currentKnown.findIndex(
          (k) => k.articleId === article._id && k.biteId === bite.id
        );
        const knownItem: CharacterKnownLoreItem = {
          articleId: article._id,
          biteId: bite.id,
          articleTitle: article.title,
          biteTitle: bite.title,
          biteLevel: bite.level,
          note: assignee.acquisitionNote || '',
          addedAt: assignee.addedAt || now,
        };
        if (existingIdx >= 0) {
          const prevItem = currentKnown[existingIdx];
          if (
            prevItem.articleTitle !== knownItem.articleTitle ||
            prevItem.biteTitle !== knownItem.biteTitle ||
            prevItem.biteLevel !== knownItem.biteLevel ||
            prevItem.note !== knownItem.note
          ) {
            currentKnown[existingIdx] = knownItem;
            currentBio.knownLoreBites = currentKnown;
            biosMap.set(assignee.id, currentBio);
            hasAnyBioChanged = true;
          }
        } else {
          currentKnown.push(knownItem);
          currentBio.knownLoreBites = currentKnown;
          biosMap.set(assignee.id, currentBio);
          hasAnyBioChanged = true;
        }
      });
    });

    if (hasAnyBioChanged) {
      this.saveAllCharacterBiosLocalOnly(Array.from(biosMap.values()));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_bios_updated'));
      }
    }
  }

  static removeLoreBiteFromPlayer(articleId: string, biteId: string, playerId: string) {
    const articles = this.getWorldLoreArticles();
    const article = articles.find((a) => a._id === articleId);
    if (!article) return;

    const biteIndex = article.bites.findIndex((b) => b.id === biteId);
    if (biteIndex === -1) return;

    const bite = article.bites[biteIndex];
    const knownBy = (bite.knownBy || []).filter((k) => !(k.id === playerId && k.type === 'player'));

    const updatedBites = [...article.bites];
    updatedBites[biteIndex] = { ...bite, knownBy };
    const updatedArticle = { ...article, bites: updatedBites, _updatedAt: new Date().toISOString() };
    this.saveWorldLoreArticle(updatedArticle);

    // Remove from CharacterBio
    const bio = this.getCharacterBio(playerId);
    if (bio && bio.knownLoreBites) {
      const filtered = bio.knownLoreBites.filter((k) => !(k.articleId === articleId && k.biteId === biteId));
      this.saveCharacterBio({ ...bio, knownLoreBites: filtered });
    }
  }

  static assignLoreBiteToEntity(
    articleId: string,
    biteId: string,
    entityId: string,
    entityName: string,
    acquisitionNote?: string
  ) {
    const articles = this.getWorldLoreArticles();
    const article = articles.find((a) => a._id === articleId);
    if (!article) return;

    const biteIndex = article.bites.findIndex((b) => b.id === biteId);
    if (biteIndex === -1) return;

    const bite = article.bites[biteIndex];
    const knownBy = [...(bite.knownBy || [])];
    const existingIndex = knownBy.findIndex((k) => k.id === entityId && k.type === 'entity');

    const now = new Date().toISOString();
    const assigneeEntry: LoreBiteAssignee = {
      id: entityId,
      name: entityName,
      type: 'entity',
      acquisitionNote: acquisitionNote || (existingIndex >= 0 ? knownBy[existingIndex].acquisitionNote : ''),
      addedAt: existingIndex >= 0 ? knownBy[existingIndex].addedAt : now,
    };

    if (existingIndex >= 0) {
      knownBy[existingIndex] = assigneeEntry;
    } else {
      knownBy.push(assigneeEntry);
    }

    const updatedBites = [...article.bites];
    updatedBites[biteIndex] = { ...bite, knownBy };
    const updatedArticle = { ...article, bites: updatedBites, _updatedAt: now };
    this.saveWorldLoreArticle(updatedArticle);
  }

  static removeLoreBiteFromEntity(articleId: string, biteId: string, entityId: string) {
    const articles = this.getWorldLoreArticles();
    const article = articles.find((a) => a._id === articleId);
    if (!article) return;

    const biteIndex = article.bites.findIndex((b) => b.id === biteId);
    if (biteIndex === -1) return;

    const bite = article.bites[biteIndex];
    const knownBy = (bite.knownBy || []).filter((k) => !(k.id === entityId && k.type === 'entity'));

    const updatedBites = [...article.bites];
    updatedBites[biteIndex] = { ...bite, knownBy };
    const updatedArticle = { ...article, bites: updatedBites, _updatedAt: new Date().toISOString() };
    this.saveWorldLoreArticle(updatedArticle);
  }

  // === BACKUP & EXPORT / IMPORT ===
  static exportFullBackup(): { filename: string; json: string } {
    const code = this.getActiveCampaignCode() || 'CHRONICLE';
    const backupData = {
      _chronicleBackupVersion: 1,
      exportedAt: new Date().toISOString(),
      campaignCode: code,
      campaignMeta: this.getCampaignMeta() || { code, name: `Campagna ${code}`, createdAt: new Date().toISOString() },
      sessions: this.getSessions(),
      chapters: this.getChapters(),
      entities: this.getEntities(),
      notes: this.getNotes(),
      worldLoreArticles: this.getWorldLoreArticles(),
      calendar: this.getCalendar(),
      maps: this.getMaps(),
      mapFolders: this.getMapFolders(),
      characterBios: this.getAllCharacterBios(),
      familyRelations: this.getAllFamilyRelations(),
      audioLogs: this.getAudioLogs(),
      scrapbookItems: this.getScrapbookItems(),
    };
    const json = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `chronicle-backup-${code.toLowerCase()}-${dateStr}.json`;
    return { filename, json };
  }

  static downloadBackupFile() {
    const { filename, json } = this.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  static async importFullBackup(jsonString: string): Promise<{ success: boolean; error?: string }> {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Il file selezionato non è un backup JSON valido.' };
      }

      const code = (data.campaignCode || data.campaignMeta?.code || this.getActiveCampaignCode() || '').trim().toUpperCase();
      if (!code) {
        return { success: false, error: 'Codice campagna mancante nel file di backup.' };
      }

      // Ensure active campaign code is set
      this.setActiveCampaignCode(code);

      // Clear any previous tombstones so all backup data is accepted
      this.clearDeletedIds();

      // Restore all collections
      if (Array.isArray(data.sessions)) this.saveSessions(data.sessions);
      if (Array.isArray(data.entities)) this.saveEntities(data.entities);
      if (Array.isArray(data.notes)) this.saveNotes(data.notes);
      if (Array.isArray(data.worldLoreArticles)) this.saveAllWorldLoreArticles(data.worldLoreArticles);
      if (Array.isArray(data.chapters)) this.saveChapters(data.chapters);
      if (data.calendar) this.saveCalendar(data.calendar);
      if (Array.isArray(data.maps)) this.saveMaps(data.maps);
      if (Array.isArray(data.mapFolders)) this.saveMapFolders(data.mapFolders);
      if (Array.isArray(data.characterBios)) this.saveAllCharacterBios(data.characterBios);
      if (Array.isArray(data.familyRelations)) this.saveAllFamilyRelations(data.familyRelations);
      if (Array.isArray(data.audioLogs)) this.saveAudioLogs(data.audioLogs);
      if (Array.isArray(data.scrapbookItems)) this.saveScrapbookItems(data.scrapbookItems);

      if (data.campaignMeta) {
        this.updateCampaignMeta(code, data.campaignMeta);
      }

      // Force immediate sync to Firestore cloud
      await CloudSyncService.syncNow(true);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_data_updated'));
        window.dispatchEvent(new CustomEvent('chronicle_campaign_updated'));
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Errore durante la lettura del file di backup.' };
    }
  }
}

