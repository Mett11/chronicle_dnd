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
  if (typeof row.lore_date === 'string') {
    parsedLoreDate = row.lore_date;
  } else if (row.lore_date && typeof row.lore_date === 'object') {
    parsedLoreDate = row.lore_date.formatted || JSON.stringify(row.lore_date);
  } else if (row.lore_formatted) {
    parsedLoreDate = row.lore_formatted;
  } else if (meta.loreDate) {
    parsedLoreDate = meta.loreDate;
  }

  return {
    _id: rowId,
    number: Number(row.number || meta.number || 1),
    date: row.date || row.date_str || meta.date || new Date().toISOString().split('T')[0],
    title: String(row.title || meta.title || `Sessione ${row.number || 1}`).trim(),
    sessionType: row.session_type || meta.sessionType || 'mixed',
    chapterId: row.chapter_id || meta.chapterId || undefined,
    linkedEntityIds: Array.isArray(row.linked_entity_ids) ? row.linked_entity_ids : meta.linkedEntityIds || [],
    loreDate: parsedLoreDate,
    loreStartDay: row.lore_day || meta.loreStartDay || undefined,
    loreMonth: row.lore_month ? String(row.lore_month) : meta.loreMonth || undefined,
    loreYear: row.lore_year || meta.loreYear || undefined,
    recap: recapData,
    events: Array.isArray(row.events) ? row.events : (Array.isArray(row.plot_events) ? row.plot_events : meta.events || []),
    images: Array.isArray(row.images) ? resolveStorageUrlArray(row.images) : meta.images || [],
    audioLogs: meta.audioLogs || [],
    entitiesExtracted: Boolean(row.entities_extracted ?? meta.entitiesExtracted),
    memorySynced: Boolean(row.memory_synced ?? meta.memorySynced),
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

  return {
    id: session._id,
    campaign_code: cleanCode,
    chapter_id: session.chapterId || null,
    number: session.number || 1,
    title: session.title || `Sessione ${session.number || 1}`,
    date: sessionDate,
    date_str: sessionDate,
    calendar_date: sessionDate,
    session_type: session.sessionType || 'mixed',
    linked_entity_ids: Array.isArray(session.linkedEntityIds) ? session.linkedEntityIds : [],
    lore_date: session.loreDate ? (typeof session.loreDate === 'object' ? session.loreDate : { formatted: session.loreDate }) : null,
    recap: typeof session.recap === 'string' ? session.recap : JSON.stringify(session.recap || []),
    summary: summaryStr,
    events: session.events || [],
    plot_events: session.events || [],
    images: session.images || [],
    audio_url: typeof session.coverImage === 'string' ? session.coverImage : null,
    entities_extracted: Boolean(session.entitiesExtracted),
    memory_synced: Boolean(session.memorySynced),
    updated_at: new Date().toISOString(),
    lore_day: session.loreStartDay || null,
    lore_month: session.loreMonth ? parseInt(session.loreMonth) || null : null,
    lore_year: session.loreYear || null,
    lore_formatted: typeof session.loreDate === 'string' ? session.loreDate : null,
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
    };
  }

  const customAttrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
  const entityType = row.type || customAttrs.type || customAttrs.category || 'npc';

  const rawImages = Array.isArray(customAttrs.images) && customAttrs.images.length > 0
    ? customAttrs.images
    : customAttrs.imageUrl
    ? [customAttrs.imageUrl]
    : [];
  const resolvedImages = resolveStorageUrlArray(rawImages, 'campaign-assets');
  const mainImage = resolveStorageUrl(customAttrs.imageUrl || resolvedImages[0] || '', 'campaign-assets');

  return {
    _id: String(row.id || ''),
    name: row.name || 'Senza Nome',
    type: entityType,
    description: row.description || '',
    imageUrl: mainImage,
    images: resolvedImages,
    status: customAttrs.status || 'alive',
    isSecret: Boolean(row.is_secret ?? customAttrs.isSecret),
    isHidden: Boolean(row.is_hidden ?? customAttrs.isHidden),
    relatedEntityIds: Array.isArray(row.related_entity_ids) ? row.related_entity_ids : customAttrs.relatedEntityIds || [],
    loreBites: row.lore_bites || customAttrs.loreBites || [],
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
    attributes: {
      ...restAttributes,
      status: status || 'alive',
      imageUrl: imageUrl || (images && images.length > 0 ? images[0] : null),
      images: images || [],
    },
    is_secret: Boolean((entity as any).isSecret),
    is_hidden: Boolean((entity as any).isHidden),
    related_entity_ids: Array.isArray((entity as any).relatedEntityIds) ? (entity as any).relatedEntityIds : [],
    lore_bites: (entity as any).loreBites || [],
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
    category: (note as any).category || (note as any).categoryId || null,
    session_id: (note as any).sessionId || null,
    tags: note.tags || [],
    images: note.images || [],
    lore_date: (note as any).loreDate ? (typeof (note as any).loreDate === 'object' ? (note as any).loreDate : { formatted: (note as any).loreDate }) : null,
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
    pins: map.pins || [],
    fog_of_war: (map as any).fogOfWar || null,
    is_default: Boolean(map.isDefault),
    is_secret: Boolean((map as any).isSecret || (map as any).sharedWithDm === false),
    shared_with_dm: Boolean((map as any).sharedWithDm !== false),
    updated_at: new Date().toISOString(),
  };
}

// =========================================================================
// 6. SCRAPBOOK ADAPTER (scrapbook_items)
// =========================================================================
export function scrapbookRowToModel(row: any): ScrapbookItem {
  return {
    id: String(row.id || ''),
    title: row.title || '',
    imageUrl: resolveStorageUrl(row.image_url || '', 'campaign-assets'),
    caption: row.description || row.caption || '',
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
    description: desc,
    image_url: item.imageUrl || '',
    created_by: item.authorName || '',
    category: item.category || 'moment',
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
    durationSeconds: row.duration_seconds || undefined,
    recordedBy: row.recorded_by || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    loreDate: row.lore_date || undefined,
    associatedType: row.associated_type || (row.session_id ? 'session' : row.entity_id ? 'entity' : 'general'),
    associatedId: row.session_id || row.entity_id || row.associated_id || undefined,
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
    session_id: log.associatedType === 'session' ? log.associatedId || null : null,
    entity_id: log.associatedType === 'entity' ? log.associatedId || null : null,
    title: log.title || 'Audio Log',
    audio_url: log.audioUrl || '',
    transcript: (log as any).transcript || null,
    created_at: log.createdAt || new Date().toISOString(),
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
    timelineMemories: Array.isArray(row.timeline_memories) 
      ? row.timeline_memories 
      : (Array.isArray(extra.timelineMemories) ? extra.timelineMemories : []),
    evolvingBeliefs: Array.isArray(row.evolving_beliefs) 
      ? row.evolving_beliefs 
      : (Array.isArray(extra.evolvingBeliefs) ? extra.evolvingBeliefs : []),
    interPartyRelations: (row.inter_party_relations && typeof row.inter_party_relations === 'object') 
      ? row.inter_party_relations 
      : (extra.interPartyRelations || {}),
    knownLoreBites: Array.isArray(row.known_lore_bites) 
      ? row.known_lore_bites 
      : (Array.isArray(extra.knownLoreBites) ? extra.knownLoreBites : []),
    updatedAt: row.updated_at || extra.updatedAt || new Date().toISOString(),
  };
}

export function characterBioModelToRow(bio: CharacterBio, campaignCode?: string): Record<string, any> {
  const code = campaignCode || bio.campaignCode || '';
  const cleanCode = code ? code.trim().toUpperCase() : '';
  const charName = bio.characterName || (bio as any).name || 'Personaggio';
  const personalityStr = Array.isArray(bio.personalityTraits) ? bio.personalityTraits.join(', ') : '';

  return {
    player_id: bio.playerId,
    campaign_code: cleanCode,
    name: charName,
    character_name: charName,
    avatar_url: bio.avatarUrl || null,
    color: bio.color || '#6366f1',
    bio: bio.bio || bio.notes || null,
    class_level: bio.characterClass || '',
    alignment: bio.characterAlignment || '',
    background: bio.backstoryMarkdown || bio.notes || bio.bio || '',
    personality: personalityStr,
    ideals: bio.ideals || '',
    bonds: bio.bonds || '',
    flaws: bio.flaws || '',
    character_race: bio.characterRace || '',
    character_title: bio.characterTitle || '',
    deity_or_patron: bio.deityOrPatron || '',
    hometown: bio.hometown || '',
    birth_date_formatted: bio.birthDateFormatted || '',
    birth_start_day: typeof bio.birthStartDay === 'number' ? bio.birthStartDay : 1,
    birth_month: bio.birthMonth || '',
    birth_year: typeof bio.birthYear === 'number' ? bio.birthYear : 1492,
    secrets: typeof bio.secrets === 'string' ? bio.secrets : JSON.stringify(bio.secrets || ''),
    appearance_description: bio.appearanceDescription || '',
    current_status: bio.currentStatus || '',
    timeline_memories: Array.isArray(bio.timelineMemories) ? bio.timelineMemories : [],
    evolving_beliefs: Array.isArray(bio.evolvingBeliefs) ? bio.evolvingBeliefs : [],
    inter_party_relations: bio.interPartyRelations || {},
    known_lore_bites: Array.isArray(bio.knownLoreBites) ? bio.knownLoreBites : [],
    privacy_settings: bio.privacySettings || { isBioPublic: true, isStatsPublic: true, isBackgroundPublic: false, isSecretsPublic: false },
    extra_data: {
      traits: bio.traits || [],
      stats: bio.stats || {},
      personalityTraits: bio.personalityTraits || [],
      characterClass: bio.characterClass || '',
      characterRace: bio.characterRace || '',
      characterTitle: bio.characterTitle || '',
      characterAlignment: bio.characterAlignment || '',
      deityOrPatron: bio.deityOrPatron || '',
      hometown: bio.hometown || '',
      birthDateFormatted: bio.birthDateFormatted || '',
      birthStartDay: bio.birthStartDay,
      birthMonth: bio.birthMonth,
      birthYear: bio.birthYear,
      backstoryMarkdown: bio.backstoryMarkdown || '',
      secrets: bio.secrets || '',
      appearanceDescription: bio.appearanceDescription || '',
      currentStatus: bio.currentStatus || '',
      knownLoreBites: bio.knownLoreBites || [],
      updatedAt: bio.updatedAt || new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}
