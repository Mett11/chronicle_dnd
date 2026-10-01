import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
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

        // Merge images union to ensure neither local nor remote uploaded images are wiped
        const mergedImages = (l.images && l.images.length > 0)
          ? (r.images && r.images.length > 0 ? Array.from(new Set([...r.images, ...l.images])) : l.images)
          : (r.images || []);

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
        chapterMap.set(existingCanonicalId, {
          ...chap,
          ...existing,
          description: existing.description || chap.description || "",
          coverImageUrl: existing.coverImageUrl || chap.coverImageUrl || "",
          color: existing.color || chap.color || "#D4AF37",
        });
      } else if (chap.id && chapterMap.has(chap.id)) {
        const existing = chapterMap.get(chap.id)!;
        chapterMap.set(chap.id, {
          ...chap,
          ...existing,
          description: existing.description || chap.description || "",
          coverImageUrl: existing.coverImageUrl || chap.coverImageUrl || "",
          color: existing.color || chap.color || "#D4AF37",
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

  /**
   * Directly syncs accounts array to Firestore global document
   */
  static async syncAccountsToCloud(accounts: UserAccount[]) {
    if (isSupabaseConfigured()) {
      const activeCode = CampaignManager.getActiveCampaignCode();
      if (activeCode && activeCode !== '__NONE__') {
        SupabaseSyncService.saveActivePlayers(activeCode, accounts).catch(() => {});
      }
      return;
    }
    if (checkIsQuotaExhausted()) return;
    try {
      const docRef = doc(db, 'dnd_global', 'accounts');
      const deletedIds = CampaignManager.getDeletedAccountIds();
      // Never store plaintext passwords in Firestore and filter out deleted accounts
      const sanitizedAccounts = accounts
        .filter((acc) => acc && acc.id && !deletedIds.includes(acc.id))
        .map((acc) => {
          const { password, ...rest } = acc;
          return {
            ...rest,
            password: '',
          };
        });
      const payload = sanitizeFirestorePayload({
        _updatedAt: new Date().toISOString(),
        accounts: sanitizedAccounts,
        deletedAccountIds: deletedIds,
      });
      await setDoc(docRef, payload);
      const curr = CampaignManager.getCurrentAccount();
      if (curr) {
        UserProfileSyncService.syncUserProfile(curr).catch(() => {});
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
      } else {
        console.warn('Sync accounts to cloud error:', e);
      }
    }
  }

  /**
   * Directly syncs global campaigns array to Firestore global document
   */
  static async syncCampaignsToCloud(campaigns: CampaignMeta[]) {
    if (isSupabaseConfigured() || checkIsQuotaExhausted()) return;
    try {
      const docRef = doc(db, 'dnd_global', 'campaigns');
      const payload = sanitizeFirestorePayload({
        _updatedAt: new Date().toISOString(),
        campaigns,
      });
      await setDoc(docRef, payload);
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
      } else {
        console.warn('Sync campaigns to cloud error:', e);
      }
    }
  }

  /**
   * Deletes a campaign document and syncs updated global campaigns and accounts in Firestore
   */
  static async deleteCampaignFromCloud(
    campaignCode: string,
    updatedCampaigns: CampaignMeta[],
    updatedAccounts: UserAccount[]
  ) {
    if (isSupabaseConfigured() || checkIsQuotaExhausted()) return;
    try {
      const campDocRef = doc(db, 'dnd_campaigns', campaignCode);
      await deleteDoc(campDocRef);
      await deleteDoc(doc(db, 'dnd_campaigns', `${campaignCode}__dm_secrets`)).catch(() => {});
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
      } else {
        console.warn(`Error deleting campaign doc ${campaignCode} from cloud:`, e);
      }
    }

    try {
      await this.syncCampaignsToCloud(updatedCampaigns);
      await this.syncAccountsToCloud(updatedAccounts);
    } catch (e) {
      console.warn('Error syncing updated global state after campaign deletion:', e);
    }
  }

  /**
   * Immediate synchronous/async fetch for user accounts from Firestore
   */
  static async fetchGlobalAccountsNow() {
    if (checkIsQuotaExhausted()) return;
    try {
      const docRef = doc(db, 'dnd_global', 'accounts');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.deletedAccountIds)) {
          data.deletedAccountIds.forEach((id: string) => CampaignManager.addDeletedAccountId(id));
        }
        if (Array.isArray(data?.accounts)) {
          this.mergeRemoteAccounts(data.accounts, data.deletedAccountIds || []);
          // Also sync activePlayers to Supabase campaign row if Supabase is active
          const activeCode = CampaignManager.getActiveCampaignCode();
          if (isSupabaseConfigured() && activeCode && activeCode !== '__NONE__') {
            SupabaseSyncService.saveCampaign(activeCode, {
              activePlayers: data.accounts,
              dmId: CampaignManager.getCurrentAccount()?.id,
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('fetchGlobalAccountsNow warning:', e);
    }
  }

  /**
   * Initializes real-time listener for global accounts & campaigns
   */
  static initGlobalSync() {
    if (isSupabaseConfigured() || this.isGlobalInitialized || checkIsQuotaExhausted()) return;
    this.isGlobalInitialized = true;

    try {
      // 1. Initial fetch & listener for global accounts
      const accDocRef = doc(db, 'dnd_global', 'accounts');
      getDoc(accDocRef).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.deletedAccountIds)) {
            data.deletedAccountIds.forEach((id: string) => CampaignManager.addDeletedAccountId(id));
          }
          if (Array.isArray(data?.accounts)) {
            this.mergeRemoteAccounts(data.accounts, data.deletedAccountIds || []);
          }
        }
      }).catch((e) => console.warn('Global accounts fetch warn:', e));

      this.unsubscribeGlobalAccounts = onSnapshot(accDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.deletedAccountIds)) {
            data.deletedAccountIds.forEach((id: string) => CampaignManager.addDeletedAccountId(id));
          }
          if (Array.isArray(data?.accounts)) {
            this.mergeRemoteAccounts(data.accounts, data.deletedAccountIds || []);
          }
        }
      }, (err) => {
        if (err?.code === 'resource-exhausted') markQuotaExhausted();
      });

      // 2. Initial fetch & listener for global campaigns
      const campDocRef = doc(db, 'dnd_global', 'campaigns');
      getDoc(campDocRef).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.campaigns)) {
            this.mergeRemoteCampaigns(data.campaigns);
          }
        }
      }).catch((e) => console.warn('Global campaigns fetch warn:', e));

      this.unsubscribeGlobalCampaigns = onSnapshot(campDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.campaigns)) {
            this.mergeRemoteCampaigns(data.campaigns);
          }
        }
      }, (err) => {
        if (err?.code === 'resource-exhausted') markQuotaExhausted();
      });
    } catch (e) {
      console.warn('initGlobalSync warning:', e);
    }
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

    remoteAccounts.forEach((acc) => {
      if (acc && acc.id && !deletedIds.has(acc.id)) {
        const userExpelled = expelledMap.get(acc.id);
        const joined = (acc.joinedCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );
        const dm = (acc.dmCampaigns || []).filter(
          (code) => !userExpelled?.has(code.toUpperCase())
        );
        mergedMap.set(acc.id, {
          ...acc,
          joinedCampaigns: joined,
          dmCampaigns: dm,
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

    CampaignManager.saveAccountsLocalOnly(finalAccounts);
    if (modified || finalAccounts.length < rawAccounts.length) {
      // Sync the deduplicated list back to cloud to fix duplicates in Firestore
      this.syncAccountsToCloud(finalAccounts);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronicle_accounts_updated'));
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
    CampaignManager.saveCampaignsLocalOnly(finalCampaigns);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronicle_campaigns_updated'));
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
            }
            if (Array.isArray(supaData.sessions) && supaData.sessions.length > 0) {
              CampaignManager.saveSessionsLocalOnly(supaData.sessions);
            }
            if (Array.isArray(supaData.chapters) && supaData.chapters.length > 0) {
              CampaignManager.saveChaptersLocalOnly(supaData.chapters);
            }
            if (Array.isArray(supaData.notes) && supaData.notes.length > 0) {
              CampaignManager.saveNotesLocalOnly(supaData.notes);
            }
            if (Array.isArray(supaData.entities) && supaData.entities.length > 0) {
              CampaignManager.saveEntitiesLocalOnly(supaData.entities);
            }
            if (Array.isArray(supaData.maps) && supaData.maps.length > 0) {
              CampaignManager.saveMapsLocalOnly(supaData.maps);
            }
            if (Array.isArray(supaData.mapFolders) && supaData.mapFolders.length > 0) {
              CampaignManager.saveMapFoldersLocalOnly(supaData.mapFolders);
            }
            if (Array.isArray(supaData.scrapbookItems) && supaData.scrapbookItems.length > 0) {
              CampaignManager.saveScrapbookItemsLocalOnly(supaData.scrapbookItems);
            }
            if (Array.isArray(supaData.audioLogs) && supaData.audioLogs.length > 0) {
              CampaignManager.saveAudioLogsLocalOnly(supaData.audioLogs);
            }
            if (Array.isArray(supaData.activePlayers) && supaData.activePlayers.length > 0) {
              this.mergeRemoteAccounts(supaData.activePlayers);
            }

            this.isCampaignHydrated = true;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('chronicle_campaign_updated'));
              window.dispatchEvent(new CustomEvent('chronicle_sessions_updated', { detail: { sessions: supaData.sessions } }));
              window.dispatchEvent(new CustomEvent('chronicle_chapters_updated'));
              window.dispatchEvent(new CustomEvent('chronicle_data_updated'));
            }
            if (onCloudUpdated) onCloudUpdated();
          }
        } catch (err) {
          console.warn('[Supabase] Initial fetch warning:', err);
        }

        // When Supabase is configured, PostgreSQL is the active database.
        // We completely bypass Firestore document reads, writes, and real-time onSnapshot listeners.
        this.isCampaignHydrated = true;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('hasPendingUpload', 'false');
        }
        return;
      }

      const docRef = doc(db, 'dnd_campaigns', activeCode);

      // 1. Initial Fetch from Firestore with strict hydration gate
      getDoc(docRef).then(async (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData) {
            await this.applyRemoteData(remoteData, activeCode);
          }

          // Also eagerly fetch DM secrets if user is DM before declaring hydration complete
          const currentAccount = CampaignManager.getCurrentAccount();
          const meta = CampaignManager.getCampaignMeta() || remoteData?.campaignMeta;
          const authUid = auth.currentUser?.uid;
          const isDm = Boolean(
            currentAccount?.isDm ||
            (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)) ||
            (currentAccount && meta?.dmId && (meta.dmId === currentAccount.id || meta.dmId === currentAccount.email)) ||
            (authUid && meta && ((meta as any).dmUid === authUid || meta.dmId === authUid || meta.dmId === `usr_${authUid}` || meta.dmId === `usr_g_${authUid}`))
          );
          if (isDm) {
            try {
              const dmDocRef = doc(db, 'dnd_campaigns', `${activeCode}__dm_secrets`);
              const dmSnap = await getDoc(dmDocRef);
              if (dmSnap.exists()) {
                this.applyDmSecrets(dmSnap.data(), activeCode);
              }
            } catch (dmErr) {
              if ((dmErr as any)?.code !== 'permission-denied') {
                console.warn('Initial DM secrets fetch warn:', dmErr);
              }
            }
          }

          this.isCampaignHydrated = true;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('hasPendingUpload', 'false');
          }
          if (onCloudUpdated) onCloudUpdated();
        } else {
          // Document does not exist yet in Firestore
          this.isCampaignHydrated = true;
          const currentSessions = CampaignManager.getSessions();
          const currentEntities = CampaignManager.getEntities();
          if (currentSessions.length > 0 || currentEntities.length > 0) {
            this.uploadLocalToCloud();
          }
          if (onCloudUpdated) onCloudUpdated();
        }
      }).catch((err) => {
        this.isCampaignHydrated = true;
        if (err?.code === 'resource-exhausted') {
          markQuotaExhausted();
          this.stop();
          console.warn('Firestore quota limit reached. Running safely in local storage mode.');
        } else {
          console.warn('Firestore initial fetch warning:', err);
        }
        if (onCloudUpdated) onCloudUpdated();
      });

      // 2. Real-time Listener for updates across devices/tabs
      this.unsubscribeSnapshot = onSnapshot(docRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data || !data._updatedAt) return;

        if (isApplyingRemoteUpdate) {
          pendingRemoteSnapshot = { data, code: activeCode };
          return;
        }

        await this.applyRemoteData(data, activeCode);
        this.isCampaignHydrated = true;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('hasPendingUpload', 'false');
        }
        if (onCloudUpdated) onCloudUpdated();
      }, (error) => {
        if (error?.code === 'resource-exhausted') {
          markQuotaExhausted();
          this.stop();
          console.warn('Firestore real-time sync paused: free tier daily quota reached. Local persistence active.');
        } else {
          console.warn('Firestore snapshot listener warning:', error);
        }
      });

      // 3. DM Secrets Listener (Phase 3.2): Isolated strictly to the Dungeon Master
      const attachDmSecrets = () => {
        const currentAccount = CampaignManager.getCurrentAccount();
        const meta = CampaignManager.getCampaignMeta();
        const authUid = auth.currentUser?.uid;
        const isDm = Boolean(
          currentAccount?.isDm ||
          (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)) ||
          (currentAccount && meta?.dmId && (meta.dmId === currentAccount.id || meta.dmId === currentAccount.email)) ||
          (authUid && meta && ((meta as any).dmUid === authUid || meta.dmId === authUid || meta.dmId === `usr_${authUid}` || meta.dmId === `usr_g_${authUid}`))
        );
        if (isDm && !this.unsubscribeDmSecretsSnapshot) {
          const dmDocRef = doc(db, 'dnd_campaigns', `${activeCode}__dm_secrets`);
          getDoc(dmDocRef).then((dmSnap) => {
            if (dmSnap.exists()) {
              this.applyDmSecrets(dmSnap.data(), activeCode);
            }
          }).catch((err) => {
            if (err?.code !== 'permission-denied') {
              console.warn('Initial DM secrets fetch warn:', err);
            }
          });

          this.unsubscribeDmSecretsSnapshot = onSnapshot(dmDocRef, (dmSnap) => {
            if (dmSnap.exists()) {
              this.applyDmSecrets(dmSnap.data(), activeCode);
            }
          }, (err) => {
            if (err?.code !== 'permission-denied') {
              console.warn('DM secrets snapshot listener warning:', err);
            }
          });
        }
      };

      attachDmSecrets();
      if (typeof window !== 'undefined') {
        const handleAccountChange = () => attachDmSecrets();
        window.addEventListener('chronicle_accounts_updated', handleAccountChange);
        window.addEventListener('chronicle_campaigns_updated', handleAccountChange);
        window.addEventListener('chronicle_campaign_changed', handleAccountChange);
      }
    } catch (e) {
      this.isCampaignHydrated = true;
      console.warn('Could not initialize Firebase Cloud Sync:', e);
    }
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
   * Completely clears and resets the remote Firestore document for a campaign
   */
  static async wipeCloudCampaign(campaignCode?: string) {
    if (checkIsQuotaExhausted()) return;
    try {
      const targetCode = campaignCode || CampaignManager.getActiveCampaignCode() || 'default_campaign';
      const docRef = doc(db, 'dnd_campaigns', targetCode);
      const cleanPayload = {
        _updatedAt: new Date().toISOString(),
        campaignMeta: { code: targetCode, name: 'Nuova Campagna', createdAt: new Date().toISOString() },
        sessions: [],
        chapters: [],
        entities: [],
        notes: [],
        calendar: null,
        maps: [],
        mapFolders: [],
        audioLogs: [],
        scrapbookItems: [],
        accounts: [],
        characterBios: [],
        familyRelations: [],
        worldLoreArticles: [],
        _mediaChunkCount: 0,
        _hasMediaChunks: false,
      };
      lastSyncedPayloadHash = JSON.stringify(cleanPayload);
      await setDoc(docRef, cleanPayload);

      // Clean up any chunk documents (0..10 and __chunks)
      const deletePromises: Promise<any>[] = [
        deleteDoc(doc(db, 'dnd_campaigns', `${targetCode}__chunks`)).catch(() => {}),
        deleteDoc(doc(db, 'dnd_campaigns', `${targetCode}__dm_secrets`)).catch(() => {}),
      ];
      for (let i = 0; i < 15; i++) {
        deletePromises.push(deleteDoc(doc(db, 'dnd_campaigns', `${targetCode}__chunk_${i}`)).catch(() => {}));
      }
      await Promise.all(deletePromises);
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
        this.stop();
      } else {
        console.warn('Failed to wipe Firestore campaign document:', e);
      }
    }
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

      // When Supabase is configured, PostgreSQL is the source of truth for all structured data.
      // We skip uploading the monolithic 1.2MB document to Firestore to prevent the 1MB Firestore size limit error.
      if (isSupabaseConfigured()) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('hasPendingUpload', 'false');
          localStorage.setItem('chronicle_last_cloud_sync_time', new Date().toISOString());
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chronicle_cloud_sync_status', { detail: { status: 'synced', time: new Date().toISOString() } }));
        }
        return { success: true };
      }

      const docRef = doc(db, 'dnd_campaigns', activeCode);
      const currentAccount = CampaignManager.getCurrentAccount();
      const meta = CampaignManager.getCampaignMeta();
      const currentAuthUid = auth.currentUser?.uid;
      const isDm = Boolean(
        currentAccount?.isDm ||
        (activeCode && currentAccount?.dmCampaigns?.includes(activeCode)) ||
        (currentAccount && meta?.dmId && (meta.dmId === currentAccount.id || meta.dmId === currentAccount.email)) ||
        (currentAuthUid && meta && ((meta as any).dmUid === currentAuthUid || meta.dmId === currentAuthUid || meta.dmId === `usr_${currentAuthUid}` || meta.dmId === `usr_g_${currentAuthUid}`))
      );

      const rawSessions = CampaignManager.getSessions().map((s) => ({
        ...s,
        attendees: (s.attendees || []).map((a) => {
          // Strip redundant base64 / avatars from session attendees to save 600KB+ per doc
          const { avatarUrl, avatar, ...rest } = a as any;
          return rest;
        }),
      }));

      const rawAccounts = CampaignManager.getAccounts().map((acc) => {
        if (!acc.campaignProfiles) return acc;
        const cleanedProfiles: Record<string, any> = {};
        for (const [code, prof] of Object.entries(acc.campaignProfiles)) {
          if (prof.avatarUrl && prof.avatarUrl === acc.avatarUrl) {
            const { avatarUrl, ...profRest } = prof;
            cleanedProfiles[code] = profRest;
          } else {
            cleanedProfiles[code] = prof;
          }
        }
        return {
          ...acc,
          campaignProfiles: cleanedProfiles,
        };
      });

      const deletedNoteIdsSet = new Set(CampaignManager.getDeletedNoteIds());
      const deletedEntityIdsSet = new Set(CampaignManager.getDeletedEntityIds());
      const deletedSessionIdsSet = new Set(CampaignManager.getDeletedSessionIds());
      const deletedScrapbookIdsSet = new Set(CampaignManager.getDeletedScrapbookIds());
      const deletedWorldLoreIdsSet = new Set(CampaignManager.getDeletedWorldLoreArticleIds());

      const rawEntities = CampaignManager.getEntities().filter((e) => !deletedEntityIdsSet.has(e._id));
      const rawNotes = CampaignManager.getNotes().filter((n) => !deletedNoteIdsSet.has(n._id));
      const rawMaps = CampaignManager.getMaps();
      const rawWorldLoreArticles = CampaignManager.getWorldLoreArticles().filter((a) => !deletedWorldLoreIdsSet.has(a._id));

      // CRITICAL ANTI-DATA-LOSS SHIELD:
      // Always verify remote Firestore document before uploading to prevent wiping data when client cache is empty or incomplete
      try {
        const remoteSnap = await getDoc(docRef);
        if (remoteSnap.exists()) {
          const remoteData = remoteSnap.data();

          // Sync any remote tombstones to local manager
          if (Array.isArray(remoteData?.deletedNoteIds)) {
            CampaignManager.addMultipleDeletedNoteIds(remoteData.deletedNoteIds);
            remoteData.deletedNoteIds.forEach((id: string) => deletedNoteIdsSet.add(id));
          }
          if (Array.isArray(remoteData?.deletedEntityIds)) {
            CampaignManager.addMultipleDeletedEntityIds(remoteData.deletedEntityIds);
            remoteData.deletedEntityIds.forEach((id: string) => deletedEntityIdsSet.add(id));
          }
          if (Array.isArray(remoteData?.deletedSessionIds)) {
            CampaignManager.addMultipleDeletedSessionIds(remoteData.deletedSessionIds);
            remoteData.deletedSessionIds.forEach((id: string) => deletedSessionIdsSet.add(id));
          }
          if (Array.isArray(remoteData?.deletedWorldLoreArticleIds)) {
            CampaignManager.addMultipleDeletedWorldLoreArticleIds(remoteData.deletedWorldLoreArticleIds);
            remoteData.deletedWorldLoreArticleIds.forEach((id: string) => deletedWorldLoreIdsSet.add(id));
          }

          const activeRemoteSessions = (Array.isArray(remoteData?.sessions) ? remoteData.sessions : []).filter((s: any) => !deletedSessionIdsSet.has(s?._id));
          const activeRemoteEntities = (Array.isArray(remoteData?.entities) ? remoteData.entities : []).filter((e: any) => !deletedEntityIdsSet.has(e?._id));
          const activeRemoteNotes = (Array.isArray(remoteData?.notes) ? remoteData.notes : []).filter((n: any) => !deletedNoteIdsSet.has(n?._id));
          const activeRemoteWorldLore = (Array.isArray(remoteData?.worldLoreArticles) ? remoteData.worldLoreArticles : []).filter((a: any) => !deletedWorldLoreIdsSet.has(a?._id));
          const remoteChapterCount = Array.isArray(remoteData?.chapters) ? remoteData.chapters.length : 0;
          const remoteMapCount = Array.isArray(remoteData?.maps) ? remoteData.maps.length : 0;
          const remoteBioCount = Array.isArray(remoteData?.characterBios) ? remoteData.characterBios.length : 0;
          const remoteRelationsCount = Array.isArray(remoteData?.familyRelations) ? remoteData.familyRelations.length : 0;

          const localSessionIds = new Set(rawSessions.map((s) => s._id));
          const missingSessions = activeRemoteSessions.some((s: any) => s && s._id && !localSessionIds.has(s._id));

          const localEntityIds = new Set(rawEntities.map((e) => e._id));
          const missingEntities = activeRemoteEntities.some((e: any) => e && e._id && !localEntityIds.has(e._id));

          const localNoteIds = new Set(rawNotes.map((n) => n._id));
          const missingNotes = activeRemoteNotes.some((n: any) => n && n._id && !localNoteIds.has(n._id));

          const localLoreIds = new Set(rawWorldLoreArticles.map((a) => a._id));
          const missingWorldLore = activeRemoteWorldLore.some((a: any) => a && a._id && !localLoreIds.has(a._id));

          const missingChapters = remoteChapterCount > 0 && CampaignManager.getChapters().length === 0;
          const missingMaps = remoteMapCount > 0 && rawMaps.length === 0;
          const missingCharacterBios = remoteBioCount > 0 && CampaignManager.getAllCharacterBios().length === 0;
          const missingFamilyRelations = remoteRelationsCount > 0 && CampaignManager.getAllFamilyRelations().length === 0;

          if (
            missingSessions ||
            missingEntities ||
            missingNotes ||
            missingChapters ||
            missingMaps ||
            missingWorldLore ||
            missingCharacterBios ||
            missingFamilyRelations
          ) {
            console.warn(`[CloudSync] ANTI-DATA-LOSS SHIELD: Remote has active non-deleted data that local cache is missing (remote sessions: ${activeRemoteSessions.length}, entities: ${activeRemoteEntities.length}, notes: ${activeRemoteNotes.length}, worldLore: ${activeRemoteWorldLore.length}, characterBios: ${remoteBioCount}). Auto-hydrating local state instead.`);
            await this.applyRemoteData(remoteData, activeCode);
            this.isCampaignHydrated = true;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('hasPendingUpload', 'false');
            }
            return { success: true };
          }

          // RBAC & MULTI-USER PRESERVATION SHIELD:
          // Preserve all remote active non-deleted notes, world lore articles, and session events
          // that are missing from local state (such as personal notes of other players, DM notes, or new party notes)
          if (Array.isArray(remoteData?.notes)) {
            remoteData.notes.forEach((remNote: any) => {
              if (remNote && remNote._id && !deletedNoteIdsSet.has(remNote._id) && !rawNotes.some((ln) => ln._id === remNote._id)) {
                rawNotes.push(remNote);
              }
            });
          }
          if (Array.isArray(remoteData?.worldLoreArticles)) {
            remoteData.worldLoreArticles.forEach((remArt: any) => {
              if (remArt && remArt._id && !deletedWorldLoreIdsSet.has(remArt._id) && !rawWorldLoreArticles.some((la) => la._id === remArt._id)) {
                rawWorldLoreArticles.push(remArt);
              }
            });
          }
          if (Array.isArray(remoteData?.sessions)) {
            remoteData.sessions.forEach((remS: any) => {
              const localS = rawSessions.find((ls) => ls._id === remS._id);
              if (localS && Array.isArray(remS.events) && !deletedSessionIdsSet.has(remS._id)) {
                remS.events.forEach((remEvt: any) => {
                  if (remEvt && remEvt.id && !localS.events?.some((le: any) => le.id === remEvt.id)) {
                    localS.events = [...(localS.events || []), remEvt];
                  }
                });
              }
            });
          }
        }
      } catch (checkErr) {
        console.warn('[CloudSync] Shield check warning:', checkErr);
      }

      const rawAudioLogs = CampaignManager.getAudioLogs();
      const rawScrapbookItems = CampaignManager.getScrapbookItems();

      // === 1. EXTRACT ALL HEAVY MEDIA AND ISOLATE DM SECRETS (Phase 3.2) ===
      const dmSecretEventsMap: Record<string, any[]> = {};
      const sessionMediaMap: Record<string, { images?: string[]; eventImages?: Record<string, string[]>; audioLogs?: any[]; coverImage?: string }> = {};
      const strippedSessions = rawSessions.map((s) => {
        const hasSessionImages = Array.isArray(s.images) && s.images.length > 0;
        const hasSessionAudio = Array.isArray(s.audioLogs) && s.audioLogs.length > 0;
        const hasSessionCover = Boolean(s.coverImage && (s.coverImage.startsWith('data:') || s.coverImage.length > 500));
        const eventImagesMap: Record<string, string[]> = {};
        let hasAnyEventImages = false;

        // Partition secret events (for DM only) vs public session events
        const secretEvents = (s.events || []).filter((e: any) => e.impact === 'secret' || e.isSecret);
        if (secretEvents.length > 0) {
          dmSecretEventsMap[s._id] = secretEvents;
        }
        const publicEvents = (s.events || []).filter((e: any) => e.impact !== 'secret' && !e.isSecret);

        const strippedEvents = publicEvents.map((e: any) => {
          if (Array.isArray(e.images) && e.images.length > 0) {
            eventImagesMap[e.id] = e.images;
            hasAnyEventImages = true;
            return { ...e, images: [] };
          }
          return e;
        });

        if (hasSessionImages || hasAnyEventImages || hasSessionAudio || hasSessionCover) {
          sessionMediaMap[s._id] = {
            images: hasSessionImages ? s.images : [],
            eventImages: hasAnyEventImages ? eventImagesMap : undefined,
            audioLogs: hasSessionAudio ? s.audioLogs : undefined,
            coverImage: hasSessionCover ? s.coverImage : undefined,
          };
        }

        return {
          ...s,
          images: [],
          audioLogs: [],
          coverImage: hasSessionCover ? '' : s.coverImage,
          events: strippedEvents,
        };
      });

      const entityMediaMap: Record<string, { images?: string[]; audioLogs?: any[] }> = {};
      const strippedEntities = rawEntities.map((ent) => {
        const hasImages = Array.isArray(ent.images) && ent.images.length > 0;
        const hasAudio = Array.isArray(ent.audioLogs) && ent.audioLogs.length > 0;

        if (hasImages || hasAudio) {
          entityMediaMap[ent._id] = {
            images: hasImages ? ent.images : undefined,
            audioLogs: hasAudio ? ent.audioLogs : undefined,
          };
          return {
            ...ent,
            images: [],
            audioLogs: [],
          };
        }
        return ent;
      });

      // Separate DM-only notes vs public notes for campaign party
      const dmNotes = rawNotes.filter((n) => n.dmOnly);
      const publicNotes = rawNotes.filter((n) => !n.dmOnly);

      const noteMediaMap: Record<string, string[]> = {};
      const strippedNotes = publicNotes.map((n) => {
        if (Array.isArray(n.images) && n.images.length > 0) {
          noteMediaMap[n._id] = n.images;
          return { ...n, images: [] };
        }
        return n;
      });

      const mapMediaMap: Record<string, string> = {};
      const strippedMaps = rawMaps.map((m) => {
        if (m.imageUrl && (m.imageUrl.startsWith('data:') || m.imageUrl.length > 1000)) {
          mapMediaMap[m.id] = m.imageUrl;
          return { ...m, imageUrl: '' };
        }
        return m;
      });

      // World Lore articles: store full content & bites in chunks and lightweight index in main doc
      const dmWorldLoreArticles = rawWorldLoreArticles.filter((a) => a.dmOnly);

      const worldLoreMediaMap: Record<string, string[]> = {};
      const strippedWorldLore = rawWorldLoreArticles.map((a) => {
        if (Array.isArray(a.images) && a.images.length > 0) {
          worldLoreMediaMap[a._id] = a.images;
        }
        return {
          _id: a._id,
          _createdAt: a._createdAt,
          _updatedAt: a._updatedAt,
          title: a.title,
          subtitle: a.subtitle,
          category: a.category,
          summary: a.summary,
          tags: a.tags,
          dmOnly: a.dmOnly,
          authorPlayerId: a.authorPlayerId,
          authorName: a.authorName,
          images: [],
          // Keep lightweight summary in main doc, full markdown & detailed bites in chunks
          bites: (a.bites || []).map((b: any) => ({
            id: b.id,
            title: b.title,
            level: b.level,
            category: b.category,
            customTag: b.customTag,
            knownBy: b.knownBy,
          })),
        };
      });

      // === 2. PARTITION MEDIA, FULL WORLD LORE, AND HISTORICAL SESSIONS INTO CHUNKS (< 400 KB EACH) ===
      interface MediaChunkItem {
        type: 'session' | 'entity' | 'note' | 'map' | 'scrapbook' | 'audio' | 'historical_session' | 'world_lore' | 'world_lore_article';
        id: string;
        data: any;
      }

      const mediaItems: MediaChunkItem[] = [];
      Object.entries(sessionMediaMap).forEach(([id, data]) => mediaItems.push({ type: 'session', id, data }));
      Object.entries(entityMediaMap).forEach(([id, data]) => mediaItems.push({ type: 'entity', id, data }));
      Object.entries(noteMediaMap).forEach(([id, data]) => mediaItems.push({ type: 'note', id, data }));
      Object.entries(mapMediaMap).forEach(([id, data]) => mediaItems.push({ type: 'map', id, data }));
      Object.entries(worldLoreMediaMap).forEach(([id, data]) => mediaItems.push({ type: 'world_lore', id, data }));
      rawScrapbookItems.forEach((item) => mediaItems.push({ type: 'scrapbook', id: item.id, data: item }));
      rawAudioLogs.forEach((log) => mediaItems.push({ type: 'audio', id: log.id, data: log }));
      rawWorldLoreArticles.forEach((art) => mediaItems.push({ type: 'world_lore_article', id: art._id, data: art }));

      // Keep ALL text/metadata sessions in main document (base64 images are already stripped into sessionMediaMap chunks)
      const sortedSessions = [...strippedSessions].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
      const mainSessions: any[] = sortedSessions;

      const MAX_CHUNK_BYTES = 420000; // ~400 KB safety limit per document (Firestore max is 1048576)
      const chunkPayloads: any[] = [];
      let currentChunk: {
        sessionMedia: Record<string, any>;
        entityMedia: Record<string, any>;
        noteMedia: Record<string, any>;
        mapMedia: Record<string, any>;
        worldLoreMedia: Record<string, any>;
        worldLoreArticles: any[];
        scrapbookItems: any[];
        audioLogs: any[];
        historicalSessions: any[];
      } = {
        sessionMedia: {},
        entityMedia: {},
        noteMedia: {},
        mapMedia: {},
        worldLoreMedia: {},
        worldLoreArticles: [],
        scrapbookItems: [],
        audioLogs: [],
        historicalSessions: [],
      };
      let currentChunkSize = 0;

      for (const item of mediaItems) {
        const itemSize = JSON.stringify(item.data).length;
        if (currentChunkSize + itemSize > MAX_CHUNK_BYTES && currentChunkSize > 0) {
          chunkPayloads.push(currentChunk);
          currentChunk = {
            sessionMedia: {},
            entityMedia: {},
            noteMedia: {},
            mapMedia: {},
            worldLoreMedia: {},
            worldLoreArticles: [],
            scrapbookItems: [],
            audioLogs: [],
            historicalSessions: [],
          };
          currentChunkSize = 0;
        }

        if (item.type === 'session') currentChunk.sessionMedia[item.id] = item.data;
        else if (item.type === 'entity') currentChunk.entityMedia[item.id] = item.data;
        else if (item.type === 'note') currentChunk.noteMedia[item.id] = item.data;
        else if (item.type === 'map') currentChunk.mapMedia[item.id] = item.data;
        else if (item.type === 'world_lore') currentChunk.worldLoreMedia[item.id] = item.data;
        else if (item.type === 'world_lore_article') currentChunk.worldLoreArticles.push(item.data);
        else if (item.type === 'scrapbook') currentChunk.scrapbookItems.push(item.data);
        else if (item.type === 'audio') currentChunk.audioLogs.push(item.data);
        else if (item.type === 'historical_session') currentChunk.historicalSessions.push(item.data);

        currentChunkSize += itemSize;
      }

      if (currentChunkSize > 0) {
        chunkPayloads.push(currentChunk);
      }

      // === 3. UPLOAD MEDIA CHUNKS TO FIRESTORE (ONLY IF MEDIA ACTUALLY CHANGED) ===
      const currentMediaHash = JSON.stringify(chunkPayloads);
      if (force || currentMediaHash !== lastSyncedMediaHash) {
        try {
          // Upload chunks sequentially or in small pairs to avoid overwhelming Firestore write stream
          for (let idx = 0; idx < chunkPayloads.length; idx++) {
            const chunk = chunkPayloads[idx];
            const chunkDocRef = doc(db, 'dnd_campaigns', `${activeCode}__chunk_${idx}`);
            const chunkPayload = sanitizeFirestorePayload({
              _updatedAt: new Date().toISOString(),
              campaignCode: activeCode,
              campaignMeta: {
                code: activeCode,
              },
              chunkIndex: idx,
              totalChunks: chunkPayloads.length,
              ...chunk,
            });
            await setDoc(chunkDocRef, chunkPayload);
          }

          lastSyncedMediaHash = currentMediaHash;

          // Clean up any extra stale chunk docs from previous larger uploads (e.g. up to 10 slots)
          const prevStoredChunkCount = parseInt(localStorage.getItem(`chronicle_${activeCode}_last_chunk_count`) || '0', 10);
          if (prevStoredChunkCount > chunkPayloads.length) {
            for (let i = chunkPayloads.length; i < prevStoredChunkCount; i++) {
              try {
                await deleteDoc(doc(db, 'dnd_campaigns', `${activeCode}__chunk_${i}`));
              } catch (delErr) {}
            }
          }
          localStorage.setItem(`chronicle_${activeCode}_last_chunk_count`, String(chunkPayloads.length));
        } catch (chunkErr) {
          console.warn('[CloudSync] Warning uploading media chunks:', chunkErr);
        }
      }

      // Extract unrevealed player backstories & secrets for DM only (Phase 3.2)
      const dmSecretBiosMap: Record<string, any> = {};
      const publicCharacterBios = CampaignManager.getAllCharacterBios().map((bio) => {
        const isBackstoryShared = bio.privacySettings?.backstory === true;
        const isSecretsShared = bio.privacySettings?.secrets === true;

        if (!isBackstoryShared || !isSecretsShared) {
          dmSecretBiosMap[bio.playerId] = {
            backstoryMarkdown: bio.backstoryMarkdown || '',
            secrets: bio.secrets || '',
          };
        }

        return {
          ...bio,
          backstoryMarkdown: isBackstoryShared ? bio.backstoryMarkdown : '',
          secrets: isSecretsShared ? bio.secrets : '',
        };
      });

      // === 3b. UPLOAD DM SECRETS (Phase 3.2: RBAC DM Isolation) ===
      if (isDm) {
        try {
          const dmSecretDocRef = doc(db, 'dnd_campaigns', `${activeCode}__dm_secrets`);
          const dmSecretPayload = sanitizeFirestorePayload({
            _updatedAt: new Date().toISOString(),
            campaignCode: activeCode,
            dmNotes,
            dmSecretEvents: dmSecretEventsMap,
            dmSecretBios: dmSecretBiosMap,
            dmWorldLoreArticles,
          });
          await setDoc(dmSecretDocRef, dmSecretPayload);
        } catch (dmErr) {
          console.warn('Failed to upload DM secrets to Firestore:', dmErr);
        }
      }

      // === 4. ASSEMBLE & UPLOAD LIGHTWEIGHT MAIN DOCUMENT (PUBLIC DATA ONLY) ===
      const rawPayload = {
        _updatedAt: new Date().toISOString(),
        campaignMeta: {
          ...(CampaignManager.getCampaignMeta() || { code: activeCode, name: `Campagna ${activeCode}`, createdAt: new Date().toISOString() }),
          code: activeCode,
          dmUid: auth.currentUser?.uid || undefined,
          memberUids: Array.from(new Set([
            ...((CampaignManager.getCampaignMeta() as any)?.memberUids || []),
            ...(auth.currentUser?.uid ? [auth.currentUser.uid] : [])
          ])),
        },
        sessions: mainSessions,
        chapters: CampaignManager.getChapters(),
        entities: strippedEntities,
        notes: strippedNotes,
        calendar: CampaignManager.getCalendar(),
        maps: strippedMaps,
        mapFolders: CampaignManager.getMapFolders(),
        audioLogs: [],
        scrapbookItems: [],
        accounts: [],
        characterBios: publicCharacterBios,
        familyRelations: CampaignManager.getAllFamilyRelations(),
        worldLoreArticles: strippedWorldLore,
        campaignNotifications: CampaignManager.getCampaignNotifications(),
        deletedNoteIds: CampaignManager.getDeletedNoteIds(),
        deletedEntityIds: CampaignManager.getDeletedEntityIds(),
        deletedSessionIds: CampaignManager.getDeletedSessionIds(),
        deletedScrapbookIds: CampaignManager.getDeletedScrapbookIds(),
        deletedNotificationIds: CampaignManager.getDeletedNotificationIds(),
        deletedWorldLoreArticleIds: CampaignManager.getDeletedWorldLoreArticleIds(),
        _mediaChunkCount: chunkPayloads.length,
        _hasMediaChunks: chunkPayloads.length > 0,
      };

      const sanitizedPayload = sanitizeFirestorePayload(rawPayload);

      // Check payload content hash without _updatedAt to prevent redundant network writes
      const { _updatedAt, ...contentToHash } = sanitizedPayload;
      const currentHash = JSON.stringify(contentToHash);
      if (!force && currentHash === lastSyncedPayloadHash) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('hasPendingUpload', 'false');
        }
        return { success: true };
      }

      lastSyncedPayloadHash = currentHash;
      await setDoc(docRef, sanitizedPayload);
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
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
        this.stop();
        console.warn('Firestore write paused: daily write units quota reached. Data saved safely in local storage.');
        return { success: false, error: 'Quota giornaliera Firestore raggiunta. I dati sono al sicuro nel browser locale.' };
      } else {
        console.warn('Failed to upload data to Firestore:', e);
        return { success: false, error: e?.message || 'Errore durante il caricamento su Firestore.' };
      }
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

      if (isSupabaseConfigured()) {
        return { success: true, url: shareUrl, shareToken: slug, slug };
      }

      // 1. Write main presentation document with timeout (compositeDocId and slug)
      await withTimeout(setDoc(doc(db, 'public_presentations', compositeDocId), finalMainPayload), 5000);
      if (slug && slug !== compositeDocId) {
        withTimeout(setDoc(doc(db, 'public_presentations', slug), finalMainPayload), 3000).catch(() => {});
      }

      // 2. Write chunk documents if present with timeout
      if (mediaChunkPayloads.length > 0) {
        const chunkPromises: Promise<any>[] = [];
        mediaChunkPayloads.forEach((chunkData, chunkIdx) => {
          chunkPromises.push(
            withTimeout(
              setDoc(doc(db, 'public_presentations', `${slug}__chunk_${chunkIdx}`), {
                slug,
                campaignCode: code,
                sessionMedia: chunkData,
                _updatedAt: new Date().toISOString(),
              }),
              4000
            )
          );
        });
        await Promise.all(chunkPromises);
      }

      // 3. Write legacy compatibility pointers with timeout
      if (shareToken && shareToken !== slug) {
        withTimeout(setDoc(doc(db, 'public_presentations', shareToken), finalMainPayload), 3000).catch(() => {});
      }
      if (code && code.toLowerCase() !== slug) {
        withTimeout(setDoc(doc(db, 'public_presentations', code), finalMainPayload), 3000).catch(() => {});
      }

      return { success: true, url: shareUrl, shareToken: slug, slug };
    } catch (err: any) {
      console.warn('[CloudSync] Failed to publish public presentation:', err);
      return { success: false, url: shareUrl, shareToken: slug, slug, error: err?.message || 'Errore durante la pubblicazione.' };
    }
  }

  /**
   * Fetches Oracle AI chat history for a specific campaign & user from Cloud Firestore
   */
  static async fetchOracleChatFromCloud(campaignCode: string, userId: string): Promise<any[]> {
    if (!campaignCode || !userId || campaignCode === 'GLOBAL' || isSupabaseConfigured() || checkIsQuotaExhausted()) return [];
    try {
      const docId = `${campaignCode.trim().toUpperCase()}__oracle_${userId.trim()}`;
      const docRef = doc(db, 'dnd_campaigns', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.messages)) {
          return data.messages;
        }
      }
    } catch (e) {
      console.warn('[CloudSync] fetchOracleChatFromCloud error:', e);
    }
    return [];
  }

  /**
   * Saves Oracle AI chat history for a specific campaign & user to Cloud Firestore
   */
  static async saveOracleChatToCloud(campaignCode: string, userId: string, messages: any[]): Promise<void> {
    if (!campaignCode || !userId || campaignCode === 'GLOBAL' || isSupabaseConfigured() || checkIsQuotaExhausted()) return;
    try {
      const docId = `${campaignCode.trim().toUpperCase()}__oracle_${userId.trim()}`;
      const docRef = doc(db, 'dnd_campaigns', docId);
      const sanitizedMsgs = sanitizeFirestorePayload(messages || []);
      const payload = {
        _updatedAt: new Date().toISOString(),
        campaignCode: campaignCode.trim().toUpperCase(),
        userId: userId.trim(),
        messages: sanitizedMsgs,
      };
      await setDoc(docRef, payload);
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        markQuotaExhausted();
      } else {
        console.warn('[CloudSync] saveOracleChatToCloud error:', e);
      }
    }
  }
}
