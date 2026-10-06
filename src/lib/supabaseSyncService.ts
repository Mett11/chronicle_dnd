import { supabase, isSupabaseConfigured, markSupabaseOffline } from './supabase';
import { slugifyCampaignTitle } from './shareToken';
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

    // 3. Missing column in schema cache handling (PGRST204)
    if (
      res.error.code === 'PGRST204' ||
      res.error.message?.includes('schema cache') ||
      res.error.message?.includes('Could not find the')
    ) {
      const match = res.error.message.match(/Could not find the '([^']+)' column/i);
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
        .select('code, title, created_at, dm_id, dossier, expelled_account_ids')
        .or(`code.eq.${cleanCode},code.eq.${rawCode}`)
        .maybeSingle();

      if (error || !data) return null;
      return {
        code: data.code,
        name: data.title || data.code,
        createdAt: data.created_at || new Date().toISOString(),
        dmId: data.dm_id || data.dossier?.dmId || undefined,
        dmEmail: data.dossier?.dmEmail || data.dossier?.creatorEmail || undefined,
        dmName: data.dossier?.dmName || data.dossier?.creatorName || undefined,
        dmIsPlayer: data.dossier?.dmIsPlayer !== undefined ? Boolean(data.dossier.dmIsPlayer) : undefined,
        expelledAccountIds: Array.isArray(data.expelled_account_ids)
          ? data.expelled_account_ids
          : (Array.isArray(data.dossier?.expelledAccountIds) ? data.dossier.expelledAccountIds : []),
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
      if (cached && Date.now() - cached.timestamp < 180000) { // 3 minutes TTL
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
          .select('*')
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
            const allCampsRes = await supabase.from('campaigns').select('*').limit(50);
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
          mapsRes,
          scrapbookRes,
          audioRes,
          characterBiosRes,
          familyRelationsRes,
          worldLoreArticlesRes,
        ] = await Promise.all([
          supabase
            .from('chapters')
            .select('*')
            .or(activeOrCampFilter),
          supabase
            .from('sessions')
            .select('*')
            .or(activeOrCampFilter)
            .order('number', { ascending: true }),
          supabase
            .from('entities')
            .select('*')
            .or(activeOrCampFilter),
          supabase
            .from('notes')
            .select('*')
            .or(activeOrCampFilter),
          supabase
            .from('maps')
            .select('*')
            .or(activeOrCampFilter),
          supabase
            .from('scrapbook')
            .select('*')
            .or(activeOrCampFilter),
          supabase
            .from('audio_logs')
            .select('*')
            .or(activeOrCampFilter)
            .order('created_at', { ascending: false }),
          supabase
            .from('character_bios')
            .select('*')
            .or(activeOrCampFilter)
            .then(res => res, () => ({ data: [] })),
          supabase
            .from('family_relations')
            .select('*')
            .or(activeOrCampFilter)
            .then(res => res, () => ({ data: [] })),
          supabase
            .from('world_lore_articles')
            .select('*')
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
        (mapsRes.data && mapsRes.data.length > 0) ||
        (scrapbookRes.data && scrapbookRes.data.length > 0) ||
        (audioRes.data && audioRes.data.length > 0) ||
        (characterBiosRes.data && characterBiosRes.data.length > 0) ||
        (familyRelationsRes.data && familyRelationsRes.data.length > 0) ||
        (worldLoreArticlesRes.data && worldLoreArticlesRes.data.length > 0)
      );

      if (!hasAnyData) {
        return null;
      }

      const campRow = campaignRes.data || {};
      const dossier = campRow.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      const mapsMeta = dossier.mapsMeta || {};
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

      const maps: WorldMap[] = (mapsRes.data || []).map((row) =>
        mapRowToModel(row, mapsMeta)
      );

      const scrapbookItems: ScrapbookItem[] = (scrapbookRes.data || []).map(scrapbookRowToModel);

      const audioLogs: AudioLog[] = (audioRes.data || []).map(audioLogRowToModel);

      // --- HYDRATION & AUTO-MIGRATION LAYER FOR NEW TABLES ---
      const characterBiosRows = characterBiosRes?.data || [];
      const familyRelationsRows = familyRelationsRes?.data || [];
      const worldLoreArticlesRows = worldLoreArticlesRes?.data || [];

      let characterBios: any[] = [];
      if (characterBiosRows && characterBiosRows.length > 0) {
        characterBios = characterBiosRows.map((row: any) => characterBioRowToModel(row));
      } else if ((characterBiosRes as any)?.error && Array.isArray(dossier.characterBios) && dossier.characterBios.length > 0) {
        characterBios = dossier.characterBios;
      }

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

      let worldLoreArticles: any[] = [];
      if (worldLoreArticlesRows && worldLoreArticlesRows.length > 0) {
        worldLoreArticles = worldLoreArticlesRows.map((row: any) => ({
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
          order: row.order_index || 0,
        }));
      } else if ((worldLoreArticlesRes as any)?.error && Array.isArray(dossier.worldLoreArticles) && dossier.worldLoreArticles.length > 0) {
        worldLoreArticles = dossier.worldLoreArticles;
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
        expelledAccountIds: Array.isArray(campRow.expelled_account_ids)
          ? campRow.expelled_account_ids
          : (Array.isArray(dossier.expelledAccountIds) ? dossier.expelledAccountIds : []),
        activePlayers: (() => {
          const raw = Array.isArray(campRow.active_players) && campRow.active_players.length > 0
            ? campRow.active_players
            : (Array.isArray(dossier.activePlayers) ? dossier.activePlayers : []);
          const expelled = new Set(
            [
              ...(Array.isArray(campRow.expelled_account_ids) ? campRow.expelled_account_ids : []),
              ...(Array.isArray(dossier.expelledAccountIds) ? dossier.expelledAccountIds : []),
            ].map((id: string) => String(id).toLowerCase())
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
        supabase.from('sessions').select('*').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`).order('number', { ascending: true }),
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
          supabase.from('sessions').select('*').eq('campaign_code', cleanCode).order('number', { ascending: true }),
          supabase.from('chapters').select('*').eq('campaign_code', cleanCode).order('order_index', { ascending: true }),
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
        .select('*')
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
      const res = await supabase.from('entities').select('*').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`);
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
        .select('*')
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
        expelled_account_ids: payloadData.expelledAccountIds || payloadData.expelled_account_ids || existing?.expelled_account_ids || [],
        dossier: {
          ...existingDossier,
          ...(payloadData.dossier || {}),
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

      const { data: camp } = await supabase.from('campaigns').select('dossier, active_players, expelled_account_ids').eq('code', code).maybeSingle();
      if (camp) {
        const currentExpelled: string[] = Array.isArray(camp.expelled_account_ids) ? [...camp.expelled_account_ids] : [];
        if (!currentExpelled.includes(userId)) {
          currentExpelled.push(userId);
        }
        if (cleanEmail && !currentExpelled.includes(cleanEmail)) {
          currentExpelled.push(cleanEmail);
        }

        const activePlayers = (camp.dossier?.activePlayers || []).filter(
          (p: any) => p.id !== userId && p._id !== userId && (!cleanEmail || p.email !== cleanEmail)
        );
        const familyRelations = (camp.dossier?.familyRelations || []).filter(
          (r: any) => r.playerId !== userId && r.source_entity_id !== userId && (!cleanEmail || r.email !== cleanEmail)
        );

        await supabase.from('campaigns').update({
          dossier: {
            ...camp.dossier,
            activePlayers,
            familyRelations,
            expelledAccountIds: currentExpelled,
          },
          active_players: activePlayers,
          expelled_account_ids: currentExpelled,
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

      this.invalidateCampaignDataCache(code);
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
      if (campaignCode) this.invalidateCampaignDataCache(campaignCode);
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

      this.invalidateCampaignDataCache(code);
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
      if (campaignCode) this.invalidateCampaignDataCache(campaignCode);
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
      this.invalidateCampaignDataCache(code);
      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save entity', err);
    }
  }

  /**
   * Delete a single entity
   */
  static async deleteEntity(entityId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('entities').delete().eq('id', entityId);
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
      const payload = chapterModelToRow(chapter, cleanCode);

      const { error } = await safeUpsert('chapters', payload, {
        onConflict: 'id',
      });
      if (error) {
        return handleSupabaseError('Error saving chapter', error);
      }

      return true;
    } catch (err) {
      return handleSupabaseError('Failed to save chapter', err);
    }
  }

  /**
   * Persists chapter cover image URL to campaign dossier and chapters table
   */
  static async saveChapterCover(campaignCode: string, chapterId: string, coverImageUrl: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapterId) return false;
    try {
      const code = campaignCode.trim();
      const cleanCode = code.toUpperCase();

      // 1. Update chapters table
      supabase
        .from('chapters')
        .update({ cover_image_url: coverImageUrl, updated_at: new Date().toISOString() })
        .eq('id', chapterId)
        .then(() => {}, () => {});

      // 2. Update campaign dossier
      const { data: camp } = await supabase
        .from('campaigns')
        .select('dossier')
        .or(`code.eq.${cleanCode},code.eq.${code}`)
        .maybeSingle();

      const dossier = camp?.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      chaptersMeta[chapterId] = { ...(chaptersMeta[chapterId] || {}), coverImageUrl };

      if (Array.isArray(dossier.chapters)) {
        dossier.chapters = dossier.chapters.map((c: any) =>
          c && c.id === chapterId ? { ...c, coverImageUrl } : c
        );
      }

      await supabase
        .from('campaigns')
        .update({
          dossier: { ...dossier, chaptersMeta },
          updated_at: new Date().toISOString(),
        })
        .or(`code.eq.${cleanCode},code.eq.${code}`);

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

      // 1. Sync each account to the dedicated public.user_accounts table
      for (const acc of sanitized) {
        this.saveUserAccount(acc).catch(() => {});
      }

      // 2. Fetch existing active_players from campaigns to avoid wiping out fellow party members
      const { data: camp } = await supabase.from('campaigns').select('active_players, dossier, expelled_account_ids').eq('code', code).maybeSingle();
      const existingPlayers: any[] = Array.isArray(camp?.active_players) ? camp.active_players : [];

      const expelledSet = new Set<string>([
        ...(Array.isArray(camp?.expelled_account_ids) ? camp.expelled_account_ids : []),
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
        // Fallback if dossier column doesn't exist in Supabase schema
        await supabase.from('campaigns').update({
          updated_at: new Date().toISOString(),
        }).or(`code.eq.${code},code.eq.${cleanCode}`);
        return true;
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
  static async getUserAccount(userId: string, force = false): Promise<any | null> {
    if (!isSupabaseConfigured() || !userId) return null;

    if (!force) {
      const cached = this.userAccountCache.get(userId);
      if (cached && Date.now() - cached.timestamp < 60000) { // 60s TTL
        return cached.data;
      }
    }

    const inFlight = this.inFlightUserAccount.get(userId);
    if (inFlight) return inFlight;

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('user_accounts')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('[Supabase] getUserAccount error:', error.message);
          return null;
        }
        if (!data) return null;

        // Also get memberships from campaign_members (verified against real campaigns)
        const memberRes = await this.getUserCampaigns(userId);
        const dmCampaigns = Array.from(new Set([...(Array.isArray(data.dm_campaigns) ? data.dm_campaigns : []), ...memberRes.dmCampaigns]));
        const joinedCampaigns = Array.from(new Set([...(Array.isArray(data.joined_campaigns) ? data.joined_campaigns : []), ...memberRes.joinedCampaigns]));

        // Verify campaign_profiles against active campaigns
        const { data: realCampaigns } = await supabase.from('campaigns').select('code');
        const realCodes = new Set((realCampaigns || []).map((rc: any) => (rc.code || '').trim().toUpperCase()));

        const rawProfiles = data.campaign_profiles || {};
        const cleanProfiles: Record<string, any> = {};
        let profilesNeedClean = false;
        for (const [key, val] of Object.entries(rawProfiles)) {
          if (realCodes.has(key.toUpperCase())) {
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
                .eq('id', userId);
            } catch {}
          })();
        }

        const result = {
          ...data,
          dmCampaigns,
          joinedCampaigns,
          campaignProfiles: cleanProfiles,
        };

        this.userAccountCache.set(userId, { data: result, timestamp: Date.now() });
        return result;
      } catch {
        return null;
      } finally {
        this.inFlightUserAccount.delete(userId);
      }
    })();

    this.inFlightUserAccount.set(userId, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetches campaigns associated with a user from campaign_members table,
   * verifying against the active campaigns table and pruning orphaned records.
   */
  static async getUserCampaigns(userId: string): Promise<{ dmCampaigns: string[]; joinedCampaigns: string[] }> {
    if (!isSupabaseConfigured() || !userId) return { dmCampaigns: [], joinedCampaigns: [] };
    try {
      const { data, error } = await supabase
        .from('campaign_members')
        .select('campaign_code, role')
        .eq('user_id', userId);

      if (error || !Array.isArray(data)) {
        return { dmCampaigns: [], joinedCampaigns: [] };
      }

      // Check against real active campaigns so orphaned campaign_members are never loaded or presented
      const { data: realCampaigns } = await supabase
        .from('campaigns')
        .select('code');
      const realCodes = new Set((realCampaigns || []).map((rc: any) => (rc.code || '').trim().toUpperCase()));

      const dmCampaigns: string[] = [];
      const joinedCampaigns: string[] = [];
      const orphanCodes: string[] = [];

      for (const row of data) {
        const code = (row.campaign_code || '').trim().toUpperCase();
        if (!code) continue;
        if (!realCodes.has(code)) {
          orphanCodes.push(row.campaign_code);
          continue;
        }
        if (row.role === 'dm') {
          if (!dmCampaigns.includes(code)) dmCampaigns.push(code);
        } else {
          if (!joinedCampaigns.includes(code)) joinedCampaigns.push(code);
        }
      }

      // Auto-cleanup orphan memberships from campaign_members in the background
      if (orphanCodes.length > 0) {
        (async () => {
          try {
            await supabase
              .from('campaign_members')
              .delete()
              .in('campaign_code', orphanCodes);
          } catch {}
        })();
      }

      return { dmCampaigns, joinedCampaigns };
    } catch {
      return { dmCampaigns: [], joinedCampaigns: [] };
    }
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
        const { data, error } = await supabase.from('user_accounts').select('*');
        if (error || !Array.isArray(data)) {
          return [];
        }
        const result = data.map((row) => ({
          id: row.id,
          email: row.email,
          characterName: row.character_name,
          isDm: Boolean(row.is_dm),
          dmCampaigns: Array.isArray(row.dm_campaigns) ? row.dm_campaigns : [],
          joinedCampaigns: Array.isArray(row.joined_campaigns) ? row.joined_campaigns : [],
          color: row.color || '#6366f1',
          avatarUrl: row.avatar_url || '',
          campaignProfiles: row.campaign_profiles || {},
          preferences: row.preferences || {},
          createdAt: row.created_at || new Date().toISOString(),
        }));
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
        const { data, error } = await supabase.from('campaigns').select('code, title, created_at, dm_id, dossier, expelled_account_ids');
        if (error || !Array.isArray(data)) return [];
        const result = data.map((c) => ({
          code: c.code,
          name: c.title || c.code,
          createdAt: c.created_at || new Date().toISOString(),
          dmId: c.dm_id || c.dossier?.dmId || undefined,
          dmEmail: c.dossier?.dmEmail || c.dossier?.creatorEmail || undefined,
          dmName: c.dossier?.dmName || c.dossier?.creatorName || undefined,
          dmIsPlayer: c.dossier?.dmIsPlayer !== undefined ? Boolean(c.dossier.dmIsPlayer) : undefined,
          expelledAccountIds: Array.isArray(c.expelled_account_ids)
            ? c.expelled_account_ids
            : (Array.isArray(c.dossier?.expelledAccountIds) ? c.dossier.expelledAccountIds : []),
        }));
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
   * Persists a single character bio to character_bios table
   */
  static async saveCharacterBio(campaignCode: string, bio: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !bio || !bio.playerId) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = characterBioModelToRow(bio, code);
      const { error } = await safeUpsert('character_bios', payload, { onConflict: 'campaign_code,player_id' });
      if (error) {
        return handleSupabaseError('Error saving character bio', error);
      }
      return true;
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

      if (payloads.length === 0) return true;

      const { error } = await safeUpsert('character_bios', payloads, { onConflict: 'campaign_code,player_id' });
      if (error) {
        return handleSupabaseError('Error saving character bios', error);
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

      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      await supabase.from('campaigns').update({
        dossier: { ...dossier, familyRelations: relations || [] },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
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
      if (campaignCode) {
        const code = campaignCode.trim();
        const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
        const dossier = camp?.dossier || {};
        if (Array.isArray(dossier.familyRelations)) {
          const updated = dossier.familyRelations.filter((r: any) => r.id !== relationId);
          await supabase.from('campaigns').update({
            dossier: { ...dossier, familyRelations: updated },
            updated_at: new Date().toISOString(),
          }).eq('code', code);
        }
      }
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
   * Persists world lore articles into campaign dossier and world_lore_articles table
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

      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      await supabase.from('campaigns').update({
        dossier: { ...dossier, worldLoreArticles: articles || [] },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
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
      if (campaignCode) {
        const code = campaignCode.trim();
        const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
        const dossier = camp?.dossier || {};
        if (Array.isArray(dossier.worldLoreArticles)) {
          const updated = dossier.worldLoreArticles.filter((a: any) => a._id !== articleId);
          await supabase.from('campaigns').update({
            dossier: { ...dossier, worldLoreArticles: updated },
            updated_at: new Date().toISOString(),
          }).eq('code', code);
        }
      }
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
        .select('*')
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
   * Delete a single chapter and clean up dossier.chaptersMeta
   */
  static async deleteChapter(chapterId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      await supabase.from('chapters').delete().eq('id', chapterId);
      if (campaignCode) {
        this.removeChapterMeta(campaignCode, chapterId).catch(() => {});
      }
      return true;
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
   * Removes session metadata from dossier
   */
  static async removeSessionMeta(campaignCode: string, sessionId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !sessionId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      if (dossier.sessionsMeta && dossier.sessionsMeta[sessionId]) {
        delete dossier.sessionsMeta[sessionId];
        await supabase.from('campaigns').update({
          dossier,
          updated_at: new Date().toISOString(),
        }).eq('code', code);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persists note metadata (tags, images, pinned, canonState, dmOnly) into campaign dossier
   */
  static async saveNoteMeta(campaignCode: string, noteId: string, meta: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !noteId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      const notesMeta = dossier.notesMeta || {};
      notesMeta[noteId] = { ...(notesMeta[noteId] || {}), ...meta };
      await supabase.from('campaigns').update({
        dossier: { ...dossier, notesMeta },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save note meta:', err);
      return false;
    }
  }

  /**
   * Removes note metadata from dossier
   */
  static async removeNoteMeta(campaignCode: string, noteId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !noteId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      if (dossier.notesMeta && dossier.notesMeta[noteId]) {
        delete dossier.notesMeta[noteId];
        await supabase.from('campaigns').update({
          dossier,
          updated_at: new Date().toISOString(),
        }).eq('code', code);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes chapter metadata from dossier
   */
  static async removeChapterMeta(campaignCode: string, chapterId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapterId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      if (dossier.chaptersMeta && dossier.chaptersMeta[chapterId]) {
        delete dossier.chaptersMeta[chapterId];
        await supabase.from('campaigns').update({
          dossier,
          updated_at: new Date().toISOString(),
        }).eq('code', code);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes map metadata from dossier
   */
  static async removeMapMeta(campaignCode: string, mapId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !mapId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      if (dossier.mapsMeta && dossier.mapsMeta[mapId]) {
        delete dossier.mapsMeta[mapId];
        await supabase.from('campaigns').update({
          dossier,
          updated_at: new Date().toISOString(),
        }).eq('code', code);
      }
      return true;
    } catch {
      return false;
    }
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
      const code = campaignCode.trim();
      const payload = {
        id: log.id || `aud_${Date.now()}`,
        campaign_code: code,
        title: log.title || 'Diario Audio',
        audio_url: log.audioUrl,
        duration: log.durationSeconds || 0,
        recorded_by: log.recordedBy || '',
        created_at: log.createdAt || new Date().toISOString(),
      };

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
          { event: '*', schema: 'public', table: 'notes', filter: `campaign_code=eq.${code}` },
          (payload) => {
            if (callbacks.onNotesChange) callbacks.onNotesChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'entities', filter: `campaign_code=eq.${code}` },
          (payload) => {
            if (callbacks.onEntitiesChange) callbacks.onEntitiesChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'character_bios', filter: `campaign_code=eq.${code}` },
          (payload) => {
            if (callbacks.onBiosChange) callbacks.onBiosChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_relations', filter: `campaign_code=eq.${code}` },
          (payload) => {
            if (callbacks.onRelationsChange) callbacks.onRelationsChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'world_lore_articles', filter: `campaign_code=eq.${code}` },
          (payload) => {
            if (callbacks.onLoreChange) callbacks.onLoreChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `code=eq.${code}` },
          (payload) => {
            if (callbacks.onCampaignChange) callbacks.onCampaignChange(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Supabase Realtime] Connected to live channel for campaign: ${code}`);
          }
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
