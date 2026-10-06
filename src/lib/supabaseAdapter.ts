import { supabase } from './supabase';
import {
  CampaignChapter,
  Session,
  Entity,
  Note,
  WorldMap,
  ScrapbookItem,
  AudioLog,
  CharacterBio,
} from '../types';

/**
 * =========================================================================
 * AUTHORITATIVE CENTRAL SUPABASE ADAPTER
 * Single Source of Truth for Data Conversion between Supabase and Frontend
 * =========================================================================
 */

/**
 * Resolves any Supabase storage path or external URL to a fully qualified public URL.
 */
export function resolveStorageUrl(
  pathOrUrl: string | null | undefined,
  defaultBucket: string = 'campaign-assets'
): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (
    !trimmed ||
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
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  try {
    let cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    let targetBucket = defaultBucket;

    if (cleanPath.startsWith('chronicle-media/')) {
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
// 1. CHAPTERS ADAPTER (campaign_chapters)
// =========================================================================
export function chapterRowToModel(
  row: any,
  dossierMeta?: Record<string, any>
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
  const metaObj = dossierMeta?.[rowId] || dossierMeta?.[title] || {};

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
    name: title,
    description: String(row.synopsis || row.description || metaObj.description || '').trim(),
    order: Number(row.order_index ?? row.number ?? metaObj.order ?? 1),
    color: row.color || metaObj.color || '#6366f1',
    coverImageUrl: resolveStorageUrl(rawCover, 'campaign-assets'),
    createdAt: row.created_at || metaObj.createdAt || new Date().toISOString(),
  };
}

export function chapterModelToRow(
  chapter: CampaignChapter,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: chapter.id,
    campaign_code: cleanCode,
    number: chapter.order || 1,
    title: chapter.name || 'Capitolo',
    synopsis: chapter.description || '',
    status: 'in_progress',
    order_index: chapter.order || 0,
    cover_image_url: chapter.coverImageUrl || '',
    color: chapter.color || '#6366f1',
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 2. SESSIONS ADAPTER (sessions)
// =========================================================================
export function sessionRowToModel(
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

  let recapData: any = row.recap || meta.recap || [];
  if (typeof recapData === 'string') {
    const trimmed = recapData.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        recapData = JSON.parse(trimmed);
      } catch {}
    }
  }

  let parsedLoreDate: string | undefined = undefined;
  if (typeof row.calendar_date === 'string' && row.calendar_date.trim()) {
    parsedLoreDate = row.calendar_date.trim();
  } else if (typeof row.lore_date === 'string' && row.lore_date.trim()) {
    parsedLoreDate = row.lore_date.trim();
  } else if (row.lore_date && typeof row.lore_date === 'object') {
    parsedLoreDate = row.lore_date.formatted || JSON.stringify(row.lore_date);
  } else if (row.lore_formatted && String(row.lore_formatted).trim()) {
    parsedLoreDate = String(row.lore_formatted).trim();
  } else if (meta.loreDate) {
    parsedLoreDate = meta.loreDate;
  }

  const excludedPlayerIds = Array.isArray(row.excluded_player_ids)
    ? row.excluded_player_ids
    : (meta.excludedPlayerIds || []);

  const attendeePlayerIds = Array.isArray(row.attendee_player_ids)
    ? row.attendee_player_ids
    : (meta.attendeePlayerIds || []);

  const attendees = Array.isArray(row.attendees)
    ? row.attendees
    : (meta.attendees || []);

  const realDate = row.date_str || row.date || meta.date || new Date().toISOString().split('T')[0];

  return {
    _id: rowId,
    number: Number(row.number || meta.number || 1),
    date: realDate,
    title: String(row.title || meta.title || `Sessione ${row.number || 1}`).trim(),
    sessionType: row.session_type || meta.sessionType || 'mixed',
    chapterId: row.chapter_id || meta.chapterId || undefined,
    chapterName: row.chapter_name || undefined,
    linkedEntityIds: Array.isArray(row.linked_entity_ids) ? row.linked_entity_ids : (meta.linkedEntityIds || []),
    loreDate: parsedLoreDate,
    loreStartDay: row.lore_day || meta.loreStartDay || undefined,
    loreMonth: row.lore_month ? String(row.lore_month) : meta.loreMonth || undefined,
    loreYear: row.lore_year || meta.loreYear || undefined,
    recap: recapData,
    events: Array.isArray(row.events) ? row.events : (Array.isArray(row.plot_events) ? row.plot_events : meta.events || []),
    images: Array.isArray(row.images) ? resolveStorageUrlArray(row.images) : (meta.images || []),
    audioLogs: Array.isArray(row.audio_logs) ? row.audio_logs : (meta.audioLogs || []),
    excludedPlayerIds,
    attendeePlayerIds,
    attendees,
    entitiesExtracted: Boolean(row.entities_extracted ?? meta.entitiesExtracted),
    memorySynced: Boolean(row.memory_synced ?? meta.memorySynced),
    quotes: Array.isArray(row.quotes) ? row.quotes : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    gazetteConfig: row.gazette_config || undefined,
    entitiesExtractedAt: row.entities_extracted_at || undefined,
    memorySyncedAt: row.memory_synced_at || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function sessionModelToRow(
  session: Session,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const sessionDate = session.date || new Date().toISOString().split('T')[0];
  const summaryStr = typeof session.recap === 'string'
    ? session.recap
    : (Array.isArray(session.recap) ? session.recap.join('\n') : '');

  const rawRecap: any = (session as any).recap;
  const recapArray = Array.isArray(rawRecap)
    ? rawRecap
    : (typeof rawRecap === 'string' && rawRecap.trim()
        ? [rawRecap]
        : []);

  let loreDateFormatted: string | null = null;
  if (session.loreDate) {
    if (typeof session.loreDate === 'object') {
      loreDateFormatted = (session.loreDate as any).formatted || null;
    } else {
      loreDateFormatted = String(session.loreDate).trim();
    }
  }

  const excludedPlayerIds = Array.isArray(session.excludedPlayerIds) ? session.excludedPlayerIds : [];
  const attendees = Array.isArray(session.attendees) ? session.attendees : [];
  const coverImage = (session as any).coverImageUrl || (session as any).coverImage || (Array.isArray(session.images) && session.images[0]) || null;
  const audioUrl = (session as any).audioUrl || null;

  return {
    id: session._id,
    campaign_code: cleanCode,
    chapter_id: session.chapterId || null,
    number: session.number || 1,
    title: session.title || `Sessione ${session.number || 1}`,
    date_str: sessionDate,
    calendar_date: loreDateFormatted || (typeof session.loreDate === 'string' ? session.loreDate : null),
    plot_events: Array.isArray(session.events) ? session.events : [],
    recap: recapArray,
    summary: summaryStr,
    images: Array.isArray(session.images) ? session.images : [],
    cover_image_url: coverImage,
    audio_url: audioUrl,
    session_type: session.sessionType || 'mixed',
    quotes: Array.isArray((session as any).quotes) ? (session as any).quotes : [],
    audio_logs: Array.isArray(session.audioLogs) ? session.audioLogs : [],
    excluded_player_ids: excludedPlayerIds,
    attendees: attendees,
    tags: Array.isArray((session as any).tags) ? (session as any).tags : [],
    entities_extracted: Boolean(session.entitiesExtracted),
    entities_extracted_at: (session as any).entitiesExtractedAt || null,
    memory_synced: Boolean(session.memorySynced),
    memory_synced_at: (session as any).memorySyncedAt || null,
    created_at: (session as any).createdAt || (session as any)._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 3. ENTITIES (CODEX) ADAPTER (entities)
// =========================================================================
export function entityRowToModel(row: any): Entity {
  if (!row) {
    return {
      _id: `ent_${Date.now()}`,
      name: 'Nuova Entità',
      type: 'npc',
      description: '',
      imageUrl: '',
      images: [],
      status: 'alive',
      color: '#3B82F6',
    };
  }

  const customAttrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
  const entityType = row.type || customAttrs.type || customAttrs.category || 'npc';

  const rawImages = Array.isArray(customAttrs.images) && customAttrs.images.length > 0
    ? customAttrs.images
    : row.image_url
    ? [row.image_url]
    : customAttrs.imageUrl
    ? [customAttrs.imageUrl]
    : [];
  const resolvedImages = resolveStorageUrlArray(rawImages, 'campaign-assets');
  const mainImage = resolveStorageUrl(row.image_url || customAttrs.imageUrl || resolvedImages[0] || '', 'campaign-assets');

  return {
    _id: String(row.id || ''),
    name: row.name || 'Senza Nome',
    type: entityType,
    description: row.description || '',
    imageUrl: mainImage,
    images: resolvedImages,
    status: row.status || customAttrs.status || 'alive',
    color: row.color || customAttrs.color || '#3B82F6',
    aliases: Array.isArray(row.aliases) ? row.aliases : (Array.isArray(customAttrs.aliases) ? customAttrs.aliases : []),
    mapId: row.map_id || customAttrs.mapId || undefined,
    isSecret: Boolean(row.is_secret ?? customAttrs.isSecret),
    isHidden: Boolean(row.is_hidden ?? customAttrs.isHidden),
    relatedEntityIds: Array.isArray(row.related_entity_ids) ? row.related_entity_ids : (customAttrs.relatedEntityIds || []),
    loreBites: Array.isArray(row.lore_bites) ? row.lore_bites : (customAttrs.loreBites || []),
    ...customAttrs,
    progressNote: customAttrs.progressNote || '',
    aiConfig: customAttrs.aiConfig || undefined,
    body: customAttrs.body || [],
    location: customAttrs.location || undefined,
    pinId: customAttrs.pinId || undefined,
  };
}

export function entityModelToRow(
  entity: Entity,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const { _id, name, type, description, imageUrl, images, status, color, aliases, mapId, ...restAttributes } = entity as any;
  const rawImages = Array.isArray(images) && images.length > 0
    ? images
    : imageUrl
    ? [imageUrl]
    : [];
  const mainImage = imageUrl || (rawImages.length > 0 ? rawImages[0] : '') || '';
  const resolvedColor = color || (restAttributes as any).color || '#3B82F6';
  const resolvedStatus = status || (restAttributes as any).status || 'alive';
  const resolvedAliases = Array.isArray(aliases) ? aliases : ((restAttributes as any).aliases || []);
  const resolvedMapId = mapId || (restAttributes as any).mapId || null;

  return {
    id: _id,
    campaign_code: cleanCode,
    name: name || 'Senza Nome',
    type: type || 'npc',
    description: description || '',
    image_url: mainImage || null,
    status: resolvedStatus,
    attributes: {
      ...restAttributes,
      status: resolvedStatus,
      color: resolvedColor,
      imageUrl: mainImage,
      images: rawImages,
      aliases: resolvedAliases,
      mapId: resolvedMapId,
      isSecret: Boolean((entity as any).isSecret),
      isHidden: Boolean((entity as any).isHidden),
      relatedEntityIds: Array.isArray((entity as any).relatedEntityIds) ? (entity as any).relatedEntityIds : [],
      loreBites: Array.isArray((entity as any).loreBites) ? (entity as any).loreBites : [],
    },
    created_at: (entity as any).createdAt || (entity as any)._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 4. NOTES ADAPTER (notes)
// =========================================================================
export function noteRowToModel(
  row: any,
  notesMeta?: Record<string, any>
): Note {
  const meta = notesMeta?.[row.id] || {};
  const resolvedImages = resolveStorageUrlArray(
    Array.isArray(meta.images) ? meta.images : Array.isArray(row.images) ? row.images : [],
    'campaign-assets'
  );

  return {
    _id: String(row.id || ''),
    _createdAt: row.created_at || new Date().toISOString(),
    title: row.title || 'Nota',
    content: row.content || '',
    visibility: row.visibility === 'personal' ? 'personal' : 'group',
    dmOnly: meta.dmOnly !== undefined ? Boolean(meta.dmOnly) : Boolean(row.is_dm_only),
    canonState: meta.canonState || row.canon_state || 'canon',
    pinned: meta.pinned !== undefined ? Boolean(meta.pinned) : Boolean(row.is_pinned),
    tags: Array.isArray(meta.tags) ? meta.tags : Array.isArray(row.tags) ? row.tags : [],
    images: resolvedImages,
    loreDate: row.lore_date || meta.loreDate || undefined,
    askDm: Boolean(row.ask_dm),
    categoryId: row.category || row.category_id || undefined,
    sessionId: row.session_id || undefined,
    author: {
      _id: row.author_id || 'unknown',
      characterName: row.author_name || 'Giocatore',
      isDm: Boolean(row.author_is_dm),
    },
    dmResponse: row.dm_reply
      ? {
          text: row.dm_reply,
          answeredAt: row.updated_at || new Date().toISOString(),
          answeredBy: 'Dungeon Master',
        }
      : undefined,
    hiddenForDm: Boolean(row.hidden_for_dm),
    hiddenForPlayerIds: Array.isArray(row.hidden_for_player_ids) ? row.hidden_for_player_ids : [],
  };
}

export function noteModelToRow(
  note: Note,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const categoryVal = (note as any).categoryId || (note as any).category || 'general';
  let loreDateFormatted: string | null = null;
  if ((note as any).loreDate) {
    if (typeof (note as any).loreDate === 'object') {
      loreDateFormatted = (note as any).loreDate.formatted || JSON.stringify((note as any).loreDate);
    } else {
      loreDateFormatted = String((note as any).loreDate);
    }
  }

  return {
    id: note._id,
    campaign_code: cleanCode,
    author_id: note.author?._id || 'unknown',
    author_name: note.author?.characterName || 'Giocatore',
    title: note.title || 'Nota',
    content: note.content || '',
    category: categoryVal,
    session_id: (note as any).sessionId || null,
    lore_date: loreDateFormatted,
    visibility: note.visibility || 'group',
    is_dm_only: Boolean(note.dmOnly),
    is_pinned: Boolean(note.pinned),
    canon_state: note.canonState || 'canon',
    tags: Array.isArray(note.tags) ? note.tags : [],
    images: Array.isArray(note.images) ? note.images : [],
    author_is_dm: Boolean(note.author?.isDm),
    ask_dm: Boolean(note.askDm),
    dm_reply: note.dmResponse?.text || null,
    created_at: (note as any)._createdAt || (note as any).createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 5. WORLD MAPS ADAPTER (maps)
// =========================================================================
export function mapRowToModel(
  row: any,
  mapsMeta?: Record<string, any>
): WorldMap {
  const meta = mapsMeta?.[row.id] || {};
  return {
    id: String(row.id || ''),
    title: row.title || 'Mappa',
    description: meta.description || row.description || '',
    folderId: meta.folderId || row.folder_id || undefined,
    imageUrl: resolveStorageUrl(row.image_url || meta.imageUrl || '', 'campaign-assets'),
    pins: Array.isArray(row.pins) ? row.pins : [],
    scaleLabel: row.scale_label || meta.scaleLabel || undefined,
    isDefault: Boolean(row.is_default || meta.isDefault),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapModelToRow(
  map: WorldMap,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: map.id,
    campaign_code: cleanCode,
    title: map.title || 'Mappa',
    description: map.description || '',
    image_url: map.imageUrl || '',
    scale_label: map.scaleLabel || '',
    folder_id: map.folderId || null,
    entity_id: (map as any).entityId || null,
    pins: map.pins || [],
    fog_of_war: (map as any).fogOfWar || {},
    is_default: Boolean(map.isDefault),
    is_secret: Boolean((map as any).isSecret || (map as any).sharedWithDm === false),
    shared_with_dm: Boolean((map as any).sharedWithDm !== false),
    created_at: (map as any).createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 6. SCRAPBOOK ADAPTER (scrapbook)
// =========================================================================
export function scrapbookRowToModel(row: any): ScrapbookItem {
  return {
    id: String(row.id || ''),
    title: row.title || '',
    imageUrl: resolveStorageUrl(row.image_url || '', 'campaign-assets'),
    caption: row.caption || row.description || '',
    authorName: row.created_by || row.author_name || '',
    category: row.category || 'moment',
    loreDate: row.lore_date || undefined,
    sessionId: row.session_id || undefined,
    entityId: row.entity_id || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function scrapbookModelToRow(
  item: ScrapbookItem,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const desc = item.caption || (item as any).description || '';
  return {
    id: item.id,
    campaign_code: cleanCode,
    title: item.title || '',
    caption: desc,
    image_url: item.imageUrl || '',
    created_by: item.authorName || '',
    category: item.category || 'moment',
    aspect_ratio: (item as any).aspectRatio || 'square',
    tags: Array.isArray(item.tags) ? item.tags : [],
    session_id: item.sessionId || null,
    entity_id: item.entityId || null,
    lore_date: item.loreDate || null,
    is_secret: Boolean((item as any).isSecret),
    shared_with_dm: Boolean((item as any).sharedWithDm !== false),
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 7. AUDIO LOGS ADAPTER (audio_logs)
// =========================================================================
export function audioLogRowToModel(row: any): AudioLog {
  return {
    id: String(row.id || ''),
    title: row.title || 'Audio Log',
    audioUrl: resolveStorageUrl(row.audio_url || '', 'audio-logs'),
    durationSeconds: Number(row.duration ?? row.duration_seconds ?? 0),
    recordedBy: row.recorded_by || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    loreDate: row.lore_date || undefined,
    associatedType: row.associated_type || (row.session_id ? 'session' : row.entity_id ? 'entity' : 'general'),
    associatedId: row.associated_id || row.session_id || row.entity_id || undefined,
  };
}

export function audioLogModelToRow(
  log: AudioLog,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: log.id,
    campaign_code: cleanCode,
    title: log.title || 'Audio Log',
    audio_url: log.audioUrl || '',
    duration: log.durationSeconds || (log as any).duration || 0,
    recorded_by: log.recordedBy || '',
    lore_date: log.loreDate || null,
    associated_type: log.associatedType || 'general',
    associated_id: log.associatedId || null,
    created_at: log.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 8. CHARACTER BIOS ADAPTER (character_bios)
// =========================================================================
export function characterBioRowToModel(row: any): CharacterBio {
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

  return {
    playerId: row.player_id,
    campaignCode: row.campaign_code || undefined,
    characterName: row.character_name || row.name || extra.characterName || extra.name || 'Personaggio',
    name: row.name || row.character_name || extra.name || extra.characterName || 'Personaggio',
    avatarUrl: resolveStorageUrl(row.avatar_url || extra.avatarUrl, 'user-avatars'),
    color: row.color || extra.color || '#6366f1',
    bio: row.bio || extra.bio || '',
    notes: row.background || row.notes || extra.notes || '',
    characterClass: row.class_level || row.character_class || extra.characterClass || '',
    characterRace: row.character_race || extra.characterRace || '',
    characterTitle: row.character_title || extra.characterTitle || '',
    characterAlignment: row.alignment || row.character_alignment || extra.characterAlignment || '',
    deityOrPatron: row.deity_or_patron || extra.deityOrPatron || '',
    hometown: row.hometown || extra.hometown || '',
    birthDateFormatted: row.birth_date_formatted || extra.birthDateFormatted || '',
    birthStartDay: row.birth_start_day ?? extra.birthStartDay ?? 1,
    birthMonth: row.birth_month || extra.birthMonth || '',
    birthYear: row.birth_year ?? extra.birthYear ?? 1492,
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

export function characterBioModelToRow(bio: CharacterBio, campaignCode?: string): Record<string, any> {
  const code = campaignCode || bio.campaignCode || '';
  const cleanCode = code ? code.trim().toUpperCase() : '';
  const charName = bio.characterName || (bio as any).name || 'Personaggio';
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
    name: charName,
    character_name: charName,
    avatar_url: bio.avatarUrl || null,
    color: bio.color || '#6366f1',
    bio: bio.bio || bio.notes || null,
    background: bgVal,
    class_level: classVal,
    character_class: classVal,
    alignment: alignmentVal,
    character_alignment: alignmentVal,
    personality: personalityStr,
    personality_traits: personalityTraitsArray,
    traits: Array.isArray(bio.traits) ? bio.traits : [],
    stats: (bio.stats && typeof bio.stats === 'object') ? bio.stats : {},
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
    birth_date_formatted: bio.birthDateFormatted || '',
    birth_start_day: typeof bio.birthStartDay === 'number' ? bio.birthStartDay : 1,
    birth_month: bio.birthMonth || '',
    birth_year: typeof bio.birthYear === 'number' ? bio.birthYear : 1492,
    appearance_description: bio.appearanceDescription || '',
    current_status: bio.currentStatus || '',
    ideals: bio.ideals || '',
    bonds: bio.bonds || '',
    flaws: bio.flaws || '',
    extra_data: {
      ...bio,
      characterName: charName,
      characterClass: classVal,
      characterAlignment: alignmentVal,
      backstoryMarkdown: bgVal,
      personalityTraits: personalityTraitsArray,
      updatedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 9. WORLD LORE ARTICLES ADAPTER (world_lore_articles)
// =========================================================================
export function worldLoreArticleRowToModel(row: any): any {
  if (!row) return null;
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
    authorPlayerId: row.author_player_id || row.author_id || '',
    authorName: row.author_name || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    relatedEntityIds: Array.isArray(row.related_entity_ids) ? row.related_entity_ids : [],
    images: Array.isArray(row.images) ? resolveStorageUrlArray(row.images) : [],
    bites: Array.isArray(row.bites) ? row.bites : [],
    order: Number(row.order_index ?? 0),
    orderIndex: Number(row.order_index ?? 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function worldLoreArticleModelToRow(art: any, campaignCode: string): Record<string, any> {
  const code = campaignCode.trim().toUpperCase();
  return {
    id: art._id || art.id,
    campaign_code: code,
    title: art.title || 'Senza Titolo',
    subtitle: art.subtitle || '',
    summary: art.summary || '',
    content: art.fullContentMarkdown || art.content || '',
    category_id: art.category || art.categoryId || 'general',
    is_draft: Boolean(art.dmOnly ?? art.isDraft),
    author_id: art.authorId || art.authorPlayerId || null,
    author_player_id: art.authorPlayerId || art.authorId || null,
    author_name: art.authorName || '',
    tags: Array.isArray(art.tags) ? art.tags : [],
    related_entity_ids: Array.isArray(art.relatedEntityIds) ? art.relatedEntityIds : [],
    images: Array.isArray(art.images) ? art.images : [],
    bites: Array.isArray(art.bites) ? art.bites : [],
    order_index: typeof art.order === 'number' ? art.order : (typeof art.orderIndex === 'number' ? art.orderIndex : 0),
    created_at: art.createdAt || art._createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
