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
      const code = campaignCode.trim();

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
        supabase.from('campaigns').select('*').eq('code', code).single(),
        supabase.from('chapters').select('*').eq('campaign_code', code).order('order_index', { ascending: true }),
        supabase.from('sessions').select('*').eq('campaign_code', code).order('number', { ascending: true }),
        supabase.from('entities').select('*').eq('campaign_code', code),
        supabase.from('notes').select('*').eq('campaign_code', code).order('created_at', { ascending: false }),
        supabase.from('maps').select('*').eq('campaign_code', code),
        supabase.from('scrapbook').select('*').eq('campaign_code', code).order('created_at', { ascending: false }),
        supabase.from('audio_logs').select('*').eq('campaign_code', code).order('created_at', { ascending: false }),
      ]);

      if (campaignRes.error && campaignRes.error.code !== 'PGRST116') {
        console.warn('[Supabase] Error loading campaign:', campaignRes.error);
        return null;
      }

      const campRow = campaignRes.data;
      if (!campRow) return null;

      const chapters: CampaignChapter[] = (chaptersRes.data || []).map((row) => ({
        id: row.id,
        name: row.title || 'Capitolo',
        description: row.synopsis || '',
        order: row.order_index || 0,
      }));

      const sessions: Session[] = (sessionsRes.data || []).map((row) => ({
        _id: row.id,
        number: row.number,
        title: row.title,
        date: row.date_str || new Date().toISOString().split('T')[0],
        chapterId: row.chapter_id || undefined,
        loreDate: row.calendar_date ? JSON.stringify(row.calendar_date) : undefined,
        events: Array.isArray(row.plot_events) ? row.plot_events : [],
        recap: Array.isArray(row.recap) ? row.recap : [],
      }));

      const entities: Entity[] = (entitiesRes.data || []).map((row) => ({
        _id: row.id,
        name: row.name,
        category: row.type || 'npc',
        description: row.description || '',
        imageUrl: row.image_url || '',
        status: row.status || 'active',
        ...(row.attributes || {}),
      }));

      const notes: Note[] = (notesRes.data || []).map((row) => ({
        _id: row.id,
        _createdAt: row.created_at || new Date().toISOString(),
        title: row.title || 'Nota',
        content: row.content || '',
        visibility: row.visibility === 'personal' ? 'personal' : 'group',
        dmOnly: false,
        canonState: 'canon',
        pinned: false,
        askDm: Boolean(row.ask_dm),
        author: {
          _id: row.author_id || 'unknown',
          characterName: row.author_name || 'Giocatore',
          isDm: false,
        },
      }));

      const maps: WorldMap[] = (mapsRes.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.image_url || '',
        pins: Array.isArray(row.pins) ? row.pins : [],
        createdAt: row.created_at || new Date().toISOString(),
      }));

      const scrapbookItems: ScrapbookItem[] = (scrapbookRes.data || []).map((row) => ({
        id: row.id,
        title: row.title || '',
        imageUrl: row.image_url,
        caption: row.caption || '',
        authorName: row.created_by || '',
        category: 'moment',
        createdAt: row.created_at,
      }));

      const audioLogs: AudioLog[] = (audioRes.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        audioUrl: row.audio_url,
        durationSeconds: row.duration || 0,
        recordedBy: row.recorded_by || '',
        createdAt: row.created_at,
      }));

      return {
        campaignCode: campRow.code,
        title: campRow.title,
        subtitle: campRow.subtitle || '',
        description: campRow.description || '',
        system: campRow.system || 'D&D 5e',
        dmId: campRow.dm_id || '',
        calendarSystem: campRow.calendar_system || {},
        aiConfig: campRow.ai_config || {},
        activePlayers: Array.isArray(campRow.active_players) ? campRow.active_players : [],
        dossier: campRow.dossier || {},
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
        dossier: data.dossier || {},
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
   * Save or update a single session (~15ms)
   */
  static async saveSession(campaignCode: string, session: Session): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !session) return false;

    try {
      const code = campaignCode.trim();
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
        tags: [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' });
      if (error) console.error('[Supabase] Error saving session:', error);
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save session:', err);
      return false;
    }
  }

  /**
   * Delete a single session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save or update a single note (~15ms)
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
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save note:', err);
      return false;
    }
  }

  /**
   * Delete a single note
   */
  static async deleteNote(noteId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Save or update a single entity (~15ms)
   */
  static async saveEntity(campaignCode: string, entity: Entity): Promise<boolean> {
    if (!isSupabaseConfigured() || !campaignCode || !entity) return false;

    try {
      const code = campaignCode.trim();
      const { _id, name, category, description, imageUrl, status, ...restAttributes } = entity as any;
      const payload = {
        id: _id || `ent_${Date.now()}`,
        campaign_code: code,
        name: name || 'Senza Nome',
        type: category || 'npc',
        description: description || '',
        image_url: imageUrl || '',
        status: status || 'active',
        attributes: restAttributes || {},
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
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save chapter:', err);
      return false;
    }
  }

  /**
   * Delete a single chapter
   */
  static async deleteChapter(chapterId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
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
      return !error;
    } catch (err) {
      console.error('[Supabase] Failed to save map:', err);
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
