import { ApiKeyManager } from './apiKeyManager';
import { CampaignManager } from '../store/campaignStore';
import { SupabaseSyncService } from './supabaseSyncService';
import { isSupabaseConfigured } from './supabase';
import { pickBestImageUrl, ensureMediaUploaded } from './firebaseStorageService';
import { generateCampaignShareToken, resolveCampaignPresentationSlug, slugifyCampaignTitle, reverseCode } from './shareToken';
import { extractTextFromContent } from './sanitize';
import {
  sessionRowToModel,
  chapterRowToModel,
  noteRowToModel,
  entityRowToModel,
  characterBioRowToModel,
  mapRowToModel,
  scrapbookRowToModel,
  audioLogRowToModel,
  familyRelationRowToModel,
  worldLoreArticleRowToModel,
} from './supabaseAdapter';
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
  PartyMemberStats,
} from '../types';

// Debounce timer to prevent rapid bursts of writes to Firestore
let syncTimeout: any = null;
let isApplyingRemoteUpdate = false;
let isUploadInFlight = false;
let hasQueuedUpload = false;
let lastSyncedPayloadHash = '';
let lastSyncedMediaHash = '';

// Local write timestamps to suppress Realtime WebSocket echoes
const localWriteTimestamps = new Map<string, number>();

export function markLocalWrite(id: string) {
  if (id) {
    localWriteTimestamps.set(String(id), Date.now());
  }
}

export function isRecentlyWrittenLocally(id: string, windowMs = 3000): boolean {
  if (!id) return false;
  const ts = localWriteTimestamps.get(String(id));
  if (!ts) return false;
  return Date.now() - ts < windowMs;
}

export class CloudSyncService {
  private static isInitialized = false;
  private static isGlobalInitialized = false;
  private static isCampaignHydrated = false;

  static getIsCampaignHydrated(): boolean {
    return this.isCampaignHydrated;
  }

  static async initGlobalSync(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const accounts = await SupabaseSyncService.fetchAllUserAccounts();
        if (accounts && accounts.length > 0) {
          CampaignManager.saveAccountsLocalOnly(accounts);
        }
      } catch (err) {
        console.warn('[CloudSync] initGlobalSync error:', err);
      }
    }
  }

  static async fetchGlobalAccountsNow(): Promise<UserAccount[]> {
    if (isSupabaseConfigured()) {
      try {
        const accounts = await SupabaseSyncService.fetchAllUserAccounts();
        if (accounts && accounts.length > 0) {
          CampaignManager.saveAccountsLocalOnly(accounts);
          return accounts;
        }
      } catch (err) {
        console.warn('[CloudSync] fetchGlobalAccountsNow error:', err);
      }
    }
    return CampaignManager.getAccounts();
  }

  static async syncAccountsToCloud(accounts?: UserAccount[]): Promise<void> {
    const list = accounts || CampaignManager.getAccounts();
    if (isSupabaseConfigured() && list.length > 0) {
      try {
        await SupabaseSyncService.saveAllUserAccounts(list);
      } catch (err) {
        console.warn('[CloudSync] syncAccountsToCloud error:', err);
      }
    }
  }

  static async syncCampaignsToCloud(campaigns?: CampaignMeta[]): Promise<void> {
    const list = campaigns || CampaignManager.getCampaigns();
    if (isSupabaseConfigured() && list.length > 0) {
      try {
        for (const camp of list) {
          if (camp.code) {
            await SupabaseSyncService.saveCampaign(camp);
          }
        }
      } catch (err) {
        console.warn('[CloudSync] syncCampaignsToCloud error:', err);
      }
    }
  }

  static async deleteCampaignFromCloud(
    campaignCode: string,
    updatedCampaigns?: CampaignMeta[],
    updatedAccounts?: UserAccount[]
  ): Promise<void> {
    const code = (campaignCode || '').trim().toUpperCase();
    if (!code) return;
    if (isSupabaseConfigured()) {
      try {
        await SupabaseSyncService.deleteLegacyCampaign(code);
      } catch (err) {
        console.warn('[CloudSync] deleteCampaignFromCloud error:', err);
      }
    }
    if (updatedCampaigns) {
      await this.syncCampaignsToCloud(updatedCampaigns);
    }
    if (updatedAccounts) {
      await this.syncAccountsToCloud(updatedAccounts);
    }
  }

  
  /**
   * Initializes real-time two-way synchronization with Firebase Firestore
   */
  private static currentSyncRequestId = 0;
  private static currentActiveCode: string | null = null;
  private static inFlightInitPromise: Promise<void> | null = null;

  static isHydrated(): boolean {
    return this.isCampaignHydrated;
  }

  /**
   * Initializes real-time synchronization for the active campaign.
   */
  static async init(onCloudUpdated?: () => void) {
    const activeCode = CampaignManager.getActiveCampaignCode();
    const cleanActiveCode = (activeCode || '').trim().toUpperCase();

    if (!cleanActiveCode || cleanActiveCode === '__NONE__') {
      this.isCampaignHydrated = true;
      if (onCloudUpdated) onCloudUpdated();
      return;
    }

    // 1. If already hydrated for this active campaign, do not re-fetch all tables
    if (this.currentActiveCode === cleanActiveCode && this.isCampaignHydrated && this.isInitialized) {
      if (onCloudUpdated) onCloudUpdated();
      return;
    }

    // 2. If an init is ALREADY IN FLIGHT for this same campaign, await it instead of firing a second query
    if (this.currentActiveCode === cleanActiveCode && this.inFlightInitPromise) {
      await this.inFlightInitPromise;
      if (onCloudUpdated) onCloudUpdated();
      return;
    }

    this.currentActiveCode = cleanActiveCode;
    const syncId = ++this.currentSyncRequestId;
    this.isCampaignHydrated = false;

    if (this.isInitialized) {
      this.stop();
    }

    this.isInitialized = true;

    this.inFlightInitPromise = (async () => {
      try {
        const activeCode = CampaignManager.getActiveCampaignCode();
        if (!activeCode || activeCode === '__NONE__') {
          this.isCampaignHydrated = true;
          if (onCloudUpdated) onCloudUpdated();
          return;
        }

        if (isSupabaseConfigured()) {
          try {
            const supaData = await SupabaseSyncService.fetchCampaignData(activeCode);
            
            // Discard response if a newer sync request was initiated (e.g. campaign switch)
            if (this.currentSyncRequestId !== syncId) {
              return;
            }

            if (supaData) {
              
              if (supaData.title) {
                try {
                  const allCamps = CampaignManager.getCampaigns();
                  const idx = allCamps.findIndex((c) => c.code.toUpperCase() === activeCode.toUpperCase());
                  const remoteDmIsPlayer = supaData.dmIsPlayer !== undefined
                    ? Boolean(supaData.dmIsPlayer)
                    : undefined;

                  if (idx !== -1) {
                    allCamps[idx] = {
                      ...allCamps[idx],
                      name: supaData.title || allCamps[idx].name,
                      subtitle: supaData.subtitle !== undefined ? supaData.subtitle : allCamps[idx].subtitle,
                      description: supaData.description !== undefined ? supaData.description : allCamps[idx].description,
                      dmId: supaData.dmId || allCamps[idx].dmId,
                      dmIsPlayer: remoteDmIsPlayer !== undefined ? remoteDmIsPlayer : allCamps[idx].dmIsPlayer,
                      expelledAccountIds: supaData.expelledAccountIds || allCamps[idx].expelledAccountIds,
                      aiConfig: (supaData.aiConfig && typeof supaData.aiConfig === 'object' && Object.keys(supaData.aiConfig).length > 0)
                        ? supaData.aiConfig
                        : allCamps[idx].aiConfig,
                    };
                    CampaignManager.saveCampaignsLocalOnly(allCamps);
                  } else {
                    allCamps.push({
                      code: activeCode,
                      name: supaData.title,
                      subtitle: supaData.subtitle || '',
                      description: supaData.description || '',
                      dmId: supaData.dmId || '',
                      dmIsPlayer: remoteDmIsPlayer,
                      expelledAccountIds: supaData.expelledAccountIds || [],
                      aiConfig: supaData.aiConfig || {},
                      createdAt: new Date().toISOString(),
                    });
                    CampaignManager.saveCampaignsLocalOnly(allCamps);
                  }

                  if (remoteDmIsPlayer !== undefined && typeof window !== 'undefined') {
                    const cleanCode = activeCode.trim().toUpperCase();
                    localStorage.setItem(`chronicle_${cleanCode}_dm_is_player`, String(remoteDmIsPlayer));
                    localStorage.setItem('chronicle_reading_include_dm', String(remoteDmIsPlayer));
                    localStorage.setItem('chronicle_include_dm_as_player', String(remoteDmIsPlayer));
                  }
                } catch (e) {
                  console.warn('[Supabase] meta hydration warn:', e);
                }
              }

              // Strictly apply Supabase data as single source of truth without auto-reuploading stale local cache
              if (Array.isArray(supaData.sessions)) {
                CampaignManager.saveSessionsLocalOnly(supaData.sessions);
              }
              if (Array.isArray(supaData.chapters)) {
                CampaignManager.saveChaptersLocalOnly(supaData.chapters);
              }
              if (Array.isArray(supaData.notes)) {
                CampaignManager.saveNotesLocalOnly(supaData.notes);
              }
              if (Array.isArray(supaData.entities)) {
                CampaignManager.saveEntitiesLocalOnly(supaData.entities);
              }
              if (Array.isArray(supaData.maps)) {
                CampaignManager.saveMapsLocalOnly(supaData.maps);
              }
              if (Array.isArray(supaData.mapFolders)) {
                CampaignManager.saveMapFoldersLocalOnly(supaData.mapFolders);
              }
              if (Array.isArray(supaData.scrapbookItems)) {
                CampaignManager.saveScrapbookItemsLocalOnly(supaData.scrapbookItems);
              }
              if (Array.isArray(supaData.audioLogs)) {
                CampaignManager.saveAudioLogsLocalOnly(supaData.audioLogs);
              }
              if (Array.isArray(supaData.characterBios)) {
                CampaignManager.saveAllCharacterBiosLocalOnly(supaData.characterBios);
              }
              if (Array.isArray(supaData.familyRelations)) {
                CampaignManager.saveAllFamilyRelationsLocalOnly(supaData.familyRelations);
              }
              if (Array.isArray(supaData.worldLoreArticles)) {
                CampaignManager.saveAllWorldLoreArticlesLocalOnly(supaData.worldLoreArticles);
              }
              if (Array.isArray(supaData.campaignMembers)) {
                CampaignManager.saveCampaignMembersLocalOnly(activeCode, supaData.campaignMembers);
              }
              if (Array.isArray(supaData.activePlayers)) {
                CampaignManager.updateCampaignMetaLocalOnly(activeCode, {
                  activePlayers: supaData.activePlayers,
                });
              }

              CampaignManager.updateCampaignMetaLocalOnly(activeCode, {
                name: supaData.title || undefined,
                subtitle: supaData.subtitle || undefined,
                description: supaData.description || undefined,
                dmId: supaData.dmId || undefined,
                dmIsPlayer: supaData.dmIsPlayer,
                titleFont: supaData.titleFont || (supaData as any).aiConfig?.titleFont || undefined,
                titleEffect: supaData.titleEffect || (supaData as any).aiConfig?.titleEffect || undefined,
                titleUppercase: (supaData as any).titleUppercase ?? (supaData as any).aiConfig?.titleUppercase,
                titleTracking: (supaData as any).titleTracking ?? (supaData as any).aiConfig?.titleTracking,
              });

              if (supaData.calendarSystem && typeof supaData.calendarSystem === 'object' && Object.keys(supaData.calendarSystem).length > 0) {
                try {
                  CampaignManager.saveCalendarLocalOnly(supaData.calendarSystem);
                } catch (e) {
                  console.warn('[CloudSync] Calendar hydration warn:', e);
                }
              }

              if (supaData.aiConfig && typeof supaData.aiConfig === 'object') {
                try {
                  CampaignManager.updateCampaignAiConfigFromRemote(activeCode, supaData.aiConfig);
                } catch (e) {
                  console.warn('[CloudSync] AI config hydration warn:', e);
                }
              }

              if (supaData.aiConfig?.aiKeys) {
                try {
                  ApiKeyManager.hydrateCampaignKeysFromRemote(activeCode, supaData.aiConfig?.aiKeys);
                } catch (e) {
                  console.warn('[CloudSync] AI keys hydration warn:', e);
                }
              }

              if (supaData.partyMemberStats && typeof supaData.partyMemberStats === 'object') {
                try {
                  CampaignManager.hydratePartyStatsFromRemote(activeCode, supaData.partyMemberStats);
                } catch (e) {
                  console.warn('[CloudSync] Party stats hydration warn:', e);
                }
              }

              this.isCampaignHydrated = true;
              this.setupSupabaseRealtime(activeCode);

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
      } finally {
        this.inFlightInitPromise = null;
      }
    })();

    return this.inFlightInitPromise;
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

    const cleanActiveCode = activeCode.trim().toUpperCase();

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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanSess = sessionRowToModel(row);
            if (cleanSess._id && isRecentlyWrittenLocally(cleanSess._id)) return;
            const idx = sessions.findIndex((s) => s._id === cleanSess._id);
            const updated = idx !== -1 ? sessions.map((s) => s._id === cleanSess._id ? cleanSess : s) : [cleanSess, ...sessions];
            CampaignManager.saveSessionsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Session update error:', e);
        }
      },
      onChaptersChange: (payload) => {
        try {
          const chaps = CampaignManager.getChapters();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = chaps.filter((c) => c.id !== delId);
              CampaignManager.saveChaptersLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanChap = chapterRowToModel(row);
            if (cleanChap.id && isRecentlyWrittenLocally(cleanChap.id)) return;
            const idx = chaps.findIndex((c) => c.id === cleanChap.id);
            const updated = idx !== -1 ? chaps.map((c) => c.id === cleanChap.id ? cleanChap : c) : [...chaps, cleanChap];
            CampaignManager.saveChaptersLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Chapter update error:', e);
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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanNote = noteRowToModel(row);
            if (cleanNote._id && isRecentlyWrittenLocally(cleanNote._id)) return;
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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanEnt = entityRowToModel(row);
            if (cleanEnt._id && isRecentlyWrittenLocally(cleanEnt._id)) return;
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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanBio = characterBioRowToModel(row);
            if (cleanBio.playerId && isRecentlyWrittenLocally(cleanBio.playerId)) return;
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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanRel = familyRelationRowToModel(row);
            if (cleanRel.id && isRecentlyWrittenLocally(cleanRel.id)) return;
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
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanArt = worldLoreArticleRowToModel(row);
            if (cleanArt._id && isRecentlyWrittenLocally(cleanArt._id)) return;
            const idx = arts.findIndex((a) => a._id === cleanArt._id);
            const updated = idx !== -1 ? arts.map((a) => a._id === cleanArt._id ? cleanArt : a) : [cleanArt, ...arts];
            CampaignManager.saveAllWorldLoreArticlesLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Lore update error:', e);
        }
      },
      onMapsChange: (payload) => {
        try {
          const maps = CampaignManager.getMaps();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = maps.filter((m) => m.id !== delId);
              CampaignManager.saveMapsLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanMap = mapRowToModel(row);
            if (cleanMap.id && isRecentlyWrittenLocally(cleanMap.id)) return;
            const idx = maps.findIndex((m) => m.id === cleanMap.id);
            const updated = idx !== -1 ? maps.map((m) => m.id === cleanMap.id ? cleanMap : m) : [...maps, cleanMap];
            CampaignManager.saveMapsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Map update error:', e);
        }
      },
      onScrapbookChange: (payload) => {
        try {
          const items = CampaignManager.getScrapbookItems();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = items.filter((s) => s.id !== delId);
              CampaignManager.saveScrapbookItemsLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanItem = scrapbookRowToModel(row);
            if (cleanItem.id && isRecentlyWrittenLocally(cleanItem.id)) return;
            const idx = items.findIndex((s) => s.id === cleanItem.id);
            const updated = idx !== -1 ? items.map((s) => s.id === cleanItem.id ? cleanItem : s) : [cleanItem, ...items];
            CampaignManager.saveScrapbookItemsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] Scrapbook update error:', e);
        }
      },
      onAudioLogsChange: (payload) => {
        try {
          const logs = CampaignManager.getAudioLogs();
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const updated = logs.filter((l) => l.id !== delId);
              CampaignManager.saveAudioLogsLocalOnly(updated);
            }
          } else if (payload.new) {
            const row = payload.new;
            if (row.campaign_code && row.campaign_code.trim().toUpperCase() !== cleanActiveCode) return;
            const cleanLog = audioLogRowToModel(row);
            if (cleanLog.id && isRecentlyWrittenLocally(cleanLog.id)) return;
            const idx = logs.findIndex((l) => l.id === cleanLog.id);
            const updated = idx !== -1 ? logs.map((l) => l.id === cleanLog.id ? cleanLog : l) : [cleanLog, ...logs];
            CampaignManager.saveAudioLogsLocalOnly(updated);
          }
        } catch (e) {
          console.warn('[Realtime] AudioLog update error:', e);
        }
      },
      onCampaignChange: (payload) => {
        try {
          const row = payload.new;
          if (row) {
            if (row.calendar_system && typeof row.calendar_system === 'object') {
              CampaignManager.saveCalendarLocalOnly(row.calendar_system);
            }
            if (row.ai_config && typeof row.ai_config === 'object') {
              CampaignManager.updateCampaignAiConfigFromRemote(activeCode, row.ai_config);
            }
            const dmIsPlayer = row.dm_is_player !== undefined ? Boolean(row.dm_is_player) : undefined;
            if (row.title || row.dm_id || dmIsPlayer !== undefined || row.ai_config) {
              CampaignManager.updateCampaignMetaLocalOnly(activeCode, {
                name: row.title || undefined,
                dmId: row.dm_id || undefined,
                dmIsPlayer: dmIsPlayer,
                aiConfig: row.ai_config && typeof row.ai_config === 'object' ? row.ai_config : undefined,
              });
              if (dmIsPlayer !== undefined && typeof window !== 'undefined') {
                const cleanCode = activeCode.trim().toUpperCase();
                localStorage.setItem(`chronicle_${cleanCode}_dm_is_player`, String(dmIsPlayer));
                localStorage.setItem('chronicle_reading_include_dm', String(dmIsPlayer));
                localStorage.setItem('chronicle_include_dm_as_player', String(dmIsPlayer));
                window.dispatchEvent(new CustomEvent('chronicle_campaign_updated', { detail: { code: cleanCode, dmIsPlayer } }));
              }
            }
          }
        } catch (e) {
          console.warn('[Realtime] Campaign update error:', e);
        }
      },
      onPartyStatsChange: (payload) => {
        try {
          const row = payload.new;
          if (row && row.player_id) {
            const memberStats: PartyMemberStats = {
              playerId: row.player_id,
              titleOrNickname: row.title_or_nickname || undefined,
              wweIntroTitle: row.wwe_intro_title || undefined,
              roleInParty: row.role_in_party || undefined,
              catchphrase: row.catchphrase || undefined,
              nat20Count: Number(row.nat20_count ?? 0),
              nat1Count: Number(row.nat1_count ?? 0),
              enemiesDowned: Number(row.enemies_downed ?? 0),
              knockoutsCount: Number(row.knockouts_count ?? 0),
              drinksAtTavern: Number(row.drinks_at_tavern ?? 0),
              plansRuined: Number(row.plans_ruined ?? 0),
              mvpCount: Number(row.mvp_count ?? 0),
              customBadges: Array.isArray(row.custom_badges) ? row.custom_badges : [],
            };
            CampaignManager.hydratePartyStatsFromRemote(activeCode, { [row.player_id]: memberStats });
          }
        } catch (e) {
          console.warn('[Realtime] Party stats update error:', e);
        }
      },
    });
  }

  /**
   * Pushes the current complete state to Cloud with debouncing & hash check
   */
  static triggerCloudSave() {
    if (isApplyingRemoteUpdate || !this.isCampaignHydrated) return;

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      // In Supabase relational mode, individual mutations (sessions, notes, entities, chapters)
      // are persisted granularly and immediately to their respective tables.
      // We update the local sync status without triggering a costly 11-table bulk dump.
      const nowIso = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hasPendingUpload', 'false');
        localStorage.setItem('chronicle_last_cloud_sync_time', nowIso);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('chronicle_cloud_sync_status', { detail: { status: 'synced', time: nowIso } })
        );
      }
    }, 600);
  }

  static getLastSyncTime(): string | null {
    try {
      return localStorage.getItem('chronicle_last_cloud_sync_time');
    } catch {
      return null;
    }
  }

  /**
   * Forces an immediate synchronization of the active campaign data to Supabase Cloud.
   */
  static async syncNow(force: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      const activeCode = CampaignManager.getActiveCampaignCode();
      if (!activeCode || activeCode === '__NONE__') {
        return { success: false, error: 'Nessuna campagna attiva valida.' };
      }

      if (isSupabaseConfigured()) {
        const localData = {
          sessions: CampaignManager.getSessions(),
          chapters: CampaignManager.getChapters(),
          entities: CampaignManager.getEntities(),
          notes: CampaignManager.getNotes(),
          maps: CampaignManager.getMaps(),
          scrapbookItems: CampaignManager.getScrapbookItems(),
          audioLogs: CampaignManager.getAudioLogs(),
          characterBios: CampaignManager.getAllCharacterBios(),
          familyRelations: CampaignManager.getAllFamilyRelations(),
          worldLoreArticles: CampaignManager.getWorldLoreArticles(),
        };

        const res = await SupabaseSyncService.bulkUpsertCampaignData(activeCode, localData);
        if (res.errors && res.errors.length > 0) {
          return { success: false, error: `Sincronizzazione fallita: ${res.errors.join('; ')}` };
        }

        const nowIso = new Date().toISOString();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('chronicle_last_cloud_sync_time', nowIso);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('chronicle_cloud_sync_status', { detail: { status: 'synced', time: nowIso } })
          );
        }
        return { success: true };
      }

      return { success: true };
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
    return this.syncNow(force);
  }



  static stop() {
    this.isInitialized = false;
    this.isCampaignHydrated = false;
    this.currentActiveCode = null;
  }

  /**
   * Publishes or updates the read-only public presentation payload to Firestore
   * /public_presentations/{slug} for seamless guest/public sharing with campaign name slug.
   */
  static async publishPublicPresentation(targetCode?: string, preferredSlug?: string): Promise<{ success: boolean; url: string; shareToken: string; slug: string; error?: string }> {
    const meta = CampaignManager.getCampaignMeta();
    const campaignTitle = (meta?.name || 'Campagna').trim();
    const code = (targetCode || CampaignManager.getActiveCampaignCode() || meta?.code || slugifyCampaignTitle(campaignTitle) || 'CAMPAGNA').trim().toUpperCase();

    const reversed = reverseCode(code);

    let slug = (preferredSlug || '').trim().toLowerCase();
    if (!slug) {
      try {
        slug = await resolveCampaignPresentationSlug(code, campaignTitle);
      } catch {
        slug = slugifyCampaignTitle(campaignTitle || code);
      }
    }
    if (!slug) slug = 'campagna';

    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/presentation/${slug}/${reversed}`
      : `/presentation/${slug}/${reversed}`;

    return { success: true, url: shareUrl, shareToken: slug, slug };
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
