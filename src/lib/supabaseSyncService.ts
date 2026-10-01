import { supabase, isSupabaseConfigured } from './supabase';
import {
  Session,
  CampaignChapter,
  Note,
  Entity,
  WorldMap,
  ScrapbookItem,
  AudioLog,
} from '../types';

export class SupabaseSyncService {
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
      ]);

      if (campaignRes.error) {
        console.warn('[Supabase] Warning reading campaigns table:', campaignRes.error.message);
      }
      if (sessionsRes.error) {
        console.warn('[Supabase] Warning reading sessions table:', sessionsRes.error.message);
      }

        const campRow = campaignRes.data || {};
      const dossier = campRow.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      const mapsMeta = dossier.mapsMeta || {};
      const sessionsMeta = dossier.sessionsMeta || {};
      const mapFolders = Array.isArray(dossier.mapFolders) ? dossier.mapFolders : [];

      const chapters: CampaignChapter[] = (chaptersRes.data || []).map((row) => ({
        id: row.id,
        name: row.title || 'Capitolo',
        description: row.synopsis || '',
        order: row.order_index ?? row.number ?? 0,
        coverImageUrl: chaptersMeta[row.id]?.coverImageUrl || (row as any).cover_image_url || (row as any).image_url || undefined,
      }));

      const sessions: Session[] = (sessionsRes.data || []).map((row) => {
        // Support both recap array or summary markdown string
        let recapData: any = row.recap;
        if (!recapData || (Array.isArray(recapData) && recapData.length === 0)) {
          recapData = row.summary || [];
        }
        if (typeof recapData === 'string') {
          const trimmed = recapData.trim();
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
              recapData = JSON.parse(trimmed);
            } catch {}
          }
        }

        // Clean loreDate formatting
        let parsedLoreDate: string | undefined = undefined;
        if (typeof row.calendar_date === 'string') {
          parsedLoreDate = row.calendar_date;
        } else if (row.calendar_date && typeof row.calendar_date === 'object') {
          parsedLoreDate = JSON.stringify(row.calendar_date);
        }

        let meta: any = {};
        const metaTag = Array.isArray(row.tags)
          ? row.tags.find((t: string) => typeof t === 'string' && t.startsWith('__meta__:'))
          : null;
        if (metaTag) {
          try {
            meta = JSON.parse(metaTag.slice('__meta__:'.length));
          } catch {}
        }
        if (sessionsMeta && sessionsMeta[row.id]) {
          meta = { ...sessionsMeta[row.id], ...meta };
        }
        const cleanTags = Array.isArray(row.tags)
          ? row.tags.filter((t: string) => typeof t === 'string' && !t.startsWith('__meta__:'))
          : [];

        const sessionImages = Array.isArray(meta.images) && meta.images.length > 0
          ? meta.images
          : (Array.isArray((row as any).images) ? (row as any).images : []);

        return {
          _id: row.id,
          number: Number(row.number) || 1,
          title: row.title || `Sessione ${row.number || 1}`,
          date: row.date_str || new Date().toISOString().split('T')[0],
          chapterId: row.chapter_id || undefined,
          loreDate: parsedLoreDate,
          events: Array.isArray(row.plot_events) ? row.plot_events : [],
          recap: recapData,
          images: sessionImages,
          coverImage: meta.coverImage || (row as any).cover_image || undefined,
          entitiesExtracted: meta.entitiesExtracted !== undefined ? Boolean(meta.entitiesExtracted) : Boolean((row as any).entities_extracted),
          entitiesExtractedAt: meta.entitiesExtractedAt || (row as any).entities_extracted_at || undefined,
          memorySynced: meta.memorySynced !== undefined ? Boolean(meta.memorySynced) : Boolean((row as any).memory_synced),
          memorySyncedAt: meta.memorySyncedAt || (row as any).memory_synced_at || undefined,
          sessionType: meta.sessionType || (row as any).session_type || 'mixed',
          quotes: Array.isArray(meta.quotes) ? meta.quotes : (Array.isArray((row as any).quotes) ? (row as any).quotes : []),
          audioLogs: Array.isArray(meta.audioLogs) ? meta.audioLogs : (Array.isArray((row as any).audio_logs) ? (row as any).audio_logs : []),
          tags: cleanTags,
        };
      });

      const entities: Entity[] = (entitiesRes.data || []).map((row) => {
        const customAttrs = (row.attributes && typeof row.attributes === 'object') ? row.attributes : {};
        const entityType = row.type || customAttrs.type || customAttrs.category || 'npc';
        const entityImages = Array.isArray(customAttrs.images) && customAttrs.images.length > 0
          ? customAttrs.images
          : (row.image_url ? [row.image_url] : []);

        return {
          _id: row.id,
          name: row.name || 'Senza Nome',
          type: entityType,
          description: row.description || '',
          imageUrl: row.image_url || entityImages[0] || '',
          images: entityImages,
          status: row.status || 'alive',
          aliases: Array.isArray(customAttrs.aliases) ? customAttrs.aliases : [],
          progressNote: customAttrs.progressNote || '',
          aiConfig: customAttrs.aiConfig || undefined,
          body: customAttrs.body || [],
          location: customAttrs.location || undefined,
          mapId: customAttrs.mapId || undefined,
          pinId: customAttrs.pinId || undefined,
          ...customAttrs,
          type: entityType,
          images: entityImages,
        };
      });

      const notesMeta = dossier.notesMeta || {};

      const notes: Note[] = (notesRes.data || []).map((row) => {
        const meta = notesMeta[row.id] || {};
        return {
          _id: row.id,
          _createdAt: row.created_at || new Date().toISOString(),
          title: row.title || 'Nota',
          content: row.content || '',
          visibility: row.visibility === 'personal' ? 'personal' : 'group',
          dmOnly: meta.dmOnly !== undefined ? Boolean(meta.dmOnly) : false,
          canonState: meta.canonState || 'canon',
          pinned: meta.pinned !== undefined ? Boolean(meta.pinned) : false,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          images: Array.isArray(meta.images) ? meta.images : [],
          askDm: Boolean(row.ask_dm),
          author: {
            _id: row.author_id || 'unknown',
            characterName: row.author_name || 'Giocatore',
            isDm: false,
          },
          dmResponse: row.dm_reply
            ? {
                text: row.dm_reply,
                answeredAt: row.updated_at || new Date().toISOString(),
                answeredBy: 'Dungeon Master',
              }
            : undefined,
        };
      });

      const maps: WorldMap[] = (mapsRes.data || []).map((row) => ({
        id: row.id,
        title: row.title || 'Mappa',
        description: mapsMeta[row.id]?.description || (row as any).description || '',
        folderId: mapsMeta[row.id]?.folderId || (row as any).folder_id || undefined,
        imageUrl: row.image_url || '',
        pins: Array.isArray(row.pins) ? row.pins : [],
        createdAt: row.created_at || new Date().toISOString(),
      }));

      const scrapbookItems: ScrapbookItem[] = (scrapbookRes.data || []).map((row) => ({
        id: row.id,
        title: row.title || '',
        imageUrl: row.image_url || '',
        caption: row.caption || '',
        authorName: row.created_by || '',
        category: 'moment',
        createdAt: row.created_at || new Date().toISOString(),
      }));

      const audioLogs: AudioLog[] = (audioRes.data || []).map((row) => ({
        id: row.id,
        title: row.title || 'Diario Audio',
        audioUrl: row.audio_url || '',
        durationSeconds: row.duration || 0,
        recordedBy: row.recorded_by || '',
        createdAt: row.created_at || new Date().toISOString(),
      }));

      return {
        campaignCode: campRow.code || cleanCode,
        title: campRow.title || cleanCode,
        subtitle: campRow.subtitle || '',
        description: campRow.description || '',
        system: campRow.system || 'D&D 5e',
        dmId: campRow.dm_id || '',
        calendarSystem: campRow.calendar_system || {},
        aiConfig: campRow.ai_config || {},
        activePlayers: Array.isArray(campRow.active_players) ? campRow.active_players : [],
        dossier,
        characterBios: Array.isArray(dossier.characterBios) ? dossier.characterBios : [],
        familyRelations: Array.isArray(dossier.familyRelations) ? dossier.familyRelations : [],
        worldLoreArticles: Array.isArray(dossier.worldLoreArticles) ? dossier.worldLoreArticles : [],
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
      console.error('[Supabase] Failed to fetch campaign data:', err);
      return null;
    }
  }

  /**
   * Save or update base campaign info
   */
  static async saveCampaign(campaignCode: string, data: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;

    try {
      const code = campaignCode.trim();
      const existingDossier = data.dossier || {};
      const payload = {
        id: code,
        code,
        title: data.title || 'Nuova Campagna',
        subtitle: data.subtitle || '',
        description: data.description || '',
        system: data.system || 'D&D 5e',
        dm_id: data.dmId || '',
        calendar_system: data.calendarSystem || {},
        ai_config: data.aiConfig || {},
        active_players: data.activePlayers || [],
        dossier: {
          ...existingDossier,
          characterBios: data.characterBios || existingDossier.characterBios || [],
          familyRelations: data.familyRelations || existingDossier.familyRelations || [],
          worldLoreArticles: data.worldLoreArticles || existingDossier.worldLoreArticles || [],
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('campaigns').upsert(payload, { onConflict: 'code' });
      if (error) {
        console.error('[Supabase] Error saving campaign:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save campaign:', err);
      return false;
    }
  }

  /**
   * Save or update a single session with complete metadata and image persistence
   */
  static async saveSession(campaignCode: string, session: Session): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !session) return false;

    try {
      const code = campaignCode.trim();
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
        gazetteConfig: session.gazetteConfig || null,
      };

      const existingTags = Array.isArray(session.tags)
        ? session.tags.filter((t) => typeof t === 'string' && !t.startsWith('__meta__:'))
        : [];
      const tagsWithMeta = [...existingTags, '__meta__:' + JSON.stringify(meta)];

      const payload = {
        id: session._id || `sess_${Date.now()}`,
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

      const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving session:', error);

      // Redundant dual-layer storage in dossier.sessionsMeta
      this.saveSessionMeta(code, session._id, meta).catch(() => {});

      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save session:', err);
      return false;
    }
  }

  /**
   * Delete a single session and clean up dossier.sessionsMeta
   */
  static async deleteSession(sessionId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !sessionId) return false;
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (campaignCode) {
        this.removeSessionMeta(campaignCode, sessionId).catch(() => {});
      }
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
      const code = campaignCode.trim();
      const payload = {
        id: note._id || `note_${Date.now()}`,
        campaign_code: code,
        author_id: note.author?._id || 'unknown',
        author_name: note.author?.characterName || 'Giocatore',
        title: note.title || '',
        content: note.content || '',
        visibility: note.visibility || 'group',
        ask_dm: Boolean(note.askDm),
        dm_reply: note.dmResponse?.text || '',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving note:', error);

      // Save tags, images, pinned, etc. to dossier.notesMeta
      const noteMeta = {
        tags: Array.isArray(note.tags) ? note.tags : [],
        images: Array.isArray(note.images) ? note.images : [],
        pinned: Boolean(note.pinned),
        canonState: note.canonState || 'canon',
        dmOnly: Boolean(note.dmOnly),
      };
      this.saveNoteMeta(code, payload.id, noteMeta).catch(() => {});

      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save note:', err);
      return false;
    }
  }

  /**
   * Delete a single note and clean up dossier.notesMeta
   */
  static async deleteNote(noteId: string, campaignCode?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !noteId) return false;
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (campaignCode) {
        this.removeNoteMeta(campaignCode, noteId).catch(() => {});
      }
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
      const entityImages = Array.isArray(entity.images)
        ? entity.images
        : ((entity as any).imageUrl ? [(entity as any).imageUrl] : []);
      const primaryImageUrl = entityImages[0] || (entity as any).imageUrl || '';

      const { _id, name, type, category, description, imageUrl, status, ...restAttributes } = entity as any;
      const attributes = {
        ...restAttributes,
        images: entityImages,
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
      if (error) console.error('[Supabase] Error saving entity:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save entity:', err);
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
   * Save or update a single chapter (~15ms)
   */
  static async saveChapter(campaignCode: string, chapter: CampaignChapter): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapter) return false;

    try {
      const code = campaignCode.trim();
      const payload = {
        id: chapter.id || `chap_${Date.now()}`,
        campaign_code: code,
        number: chapter.order || 1,
        title: chapter.name || '',
        synopsis: chapter.description || '',
        status: 'in_progress',
        order_index: chapter.order || 0,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('chapters').upsert(payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving chapter:', error);

      // Save coverImageUrl into campaign dossier
      if (chapter.coverImageUrl !== undefined) {
        this.saveChapterCover(code, chapter.id, chapter.coverImageUrl || '').catch(() => {});
      }

      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save chapter:', err);
      return false;
    }
  }

  /**
   * Persists chapter cover image URL to campaign dossier
   */
  static async saveChapterCover(campaignCode: string, chapterId: string, coverImageUrl: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !chapterId) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      const chaptersMeta = dossier.chaptersMeta || {};
      chaptersMeta[chapterId] = { ...(chaptersMeta[chapterId] || {}), coverImageUrl };
      await supabase.from('campaigns').update({
        dossier: { ...dossier, chaptersMeta },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save chapter cover:', err);
      return false;
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
   * Persists active party members / user accounts into campaign row in Supabase
   */
  static async saveActivePlayers(campaignCode: string, accounts: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const { error } = await supabase.from('campaigns').update({
        active_players: accounts || [],
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      if (error) console.error('[Supabase] Error saving active players:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save active players:', err);
      return false;
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
   * Persists character bios into campaign dossier
   */
  static async saveCharacterBios(campaignCode: string, bios: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
      const { data: camp } = await supabase.from('campaigns').select('dossier').eq('code', code).maybeSingle();
      const dossier = camp?.dossier || {};
      await supabase.from('campaigns').update({
        dossier: { ...dossier, characterBios: bios || [] },
        updated_at: new Date().toISOString(),
      }).eq('code', code);
      return true;
    } catch (err) {
      console.error('[Supabase] Failed to save character bios:', err);
      return false;
    }
  }

  /**
   * Persists family relations into campaign dossier
   */
  static async saveFamilyRelations(campaignCode: string, relations: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
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
   * Persists world lore articles into campaign dossier
   */
  static async saveWorldLoreArticles(campaignCode: string, articles: any[]): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode) return false;
    try {
      const code = campaignCode.trim();
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
}
