import { supabase, isSupabaseConfigured, markSupabaseOffline } from './supabase';
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
    // If it's a giant base64 image string
    if (obj.length > 100000 && (obj.startsWith('data:') || obj.includes(';base64,'))) {
      return '[Immagine rimossa per prevenire timeout del database]' as any;
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

  /**
   * Fetches all campaign relational data from Supabase in parallel
   */
  static async fetchCampaignData(campaignCode: string): Promise<Record<string, any> | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;

    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const rawCode = campaignCode.trim();

      const [
        campaignRes,
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
          .from('campaigns')
          .select('*')
          .or(`code.eq.${cleanCode},code.eq.${rawCode}`)
          .maybeSingle(),
        supabase
          .from('chapters')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`)
          .order('order_index', { ascending: true }),
        supabase
          .from('sessions')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`)
          .order('number', { ascending: true }),
        supabase
          .from('entities')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`),
        supabase
          .from('notes')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('maps')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`),
        supabase
          .from('scrapbook')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('audio_logs')
          .select('*')
          .or(`campaign_code.eq.${cleanCode},campaign_code.eq.${rawCode}`)
          .order('created_at', { ascending: false }),
        // Standard safe reads for newly added standalone tables
        supabase
          .from('character_bios')
          .select('*')
          .eq('campaign_code', cleanCode)
          .then(res => res, () => ({ data: [] })),
        supabase
          .from('family_relations')
          .select('*')
          .eq('campaign_code', cleanCode)
          .then(res => res, () => ({ data: [] })),
        supabase
          .from('world_lore_articles')
          .select('*')
          .eq('campaign_code', cleanCode)
          .then(res => res, () => ({ data: [] })),
      ]);

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
        characterBios = characterBiosRows.map((row: any) => ({
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
          timelineMemories: Array.isArray(row.timeline_memories) ? row.timeline_memories : [],
          evolvingBeliefs: Array.isArray(row.evolving_beliefs) ? row.evolving_beliefs : [],
          interPartyRelations: row.inter_party_relations && typeof row.inter_party_relations === 'object' ? row.inter_party_relations : {},
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
          knownLoreBites: Array.isArray(row.known_lore_bites)
            ? row.known_lore_bites
            : (Array.isArray(row.extra_data?.knownLoreBites) ? row.extra_data.knownLoreBites : []),
          privacySettings: row.privacy_settings || row.extra_data?.privacySettings || {},
          updatedAt: row.updated_at || new Date().toISOString(),
        }));
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

      return {
        campaignCode: campRow.code || cleanCode,
        title: campRow.title || cleanCode,
        subtitle: campRow.subtitle || '',
        description: campRow.description || '',
        system: campRow.system || 'D&D 5e',
        dmId: campRow.dm_id || '',
        calendarSystem: campRow.calendar_system || {},
        aiConfig: campRow.ai_config || {},
        activePlayers: Array.isArray(campRow.active_players) && campRow.active_players.length > 0
          ? campRow.active_players
          : (Array.isArray(dossier.activePlayers) ? dossier.activePlayers : []),
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
    } catch (err) {
      handleSupabaseError('Failed to fetch campaign data', err);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Calendar & current storyline dates
   */
  static async fetchCalendarOnly(campaignCode: string): Promise<{ calendar?: any; sessions?: Session[] } | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
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
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const [campRes, sessionsRes, chaptersRes] = await Promise.all([
        supabase.from('campaigns').select('dossier').or(`code.eq.${cleanCode},code.eq.${campaignCode.trim()}`).maybeSingle(),
        supabase.from('sessions').select('*').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`).order('number', { ascending: true }),
        supabase.from('chapters').select('*').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`).order('order_index', { ascending: true }),
      ]);

      if (sessionsRes.error || chaptersRes.error) {
        console.warn('[Supabase] Warning in fetchSessionsOnly:', sessionsRes.error?.message, chaptersRes.error?.message);
        return null;
      }

      const dossier = campRes.data?.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      const sessionsMeta = dossier.sessionsMeta || {};

      const chapters: CampaignChapter[] = (chaptersRes.data || []).map((row: any) =>
        chapterRowToModel(row, chaptersMeta)
      );
      const sessions: Session[] = (sessionsRes.data || []).map((row: any) =>
        sessionRowToModel(row, sessionsMeta)
      );

      return { sessions, chapters };
    } catch (e) {
      console.warn('[Supabase] fetchSessionsOnly error:', e);
      return null;
    }
  }

  /**
   * Granular On-Demand Fetch: Notes & Clarifications
   */
  static async fetchNotesOnly(campaignCode: string): Promise<Note[] | null> {
    if (!isSupabaseConfigured() || !campaignCode) return null;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const [campRes, notesRes] = await Promise.all([
        supabase.from('campaigns').select('dossier').or(`code.eq.${cleanCode},code.eq.${campaignCode.trim()}`).maybeSingle(),
        supabase.from('notes').select('*').or(`campaign_code.eq.${cleanCode},campaign_code.eq.${campaignCode.trim()}`).order('created_at', { ascending: false }),
      ]);

      if (notesRes.error) {
        console.warn('[Supabase] Warning reading notes in fetchNotesOnly:', notesRes.error.message);
        return null;
      }

      const dossier = campRes.data?.dossier || {};
      const notesMeta = dossier.notesMeta || {};

      return (notesRes.data || []).map((row: any) =>
        noteRowToModel(row, notesMeta)
      );
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
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
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
  static async saveCampaign(campaignCode: string, data: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;

    try {
      const code = campaignCode.trim();
      const cleanCode = code.toUpperCase();

      // Read existing campaign first to merge existing columns
      const { data: existing } = await supabase
        .from('campaigns')
        .select('*')
        .or(`code.eq.${cleanCode},code.eq.${code}`)
        .maybeSingle();

      const existingDossier = existing?.dossier || data.dossier || {};
      const payload = {
        id: cleanCode,
        code: cleanCode,
        title: data.title !== undefined ? data.title : existing?.title || 'Nuova Campagna',
        subtitle: data.subtitle !== undefined ? data.subtitle : existing?.subtitle || '',
        description: data.description !== undefined ? data.description : existing?.description || '',
        system: data.system !== undefined ? data.system : existing?.system || 'D&D 5e',
        dm_id: data.dmId !== undefined ? data.dmId : existing?.dm_id || '',
        calendar_system: data.calendarSystem !== undefined ? data.calendarSystem : existing?.calendar_system || {},
        ai_config: data.aiConfig !== undefined ? data.aiConfig : existing?.ai_config || {},
        active_players: data.activePlayers !== undefined ? data.activePlayers : existing?.active_players || [],
        dossier: {
          ...existingDossier,
          ...(data.dossier || {}),
          characterBios: data.characterBios || existingDossier.characterBios || [],
          familyRelations: data.familyRelations || existingDossier.familyRelations || [],
          worldLoreArticles: data.worldLoreArticles || existingDossier.worldLoreArticles || [],
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('campaigns').upsert(payload, { onConflict: 'code' });
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
   * Joins a user to campaign_members table (server-authoritative membership)
   */
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
   * Leaves or removes a member from campaign_members
   */
  static async removeCampaignMember(campaignCode: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !userId) return false;
    try {
      const cleanCode = campaignCode.trim().toUpperCase();
      const { error } = await supabase
        .from('campaign_members')
        .delete()
        .eq('campaign_code', cleanCode)
        .eq('user_id', userId);
      return !error;
    } catch {
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

      const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving session', error);

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

      const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'id' });
      if (error) return handleSupabaseError('Error saving note', error);

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
      const code = campaignCode.trim();
      const entityType = entity.type || (entity as any).category || 'npc';
      const rawImages = Array.isArray(entity.images)
        ? entity.images
        : ((entity as any).imageUrl ? [(entity as any).imageUrl] : []);

      // Avoid packing giant base64 payloads (>300KB) into JSON columns that trigger Postgres statement timeout (code 57014)
      const cleanImages = rawImages.map((img) =>
        typeof img === 'string' && img.length > 300000 ? img.slice(0, 100) : img
      );
      const primaryImageUrl =
        typeof (entity as any).imageUrl === 'string' && (entity as any).imageUrl.length < 300000
          ? (entity as any).imageUrl
          : cleanImages[0] || '';

      const { _id, name, type, category, description, imageUrl, status, ...restAttributes } = entity as any;
      const attributes = {
        ...restAttributes,
        images: cleanImages,
        progressNote: entity.progressNote || '',
        aliases: entity.aliases || [],
        aiConfig: entity.aiConfig || undefined,
        location: entity.location || undefined,
        mapId: entity.mapId || undefined,
        pinId: entity.pinId || undefined,
      };

      const payload = {
        id: _id || `ent_${Date.now()}`,
        campaign_code: code,
        name: name || 'Senza Nome',
        type: entityType,
        description: description || '',
        image_url: primaryImageUrl,
        status: status || 'alive',
        attributes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('entities').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('[Supabase] Warning/error saving entity:', error.message || error);
      return !error;
    } catch (err) {
      console.warn('[Supabase] Failed to save entity (falling back to local store):', err);
      return false;
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

      const { error } = await supabase.from('chapters').upsert(payload, { onConflict: 'id' });
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
      const { data: camp } = await supabase.from('campaigns').select('active_players, dossier').eq('code', code).maybeSingle();
      const existingPlayers: any[] = Array.isArray(camp?.active_players) ? camp.active_players : [];

      // Non-destructive merge
      const playerMap = new Map<string, any>();
      existingPlayers.forEach((p) => {
        if (p && p.id) playerMap.set(p.id, p);
      });
      sanitized.forEach((p) => {
        if (p && p.id) {
          const current = playerMap.get(p.id) || {};
          playerMap.set(p.id, { ...current, ...p });
        }
      });
      const mergedPlayers = Array.from(playerMap.values());
      const dossier = camp?.dossier || {};

      const { error } = await supabase.from('campaigns').update({
        active_players: mergedPlayers,
        dossier: {
          ...dossier,
          activePlayers: mergedPlayers,
        },
        updated_at: new Date().toISOString(),
      }).eq('code', code);

      if (error) return handleSupabaseError('Error saving active players', error);
      return !error;
    } catch (err) {
      return handleSupabaseError('Failed to save active players', err);
    }
  }

  /**
   * Saves or updates a user account in the central public.user_accounts table
   */
  static async saveUserAccount(account: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !account || !account.id) return false;
    try {
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

      // Try upsert by id
      let { error } = await supabase.from('user_accounts').upsert(payload, { onConflict: 'id' });
      // If error is caused by email uniqueness conflict with a different ID, upsert on email
      if (error && email) {
        const { error: emailErr } = await supabase.from('user_accounts').upsert(payload, { onConflict: 'email' });
        if (!emailErr) error = null;
      }
      if (error) {
        console.warn('[Supabase] saveUserAccount warning:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] saveUserAccount exception:', err);
      return false;
    }
  }

  /**
   * Bulk saves all user accounts into public.user_accounts with single-batch upsert
   */
  static async saveAllUserAccounts(accounts: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !Array.isArray(accounts) || accounts.length === 0) return false;
    try {
      // Deduplicate by id and email so conflicting rows don't violate PostgreSQL unique constraint
      const byIdOrEmail = new Map<string, any>();
      for (const a of accounts) {
        if (!a || !a.id) continue;
        const key = a.id;
        byIdOrEmail.set(key, a);
      }
      const uniqueAccounts = Array.from(byIdOrEmail.values());
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
        console.warn('[Supabase] saveAllUserAccounts batch warning:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] saveAllUserAccounts exception:', err);
      return false;
    }
  }

  /**
   * Fetches all user accounts from the central public.user_accounts table
   */
  static async fetchAllUserAccounts(): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase.from('user_accounts').select('*');
      if (error || !Array.isArray(data)) {
        console.warn('[Supabase] fetchAllUserAccounts error:', error?.message);
        return [];
      }
      return data.map((row) => ({
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
    } catch (err) {
      console.warn('[Supabase] fetchAllUserAccounts exception:', err);
      return [];
    }
  }

  /**
   * Fetches all campaigns from Supabase for the global campaign list
   */
  static async fetchAllCampaigns(): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase.from('campaigns').select('code, title, created_at, dm_id, dossier');
      if (error || !Array.isArray(data)) return [];
      return data.map((c) => ({
        code: c.code,
        name: c.title || c.code,
        createdAt: c.created_at || new Date().toISOString(),
        dmId: c.dm_id || c.dossier?.dmId || undefined,
        dmEmail: c.dossier?.dmEmail || c.dossier?.creatorEmail || undefined,
        dmName: c.dossier?.dmName || c.dossier?.creatorName || undefined,
      }));
    } catch {
      return [];
    }
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
      const { error } = await supabase.from('character_bios').upsert(payload, { onConflict: 'campaign_code,player_id' });
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

      const { error } = await supabase.from('character_bios').upsert(payloads, { onConflict: 'campaign_code,player_id' });
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
      const { error } = await supabase.from('family_relations').upsert(payload, { onConflict: 'id' });
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
    if (!isSupabaseConfigured() || !campaignCode || !art || !art._id) return false;
    try {
      const code = campaignCode.trim().toUpperCase();
      const payload = {
        id: art._id,
        campaign_code: code,
        title: art.title || 'Senza Titolo',
        subtitle: art.subtitle || '',
        summary: art.summary || '',
        content: art.fullContentMarkdown || art.content || '',
        category_id: art.category || 'general',
        images: Array.isArray(art.images) ? art.images : [],
        is_draft: Boolean(art.dmOnly),
        bites: Array.isArray(art.bites) ? art.bites : [],
        author_player_id: art.authorPlayerId || '',
        author_name: art.authorName || '',
        tags: Array.isArray(art.tags) ? art.tags : [],
        related_entity_ids: Array.isArray(art.relatedEntityIds) ? art.relatedEntityIds : [],
        order_index: art.order || 0,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('world_lore_articles').upsert(payload, { onConflict: 'id' });
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
      const code = campaignCode.trim();

      // Atomic write to 'world_lore_articles'
      const upsertPromises = (articles || []).map((art) => {
        if (!art || !art._id) return Promise.resolve();
        const payload = {
          id: art._id,
          campaign_code: code,
          title: art.title || 'Senza Titolo',
          subtitle: art.subtitle || '',
          summary: art.summary || '',
          content: art.fullContentMarkdown || '',
          category_id: art.category || 'general',
          images: art.images || [],
          is_draft: Boolean(art.dmOnly),
          bites: art.bites || [],
          author_player_id: art.authorPlayerId || '',
          author_name: art.authorName || '',
          tags: art.tags || [],
          related_entity_ids: art.relatedEntityIds || [],
          order_index: art.order || 0,
          updated_at: new Date().toISOString(),
        };
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
   * Persists calendar system and lore date state into campaigns table in Supabase
   */
  static async saveCalendar(campaignCode: string, calendar: any): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !calendar) return false;
    try {
      const code = campaignCode.trim();
      const { error } = await supabase.from('campaigns').update({
        calendar_system: calendar,
        updated_at: new Date().toISOString(),
      }).eq('code', code);

      if (error) console.error('[Supabase] Error saving calendar:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save calendar:', err);
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
        console.warn('[Supabase] Warning fetching user preferences:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('[Supabase] Error fetching user preferences:', err);
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
      if (error) console.warn('[Supabase] Warning saving user preferences:', error.message);
      return !error;
    } catch (err) {
      console.warn('[Supabase] Error saving user preferences:', err);
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
        console.warn('[Supabase] Warning fetching oracle chat:', error.message);
        return null;
      }
      return Array.isArray(data?.messages) ? data.messages : null;
    } catch (err) {
      console.warn('[Supabase] Error fetching oracle chat:', err);
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
      if (error) console.warn('[Supabase] Warning saving oracle chat:', error.message);
      return !error;
    } catch (err) {
      console.warn('[Supabase] Error saving oracle chat:', err);
      return false;
    }
  }

  /**
   * Delete a single chapter and clean up dossier.chaptersMeta
   */
  static async deleteChapter(chapterId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (campaignCode) {
        this.removeChapterMeta(campaignCode, chapterId).catch(() => {});
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
      const code = campaignCode.trim();
      const payload = {
        id: map.id || `map_${Date.now()}`,
        campaign_code: code,
        title: map.title || 'Mappa',
        image_url: map.imageUrl || '',
        pins: map.pins || [],
        fog_of_war: {},
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('maps').upsert(payload, { onConflict: 'id' });
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
      const code = campaignCode.trim();
      const payload = {
        id: item.id || `scr_${Date.now()}`,
        campaign_code: code,
        title: item.title || '',
        image_url: item.imageUrl,
        caption: item.caption || '',
        created_by: item.authorName || '',
        created_at: item.createdAt || new Date().toISOString(),
      };

      const { error } = await supabase.from('scrapbook').upsert(payload, { onConflict: 'id' });
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

      const { error } = await supabase.from('audio_logs').upsert(payload, { onConflict: 'id' });
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

    // Sanitize heavy base64 media payloads to prevent PostgreSQL write timeout (code 57014)
    const data = sanitizeHeavyPayload(rawCampaignData);

    // 1. Sessions
    if (Array.isArray(data.sessions) && data.sessions.length > 0) {
      try {
        const payloads = data.sessions.map((session) => {
          const meta = {
            images: Array.isArray(session.images) ? session.images : [],
            coverImage: session.coverImage || '',
            entitiesExtracted: Boolean(session.entitiesExtracted),
            entitiesExtractedAt: session.entitiesExtractedAt || null,
            memorySynced: Boolean(session.memorySynced),
            memorySyncedAt: session.memorySyncedAt || null,
            sessionType: session.sessionType || 'mixed',
            quotes: Array.isArray(session.quotes) ? session.quotes : [],
            audioLogs: Array.isArray(session.audioLogs) ? session.audioLogs : [],
            excludedPlayerIds: Array.isArray(session.excludedPlayerIds) ? session.excludedPlayerIds : [],
            attendees: Array.isArray(session.attendees) ? session.attendees : [],
            gazetteConfig: session.gazetteConfig || null,
          };
          const existingTags = Array.isArray((session as any).tags)
            ? (session as any).tags.filter((t: any) => typeof t === 'string' && !t.startsWith('__meta__:'))
            : [];
          const tagsWithMeta = [...existingTags, '__meta__:' + JSON.stringify(meta)];

          return {
            id: session._id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            campaign_code: code,
            chapter_id: session.chapterId || null,
            number: session.number || 1,
            title: session.title || `Sessione ${session.number}`,
            summary: typeof session.recap === 'string' ? session.recap : '',
            recap: session.recap || [],
            date_str: session.date || '',
            calendar_date: session.loreDate || {},
            audio_url: '',
            plot_events: session.events || [],
            tags: tagsWithMeta,
            updated_at: new Date().toISOString(),
          };
        });

        // Split into chunks of 50 to avoid any HTTP payload size limits
        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await supabase.from('sessions').upsert(chunk, { onConflict: 'id' });
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
        const payloads = data.chapters.map((chapter) => ({
          id: chapter.id || `chap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_code: code,
          number: chapter.order || 1,
          title: chapter.name || '',
          synopsis: chapter.description || '',
          status: 'in_progress',
          order_index: chapter.order || 0,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('chapters').upsert(payloads, { onConflict: 'id' });
        if (error) throw error;
        stats.chapters = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving chapters:', err);
        errors.push(`Capitoli: ${err.message || err}`);
      }
    }

    // 3. Entities
    if (Array.isArray(data.entities) && data.entities.length > 0) {
      try {
        const payloads = data.entities.map((entity) => {
          const entityType = entity.type || (entity as any).category || 'npc';
          const rawImages = Array.isArray(entity.images)
            ? entity.images
            : ((entity as any).imageUrl ? [(entity as any).imageUrl] : []);

          const cleanImages = rawImages.map((img) =>
            typeof img === 'string' && img.length > 300000 ? img.slice(0, 100) : img
          );
          const primaryImageUrl =
            typeof (entity as any).imageUrl === 'string' && (entity as any).imageUrl.length < 300000
              ? (entity as any).imageUrl
              : cleanImages[0] || '';

          const { _id, name, type, category, description, imageUrl, status, ...restAttributes } = entity as any;
          const attributes = {
            ...restAttributes,
            images: cleanImages,
            progressNote: entity.progressNote || '',
            aliases: entity.aliases || [],
            aiConfig: entity.aiConfig || undefined,
            location: entity.location || undefined,
            mapId: entity.mapId || undefined,
            pinId: entity.pinId || undefined,
          };

          return {
            id: _id || `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            campaign_code: code,
            name: name || 'Senza Nome',
            type: entityType,
            description: description || '',
            image_url: primaryImageUrl,
            status: status || 'alive',
            attributes,
            updated_at: new Date().toISOString(),
          };
        });

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await supabase.from('entities').upsert(chunk, { onConflict: 'id' });
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
        const payloads = data.notes.map((note) => ({
          id: note._id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_code: code,
          author_id: note.author?._id || 'unknown',
          author_name: note.author?.characterName || 'Giocatore',
          title: note.title || '',
          content: note.content || '',
          visibility: note.visibility || 'group',
          ask_dm: Boolean(note.askDm),
          dm_reply: note.dmResponse?.text || '',
          updated_at: new Date().toISOString(),
        }));

        const chunkSize = 50;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await supabase.from('notes').upsert(chunk, { onConflict: 'id' });
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
        const payloads = data.maps.map((map) => ({
          id: map.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_code: code,
          title: map.title || 'Mappa',
          image_url: map.imageUrl || '',
          pins: map.pins || [],
          fog_of_war: {},
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('maps').upsert(payloads, { onConflict: 'id' });
        if (error) throw error;
        stats.maps = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving maps:', err);
        errors.push(`Mappe: ${err.message || err}`);
      }
    }

    // 6. Scrapbook
    if (Array.isArray(data.scrapbookItems) && data.scrapbookItems.length > 0) {
      try {
        const payloads = data.scrapbookItems.map((item) => ({
          id: item.id || `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_code: code,
          title: item.title || '',
          image_url: item.imageUrl,
          caption: item.caption || '',
          created_by: item.authorName || '',
          created_at: item.createdAt || new Date().toISOString(),
        }));

        const { error } = await supabase.from('scrapbook').upsert(payloads, { onConflict: 'id' });
        if (error) throw error;
        stats.scrapbook = payloads.length;
      } catch (err: any) {
        console.error('[Supabase Bulk] Error saving scrapbook:', err);
        errors.push(`Scrapbook: ${err.message || err}`);
      }
    }

    // 7. Audio Logs
    if (Array.isArray(data.audioLogs) && data.audioLogs.length > 0) {
      try {
        const payloads = data.audioLogs.map((log) => ({
          id: log.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_code: code,
          title: log.title || 'Diario Audio',
          audio_url: log.audioUrl,
          duration: log.durationSeconds || 0,
          recorded_by: log.recordedBy || '',
          created_at: log.createdAt || new Date().toISOString(),
        }));

        const { error } = await supabase.from('audio_logs').upsert(payloads, { onConflict: 'id' });
        if (error) throw error;
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

        const { error } = await supabase.from('character_bios').upsert(payloads, { onConflict: 'campaign_code,player_id' });
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

        const { error } = await supabase.from('family_relations').upsert(payloads, { onConflict: 'id' });
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
        const payloads = data.worldLoreArticles.map((art) => ({
          id: art._id,
          campaign_code: code,
          title: art.title || 'Senza Titolo',
          content: art.fullContentMarkdown || '',
          category_id: art.category || 'general',
          images: art.images || [],
          is_draft: Boolean(art.dmOnly),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('world_lore_articles').upsert(payloads, { onConflict: 'id' });
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
