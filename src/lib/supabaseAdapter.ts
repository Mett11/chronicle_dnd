import { supabase } from './supabase';
import {
  CampaignChapter,
  Session,
  SessionEvent,
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
 * Handles both public bucket paths (e.g. 'covers/img.jpg') and full URLs.
 */
export function resolveStorageUrl(
  pathOrUrl: string | null | undefined,
  defaultBucket: string = 'campaign-assets'
): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';

  // If already a full URL, Base64 data, or Blob URL, return directly
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

    // Detect explicit bucket prefix in path
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

function finalPathSlice(path: string, prefix: string) {
  // helper to silence noop
}

/**
 * Resolves an array of image paths/URLs into clean public URLs.
 */
export function resolveStorageUrlArray(
  images: any[] | null | undefined,
  defaultBucket: string = 'campaign-assets'
): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => {
      if (typeof item === 'string') return resolveStorageUrl(item, defaultBucket);
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return resolveStorageUrl(item.url, defaultBucket);
      }
      return '';
    })
    .filter(Boolean);
}

// =========================================================================
// 1. CHAPTERS ADAPTER
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
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 2. SESSIONS ADAPTER
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

  // Parse recap
  let recapData: any = row.recap;
  if (!recapData || (Array.isArray(recapData) && recapData.length === 0)) {
    recapData = row.summary || meta.recap || [];
  }
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

  // Parse lore date
  let parsedLoreDate: string | undefined = undefined;
  if (typeof row.calendar_date === 'string') {
    parsedLoreDate = row.calendar_date;
  } else if (row.calendar_date && typeof row.calendar_date === 'object') {
    parsedLoreDate = JSON.stringify(row.calendar_date);
  } else if (meta.loreDate) {
    parsedLoreDate = meta.loreDate;
  }

  // Parse events with full preservation of images, audio, lore dates, event types, etc.
  const rawEvents = Array.isArray(row.plot_events)
    ? row.plot_events
    : Array.isArray(meta.events)
    ? meta.events
    : [];

  const cleanEvents: SessionEvent[] = rawEvents.map((evt: any, idx: number) => ({
    id: evt.id || `evt_${idx}_${Date.now()}`,
    title: evt.title || 'Evento',
    description: evt.description || '',
    loreDate: evt.loreDate || parsedLoreDate,
    loreStartDay: evt.loreStartDay !== undefined ? evt.loreStartDay : undefined,
    loreEndDay: evt.loreEndDay !== undefined ? evt.loreEndDay : undefined,
    loreMonth: evt.loreMonth || undefined,
    loreEndMonth: evt.loreEndMonth || undefined,
    loreYear: evt.loreYear !== undefined ? evt.loreYear : undefined,
    loreEndYear: evt.loreEndYear !== undefined ? evt.loreEndYear : undefined,
    impact: evt.impact || 'normal',
    eventType: evt.eventType || 'mixed',
    involvedCharacters: Array.isArray(evt.involvedCharacters) ? evt.involvedCharacters : [],
    linkedEntityIds: Array.isArray(evt.linkedEntityIds) ? evt.linkedEntityIds : [],
    images: Array.isArray(evt.images) ? evt.images : [],
    audioLogs: Array.isArray(evt.audioLogs) ? evt.audioLogs : [],
    location: evt.location || undefined,
    sessionNumber: evt.sessionNumber || Number(row.number) || 1,
    isSecret: Boolean(evt.isSecret || evt.impact === 'secret'),
  }));

  // Resolve images array
  const rawImages = Array.isArray(meta.images) && meta.images.length > 0
    ? meta.images
    : Array.isArray(row.images)
    ? row.images
    : [];
  const resolvedImages = resolveStorageUrlArray(rawImages, 'campaign-assets');

  // Resolve cover image
  const rawCover =
    row.cover_image_url ||
    row.cover_image ||
    meta.coverImage ||
    (resolvedImages.length > 0 ? resolvedImages[0] : '');
  const resolvedCover = resolveStorageUrl(rawCover, 'campaign-assets');

  return {
    _id: rowId,
    number: Number(row.number) || 1,
    title: row.title || `Sessione ${row.number || 1}`,
    date: row.date_str || row.date || new Date().toISOString().split('T')[0],
    chapterId: row.chapter_id || meta.chapterId || undefined,
    chapterName: row.chapter_name || meta.chapterName || undefined,
    loreDate: parsedLoreDate,
    events: cleanEvents,
    recap: recapData,
    images: resolvedImages,
    coverImage: resolvedCover || undefined,
    entitiesExtracted: Boolean(meta.entitiesExtracted ?? row.entities_extracted),
    entitiesExtractedAt: meta.entitiesExtractedAt || row.entities_extracted_at || undefined,
    memorySynced: Boolean(meta.memorySynced ?? row.memory_synced),
    memorySyncedAt: meta.memorySyncedAt || row.memory_synced_at || undefined,
    sessionType: row.session_type || meta.sessionType || 'mixed',
    quotes: Array.isArray(meta.quotes) ? meta.quotes : Array.isArray(row.quotes) ? row.quotes : [],
    audioLogs: Array.isArray(meta.audioLogs) ? meta.audioLogs : Array.isArray(row.audio_logs) ? row.audio_logs : [],
    excludedPlayerIds: Array.isArray(meta.excludedPlayerIds) ? meta.excludedPlayerIds : Array.isArray(row.excluded_player_ids) ? row.excluded_player_ids : [],
    attendees: Array.isArray(meta.attendees) ? meta.attendees : Array.isArray(row.attendees) ? row.attendees : [],
    tags: Array.isArray(row.tags) ? row.tags : Array.isArray(meta.tags) ? meta.tags : [],
  };
}

export function sessionModelToRow(
  session: Session,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: session._id,
    campaign_code: cleanCode,
    number: session.number || 1,
    title: session.title || `Sessione ${session.number || 1}`,
    date_str: session.date || new Date().toISOString().split('T')[0],
    chapter_id: session.chapterId || null,
    calendar_date: session.loreDate || null,
    plot_events: session.events || [],
    recap: session.recap || [],
    summary: typeof session.recap === 'string' ? session.recap : JSON.stringify(session.recap || []),
    images: session.images || [],
    cover_image_url: typeof session.coverImage === 'string' ? session.coverImage : (session.coverImage as any)?.url || null,
    session_type: session.sessionType || 'mixed',
    quotes: session.quotes || [],
    audio_logs: session.audioLogs || [],
    excluded_player_ids: session.excludedPlayerIds || [],
    attendees: session.attendees || [],
    tags: session.tags || [],
    entities_extracted: Boolean(session.entitiesExtracted),
    entities_extracted_at: session.entitiesExtractedAt || null,
    memory_synced: Boolean(session.memorySynced),
    memory_synced_at: session.memorySyncedAt || null,
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 3. ENTITIES (CODEX) ADAPTER
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
    };
  }

  const customAttrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
  const entityType = row.type || customAttrs.type || customAttrs.category || 'npc';

  const rawImages = Array.isArray(customAttrs.images) && customAttrs.images.length > 0
    ? customAttrs.images
    : row.image_url
    ? [row.image_url]
    : [];
  const resolvedImages = resolveStorageUrlArray(rawImages, 'campaign-assets');
  const mainImage = resolveStorageUrl(row.image_url || resolvedImages[0] || '', 'campaign-assets');

  return {
    _id: String(row.id || ''),
    name: row.name || 'Senza Nome',
    type: entityType,
    description: row.description || '',
    imageUrl: mainImage,
    images: resolvedImages,
    status: row.status || 'alive',
    ...customAttrs,
    aliases: Array.isArray(customAttrs.aliases) ? customAttrs.aliases : [],
    progressNote: customAttrs.progressNote || '',
    aiConfig: customAttrs.aiConfig || undefined,
    body: customAttrs.body || [],
    location: customAttrs.location || undefined,
    mapId: customAttrs.mapId || undefined,
    pinId: customAttrs.pinId || undefined,
  };
}

export function entityModelToRow(
  entity: Entity,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  const { _id, name, type, description, imageUrl, images, status, ...restAttributes } = entity;
  return {
    id: _id,
    campaign_code: cleanCode,
    name: name || 'Senza Nome',
    type: type || 'npc',
    description: description || '',
    image_url: imageUrl || (images && images.length > 0 ? images[0] : null),
    status: status || 'alive',
    attributes: {
      ...restAttributes,
      images: images || [],
    },
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 4. NOTES ADAPTER
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
    askDm: Boolean(row.ask_dm),
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
  };
}

export function noteModelToRow(
  note: Note,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    id: note._id,
    campaign_code: cleanCode,
    title: note.title || 'Nota',
    content: note.content || '',
    visibility: note.visibility || 'group',
    is_dm_only: Boolean(note.dmOnly),
    is_pinned: Boolean(note.pinned),
    canon_state: note.canonState || 'canon',
    author_id: note.author?._id || 'unknown',
    author_name: note.author?.characterName || 'Giocatore',
    author_is_dm: Boolean(note.author?.isDm),
    ask_dm: Boolean(note.askDm),
    dm_reply: note.dmResponse?.text || null,
    tags: note.tags || [],
    images: note.images || [],
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 5. WORLD MAPS ADAPTER
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
    folder_id: map.folderId || null,
    image_url: map.imageUrl || '',
    pins: map.pins || [],
    scale_label: map.scaleLabel || null,
    is_default: Boolean(map.isDefault),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 6. SCRAPBOOK ADAPTER
// =========================================================================
export function scrapbookRowToModel(row: any): ScrapbookItem {
  return {
    id: String(row.id || ''),
    title: row.title || '',
    imageUrl: resolveStorageUrl(row.image_url || '', 'campaign-assets'),
    caption: row.caption || '',
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
  return {
    id: item.id,
    campaign_code: cleanCode,
    title: item.title || '',
    image_url: item.imageUrl || '',
    caption: item.caption || '',
    created_by: item.authorName || '',
    category: item.category || 'moment',
    lore_date: item.loreDate || null,
    session_id: item.sessionId || null,
    entity_id: item.entityId || null,
    tags: item.tags || [],
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 7. AUDIO LOGS ADAPTER
// =========================================================================
export function audioLogRowToModel(row: any): AudioLog {
  return {
    id: String(row.id || ''),
    title: row.title || 'Diario Audio',
    audioUrl: resolveStorageUrl(row.audio_url || '', 'audio-logs'),
    durationSeconds: Number(row.duration || row.duration_seconds || 0),
    recordedBy: row.recorded_by || '',
    createdAt: row.created_at || new Date().toISOString(),
    loreDate: row.lore_date || undefined,
    associatedType: row.associated_type || undefined,
    associatedId: row.associated_id || undefined,
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
    title: log.title || 'Diario Audio',
    audio_url: log.audioUrl || '',
    duration: log.durationSeconds || 0,
    recorded_by: log.recordedBy || '',
    lore_date: log.loreDate || null,
    associated_type: log.associatedType || null,
    associated_id: log.associatedId || null,
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 8. CHARACTER BIOS ADAPTER
// =========================================================================
export function characterBioRowToModel(row: any): CharacterBio {
  return {
    playerId: row.player_id,
    campaignCode: row.campaign_code,
    characterName: row.name || '',
    name: row.name || '',
    avatarUrl: resolveStorageUrl(row.avatar_url || '', 'user-avatars'),
    color: row.color || '#6366f1',
    bio: row.bio || '',
    notes: row.notes || '',
    traits: row.traits || {},
    stats: row.stats || {},
    status: row.status || 'active',
    characterTitle: row.character_title || '',
    characterClass: row.character_class || row.class_level || '',
    characterRace: row.character_race || '',
    characterAlignment: row.character_alignment || row.alignment || '',
    deityOrPatron: row.deity_or_patron || '',
    hometown: row.hometown || '',
    birthDateFormatted: row.birth_date_formatted || '',
    birthStartDay: row.birth_start_day !== undefined ? Number(row.birth_start_day) : undefined,
    birthMonth: row.birth_month || '',
    birthYear: row.birth_year !== undefined ? Number(row.birth_year) : undefined,
    backstoryMarkdown: row.backstory_markdown || row.background || '',
    personalityTraits: Array.isArray(row.personality_traits) ? row.personality_traits : (row.personality ? [row.personality] : []),
    ideals: row.ideals || '',
    bonds: row.bonds || '',
    flaws: row.flaws || '',
    secrets: row.secrets || '',
    appearanceDescription: row.appearance_description || '',
    currentStatus: row.current_status || '',
    timelineMemories: Array.isArray(row.timeline_memories) ? row.timeline_memories : [],
    evolvingBeliefs: Array.isArray(row.evolving_beliefs) ? row.evolving_beliefs : [],
    interPartyRelations: row.inter_party_relations && typeof row.inter_party_relations === 'object' ? row.inter_party_relations : {},
    knownLoreBites: Array.isArray(row.known_lore_bites) ? row.known_lore_bites : [],
    privacySettings: row.privacy_settings && typeof row.privacy_settings === 'object' ? row.privacy_settings : {},
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function characterBioModelToRow(
  bio: CharacterBio,
  campaignCode: string
): Record<string, any> {
  const cleanCode = campaignCode.trim().toUpperCase();
  return {
    player_id: bio.playerId,
    campaign_code: cleanCode,
    name: bio.characterName || bio.name || '',
    avatar_url: bio.avatarUrl || '',
    color: bio.color || '#6366f1',
    bio: bio.bio || '',
    notes: bio.notes || '',
    traits: bio.traits || {},
    stats: bio.stats || {},
    status: bio.status || 'active',
    character_title: bio.characterTitle || '',
    character_class: bio.characterClass || '',
    class_level: bio.characterClass || '',
    character_race: bio.characterRace || '',
    character_alignment: bio.characterAlignment || '',
    alignment: bio.characterAlignment || '',
    deity_or_patron: bio.deityOrPatron || '',
    hometown: bio.hometown || '',
    birth_date_formatted: bio.birthDateFormatted || '',
    birth_start_day: bio.birthStartDay || null,
    birth_month: bio.birthMonth || null,
    birth_year: bio.birthYear || null,
    backstory_markdown: bio.backstoryMarkdown || '',
    background: bio.backstoryMarkdown || '',
    personality_traits: bio.personalityTraits || [],
    personality: Array.isArray(bio.personalityTraits) ? bio.personalityTraits.join(', ') : '',
    ideals: bio.ideals || '',
    bonds: bio.bonds || '',
    flaws: bio.flaws || '',
    secrets: bio.secrets || '',
    appearance_description: bio.appearanceDescription || '',
    current_status: bio.currentStatus || '',
    timeline_memories: bio.timelineMemories || [],
    evolving_beliefs: bio.evolvingBeliefs || [],
    inter_party_relations: bio.interPartyRelations || {},
    known_lore_bites: bio.knownLoreBites || [],
    privacy_settings: bio.privacySettings || {},
    updated_at: new Date().toISOString(),
  };
}
