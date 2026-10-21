import { supabase } from './supabase';
import { CampaignManager } from '../store/campaignStore';
import {
  CampaignChapter,
  Session,
  SessionEvent,
  Entity,
  Note,
  WorldMap,
  MapFolder,
  ScrapbookItem,
  AudioLog,
  CharacterBio,
  CharacterRelationship,
  CampaignMemberRecord,
  CampaignMemberPermissions,
  CampaignRole,
  normalizeCampaignRole,
} from '../types';

/**
 * =========================================================================
 * AUTHORITATIVE CENTRAL SUPABASE ADAPTER
 * Single Source of Truth for Data Conversion between Supabase and Frontend
 * =========================================================================
 */

/**
 * Helper to convert optional foreign keys that are empty, "unknown", "none", etc. into null
 * to satisfy strict PostgreSQL foreign key constraints (ERROR 23503).
 */
export function toNullableFk(
  val: any,
  validIdsSet?: Set<string>
): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string' && typeof val !== 'number') return null;
  const s = String(val).trim();
  if (
    !s ||
    s === '' ||
    s.toLowerCase() === 'unknown' ||
    s.toLowerCase() === 'unassigned' ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase().startsWith('unregistered_')
  ) {
    return null;
  }
  if (validIdsSet && validIdsSet.size > 0 && !validIdsSet.has(s)) {
    return null;
  }
  return s;
}

/**
 * Validates user foreign keys (referencing public.user_accounts).
 * Rejects local non-registered player IDs starting with 'usr_pg_' or 'unregistered_'.
 */
export function toValidUserFk(
  id: any,
  validUserIdsSet?: Set<string>
): string | null {
  const fk = toNullableFk(id, validUserIdsSet);
  if (!fk) return null;
  if (fk.toLowerCase().startsWith('usr_pg_')) return null;
  return fk;
}

/**
 * Resolves any Supabase storage path or external URL to a fully qualified public URL.
 */
export function resolveStorageUrl(
  pathOrUrl: string | null | undefined,
  defaultBucket: string = 'chronicle-media'
): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (
    !trimmed ||
    trimmed.toUpperCase() === 'EMPTY' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed.includes('[Immagine rimossa') ||
    trimmed.includes('rimossa per prevenire')
  ) {
    return '';
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  // Reject malformed or non-image data strings
  if (trimmed.startsWith('data:')) {
    return '';
  }

  try {
    let cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    let targetBucket = defaultBucket;

    if (cleanPath.startsWith('campaigns/')) {
      targetBucket = 'chronicle-media';
    } else if (cleanPath.startsWith('chronicle-media/')) {
      targetBucket = 'chronicle-media';
      cleanPath = cleanPath.slice('chronicle-media/'.length);
    } else if (cleanPath.startsWith('campaign-assets/')) {
      targetBucket = 'campaign-assets';
      cleanPath = cleanPath.slice('campaign-assets/'.length);
    } else if (cleanPath.startsWith('user-avatars/')) {
      targetBucket = 'user-avatars';
      cleanPath = cleanPath.slice('user-avatars/'.length);
    } else if (cleanPath.startsWith('audio-logs/')) {
      targetBucket = 'audio-logs';
      cleanPath = cleanPath.slice('audio-logs/'.length);
    }

    const { data } = supabase.storage.from(targetBucket).getPublicUrl(cleanPath);
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  } catch (err) {
    console.warn('[SupabaseAdapter] Failed resolving storage path:', trimmed, err);
  }

  return trimmed;
}

export function resolveStorageUrlArray(
  arr: any[] | null | undefined,
  defaultBucket: string = 'campaign-assets'
): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return resolveStorageUrl(item, defaultBucket);
      if (item && typeof item === 'object') {
        const path = item.url || item.path || item.imageUrl || item.src;
        return resolveStorageUrl(path, defaultBucket);
      }
      return '';
    })
    .filter(Boolean);
}

// =========================================================================
// 1. CHAPTERS ADAPTER (chapters)
// =========================================================================
export function fromDbChapter(
  row: any,
  metaOverrides?: Record<string, any>
): CampaignChapter {
  if (!row) {
    return {
      id: `chap_${Date.now()}`,
      name: 'Nuovo Capitolo',
      order: 1,
    };
  }

  const rowId = String(row.id || '');
  const title = String(row.title || row.name || 'Capitolo').trim();
  const metaObj = metaOverrides?.[rowId] || metaOverrides?.[title] || {};
  const synopsis = String(row.synopsis || row.description || metaObj.description || '').trim();
  const orderNum = Number(row.number ?? row.order_index ?? row.order ?? metaObj.order ?? 1);

  const rawCover =
    row.cover_image_url ||
    row.image_url ||
    row.cover_image ||
    row.coverUrl ||
    row.thumbnail_url ||
    metaObj.coverImageUrl ||
    metaObj.imageUrl ||
    '';

  return {
    id: rowId,
    title,
    name: title, // Legacy alias for backward compatibility
    synopsis,
    description: synopsis, // Legacy alias for backward compatibility
    orderIndex: orderNum,
    order: orderNum, // Legacy alias for orderIndex
    color: row.color || metaObj.color || '#6366f1',
    status: row.status || 'in_progress',
    coverImageUrl: resolveStorageUrl(rawCover, 'campaign-assets'),
    createdAt: row.created_at || metaObj.createdAt || new Date().toISOString(),
  };
}
export const chapterRowToModel = fromDbChapter;

export function toDbChapter(
  chapter: CampaignChapter,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const chapterTitle = chapter.title || chapter.name || 'Capitolo';
  const chapterSynopsis = chapter.synopsis || chapter.description || '';
  const chapterNumber = Number(chapter.orderIndex ?? chapter.order ?? (chapter as any).number ?? 1);

  return {
    id: chapter.id,
    campaign_code: cleanCode,
    number: chapterNumber,
    title: chapterTitle,
    synopsis: chapterSynopsis,
    status: chapter.status || 'in_progress',
    cover_image_url: chapter.coverImageUrl || '',
    color: chapter.color || '#6366f1',
    created_at: (chapter as any).createdAt || (chapter as any)._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const chapterModelToRow = toDbChapter;

// =========================================================================
// 2. SESSIONS ADAPTER (sessions + session_attendees)
// =========================================================================
export function fromDbSession(
  row: any,
  sessionsMeta?: Record<string, any>
): Session {
  if (!row) {
    return {
      _id: `sess_${Date.now()}`,
      number: 1,
      title: 'Nuova Sessione',
      date: new Date().toISOString().split('T')[0],
      events: [],
    };
  }

  const rowId = String(row.id || row._id || '');
  const meta = sessionsMeta?.[rowId] || {};
  const calendarMeta = row.calendar_meta && typeof row.calendar_meta === 'object' ? row.calendar_meta : {};

  let summaryText = typeof row.summary === 'string' ? row.summary.trim() : '';
  if (!summaryText && typeof row.recap === 'string') {
    summaryText = row.recap.trim();
  }

  const parsedLoreDate: string | undefined = row.calendar_date || calendarMeta.calendar_date || row.lore_date || meta.loreDate || undefined;
  const realDate = row.date_str || row.date || meta.date || new Date().toISOString().split('T')[0];

  let rawEvents: any[] = [];
  if (Array.isArray(row.plot_events)) {
    rawEvents = row.plot_events;
  } else if (Array.isArray(row.events)) {
    rawEvents = row.events;
  } else if (typeof row.notes === 'string' && row.notes.trim().startsWith('[')) {
    try {
      rawEvents = JSON.parse(row.notes);
    } catch {
      rawEvents = meta.events || [];
    }
  } else {
    rawEvents = meta.events || [];
  }

  const events: SessionEvent[] = Array.isArray(rawEvents) ? rawEvents.map((evt: any) => ({
    ...evt,
    id: evt.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: evt.title || 'Evento',
    description: evt.description || '',
    loreDate: (evt.loreDate || evt.calendar_date || parsedLoreDate || '').trim(),
  })) : [];

  const attendees: any[] = Array.isArray(calendarMeta.attendees) ? [...calendarMeta.attendees] : (Array.isArray(meta.attendees) ? [...meta.attendees] : []);
  const attendeePlayerIds: string[] = Array.isArray(calendarMeta.attendeePlayerIds) ? [...calendarMeta.attendeePlayerIds] : [];
  const excludedPlayerIds: string[] = Array.isArray(calendarMeta.excludedPlayerIds) ? [...calendarMeta.excludedPlayerIds] : (Array.isArray(meta.excludedPlayerIds) ? [...meta.excludedPlayerIds] : []);

  if (Array.isArray(row.session_attendees) && row.session_attendees.length > 0) {
    row.session_attendees.forEach((sa: any) => {
      const uId = String(sa.player_id || sa.user_id || '').trim();
      if (!uId) return;
      if (sa.status === 'present') {
        if (!attendeePlayerIds.includes(uId)) {
          attendees.push({ _id: uId, id: uId });
          attendeePlayerIds.push(uId);
        }
      } else if (sa.status === 'absent') {
        if (!excludedPlayerIds.includes(uId)) {
          excludedPlayerIds.push(uId);
        }
      }
    });
  }

  const rawCover = row.cover_image_url || calendarMeta.coverImageUrl || meta.coverImageUrl || (typeof row.cover_image === 'string' ? row.cover_image : null);
  const coverImageUrl = rawCover ? resolveStorageUrl(rawCover, 'campaign-assets') : undefined;

  let galleryImages = Array.isArray(row.images) ? resolveStorageUrlArray(row.images) : (Array.isArray(calendarMeta.images) ? resolveStorageUrlArray(calendarMeta.images) : (meta.images || []));
  if (coverImageUrl) {
    galleryImages = galleryImages.filter((img) => img !== coverImageUrl && img !== rawCover);
  }

  const sessNumber = Number(row.number ?? meta.number ?? 1);

  return {
    _id: rowId,
    id: rowId,
    number: sessNumber,
    date_str: realDate,
    date: realDate,
    title: String(row.title || meta.title || `Sessione ${sessNumber}`).trim(),
    sessionType: row.session_type || calendarMeta.sessionType || meta.sessionType || 'mixed',
    chapterId: row.chapter_id || calendarMeta.chapterId || meta.chapterId || undefined,
    chapterName: calendarMeta.chapterName || row.chapter_name || undefined,
    linkedEntityIds: Array.isArray(calendarMeta.linkedEntityIds) ? calendarMeta.linkedEntityIds : (Array.isArray(row.linked_entity_ids) ? row.linked_entity_ids : (meta.linkedEntityIds || [])),
    calendar_date: parsedLoreDate,
    loreDate: parsedLoreDate,
    loreStartDay: calendarMeta.loreStartDay ?? row.lore_day ?? meta.loreStartDay ?? undefined,
    loreEndDay: calendarMeta.loreEndDay ?? undefined,
    loreMonth: calendarMeta.loreMonth ?? (row.lore_month ? String(row.lore_month) : meta.loreMonth) ?? undefined,
    loreEndMonth: calendarMeta.loreEndMonth ?? undefined,
    loreYear: calendarMeta.loreYear ?? row.lore_year ?? meta.loreYear ?? undefined,
    loreEndYear: calendarMeta.loreEndYear ?? undefined,
    summary: summaryText,
    recap: summaryText ? [{ _type: 'block', children: [{ _type: 'span', text: summaryText }] }] : [],
    plot_events: events,
    events,
    images: galleryImages,
    coverImage: coverImageUrl,
    coverImageUrl,
    audioLogs: [],
    excludedPlayerIds,
    attendeePlayerIds,
    attendees,
    entitiesExtracted: Boolean(row.entities_extracted_at ?? calendarMeta.entitiesExtracted ?? meta.entitiesExtracted),
    entitiesExtractedAt: row.entities_extracted_at || undefined,
    memorySynced: Boolean(row.memory_synced_at ?? calendarMeta.memorySynced ?? meta.memorySynced),
    memorySyncedAt: row.memory_synced_at || undefined,
    quotes: Array.isArray(row.quotes) ? row.quotes : (Array.isArray(calendarMeta.quotes) ? calendarMeta.quotes : []),
    tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(calendarMeta.tags) ? calendarMeta.tags : []),
    gazetteConfig: calendarMeta.gazetteConfig || row.gazette_config || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}
export const sessionRowToModel = fromDbSession;

export function toDbSession(
  session: Session,
  campaignCode: string,
  validIds?: { chapterIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const sessionDate = session.date_str || session.date || new Date().toISOString().split('T')[0];

  let summaryStr = session.summary || '';
  if (!summaryStr) {
    if (typeof (session as any).recapText === 'string') {
      summaryStr = (session as any).recapText;
    } else if (typeof (session as any).recap === 'string') {
      summaryStr = (session as any).recap;
    } else if (Array.isArray(session.recap)) {
      summaryStr = session.recap
        .map((item) => (typeof item === 'string' ? item : (item?.children?.[0]?.text || '')))
        .filter(Boolean)
        .join('\n');
    }
  }

  const plotEvents = Array.isArray(session.plot_events)
    ? session.plot_events
    : (Array.isArray(session.events) ? session.events : []);

  const notesContent = typeof (session as any).notes === 'string'
    ? (session as any).notes
    : JSON.stringify(plotEvents);

  const coverImage = (session as any).coverImageUrl || (session as any).coverImage || null;
  let galleryImages = Array.isArray(session.images) ? session.images : [];
  if (coverImage) {
    galleryImages = galleryImages.filter((img) => img !== coverImage);
  }

  const calendarDate = session.calendar_date || session.loreDate || null;

  const calendarMeta = {
    excludedPlayerIds: session.excludedPlayerIds || [],
    attendeePlayerIds: session.attendeePlayerIds || [],
    attendees: session.attendees || [],
    chapterName: session.chapterName || null,
    linkedEntityIds: session.linkedEntityIds || [],
    loreStartDay: session.loreStartDay ?? null,
    loreEndDay: session.loreEndDay ?? null,
    loreMonth: session.loreMonth ?? null,
    loreEndMonth: session.loreEndMonth ?? null,
    loreYear: session.loreYear ?? null,
    loreEndYear: session.loreEndYear ?? null,
    gazetteConfig: session.gazetteConfig || null,
    entitiesExtracted: Boolean(session.entitiesExtracted),
    memorySynced: Boolean(session.memorySynced),
  };

  const entitiesExtractedAt = session.entitiesExtracted
    ? (session.entitiesExtractedAt || new Date().toISOString())
    : null;

  const memorySyncedAt = session.memorySynced
    ? (session.memorySyncedAt || new Date().toISOString())
    : null;

  return {
    id: session._id || session.id,
    campaign_code: cleanCode,
    chapter_id: toNullableFk(session.chapterId, validIds?.chapterIds),
    number: Number(session.number || 1),
    title: session.title || `Sessione ${session.number || 1}`,
    date_str: sessionDate,
    calendar_date: calendarDate,
    calendar_meta: calendarMeta,
    session_type: session.sessionType || 'mixed',
    summary: summaryStr,
    plot_events: plotEvents,
    quotes: Array.isArray((session as any).quotes) ? (session as any).quotes : [],
    images: galleryImages,
    cover_image_url: coverImage,
    tags: Array.isArray((session as any).tags) ? (session as any).tags : [],
    entities_extracted_at: entitiesExtractedAt,
    memory_synced_at: memorySyncedAt,
    created_at: (session as any).createdAt || (session as any)._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const sessionModelToRow = toDbSession;

// =========================================================================
// 3. ENTITIES (CODEX) ADAPTER (entities)
// =========================================================================
export function fromDbEntity(row: any): Entity {
  if (!row) {
    const defaultId = `ent_${Date.now()}`;
    return {
      id: defaultId,
      _id: defaultId,
      name: 'Nuova Entità',
      type: 'npc',
      description: '',
      imageUrl: '',
      images: [],
      status: 'alive',
      color: '#3B82F6',
    };
  }

  const rawAttrs = row.attributes && typeof row.attributes === 'object' ? { ...row.attributes } : {};
  const entityId = String(row.id || rawAttrs.id || rawAttrs._id || '');

  const name = row.name || rawAttrs.name || 'Senza Nome';
  const type = row.type || rawAttrs.type || rawAttrs.category || 'npc';
  const description = row.description || rawAttrs.description || '';

  // Recover quest status from attributes if available, otherwise check constraint column status
  let resolvedStatus = rawAttrs.uiStatus || rawAttrs.questStatus || row.status || 'alive';

  const rawImages = Array.isArray(rawAttrs.images) && rawAttrs.images.length > 0
    ? rawAttrs.images
    : row.image_url
    ? [row.image_url]
    : rawAttrs.imageUrl
    ? [rawAttrs.imageUrl]
    : [];
  const resolvedImages = resolveStorageUrlArray(rawImages, 'campaign-assets');
  const mainImage = resolveStorageUrl(row.image_url || rawAttrs.imageUrl || resolvedImages[0] || '', 'campaign-assets');

  return {
    id: entityId,
    _id: entityId,
    name,
    type,
    description,
    imageUrl: mainImage,
    images: resolvedImages,
    status: resolvedStatus,
    color: rawAttrs.color || '#3B82F6',
    aliases: Array.isArray(rawAttrs.aliases) ? rawAttrs.aliases : [],
    location: rawAttrs.location || undefined,
    role: rawAttrs.role || undefined,
    secretText: rawAttrs.secretText || undefined,
    isPublic: rawAttrs.isPublic ?? true,
    isPartyMember: Boolean(rawAttrs.isPartyMember),
    questScope: rawAttrs.questScope || undefined,
    assigneePlayerId: rawAttrs.assigneePlayerId || undefined,
    assigneePlayerName: rawAttrs.assigneePlayerName || undefined,
    sharedWithDm: rawAttrs.sharedWithDm ?? true,
    aiConfig: rawAttrs.aiConfig || undefined,
    tags: Array.isArray(rawAttrs.tags) ? rawAttrs.tags : [],
    customFields: rawAttrs.customFields || undefined,
    mapId: rawAttrs.mapId || undefined,
    pinId: rawAttrs.pinId || undefined,
    pinCategory: rawAttrs.pinCategory || undefined,
    pinX: rawAttrs.pinX ?? undefined,
    pinY: rawAttrs.pinY ?? undefined,
    isMap: Boolean(rawAttrs.isMap),
    mapImageUrl: rawAttrs.mapImageUrl || undefined,
    folderId: rawAttrs.folderId || undefined,
    audioLogs: Array.isArray(rawAttrs.audioLogs) ? rawAttrs.audioLogs : [],
    progressNote: rawAttrs.progressNote || '',
    body: rawAttrs.body || [],
    createdAt: row.created_at || rawAttrs.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || rawAttrs.updatedAt || new Date().toISOString(),
  };
}
export const entityRowToModel = fromDbEntity;

export function toDbEntity(
  entity: Entity,
  campaignCode: string,
  validIds?: { folderIds?: Set<string>; mapIds?: Set<string>; userIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const entityId = entity.id || entity._id;

  // Align status with CHECK constraint ("alive", "dead", "unknown", "archived")
  let sqlStatus: 'alive' | 'dead' | 'unknown' | 'archived' = 'alive';
  const entStatus = String(entity.status || '').toLowerCase().trim();
  if (entStatus === 'open') {
    sqlStatus = 'alive';
  } else if (entStatus === 'completed' || entStatus === 'archived') {
    sqlStatus = 'archived';
  } else if (entStatus === 'failed' || entStatus === 'destroyed' || entStatus === 'dead' || entStatus === 'deceased') {
    sqlStatus = 'dead';
  } else if (entStatus === 'unknown') {
    sqlStatus = 'unknown';
  } else {
    sqlStatus = 'alive';
  }

  const rawImages = Array.isArray(entity.images) && entity.images.length > 0
    ? entity.images
    : entity.imageUrl
    ? [entity.imageUrl]
    : [];
  const mainImage = entity.imageUrl || (rawImages.length > 0 ? rawImages[0] : '') || '';

  const attributes = {
    aliases: Array.isArray(entity.aliases) ? entity.aliases : [],
    location: entity.location || null,
    role: (entity as any).role || null,
    secretText: (entity as any).secretText || null,
    isPublic: (entity as any).isPublic ?? true,
    isPartyMember: Boolean((entity as any).isPartyMember),
    questScope: entity.questScope || null,
    assigneePlayerId: toNullableFk(entity.assigneePlayerId, validIds?.userIds),
    assigneePlayerName: entity.assigneePlayerName || null,
    sharedWithDm: (entity as any).sharedWithDm ?? true,
    aiConfig: entity.aiConfig || null,
    images: rawImages,
    tags: (entity as any).tags || [],
    uiStatus: entity.status,
    questStatus: (entity.type === 'quest' ? entity.status : (entity as any).questStatus) || entity.status,
    customFields: (entity as any).customFields || null,
    mapId: toNullableFk(entity.mapId, validIds?.mapIds),
    pinId: entity.pinId || null,
    pinCategory: entity.pinCategory || null,
    pinX: entity.pinX ?? null,
    pinY: entity.pinY ?? null,
    isMap: Boolean(entity.isMap),
    mapImageUrl: entity.mapImageUrl || null,
    folderId: toNullableFk(entity.folderId, validIds?.folderIds),
    color: entity.color || '#3B82F6',
    progressNote: (entity as any).progressNote || '',
    ...((entity as any).attributes || {}),
  };

  return {
    id: entityId,
    campaign_code: cleanCode,
    name: entity.name || 'Senza Nome',
    type: entity.type || 'npc',
    description: (entity.description || (entity as any).progressNote || '').trim(),
    image_url: mainImage || null,
    status: sqlStatus,
    attributes,
    created_at: entity.createdAt || (entity as any)._createdAt || new Date().toISOString(),
    updated_at: entity.updatedAt || new Date().toISOString(),
  };
}
export const entityModelToRow = toDbEntity;

// =========================================================================
// 4. NOTES ADAPTER (notes)
// =========================================================================
export function fromDbNote(
  row: any,
  notesMeta?: Record<string, any>
): Note {
  const meta = notesMeta?.[row.id] || {};
  const resolvedImages = resolveStorageUrlArray(
    Array.isArray(meta.images) ? meta.images : Array.isArray(row.images) ? row.images : [],
    'campaign-assets'
  );

  const noteId = String(row.id || '');
  const createdAt = row.created_at || meta.createdAt || new Date().toISOString();
  const updatedAt = row.updated_at || meta.updatedAt || new Date().toISOString();

  // Parse structured DM response or string reply, including packed metadata
  let metaPayload: any = {};
  let parsedDmResponse: any = undefined;
  if (row.dm_reply) {
    let parsed: any = null;
    if (typeof row.dm_reply === 'object') {
      parsed = row.dm_reply;
    } else if (typeof row.dm_reply === 'string') {
      const trimmed = row.dm_reply.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try { parsed = JSON.parse(trimmed); } catch {}
      }
    }
    if (parsed) {
      metaPayload = parsed;
      if (parsed.text || parsed.answeredBy) {
        parsedDmResponse = {
          text: parsed.text || '',
          answeredAt: parsed.answeredAt || updatedAt,
          answeredBy: parsed.answeredBy || 'Dungeon Master',
          isResolved: Boolean(parsed.isResolved),
        };
      }
    } else if (typeof row.dm_reply === 'string') {
      parsedDmResponse = {
        text: row.dm_reply,
        answeredAt: updatedAt,
        answeredBy: 'Dungeon Master',
      };
    }
  }

  // Unified visibility resolution
  const rowVis = String(row.visibility || 'group').toLowerCase();
  let visibility: 'personal' | 'group' = 'group';
  let dmOnly = Boolean(metaPayload.dmOnly);

  if (rowVis === 'dm_only') {
    visibility = 'group';
    dmOnly = true;
  } else if (rowVis === 'shared_with_dm') {
    visibility = 'personal';
    dmOnly = true;
  } else if (rowVis === 'private') {
    visibility = 'personal';
    dmOnly = false;
  } else {
    visibility = 'group';
    dmOnly = false;
  }

  return {
    id: noteId,
    _id: noteId,
    createdAt,
    updatedAt,
    _createdAt: createdAt,
    _updatedAt: updatedAt,
    title: row.title || 'Nota',
    content: row.content || '',
    visibility,
    dmOnly,
    canonState: meta.canonState || row.canon_state || 'canon',
    pinned: meta.pinned !== undefined ? Boolean(meta.pinned) : Boolean(row.is_pinned),
    tags: Array.isArray(meta.tags) ? meta.tags : Array.isArray(row.tags) ? row.tags : [],
    images: resolvedImages,
    loreDate: row.lore_date || meta.loreDate || undefined,
    askDm: Boolean(row.ask_dm),
    categoryId: row.category || row.category_id || undefined,
    sessionId: row.session_id || undefined,
    author: {
      _id: row.author_id || metaPayload.authorId || 'unknown',
      id: row.author_id || metaPayload.authorId || 'unknown',
      characterName: metaPayload.authorName || meta.authorName || 'Autore',
      isDm: metaPayload.authorIsDm !== undefined ? Boolean(metaPayload.authorIsDm) : dmOnly,
    },
    dmResponse: parsedDmResponse,
    hiddenForDm: Boolean(metaPayload.hiddenForDm || row.hidden_for_dm),
    hiddenForPlayerIds: Array.isArray(metaPayload.hiddenForPlayerIds) ? metaPayload.hiddenForPlayerIds : (Array.isArray(row.hidden_for_player_ids) ? row.hidden_for_player_ids : []),
  };
}
export const noteRowToModel = fromDbNote;

export function toDbNote(
  note: Note,
  campaignCode: string,
  validIds?: { userIds?: Set<string>; sessionIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();

  // Standardized visibility column: 'group' | 'private' | 'dm_only' | 'shared_with_dm'
  let unifiedVisibility: 'group' | 'private' | 'dm_only' | 'shared_with_dm' = 'group';
  if (note.dmOnly || (note.visibility as any) === 'dm_only' || (note as any).dm_only) {
    unifiedVisibility = 'dm_only';
  } else if (note.visibility === 'personal' && note.askDm) {
    unifiedVisibility = 'shared_with_dm';
  } else if (note.visibility === 'personal' || (note as any).visibility === 'private') {
    unifiedVisibility = 'private';
  } else {
    unifiedVisibility = 'group';
  }

  const authorIdVal = toNullableFk(note.author?.id || note.author?._id, validIds?.userIds);
  const sessionIdVal = toNullableFk((note as any).sessionId || (note as any).session?._id, validIds?.sessionIds);

  const dmReplyObj = {
    ...(note.dmResponse || {}),
    authorId: authorIdVal,
    authorName: note.author?.characterName || (note.author as any)?.name || 'Autore',
    authorIsDm: Boolean(note.author?.isDm),
    dmOnly: Boolean(note.dmOnly),
    hiddenForDm: Boolean((note as any).hiddenForDm),
    hiddenForPlayerIds: Array.isArray((note as any).hiddenForPlayerIds) ? (note as any).hiddenForPlayerIds : [],
  };

  return {
    id: note.id || note._id,
    campaign_code: cleanCode,
    author_id: authorIdVal,
    session_id: sessionIdVal,
    title: note.title || 'Nota',
    content: note.content || '',
    category: (note as any).category?._id || (note as any).categoryId || (note as any).category || null,
    lore_date: note.loreDate || null,
    visibility: unifiedVisibility,
    is_pinned: Boolean(note.pinned || (note as any).is_pinned),
    canon_state: note.canonState || (note as any).canon_state || 'canon',
    ask_dm: Boolean(note.askDm || (note as any).ask_dm),
    dm_reply: JSON.stringify(dmReplyObj),
    tags: Array.isArray(note.tags) ? note.tags : [],
    images: Array.isArray(note.images) ? note.images : [],
    created_at: note.createdAt || (note as any)._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const noteModelToRow = toDbNote;

// =========================================================================
// 5. WORLD MAPS ADAPTER (maps)
// =========================================================================
export function fromDbMap(
  row: any,
  mapsMeta?: Record<string, any>
): WorldMap {
  const meta = mapsMeta?.[row.id] || {};
  const rowVis = String(row.visibility || 'group').toLowerCase();

  let isSecret = false;
  let sharedWithDm = true;
  if (rowVis === 'shared_with_dm') {
    isSecret = true;
    sharedWithDm = true;
  } else if (rowVis === 'dm_only' || rowVis === 'private') {
    isSecret = true;
    sharedWithDm = false;
  }

  return {
    id: String(row.id || ''),
    title: row.title || 'Mappa',
    description: meta.description || row.description || '',
    folderId: row.folder_id || meta.folderId || undefined,
    entityId: row.entity_id || meta.entityId || undefined,
    imageUrl: resolveStorageUrl(row.image_url || meta.imageUrl || '', 'campaign-assets'),
    pins: Array.isArray(row.pins) ? row.pins : [],
    scaleLabel: row.scale_label || meta.scaleLabel || undefined,
    isDefault: Boolean(row.is_default || meta.isDefault),
    isSecret,
    sharedWithDm,
    visibility: (rowVis === 'shared_with_dm' || rowVis === 'dm_only') ? rowVis : 'group',
    createdAt: row.created_at || new Date().toISOString(),
  };
}
export const mapRowToModel = fromDbMap;

export function toDbMap(
  map: WorldMap,
  campaignCode: string,
  validIds?: { folderIds?: Set<string>; entityIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();

  // Visibility column: 'group' | 'dm_only' | 'shared_with_dm' (MAI 'public' o 'private')
  let unifiedVisibility: 'group' | 'dm_only' | 'shared_with_dm' = 'group';
  const rawVis = String((map as any).visibility || '').toLowerCase();
  if (rawVis === 'shared_with_dm') {
    unifiedVisibility = 'shared_with_dm';
  } else if (rawVis === 'dm_only' || rawVis === 'private' || rawVis === 'personal' || map.isSecret) {
    unifiedVisibility = 'dm_only';
  } else {
    unifiedVisibility = 'group';
  }

  const rawPins = Array.isArray(map.pins) ? map.pins : [];
  const rawFog = (map as any).fog_of_war || (map as any).fogOfWar || {};

  return {
    id: map.id,
    campaign_code: cleanCode,
    folder_id: toNullableFk(map.folderId, validIds?.folderIds),
    entity_id: toNullableFk((map as any).entityId || (map as any).placeEntityId, validIds?.entityIds),
    title: map.title || 'Mappa',
    description: map.description || '',
    image_url: map.imageUrl || '',
    scale_label: map.scaleLabel || '',
    pins: rawPins,
    fog_of_war: rawFog,
    is_default: Boolean((map as any).isDefault),
    visibility: unifiedVisibility,
    created_at: (map as any).createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const mapModelToRow = toDbMap;

export function fromDbMapFolder(row: any): MapFolder {
  return {
    id: String(row.id || ''),
    name: row.name || 'Cartella',
    color: row.color || '#3B82F6',
    description: row.description || '',
    placeEntityId: row.place_entity_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}
export const mapFolderRowToModel = fromDbMapFolder;

export function toDbMapFolder(
  folder: any,
  campaignCode: string,
  validIds?: { folderIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: folder.id,
    campaign_code: cleanCode,
    parent_id: toNullableFk(folder.parentId || folder.parent_id, validIds?.folderIds),
    name: folder.name || 'Cartella',
    order_index: typeof folder.orderIndex === 'number' ? folder.orderIndex : (typeof folder.order === 'number' ? folder.order : 0),
    created_at: folder.createdAt || new Date().toISOString(),
  };
}
export const mapFolderModelToRow = toDbMapFolder;

// =========================================================================
// 6. SCRAPBOOK ADAPTER (scrapbook)
// =========================================================================
export function fromDbScrapbook(row: any): ScrapbookItem {
  const rowVis = String(row.visibility || 'group').toLowerCase();
  let isSecret = false;
  let sharedWithDm = true;

  if (rowVis === 'shared_with_dm') {
    isSecret = true;
    sharedWithDm = true;
  } else if (rowVis === 'private' || rowVis === 'dm_only') {
    isSecret = true;
    sharedWithDm = false;
  }

  return {
    id: String(row.id || ''),
    title: row.title || '',
    imageUrl: resolveStorageUrl(row.image_url || '', 'campaign-assets'),
    caption: row.caption || row.description || '',
    authorName: row.author_id || '',
    category: row.category || 'moment',
    loreDate: row.lore_date || undefined,
    sessionId: row.session_id || undefined,
    entityId: row.entity_id || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isSecret,
    sharedWithDm,
    createdAt: row.created_at || new Date().toISOString(),
  };
}
export const scrapbookRowToModel = fromDbScrapbook;

export function toDbScrapbook(
  item: ScrapbookItem,
  campaignCode: string,
  validIds?: { userIds?: Set<string>; sessionIds?: Set<string>; entityIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const desc = item.caption || (item as any).description || '';

  let unifiedVisibility: 'group' | 'private' | 'shared_with_dm' = 'group';
  if (item.isSecret) {
    unifiedVisibility = item.sharedWithDm ? 'shared_with_dm' : 'private';
  }

  return {
    id: item.id,
    campaign_code: cleanCode,
    author_id: null,
    title: item.title || '',
    caption: desc,
    image_url: item.imageUrl || '',
    category: item.category || 'moment',
    aspect_ratio: (item as any).aspectRatio || 'square',
    tags: Array.isArray(item.tags) ? item.tags : [],
    session_id: toNullableFk(item.sessionId, validIds?.sessionIds),
    entity_id: toNullableFk(item.entityId, validIds?.entityIds),
    lore_date: item.loreDate || null,
    visibility: unifiedVisibility,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const scrapbookModelToRow = toDbScrapbook;

// =========================================================================
// 7. AUDIO LOGS ADAPTER (audio_logs)
// =========================================================================
export function fromDbAudioLog(row: any): AudioLog {
  const sessId = row.session_id || undefined;
  const entId = row.entity_id || undefined;
  const durationSec = Number(row.duration ?? 0);

  return {
    id: String(row.id || ''),
    title: row.title || 'Audio Log',
    audioUrl: resolveStorageUrl(row.audio_url || '', 'audio-logs'),
    durationSeconds: durationSec,
    recordedBy: row.author_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    loreDate: row.lore_date || undefined,
    associatedType: sessId ? 'session' : (entId ? 'entity' : 'general'),
    associatedId: sessId || entId || undefined,
  };
}
export const audioLogRowToModel = fromDbAudioLog;

export function toDbAudioLog(
  log: AudioLog,
  campaignCode: string,
  validIds?: { sessionIds?: Set<string>; entityIds?: Set<string>; userIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const sessId = log.associatedType === 'session' ? toNullableFk(log.associatedId, validIds?.sessionIds) : null;
  const entId = log.associatedType === 'entity' ? toNullableFk(log.associatedId, validIds?.entityIds) : null;

  return {
    id: log.id,
    campaign_code: cleanCode,
    author_id: null,
    session_id: sessId,
    entity_id: entId,
    title: log.title || 'Audio Log',
    audio_url: log.audioUrl || '',
    duration: Number(log.durationSeconds || (log as any).duration || 0),
    lore_date: log.loreDate || null,
    created_at: log.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const audioLogModelToRow = toDbAudioLog;

// =========================================================================
// 8. FAMILY RELATIONS ADAPTER (family_relations)
// =========================================================================
export function fromDbFamilyRelation(
  row: any,
  entitiesMap?: Map<string, Entity>
): CharacterRelationship {
  const targetId = row.target_entity_id || '';
  let targetEnt = targetId ? entitiesMap?.get(targetId) : null;
  if (!targetEnt && targetId) {
    try {
      targetEnt = CampaignManager.getEntities().find((e) => (e.id || e._id) === targetId) || null;
    } catch {}
  }

  // Unpack relMeta from tags JSONB
  let relMeta: any = null;
  let userTags: string[] = [];
  if (row.tags && typeof row.tags === 'object') {
    if (row.tags.__relMeta) {
      relMeta = row.tags;
      userTags = Array.isArray(row.tags.userTags) ? row.tags.userTags : [];
    } else if (Array.isArray(row.tags)) {
      const metaObj = row.tags.find((t: any) => t && typeof t === 'object' && t.__relMeta);
      if (metaObj) {
        relMeta = metaObj;
        userTags = row.tags.filter((t: any) => typeof t === 'string');
      } else {
        userTags = row.tags.filter((t: any) => typeof t === 'string');
      }
    }
  }

  const resolvedName = relMeta?.name || targetEnt?.name || 'Parente';
  const resolvedAvatar = relMeta?.avatarUrl || targetEnt?.imageUrl || '';
  let resolvedStatus: 'alive' | 'deceased' | 'missing' | 'undead' | 'unknown' = 'alive';
  if (relMeta?.status) {
    resolvedStatus = relMeta.status;
  } else if (targetEnt) {
    if (targetEnt.status === 'dead') resolvedStatus = 'deceased';
    else if (targetEnt.status === 'unknown') resolvedStatus = 'unknown';
    else resolvedStatus = 'alive';
  }

  const resolvedRole = relMeta?.titleOrRole || (targetEnt as any)?.role || (targetEnt as any)?.attributes?.titleOrRole || '';

  return {
    id: row.id,
    playerId: relMeta?.playerId || row.source_entity_id || row.linked_player_id || '',
    name: resolvedName,
    avatarUrl: resolvedAvatar,
    status: resolvedStatus,
    titleOrRole: resolvedRole,
    relationshipType: row.relationship_type || 'family',
    customRelationshipLabel: row.custom_label || '',
    customLabel: row.custom_label || '',
    generationCategory: row.generation_category || 'same_generation',
    genealogyRole: relMeta?.genealogyRole || undefined,
    sideOfFamily: row.side_of_family || 'unspecified',
    bio: row.description || targetEnt?.description || '',
    secondParentId: row.second_parent_id || undefined,
    linkedEntityId: relMeta?.linkedEntityId || targetId || undefined,
    targetEntityId: targetId || undefined,
    linkedPlayerId: row.linked_player_id || undefined,
    tags: userTags,
    order: Number(row.order_index ?? 0),
    createdAt: row.created_at || row.updated_at,
    sharedWithParty: !Boolean(row.is_secret),
    otherParentName: relMeta?.otherParentName || undefined,
    trustLevel: relMeta?.trustLevel,
    attitude: relMeta?.attitude,
  };
}
export const familyRelationRowToModel = fromDbFamilyRelation;

export function toDbFamilyRelation(
  rel: CharacterRelationship,
  campaignCode: string,
  validIds?: { entityIds?: Set<string>; playerIds?: Set<string> }
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const targetEntityId = rel.targetEntityId || rel.linkedEntityId;

  const relMeta = {
    __relMeta: true,
    playerId: rel.playerId,
    linkedEntityId: rel.linkedEntityId,
    name: rel.name,
    avatarUrl: rel.avatarUrl,
    titleOrRole: rel.titleOrRole,
    genealogyRole: rel.genealogyRole,
    status: rel.status,
    otherParentName: (rel as any).otherParentName,
    trustLevel: (rel as any).trustLevel,
    attitude: (rel as any).attitude,
    userTags: Array.isArray(rel.tags) ? rel.tags : [],
  };

  return {
    id: rel.id,
    campaign_code: cleanCode,
    source_entity_id: rel.playerId || (rel as any).sourceEntityId || '',
    target_entity_id: toNullableFk(targetEntityId, validIds?.entityIds),
    relationship_type: rel.relationshipType || 'family',
    description: rel.bio || '',
    is_secret: Boolean(rel.sharedWithParty === false || (rel as any).isSecret),
    custom_label: rel.customRelationshipLabel || rel.customLabel || '',
    generation_category: rel.generationCategory || 'same_generation',
    side_of_family: rel.sideOfFamily || 'unspecified',
    second_parent_id: toNullableFk(rel.secondParentId),
    linked_player_id: toNullableFk(rel.playerId || rel.linkedPlayerId, validIds?.playerIds),
    tags: relMeta,
    order_index: Number(rel.order ?? 0),
    created_at: rel.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const familyRelationModelToRow = toDbFamilyRelation;

// =========================================================================
// 9. CHARACTER BIOS ADAPTER (character_bios)
// =========================================================================
export function fromDbCharacterBio(row: any): CharacterBio {
  const extra = (row.extra_data && typeof row.extra_data === 'object') ? row.extra_data : {};
  
  let personalityTraits: string[] = [];
  if (Array.isArray(row.personality_traits)) {
    personalityTraits = row.personality_traits;
  } else if (typeof row.personality === 'string' && row.personality.trim()) {
    personalityTraits = row.personality.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (Array.isArray(extra.personalityTraits)) {
    personalityTraits = extra.personalityTraits;
  }

  let timelineMemories: any[] = [];
  if (Array.isArray(row.timeline_memories)) {
    timelineMemories = row.timeline_memories;
  } else if (typeof row.timeline_memories === 'string' && row.timeline_memories.trim()) {
    try { timelineMemories = JSON.parse(row.timeline_memories); } catch {}
  } else if (Array.isArray(extra.timelineMemories)) {
    timelineMemories = extra.timelineMemories;
  }

  let evolvingBeliefs: any[] = [];
  if (Array.isArray(row.evolving_beliefs)) {
    evolvingBeliefs = row.evolving_beliefs;
  } else if (typeof row.evolving_beliefs === 'string' && row.evolving_beliefs.trim()) {
    try { evolvingBeliefs = JSON.parse(row.evolving_beliefs); } catch {}
  } else if (Array.isArray(extra.evolvingBeliefs)) {
    evolvingBeliefs = extra.evolvingBeliefs;
  }

  let knownLoreBites: any[] = [];
  if (Array.isArray(row.known_lore_bites)) {
    knownLoreBites = row.known_lore_bites;
  } else if (typeof row.known_lore_bites === 'string' && row.known_lore_bites.trim()) {
    try { knownLoreBites = JSON.parse(row.known_lore_bites); } catch {}
  } else if (Array.isArray(extra.knownLoreBites)) {
    knownLoreBites = extra.knownLoreBites;
  }

  let interPartyRelations: Record<string, any> = {};
  if (row.inter_party_relations && typeof row.inter_party_relations === 'object') {
    interPartyRelations = row.inter_party_relations;
  } else if (typeof row.inter_party_relations === 'string' && row.inter_party_relations.trim()) {
    try { interPartyRelations = JSON.parse(row.inter_party_relations); } catch {}
  } else if (extra.interPartyRelations && typeof extra.interPartyRelations === 'object') {
    interPartyRelations = extra.interPartyRelations;
  }

  const resolvedCharName = row.character_name || row.name || extra.characterName || extra.name || '';

  // Calculate runtime birthDateFormatted from start_day, month, year
  const bDay = row.birth_start_day ?? extra.birthStartDay;
  const bMonth = row.birth_month || extra.birthMonth || '';
  const bYear = row.birth_year ?? extra.birthYear;
  let computedBirthFormatted = '';
  if (bDay || bMonth || bYear) {
    computedBirthFormatted = [bDay, bMonth, bYear ? `${bYear} DR` : ''].filter(Boolean).join(' ');
  }

  return {
    playerId: row.player_id,
    campaignCode: row.campaign_code || undefined,
    entityId: row.entity_id || undefined,
    characterName: resolvedCharName,
    name: resolvedCharName,
    avatarUrl: resolveStorageUrl(row.avatar_url || extra.avatarUrl, 'chronicle-media'),
    color: row.color || extra.color || '#6366f1',
    bio: row.bio || extra.bio || '',
    notes: row.background || row.notes || extra.notes || '',
    characterClass: row.class_level || row.character_class || extra.characterClass || '',
    characterRace: row.character_race || extra.characterRace || '',
    characterTitle: row.character_title || extra.characterTitle || '',
    characterAlignment: row.alignment || row.character_alignment || extra.characterAlignment || '',
    deityOrPatron: row.deity_or_patron || extra.deityOrPatron || '',
    hometown: row.hometown || extra.hometown || '',
    birthDateFormatted: computedBirthFormatted || row.birth_date_formatted || extra.birthDateFormatted || '',
    birthStartDay: typeof bDay === 'number' ? bDay : 1,
    birthMonth: bMonth,
    birthYear: typeof bYear === 'number' ? bYear : 1492,
    backstoryMarkdown: row.background || row.backstory_markdown || extra.backstoryMarkdown || row.notes || row.bio || '',
    personalityTraits,
    ideals: row.ideals || extra.ideals || '',
    bonds: row.bonds || extra.bonds || '',
    flaws: row.flaws || extra.flaws || '',
    secrets: row.secrets || extra.secrets || '',
    appearanceDescription: row.appearance_description || extra.appearanceDescription || '',
    currentStatus: row.current_status || extra.currentStatus || '',
    traits: Array.isArray(row.traits) ? row.traits : (Array.isArray(extra.traits) ? extra.traits : []),
    stats: (row.stats && typeof row.stats === 'object') ? row.stats : (extra.stats || {}),
    privacySettings: row.privacy_settings || extra.privacySettings || { isBioPublic: true, isStatsPublic: true, isBackgroundPublic: false, isSecretsPublic: false },
    timelineMemories,
    evolvingBeliefs,
    interPartyRelations,
    knownLoreBites,
    updatedAt: row.updated_at || extra.updatedAt || new Date().toISOString(),
  };
}
export const characterBioRowToModel = fromDbCharacterBio;

export function toDbCharacterBio(
  bio: CharacterBio,
  campaignCode?: string,
  validIds?: { entityIds?: Set<string> }
): Record<string, any> {
  const code = campaignCode || bio.campaignCode || '';
  const cleanCode = code ? code.trim().toUpperCase() : '';
  const charName = bio.characterName || (bio as any).name || '';
  const personalityTraitsArray = Array.isArray(bio.personalityTraits)
    ? bio.personalityTraits
    : (typeof (bio as any).personality === 'string' && (bio as any).personality.trim()
      ? (bio as any).personality.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []);
  const classVal = bio.characterClass || (bio as any).classLevel || '';
  const alignmentVal = bio.characterAlignment || (bio as any).alignment || '';
  const bgVal = bio.backstoryMarkdown || bio.notes || bio.bio || '';
  const personalityStr = personalityTraitsArray.join(', ');

  return {
    player_id: bio.playerId,
    campaign_code: cleanCode,
    entity_id: toNullableFk(bio.entityId || (bio as any).entity_id, validIds?.entityIds),
    name: charName,
    avatar_url: bio.avatarUrl || null,
    color: bio.color || '#6366f1',
    background: bgVal,
    class_level: classVal,
    alignment: alignmentVal,
    personality: personalityStr,
    ideals: bio.ideals || '',
    bonds: bio.bonds || '',
    flaws: bio.flaws || '',
    secrets: typeof bio.secrets === 'string' ? bio.secrets : JSON.stringify(bio.secrets || ''),
    privacy_settings: bio.privacySettings || { isBioPublic: true, isStatsPublic: true, isBackgroundPublic: false, isSecretsPublic: false },
    timeline_memories: Array.isArray(bio.timelineMemories) ? bio.timelineMemories : [],
    evolving_beliefs: Array.isArray(bio.evolvingBeliefs) ? bio.evolvingBeliefs : [],
    inter_party_relations: (bio.interPartyRelations && typeof bio.interPartyRelations === 'object') ? bio.interPartyRelations : {},
    known_lore_bites: Array.isArray(bio.knownLoreBites) ? bio.knownLoreBites : [],
    character_title: bio.characterTitle || '',
    character_race: bio.characterRace || '',
    deity_or_patron: bio.deityOrPatron || '',
    hometown: bio.hometown || '',
    birth_start_day: typeof bio.birthStartDay === 'number' ? bio.birthStartDay : 1,
    birth_month: bio.birthMonth || '',
    birth_year: typeof bio.birthYear === 'number' ? bio.birthYear : 1492,
    appearance_description: bio.appearanceDescription || '',
    current_status: bio.currentStatus || '',
    extra_data: {
      ...(bio.birthDateFormatted ? { birthDateFormatted: bio.birthDateFormatted } : {}),
      ...(Array.isArray(bio.traits) && bio.traits.length > 0 ? { traits: bio.traits } : {}),
      ...(bio.stats && typeof bio.stats === 'object' && Object.keys(bio.stats).length > 0 ? { stats: bio.stats } : {}),
    },
    updated_at: new Date().toISOString(),
  };
}
export const characterBioModelToRow = toDbCharacterBio;

// =========================================================================
// 10. WORLD LORE ARTICLES ADAPTER (world_lore_articles)
// =========================================================================
export function fromDbWorldLoreArticle(row: any): any {
  if (!row) return null;

  // Unpack associated entities from article_entities relation
  const relatedEntityIds: string[] = Array.isArray(row.article_entities)
    ? row.article_entities.map((ae: any) => ae.entity_id).filter(Boolean)
    : (Array.isArray(row.related_entity_ids) ? row.related_entity_ids : []);

  return {
    _id: String(row.id || ''),
    id: String(row.id || ''),
    campaignCode: row.campaign_code,
    title: row.title || 'Senza Titolo',
    subtitle: row.subtitle || '',
    summary: row.summary || '',
    content: row.content || '',
    fullContentMarkdown: row.content || '',
    category: row.category_id || 'general',
    categoryId: row.category_id || 'general',
    dmOnly: Boolean(row.is_draft),
    isDraft: Boolean(row.is_draft),
    authorId: row.author_id || '',
    authorPlayerId: row.author_id || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    relatedEntityIds,
    images: Array.isArray(row.images) ? resolveStorageUrlArray(row.images) : [],
    bites: Array.isArray(row.bites) ? row.bites : [],
    order: Number(row.order_index ?? 0),
    orderIndex: Number(row.order_index ?? 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}
export const worldLoreArticleRowToModel = fromDbWorldLoreArticle;

export function toDbWorldLoreArticle(
  art: any,
  campaignCode: string,
  validIds?: { userIds?: Set<string> }
): Record<string, any> {
  const code = campaignCode.trim().toUpperCase();
  return {
    id: art._id || art.id,
    campaign_code: code,
    author_id: toNullableFk(art.authorPlayerId || art.authorId, validIds?.userIds),
    title: art.title || 'Senza Titolo',
    subtitle: art.subtitle || '',
    summary: art.summary || '',
    content: art.fullContentMarkdown || art.content || '',
    category_id: art.category || art.categoryId || 'general',
    images: Array.isArray(art.images) ? art.images : [],
    is_draft: Boolean(art.dmOnly ?? art.isDraft),
    bites: Array.isArray(art.bites) ? art.bites : [],
    tags: Array.isArray(art.tags) ? art.tags : [],
    order_index: Number(art.order ?? art.orderIndex ?? 0),
    created_at: art.createdAt || art._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export const worldLoreArticleModelToRow = toDbWorldLoreArticle;

// =========================================================================
// 11. CAMPAIGN MEMBERS ADAPTER (campaign_members)
// =========================================================================
export function fromDbCampaignMember(row: any): CampaignMemberRecord {
  const rawPerms = row?.permissions || {};
  const permissions: CampaignMemberPermissions = {
    canCreateSessions: rawPerms.canCreateSessions ?? rawPerms.can_create_sessions ?? true,
    canEditSessions: rawPerms.canEditSessions ?? rawPerms.can_edit_sessions ?? false,
    canDeleteSessions: rawPerms.canDeleteSessions ?? rawPerms.can_delete_sessions ?? false,
    canCreateEntities: rawPerms.canCreateEntities ?? rawPerms.can_create_entities ?? false,
    canEditEntities: rawPerms.canEditEntities ?? rawPerms.can_edit_entities ?? false,
    canDeleteEntities: rawPerms.canDeleteEntities ?? rawPerms.can_delete_entities ?? false,
    canCreateLore: rawPerms.canCreateLore ?? rawPerms.can_create_lore ?? false,
    canEditLore: rawPerms.canEditLore ?? rawPerms.can_edit_lore ?? false,
    canDeleteLore: rawPerms.canDeleteLore ?? rawPerms.can_delete_lore ?? false,
    canManageMaps: rawPerms.canManageMaps ?? rawPerms.can_manage_maps ?? false,
  };

  const role: CampaignRole = normalizeCampaignRole(row?.role);
  const characterName = rawPerms.character_name || rawPerms.characterName || '';

  return {
    campaignCode: (row?.campaign_code || '').trim().toUpperCase(),
    userId: String(row?.user_id || ''),
    role,
    characterName: characterName || undefined,
    status: (row?.status || 'active').toLowerCase() as any,
    permissions,
    createdAt: row?.created_at,
  };
}
export const campaignMemberRowToModel = fromDbCampaignMember;

export function toDbCampaignMember(member: CampaignMemberRecord): Record<string, any> {
  const code = (member.campaignCode || '').trim().toUpperCase();
  const perms = member.permissions || {};
  const permissionsJson = {
    can_create_sessions: perms.can_create_sessions ?? perms.canCreateSessions ?? true,
    can_edit_sessions: perms.can_edit_sessions ?? perms.canEditSessions ?? false,
    can_delete_sessions: perms.can_delete_sessions ?? perms.canDeleteSessions ?? false,
    can_create_entities: perms.can_create_entities ?? perms.canCreateEntities ?? false,
    can_edit_entities: perms.can_edit_entities ?? perms.canEditEntities ?? false,
    can_delete_entities: perms.can_delete_entities ?? perms.canDeleteEntities ?? false,
    can_create_lore: perms.can_create_lore ?? perms.canCreateLore ?? false,
    can_edit_lore: perms.can_edit_lore ?? perms.canEditLore ?? false,
    can_delete_lore: perms.can_delete_lore ?? perms.canDeleteLore ?? false,
    can_manage_maps: perms.can_manage_maps ?? perms.canManageMaps ?? false,
    character_name: member.characterName || (member as any).character_name || '',
  };

  const role: CampaignRole = normalizeCampaignRole(member.role);

  return {
    id: `${code}_${member.userId}`,
    campaign_code: code,
    user_id: member.userId,
    role,
    status: member.status || 'active',
    permissions: permissionsJson,
    created_at: member.createdAt || new Date().toISOString(),
  };
}
export const campaignMemberModelToRow = toDbCampaignMember;
