import { auth, db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ApiKeyManager } from './apiKeyManager';
import { CampaignManager } from '../store/campaignStore';
import { UserProfileSyncService } from './userProfileSync';
import { SupabaseSyncService } from './supabaseSyncService';
import { isSupabaseConfigured } from './supabase';
import { generateCampaignShareToken, resolveCampaignPresentationSlug, slugifyCampaignTitle, reverseCode } from './shareToken';
import { extractTextFromContent } from './sanitize';
import {
  UserAccount,
  CampaignMeta,
  Session,
  CampaignChapter,
  Entity,
  Note,
  WorldMap,
  MapFolder,
  AudioLog,
  ScrapbookItem,
  CharacterBio,
  CharacterRelationship,
  WorldLoreArticle,
} from '../types';

// Debounce timer to prevent rapid bursts of writes to Firestore
let syncTimeout: any = null;
let isApplyingRemoteUpdate = false;
let isUploadInFlight = false;
let hasQueuedUpload = false;
let pendingRemoteSnapshot: { data: any; code: string } | null = null;
let lastSyncedPayloadHash = '';
let lastSyncedMediaHash = '';

function checkIsQuotaExhausted(): boolean {
  try {
    const stored = localStorage.getItem('chronicle_firestore_quota_exhausted');
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    // Quota pause retry interval: 5 minutes instead of 4 hours so user can retry immediately after optimization
    if (Date.now() - parsed.time < 5 * 60 * 1000) {
      return true;
    } else {
      localStorage.removeItem('chronicle_firestore_quota_exhausted');
    }
  } catch (e) {}
  return false;
}

function markQuotaExhausted() {
  try {
    localStorage.setItem('chronicle_firestore_quota_exhausted', JSON.stringify({ time: Date.now() }));
  } catch (e) {}
}

export function resetQuotaExhaustedFlag() {
  try {
    localStorage.removeItem('chronicle_firestore_quota_exhausted');
  } catch (e) {}
}

/**
 * Sanitizes any data payload for Firestore by completely removing undefined fields
 * (converting to null or omitting object keys) to prevent Firestore's
 * "Function setDoc() called with invalid data. Unsupported field value: undefined" error.
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

/**
 * Compresses an image data URL for presentation sharing so all session artwork
 * fits reliably within Firestore document limits without loss of detail.
 */
async function compressPresentationImage(imgStr: string): Promise<string> {
  if (!imgStr || typeof imgStr !== 'string') return '';
  if (!imgStr.startsWith('data:image')) return imgStr;
  if (imgStr.length < 60000) return imgStr; // already small (< 45 KB)

  if (typeof document === 'undefined') return imgStr;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imgStr);
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/webp', 0.75);
          resolve(dataUrl.length < imgStr.length ? dataUrl : imgStr);
        } catch {
          resolve(imgStr);
        }
      };
      img.onerror = () => resolve(imgStr);
      img.src = imgStr;
    } catch {
      resolve(imgStr);
    }
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 4500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operazione Firestore scaduta per timeout.')), timeoutMs)),
  ]);
}

export class CloudSyncService {
  private static unsubscribeSnapshot: (() => void) | null = null;
  private static unsubscribeGlobalAccounts: (() => void) | null = null;
  private static unsubscribeGlobalCampaigns: (() => void) | null = null;
  private static unsubscribeDmSecretsSnapshot: (() => void) | null = null;
  private static isInitialized = false;
  private static isGlobalInitialized = false;
  private static isCampaignHydrated = false;

  static getIsCampaignHydrated(): boolean {
    return this.isCampaignHydrated;
  }

  /**
   * Conflict-free deep merger for notes across party members.
   * Ensures no user's note is ever overwritten by another user.
   */
  static mergeNotes(localNotes: Note[], remoteNotes: Note[], deletedIds = new Set<string>()): Note[] {
    const map = new Map<string, Note>();

    const getNoteTs = (n: Note): number => {
      const d = n._updatedAt || n._createdAt;
      return d ? new Date(d).getTime() : 0;
    };

    // 1. Remote notes (ignoring deleted)
    (remoteNotes || []).forEach((r) => {
      if (r && r._id && !deletedIds.has(r._id)) {
        map.set(r._id, { ...r });
      }
    });

    // 2. Local notes (union and conflict resolution)
    (localNotes || []).forEach((l) => {
      if (!l || !l._id || deletedIds.has(l._id)) return;

      if (!map.has(l._id)) {
        map.set(l._id, { ...l });
      } else {
        const r = map.get(l._id)!;
        const lTs = getNoteTs(l);
        const rTs = getNoteTs(r);

        if (lTs >= rTs) {
          map.set(l._id, {
            ...r,
            ...l,
            dmResponse: l.dmResponse !== undefined ? l.dmResponse : r.dmResponse,
            hiddenForDm: l.hiddenForDm !== undefined ? l.hiddenForDm : r.hiddenForDm,
            hiddenForPlayerIds: Array.from(new Set([...(l.hiddenForPlayerIds || []), ...(r.hiddenForPlayerIds || [])])),
            images: (l.images && l.images.length > 0) ? l.images : (r.images || []),
            tags: Array.from(new Set([...(l.tags || []), ...(r.tags || [])])),
          });
        } else {
          map.set(l._id, {
            ...l,
            ...r,
            dmResponse: r.dmResponse !== undefined ? r.dmResponse : l.dmResponse,
            hiddenForDm: r.hiddenForDm !== undefined ? r.hiddenForDm : l.hiddenForDm,
            hiddenForPlayerIds: Array.from(new Set([...(r.hiddenForPlayerIds || []), ...(l.hiddenForPlayerIds || [])])),
            images: (r.images && r.images.length > 0) ? r.images : (l.images || []),
            tags: Array.from(new Set([...(r.tags || []), ...(l.tags || [])])),
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tA = new Date(a._createdAt || 0).getTime();
      const tB = new Date(b._createdAt || 0).getTime();
      return tB - tA;
    });
  }

  /**
   * Conflict-free deep merger for Codex entities across party members.
   * Guarantees that neither a user's new entity nor 300 existing Codex entries are ever wiped.
   */
  static mergeEntities(localEntities: Entity[], remoteEntities: Entity[], deletedIds = new Set<string>()): Entity[] {
    const map = new Map<string, Entity>();

    const getEntityTs = (e: Entity): number => {
      const d = (e as any)._updatedAt || (e as any)._createdAt;
      return d ? new Date(d).getTime() : 0;
    };

    // 1. Remote entities
    (remoteEntities || []).forEach((r) => {
      if (r && r._id && !deletedIds.has(r._id)) {
        map.set(r._id, { ...r });
      }
    });

    // 2. Local entities
    (localEntities || []).forEach((l) => {
      if (!l || !l._id || deletedIds.has(l._id)) return;

      if (!map.has(l._id)) {
        map.set(l._id, { ...l });
      } else {
        const r = map.get(l._id)!;
        const lTs = getEntityTs(l);
        const rTs = getEntityTs(r);

        if (lTs >= rTs) {
          map.set(l._id, {
            ...r,
            ...l,
            images: (l.images && l.images.length > 0) ? l.images : (r.images || []),
            aliases: Array.from(new Set([...(l.aliases || []), ...(r.aliases || [])])),
          });
        } else {
          map.set(l._id, {
            ...l,
            ...r,
            images: (r.images && r.images.length > 0) ? r.images : (l.images || []),
            aliases: Array.from(new Set([...(r.aliases || []), ...(l.aliases || [])])),
          });
        }
      }
    });

    return Array.from(map.values());
  }

  /**
   * Conflict-free deep merger for World Lore articles across devices and party.
   * Preserves all lore bites, knownBy assignments, and images without data loss.
   */
  static mergeWorldLoreArticles(
    localArticles: WorldLoreArticle[],
    remoteArticles: WorldLoreArticle[],
    deletedIds = new Set<string>()
  ): WorldLoreArticle[] {
    const map = new Map<string, WorldLoreArticle>();

    const getArticleTs = (a: WorldLoreArticle): number => {
      const d = a._updatedAt || a._createdAt;
      return d ? new Date(d).getTime() : 0;
    };

    (remoteArticles || []).forEach((r) => {
      if (r && r._id && !deletedIds.has(r._id)) {
        map.set(r._id, { ...r });
      }
    });

    (localArticles || []).forEach((l) => {
      if (!l || !l._id || deletedIds.has(l._id)) return;

      if (!map.has(l._id)) {
        map.set(l._id, { ...l });
      } else {
        const r = map.get(l._id)!;
        const lTs = getArticleTs(l);
        const rTs = getArticleTs(r);

        // Merge bites preserving knownBy assignments
        const biteMap = new Map<string, any>();
        (r.bites || []).forEach((b) => { if (b && b.id) biteMap.set(b.id, b); });
        (l.bites || []).forEach((b) => {
          if (b && b.id) {
            const rb = biteMap.get(b.id);
            if (rb) {
              const mergedKnownBy = [...(rb.knownBy || [])];
              (b.knownBy || []).forEach((k: any) => {
                if (!mergedKnownBy.some((mk) => mk.id === k.id)) {
                  mergedKnownBy.push(k);
                }
              });
              biteMap.set(b.id, { ...rb, ...b, knownBy: mergedKnownBy });
            } else {
              biteMap.set(b.id, b);
            }
          }
        });

        const fullMarkdown = (l.fullContentMarkdown && l.fullContentMarkdown.trim()) || (r.fullContentMarkdown && r.fullContentMarkdown.trim()) || '';

        if (lTs >= rTs) {
          map.set(l._id, {
            ...r,
            ...l,
            fullContentMarkdown: fullMarkdown || l.fullContentMarkdown || r.fullContentMarkdown || '',
            bites: Array.from(biteMap.values()),
            images: (l.images && l.images.length > 0) ? l.images : (r.images || []),
          });
        } else {
          map.set(l._id, {
            ...l,
            ...r,
            fullContentMarkdown: fullMarkdown || r.fullContentMarkdown || l.fullContentMarkdown || '',
            bites: Array.from(biteMap.values()),
            images: (r.images && r.images.length > 0) ? r.images : (l.images || []),
          });
        }
      }
    });

    return Array.from(map.values());
  }

  /**
   * Conflict-free merger for sessions and log events.
   */
  static mergeSessions(localSessions: Session[], remoteSessions: Session[], deletedIds = new Set<string>()): Session[] {
    const map = new Map<string, Session>();

    (remoteSessions || []).forEach((r) => {
      if (r && r._id && !deletedIds.has(r._id)) {
        map.set(r._id, { ...r });
      }
    });

    (localSessions || []).forEach((l) => {
      if (!l || !l._id || deletedIds.has(l._id)) return;

      if (!map.has(l._id)) {
        map.set(l._id, { ...l });
      } else {
        const r = map.get(l._id)!;
        const eventMap = new Map<string, any>();
        (r.events || []).forEach((e: any) => { if (e && e.id) eventMap.set(e.id, e); });
        (l.events || []).forEach((e: any) => { if (e && e.id) eventMap.set(e.id, { ...(eventMap.get(e.id) || {}), ...e }); });

        // Merge images: preserve local ordering while appending any missing remote media
        let mergedImages = r.images || [];
        if (l.images && l.images.length > 0) {
          if (!r.images || r.images.length === 0) {
            mergedImages = l.images;
          } else {
            const localSet = new Set(l.images);
            const extraRemote = r.images.filter((img) => !localSet.has(img));
            mergedImages = [...l.images, ...extraRemote];
          }
        }

        map.set(l._id, {
          ...r,
          ...l,
          events: Array.from(eventMap.values()),
          images: mergedImages,
          coverImage: l.coverImage || r.coverImage || '',
          chapterName: r.chapterName || l.chapterName,
          chapterId: r.chapterId || l.chapterId,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.number - a.number);
  }

  /**
   * Conflict-free merger for chapters / narrative arcs.
   */
  static mergeChapters(localChapters: CampaignChapter[], remoteChapters: CampaignChapter[]): CampaignChapter[] {
    const chapterMap = new Map<string, CampaignChapter>();
    const nameToCanonicalIdMap = new Map<string, string>();

    const ingestChapter = (chap: CampaignChapter) => {
      if (!chap || !chap.name) return;
      const normName = chap.name.trim().toLowerCase();
      if (!normName) return;

      const existingCanonicalId = nameToCanonicalIdMap.get(normName);

      if (existingCanonicalId && chapterMap.has(existingCanonicalId)) {
        const existing = chapterMap.get(existingCanonicalId)!;
        const resolvedCover = (chap.coverImageUrl && chap.coverImageUrl.trim()) || (existing.coverImageUrl && existing.coverImageUrl.trim()) || "";
        const resolvedDesc = (chap.description && chap.description.trim()) || (existing.description && existing.description.trim()) || "";
        const resolvedColor = chap.color || existing.color || "#D4AF37";
        chapterMap.set(existingCanonicalId, {
          ...existing,
          ...chap,
          id: existingCanonicalId,
          name: chap.name.trim() || existing.name.trim(),
          description: resolvedDesc,
          coverImageUrl: resolvedCover,
          color: resolvedColor,
        });
      } else if (chap.id && chapterMap.has(chap.id)) {
        const existing = chapterMap.get(chap.id)!;
        const resolvedCover = (chap.coverImageUrl && chap.coverImageUrl.trim()) || (existing.coverImageUrl && existing.coverImageUrl.trim()) || "";
        const resolvedDesc = (chap.description && chap.description.trim()) || (existing.description && existing.description.trim()) || "";
        const resolvedColor = chap.color || existing.color || "#D4AF37";
        chapterMap.set(chap.id, {
          ...existing,
          ...chap,
          id: chap.id,
          name: chap.name.trim() || existing.name.trim(),
          description: resolvedDesc,
          coverImageUrl: resolvedCover,
          color: resolvedColor,
        });
        nameToCanonicalIdMap.set(normName, chap.id);
      } else {
        const cleanId = chap.id || "chap_" + Date.now();
        const finalChap = { ...chap, id: cleanId, name: chap.name.trim() };
        chapterMap.set(cleanId, finalChap);
        nameToCanonicalIdMap.set(normName, cleanId);
      }
    };

    // Process remote chapters first so authoritative Cloud IDs take precedence
    (remoteChapters || []).forEach(ingestChapter);
    (localChapters || []).forEach(ingestChapter);

    return Array.from(chapterMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  static mergeMaps(localMaps: WorldMap[], remoteMaps: WorldMap[]): WorldMap[] {
    const map = new Map<string, WorldMap>();
    (remoteMaps || []).forEach((m) => { if (m && m.id) map.set(m.id, { ...m }); });
    (localMaps || []).forEach((l) => {
      if (!l || !l.id) return;
      if (!map.has(l.id)) {
        map.set(l.id, { ...l });
      } else {
        const r = map.get(l.id)!;
        const pinMap = new Map<string, any>();
        (r.pins || []).forEach((p: any) => { if (p && p.id) pinMap.set(p.id, p); });
        (l.pins || []).forEach((p: any) => { if (p && p.id) pinMap.set(p.id, { ...(pinMap.get(p.id) || {}), ...p }); });

        map.set(l.id, {
          ...r,
          ...l,
          pins: Array.from(pinMap.values()),
          imageUrl: l.imageUrl || r.imageUrl,
        });
      }
    });
    return Array.from(map.values());
  }

  /**
   * Conflict-free merger for Scrapbook & Visual Memories across party members.
   */
  static mergeScrapbookItems(localItems: ScrapbookItem[], remoteItems: ScrapbookItem[], deletedIds = new Set<string>()): ScrapbookItem[] {
    const map = new Map<string, ScrapbookItem>();
    (remoteItems || []).forEach((r) => {
      if (r && r.id && !deletedIds.has(r.id)) {
        map.set(r.id, { ...r });
      }
    });
    (localItems || []).forEach((l) => {
      if (!l || !l.id || deletedIds.has(l.id)) return;
      if (!map.has(l.id)) {
        map.set(l.id, { ...l });
      } else {
        map.set(l.id, { ...map.get(l.id)!, ...l });
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  private static accountsSyncDebounceTimer: any = null;

  /**
   * Directly syncs accounts array to Supabase with debounce
   */
  static async syncAccountsToCloud(accounts: UserAccount[]) {
    if (!isSupabaseConfigured() || !Array.isArray(accounts) || accounts.length === 0) return;

    if (this.accountsSyncDebounceTimer) {
      clearTimeout(this.accountsSyncDebounceTimer);
    }

    this.accountsSyncDebounceTimer = setTimeout(() => {
      // Always persist to central public.user_accounts table
      SupabaseSyncService.saveAllUserAccounts(accounts).catch(() => {});

      const activeCode = CampaignManager.getActiveCampaignCode();
      if (activeCode && activeCode !== '__NONE__') {
        SupabaseSyncService.saveActivePlayers(activeCode, accounts).catch(() => {});
      }
    }, 400);
  }

  /**
   * Directly syncs global campaigns
   */
  static async syncCampaignsToCloud(campaigns: CampaignMeta[]) {
    if (!Array.isArray(campaigns) || campaigns.length === 0) return;
    try {
      campaigns.forEach((camp) => {
        if (camp && camp.code) {
          SupabaseSyncService.saveCampaign(camp.code, {
            title: camp.name || camp.code,
            dmId: camp.dmId || '',
          }).catch(() => {});
        }
      });
    } catch (e) {
      console.warn('[CloudSync] Failed to sync campaigns to Supabase:', e);
    }
  }

  /**
   * Deletes a campaign and syncs updated state
   */
  static async deleteCampaignFromCloud(
    campaignCode: string,
    _updatedCampaigns: CampaignMeta[],
    _updatedAccounts: UserAccount[]
  ) {
    if (!campaignCode) return;
    try {
      const code = campaignCode.trim();
      const { supabase } = await import('./supabase');
      await supabase.from('campaigns').delete().eq('code', code);
    } catch (e) {
      console.warn('[CloudSync] Failed to delete campaign from Supabase:', e);
    }
  }

  private static globalAccountsFetchInFlight: Promise<void> | null = null;
  private static lastGlobalAccountsFetchTime = 0;

  /**
   * Immediate synchronous/async fetch for user accounts and global campaigns from Supabase
   */
  static async fetchGlobalAccountsNow(force = false): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const now = Date.now();
    if (!force && now - this.lastGlobalAccountsFetchTime < 3000) {
      return;
    }
    if (this.globalAccountsFetchInFlight) {
      return this.globalAccountsFetchInFlight;
    }

    this.lastGlobalAccountsFetchTime = now;
    this.globalAccountsFetchInFlight = (async () => {
      try {
        const [remoteAccounts, remoteCampaigns] = await Promise.all([
          SupabaseSyncService.fetchAllUserAccounts(),
          SupabaseSyncService.fetchAllCampaigns(),
        ]);

        if (Array.isArray(remoteAccounts) && remoteAccounts.length > 0) {
          this.mergeRemoteAccounts(remoteAccounts);
        }
        if (Array.isArray(remoteCampaigns) && remoteCampaigns.length > 0) {
          this.mergeRemoteCampaigns(remoteCampaigns);
        }
      } catch (e) {
        console.warn('[CloudSync] Global accounts fetch warn:', e);
      } finally {
        this.globalAccountsFetchInFlight = null;
      }
    })();

    return this.globalAccountsFetchInFlight;
  }

  /**
   * Initializes real-time listener for global accounts & campaigns
   */
  static initGlobalSync() {
    if (!isSupabaseConfigured()) return;
    this.fetchGlobalAccountsNow();
  }

  private static mergeRemoteAccounts(remoteAccounts: UserAccount[], remoteDeletedIds: string[] = []) {
    if (Array.isArray(remoteDeletedIds)) {
      remoteDeletedIds.forEach((id) => {
        if (id) CampaignManager.addDeletedAccountId(id);
      });
    }
    const deletedIds = new Set(CampaignManager.getDeletedAccountIds());
    const localAccounts = CampaignManager.getAccounts();
    const campaigns = CampaignManager.getCampaigns();
    const currentActiveId = typeof window !== 'undefined'
      ? (localStorage.getItem('chronicle_global_active_user_id') || localStorage.getItem('chronicle_current_account_id'))
      : null;
    const mergedMap = new Map<string, UserAccount>();

    // Build expelled lookup: accountId -> Set of uppercase campaignCodes they are expelled from
    const expelledMap = new Map<string, Set<string>>();
    campaigns.forEach((c) => {
      if (c.expelledAccountIds && Array.isArray(c.expelledAccountIds)) {
        c.expelledAccountIds.forEach((accId) => {
          if (!expelledMap.has(accId)) expelledMap.set(accId, new Set());
          expelledMap.get(accId)!.add(c.code.toUpperCase());
        });
      }
    });

    const activeCode = CampaignManager.getActiveCampaignCode();
    const cleanActiveCode = (activeCode || '').trim().toUpperCase();

    remoteAccounts.forEach((acc) => {
      if (acc && acc.id && !deletedIds.has(acc.id)) {
        const userExpelled = expelledMap.get(acc.id);
        const joined = (acc.joinedCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );
        // If restored from campaign active_players and joined is empty or missing current campaign, ensure it's joined
        if (cleanActiveCode && !userExpelled?.has(cleanActiveCode) && !joined.some((c) => c.toUpperCase() === cleanActiveCode)) {
          joined.push(cleanActiveCode);
        }

        const dm = (acc.dmCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );

        const profiles = { ...(acc.campaignProfiles || {}) };
        if (cleanActiveCode && !profiles[cleanActiveCode] && acc.characterName) {
          profiles[cleanActiveCode] = {
            characterName: acc.characterName,
            avatarUrl: acc.avatarUrl || '',
            color: acc.color || '#6366f1',
            status: 'active',
            tags: [],
          };
        }

        mergedMap.set(acc.id, {
          ...acc,
          joinedCampaigns: joined,
          dmCampaigns: dm,
          campaignProfiles: profiles,
        });
      }
    });

    localAccounts.forEach((loc) => {
      if (!loc || !loc.id || deletedIds.has(loc.id)) return;
      const userExpelled = expelledMap.get(loc.id);

      if (!mergedMap.has(loc.id)) {
        const joined = (loc.joinedCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );
        const dm = (loc.dmCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );
        mergedMap.set(loc.id, {
          ...loc,
          joinedCampaigns: joined,
          dmCampaigns: dm,
        });
      } else {
        const rem = mergedMap.get(loc.id)!;
        const isLocActive = Boolean(currentActiveId && loc.id === currentActiveId);
        const mergedCampaignProfiles: Record<string, any> = {};
        const allCampKeys = Array.from(new Set([
          ...Object.keys(rem.campaignProfiles || {}),
          ...Object.keys(loc.campaignProfiles || {}),
        ])).filter((code) => !userExpelled?.has(code.toUpperCase()));

        allCampKeys.forEach((k) => {
          const pLoc = loc.campaignProfiles?.[k];
          const pRem = rem.campaignProfiles?.[k];
          if (!pRem && pLoc) mergedCampaignProfiles[k] = { ...pLoc };
          else if (!pLoc && pRem) mergedCampaignProfiles[k] = { ...pRem };
          else if (pLoc && pRem) {
            const pTop = isLocActive ? pLoc : pRem;
            const pBase = isLocActive ? pRem : pLoc;
            const resolvedTags =
              (pLoc.tags && pLoc.tags.length > 0)
                ? pLoc.tags
                : (pRem.tags && pRem.tags.length > 0 ? pRem.tags : []);
            const resolvedAliases =
              (pLoc.aliases && pLoc.aliases.length > 0)
                ? pLoc.aliases
                : (pRem.aliases && pRem.aliases.length > 0 ? pRem.aliases : []);
            const resolvedStatus =
              (pLoc.status && pLoc.status !== 'active')
                ? pLoc.status
                : (pRem.status || pLoc.status || 'active');

            mergedCampaignProfiles[k] = {
              characterName: pTop.characterName || pBase.characterName,
              color: pTop.color || pBase.color || '#6366f1',
              avatarUrl: pTop.avatarUrl !== undefined ? pTop.avatarUrl : pBase.avatarUrl,
              status: resolvedStatus,
              tags: resolvedTags,
              aliases: resolvedAliases,
            };
          }
        });

        // Joined campaigns & DM roles: prioritize active local edits or authoritative cloud data
        const rawJoined = isLocActive
          ? (loc.joinedCampaigns || rem.joinedCampaigns || [])
          : (rem.joinedCampaigns !== undefined ? rem.joinedCampaigns : loc.joinedCampaigns || []);
        const rawDm = isLocActive
          ? (loc.dmCampaigns || rem.dmCampaigns || [])
          : (rem.dmCampaigns !== undefined ? rem.dmCampaigns : loc.dmCampaigns || []);

        const finalJoined = rawJoined.filter((code) => !userExpelled?.has(code.toUpperCase()));
        const finalDm = rawDm.filter((code) => !userExpelled?.has(code.toUpperCase()));

        const finalTags =
          (loc.tags && loc.tags.length > 0)
            ? loc.tags
            : (rem.tags && rem.tags.length > 0 ? rem.tags : []);
        const finalAliases =
          (loc.aliases && loc.aliases.length > 0)
            ? loc.aliases
            : (rem.aliases && rem.aliases.length > 0 ? rem.aliases : []);

        mergedMap.set(loc.id, {
          ...rem,
          ...loc,
          characterName: loc.characterName || rem.characterName,
          color: (isLocActive && loc.color) ? loc.color : (loc.color || rem.color || '#6366f1'),
          avatarUrl: loc.avatarUrl !== undefined ? loc.avatarUrl : rem.avatarUrl,
          joinedCampaigns: finalJoined,
          dmCampaigns: finalDm,
          campaignProfiles: mergedCampaignProfiles,
          tags: finalTags,
          aliases: finalAliases,
        });
      }
    });

    const rawAccounts = Array.from(mergedMap.values());
    const { accounts: finalAccounts, modified } = CampaignManager.deduplicateAccounts(rawAccounts);

    const prevAccountsJson = localStorage.getItem('chronicle_global_user_accounts');
    const newAccountsJson = JSON.stringify(finalAccounts);
    const hasAccountChanges = prevAccountsJson !== newAccountsJson;

    if (hasAccountChanges) {
      CampaignManager.saveAccountsLocalOnly(finalAccounts);
      if (modified || finalAccounts.length < rawAccounts.length) {
        // Sync the deduplicated list back to cloud to fix duplicates in Firestore
        this.syncAccountsToCloud(finalAccounts);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_accounts_updated'));
      }
    }
  }

  private static mergeRemoteCampaigns(remoteCampaigns: CampaignMeta[]) {
    const localCampaigns = CampaignManager.getCampaigns();
    const map = new Map<string, CampaignMeta>();

    remoteCampaigns.forEach((c) => {
      if (c && c.code) {
        const cleanCode = c.code.toUpperCase();
        map.set(cleanCode, { ...c, code: cleanCode });
      }
    });

    localCampaigns.forEach((c) => {
      if (c && c.code) {
        const cleanCode = c.code.toUpperCase();
        if (!map.has(cleanCode)) {
          map.set(cleanCode, { ...c, code: cleanCode });
        } else {
          const rem = map.get(cleanCode)!;
          const mergedExpelled = Array.from(new Set([
            ...(rem.expelledAccountIds || []),
            ...(c.expelledAccountIds || []),
          ]));
          map.set(cleanCode, {
            ...rem,
            ...c,
            expelledAccountIds: mergedExpelled,
          });
        }
      }
    });

    const finalCampaigns = Array.from(map.values());
    const prevCampJson = localStorage.getItem('chronicle_campaigns_list');
    const newCampJson = JSON.stringify(finalCampaigns);
    const hasCampChanges = prevCampJson !== newCampJson;

    if (hasCampChanges) {
      CampaignManager.saveCampaignsLocalOnly(finalCampaigns);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
      }
    }
  }

  /**
   * Applies sensitive DM-only secrets (notes dmOnly: true, secret events, and private player bios)
   * received from /dnd_campaigns/{code}__dm_secrets.
   */
  private static applyDmSecrets(dmData: any, activeCode: string) {
    if (!dmData) return;
    const currentAccount = CampaignManager.getCurrentAccount();
    const isDm = Boolean(currentAccount?.isDm || (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)));
    if (!isDm) return;

    isApplyingRemoteUpdate = true;
    try {
      let hasChanges = false;

      // 1. Merge DM notes
      if (Array.isArray(dmData.dmNotes) && dmData.dmNotes.length > 0) {
        const localNotes = CampaignManager.getNotes();
        const mergedNotes = this.mergeNotes(localNotes, dmData.dmNotes, new Set(CampaignManager.getDeletedNoteIds()));
        CampaignManager.saveNotes(mergedNotes);
        hasChanges = true;
      }

      // 2. Merge secret events into sessions
      if (dmData.dmSecretEvents && typeof dmData.dmSecretEvents === 'object') {
        const localSessions = CampaignManager.getSessions();
        let sessionsModified = false;
        localSessions.forEach((sess) => {
          const secretEvts = dmData.dmSecretEvents[sess._id];
          if (Array.isArray(secretEvts) && secretEvts.length > 0) {
            const existingEventIds = new Set((sess.events || []).map((e: any) => e.id));
            secretEvts.forEach((se: any) => {
              if (!existingEventIds.has(se.id)) {
                sess.events = [...(sess.events || []), se];
                existingEventIds.add(se.id);
                sessionsModified = true;
              }
            });
          }
        });
        if (sessionsModified) {
          CampaignManager.saveSessions(localSessions);
          hasChanges = true;
        }
      }

      // 3. Merge secret character bios
      if (dmData.dmSecretBios && typeof dmData.dmSecretBios === 'object') {
        const localBios = CampaignManager.getAllCharacterBios();
        let biosModified = false;
        localBios.forEach((bio) => {
          const sBio = dmData.dmSecretBios[bio.playerId];
          if (sBio) {
            if (sBio.backstoryMarkdown && bio.backstoryMarkdown !== sBio.backstoryMarkdown) {
              bio.backstoryMarkdown = sBio.backstoryMarkdown;
              biosModified = true;
            }
            if (sBio.secrets && bio.secrets !== sBio.secrets) {
              bio.secrets = sBio.secrets;
              biosModified = true;
            }
          }
        });
        if (biosModified) {
          CampaignManager.saveAllCharacterBiosLocalOnly(localBios);
          hasChanges = true;
        }
      }

      // 4. Merge secret DM World Lore articles
      if (Array.isArray(dmData.dmWorldLoreArticles) && dmData.dmWorldLoreArticles.length > 0) {
        const localArticles = CampaignManager.getWorldLoreArticles();
        const mergedArticles = this.mergeWorldLoreArticles(
          localArticles,
          dmData.dmWorldLoreArticles,
          new Set(CampaignManager.getDeletedWorldLoreArticleIds())
        );
        CampaignManager.saveWorldLoreArticlesLocalOnly(mergedArticles);
        hasChanges = true;
      }

      if (hasChanges && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_data_updated'));
      }
    } finally {
      isApplyingRemoteUpdate = false;
    }
  }

  /**
   * Initializes real-time two-way synchronization with Firebase Firestore
   */
  static async init(onCloudUpdated?: () => void) {
    // Reset any transient quota lock on clean init
    resetQuotaExhaustedFlag();

    // Reset hydration state for the incoming campaign
    this.isCampaignHydrated = false;

    // If already initialized, stop first to avoid orphan listeners
    if (this.isInitialized) {
      this.stop();
    }

    this.isInitialized = true;

    try {
      const activeCode = CampaignManager.getActiveCampaignCode();
      if (!activeCode || activeCode === '__NONE__') {
        this.isCampaignHydrated = true;
        if (onCloudUpdated) onCloudUpdated();
        return;
      }

      // 0. Primary Source of Truth: Fetch from Supabase PostgreSQL if configured
      if (isSupabaseConfigured()) {
        try {
          const supaData = await SupabaseSyncService.fetchCampaignData(activeCode);
          if (supaData) {
            console.log(`[CloudSync] Hydrated from Supabase: ${supaData.sessions?.length || 0} sessions, ${supaData.notes?.length || 0} notes, ${supaData.entities?.length || 0} entities`);
            if (supaData.title) {
              try {
                const allCamps = CampaignManager.getCampaigns();
                const idx = allCamps.findIndex((c) => c.code === activeCode);
                if (idx !== -1) {
                  if (allCamps[idx].name !== supaData.title) {
                    allCamps[idx].name = supaData.title;
                    CampaignManager.saveCampaignsLocalOnly(allCamps);
                  }
                } else {
                  allCamps.push({
                    code: activeCode,
                    name: supaData.title,
                    createdAt: new Date().toISOString(),
                  });
                  CampaignManager.saveCampaignsLocalOnly(allCamps);
                }
                CampaignManager.updateCampaignMeta(activeCode, {
                  name: supaData.title,
                  dmId: supaData.dmId || undefined,
                });
              } catch (e) {
                console.warn('[Supabase] meta hydration warn:', e);
              }
            }
            if (Array.isArray(supaData.sessions)) {
              try {
                const localSess = CampaignManager.getSessions();
                const supaIds = new Set(supaData.sessions.map((s: any) => s._id));
                const localOnly = localSess.filter((s: any) => s && s._id && !supaIds.has(s._id));
                const merged = [...supaData.sessions, ...localOnly];
                CampaignManager.saveSessionsLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only sessions to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((s: any) => SupabaseSyncService.saveSession(activeCode, s));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.chapters)) {
              try {
                const localChaps = CampaignManager.getChapters();
                const supaIds = new Set(supaData.chapters.map((c: any) => c.id));
                const localOnly = localChaps.filter((c: any) => c && c.id && !supaIds.has(c.id));
                const merged = [...supaData.chapters, ...localOnly];
                CampaignManager.saveChaptersLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only chapters to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((c: any) => SupabaseSyncService.saveChapter(activeCode, c));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.notes)) {
              try {
                const localNotes = CampaignManager.getNotes();
                const supaIds = new Set(supaData.notes.map((n: any) => n._id));
                const localOnly = localNotes.filter((n: any) => n && n._id && !supaIds.has(n._id));
                const merged = [...supaData.notes, ...localOnly];
                CampaignManager.saveNotesLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only notes to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((n: any) => SupabaseSyncService.saveNote(activeCode, n));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.entities)) {
              try {
                const localEnts = CampaignManager.getEntities();
                const supaIds = new Set(supaData.entities.map((e: any) => e._id));
                const localOnly = localEnts.filter((e: any) => e && e._id && !supaIds.has(e._id));
                const merged = [...supaData.entities, ...localOnly];
                CampaignManager.saveEntitiesLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only entities to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((e: any) => SupabaseSyncService.saveEntity(activeCode, e));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.maps)) {
              try {
                const localMaps = CampaignManager.getMaps();
                const supaIds = new Set(supaData.maps.map((m: any) => m.id));
                const localOnly = localMaps.filter((m: any) => m && m.id && !supaIds.has(m.id));
                const merged = [...supaData.maps, ...localOnly];
                CampaignManager.saveMapsLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only maps to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((m: any) => SupabaseSyncService.saveMap(activeCode, m));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.mapFolders)) {
              try { CampaignManager.saveMapFoldersLocalOnly(supaData.mapFolders); } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.scrapbookItems)) {
              try {
                const localItems = CampaignManager.getScrapbookItems();
                const supaIds = new Set(supaData.scrapbookItems.map((i: any) => i.id));
                const localOnly = localItems.filter((i: any) => i && i.id && !supaIds.has(i.id));
                const merged = [...supaData.scrapbookItems, ...localOnly];
                CampaignManager.saveScrapbookItemsLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only scrapbook items to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((i: any) => SupabaseSyncService.saveScrapbookItem(activeCode, i));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.audioLogs)) {
              try {
                const localLogs = CampaignManager.getAudioLogs();
                const supaIds = new Set(supaData.audioLogs.map((l: any) => l.id));
                const localOnly = localLogs.filter((l: any) => l && l.id && !supaIds.has(l.id));
                const merged = [...supaData.audioLogs, ...localOnly];
                CampaignManager.saveAudioLogsLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only audio logs to Supabase...`);
                  setTimeout(() => {
                    localOnly.forEach((l: any) => SupabaseSyncService.saveAudioLog(activeCode, l));
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.characterBios)) {
              try {
                const localBios = CampaignManager.getAllCharacterBios();
                const supaIds = new Set(supaData.characterBios.map((b: any) => b.playerId));
                const localOnly = localBios.filter((b: any) => b && b.playerId && !supaIds.has(b.playerId));
                const merged = [...supaData.characterBios, ...localOnly];
                CampaignManager.saveAllCharacterBiosLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only biographies to Supabase...`);
                  setTimeout(() => {
                    SupabaseSyncService.saveCharacterBios(activeCode, localOnly);
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.familyRelations)) {
              try {
                const localRels = CampaignManager.getAllFamilyRelations();
                const supaIds = new Set(supaData.familyRelations.map((r: any) => r.id));
                const localOnly = localRels.filter((r: any) => r && r.id && !supaIds.has(r.id));
                const merged = [...supaData.familyRelations, ...localOnly];
                CampaignManager.saveAllFamilyRelationsLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only relations to Supabase...`);
                  setTimeout(() => {
                    SupabaseSyncService.saveFamilyRelations(activeCode, localOnly);
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.worldLoreArticles)) {
              try {
                const localArts = CampaignManager.getWorldLoreArticles();
                const supaIds = new Set(supaData.worldLoreArticles.map((a: any) => a._id));
                const localOnly = localArts.filter((a: any) => a && a._id && !supaIds.has(a._id));
                const merged = [...supaData.worldLoreArticles, ...localOnly];
                CampaignManager.saveAllWorldLoreArticlesLocalOnly(merged);
                if (localOnly.length > 0) {
                  console.log(`[CloudSync] Syncing ${localOnly.length} local-only world lore articles to Supabase...`);
                  setTimeout(() => {
                    SupabaseSyncService.saveWorldLoreArticles(activeCode, localOnly);
                  }, 2500);
                }
              } catch (e) { console.warn(e); }
            }
            if (Array.isArray(supaData.activePlayers)) {
              try { this.mergeRemoteAccounts(supaData.activePlayers); } catch (e) { console.warn(e); }
            }

            // Hydrate lore calendar from Supabase
            if (supaData.calendarSystem && typeof supaData.calendarSystem === 'object' && Object.keys(supaData.calendarSystem).length > 0) {
              try {
                CampaignManager.saveCalendarLocalOnly(supaData.calendarSystem);
              } catch (e) {
                console.warn('[CloudSync] Calendar hydration warn:', e);
              }
            }

            // Self-heal legacy base64 scrapbook items to Supabase Storage
            try {
              const currentItems = CampaignManager.getScrapbookItems();
              const base64Items = currentItems.filter((i) => i.imageUrl && i.imageUrl.startsWith('data:'));
              if (base64Items.length > 0) {
                setTimeout(async () => {
                  const { FirebaseStorageService } = await import('./firebaseStorageService');
                  let updatedAny = false;
                  const newItems = [...CampaignManager.getScrapbookItems()];
                  for (const bItem of base64Items) {
                    try {
                      const pubUrl = await FirebaseStorageService.uploadMedia(activeCode, 'scrapbook', `${bItem.id}.webp`, bItem.imageUrl);
                      if (pubUrl && pubUrl.startsWith('http')) {
                        const targetIdx = newItems.findIndex((it) => it.id === bItem.id);
                        if (targetIdx !== -1) {
                          newItems[targetIdx] = { ...newItems[targetIdx], imageUrl: pubUrl };
                          updatedAny = true;
                        }
                      }
                    } catch {}
                  }
                  if (updatedAny) {
                    CampaignManager.saveScrapbookItems(newItems);
                  }
                }, 3000);
              }
            } catch {}

            if (supaData.dossier?.aiKeys || supaData.aiConfig?.aiKeys) {
              try {
                ApiKeyManager.hydrateCampaignKeysFromRemote(activeCode, supaData.dossier?.aiKeys || supaData.aiConfig?.aiKeys);
              } catch (e) {
                console.warn('[CloudSync] AI keys hydration warn:', e);
              }
            }

            this.isCampaignHydrated = true;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('chronicle_campaign_updated'));
              window.dispatchEvent(new CustomEvent('chronicle_sessions_updated', { detail: { sessions: supaData.sessions } }));
              window.dispatchEvent(new CustomEvent('chronicle_chapters_updated'));
              window.dispatchEvent(new CustomEvent('chronicle_data_updated'));
            }
          }
        } catch (err) {
          console.warn('[Supabase] Initial fetch warning:', err);
        } finally {
          this.isCampaignHydrated = true;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('hasPendingUpload', 'false');
          }
          if (onCloudUpdated) {
            try { onCloudUpdated(); } catch {}
          }
        }
        return;
      }
      this.isCampaignHydrated = true;
      if (onCloudUpdated) onCloudUpdated();
    } catch (e) {
      this.isCampaignHydrated = true;
      console.warn('Could not initialize Cloud Sync:', e);
    }
  }

  private static realtimeUnsubscribe: (() => void) | null = null;

  /**
   * Connects to Supabase Realtime WebSockets to apply live changes across party members without refreshing
   */
  private static setupSupabaseRealtime(activeCode: string) {
    if (this.realtimeUnsubscribe) {
      try { this.realtimeUnsubscribe(); } catch {}
      this.realtimeUnsubscribe = null;
    }

    this.realtimeUnsubscribe = SupabaseSyncService.subscribeCampaignRealtime(activeCode, {
      onSessionsChange: (payload) => {
        try {
          const sessions = CampaignManager.getSessions();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = sessions.filter((s) => s._id !== delId);
              CampaignManager.saveSessionsLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanSess: any = {
              _id: row.id,
              sessionNumber: row.session_number,
              title: row.title || `Sessione ${row.session_number}`,
              date: row.played_at || new Date().toISOString(),
              summary: row.summary || '',
              tags: row.tags || [],
              characters: row.characters || [],
              location: row.location || '',
              chapterId: row.chapter_id || undefined,
              loreYear: row.lore_year,
              loreMonth: row.lore_month,
              loreStartDay: row.lore_start_day,
              loreEndDay: row.lore_end_day,
              updatedAt: row.updated_at || new Date().toISOString(),
            };
            const idx = sessions.findIndex((s) => s._id === cleanSess._id);
            const updated = idx !== -1 ? sessions.map((s) => s._id === cleanSess._id ? cleanSess : s) : [cleanSess, ...sessions];
            CampaignManager.saveSessionsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Session update error:', e);
        }
      },
      onNotesChange: (payload) => {
        try {
          const notes = CampaignManager.getNotes();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = notes.filter((n) => n._id !== delId);
              CampaignManager.saveNotesLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanNote: any = {
              _id: row.id,
              title: row.title || 'Senza Titolo',
              content: row.content || '',
              category: row.category || 'general',
              tags: row.tags || [],
              images: row.images || [],
              dmOnly: Boolean(row.is_secret),
              authorPlayerId: row.author_player_id || undefined,
              authorName: row.author_name || undefined,
              pinned: Boolean(row.is_pinned),
              updatedAt: row.updated_at || new Date().toISOString(),
            };
            const idx = notes.findIndex((n) => n._id === cleanNote._id);
            const updated = idx !== -1 ? notes.map((n) => n._id === cleanNote._id ? cleanNote : n) : [cleanNote, ...notes];
            CampaignManager.saveNotesLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Note update error:', e);
        }
      },
      onEntitiesChange: (payload) => {
        try {
          const entities = CampaignManager.getEntities();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = entities.filter((e) => e._id !== delId);
              CampaignManager.saveEntitiesLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanEnt: any = {
              _id: row.id,
              name: row.name || 'Entità Sconosciuta',
              type: row.entity_type || 'npc',
              description: row.description || '',
              summary: row.summary || '',
              tags: row.tags || [],
              images: row.images || [],
              dmOnly: Boolean(row.is_secret),
              status: row.status || 'unknown',
              location: row.location || '',
              aiConfig: row.ai_config || undefined,
              updatedAt: row.updated_at || new Date().toISOString(),
            };
            const idx = entities.findIndex((e) => e._id === cleanEnt._id);
            const updated = idx !== -1 ? entities.map((e) => e._id === cleanEnt._id ? cleanEnt : e) : [cleanEnt, ...entities];
            CampaignManager.saveEntitiesLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Entity update error:', e);
        }
      },
      onBiosChange: (payload) => {
        try {
          const bios = CampaignManager.getAllCharacterBios();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.player_id;
            if (delId) {
              const updated = bios.filter((b) => b.playerId !== delId);
              CampaignManager.saveAllCharacterBiosLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanBio: any = {
              playerId: row.player_id,
              campaignCode: row.campaign_code,
              characterName: row.name || '',
              name: row.name || '',
              avatarUrl: row.avatar_url || '',
              color: row.color || '#6366f1',
              characterClass: row.class_level || '',
              characterAlignment: row.alignment || '',
              backstoryMarkdown: row.background || '',
              personalityTraits: row.personality ? row.personality.split(', ') : [],
              ideals: row.ideals || '',
              bonds: row.bonds || '',
              flaws: row.flaws || '',
              timelineMemories: row.timeline_memories || [],
              evolvingBeliefs: row.evolving_beliefs || [],
              interPartyRelations: row.inter_party_relations || {},
              characterRace: row.character_race || row.extra_data?.characterRace || '',
              characterTitle: row.character_title || row.extra_data?.characterTitle || '',
              deityOrPatron: row.deity_or_patron || row.extra_data?.deityOrPatron || '',
              hometown: row.hometown || row.extra_data?.hometown || '',
              birthDateFormatted: row.birth_date_formatted || row.extra_data?.birthDateFormatted || '',
              birthStartDay: row.birth_start_day || row.extra_data?.birthStartDay || 1,
              birthMonth: row.birth_month || row.extra_data?.birthMonth || '',
              birthYear: row.birth_year || row.extra_data?.birthYear || 1492,
              secrets: row.secrets || row.extra_data?.secrets || '',
              appearanceDescription: row.appearance_description || row.extra_data?.appearanceDescription || '',
              currentStatus: row.current_status || row.extra_data?.currentStatus || '',
              knownLoreBites: row.known_lore_bites || row.extra_data?.knownLoreBites || [],
              privacySettings: row.privacy_settings || row.extra_data?.privacySettings || {},
              updatedAt: row.updated_at || new Date().toISOString(),
            };
            const idx = bios.findIndex((b) => b.playerId === cleanBio.playerId);
            const updated = idx !== -1 ? bios.map((b) => b.playerId === cleanBio.playerId ? cleanBio : b) : [cleanBio, ...bios];
            CampaignManager.saveAllCharacterBiosLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Bio update error:', e);
        }
      },
      onRelationsChange: (payload) => {
        try {
          const rels = CampaignManager.getAllFamilyRelations();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = rels.filter((r) => r.id !== delId);
              CampaignManager.saveAllFamilyRelationsLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanRel: any = {
              id: row.id,
              playerId: row.source_entity_id,
              linkedEntityId: row.target_entity_id,
              relationshipType: row.relationship_type,
              bio: row.description || '',
              sharedWithParty: !row.is_secret,
              name: row.name || '',
              avatarUrl: row.avatar_url || '',
              customRelationshipLabel: row.custom_relationship_label || '',
              titleOrRole: row.title_or_role || '',
              generationCategory: row.generation_category || 'same_generation',
              genealogyRole: row.genealogy_role || '',
              sideOfFamily: row.side_of_family || 'unspecified',
              status: row.status || 'alive',
              secondParentId: row.second_parent_id || '',
              otherParentName: row.other_parent_name || '',
              linkedPlayerId: row.linked_player_id || '',
              tags: row.tags || [],
              order: row.order_index || 0,
              updatedAt: row.updated_at || new Date().toISOString(),
            };
            const idx = rels.findIndex((r) => r.id === cleanRel.id);
            const updated = idx !== -1 ? rels.map((r) => r.id === cleanRel.id ? cleanRel : r) : [cleanRel, ...rels];
            CampaignManager.saveAllFamilyRelationsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Relation update error:', e);
        }
      },
      onLoreChange: (payload) => {
        try {
          const arts = CampaignManager.getWorldLoreArticles();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = arts.filter((a) => a._id !== delId);
              CampaignManager.saveAllWorldLoreArticlesLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            const cleanArt: any = {
              _id: row.id,
              _createdAt: row.updated_at || new Date().toISOString(),
              title: row.title || 'Senza Titolo',
              subtitle: row.subtitle || '',
              summary: row.summary || '',
              fullContentMarkdown: row.content || '',
              category: row.category_id || 'general',
              images: row.images || [],
              dmOnly: Boolean(row.is_draft),
              bites: row.bites || [],
              authorPlayerId: row.author_player_id || '',
              authorName: row.author_name || '',
              tags: row.tags || [],
              relatedEntityIds: row.related_entity_ids || [],
              order: row.order_index || 0,
            };
            const idx = arts.findIndex((a) => a._id === cleanArt._id);
            const updated = idx !== -1 ? arts.map((a) => a._id === cleanArt._id ? cleanArt : a) : [cleanArt, ...arts];
            CampaignManager.saveAllWorldLoreArticlesLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Lore update error:', e);
        }
      },
      onCampaignChange: (payload) => {
        try {
          const row = payload.new;
          if (row) {
            if (row.calendar_system && typeof row.calendar_system === 'object') {
              CampaignManager.saveCalendarLocalOnly(row.calendar_system);
            }
            if (row.title) {
              CampaignManager.updateCampaignMeta(activeCode, {
                name: row.title,
                dmId: row.dm_id || undefined,
              });
            }
          }
        } catch (e) {
          console.warn('[Realtime] Campaign update error:', e);
        }
      },
    });
  }

  /**
   * Pushes the current complete state to Cloud Firestore (with debouncing & hash check)
   */
  static triggerCloudSave() {
    if (isApplyingRemoteUpdate || checkIsQuotaExhausted() || !this.isCampaignHydrated) return;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hasPendingUpload', 'true');
    }

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      this.uploadLocalToCloud();
    }, 1500);
  }

  static getLastSyncTime(): string | null {
    try {
      return localStorage.getItem('chronicle_last_cloud_sync_time');
    } catch {
      return null;
    }
  }

  /**
   * Forces an immediate synchronization of the campaign and global data to Firestore Cloud.
   */
  static async syncNow(force: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (force) {
      resetQuotaExhaustedFlag();
      lastSyncedPayloadHash = '';
    }

    try {
      // 1. Sync global accounts and campaigns
      this.syncAccountsToCloud(CampaignManager.getAccounts());
      this.syncCampaignsToCloud(CampaignManager.getCampaigns());

      // 2. Upload current active campaign
      const uploadResult = await this.uploadLocalToCloud(force);
      return uploadResult;
    } catch (e: any) {
      console.error('Error during manual Cloud Sync:', e);
      return { success: false, error: e?.message || 'Impossibile completare la sincronizzazione Cloud.' };
    }
  }

  /**
   * Completely clears and resets local campaign data
   */
  static async wipeCloudCampaign(_campaignCode?: string) {
    // Supabase handles campaign reset
  }

  private static async uploadLocalToCloud(force: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (isApplyingRemoteUpdate || (!force && checkIsQuotaExhausted())) {
      return { success: false, error: 'Sincronizzazione in corso o quota Firestore temporaneamente limitata.' };
    }

    if (!force && !this.isCampaignHydrated) {
      console.warn('[CloudSync] Upload blocked: campaign hydration in progress.');
      return { success: false, error: 'Sincronizzazione iniziale in corso...' };
    }

    if (isUploadInFlight) {
      hasQueuedUpload = true;
      return { success: true };
    }

    isUploadInFlight = true;

    try {
      const activeCode = CampaignManager.getActiveCampaignCode();
      if (!activeCode || activeCode === 'default_campaign' || activeCode === '__NONE__') {
        return { success: false, error: 'Nessuna campagna attiva valida.' };
      }

      const nowIso = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hasPendingUpload', 'false');
        localStorage.setItem('chronicle_last_cloud_sync_time', nowIso);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_cloud_sync_status', { detail: { status: 'synced', time: nowIso } }));
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Errore durante la sincronizzazione.' };
    } finally {
      isUploadInFlight = false;
      if (hasQueuedUpload) {
        hasQueuedUpload = false;
        setTimeout(() => {
          this.uploadLocalToCloud();
        }, 500);
      }
    }
  }

  private static async _legacyUnusedUpload() {
    return;
  }

  private static async applyRemoteData(remote: any, campaignCode?: string) {
    if (!remote) return;
    try {
      isApplyingRemoteUpdate = true;

      // Update content hash so we don't immediately trigger a re-upload of what we just received
      const { _updatedAt, ...contentToHash } = remote;
      lastSyncedPayloadHash = JSON.stringify(contentToHash);

      const activeCode = campaignCode || CampaignManager.getActiveCampaignCode() || 'default_campaign';
      if (activeCode && activeCode !== 'default_campaign' && CampaignManager.getActiveCampaignCode() !== activeCode) {
        CampaignManager.setActiveCampaignCode(activeCode);
      }

      // Ingest any remote tombstones so this client stays in sync with deletions
      if (Array.isArray(remote.deletedNoteIds)) {
        CampaignManager.addMultipleDeletedNoteIds(remote.deletedNoteIds);
      }
      if (Array.isArray(remote.deletedEntityIds)) {
        CampaignManager.addMultipleDeletedEntityIds(remote.deletedEntityIds);
      }
      if (Array.isArray(remote.deletedSessionIds)) {
        CampaignManager.addMultipleDeletedSessionIds(remote.deletedSessionIds);
      }
      if (Array.isArray(remote.deletedScrapbookIds)) {
        CampaignManager.addMultipleDeletedSessionIds(remote.deletedScrapbookIds);
      }
      if (Array.isArray(remote.deletedNotificationIds)) {
        CampaignManager.addMultipleDeletedNotificationIds(remote.deletedNotificationIds);
      }
      if (Array.isArray(remote.deletedWorldLoreArticleIds)) {
        CampaignManager.addMultipleDeletedWorldLoreArticleIds(remote.deletedWorldLoreArticleIds);
      }

      const activeDeletedNotesSet = new Set(CampaignManager.getDeletedNoteIds());
      const activeDeletedEntitiesSet = new Set(CampaignManager.getDeletedEntityIds());
      const activeDeletedSessionsSet = new Set(CampaignManager.getDeletedSessionIds());
      const activeDeletedScrapbookSet = new Set(CampaignManager.getDeletedScrapbookIds());
      const activeDeletedNotificationsSet = new Set(CampaignManager.getDeletedNotificationIds());
      const activeDeletedWorldLoreSet = new Set(CampaignManager.getDeletedWorldLoreArticleIds());

      // === 1. RESTORE MEDIA FROM CHUNKS IF PRESENT ===
      let aggregatedSessionMedia: Record<string, { images?: string[]; eventImages?: Record<string, string[]>; audioLogs?: any[]; coverImage?: string }> = {};
      let aggregatedEntityMedia: Record<string, { images?: string[]; audioLogs?: any[] } | string[]> = {};
      let aggregatedNoteMedia: Record<string, string[]> = {};
      let aggregatedMapMedia: Record<string, string> = {};
      let aggregatedWorldLoreMedia: Record<string, string[]> = {};
      let aggregatedWorldLoreArticles: WorldLoreArticle[] = [];
      let aggregatedScrapbookItems: ScrapbookItem[] = [];
      let aggregatedAudioLogs: AudioLog[] = [];
      let aggregatedHistoricalSessions: any[] = [];

      if (remote._mediaChunkCount && remote._mediaChunkCount > 0) {
        try {
          const chunkPromises: Promise<any>[] = [];
          for (let i = 0; i < remote._mediaChunkCount; i++) {
            chunkPromises.push(getDoc(doc(db, 'dnd_campaigns', `${activeCode}__chunk_${i}`)));
          }
          const chunkSnaps = await Promise.all(chunkPromises);
          chunkSnaps.forEach((snap) => {
            if (snap.exists()) {
              const cData = snap.data();
              if (cData.sessionMedia) Object.assign(aggregatedSessionMedia, cData.sessionMedia);
              if (cData.entityMedia) Object.assign(aggregatedEntityMedia, cData.entityMedia);
              if (cData.noteMedia) Object.assign(aggregatedNoteMedia, cData.noteMedia);
              if (cData.mapMedia) Object.assign(aggregatedMapMedia, cData.mapMedia);
              if (cData.worldLoreMedia) Object.assign(aggregatedWorldLoreMedia, cData.worldLoreMedia);
              if (Array.isArray(cData.worldLoreArticles)) aggregatedWorldLoreArticles.push(...cData.worldLoreArticles);
              if (Array.isArray(cData.scrapbookItems)) aggregatedScrapbookItems.push(...cData.scrapbookItems);
              if (Array.isArray(cData.audioLogs)) aggregatedAudioLogs.push(...cData.audioLogs);
              if (Array.isArray(cData.historicalSessions)) aggregatedHistoricalSessions.push(...cData.historicalSessions);
              if (Array.isArray(cData.sessions)) aggregatedHistoricalSessions.push(...cData.sessions);
            }
          });
        } catch (chunkFetchErr) {
          console.warn('Could not fetch media chunks:', chunkFetchErr);
        }
      }

      // Legacy fallback: restore old companion chunk if present
      if (remote._hasSplitChunks && !remote._mediaChunkCount) {
        try {
          const cSnap = await getDoc(doc(db, 'dnd_campaigns', `${activeCode}__chunks`));
          if (cSnap.exists()) {
            const cData = cSnap.data();
            if (Array.isArray(cData?.scrapbookItems)) aggregatedScrapbookItems.push(...cData.scrapbookItems);
            if (Array.isArray(cData?.audioLogs)) aggregatedAudioLogs.push(...cData.audioLogs);
            if (Array.isArray(cData?.maps)) {
              cData.maps.forEach((m: any) => {
                if (m.imageUrl) aggregatedMapMedia[m.id] = m.imageUrl;
              });
            }
          }
        } catch (err) {
          console.warn('Failed to load legacy companion chunks:', err);
        }
      }

      // === 2. HYDRATE SESSIONS (MAIN + HISTORICAL CHUNKS) WITH IMAGES & AUDIO ===
      const rawCombinedSessions: any[] = [
        ...(Array.isArray(remote.sessions) ? remote.sessions : []),
        ...aggregatedHistoricalSessions,
      ];

      if (rawCombinedSessions.length > 0 || Array.isArray(remote.sessions)) {
        const localSessions = CampaignManager.getSessions();
        if (rawCombinedSessions.length === 0 && localSessions.length > 0) {
          console.warn('[CloudSync] Remote sessions are empty but local has data. Preserving local sessions and queuing upload.');
          setTimeout(() => CloudSyncService.triggerCloudSave(), 2000);
        } else {
          const localAccounts = CampaignManager.getAccounts();
          const avatarMap = new Map<string, string>();
          localAccounts.forEach((a) => {
            if (a.id && a.avatarUrl) avatarMap.set(a.id, a.avatarUrl);
          });

          // Deduplicate sessions by ID and sort ascending by session number
          const sessionMap = new Map<string, any>();
          rawCombinedSessions.forEach((s) => {
            if (s && s._id) sessionMap.set(s._id, s);
          });
          const uniqueSessions = Array.from(sessionMap.values()).sort(
            (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)
          );

          const currentAccount = CampaignManager.getCurrentAccount();
          const isDm = Boolean(currentAccount?.isDm || (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)));

          const hydratedSessions = uniqueSessions.map((s: any) => {
            const sMedia = aggregatedSessionMedia[s._id];
            const restoredImages = sMedia?.images && sMedia.images.length > 0 ? sMedia.images : s.images || [];
            let restoredEvents = (s.events || []).map((evt: any) => {
              const evtImgs = sMedia?.eventImages?.[evt.id];
              return {
                ...evt,
                images: evtImgs && evtImgs.length > 0 ? evtImgs : evt.images || [],
              };
            });

            // RBAC Filter: If user is NOT DM, filter out events with impact: 'secret'
            if (!isDm) {
              restoredEvents = restoredEvents.filter((evt: any) => evt.impact !== 'secret' && !evt.isSecret);
            }

            const restoredAudioLogs = sMedia?.audioLogs && sMedia.audioLogs.length > 0 ? sMedia.audioLogs : s.audioLogs || [];
            const restoredCoverImage = sMedia?.coverImage || s.coverImage || '';

            return {
              ...s,
              images: restoredImages,
              audioLogs: restoredAudioLogs,
              coverImage: restoredCoverImage,
              events: restoredEvents,
              attendees: (s.attendees || []).map((att: any) => ({
                ...att,
                avatarUrl: att.avatarUrl || avatarMap.get(att._id) || '',
              })),
            };
          });
          let finalSessions: Session[];
          if (isSupabaseConfigured() && localSessions.length > 0) {
            finalSessions = localSessions.map((ls) => {
              const sMedia = aggregatedSessionMedia[ls._id];
              const matchRemote = hydratedSessions.find((hs) => hs._id === ls._id);
              return {
                ...ls,
                coverImage: ls.coverImage || sMedia?.coverImage || matchRemote?.coverImage || '',
                images: (ls.images && ls.images.length > 0) ? ls.images : (sMedia?.images || matchRemote?.images || []),
              };
            });
            CampaignManager.saveSessionsLocalOnly(finalSessions);
          } else {
            finalSessions = this.mergeSessions(localSessions, hydratedSessions, activeDeletedSessionsSet);
            CampaignManager.saveSessions(finalSessions);
          }
        }
      }

      if (Array.isArray(remote.chapters)) {
        const localChapters = CampaignManager.getChapters();
        if (remote.chapters.length === 0 && localChapters.length > 0) {
          console.warn('[CloudSync] Remote chapters are empty but local has data. Preserving local chapters.');
        } else {
          const mergedChapters = this.mergeChapters(localChapters, remote.chapters);
          if (isSupabaseConfigured() && localChapters.length > 0) {
            CampaignManager.saveChaptersLocalOnly(mergedChapters);
          } else {
            CampaignManager.saveChapters(mergedChapters);
          }
        }
      }

      // === 3. HYDRATE ENTITIES WITH IMAGES ===
      if (Array.isArray(remote.entities)) {
        const localEntities = CampaignManager.getEntities();
        if (remote.entities.length === 0 && localEntities.length > 0) {
          console.warn('[CloudSync] Remote entities are empty but local has data. Preserving local entities and queuing upload.');
          setTimeout(() => CloudSyncService.triggerCloudSave(), 2000);
        } else {
          const hydratedEntities = remote.entities
            .filter((ent: any) => ent && ent._id && !activeDeletedEntitiesSet.has(ent._id))
            .map((ent: any) => {
              const eMedia: any = aggregatedEntityMedia[ent._id];
              const restoredImages = Array.isArray(eMedia?.images)
                ? eMedia.images
                : Array.isArray(eMedia)
                ? eMedia
                : ent.images || [];
              const restoredAudio = eMedia?.audioLogs && eMedia.audioLogs.length > 0 ? eMedia.audioLogs : ent.audioLogs || [];
              return {
                ...ent,
                images: restoredImages,
                audioLogs: restoredAudio,
              };
            });
          const mergedEntities = this.mergeEntities(localEntities, hydratedEntities, activeDeletedEntitiesSet);
          if (isSupabaseConfigured() && localEntities.length > 0) {
            CampaignManager.saveEntitiesLocalOnly(mergedEntities);
          } else {
            CampaignManager.saveEntities(mergedEntities);
          }
        }
      }

      // === 4. HYDRATE NOTES WITH IMAGES ===
      if (Array.isArray(remote.notes)) {
        const localNotes = CampaignManager.getNotes();
        if (remote.notes.length === 0 && localNotes.length > 0) {
          console.warn('[CloudSync] Remote notes are empty but local has data. Preserving local notes and queuing upload.');
          setTimeout(() => CloudSyncService.triggerCloudSave(), 2000);
        } else {
          let targetNotesToMerge = remote.notes.filter((n: any) => n && n._id && !activeDeletedNotesSet.has(n._id));
          // RBAC Note Filter: If user is not DM, exclude dmOnly notes and other users' private notes
          const currentAccount = CampaignManager.getCurrentAccount();
          const isDm = Boolean(currentAccount?.isDm || (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)));
          if (!isDm) {
            targetNotesToMerge = targetNotesToMerge.filter((n: any) => {
              if (n.dmOnly) return false;
              if (n.visibility === 'personal') {
                const myId = currentAccount?.id;
                const authorId = n.author?._id || n.author?.id;
                return Boolean(myId && authorId && myId === authorId);
              }
              return true;
            });
          }

          const hydratedNotes = targetNotesToMerge.map((n: any) => {
            const noteImgs = aggregatedNoteMedia[n._id];
            return {
              ...n,
              images: noteImgs && noteImgs.length > 0 ? noteImgs : n.images || [],
            };
          });
          const mergedNotes = this.mergeNotes(localNotes, hydratedNotes, activeDeletedNotesSet);
          if (isSupabaseConfigured() && localNotes.length > 0) {
            CampaignManager.saveNotesLocalOnly(mergedNotes);
          } else {
            CampaignManager.saveNotes(mergedNotes);
          }
        }
      }

      if (remote.calendar) CampaignManager.saveCalendar(remote.calendar);

      // === 5. HYDRATE MAPS ===
      if (Array.isArray(remote.maps)) {
        const localMaps = CampaignManager.getMaps();
        if (remote.maps.length === 0 && localMaps.length > 0) {
          console.warn('[CloudSync] Remote maps are empty but local has data. Preserving local maps.');
        } else {
          const hydratedMaps = remote.maps.map((m: any) => {
            const mapImg = aggregatedMapMedia[m.id];
            return {
              ...m,
              imageUrl: mapImg || m.imageUrl || '',
            };
          });
          const mergedMaps = this.mergeMaps(localMaps, hydratedMaps);
          if (isSupabaseConfigured() && localMaps.length > 0) {
            CampaignManager.saveMapsLocalOnly(mergedMaps);
          } else {
            CampaignManager.saveMaps(mergedMaps);
          }
        }
      }

      if (Array.isArray(remote.mapFolders)) {
        const localFolders = CampaignManager.getMapFolders();
        if (remote.mapFolders.length === 0 && localFolders.length > 0) {
          console.warn('[CloudSync] Remote mapFolders are empty but local has data. Preserving local mapFolders.');
        } else {
          CampaignManager.saveMapFolders(remote.mapFolders);
        }
      }

      if (aggregatedAudioLogs.length > 0) {
        if (isSupabaseConfigured()) {
          CampaignManager.saveAudioLogsLocalOnly(aggregatedAudioLogs);
        } else {
          CampaignManager.saveAudioLogs(aggregatedAudioLogs);
        }
      } else if (Array.isArray(remote.audioLogs) && remote.audioLogs.length > 0) {
        if (isSupabaseConfigured()) {
          CampaignManager.saveAudioLogsLocalOnly(remote.audioLogs);
        } else {
          CampaignManager.saveAudioLogs(remote.audioLogs);
        }
      }

      const incomingScrapbook = aggregatedScrapbookItems.length > 0
        ? aggregatedScrapbookItems
        : (Array.isArray(remote.scrapbookItems) ? remote.scrapbookItems : []);

      if (incomingScrapbook.length > 0) {
        const localScrapbook = CampaignManager.getScrapbookItems();
        const mergedScrapbook = this.mergeScrapbookItems(localScrapbook, incomingScrapbook, new Set(CampaignManager.getDeletedScrapbookIds()));
        if (isSupabaseConfigured() && localScrapbook.length > 0) {
          CampaignManager.saveScrapbookItemsLocalOnly(mergedScrapbook);
        } else {
          CampaignManager.saveScrapbookItems(mergedScrapbook);
        }
      }

      if (Array.isArray(remote.characterBios)) {
        const localBios = CampaignManager.getAllCharacterBios();
        if (remote.characterBios.length === 0 && localBios.length > 0) {
          console.warn('[CloudSync] Remote characterBios are empty but local has data. Preserving local characterBios.');
        } else {
          const currentAccount = CampaignManager.getCurrentAccount();
          const isDm = Boolean(currentAccount?.isDm || (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)));
          
          // Defense-in-depth: Non-DMs and non-owners must never receive unrevealed backstories/secrets
          const sanitizedBios = remote.characterBios.map((bio: any) => {
            if (!isDm && currentAccount?.id !== bio.playerId) {
              const isBackstoryShared = bio.privacySettings?.backstory === true;
              const isSecretsShared = bio.privacySettings?.secrets === true;
              return {
                ...bio,
                backstoryMarkdown: isBackstoryShared ? bio.backstoryMarkdown : '',
                secrets: isSecretsShared ? bio.secrets : '',
              };
            }
            return bio;
          });
          CampaignManager.saveAllCharacterBiosLocalOnly(sanitizedBios);
        }
      }

      if (Array.isArray(remote.familyRelations)) {
        const localRelations = CampaignManager.getAllFamilyRelations();
        if (remote.familyRelations.length === 0 && localRelations.length > 0) {
          console.warn('[CloudSync] Remote familyRelations are empty but local has data. Preserving local familyRelations.');
        } else {
          CampaignManager.saveAllFamilyRelations(remote.familyRelations);
        }
      }

      if (Array.isArray(remote.campaignNotifications)) {
        const localNotifs = CampaignManager.getCampaignNotifications();
        const notifMap = new Map<string, any>();
        [...remote.campaignNotifications, ...localNotifs].forEach((n) => {
          if (n && n.id && !activeDeletedNotificationsSet.has(n.id)) {
            notifMap.set(n.id, n);
          }
        });
        const mergedNotifs = Array.from(notifMap.values())
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 300);
        CampaignManager.saveCampaignNotifications(mergedNotifs);
      }

      // Merge remote accounts with local accounts if any legacy payload is received
      if (Array.isArray(remote.accounts) && remote.accounts.length > 0) {
        this.mergeRemoteAccounts(remote.accounts);
      }

      // Hydrate & merge World Lore articles across devices and party (combining chunks and main doc)
      const combinedRemoteWorldLore = [
        ...aggregatedWorldLoreArticles,
        ...(Array.isArray(remote.worldLoreArticles) ? remote.worldLoreArticles : [])
      ];

      if (combinedRemoteWorldLore.length > 0 || Array.isArray(remote.worldLoreArticles)) {
        const localArticles = CampaignManager.getWorldLoreArticles();
        if (combinedRemoteWorldLore.length === 0 && localArticles.length > 0) {
          console.warn('[CloudSync] Remote worldLoreArticles are empty but local has data. Preserving local worldLoreArticles and queuing upload.');
          setTimeout(() => CloudSyncService.triggerCloudSave(), 2000);
        } else {
          let targetArticles = combinedRemoteWorldLore.filter((a: any) => a && a._id && !activeDeletedWorldLoreSet.has(a._id));
          const hydratedArticles = targetArticles.map((a: any) => {
            const aMedia = aggregatedWorldLoreMedia[a._id];
            const restoredImages = Array.isArray(aMedia) && aMedia.length > 0 ? aMedia : a.images || [];
            return {
              ...a,
              images: restoredImages,
            };
          });
          const mergedArticles = this.mergeWorldLoreArticles(localArticles, hydratedArticles, activeDeletedWorldLoreSet);
          CampaignManager.saveWorldLoreArticlesLocalOnly(mergedArticles);
        }
      }

      // Register remote campaign metadata locally
      if (remote.campaignMeta && remote.campaignMeta.code) {
        const campaigns = CampaignManager.getCampaigns();
        const existingIdx = campaigns.findIndex((c) => c.code === remote.campaignMeta.code);
        if (existingIdx >= 0) {
          campaigns[existingIdx] = { ...campaigns[existingIdx], ...remote.campaignMeta };
        } else {
          campaigns.push(remote.campaignMeta as CampaignMeta);
        }
        CampaignManager.saveCampaignsLocalOnly(campaigns);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hasPendingUpload', 'false');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronicle_data_updated'));
      }
    } finally {
      // Release the lock after saving local caches, with NO circular re-upload!
      setTimeout(() => {
        isApplyingRemoteUpdate = false;
        if (pendingRemoteSnapshot) {
          const nextSnap = pendingRemoteSnapshot;
          pendingRemoteSnapshot = null;
          CloudSyncService.applyRemoteData(nextSnap.data, nextSnap.code);
        }
      }, 500);
    }
  }

  static stop() {
    if (this.unsubscribeSnapshot) {
      try {
        this.unsubscribeSnapshot();
      } catch (e) {}
      this.unsubscribeSnapshot = null;
    }
    if (this.unsubscribeDmSecretsSnapshot) {
      try {
        this.unsubscribeDmSecretsSnapshot();
      } catch (e) {}
      this.unsubscribeDmSecretsSnapshot = null;
    }
    this.isInitialized = false;
    this.isCampaignHydrated = false;
  }

  /**
   * Publishes or updates the read-only public presentation payload to Firestore
   * /public_presentations/{slug} for seamless guest/public sharing with campaign name slug.
   */
  static async publishPublicPresentation(targetCode?: string, preferredSlug?: string): Promise<{ success: boolean; url: string; shareToken: string; slug: string; error?: string }> {
    const meta = CampaignManager.getCampaignMeta();
    const campaignTitle = (meta?.name || 'Campagna').trim();
    const code = (targetCode || CampaignManager.getActiveCampaignCode() || meta?.code || slugifyCampaignTitle(campaignTitle) || 'CAMPAGNA').trim().toUpperCase();

    const shareToken = generateCampaignShareToken(code);
    const reversed = reverseCode(code);

    // Resolve unique slug based on campaign name (handles homonyms e.g. "palazzo", "palazzo-2")
    let slug = (preferredSlug || '').trim().toLowerCase();
    if (!slug) {
      try {
        slug = await resolveCampaignPresentationSlug(code, campaignTitle);
      } catch {
        slug = slugifyCampaignTitle(campaignTitle || code);
      }
    }
    if (!slug) slug = 'campagna';

    const compositeDocId = `${slug}__${reversed}`;
    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/presentation/${slug}/${reversed}`
      : `/presentation/${slug}/${reversed}`;

    try {
      const sessions = CampaignManager.getSessions();
      const chapters = CampaignManager.getChapters();

      const sanitizedChapters = await Promise.all(
        (chapters || []).map(async (c) => {
          const compCover = c.coverImageUrl ? await compressPresentationImage(c.coverImageUrl) : '';
          return {
            id: c.id,
            name: c.name,
            description: extractTextFromContent(c.description || ''),
            coverImageUrl: compCover,
            color: c.color || '',
            order: c.order || 0,
          };
        })
      );

      const sortedSessions = await Promise.all(
        [...sessions]
          .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
          .map(async (s) => {
            // Comprehensive gathering of all images associated with the session
            const rawImages: string[] = [];

            if (Array.isArray(s.images)) {
              rawImages.push(...s.images);
            }
            if (s.coverImage) {
              if (typeof s.coverImage === 'string') rawImages.push(s.coverImage);
              else if ((s.coverImage as any)?.asset?.url) rawImages.push((s.coverImage as any).asset.url);
              else if ((s.coverImage as any)?.url) rawImages.push((s.coverImage as any).url);
            }
            if (Array.isArray(s.events)) {
              s.events.forEach((evt: any) => {
                if (Array.isArray(evt?.images)) {
                  rawImages.push(...evt.images);
                }
              });
            }
            if (Array.isArray((s as any).gallery)) {
              rawImages.push(...(s as any).gallery);
            }
            if ((s as any).imageUrl && typeof (s as any).imageUrl === 'string') {
              rawImages.push((s as any).imageUrl);
            }

            const uniqueRaw = Array.from(new Set(rawImages.filter(Boolean)));
            const compressedImages = await Promise.all(
              uniqueRaw.map((img) => compressPresentationImage(img))
            );
            const combinedImages = Array.from(new Set(compressedImages.filter(Boolean)));

            const rawCover = typeof s.coverImage === 'string'
              ? s.coverImage
              : (s.coverImage as any)?.asset?.url || (s.coverImage as any)?.url || (combinedImages[0] || '');
            const resolvedCover = rawCover ? await compressPresentationImage(rawCover) : '';

            const events = await Promise.all(
              (s.events || []).map(async (evt) => {
                const evtImgs = await Promise.all(
                  (evt.images || []).filter(Boolean).map((img: string) => compressPresentationImage(img))
                );
                return {
                  id: evt.id,
                  title: evt.title,
                  description: extractTextFromContent(evt.description || ''),
                  loreDate: evt.loreDate || '',
                  location: evt.location || '',
                  images: evtImgs.filter(Boolean),
                };
              })
            );

            return {
              _id: s._id,
              number: s.number,
              title: s.title || `Sessione #${s.number}`,
              chapterName: s.chapterName || '',
              chapterId: s.chapterId || '',
              recap: extractTextFromContent(s.recap || (s as any).synopsis || (s as any).notes || ''),
              date: s.date || '',
              loreDate: s.loreDate || '',
              locations: (s as any).locations || ((s as any).location ? [(s as any).location] : []),
              images: combinedImages,
              coverImage: resolvedCover || (combinedImages[0] || ''),
              events,
            };
          })
      );

      // Extract media into sessionMediaMap and check total payload size
      const sessionMediaMap: Record<string, string[]> = {};
      const strippedSessions = sortedSessions.map((s) => {
        if (s.images && s.images.length > 0) {
          sessionMediaMap[s._id] = s.images;
        }
        return {
          ...s,
          images: [],
          coverImage: '',
        };
      });

      const testPayload = sanitizeFirestorePayload({
        slug,
        shareToken: slug,
        legacyToken: shareToken,
        campaignCode: code,
        campaignTitle,
        chapters: sanitizedChapters,
        sessions: sortedSessions,
        _updatedAt: new Date().toISOString(),
      });

      const totalJsonBytes = JSON.stringify(testPayload).length;
      const MAX_SINGLE_DOC_BYTES = 850000; // ~850 KB safety limit

      let finalMainPayload: any;
      const mediaChunkPayloads: Record<string, string[]>[] = [];

      if (totalJsonBytes < MAX_SINGLE_DOC_BYTES) {
        // Single doc write if payload fits comfortably in 850 KB
        finalMainPayload = testPayload;
      } else {
        // Partition session images into sub-chunks (< 300 KB each)
        const MAX_CHUNK_BYTES = 300000;
        let currentChunkMedia: Record<string, string[]> = {};
        let currentChunkSize = 0;

        Object.entries(sessionMediaMap).forEach(([sessId, imgs]) => {
          if (!imgs || imgs.length === 0) return;
          const itemSize = JSON.stringify({ sessId, imgs }).length;
          if (currentChunkSize + itemSize > MAX_CHUNK_BYTES && currentChunkSize > 0) {
            mediaChunkPayloads.push(currentChunkMedia);
            currentChunkMedia = {};
            currentChunkSize = 0;
          }
          currentChunkMedia[sessId] = imgs;
          currentChunkSize += itemSize;
        });
        if (Object.keys(currentChunkMedia).length > 0) {
          mediaChunkPayloads.push(currentChunkMedia);
        }

        finalMainPayload = sanitizeFirestorePayload({
          slug,
          shareToken: slug,
          legacyToken: shareToken,
          campaignCode: code,
          campaignTitle,
          chapters: sanitizedChapters,
          sessions: strippedSessions,
          _mediaChunkCount: mediaChunkPayloads.length,
          _updatedAt: new Date().toISOString(),
        });
      }

      return { success: true, url: shareUrl, shareToken: slug, slug };
    } catch (err: any) {
      console.warn('[CloudSync] Failed to publish public presentation:', err);
      return { success: false, url: shareUrl, shareToken: slug, slug, error: err?.message || 'Errore durante la pubblicazione.' };
    }
  }

  /**
   * Fetches Oracle AI chat history
   */
  static async fetchOracleChatFromCloud(campaignCode: string, userId: string): Promise<any[]> {
    if (!campaignCode || !userId) return [];
    try {
      const msgs = await SupabaseSyncService.fetchOracleChat(campaignCode, userId);
      return Array.isArray(msgs) ? msgs : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves Oracle AI chat history
   */
  static async saveOracleChatToCloud(campaignCode: string, userId: string, messages: any[]): Promise<void> {
    if (!campaignCode || !userId) return;
    try {
      await SupabaseSyncService.saveOracleChat(campaignCode, userId, messages);
    } catch (e) {
      console.warn('[CloudSync] Failed to save oracle chat to Supabase:', e);
    }
  }
}
