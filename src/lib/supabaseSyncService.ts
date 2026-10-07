import { supabase, isSupabaseConfigured, markSupabaseOffline } from './supabase';
import { slugifyCampaignTitle } from './shareToken';
import { ensureMediaUploaded } from './firebaseStorageService';
import {
  chapterRowToModel,
  chapterModelToRow,
  sessionRowToModel,
  sessionModelToRow,
  entityRowToModel,
  entityModelToRow,
  noteRowToModel,
  noteModelToRow,
  mapRowToModel,
  mapModelToRow,
  scrapbookRowToModel,
  scrapbookModelToRow,
  audioLogRowToModel,
  audioLogModelToRow,
  characterBioRowToModel,
  characterBioModelToRow,
  worldLoreArticleRowToModel,
  worldLoreArticleModelToRow,
  resolveStorageUrl,
} from './supabaseAdapter';
import {
  Session,
  CampaignChapter,
  Note,
  Entity,
  WorldMap,
  ScrapbookItem,
  AudioLog,
} from '../types';

/**
 * Graceful error handler that avoids polluting console.error when Supabase is offline or unreachable.
 * Automatically activates circuit-breaker backoff.
 */
function handleSupabaseError(context: string, err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('typeerror: failed to fetch') ||
    msg.includes('abort')
  ) {
    markSupabaseOffline(60000);
    console.warn(`[Supabase Offline] ${context}: Servizio remoto temporaneamente non raggiungibile, operazione salvata in locale.`);
    return false;
  }
  console.warn(`[Supabase] ${context}:`, err.message || err);
  return false;
}

/**
 * Traverses any nested structure and replaces large base64 strings/images (>100KB)
 * to prevent PostgreSQL write timeout (code 57014) in Supabase.
 */
function sanitizeHeavyPayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (obj.includes('[Immagine rimossa') || obj.includes('rimossa per prevenire')) {
      return '' as any;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeHeavyPayload(item)) as any;
  }

  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = sanitizeHeavyPayload((obj as any)[key]);
      }
    }
    return res;
  }

  return obj;
}

const knownMissingColumns = new Set<string>();

/**
 * Resilient upsert helper that automatically recovers from schema cache mismatches (PGRST204, PGRST205),
 * missing legacy tables (42P01), or missing parent foreign key campaign rows (23503).
 * When PostgREST reports a missing column, it learns the schema, strips the unrecognised property,
 * and retries automatically.
 */
export async function safeUpsert(
  tableName: string,
  payload: Record<string, any> | Record<string, any>[],
  options?: { onConflict?: string; fallbackTable?: string }
): Promise<{ data: any; error: any }> {
  let currentTable = tableName;

  // Pre-strip known missing columns learned during earlier queries
  const stripKnown = (item: any) => {
    if (!item || typeof item !== 'object') return item;
    const clean = { ...item };
    for (const key of Object.keys(clean)) {
      if (knownMissingColumns.has(`${currentTable}.${key}`)) {
        delete clean[key];
      }
    }
    return clean;
  };

  let currentPayload: any = Array.isArray(payload)
    ? payload.map((item) => stripKnown(item))
    : stripKnown(payload);

  const maxRetries = 8;
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;
    let res = await supabase
      .from(currentTable)
      .upsert(currentPayload, options?.onConflict ? { onConflict: options.onConflict } : undefined);

    if (!res.error) {
      return res;
    }

    // 1. Table not found error in PostgREST (PGRST205 or 42P01) -> Fallback table
    const isTableNotFound =
      res.error.code === 'PGRST205' ||
      res.error.code === '42P01' ||
      res.error.message?.includes('Could not find the table') ||
      res.error.message?.includes('does not exist');

    if (isTableNotFound && options?.fallbackTable && currentTable !== options.fallbackTable) {
      currentTable = options.fallbackTable;
      currentPayload = Array.isArray(payload)
        ? payload.map((item) => stripKnown(item))
        : stripKnown(payload);
      continue;
    }

    // 2. Foreign key violation on campaigns table (23503) -> Auto-ensure parent campaign record exists
    if (
      res.error.code === '23503' &&
      (res.error.message?.includes('campaign_code') ||
        res.error.details?.includes('campaigns') ||
        res.error.message?.includes('violates foreign key constraint'))
    ) {
      const sample = Array.isArray(currentPayload) ? currentPayload[0] : currentPayload;
      const cCode = sample?.campaign_code || sample?.code;
      if (cCode) {
        try {
          const cleanCode = String(cCode).trim().toUpperCase();
          await supabase.from('campaigns').upsert(
            {
              code: cleanCode,
              title: `Campagna ${cleanCode}`,
              system: 'D&D 5e',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'code' }
          );
          continue; // retry upserting child records
        } catch {}
      }
    }

    // 3. Missing column in schema cache or SQL error (PGRST204 or 42703)
    if (
      res.error.code === 'PGRST204' ||
      res.error.code === '42703' ||
      res.error.message?.includes('schema cache') ||
      res.error.message?.includes('Could not find the') ||
      res.error.message?.includes('does not exist')
    ) {
      const match =
        res.error.message.match(/Could not find the '([^']+)' column/i) ||
        res.error.message.match(/column "([^"]+)" of relation/i) ||
        res.error.message.match(/column "([^"]+)" does not exist/i);

      if (match && match[1]) {
        const missingCol = match[1];
        knownMissingColumns.add(`${currentTable}.${missingCol}`);
        if (Array.isArray(currentPayload)) {
          currentPayload = currentPayload.map((item: any) => {
            const next = { ...item };
            delete next[missingCol];
            return next;
          });
        } else {
          delete currentPayload[missingCol];
        }
        continue;
      }
    }

    // 4. ON CONFLICT specification mismatch (42P10) -> Retry with alternative conflict target or standard upsert
    if (
      res.error.code === '42P10' ||
      res.error.message?.includes('there is no unique or exclusion constraint') ||
      res.error.message?.includes('ON CONFLICT')
    ) {
      if (options?.onConflict && options.onConflict.includes(',')) {
        // Fallback from composite key (campaign_code,player_id) to single column (player_id or id)
        const parts = options.onConflict.split(',');
        const fallbackCol = parts.find((p) => p.trim() === 'player_id' || p.trim() === 'id') || parts[0].trim();
        options.onConflict = fallbackCol;
        continue;
      } else if (options?.onConflict) {
        // Retry without explicit onConflict
        delete options.onConflict;
        continue;
      }
    }

    return res;
  }

  return { data: null, error: new Error(`safeUpsert max retries reached for ${currentTable}`) };
}

export class SupabaseSyncService {
  /**
   * Checks if a campaign code is already registered in Supabase
   */
  static async hasCampaign(campaignCode: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const rawCode = campaignCode.trim();
      const { data, error } = await supabase
        .from('campaigns')
        .select('code')
        .or(`code.eq.${cleanCode},code.eq.${rawCode}`)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Supabase] Warning checking campaign existence:', error.message);
      }
      return Boolean(data && data.code);
    } catch {
      return false;
    }
  }

  private static campaignDataCache = new Map<string, { data: Record<string, any>; timestamp: number }>();
  private static inFlightCampaignFetches = new Map<string, Promise<Record<string, any> | null>>();
  private static userAccountsCache: { data: any[]; timestamp: number } | null = null;
  private static inFlightUserAccountsFetch: Promise<any[]> | null = null;
  private static allCampaignsCache: { data: any[]; timestamp: number } | null = null;
  private static inFlightAllCampaignsFetch: Promise<any[]> | null = null;
  private static userAccountCache = new Map<string, { data: any; timestamp: number }>();
  private static inFlightUserAccount = new Map<string, Promise<any>>();
  private static userCampaignsCache = new Map<string, { data: any; timestamp: number }>();
  private static inFlightUserCampaigns = new Map<string, Promise<any>>();
  private static sessionsOnlyCache = new Map<string, { data: any; timestamp: number }>();
  private static inFlightSessionsOnly = new Map<string, Promise<any>>();

  static invalidateCampaignDataCache(campaignCode?: string) {
    if (campaignCode) {
      const clean = campaignCode.trim().toUpperCase();
      for (const key of this.campaignDataCache.keys()) {
        if (key.includes(clean)) this.campaignDataCache.delete(key);
      }
      for (const key of this.sessionsOnlyCache.keys()) {
        if (key.includes(clean)) this.sessionsOnlyCache.delete(key);
      }
    } else {
      this.campaignDataCache.clear();
      this.sessionsOnlyCache.clear();
    }
  }

  /**
   * Egress Optimization: In-memory cache surgical updater.
   * Modifies existing cache without invalidating it, preventing cascade re-fetches of all 6 tables.
   */
  static updateCachedItem(campaignCode: string, collection: 'sessions' | 'entities' | 'notes' | 'chapters', item: any, isDelete = false) {
    if (!campaignCode || !item) return;
    const clean = campaignCode.trim().toUpperCase();
    for (const [key, cacheEntry] of this.campaignDataCache.entries()) {
      if (key.includes(clean) && cacheEntry?.data) {
        const list = cacheEntry.data[collection];
        if (Array.isArray(list)) {
          const id = item._id || item.id;
          const idx = list.findIndex((x: any) => (x._id || x.id) === id);
          if (isDelete) {
            if (idx !== -1) list.splice(idx, 1);
          } else {
            if (idx !== -1) {
              list[idx] = { ...list[idx], ...item };
            } else {
              list.push(item);
            }
          }
        }
      }
    }
    // Also update sessionsOnlyCache if modifying a session
    if (collection === 'sessions') {
      for (const [key, cacheEntry] of this.sessionsOnlyCache.entries()) {
        if (key.includes(clean) && cacheEntry?.data && Array.isArray(cacheEntry.data)) {
          const id = item._id || item.id;
          const idx = cacheEntry.data.findIndex((x: any) => (x._id || x.id) === id);
          if (isDelete) {
            if (idx !== -1) cacheEntry.data.splice(idx, 1);
          } else {
            if (idx !== -1) {
              cacheEntry.data[idx] = { ...cacheEntry.data[idx], ...item };
            } else {
              cacheEntry.data.push(item);
            }
          }
        }
      }
    }
  }

  /**
   * Egress Optimization: In-memory bulk entities cache updater.
   */
  static updateCachedEntities(campaignCode: string, newEntities: Entity[]) {
    if (!campaignCode || !Array.isArray(newEntities) || newEntities.length === 0) return;
    const clean = campaignCode.trim().toUpperCase();
    for (const [key, cacheEntry] of this.campaignDataCache.entries()) {
      if (key.includes(clean) && cacheEntry?.data && Array.isArray(cacheEntry.data.entities)) {
        newEntities.forEach((ent) => {
          const idx = cacheEntry.data.entities.findIndex((x: any) => (x._id || x.id) === ent._id);
          if (idx !== -1) {
            cacheEntry.data.entities[idx] = { ...cacheEntry.data.entities[idx], ...ent };
          } else {
            cacheEntry.data.entities.push(ent);
          }
        });
      }
    }
  }

  /**
   * Lightweight metadata check for a campaign (used for invitation codes and portal validation)
   * Avoids querying 11 related tables when only basic metadata is needed.
   */
  static async fetchCampaignMeta(campaignCode: string): Promise<any | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const rawCode = campaignCode.trim();
      const { data, error } = await supabase
        .from('campaigns')
        .select('code, title, created_at, dm_id, active_players')
        .or(`code.eq.${cleanCode},code.eq.${rawCode}`)
        .maybeSingle();

      if (error || !data) return null;
      const activePlayers = Array.isArray(data.active_players) ? data.active_players : [];
      const dmPlayer = activePlayers.find((p: any) => p && (p.isDm || (data.dm_id && p.id === data.dm_id)));

      return {
        code: data.code,
        name: data.title || data.code,
        createdAt: data.created_at || new Date().toISOString(),
        dmId: data.dm_id || dmPlayer?.id || undefined,
        dmEmail: dmPlayer?.email || undefined,
        dmName: dmPlayer?.characterName || undefined,
        dmIsPlayer: dmPlayer ? Boolean(dmPlayer.isDm) : undefined,
        expelledAccountIds: [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches all campaign relational data from Supabase in parallel
   */
  static async fetchCampaignData(campaignCode: string, campaignTitleOrSlug?: string, force = false): Promise<Record<string, any> | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;

    const cacheKey = campaignCode.trim().toUpperCase();
    if (!force) {
      const cached = this.campaignDataCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 600000) { // 10 minutes TTL
        return cached.data;
      }
    }

    // In-flight deduplication: return existing promise if identical fetch is in progress
    const inFlight = this.inFlightCampaignFetches.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = (async () => {
      try {
        const candidates = new Set<string>();
        [campaignCode, campaignTitleOrSlug || ''].forEach((c) => {
          if (!c) return;
          const str = c.trim();
          candidates.add(str);
          candidates.add(str.toUpperCase());
          const alphanumeric = str.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (alphanumeric) {
            candidates.add(alphanumeric);
            if (alphanumeric.startsWith('CHR') && alphanumeric.length === 11) {
              candidates.add(`${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 7)}-${alphanumeric.slice(7)}`);
            } else if (alphanumeric.length === 10 && alphanumeric.startsWith('CHR')) {
              candidates.add(`${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}-${alphanumeric.slice(6)}`);
            }
          }
        });

        const candidateList = Array.from(candidates);
        const orFilterCodes = candidateList.map((cd) => `code.eq.${cd}`).join(',');

        // Step 1: Query campaign info
        let campaignRow: any = null;
        const initialCampRes = await supabase
          .from('campaigns')
          .select('code, title, subtitle, description, system, dm_id, calendar_system, ai_config, active_players, created_at, updated_at')
          .or(orFilterCodes)
          .maybeSingle();

        if (initialCampRes.data) {
          campaignRow = initialCampRes.data;
          if (campaignRow.code && !candidateList.includes(campaignRow.code)) {
            candidateList.push(campaignRow.code);
          }
        } else {
          // Fallback: search campaigns table by slug / alphanumeric code
          try {
            const allCampsRes = await supabase
              .from('campaigns')
              .select('code, title, subtitle, description, system, dm_id, calendar_system, ai_config, active_players, created_at, updated_at')
              .limit(50);
            if (allCampsRes.data && allCampsRes.data.length > 0) {
              const targetSlug = slugifyCampaignTitle(campaignTitleOrSlug || campaignCode);
              const targetAlpha = campaignCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

              const found = allCampsRes.data.find((c: any) => {
                const cAlpha = (c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (cAlpha && targetAlpha && (cAlpha === targetAlpha || cAlpha.includes(targetAlpha) || targetAlpha.includes(cAlpha))) return true;
                const cSlug = slugifyCampaignTitle(c.title || c.name || c.code || '');
                if (targetSlug && (cSlug === targetSlug || cSlug.includes(targetSlug) || targetSlug.includes(cSlug))) return true;
                return false;
              });

              if (found) {
                campaignRow = found;
                if (found.code && !candidateList.includes(found.code)) {
                  candidateList.push(found.code);
                }
              }
            }
          } catch {}
        }

        const activeOrCampFilter = candidateList.map((cd) => `campaign_code.eq.${cd}`).join(',');

        const [
          chaptersRes,
          sessionsRes,
          entitiesRes,
          notesRes,
          characterBiosRes,
          familyRelationsRes,
        ] = await Promise.all([
          supabase
            .from('chapters')
            .select('id, campaign_code, number, title, synopsis, status, order_index, cover_image_url, color, created_at, updated_at')
            .or(activeOrCampFilter),
          supabase
            .from('sessions')
            .select('id, campaign_code, number, title, date_str, chapter_id, calendar_date, plot_events, recap, summary, images, cover_image_url, audio_url, session_type, quotes, audio_logs, excluded_player_ids, attendees, tags, entities_extracted, entities_extracted_at, memory_synced, memory_synced_at, created_at, updated_at')
            .or(activeOrCampFilter)
            .order('number', { ascending: true }),
          supabase
            .from('entities')
            .select('id, campaign_code, name, type, description, image_url, status, attributes, created_at, updated_at')
            .or(activeOrCampFilter),
          supabase
            .from('notes')
            .select('id, campaign_code, title, content, category, session_id, lore_date, visibility, is_dm_only, is_pinned, canon_state, author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, images, created_at, updated_at')
            .or(activeOrCampFilter),
          supabase
            .from('character_bios')
            .select('campaign_code, player_id, name, avatar_url, color, class_level, alignment, background, personality, ideals, bonds, flaws, timeline_memories, evolving_beliefs, inter_party_relations, character_race, character_title, deity_or_patron, hometown, birth_date_formatted, birth_start_day, birth_month, birth_year, secrets, appearance_description, current_status, known_lore_bites, privacy_settings, extra_data, created_at, updated_at')
            .or(activeOrCampFilter)
            .then(res => res, () => ({ data: [] })),
          supabase
            .from('family_relations')
            .select('id, campaign_code, source_entity_id, target_entity_id, relationship_type, description, is_secret, name, avatar_url, custom_relationship_label, title_or_role, generation_category, genealogy_role, side_of_family, status, second_parent_id, other_parent_name, linked_player_id, tags, order_index, updated_at')
            .or(activeOrCampFilter)
            .then(res => res, () => ({ data: [] })),
        ]);

        const campaignRes = { data: campaignRow, error: null };

      if (campaignRes.error && campaignRes.error.code !== 'PGRST116') {
        console.warn('[Supabase] Warning reading campaigns table:', campaignRes.error.message);
      }
      if (sessionsRes.error) {
        console.warn('[Supabase] Warning reading sessions table:', sessionsRes.error.message);
      }

      const hasAnyData = Boolean(
        campaignRes.data ||
        (chaptersRes.data && chaptersRes.data.length > 0) ||
        (sessionsRes.data && sessionsRes.data.length > 0) ||
        (entitiesRes.data && entitiesRes.data.length > 0) ||
        (notesRes.data && notesRes.data.length > 0) ||
        (characterBiosRes.data && characterBiosRes.data.length > 0) ||
        (familyRelationsRes.data && familyRelationsRes.data.length > 0)
      );

      if (!hasAnyData) {
        return null;
      }

      const campRow = campaignRes.data || {};
      const dossier = campRow.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      const sessionsMeta = dossier.sessionsMeta || {};
      const mapFolders = Array.isArray(dossier.mapFolders) ? dossier.mapFolders : [];

      let chapters: CampaignChapter[] = (chaptersRes.data || []).map((row) =>
        chapterRowToModel(row, chaptersMeta)
      );

      // Fallback only if chapters table query failed and dossier has legacy chapters
      if (chapters.length === 0 && chaptersRes.error && Array.isArray(dossier.chapters) && dossier.chapters.length > 0) {
        chapters = dossier.chapters.map((dc: any) => ({
          id: dc.id,
          name: dc.name || dc.title || 'Nuovo Capitolo',
          description: dc.description || dc.synopsis || '',
          color: dc.color || '#6366f1',
          coverImageUrl: dc.coverImageUrl || chaptersMeta[dc.id]?.coverImageUrl || '',
          order: Number(dc.order ?? dc.order_index ?? 1),
          createdAt: dc.createdAt || dc.created_at || new Date().toISOString(),
        })).sort((a: CampaignChapter, b: CampaignChapter) => (a.order || 0) - (b.order || 0));
      }

      const sessions: Session[] = (sessionsRes.data || []).map((row) =>
        sessionRowToModel(row, sessionsMeta)
      );

      // Auto-reconcile sessions with chapters
      const chapById = new Map(chapters.map((c) => [c.id, c]));
      const chapByName = new Map(chapters.map((c) => [(c.name || '').trim().toLowerCase(), c]));
      sessions.forEach((s) => {
        if (s.chapterId && chapById.has(s.chapterId)) {
          s.chapterName = chapById.get(s.chapterId)!.name;
        } else if (s.chapterName) {
          const sNorm = (s.chapterName || '').trim().toLowerCase();
          const match = chapByName.get(sNorm) || Array.from(chapByName.values()).find((c) => {
            const cNorm = (c.name || '').trim().toLowerCase();
            return cNorm.includes(sNorm) || sNorm.includes(cNorm);
          });
          if (match) {
            s.chapterId = match.id;
            s.chapterName = match.name;
          }
        } else if (chapters.length === 1 && chapters[0]) {
          s.chapterId = chapters[0].id;
          s.chapterName = chapters[0].name;
        }
      });

      const entities: Entity[] = (entitiesRes.data || []).map(entityRowToModel);

      const notesMeta = dossier.notesMeta || {};
      const notes: Note[] = (notesRes.data || []).map((row) =>
        noteRowToModel(row, notesMeta)
      );

      // Heavy media/articles are lazy loaded on demand
      const maps: WorldMap[] | undefined = undefined;
      const scrapbookItems: ScrapbookItem[] | undefined = undefined;
      const audioLogs: AudioLog[] | undefined = undefined;
      const worldLoreArticles: any[] | undefined = undefined;

      // --- HYDRATION & AUTO-MIGRATION LAYER FOR NEW TABLES ---
      const characterBiosRows = characterBiosRes?.data || [];
      const familyRelationsRows = familyRelationsRes?.data || [];

      // Resilient character bios merge: combine dossier fallback with character_bios table
      const biosMap = new Map<string, any>();
      if (Array.isArray(dossier.characterBios)) {
        dossier.characterBios.forEach((b: any) => {
          if (b && (b.playerId || b.id)) {
            biosMap.set(b.playerId || b.id, b);
          }
        });
      }
      if (characterBiosRows && characterBiosRows.length > 0) {
        characterBiosRows.forEach((row: any) => {
          const model = characterBioRowToModel(row);
          if (model && model.playerId) {
            const existing = biosMap.get(model.playerId) || {};
            biosMap.set(model.playerId, { ...existing, ...model });
          }
        });
      }
      const characterBios: any[] = Array.from(biosMap.values());

      let familyRelations: any[] = [];
      if (familyRelationsRows && familyRelationsRows.length > 0) {
        familyRelations = familyRelationsRows.map((row: any) => ({
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
          tags: Array.isArray(row.tags) ? row.tags : [],
          order: row.order_index || 0,
          updatedAt: row.updated_at || new Date().toISOString(),
        }));
      } else if ((familyRelationsRes as any)?.error && Array.isArray(dossier.familyRelations) && dossier.familyRelations.length > 0) {
        familyRelations = dossier.familyRelations;
      }

      const result = {
        campaignCode: campRow.code || campaignCode,
        title: campRow.title || campaignCode,
        subtitle: campRow.subtitle || '',
        description: campRow.description || '',
        system: campRow.system || 'D&D 5e',
        dmId: campRow.dm_id || '',
        dmIsPlayer: dossier.dmIsPlayer !== undefined ? Boolean(dossier.dmIsPlayer) : undefined,
        calendarSystem: campRow.calendar_system || {},
        aiConfig: campRow.ai_config || {},
        expelledAccountIds: Array.isArray(dossier.expelledAccountIds) ? dossier.expelledAccountIds : [],
        activePlayers: (() => {
          const raw = Array.isArray(campRow.active_players) && campRow.active_players.length > 0
            ? campRow.active_players
            : (Array.isArray(dossier.activePlayers) ? dossier.activePlayers : []);
          const expelled = new Set(
            (Array.isArray(dossier.expelledAccountIds) ? dossier.expelledAccountIds : []).map((id: string) => String(id).toLowerCase())
          );
          return raw.filter((p: any) => {
            if (!p || !p.id) return false;
            const pId = String(p.id).toLowerCase();
            const pAltId = p._id ? String(p._id).toLowerCase() : '';
            const pEmail = p.email ? String(p.email).toLowerCase() : '';
            return !expelled.has(pId) && (!pAltId || !expelled.has(pAltId)) && (!pEmail || !expelled.has(pEmail));
          });
        })(),
        dossier,
        characterBios,
        familyRelations,
        worldLoreArticles,
        mapFolders,
        chapters,
        sessions,
        entities,
        notes,
        maps,
        scrapbookItems,
        audioLogs,
      };

      this.campaignDataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      handleSupabaseError('Failed to fetch campaign data', err);
      return null;
    } finally {
      this.inFlightCampaignFetches.delete(cacheKey);
    }
  })();

  this.inFlightCampaignFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

  /**
   * Granular On-Demand Fetch: Calendar & current storyline dates
   */
  static async fetchCalendarOnly(campaignCode: string): Promise<{ calendar?: any; sessions?: Session[] } | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    const cleanCode = campaignCode.trim().toUpperCase();

    // Check if we already have the campaign hydrated with calendar and sessions
    const fullCached = this.campaignDataCache.get(cleanCode);
    if (fullCached && Date.now() - fullCached.timestamp < 180000 && fullCached.data.calendarSystem) {
      return { calendar: fullCached.data.calendarSystem, sessions: fullCached.data.sessions || [] };
    }

    try {
      const [campRes, sessionsRes] = await Promise.all([
        supabase.from('campaigns').select('calendar_system,dossier').or(`code.eq.${cleanCode},code.eq.${campaignCode.trim()}`).maybeSingle(),
        supabase.from('sessions').select('id, campaign_code, number, title, date_str, chapter_id, calendar_date, plot_events, recap, summary, images, cover_image_url, audio_url, session_type, quotes, audio_logs, excluded_player_ids, attendees, tags, entities_extracted, entities_extracted_at, memory_synced, memory_synced_at, created_at, updated_at').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`).order('number', { ascending: true }),
      ]);

      if (campRes.error && campRes.error.code !== 'PGRST116') {
        console.warn('[Supabase] Warning reading campaigns in fetchCalendarOnly:', campRes.error.message);
      }
      if (sessionsRes.error) {
        console.warn('[Supabase] Warning reading sessions in fetchCalendarOnly:', sessionsRes.error.message);
        return null;
      }

      const campRow: any = campRes.data || {};
      const cal = campRow.calendar_system || campRow.dossier?.calendar || null;
      const sessionsMeta = campRow.dossier?.sessionsMeta || {};
      const sessions = (sessionsRes.data || []).map((row: any) =>
        sessionRowToModel(row, sessionsMeta)
      );

      return { calendar: cal, sessions };
    } catch (e) {
      console.warn('[Supabase] fetchCalendarOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Sessions and Chapters
   */
  static async fetchSessionsOnly(campaignCode: string): Promise<{ sessions: Session[]; chapters: CampaignChapter[] } | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    const cleanCode = campaignCode.trim().toUpperCase();

    // 1. Check full campaign cache first
    const fullCached = this.campaignDataCache.get(cleanCode);
    if (fullCached && Date.now() - fullCached.timestamp < 180000 && Array.isArray(fullCached.data.sessions)) {
      return { sessions: fullCached.data.sessions, chapters: fullCached.data.chapters || [] };
    }

    // 2. Check sessionsOnly cache (60s TTL)
    const cached = this.sessionsOnlyCache.get(cleanCode);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    // 3. Deduplicate in-flight fetch
    const existingFlight = this.inFlightSessionsOnly.get(cleanCode);
    if (existingFlight) {
      return existingFlight;
    }

    const fetchPromise = (async () => {
      try {
        const [sessionsRes, chaptersRes] = await Promise.all([
          supabase.from('sessions').select('id, campaign_code, number, title, date_str, chapter_id, calendar_date, plot_events, recap, summary, images, cover_image_url, audio_url, session_type, quotes, audio_logs, excluded_player_ids, attendees, tags, entities_extracted, entities_extracted_at, memory_synced, memory_synced_at, created_at, updated_at').eq('campaign_code', cleanCode).order('number', { ascending: true }),
          supabase.from('chapters').select('id, campaign_code, number, title, synopsis, status, order_index, cover_image_url, color, created_at, updated_at').eq('campaign_code', cleanCode).order('order_index', { ascending: true }),
        ]);

        if (sessionsRes.error || chaptersRes.error) {
          console.warn('[Supabase] Warning in fetchSessionsOnly:', sessionsRes.error?.message, chaptersRes.error?.message);
          return null;
        }

        const chapters: CampaignChapter[] = (chaptersRes.data || []).map((row: any) =>
          chapterRowToModel(row)
        );
        const sessions: Session[] = (sessionsRes.data || []).map((row: any) =>
          sessionRowToModel(row)
        );

        const result = { sessions, chapters };
        this.sessionsOnlyCache.set(cleanCode, { data: result, timestamp: Date.now() });
        return result;
      } catch (e) {
        console.warn('[Supabase] fetchSessionsOnly error:', e);
        return null;
      } finally {
        this.inFlightSessionsOnly.delete(cleanCode);
      }
    })();

    this.inFlightSessionsOnly.set(cleanCode, fetchPromise);
    return fetchPromise;
  }

  /**
   * Granular On-Demand Fetch: Notes & Clarifications
   */
  static async fetchNotesOnly(campaignCode: string): Promise<Note[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    const cleanCode = campaignCode.trim().toUpperCase();

    // Check full campaign cache first
    const fullCached = this.campaignDataCache.get(cleanCode);
    if (fullCached && Date.now() - fullCached.timestamp < 180000 && Array.isArray(fullCached.data.notes)) {
      return fullCached.data.notes;
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id, campaign_code, title, content, category, session_id, lore_date, visibility, is_dm_only, is_pinned, canon_state, author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, images, created_at, updated_at')
        .eq('campaign_code', cleanCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase] Warning reading notes in fetchNotesOnly:', error.message);
        return null;
      }

      return (data || []).map((row: any) => noteRowToModel(row));
    } catch (e) {
      console.warn('[Supabase] fetchNotesOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Codex Entities
   */
  static async fetchEntitiesOnly(campaignCode: string): Promise<Entity[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    const cleanCode = campaignCode.trim().toUpperCase();

    // Check full campaign cache first
    const fullCached = this.campaignDataCache.get(cleanCode);
    if (fullCached && Date.now() - fullCached.timestamp < 180000 && Array.isArray(fullCached.data.entities)) {
      return fullCached.data.entities;
    }

    try {
      const res = await supabase
        .from('entities')
        .select('id, campaign_code, name, type, description, image_url, status, attributes, created_at, updated_at')
        .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`);
      if (res.error) {
        console.warn('[Supabase] Warning reading entities in fetchEntitiesOnly:', res.error.message);
        return null;
      }
      return (res.data || []).map(entityRowToModel);
    } catch (e) {
      console.warn('[Supabase] fetchEntitiesOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Maps
   */
  static async fetchMapsOnly(campaignCode: string): Promise<WorldMap[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('maps')
        .select('id, campaign_code, title, description, image_url, scale_label, entity_id, folder_id, pins, fog_of_war, is_default, is_secret, shared_with_dm, created_at, updated_at')
        .eq('campaign_code', cleanCode)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[Supabase] Warning reading maps in fetchMapsOnly:', error.message);
        return null;
      }

      return (data || []).map((row: any) => mapRowToModel(row));
    } catch (e) {
      console.warn('[Supabase] fetchMapsOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Scrapbook
   */
  static async fetchScrapbookOnly(campaignCode: string): Promise<ScrapbookItem[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('scrapbook')
        .select('id, campaign_code, title, caption, image_url, created_by, category, aspect_ratio, tags, session_id, entity_id, lore_date, is_secret, shared_with_dm, created_at, updated_at')
        .eq('campaign_code', cleanCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase] Warning reading scrapbook in fetchScrapbookOnly:', error.message);
        return null;
      }

      return (data || []).map(scrapbookRowToModel);
    } catch (e) {
      console.warn('[Supabase] fetchScrapbookOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Audio Logs
   */
  static async fetchAudioLogsOnly(campaignCode: string): Promise<AudioLog[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('audio_logs')
        .select('id, campaign_code, title, audio_url, duration, recorded_by, lore_date, associated_type, associated_id, created_at, updated_at')
        .eq('campaign_code', cleanCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase] Warning reading audio_logs in fetchAudioLogsOnly:', error.message);
        return null;
      }

      return (data || []).map(audioLogRowToModel);
    } catch (e) {
      console.warn('[Supabase] fetchAudioLogsOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: World Lore Articles
   */
  static async fetchWorldLoreOnly(campaignCode: string): Promise<any[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('world_lore_articles')
        .select('id, campaign_code, title, subtitle, summary, content, category_id, images, is_draft, bites, author_player_id, author_name, tags, related_entity_ids, order_index, updated_at')
        .eq('campaign_code', cleanCode)
        .order('order_index', { ascending: true });

      if (error) {
        console.warn('[Supabase] Warning reading world_lore_articles in fetchWorldLoreOnly:', error.message);
        return null;
      }

      return (data || []).map((row: any) => ({
        _id: row.id,
        _createdAt: row.updated_at || new Date().toISOString(),
        title: row.title || 'Senza Titolo',
        subtitle: row.subtitle || '',
        summary: row.summary || '',
        fullContentMarkdown: row.content || '',
        category: row.category_id || 'general',
        images: Array.isArray(row.images) ? row.images : [],
        dmOnly: Boolean(row.is_draft),
        bites: Array.isArray(row.bites) ? row.bites : [],
        authorPlayerId: row.author_player_id || '',
        authorName: row.author_name || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        relatedEntityIds: Array.isArray(row.related_entity_ids) ? row.related_entity_ids : [],
        order: Number(row.order_index ?? 0),
      }));
    } catch (e) {
      console.warn('[Supabase] fetchWorldLoreOnly error:', e);
      return null;
    }
  }

  /**
   * Safe partial update for campaign metadata.
   * Only updates explicitly passed fields, NEVER wiping out calendar, ai_config, active_players or dossier.
   */
  static async updateCampaignMetadata(campaignCode: string, updates: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;

    try {
      const code = campaignCode.trim();
      const cleanCode = code.toUpperCase();
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };

      if (updates.title !== undefined) patch.title = updates.title;
      if (updates.subtitle !== undefined) patch.subtitle = updates.subtitle;
      if (updates.description !== undefined) patch.description = updates.description;
      if (updates.system !== undefined) patch.system = updates.system;
      if (updates.dmId !== undefined) patch.dm_id = updates.dmId;
      if (updates.calendarSystem !== undefined) patch.calendar_system = updates.calendarSystem;
      if (updates.aiConfig !== undefined) patch.ai_config = updates.aiConfig;
      if (updates.activePlayers !== undefined) patch.active_players = updates.activePlayers;
      if (updates.dmIsPlayer !== undefined) {
        const { data: camp } = await supabase.from('campaigns').select('dossier').or(`code.eq.${cleanCode},code.eq.${code}`).maybeSingle();
        const dossier = camp?.dossier || {};
        patch.dossier = { ...dossier, dmIsPlayer: updates.dmIsPlayer };
      }

      const { error } = await supabase
        .from('campaigns')
        .update(patch)
        .or(`code.eq.${cleanCode},code.eq.${code}`);

      if (error) {
        return handleSupabaseError('Error updating campaign metadata', error);
      }
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to update campaign metadata', err);
    }
  }

  /**
   * Save or create campaign info with full field preservation
   */
  static async saveCampaign(campaignCodeOrMeta: string | Record<string, any>, data?: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCodeOrMeta) return false;

    try {
      let code = '';
      let payloadData: Record<string, any> = {};

      if (typeof campaignCodeOrMeta === 'string') {
        code = campaignCodeOrMeta.trim();
        payloadData = data || {};
      } else if (typeof campaignCodeOrMeta === 'object' && campaignCodeOrMeta !== null) {
        code = (campaignCodeOrMeta.code || '').trim();
        payloadData = {
          title: campaignCodeOrMeta.name || campaignCodeOrMeta.title,
          ...campaignCodeOrMeta,
          ...(data || {}),
        };
      }

      if (!code) return false;
      const cleanCode = code.toUpperCase();

      // Read existing campaign first to merge existing columns
      const { data: existing } = await supabase
        .from('campaigns')
        .select('*')
        .or(`code.eq.${cleanCode},code.eq.${code}`)
        .maybeSingle();

      const existingDossier = existing?.dossier || payloadData.dossier || {};
      const payload = {
        code: cleanCode,
        title: payloadData.title !== undefined ? payloadData.title : existing?.title || 'Nuova Campagna',
        subtitle: payloadData.subtitle !== undefined ? payloadData.subtitle : existing?.subtitle || '',
        description: payloadData.description !== undefined ? payloadData.description : existing?.description || '',
        system: payloadData.system !== undefined ? payloadData.system : existing?.system || 'D&D 5e',
        dm_id: payloadData.dmId !== undefined ? payloadData.dmId : existing?.dm_id || '',
        calendar_system: payloadData.calendarSystem !== undefined ? payloadData.calendarSystem : existing?.calendar_system || {},
        ai_config: payloadData.aiConfig !== undefined ? payloadData.aiConfig : existing?.ai_config || {},
        active_players: payloadData.activePlayers !== undefined ? payloadData.activePlayers : existing?.active_players || [],
        title_font: payloadData.titleFont || payloadData.title_font || existing?.title_font || 'cinzel',
        title_effect: payloadData.titleEffect || payloadData.title_effect || existing?.title_effect || 'default',
        dossier: {
          ...existingDossier,
          ...(payloadData.dossier || {}),
          expelledAccountIds: payloadData.expelledAccountIds || payloadData.expelled_account_ids || existingDossier.expelledAccountIds || [],
          dmIsPlayer: payloadData.dmIsPlayer !== undefined ? payloadData.dmIsPlayer : (existingDossier.dmIsPlayer ?? undefined),
          characterBios: payloadData.characterBios || existingDossier.characterBios || [],
          familyRelations: payloadData.familyRelations || existingDossier.familyRelations || [],
          worldLoreArticles: payloadData.worldLoreArticles || existingDossier.worldLoreArticles || [],
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await safeUpsert('campaigns', payload, { onConflict: 'code' });
      if (error) {
        return handleSupabaseError('Error saving campaign', error);
      }

      // Bootstrap creator / DM membership in campaign_members table
      if (payload.dm_id) {
        await supabase.from('campaign_members').upsert({
          id: `${cleanCode}_${payload.dm_id}`,
          campaign_code: cleanCode,
          user_id: payload.dm_id,
          role: 'dm',
          created_at: new Date().toISOString(),
        }, { onConflict: 'campaign_code,user_id' });
      }

      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save campaign', err);
    }
  }

  /**
   * Updates an existing campaign code on Supabase across all campaign tables, handling Foreign Key constraints
   */
  static async updateCampaignCode(oldCode: string, newCode: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !oldCode || !newCode) return false;
    const cleanOld = oldCode.trim().toUpperCase();
    const cleanNew = newCode.trim().toUpperCase();
    if (cleanOld === cleanNew) return true;

    try {
      // 1. Fetch old campaign record
      const { data: oldCamp } = await supabase
        .from('campaigns')
        .select('*')
        .eq('code', cleanOld)
        .maybeSingle();

      if (oldCamp) {
        // 2. Insert duplicate campaign row with new code
        const newCampRecord = { ...oldCamp, code: cleanNew, updated_at: new Date().toISOString() };
        await supabase.from('campaigns').upsert(newCampRecord, { onConflict: 'code' });
      }

      // List of child tables that reference campaign_code
      const childTables = [
        'campaign_members',
        'sessions',
        'chapters',
        'notes',
        'entities',
        'maps',
        'character_bios',
        'family_relations',
        'world_lore_articles',
        'scrapbook',
        'audio_logs',
      ];

      // 3. Update all child tables to point to new code
      for (const table of childTables) {
        try {
          await supabase
            .from(table)
            .update({ campaign_code: cleanNew })
            .eq('campaign_code', cleanOld);
        } catch (tErr) {
          console.warn(`Warning updating child table ${table}:`, tErr);
        }
      }

      // 4. Delete old campaign record and any remaining old child entries
      await this.deleteLegacyCampaign(cleanOld);

      return true;
    } catch (err) {
      console.error('Failed to update campaign code on Supabase:', err);
      return false;
    }
  }

  /**
   * Deletes a legacy or orphaned campaign and all its child records from Supabase
   */
  static async deleteLegacyCampaign(campaignCode: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    const cleanCode = campaignCode.trim().toUpperCase();

    try {
      const childTables = [
        'campaign_members',
        'sessions',
        'chapters',
        'notes',
        'entities',
        'maps',
        'character_bios',
        'family_relations',
        'world_lore_articles',
        'scrapbook',
        'audio_logs',
      ];

      for (const table of childTables) {
        try {
          await supabase.from(table).delete().eq('campaign_code', cleanCode);
        } catch (tErr) {
          console.warn(`Warning deleting child records from ${table}:`, tErr);
        }
      }

      await supabase.from('campaigns').delete().eq('code', cleanCode);
      return true;
    } catch (err) {
      console.error('Error deleting legacy campaign from Supabase:', err);
      return false;
    }
  }
  static async joinCampaignMember(campaignCode: string, userId: string, role: 'player' | 'dm' = 'player', characterName?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !userId) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const payload = {
        id: `${cleanCode}_${userId}`,
        campaign_code: cleanCode,
        user_id: userId,
        role,
        character_name: characterName || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('campaign_members').upsert(payload, { onConflict: 'campaign_code,user_id' });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Leaves or removes a member from campaign_members and campaign dossier on Supabase
   */
  static async removeCampaignMember(campaignCode: string, userId: string, email?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !userId) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const cleanEmail = (email || '').toLowerCase().trim();

      await supabase.from('campaign_members').delete().eq('campaign_code', code).or(`user_id.eq.${userId}${cleanEmail ? `,user_id.eq.${cleanEmail}` : ''}`);

      const { data: camp } = await supabase.from('campaigns').select('dossier, active_players').eq('code', code).maybeSingle();
      if (camp) {
        const dossier = camp.dossier || {};
        const currentExpelled: string[] = Array.from(new Set([
          ...(Array.isArray(dossier.expelledAccountIds) ? dossier.expelledAccountIds : []),
          userId,
          ...(cleanEmail ? [cleanEmail] : []),
        ]));

        const activePlayers = (dossier.activePlayers || camp.active_players || []).filter(
          (p: any) => p.id !== userId && p._id !== userId && (!cleanEmail || p.email !== cleanEmail)
        );
        const familyRelations = (dossier.familyRelations || []).filter(
          (r: any) => r.playerId !== userId && r.source_entity_id !== userId && (!cleanEmail || r.email !== cleanEmail)
        );

        await supabase.from('campaigns').update({
          dossier: {
            ...dossier,
            activePlayers,
            familyRelations,
            expelledAccountIds: currentExpelled,
          },
          active_players: activePlayers,
          updated_at: new Date().toISOString(),
        }).eq('code', code);
      }

      // Also clean standalone tables
      try {
        await supabase.from('character_bios').delete().eq('campaign_code', code).eq('player_id', userId);
        await supabase.from('family_relations').delete().eq('campaign_code', code).eq('source_entity_id', userId);
      } catch {}
      return true;
    } catch (err) {
      console.warn('[Supabase] removeCampaignMember exception:', err);
      return false;
    }
  }

  /**
   * Transfers DM role to another member
   */
  static async transferCampaignDm(campaignCode: string, newDmUserId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !newDmUserId) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      // 1. Update campaigns table dm_id
      await supabase.from('campaigns').update({ dm_id: newDmUserId, updated_at: new Date().toISOString() }).eq('code', cleanCode);
      // 2. Demote old DM to player and promote new DM
      await supabase.from('campaign_members').update({ role: 'player' }).eq('campaign_code', cleanCode).eq('role', 'dm');
      await supabase.from('campaign_members').upsert({
        id: `${cleanCode}_${newDmUserId}`,
        campaign_code: cleanCode,
        user_id: newDmUserId,
        role: 'dm',
        created_at: new Date().toISOString(),
      }, { onConflict: 'campaign_code,user_id' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Partially updates specific columns of a session (e.g. calendar_date) without resending the entire heavy payload
   */
  static async patchSessionFields(campaignCode: string, sessionId: string, patch: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !sessionId) return false;
    try {
      const code = (campaignCode || '').trim().toUpperCase();
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('sessions').update(payload).eq('id', sessionId);
      if (error) return handleSupabaseError('Error patching session fields', error);
      if (code) this.updateCachedItem(code, 'sessions', { id: sessionId, ...patch });
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to patch session fields', err);
    }
  }

  /**
   * Partially updates specific columns of a note (e.g. is_pinned, visibility) without resending markdown content or images
   */
  static async patchNoteFields(campaignCode: string, noteId: string, patch: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !noteId) return false;
    try {
      const code = (campaignCode || '').trim().toUpperCase();
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('notes').update(payload).eq('id', noteId);
      if (error) return handleSupabaseError('Error patching note fields', error);
      if (code) this.updateCachedItem(code, 'notes', { id: noteId, ...patch });
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to patch note fields', err);
    }
  }

  /**
   * Partially updates specific columns of an entity (e.g. status) without resending description or gallery
   */
  static async patchEntityFields(campaignCode: string, entityId: string, patch: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !entityId) return false;
    try {
      const code = (campaignCode || '').trim().toUpperCase();
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('entities').update(payload).eq('id', entityId);
      if (error) return handleSupabaseError('Error patching entity fields', error);
      if (code) this.updateCachedItem(code, 'entities', { id: entityId, ...patch });
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to patch entity fields', err);
    }
  }

  /**
   * Partially updates specific columns of a character bio without resending lore memories
   */
  static async patchCharacterBioFields(campaignCode: string, playerId: string, patch: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !playerId) return false;
    try {
      const code = (campaignCode || '').trim().toUpperCase();
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      let query = supabase.from('character_bios').update(payload).eq('player_id', playerId);
      if (code) query = query.eq('campaign_code', code);
      const { error } = await query;
      if (error) return handleSupabaseError('Error patching character bio fields', error);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to patch character bio fields', err);
    }
  }

  /**
   * Partially updates specific columns of a map without resending map image assets
   */
  static async patchMapFields(campaignCode: string, mapId: string, patch: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !mapId) return false;
    try {
      const code = (campaignCode || '').trim().toUpperCase();
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('maps').update(payload).eq('id', mapId);
      if (error) return handleSupabaseError('Error patching map fields', error);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to patch map fields', err);
    }
  }

  /**
   * Save or update a single session with complete metadata and image persistence
   */
  static async saveSession(campaignCode: string, session: Session): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !session) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const cleanSession = sanitizeHeavyPayload(session);
      const payload = sessionModelToRow(cleanSession, code);

      const { error } = await safeUpsert('sessions', payload, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving session', error);

      this.updateCachedItem(code, 'sessions', session);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save session', err);
    }
  }

  /**
   * Delete a single session
   */
  static async deleteSession(sessionId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !sessionId) return false;
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (campaignCode) this.updateCachedItem(campaignCode, 'sessions', { id: sessionId }, true);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save or update a single note (~15ms) with full tag, image, and pinned persistence
   */
  static async saveNote(campaignCode: string, note: Note): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !note) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = noteModelToRow(note, code);

      const { error } = await safeUpsert('notes', payload, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving note', error);

      this.updateCachedItem(code, 'notes', note);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save note', err);
    }
  }

  /**
   * Delete a single note
   */
  static async deleteNote(noteId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !noteId) return false;
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (campaignCode) this.updateCachedItem(campaignCode, 'notes', { id: noteId }, true);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save or update a single entity with accurate type, images, and progression attributes
   */
  static async saveEntity(campaignCode: string, entity: Entity): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !entity) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = entityModelToRow(entity, code);

      const { error } = await safeUpsert('entities', payload, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving entity', error);
      this.updateCachedItem(code, 'entities', entity);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save entity', err);
    }
  }

  /**
   * Bulk saves entities with a single batch request
   */
  static async saveEntities(campaignCode: string, entities: Entity[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !Array.isArray(entities) || entities.length === 0) return true;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payloads = entities.map((e) => entityModelToRow(e, code));
      const { error } = await safeUpsert('entities', payloads, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving entities in bulk', error);
      this.updateCachedEntities(code, entities);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save entities in bulk', err);
    }
  }

  /**
   * Delete a single entity
   */
  static async deleteEntity(entityId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('entities').delete().eq('id', entityId);
      if (campaignCode) this.updateCachedItem(campaignCode, 'entities', { id: entityId }, true);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Clear all entities for a campaign
   */
  static async clearAllEntities(campaignCode: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const { error } = await supabase.from('entities').delete().eq('campaign_code', code);
      if (error) console.error('[Supabase] Error clearing entities:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to clear entities:', err);
      return false;
    }
  }

  /**
   * Save or update a single chapter (~15ms)
   */
  static async saveChapter(campaignCode: string, chapter: CampaignChapter): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapter) return false;

    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      let activeChapter = chapter;
      if (activeChapter.coverImageUrl && activeChapter.coverImageUrl.startsWith('data:')) {
        const cdnUrl = await ensureMediaUploaded(cleanCode, 'images', activeChapter.coverImageUrl, `chap_${activeChapter.id}`);
        activeChapter = { ...activeChapter, coverImageUrl: cdnUrl };
      }
      const payload = chapterModelToRow(activeChapter, cleanCode);

      const { error } = await safeUpsert('chapters', payload, {
        onConflict: 'id',
      });
      if (error) {
        return handleSupabaseError('Error saving chapter', error);
      }

      this.updateCachedItem(cleanCode, 'chapters', activeChapter);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save chapter', err);
    }
  }

  /**
   * Persists chapter cover image URL to chapters table
   */
  static async saveChapterCover(campaignCode: string, chapterId: string, coverImageUrl: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapterId) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      let finalUrl = coverImageUrl;
      if (finalUrl && finalUrl.startsWith('data:')) {
        finalUrl = await ensureMediaUploaded(cleanCode, 'images', finalUrl, `chap_${chapterId}`);
      }

      const { error } = await supabase
        .from('chapters')
        .update({ cover_image_url: finalUrl, updated_at: new Date().toISOString() })
        .eq('id', chapterId);

      if (error) {
        return handleSupabaseError('Error updating chapter cover', error);
      }

      this.updateCachedItem(cleanCode, 'chapters', { id: chapterId, coverImageUrl: finalUrl });
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save chapter cover', err);
    }
  }

  /**
   * Persists map folders hierarchy into campaign dossier
   */
  static async saveMapFolders(campaignCode: string, folders: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      await supabase.from('campaigns').update({
        dossier: { ...dossier, mapFolders: folders || [] },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save map folders:', err);
      return false;
    }
  }

  /**
   * Persists map metadata (description, folderId) into campaign dossier
   */
  static async saveMapMeta(campaignCode: string, mapId: string, meta: { folderId?: string; description?: string }): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !mapId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      const mapsMeta = dossier.mapsMeta || {};
      mapsMeta[mapId] = { ...(mapsMeta[mapId] || {}), ...meta };
      await supabase.from('campaigns').update({
        dossier: { ...dossier, mapsMeta },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save map metadata:', err);
      return false;
    }
  }

  /**
   * Non-destructive merge of active party members / user accounts into campaign row and user_accounts table in Supabase
   */
  static async saveActivePlayers(campaignCode: string, accounts: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const sanitized = Array.isArray(accounts) ? accounts.filter((a) => a && a.id) : [];

      // Fetch existing active_players from campaigns to avoid wiping out fellow party members
      const { data: camp } = await supabase.from('campaigns').select('active_players, dossier').eq('code', code).maybeSingle();
      const existingPlayers: any[] = Array.isArray(camp?.active_players) ? camp.active_players : [];

      const expelledSet = new Set<string>([
        ...(Array.isArray(camp?.dossier?.expelledAccountIds) ? camp.dossier.expelledAccountIds : []),
      ].map((id: string) => String(id).toLowerCase()));

      // Non-destructive merge
      const playerMap = new Map<string, any>();
      existingPlayers.forEach((p) => {
        if (p && p.id && !expelledSet.has(String(p.id).toLowerCase()) && (!p.email || !expelledSet.has(String(p.email).toLowerCase()))) {
          playerMap.set(p.id, p);
        }
      });
      sanitized.forEach((p) => {
        if (p && p.id && !expelledSet.has(String(p.id).toLowerCase()) && (!p.email || !expelledSet.has(String(p.email).toLowerCase()))) {
          const current = playerMap.get(p.id) || {};
          playerMap.set(p.id, { ...current, ...p });
        }
      });
      const mergedPlayers = Array.from(playerMap.values());

      // If active players have not changed at all, skip database mutation entirely
      if (JSON.stringify(mergedPlayers) === JSON.stringify(existingPlayers)) {
        return true;
      }

      const dossier = camp?.dossier || {};
      const cleanCode = code.trim().toUpperCase();
      const { error } = await supabase.from('campaigns').update({
        active_players: mergedPlayers,
        dossier: {
          ...dossier,
          activePlayers: mergedPlayers,
        },
        updated_at: new Date().toISOString(),
      }).or(`code.eq.${code},code.eq.${cleanCode}`);

      if (error) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Saves or updates a user account in the central public.user_accounts table
   */
  static async saveUserAccount(account: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !account || !account.id) return false;
    try {
      const authUserRes = await supabase.auth.getUser();
      const currentAuthId = authUserRes.data?.user?.id;

      // In Supabase RLS, users can only update their own row (id = auth.uid())
      if (currentAuthId && account.id !== currentAuthId) {
        return true; // Gracefully skip updating other users' central accounts
      }

      const email = (account.email || '').toLowerCase().trim();
      const payload = {
        id: account.id,
        email: email || `${account.id}@local.chronicle`,
        character_name: account.characterName || 'Avventuriero',
        is_dm: Boolean(account.isDm),
        dm_campaigns: Array.isArray(account.dmCampaigns) ? account.dmCampaigns : [],
        joined_campaigns: Array.isArray(account.joinedCampaigns) ? account.joinedCampaigns : [],
        color: account.color || '#6366f1',
        avatar_url: account.avatarUrl || '',
        campaign_profiles: account.campaignProfiles || {},
        preferences: account.preferences || {},
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('user_accounts').upsert(payload, { onConflict: 'id' });
      if (error) {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetches a specific user account from public.user_accounts
   */
  static async getUserAccount(userId: string, email?: string, force = false): Promise<any | null> {
    if (!isSupabaseConfigured() || (!userId && !email)) return null;

    const cacheKey = (userId || email || '').trim().toLowerCase();
    if (!force) {
      const cached = this.userAccountCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) { // 60s TTL
        return cached.data;
      }
    }

    const inFlight = this.inFlightUserAccount.get(cacheKey);
    if (inFlight) return inFlight;

    const fetchPromise = (async () => {
      try {
        const cleanEmail = (email || '').trim().toLowerCase();
        let query = supabase.from('user_accounts').select('id, email, character_name, is_dm, dm_campaigns, joined_campaigns, color, avatar_url, campaign_profiles, preferences, created_at, updated_at');
        if (userId && cleanEmail) {
          query = query.or(`id.eq.${userId},email.eq.${cleanEmail}`);
        } else if (userId) {
          query = query.eq('id', userId);
        } else if (cleanEmail) {
          query = query.eq('email', cleanEmail);
        }

        const { data, error } = await query.maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('[Supabase] getUserAccount error:', error.message);
          return null;
        }
        if (!data) return null;

        const effectiveUserId = data.id || userId;

        // Also get memberships from campaign_members (verified against real campaigns)
        const memberRes = await this.getUserCampaigns(effectiveUserId, cleanEmail || data.email);

        // Verify campaign_profiles and joined/dm campaigns against active campaigns & expulsion lists
        const { data: realCampaigns } = await supabase.from('campaigns').select('code, dossier');
        const realCodes = new Set((realCampaigns || []).map((rc: any) => (rc.code || '').trim().toUpperCase()));
        const expelledMap = new Map<string, Set<string>>();
        (realCampaigns || []).forEach((rc: any) => {
          const code = (rc.code || '').trim().toUpperCase();
          const expelledList = Array.isArray(rc.dossier?.expelledAccountIds) ? rc.dossier.expelledAccountIds : [];
          if (code && expelledList.length > 0) {
            const s = new Set<string>();
            expelledList.forEach((id: any) => s.add(String(id).toLowerCase().trim()));
            expelledMap.set(code, s);
          }
        });

        const userLowId = String(effectiveUserId || '').toLowerCase();
        const userLowEmail = String(cleanEmail || data.email || '').toLowerCase();
        const isExpelledFrom = (code: string) => {
          const upper = code.toUpperCase();
          const s = expelledMap.get(upper);
          if (!s) return false;
          return s.has(userLowId) || (Boolean(userLowEmail) && s.has(userLowEmail));
        };

        const rawDmCampaigns = Array.from(new Set([...(Array.isArray(data.dm_campaigns) ? data.dm_campaigns : []), ...memberRes.dmCampaigns]));
        const rawJoinedCampaigns = Array.from(new Set([...(Array.isArray(data.joined_campaigns) ? data.joined_campaigns : []), ...memberRes.joinedCampaigns]));

        const dmCampaigns = rawDmCampaigns.filter((c) => !isExpelledFrom(c));
        const joinedCampaigns = rawJoinedCampaigns.filter((c) => !isExpelledFrom(c));

        const rawProfiles = data.campaign_profiles || {};
        const cleanProfiles: Record<string, any> = {};
        let profilesNeedClean = false;
        for (const [key, val] of Object.entries(rawProfiles)) {
          if (realCodes.has(key.toUpperCase()) && !isExpelledFrom(key)) {
            cleanProfiles[key] = val;
          } else {
            profilesNeedClean = true;
          }
        }

        if (profilesNeedClean) {
          (async () => {
            try {
              await supabase
                .from('user_accounts')
                .update({
                  campaign_profiles: cleanProfiles,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', data.id);
            } catch {}
          })();
        }

        const result = {
          ...data,
          id: data.id || userId,
          characterName: data.character_name || 'Avventuriero',
          avatarUrl: data.avatar_url || '',
          isDm: Boolean(data.is_dm || dmCampaigns.length > 0),
          dmCampaigns,
          joinedCampaigns,
          campaignProfiles: cleanProfiles,
        };

        this.userAccountCache.set(cacheKey, { data: result, timestamp: Date.now() });
        if (data.id && data.id !== cacheKey) {
          this.userAccountCache.set(data.id, { data: result, timestamp: Date.now() });
        }
        return result;
      } catch {
        return null;
      } finally {
        this.inFlightUserAccount.delete(cacheKey);
      }
    })();

    this.inFlightUserAccount.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetches campaigns associated with a user from campaign_members table,
   * verifying against the active campaigns table and pruning orphaned records.
   */
  static async getUserCampaigns(userId: string, email?: string, force = false): Promise<{ dmCampaigns: string[]; joinedCampaigns: string[] }> {
    if (!isSupabaseConfigured() || (!userId && !email)) return { dmCampaigns: [], joinedCampaigns: [] };

    const cacheKey = (userId || email || '').trim().toLowerCase();
    if (!force) {
      const cached = this.userCampaignsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
      }
    }

    const inFlight = this.inFlightUserCampaigns.get(cacheKey);
    if (inFlight) return inFlight;

    const fetchPromise = (async () => {
      try {
        const candidateUserIds = new Set<string>();
        if (userId) candidateUserIds.add(userId);
        const cleanEmail = (email || '').trim().toLowerCase();

        // Check user_accounts to resolve any canonical user IDs for this email
        if (cleanEmail) {
          try {
            const { data: uRows } = await supabase
              .from('user_accounts')
              .select('id, dm_campaigns, joined_campaigns')
              .eq('email', cleanEmail);
            if (Array.isArray(uRows)) {
              uRows.forEach((r) => {
                if (r.id) candidateUserIds.add(r.id);
              });
            }
          } catch {}
        }

        const idList = Array.from(candidateUserIds);

        // 1. Fetch from campaign_members
        let memberRows: any[] = [];
        if (idList.length > 0) {
          const orFilter = idList.map((id) => `user_id.eq.${id}`).join(',');
          const { data: memData } = await supabase
            .from('campaign_members')
            .select('campaign_code, role')
            .or(orFilter);
          if (Array.isArray(memData)) {
            memberRows = memData;
          }
        }

        // Check against real active campaigns so orphaned or expelled campaign_members are never loaded or presented
        const { data: realCampaigns } = await supabase
          .from('campaigns')
          .select('code, dm_id, dossier');
        const realCodes = new Set((realCampaigns || []).map((rc: any) => (rc.code || '').trim().toUpperCase()));
        const expelledCodes = new Set<string>();

        (realCampaigns || []).forEach((rc: any) => {
          const code = (rc.code || '').trim().toUpperCase();
          const expelledList = Array.isArray(rc.dossier?.expelledAccountIds) ? rc.dossier.expelledAccountIds : [];
          if (code && expelledList.length > 0) {
            const expelledSet = new Set(expelledList.map((id: any) => String(id).toLowerCase().trim()));
            const isExpelled = idList.some((id) => expelledSet.has(id.toLowerCase())) || (cleanEmail && expelledSet.has(cleanEmail));
            if (isExpelled) {
              expelledCodes.add(code);
            }
          }
        });

        const dmCampaigns: string[] = [];
        const joinedCampaigns: string[] = [];
        const orphanCodes: string[] = [];

        // Check if user is DM of any campaign directly via dm_id
        (realCampaigns || []).forEach((rc: any) => {
          const code = (rc.code || '').trim().toUpperCase();
          if (code && !expelledCodes.has(code) && rc.dm_id && idList.includes(rc.dm_id)) {
            if (!dmCampaigns.includes(code)) dmCampaigns.push(code);
            if (!joinedCampaigns.includes(code)) joinedCampaigns.push(code);
          }
        });

        memberRows.forEach((row: any) => {
          const code = (row.campaign_code || '').trim().toUpperCase();
          if (!code || expelledCodes.has(code)) return;
          if (realCodes.has(code)) {
            if (row.role === 'dm' && !dmCampaigns.includes(code)) {
              dmCampaigns.push(code);
            }
            if (!joinedCampaigns.includes(code)) {
              joinedCampaigns.push(code);
            }
          } else {
            orphanCodes.push(code);
          }
        });

        const result = {
          dmCampaigns: Array.from(new Set(dmCampaigns)),
          joinedCampaigns: Array.from(new Set(joinedCampaigns)),
        };

        this.userCampaignsCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      } catch {
        return { dmCampaigns: [], joinedCampaigns: [] };
      } finally {
        this.inFlightUserCampaigns.delete(cacheKey);
      }
    })();

    this.inFlightUserCampaigns.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Bulk saves all user accounts into public.user_accounts with single-batch upsert
   */
  static async saveAllUserAccounts(accounts: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !Array.isArray(accounts) || accounts.length === 0) return false;
    try {
      const authUserRes = await supabase.auth.getUser();
      const currentAuthId = authUserRes.data?.user?.id;

      // Deduplicate by id and filter to current authenticated user for RLS compliance
      const byIdOrEmail = new Map<string, any>();
      for (const a of accounts) {
        if (!a || !a.id) continue;
        if (currentAuthId && a.id !== currentAuthId) continue; // RLS restricts writing other user accounts
        byIdOrEmail.set(a.id, a);
      }
      const uniqueAccounts = Array.from(byIdOrEmail.values());
      if (uniqueAccounts.length === 0) return true;

      const payloads = uniqueAccounts.map((account) => {
        const email = (account.email || '').toLowerCase().trim();
        return {
          id: account.id,
          email: email || `${account.id}@local.chronicle`,
          character_name: account.characterName || 'Avventuriero',
          is_dm: Boolean(account.isDm),
          dm_campaigns: Array.isArray(account.dmCampaigns) ? account.dmCampaigns : [],
          joined_campaigns: Array.isArray(account.joinedCampaigns) ? account.joinedCampaigns : [],
          color: account.color || '#6366f1',
          avatar_url: account.avatarUrl || '',
          campaign_profiles: account.campaignProfiles || {},
          preferences: account.preferences || {},
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase.from('user_accounts').upsert(payloads, { onConflict: 'id' });
      if (error) {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Deletes a user account completely from public.user_accounts and campaign_members on Supabase
   */
  static async deleteUserAccount(userId: string, email?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) return false;
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      let query = `id.eq.${userId}`;
      if (cleanEmail && !cleanEmail.endsWith('@local.chronicle')) {
        query += `,email.eq.${cleanEmail}`;
      }
      await supabase.from('user_accounts').delete().or(query);
      await supabase.from('campaign_members').delete().or(`user_id.eq.${userId}${cleanEmail ? `,user_id.eq.${cleanEmail}` : ''}`);
      return true;
    } catch (err) {
      console.warn('[Supabase] deleteUserAccount exception:', err);
      return false;
    }
  }

  /**
   * Fetches all user accounts from the central public.user_accounts table
   */
  static async fetchAllUserAccounts(force = false): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];

    if (!force && this.userAccountsCache && Date.now() - this.userAccountsCache.timestamp < 60000) {
      return this.userAccountsCache.data;
    }

    if (this.inFlightUserAccountsFetch) {
      return this.inFlightUserAccountsFetch;
    }

    this.inFlightUserAccountsFetch = (async () => {
      try {
        const { data, error } = await supabase.from('user_accounts').select('id, email, character_name, is_dm, dm_campaigns, joined_campaigns, color, avatar_url, campaign_profiles, preferences, created_at, updated_at');
        if (error || !Array.isArray(data)) {
          return [];
        }

        const { data: realCamps } = await supabase.from('campaigns').select('code, dossier');
        const expelledMap = new Map<string, Set<string>>();
        (realCamps || []).forEach((rc: any) => {
          const code = (rc.code || '').trim().toUpperCase();
          const expelledList = Array.isArray(rc.dossier?.expelledAccountIds) ? rc.dossier.expelledAccountIds : [];
          if (code && expelledList.length > 0) {
            const s = new Set<string>();
            expelledList.forEach((id: any) => s.add(String(id).toLowerCase().trim()));
            expelledMap.set(code, s);
          }
        });

        const result = data.map((row) => {
          const userLowId = String(row.id || '').toLowerCase();
          const userLowEmail = String(row.email || '').toLowerCase();
          const isExpelledFrom = (code: string) => {
            const upper = code.toUpperCase();
            const s = expelledMap.get(upper);
            if (!s) return false;
            return s.has(userLowId) || (Boolean(userLowEmail) && s.has(userLowEmail));
          };

          const rawDm = Array.isArray(row.dm_campaigns) ? row.dm_campaigns : [];
          const rawJoined = Array.isArray(row.joined_campaigns) ? row.joined_campaigns : [];
          const rawProfiles = row.campaign_profiles || {};

          const dmCampaigns = rawDm.filter((c: string) => !isExpelledFrom(c));
          const joinedCampaigns = rawJoined.filter((c: string) => !isExpelledFrom(c));
          const campaignProfiles = { ...rawProfiles };
          Object.keys(campaignProfiles).forEach((pCode) => {
            if (isExpelledFrom(pCode)) {
              delete campaignProfiles[pCode];
            }
          });

          return {
            id: row.id,
            email: row.email,
            characterName: row.character_name,
            isDm: Boolean(row.is_dm || dmCampaigns.length > 0),
            dmCampaigns,
            joinedCampaigns,
            color: row.color || '#6366f1',
            avatarUrl: row.avatar_url || '',
            campaignProfiles,
            preferences: row.preferences || {},
            createdAt: row.created_at || new Date().toISOString(),
          };
        });
        this.userAccountsCache = { data: result, timestamp: Date.now() };
        return result;
      } catch (err) {
        console.warn('[Supabase] fetchAllUserAccounts exception:', err);
        return [];
      } finally {
        this.inFlightUserAccountsFetch = null;
      }
    })();

    return this.inFlightUserAccountsFetch;
  }

  /**
   * Fetches all campaigns from Supabase for the global campaign list
   */
  static async fetchAllCampaigns(force = false): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];

    if (!force && this.allCampaignsCache && Date.now() - this.allCampaignsCache.timestamp < 60000) {
      return this.allCampaignsCache.data;
    }

    if (this.inFlightAllCampaignsFetch) {
      return this.inFlightAllCampaignsFetch;
    }

    this.inFlightAllCampaignsFetch = (async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('code, title, subtitle, description, system, dm_id, active_players, dossier, created_at, updated_at');
        if (error || !Array.isArray(data)) return [];
        const result = data.map((c) => {
          const activePlayers = Array.isArray(c.active_players) ? c.active_players : [];
          const dmPlayer = activePlayers.find((p: any) => p && (p.isDm || (c.dm_id && (p.id === c.dm_id || p._id === c.dm_id))));
          const activePlayerEmails = activePlayers.map((p: any) => (p?.email || '').toLowerCase().trim()).filter(Boolean);
          const expelledAccountIds = Array.isArray(c.dossier?.expelledAccountIds) ? c.dossier.expelledAccountIds : [];

          return {
            code: c.code,
            name: c.title || c.code,
            subtitle: c.subtitle || '',
            description: c.description || '',
            system: c.system || 'D&D 5e',
            createdAt: c.created_at || new Date().toISOString(),
            dmId: c.dm_id || dmPlayer?.id || undefined,
            dmEmail: dmPlayer?.email || undefined,
            dmName: dmPlayer?.characterName || undefined,
            dmIsPlayer: dmPlayer ? Boolean(dmPlayer.isDm) : undefined,
            activePlayerEmails,
            expelledAccountIds,
          };
        });
        this.allCampaignsCache = { data: result, timestamp: Date.now() };
        return result;
      } catch {
        return [];
      } finally {
        this.inFlightAllCampaignsFetch = null;
      }
    })();

    return this.inFlightAllCampaignsFetch;
  }

  /**
   * Persists session metadata (images, coverImage, entitiesExtracted, memorySynced) to dossier
   */
  static async saveSessionMeta(campaignCode: string, sessionId: string, meta: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !sessionId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      const sessionsMeta = dossier.sessionsMeta || {};
      sessionsMeta[sessionId] = { ...(sessionsMeta[sessionId] || {}), ...meta };
      await supabase.from('campaigns').update({
        dossier: { ...dossier, sessionsMeta },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save session meta:', err);
      return false;
    }
  }

  /**
   * Securely saves encrypted campaign AI keys to campaign dossier in Supabase
   */
  static async saveCampaignAiKeys(campaignCode: string, encryptedPayload: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier, ai_config').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      const aiConfig = camp?.ai_config || {};

      const { error } = await supabase.from('campaigns').update({
        dossier: {
          ...dossier,
          aiKeys: encryptedPayload,
        },
        ai_config: {
          ...aiConfig,
          aiKeys: encryptedPayload,
        },
        updated_at: new Date().toISOString(),
      }).eq('code', code);

      if (error) console.error('[Supabase] Error saving campaign AI keys:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save campaign AI keys:', err);
      return false;
    }
  }

  /**
   * Persists a single character bio to character_bios table with dossier backup
   */
  static async saveCharacterBio(campaignCode: string, bio: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !bio || !bio.playerId) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = characterBioModelToRow(bio, code);
      const { error } = await safeUpsert('character_bios', payload, { onConflict: 'campaign_code,player_id' });
      if (error) {
        console.warn('[Supabase] Warning saving to character_bios table:', error.message);
      }
      return !error;
    } catch (err) {
      return handleSupabaseError('Failed to save single character bio', err);
    }
  }

  /**
   * Persists character bios into separate character_bios table atomically
   */
  static async saveCharacterBios(campaignCode: string, bios: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payloads = (bios || [])
        .filter((bio) => bio && bio.playerId)
        .map((bio) => characterBioModelToRow(bio, code));

      if (payloads.length > 0) {
        const { error } = await safeUpsert('character_bios', payloads, { onConflict: 'campaign_code,player_id' });
        if (error) {
          console.warn('[Supabase] Warning bulk saving character_bios:', error.message);
          return false;
        }
      }

      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save character bios', err);
    }
  }

  /**
   * Deletes a single character bio from Supabase scoped to both campaign and player
   */
  static async deleteCharacterBio(playerId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !playerId) return false;
    try {
      let query = supabase.from('character_bios').delete().eq('player_id', playerId);
      if (campaignCode) {
        const code = campaignCode.trim().toUpperCase();
        query = query.eq('campaign_code', code);
      }
      const { error } = await query;
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Persists a single family relation into family_relations table
   */
  static async saveFamilyRelation(campaignCode: string, rel: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !rel || !rel.id) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = {
        id: rel.id,
        campaign_code: code,
        source_entity_id: rel.playerId,
        target_entity_id: rel.linkedEntityId || null,
        relationship_type: rel.relationshipType || 'family',
        description: rel.bio || '',
        is_secret: !rel.sharedWithParty,
        name: rel.name || '',
        avatar_url: rel.avatarUrl || '',
        custom_relationship_label: rel.customRelationshipLabel || '',
        title_or_role: rel.titleOrRole || '',
        generation_category: rel.generationCategory || 'same_generation',
        genealogy_role: rel.genealogyRole || '',
        side_of_family: rel.sideOfFamily || 'unspecified',
        status: rel.status || 'alive',
        second_parent_id: rel.secondParentId || null,
        other_parent_name: rel.otherParentName || '',
        linked_player_id: rel.linkedPlayerId || null,
        tags: Array.isArray(rel.tags) ? rel.tags : [],
        order_index: rel.order || 0,
        updated_at: new Date().toISOString(),
      };
      const { error } = await safeUpsert('family_relations', payload, { onConflict: 'id' });
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save single family relation:', err);
      return false;
    }
  }

  /**
   * Persists family relations into campaign dossier and standalone table
   */
  static async saveFamilyRelations(campaignCode: string, relations: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();

      // Atomic write to 'family_relations'
      const upsertPromises = (relations || []).map((rel) => {
        if (!rel || !rel.id) return Promise.resolve();
        const payload = {
          id: rel.id,
          campaign_code: code,
          source_entity_id: rel.playerId || '',
          target_entity_id: rel.linkedEntityId || rel.linkedPlayerId || '',
          relationship_type: rel.relationshipType || 'companion',
          description: rel.bio || '',
          is_secret: Boolean(rel.sharedWithParty === false),
          name: rel.name || '',
          avatar_url: rel.avatarUrl || '',
          custom_relationship_label: rel.customRelationshipLabel || '',
          title_or_role: rel.titleOrRole || '',
          generation_category: rel.generationCategory || 'same_generation',
          genealogy_role: rel.genealogyRole || '',
          side_of_family: rel.sideOfFamily || 'unspecified',
          status: rel.status || 'alive',
          second_parent_id: rel.secondParentId || '',
          other_parent_name: rel.otherParentName || '',
          linked_player_id: rel.linkedPlayerId || '',
          tags: rel.tags || [],
          order_index: rel.order || 0,
          updated_at: new Date().toISOString(),
        };
        return supabase.from('family_relations').upsert(payload, { onConflict: 'id' });
      });

      await Promise.all(upsertPromises);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save family relations:', err);
      return false;
    }
  }

  /**
   * Atomically deletes a single family relation from Supabase to prevent zombie resurrections
   */
  static async deleteFamilyRelation(relationId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !relationId) return false;
    try {
      const { error } = await supabase.from('family_relations').delete().eq('id', relationId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Persists a single world lore article to world_lore_articles table
   */
  static async saveWorldLoreArticle(campaignCode: string, art: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !art || !(art._id || art.id)) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = worldLoreArticleModelToRow(art, code);
      const { error } = await safeUpsert('world_lore_articles', payload, { onConflict: 'id' });
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save single world lore article:', err);
      return false;
    }
  }

  /**
   * Persists world lore articles into world_lore_articles table
   */
  static async saveWorldLoreArticles(campaignCode: string, articles: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim().toUpperCase();

      // Atomic write to 'world_lore_articles'
      const upsertPromises = (articles || []).map((art) => {
        if (!art || !(art._id || art.id)) return Promise.resolve();
        const payload = worldLoreArticleModelToRow(art, code);
        return supabase.from('world_lore_articles').upsert(payload, { onConflict: 'id' });
      });

      await Promise.all(upsertPromises);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save world lore articles:', err);
      return false;
    }
  }

  /**
   * Atomically deletes a single world lore article from Supabase
   */
  static async deleteWorldLoreArticle(articleId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !articleId) return false;
    try {
      const { error } = await supabase.from('world_lore_articles').delete().eq('id', articleId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Persists calendar system and lore date state into campaigns and calendars tables in Supabase
   */
  static async saveCalendar(campaignCode: string, calendar: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !calendar) return false;
    try {
      const code = campaignCode.trim().toUpperCase();

      // 1. Update campaigns table JSON
      await supabase.from('campaigns').update({
        calendar_system: calendar,
        updated_at: new Date().toISOString(),
      }).or(`code.eq.${code},code.eq.${campaignCode.trim()}`);

      // 2. Upsert to calendars relational table
      const calendarRow = {
        campaign_code: code,
        system_name: calendar.name || calendar.system_name || 'Harptos',
        months: calendar.months || [],
        current_day: calendar.currentDay || 1,
        current_month: calendar.currentMonth || 1,
        current_year: calendar.currentYear || 1492,
        events: calendar.events || [],
        updated_at: new Date().toISOString(),
      };
      try {
        await supabase.from('calendars').upsert(calendarRow, { onConflict: 'campaign_code' });
      } catch {}

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetches user preferences from Supabase public.user_preferences table
   */
  static async fetchUserPreferences(userId: string): Promise<Record<string, any> | null> {
    if (!isSupabaseConfigured() || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('user_id, theme, ai, reading, notifications, updated_at')
        .eq('user_id', userId.trim())
        .maybeSingle();

      if (error) {
        return null;
      }
      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Saves user preferences into Supabase public.user_preferences table
   */
  static async saveUserPreferences(userId: string, prefs: {
    theme?: any;
    ai?: any;
    reading?: any;
    notifications?: any;
  }): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) return false;
    try {
      const cleanId = userId.trim();
      const payload = {
        user_id: cleanId,
        theme: prefs.theme || {},
        ai: prefs.ai || {},
        reading: prefs.reading || {},
        notifications: prefs.notifications || {},
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetches Oracle chat history from Supabase public.oracle_chats table
   */
  static async fetchOracleChat(campaignCode: string, userId: string): Promise<any[] | null> {
    if (!isSupabaseConfigured() || !campaignCode || !userId) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const cleanUser = userId.trim();
      const chatId = `chat_${cleanCode}_${cleanUser}`;

      const { data, error } = await supabase
        .from('oracle_chats')
        .select('messages')
        .eq('id', chatId)
        .maybeSingle();

      if (error) {
        return null;
      }
      return Array.isArray(data?.messages) ? data.messages : null;
    } catch {
      return null;
    }
  }

  /**
   * Saves Oracle chat history into Supabase public.oracle_chats table
   */
  static async saveOracleChat(campaignCode: string, userId: string, messages: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !userId) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const cleanUser = userId.trim();
      const chatId = `chat_${cleanCode}_${cleanUser}`;
      const payload = {
        id: chatId,
        campaign_code: cleanCode,
        user_id: cleanUser,
        messages: Array.isArray(messages) ? messages : [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('oracle_chats').upsert(payload, { onConflict: 'id' });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Delete a single chapter and clean up dossier.chaptersMeta and cache
   */
  static async deleteChapter(chapterId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !chapterId) return false;
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) {
        console.warn('[Supabase] Error deleting chapter:', error.message);
      }
      if (campaignCode) {
        this.updateCachedItem(campaignCode, 'chapters', { id: chapterId }, true);
      }
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save or update a single map (~15ms)
   */
  static async saveMap(campaignCode: string, map: WorldMap): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !map) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = mapModelToRow(map, code);

      const { error } = await safeUpsert('maps', payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving map:', error);

      if (map.folderId !== undefined || map.description !== undefined) {
        this.saveMapMeta(code, map.id, { folderId: map.folderId, description: map.description }).catch(() => {});
      }

      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save map:', err);
      return false;
    }
  }

  /**
   * Bulk save all maps for a campaign
   */
  static async saveMaps(campaignCode: string, maps: WorldMap[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !Array.isArray(maps)) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payloads = maps.map((m) => mapModelToRow(m, code));
      if (payloads.length === 0) return true;

      const { error } = await safeUpsert('maps', payloads, { onConflict: 'id' });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Delete a single map and clean up dossier.mapsMeta
   */
  static async deleteMap(mapId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !mapId) return false;
    try {
      const { error } = await supabase.from('maps').delete().eq('id', mapId);
      if (campaignCode) {
        this.removeMapMeta(campaignCode, mapId).catch(() => {});
      }
      if (error) console.error('[Supabase] Error deleting map:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to delete map:', err);
      return false;
    }
  }

  /**
   * Removes session metadata (no-op as session columns live in sessions table)
   */
  static async removeSessionMeta(_campaignCode: string, _sessionId: string): Promise<boolean> {
    return true;
  }

  /**
   * Persists note metadata (no-op as note tags/images/pinned live directly in notes table)
   */
  static async saveNoteMeta(_campaignCode: string, _noteId: string, _meta: any): Promise<boolean> {
    return true;
  }

  /**
   * Removes note metadata (no-op)
   */
  static async removeNoteMeta(_campaignCode: string, _noteId: string): Promise<boolean> {
    return true;
  }

  /**
   * Removes chapter metadata (no-op as chapters live in chapters table)
   */
  static async removeChapterMeta(_campaignCode: string, _chapterId: string): Promise<boolean> {
    return true;
  }

  /**
   * Removes map metadata (no-op as maps live in maps table)
   */
  static async removeMapMeta(_campaignCode: string, _mapId: string): Promise<boolean> {
    return true;
  }

  /**
   * Save a scrapbook item (~15ms)
   */
  static async saveScrapbookItem(campaignCode: string, item: ScrapbookItem): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !item) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = scrapbookModelToRow(item, code);

      const { error } = await safeUpsert('scrapbook', payload, {
        onConflict: 'id',
      });
      if (error) console.error('[Supabase] Error saving scrapbook item:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save scrapbook item:', err);
      return false;
    }
  }

  /**
   * Delete a scrapbook item
   */
  static async deleteScrapbookItem(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('scrapbook').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save an audio log (~15ms)
   */
  static async saveAudioLog(campaignCode: string, log: AudioLog): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !log) return false;

    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = audioLogModelToRow(log, code);

      const { error } = await safeUpsert('audio_logs', payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving audio log:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save audio log:', err);
      return false;
    }
  }

  /**
   * Delete an audio log
   */
  static async deleteAudioLog(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('audio_logs').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Bulk upserts all campaign data from LocalStorage to Supabase
   */
  static async bulkUpsertCampaignData(campaignCode: string, rawCampaignData: {
    sessions?: Session[];
    chapters?: CampaignChapter[];
    entities?: Entity[];
    notes?: Note[];
    maps?: WorldMap[];
    scrapbookItems?: ScrapbookItem[];
    audioLogs?: AudioLog[];
    characterBios?: any[];
    familyRelations?: any[];
    worldLoreArticles?: any[];
  }): Promise<{ success: boolean; errors: string[]; stats: Record<string, number> }> {
    if (!isSupabaseConfigured() || !campaignCode) {
      return { success: false, errors: ['Supabase non configurato o codice campagna mancante'], stats: {} };
    }

    const code = campaignCode.trim().toUpperCase();
    const stats: Record<string, number> = {};
    const errors: string[] = [];

    // 0. Ensure the parent campaign row exists in 'campaigns' table before writing any child relational records
    try {
      const campRes = await supabase.from('campaigns').select('code').eq('code', code).maybeSingle();
      if (!campRes.data || !campRes.data.code) {
        await safeUpsert(
          'campaigns',
          {
            code,
            title: `Campagna ${code}`,
            system: 'D&D 5e',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'code' }
        );
      }
    } catch (campInitErr) {
      console.warn('[Supabase Bulk] Warning initializing parent campaign:', campInitErr);
    }

    // Sanitize heavy base64 media payloads to prevent PostgreSQL write timeout (code 57014)
    const data = sanitizeHeavyPayload(rawCampaignData);

    // 1. Sessions
    if (Array.isArray(data.sessions) && data.sessions.length > 0) {
      try {
        const payloads = data.sessions
          .filter((s: any) => s && (s._id || s.id))
          .map((session: any) => sessionModelToRow(session, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('sessions', chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        stats.sessions = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving sessions:', err);
        errors.push(`Sessioni: ${err.message || err}`);
      }
    }

    // 2. Chapters
    if (Array.isArray(data.chapters) && data.chapters.length > 0) {
      try {
        const payloads = data.chapters
          .filter((c: any) => c && c.id)
          .map((chapter: any) => chapterModelToRow(chapter, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('chapters', chunk, {
            onConflict: 'id',
          });
          if (error) throw error;
        }
        stats.chapters = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving chapters:', err);
        errors.push(`Capitoli: ${err.message || err}`);
      }
    }

    // 3. Entities
    if (Array.isArray(data.entities) && data.entities.length > 0) {
      try {
        const payloads = data.entities
          .filter((e: any) => e && (e._id || e.id))
          .map((entity: any) => entityModelToRow(entity, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('entities', chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        stats.entities = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving entities:', err);
        errors.push(`Codex/Entità: ${err.message || err}`);
      }
    }

    // 4. Notes
    if (Array.isArray(data.notes) && data.notes.length > 0) {
      try {
        const payloads = data.notes
          .filter((n: any) => n && (n._id || n.id))
          .map((note: any) => noteModelToRow(note, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('notes', chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        stats.notes = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving notes:', err);
        errors.push(`Note: ${err.message || err}`);
      }
    }

    // 5. Maps
    if (Array.isArray(data.maps) && data.maps.length > 0) {
      try {
        const payloads = data.maps
          .filter((m: any) => m && m.id)
          .map((map: any) => mapModelToRow(map, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('maps', chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        stats.maps = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving maps:', err);
        errors.push(`Mappe: ${err.message || err}`);
      }
    }

    // 6. Scrapbook
    if (Array.isArray(data.scrapbookItems) && data.scrapbookItems.length > 0) {
      try {
        const payloads = data.scrapbookItems
          .filter((s: any) => s && s.id)
          .map((item: any) => scrapbookModelToRow(item, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('scrapbook', chunk, {
            onConflict: 'id',
          });
          if (error) throw error;
        }
        stats.scrapbook = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving scrapbook:', err);
        errors.push(`Scrapbook: ${err.message || err}`);
      }
    }

    // 7. Audio Logs
    if (Array.isArray(data.audioLogs) && data.audioLogs.length > 0) {
      try {
        const payloads = data.audioLogs
          .filter((a: any) => a && a.id)
          .map((log: any) => audioLogModelToRow(log, code));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await safeUpsert('audio_logs', chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        stats.audioLogs = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving audio logs:', err);
        errors.push(`Diari Audio: ${err.message || err}`);
      }
    }

    // 8. Character Bios
    if (Array.isArray(data.characterBios) && data.characterBios.length > 0) {
      try {
        const payloads = data.characterBios
          .filter((bio: any) => bio && bio.playerId)
          .map((bio: any) => characterBioModelToRow(bio, code));

        const { error } = await safeUpsert('character_bios', payloads, { onConflict: 'campaign_code,player_id' });
        if (error) throw error;
        stats.characterBios = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving character bios:', err);
        errors.push(`Biografie: ${err.message || err}`);
      }
    }

    // 9. Family Relations
    if (Array.isArray(data.familyRelations) && data.familyRelations.length > 0) {
      try {
        const payloads = data.familyRelations.map((rel) => ({
          id: rel.id,
          campaign_code: code,
          source_entity_id: rel.playerId || '',
          target_entity_id: rel.linkedEntityId || rel.linkedPlayerId || '',
          relationship_type: rel.relationshipType || 'companion',
          description: rel.bio || '',
          is_secret: Boolean(rel.sharedWithParty === false),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await safeUpsert('family_relations', payloads, { onConflict: 'id' });
        if (error) throw error;
        stats.familyRelations = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving family relations:', err);
        errors.push(`Relazioni: ${err.message || err}`);
      }
    }

    // 10. World Lore Articles
    if (Array.isArray(data.worldLoreArticles) && data.worldLoreArticles.length > 0) {
      try {
        const payloads = data.worldLoreArticles
          .filter((art: any) => art && (art._id || art.id))
          .map((art: any) => worldLoreArticleModelToRow(art, code));

        const { error } = await safeUpsert('world_lore_articles', payloads, { onConflict: 'id' });
        if (error) throw error;
        stats.worldLoreArticles = payloads.length;
      } catch (err: any) {
        console.error('[Supabase] Bulk lore articles error:', err);
        errors.push(`Articoli Lore: ${err.message || err}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      stats,
    };
  }

  private static activeRealtimeChannel: any = null;

  /**
   * Subscribes to live changes via Supabase Realtime WebSockets for the active campaign
   */
  static subscribeCampaignRealtime(
    campaignCode: string,
    callbacks: {
      onSessionsChange?: (payload: any) => void;
      onChaptersChange?: (payload: any) => void;
      onNotesChange?: (payload: any) => void;
      onEntitiesChange?: (payload: any) => void;
      onBiosChange?: (payload: any) => void;
      onRelationsChange?: (payload: any) => void;
      onLoreChange?: (payload: any) => void;
      onMapsChange?: (payload: any) => void;
      onScrapbookChange?: (payload: any) => void;
      onAudioLogsChange?: (payload: any) => void;
      onCampaignChange?: (payload: any) => void;
    }
  ): () => void {
    if (!isSupabaseConfigured() || !campaignCode || campaignCode === '__NONE__') {
      return () => {};
    }

    const code = campaignCode.trim();
    const cleanCode = code.toUpperCase();

    // Clean up previous channel if any
    if (this.activeRealtimeChannel) {
      try {
        supabase.removeChannel(this.activeRealtimeChannel);
      } catch {}
      this.activeRealtimeChannel = null;
    }

    try {
      const channel = supabase.channel(`chronicle_live_${cleanCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sessions', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onSessionsChange) callbacks.onSessionsChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chapters', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onChaptersChange) callbacks.onChaptersChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onNotesChange) callbacks.onNotesChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'entities', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onEntitiesChange) callbacks.onEntitiesChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'character_bios', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onBiosChange) callbacks.onBiosChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_relations', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onRelationsChange) callbacks.onRelationsChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'world_lore_articles', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onLoreChange) callbacks.onLoreChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maps', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onMapsChange) callbacks.onMapsChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'scrapbook', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onScrapbookChange) callbacks.onScrapbookChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'audio_logs', filter: `campaign_code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onAudioLogsChange) callbacks.onAudioLogsChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `code=eq.${cleanCode}` },
          (payload) => {
            if (callbacks.onCampaignChange) callbacks.onCampaignChange(payload);
          }
        )
        .subscribe((status) => {
          // Connected to live channel
        });

      this.activeRealtimeChannel = channel;

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
        if (this.activeRealtimeChannel === channel) {
          this.activeRealtimeChannel = null;
        }
      };
    } catch (e) {
      console.warn('[Supabase Realtime] Setup error:', e);
      return () => {};
    }
  }
}
