import { Entity } from '../types';

export interface OrphanMentionInfo {
  name: string;
  normalized: string;
  occurrences: number;
  snippets: string[];
}

/**
 * Normalizes a string for comparison (removes accents, punctuation, lowercase).
 */
export function normalizeMentionKey(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Deterministically extracts all @ mentions from markdown / plain text.
 * Supports:
 * - @[Multi Word Entity Name] (bracketed)
 * - @SingleWordEntity (with accents, letters, underscores, hyphens)
 */
export function extractAllMentions(text: string): string[] {
  if (!text || typeof text !== 'string' || !text.includes('@')) return [];

  const mentionsSet = new Set<string>();

  // 1. Bracketed mentions: @[Full Name With Spaces]
  const bracketRegex = /@\[(.*?)\]/g;
  let match: RegExpExecArray | null;
  while ((match = bracketRegex.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (raw && raw.length > 0 && !raw.startsWith('http')) {
      mentionsSet.add(raw);
    }
  }

  // 2. Single-word mentions: @EntityName (skip email addresses or bracketed ones)
  // Match @Word preceded by whitespace, start of line, or punctuation (not inside [ ])
  const singleWordRegex = /(?<![a-zA-Z0-9_[\u00C0-\u017F])@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g;
  while ((match = singleWordRegex.exec(text)) !== null) {
    const raw = match[1]?.trim();
    // Filter out obvious numbers or single characters
    if (raw && raw.length > 1 && !/^\d+$/.test(raw)) {
      // Remove trailing punctuation like dots or commas
      const clean = raw.replace(/[.,;:!?]+$/, '').trim();
      if (clean && !clean.includes('@')) {
        mentionsSet.add(clean);
      }
    }
  }

  return Array.from(mentionsSet);
}

/**
 * Extracts contextual snippets around where a mention occurs in the text.
 */
export function extractSnippetsForMention(text: string, mentionName: string, maxSnippets = 3): string[] {
  if (!text || !mentionName) return [];

  const escaped = mentionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:@\\[${escaped}\\]|@${escaped})`, 'gi');
  const snippets: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null && snippets.length < maxSnippets) {
    const start = Math.max(0, match.index - 120);
    const end = Math.min(text.length, match.index + match[0].length + 150);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = `...${snippet}`;
    if (end < text.length) snippet = `${snippet}...`;
    snippets.push(snippet);
  }

  return snippets;
}

/**
 * Finds all orphan @ mentions in a text (mentions that do not correspond to any
 * entity in the compendium or registered party adventurer).
 */
export function findOrphanMentions(
  text: string,
  existingEntities: Entity[] = [],
  players: any[] = []
): OrphanMentionInfo[] {
  const allMentions = extractAllMentions(text);
  if (allMentions.length === 0) return [];

  // Build lookup index of known entities
  const knownKeys = new Set<string>();

  existingEntities.forEach((ent) => {
    if (ent.name) {
      const k = normalizeMentionKey(ent.name);
      if (k) knownKeys.add(k);
    }
    if (Array.isArray(ent.aliases)) {
      ent.aliases.forEach((a) => {
        const k = normalizeMentionKey(a);
        if (k) knownKeys.add(k);
      });
    }
  });

  // Build lookup index of known players
  players.forEach((p) => {
    const cName = (p as any).characterName || (p as any).name;
    if (cName) {
      const k = normalizeMentionKey(cName);
      if (k) knownKeys.add(k);
    }
    if (Array.isArray(p.aliases)) {
      p.aliases.forEach((a) => {
        const k = normalizeMentionKey(a);
        if (k) knownKeys.add(k);
      });
    }
  });

  const orphanMap = new Map<string, OrphanMentionInfo>();

  allMentions.forEach((rawMention) => {
    const norm = normalizeMentionKey(rawMention);
    if (!norm) return;

    if (!knownKeys.has(norm)) {
      const snippets = extractSnippetsForMention(text, rawMention);
      const existing = orphanMap.get(norm);
      if (existing) {
        existing.occurrences += 1;
      } else {
        orphanMap.set(norm, {
          name: rawMention,
          normalized: norm,
          occurrences: 1,
          snippets,
        });
      }
    }
  });

  return Array.from(orphanMap.values());
}

/**
 * Heuristically infers entity type from keywords in the name.
 */
export function inferEntityTypeFromName(name: string): Entity['type'] {
  if (!name) return 'npc';
  const lower = name.toLowerCase();

  // Places / Locations / Buildings / Establishments
  const placeKeywords = [
    'ristorante', 'trattoria', 'locanda', 'taverna', 'osteria', 'bar', 'pub', 'bottega',
    'porta', 'torre', 'castello', 'rocca', 'fortezza', 'fortino', 'bastione', 'mura',
    'bosco', 'foresta', 'città', 'citta', 'borgo', 'villaggio', 'paese', 'regno', 'impero',
    'accademia', 'tempio', 'santuario', 'chiesa', 'cattedrale', 'monastero', 'convento',
    'fiume', 'lago', 'mare', 'oceano', 'monte', 'montagna', 'collina', 'valle', 'passo',
    'grotta', 'caverna', 'dungeon', 'miniera', 'cripta', 'tomba', 'necropoli', 'rovine',
    'stanza', 'aula', 'piazza', 'strada', 'via', 'ponte', 'porto', 'isola', 'baia',
    'palazzo', 'villa', 'magione', 'castello', 'sala', 'quartiere', 'distretto',
  ];
  if (placeKeywords.some((kw) => lower.includes(kw))) {
    return 'place';
  }

  // Factions / Guilds / Orders / Clans
  const factionKeywords = [
    'gilda', 'ordine', 'setta', 'culto', 'clan', 'fazione', 'fratellanza', 'confraternita',
    'armata', 'esercito', 'compagnia', 'lega', 'alleanza', 'sindacato', 'famiglia',
    'guardia cittadina', 'inquisizione', 'circolo',
  ];
  if (factionKeywords.some((kw) => lower.includes(kw))) {
    return 'faction';
  }

  // Items / Artifacts / Magic Equipment
  const itemKeywords = [
    'spada', 'lama', 'arco', 'balestra', 'bastone', 'bacchetta', 'pugnale', 'ascia', 'martello',
    'tomo', 'grimorio', 'libro', 'pergamena', 'manuale', 'diario',
    'anello', 'amuleto', 'collana', 'medaglione', 'pozione', 'elisir', 'fiala', 'calice',
    'elmo', 'armatura', 'corazza', 'scudo', 'stivali', 'guanti', 'mantello', 'corona', 'tiara',
    'reliquia', 'artefatto', 'chiave', 'sfera', 'cristallo', 'pietra', 'gemma',
  ];
  if (itemKeywords.some((kw) => lower.includes(kw))) {
    return 'item';
  }

  // Monsters / Beasts / Undead
  const monsterKeywords = [
    'drago', 'demone', 'diavolo', 'spettro', 'fantasma', 'scheletro', 'zombie', 'ghoul',
    'goblin', 'orco', 'troll', 'ogre', 'golem', 'idra', 'basilisco', 'chimera', 'manticora',
    'beholder', 'lich', 'mostro', 'bestia', 'vampiro', 'lupo mannaro', 'ragno gigante',
    'abominio', 'parassita', 'elementale',
  ];
  if (monsterKeywords.some((kw) => lower.includes(kw))) {
    return 'monster';
  }

  // Quests / Missions
  const questKeywords = [
    'quest', 'missione', 'incarico', 'taglia', 'profezia', 'prova', 'contratto',
  ];
  if (questKeywords.some((kw) => lower.includes(kw))) {
    return 'quest';
  }

  return 'npc';
}

/**
 * Builds a clean, narrative fallback description if the AI is unavailable.
 * Removes @ syntax and synthesizes a complete Italian sentence.
 */
export function buildCleanFallbackDescription(name: string, type: Entity['type'], snippets: string[] = []): string {
  // If we have snippet text, clean it up
  let contextClean = '';
  if (snippets.length > 0) {
    contextClean = snippets[0]
      .replace(/@\[(.*?)\]/g, '$1')
      .replace(/@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
      .replace(/\.\.\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const typeLabels: Record<Entity['type'], string> = {
    npc: `Personaggio incontrato o menzionato nella sessione di gioco.`,
    place: `Luogo o struttura citata durante la sessione, rilevante per le vicende del gruppo.`,
    item: `Oggetto o risorsa menzionata nel corso della cronaca di sessione.`,
    faction: `Organizzazione o gruppo presente nelle vicende della sessione.`,
    monster: `Creatura o avversario apparso negli eventi della sessione.`,
    quest: `Missione o obiettivo emerso durante la sessione di gioco.`,
  };

  if (contextClean && contextClean.length > 25 && contextClean.length < 250) {
    // If snippet has enough context, format it nicely
    if (type === 'place') {
      return `Luogo menzionato nella cronaca: "${contextClean.charAt(0).toUpperCase() + contextClean.slice(1)}."`;
    }
    if (type === 'npc') {
      return `Figura citata nella sessione: "${contextClean.charAt(0).toUpperCase() + contextClean.slice(1)}."`;
    }
  }

  return typeLabels[type] || `Entità citata nella sessione di gioco.`;
}
