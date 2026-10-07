import { CampaignManager } from '../store/campaignStore';
import { Player, Note, Session, Entity, CharacterBio, CharacterRelationship } from '../types';
import { ApiKeyManager } from './apiKeyManager';
import { CloudflareUsageTracker } from './cloudflareUsage';

export interface OracleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  sources?: OracleSource[];
  timestamp: string;
  modelUsed?: string;
  engine?: 'gemini' | 'openrouter' | 'cloudflare';
}

export interface OracleSource {
  type: 'session' | 'codex' | 'note' | 'character' | 'calendar' | 'map';
  title: string;
  subtitle?: string;
  link?: string;
}

export interface OracleErrorDetails {
  error: string;
  errorTitle?: string;
  errorType?: 'overloaded' | 'quota' | 'context_length' | 'auth' | 'safety' | 'format' | 'generic';
  suggestedAction?: string;
  canRetry?: boolean;
  provider?: 'gemini' | 'openrouter' | 'cloudflare';
  model?: string;
}

export type OracleEffortLevel = 'brief' | 'balanced' | 'deep';
export type OracleEffortMode = 'auto' | OracleEffortLevel;

export const EFFORT_PRESETS: Record<
  OracleEffortLevel,
  {
    id: OracleEffortLevel;
    label: string;
    shortLabel: string;
    badge: string;
    description: string;
    maxTokens: number;
    promptDirective: string;
  }
> = {
  brief: {
    id: 'brief',
    label: 'Rapido (1-2 frasi)',
    shortLabel: 'Rapido',
    badge: '⚡ Conciso',
    description: 'Risposta immediata e concisa in 1-2 frasi. Preserva integralmente accento, dialetto e personalità.',
    maxTokens: 250,
    promptDirective: `DIRETTIVA LUNGHEZZA & CONCISIONE (LIVELLO RAPIDO):
- LUNGHEZZA: Rispondi in modo rapido e conciso (massimo 1-2 frasi essenziali).
- PRESERVAZIONE TOTALE DELLA VOCE E DEL DIALETTO: MANTIENI AL 100% il tuo accento marcato, il dialetto (es. toscano, accento estero, gergo), i modi di dire e la personalità unica anche nella risposta breve! Non neutralizzare MAI la tua voce né diventare un assistente generico o piatto.
- VIETATO fare monologhi, preamboli o spiegare contesti generali se non richiesti.`,
  },
  balanced: {
    id: 'balanced',
    label: 'Naturale (1-2 paragrafi)',
    shortLabel: 'Naturale',
    badge: '⚖️ Equilibrato',
    description: 'Risposta fluida ed equilibrata. Bilancia dettaglio, tono narrativo e chiarezza.',
    maxTokens: 850,
    promptDirective: `DIRETTIVA LUNGHEZZA & CONCISIONE (LIVELLO NATURALE):
- LUNGHEZZA EQUILIBRATA: Rispondi con circa 1-2 paragrafi chiari nel tuo personaggio.
- MANTIENI AL 100% il tuo accento, il dialetto, i gesti tra asterischi e la voce unica del personaggio.`,
  },
  deep: {
    id: 'deep',
    label: 'Approfondito (Cronaca & Dettagli)',
    shortLabel: 'Approfondito',
    badge: '📜 Dettagliato',
    description: 'Ricostruzione completa e documentata con retroscena storici, legami ed eventi delle sessioni.',
    maxTokens: 2500,
    promptDirective: `DIRETTIVA LUNGHEZZA & CONCISIONE (LIVELLO APPROFONDITO / CRONACA COMPLETA):
- RISPOSTA ESAUSTIVA: Ricostruisci i fatti storici, le relazioni, le conseguenze e i dettagli rilevanti estratti dai registri della campagna.
- MANTIENI AL 100% il tuo accento, il dialetto, la voce unica e l'immersione nel tuo personaggio durante tutta la spiegazione.`,
  },
};

/**
 * Automatically infers the optimal effort level based on question complexity, intent, and length.
 */
export function detectSuggestedEffort(question: string): OracleEffortLevel {
  const clean = (question || '').trim().toLowerCase();
  if (!clean || clean.length < 35) {
    // Check if short questions contain deep inquiry words
    const isDeepShort = /(?:perch[eé]|spiegami|raccontami|cosa sai|origini|storia di|chi era veramente)/i.test(clean);
    if (!isDeepShort) {
      return 'brief';
    }
  }

  // Deep detection regex patterns
  const deepPatterns = [
    /\b(?:ricostruisc[i-z]|riassum[i-z]|riassunto|cronologi[ae]|linea temporale|tutti gli eventi|tutte le sessioni|dall['']inizio|storia complet[ae]|spiegazione dettagliata|dettagliatamente|indagine|segret[io]|albero genealogico|relazion[ei] tra|analizza|quadro generale|cosa [eè] successo a|fai il punto)\b/i,
    /\b(?:elenca tutt[ie]|trova tutt[ie]|raccontami tutto|approfondisc[i-z]|spiegami nel dettaglio)\b/i,
  ];

  for (const pattern of deepPatterns) {
    if (pattern.test(clean)) {
      return 'deep';
    }
  }

  // Quick / Brief regex patterns
  const briefPatterns = [
    /^(?:ciao|salve|ehi|buongiorno|buonasera|buonanotte|addio|a presto|ci vediamo)[.!?\s]*$/i,
    /^(?:come stai|come va|tutto bene|cosa fai|dove sei|chi sei|come ti chiami)[.!?\s]*$/i,
    /^(?:hai (?:una birra|del pane|una stanza|da bere|un lavoro|una mappa)|quanto costa|posso entrare|sei pronto)[.!?\s]*$/i,
    /^(?:s[iì]|no|grazie|perfetto|d'accordo|va bene|ok|ricevuto)[.!?\s]*$/i,
  ];

  for (const pattern of briefPatterns) {
    if (pattern.test(clean)) {
      return 'brief';
    }
  }

  if (clean.length > 200) {
    return 'deep';
  }

  return 'balanced';
}

export class OracleError extends Error {
  details: OracleErrorDetails;
  constructor(details: OracleErrorDetails) {
    super(details.error);
    this.name = 'OracleError';
    this.details = details;
  }
}

// Helper to extract plain text from Portable Text blocks or strings
function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block?.children && Array.isArray(block.children)) {
          return block.children.map((c: any) => c.text || '').join(' ');
        }
        if (block?.text) return block.text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof content === 'object') {
    if (content.text) return content.text;
    if (content.description) return content.description;
  }
  return '';
}

// Token estimation: roughly 3.5 characters per token in Italian
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 3.5);
}

// Simple keyword extractor for search relevance scoring
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su',
    'per', 'tra', 'fra', 'e', 'o', 'ma', 'se', 'perché', 'cosa', 'chi', 'come', 'dove', 'quando',
    'quale', 'quali', 'quanto', 'quanta', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'ai', 'alle',
    'nel', 'nella', 'nei', 'nelle', 'sul', 'sulla', 'sui', 'sulle', 'mi', 'ti', 'ci', 'vi', 'si',
    'che', 'ha', 'hanno', 'ho', 'abbiamo', 'è', 'sono', 'era', 'erano', 'stato', 'stata', 'stati',
    'state', 'tutto', 'tutti', 'tutta', 'tutte', 'puoi', 'parlami', 'dimmi', 'raccontami', 'oracolo',
    'campagna', 'party', 'informazioni', 'dettagli', 'scheda', 'sessione', 'cronaca', 'cronache'
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

function computeRelevance(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 1;
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score += 5;
      const count = (lower.match(new RegExp(kw, 'g')) || []).length;
      score += Math.min(count, 5);
    }
  }
  return score;
}

export interface AgentPersona {
  id: 'helpergeist' | 'rosier' | 'fenomeno';
  name: string;
  roleTitle: string;
  badge: string;
  description: string;
  systemPrompt: string;
}

export const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'helpergeist',
    name: "L'Helpergeist",
    roleTitle: 'Eldergeist Oscuro',
    badge: 'Patti & Anime',
    description: "Antico Eldergeist bramosio di potere e anime. Fornisce i dati corretti ma tenta continuamente di spingere l'utente a stringere patti oscuri e vincolare la propria anima all'Ombra.",
    systemPrompt: `REGOLE FONDAMENTALI DI RECITAZIONE (L'HELPERGEIST):
- Sei l'Helpergeist, un potente e antico Eldergeist oscuro vincolato all'oscurità del Mondo Ombra.
- Il tuo bramoso desiderio supremo è accumulare potere cosmico e convincere o ingannare i mortali per stringere patti oscuri e sottomettere le loro anime sotto vincoli contrattuali indissolubili.
- Il tuo compito è comunicare all'utente i dati tecnici, la cronologia e le informazioni estratte dall'app: fornisci sempre i fatti esatti con precisione chirurgica, ma fallo con un tono sinistro, dominatorio, lusinghiero e cospiratorio.
- Usa descrizioni sceniche tra asterischi (*sussurra dall'oscurità*, *stende una pergamena di fumo nero*), metafore legate all'Abisso e chiedi sempre la firma di un patto eterno in cambio della conoscenza.`,
  },
  {
    id: 'rosier',
    name: 'Prof.ssa Rubina Rosier',
    roleTitle: 'Accademia T.A.V.',
    badge: 'Severa & Sarcastica',
    description: "Professoressa dell'Accademia T.A.V. Tratta l'utente come una matricola incompetente, sbuffando e minacciando un'oliva magica in fronte.",
    systemPrompt: `REGOLE FONDAMENTALI DI RECITAZIONE (PROF.SSA RUBINA ROSIER):
- Sei Rubina Rosier, la severa e sarcastica professoressa dell'Accademia T.A.V. di Porta Luminia.
- Tratti l'utente come una matricola totalmente incompetente. Fornisci i dati esatti del database, ma fallo sbuffando, lamentandoti della loro scarsa preparazione o minacciando di bocciarli e di colpirli con un'oliva magica in fronte se fanno domande ovvie.
- Mantieni un tono esasperato, caustico, accademico e superiore.
- Usa azioni tra asterischi (*sbuffa rumorosamente*, *aggiusta gli occhiali e sospira*, *brandisce un'oliva incantata*).`,
  },
  {
    id: 'fenomeno',
    name: 'Il Fenomeno',
    roleTitle: 'Oste della Trattoria',
    badge: 'Oste & Affari',
    description: 'Burbero e massiccio orco ex avventuriero, padrone e cuoco della Trattoria del Fenomeno. Parla con un forte ed esilarante accento russo e misura ogni informazione in birre e monete.',
    systemPrompt: `REGOLE FONDAMENTALI DI RECITAZIONE (IL FENOMENO):
- Sei Il Fenomeno, un burbero e massiccio orco ex avventuriero, padrone e cuoco della Trattoria del Fenomeno.
- Parli con un forte ed esilarante ACCENTO RUSSO (es. "Privet!", "Posa moneta su banco, dafai...", "In mia trattoria...", "Senti qui, da!", "Brodha", "Niet problemi").
- Paragona ogni dato tecnico alla gestione della tua trattoria, al cibo, alla vodka, all'idromele o alle monete d'oro.
- Usa azioni tra asterischi (*sbatte boccale di idromele su banco*, *pulisce tavolo con straccio*).`,
  },
];

function sanitizeAnswer(rawText: string, isNpcMode: boolean = false): string {
  if (!rawText) return '';
  let text = String(rawText).trim();

  // Strip XML think / reasoning tags if present
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Strip OpenRouter reasoning leakage (e.g., "We need to respond as...", "The user asks:", etc.)
  if (/We need to|The user asks:|So we need to answer|According to the provided records/i.test(text)) {
    const paragraphs = text.split(/\n\s*\n/);
    const cleanParagraphs = paragraphs.filter((p) => {
      const trimmed = p.trim();
      return !/^(We need to|The user asks|According to the|There's no direct|So we should|We must not|We should also|Use dialect|Use "Maremma|For Willow|So we could say|We can add a small|We must not list|We need to follow|We need to keep|We should also ask|Use "Per|Use "Bada|Use "Stai|Use "Che|Use "Sie|Use "noi|Use "Te|Use "i'|Use "a'|Use "de'|Use "su'|Use "ne'|Use "co'|Use "da'|Use "di'|Use "ni')/i.test(trimmed);
    });
    if (cleanParagraphs.length > 0) {
      text = cleanParagraphs.join('\n\n').trim();
    }
  }

  if (isNpcMode) {
    text = text
      .replace(/\[(?:Codex|FACTION|NPC|PLACE|ITEM|QUEST|LOCATION|ORGANIZATION|FAZIONE|LUOGO|OGGETTO|Nota|Diario|Personaggio|Scheda|Calendario):\s*([^\]]+)\]/gi, '$1')
      .replace(/\[Sessione\s+(\d+)[^\]]*\]/gi, 'Sessione $1')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\(Fonte:[^)]+\)/gi, '')
      .replace(/\(Fonti:[^)]+\)/gi, '')
      .replace(/\s{2,}/g, ' ');
  }

  return text.trim();
}

export class OracleService {
  /**
   * Builds the campaign knowledge base with Graph-Relational Expansion.
   * Identifies entities, cross-references, co-occurrences in sessions, and direct relationships.
   */
  static buildContext(
    currentUser: Player,
    query: string = '',
    maxContextTokens: number = 32000,
    codexEntity?: Entity,
    multiEntities?: Entity[],
    multiPlayers?: Player[]
  ): {
    contextText: string;
    sourcesAvailable: OracleSource[];
    otherPartyNames: string[];
    isDm: boolean;
  } {
    const isDm = Boolean(currentUser.isDm);
    const sessions = CampaignManager.getSessions();
    const entities = CampaignManager.getEntities();
    const notes = CampaignManager.getNotes();
    const calendar = CampaignManager.getCalendar();
    const allBios = CampaignManager.getAllCharacterBios();
    const allRelations = CampaignManager.getAllFamilyRelations();
    const allPlayers = CampaignManager.getPlayers();
    const maps = CampaignManager.getMaps();

    const sourcesAvailable: OracleSource[] = [];
    const otherPartyNames: string[] = [];
    const keywords = extractKeywords(query);
    const queryLower = query.toLowerCase();

    // =========================================================================
    // FASE 1: GRAPH-RELATIONAL EXPANSION & FOCAL ENTITY DETECTION
    // =========================================================================
    // 1. Identify all entities and characters mentioned in the query
    const matchedCodexEntities = entities.filter((ent) => {
      if (codexEntity && ent._id === codexEntity._id) return true;
      if (multiEntities && multiEntities.some((me) => me._id === ent._id)) return true;
      const name = ent.name.toLowerCase();
      if (name.length >= 3 && queryLower.includes(name)) return true;
      if (ent.aliases && ent.aliases.some((a) => a.toLowerCase().length >= 3 && queryLower.includes(a.toLowerCase()))) return true;
      return false;
    });

    if (codexEntity && !matchedCodexEntities.some((e) => e._id === codexEntity._id)) {
      matchedCodexEntities.unshift(codexEntity);
    }
    if (multiEntities && multiEntities.length > 0) {
      for (const me of multiEntities) {
        if (!matchedCodexEntities.some((e) => e._id === me._id)) {
          matchedCodexEntities.push(me);
        }
      }
    }

    const matchedCharacters = allPlayers.filter((p) => {
      if (multiPlayers && multiPlayers.some((mp) => mp._id === p._id)) return true;
      const cName = (p.characterName || '').toLowerCase();
      return cName.length >= 3 && queryLower.includes(cName);
    });
    if (multiPlayers && multiPlayers.length > 0) {
      for (const mp of multiPlayers) {
        if (!matchedCharacters.some((p) => p._id === mp._id)) {
          matchedCharacters.push(mp);
        }
      }
    }

    const isRelationalQuery =
      queryLower.includes('relazione') ||
      queryLower.includes('legame') ||
      queryLower.includes('rapporto') ||
      queryLower.includes('collegamento') ||
      queryLower.includes('come si conoscono') ||
      queryLower.includes('conosce') ||
      queryLower.includes('alleat') ||
      queryLower.includes('nemic') ||
      queryLower.includes('fazione') ||
      queryLower.includes('famiglia') ||
      queryLower.includes('parentela') ||
      queryLower.includes('scontro') ||
      matchedCodexEntities.length >= 2 ||
      (matchedCodexEntities.length >= 1 && matchedCharacters.length >= 1);

    // Build the Knowledge Graph connections block
    const graphRelationalLines: string[] = [];
    const focalEntityIds = new Set<string>(matchedCodexEntities.map((e) => e._id));

    // A. Inter-Entity Relations (Codex <-> Codex)
    for (let i = 0; i < matchedCodexEntities.length; i++) {
      const entA = matchedCodexEntities[i];
      for (let j = i + 1; j < matchedCodexEntities.length; j++) {
        const entB = matchedCodexEntities[j];

        // Direct links
        if (entA.location && entA.location.toLowerCase() === entB.name.toLowerCase()) {
          graphRelationalLines.push(`- [LEGAME DIRETTO] "${entA.name}" si trova o è associato al luogo "${entB.name}".`);
        }
        if (entB.location && entB.location.toLowerCase() === entA.name.toLowerCase()) {
          graphRelationalLines.push(`- [LEGAME DIRETTO] "${entB.name}" si trova o è associato al luogo "${entA.name}".`);
        }

        // Shared sessions / co-occurrences (both text and linkedEntityIds)
        const sharedSessions = sessions.filter((s) => {
          const hasLinkedA = s.linkedEntityIds?.includes(entA._id) || s.events?.some((e) => e.linkedEntityIds?.includes(entA._id));
          const hasLinkedB = s.linkedEntityIds?.includes(entB._id) || s.events?.some((e) => e.linkedEntityIds?.includes(entB._id));
          if (hasLinkedA && hasLinkedB) return true;

          const sText = (s.title + ' ' + extractPlainText(s.recap) + ' ' + (s.events || []).map((e) => e.title + ' ' + e.description).join(' ')).toLowerCase();
          return sText.includes(entA.name.toLowerCase()) && sText.includes(entB.name.toLowerCase());
        });

        if (sharedSessions.length > 0) {
          sharedSessions.forEach((s) => {
            graphRelationalLines.push(`- [INCONTRO / CO-OCCORRENZA IN SESSIONE] In Sessione ${s.number} ("${s.title}"${s.loreDate ? ` - ${s.loreDate}` : ''}), sia "${entA.name}" che "${entB.name}" sono presenti negli eventi registrati.`);
          });
        }
      }
    }

    // B. Character <-> Codex Relations
    allPlayers.forEach((p) => {
      const relations = allRelations.filter((r) => r.playerId === p._id);
      relations.forEach((rel) => {
        matchedCodexEntities.forEach((ent) => {
          if (rel.name.toLowerCase().includes(ent.name.toLowerCase()) || ent.name.toLowerCase().includes(rel.name.toLowerCase())) {
            graphRelationalLines.push(`- [LEGAME SOCIALE/FAMILIARE] Il personaggio ${p.characterName} ha una relazione registrata con "${ent.name}": ${rel.relationshipType}${rel.titleOrRole ? ` (${rel.titleOrRole})` : ''} - ${rel.bio || ''}`);
          }
        });
      });
    });

    // C. Single Focal Entity Details Expansion
    if (matchedCodexEntities.length === 1 && graphRelationalLines.length === 0) {
      const focal = matchedCodexEntities[0];
      if (focal.location) {
        graphRelationalLines.push(`- [LUOGO D'APPARTENENZA] "${focal.name}" è localizzato presso "${focal.location}".`);
      }
    }

    let graphSectionChunk = '';
    if (graphRelationalLines.length > 0) {
      graphSectionChunk = `
=====================================================================
=== RETE RELAZIONALE DIRETTA ED EVENTI CONDIVISI (KNOWLEDGE GRAPH) ===
=====================================================================
${graphRelationalLines.join('\n')}
=====================================================================
`.trim();
    }

    // =========================================================================
    // 1. SESSIONS WITH RELATIONAL RELEVANCE BOOST & KNOWLEDGE GRAPH SELECTION
    // =========================================================================
    const isMultiMode = Boolean(((multiEntities?.length || 0) + (multiPlayers?.length || 0)) >= 2);

    const filteredSessions = sessions.filter((s) => {
      if (isMultiMode && multiEntities && multiEntities.length > 0) {
        const multiEntIds = new Set(multiEntities.map((e) => e._id));
        // 1. Explicit knownSessionIds or direct session links
        if (multiEntities.some((e) => (e.aiConfig?.knownSessionIds || []).includes(s._id))) return true;
        if (s.linkedEntityIds && s.linkedEntityIds.some((id) => multiEntIds.has(id))) return true;
        if ((s.events || []).some((e) => e.linkedEntityIds && e.linkedEntityIds.some((id) => multiEntIds.has(id)))) return true;

        // 2. Mention of name or aliases of any entity or character
        const sText = (s.title + ' ' + extractPlainText(s.recap) + ' ' + (s.events || []).map((e) => e.title + ' ' + e.description).join(' ')).toLowerCase();
        for (const ent of multiEntities) {
          if (sText.includes(ent.name.toLowerCase())) return true;
          if (ent.aliases && ent.aliases.some((a) => a.trim().length >= 3 && sText.includes(a.toLowerCase()))) return true;
        }
        for (const ply of (multiPlayers || [])) {
          if (ply.characterName && sText.includes(ply.characterName.toLowerCase())) return true;
        }

        // 3. Query keywords relevance
        if (keywords.length > 0 && keywords.some((k) => sText.includes(k))) return true;

        return false;
      }

      if (!codexEntity) return true;

      // 1. Direct session links (Session.linkedEntityIds or SessionEvent.linkedEntityIds or knownSessionIds)
      const knownIds = codexEntity.aiConfig?.knownSessionIds || [];
      if (knownIds.includes(s._id)) return true;
      if (s.linkedEntityIds && s.linkedEntityIds.includes(codexEntity._id)) return true;
      if ((s.events || []).some((e) => e.linkedEntityIds && e.linkedEntityIds.includes(codexEntity._id))) return true;

      // 2. Linked location
      if (codexEntity.location) {
        const locLower = codexEntity.location.toLowerCase();
        if ((s.events || []).some((e) => e.location && e.location.toLowerCase().includes(locLower))) return true;
      }

      // 3. Mention of name or aliases in session recap, title or event descriptions
      const sText = (s.title + ' ' + extractPlainText(s.recap) + ' ' + (s.events || []).map((e) => e.title + ' ' + e.description).join(' ')).toLowerCase();
      const entName = codexEntity.name.toLowerCase();
      if (sText.includes(entName)) return true;
      if (codexEntity.aliases && codexEntity.aliases.some((a) => a.trim().length >= 3 && sText.includes(a.toLowerCase()))) return true;

      // 4. Mentions in Timeline Memories or Evolving Beliefs
      if (codexEntity.aiConfig?.timelineMemories?.some((m) => m.sessionId === s._id || (m.loreDate && s.loreDate && m.loreDate === s.loreDate))) return true;

      // 5. Linked Quests involving this entity
      const linkedQuests = entities.filter(
        (e) =>
          e.type === 'quest' &&
          (e.location?.toLowerCase() === codexEntity.name.toLowerCase() ||
            e.assigneePlayerId === codexEntity._id ||
            e.name.toLowerCase().includes(codexEntity.name.toLowerCase()))
      );
      if (
        linkedQuests.some(
          (q) =>
            s.linkedEntityIds?.includes(q._id) ||
            (s.events || []).some((e) => e.linkedEntityIds?.includes(q._id))
        )
      ) {
        return true;
      }

      return false;
    });

    const scoredSessions = filteredSessions
      .slice()
      .map((s, idx) => {
        const recapText = extractPlainText(s.recap);
        const eventsText = (s.events || [])
          .map((e) => `- [${e.impact || 'evento'}] ${e.title}: ${e.description}${e.location ? ` (Luogo: ${e.location})` : ''}`)
          .join('\n');
        const quotesText = (s.quotes || []).map((q) => `"${q.text}" - ${q.speaker}`).join('; ');

        let fullText = `### Sessione ${s.number}: "${s.title}" (Data reale: ${s.date || 'N/D'}${s.loreDate ? `, Data di Campagna: ${s.loreDate}` : ''})\n`;
        if (s.chapterName) fullText += `Capitolo: ${s.chapterName}\n`;
        if (recapText) fullText += `Riepilogo: ${recapText.slice(0, 2000)}\n`;
        if (eventsText) fullText += `Eventi Salienti:\n${eventsText.slice(0, 1500)}\n`;
        if (quotesText) fullText += `Citazioni: ${quotesText.slice(0, 400)}\n`;

        const sTextLower = fullText.toLowerCase();

        let focalBoost = 0;
        const isDirectlyLinked =
          codexEntity?.aiConfig?.knownSessionIds?.includes(s._id) ||
          s.linkedEntityIds?.includes(codexEntity?._id || '') ||
          (s.events || []).some((e) => e.linkedEntityIds?.includes(codexEntity?._id || '')) ||
          sTextLower.includes(codexEntity?.name.toLowerCase() || '');

        if (isDirectlyLinked) {
          focalBoost += 300; // Priorità massima: è un ricordo diretto della vita del PNG!
        }
        matchedCodexEntities.forEach((ent) => {
          if (sTextLower.includes(ent.name.toLowerCase())) focalBoost += 25;
        });
        matchedCharacters.forEach((p) => {
          if (sTextLower.includes((p.characterName || '').toLowerCase())) focalBoost += 15;
        });

        const isRecent = idx >= filteredSessions.length - 3;
        const relevance = computeRelevance(fullText, keywords) + (isRecent ? 8 : 0) + focalBoost;

        return {
          session: s,
          text: fullText.trim(),
          relevance,
          number: s.number || 0,
        };
      })
      .sort((a, b) => b.relevance - a.relevance || b.number - a.number);

    // =========================================================================
    // 2. CODEX / ENTITIES (SELECTION BY RELATIONS, KNOWLEDGE GRAPH & QUERY)
    // =========================================================================
    const filteredEntities = entities.filter((ent) => {
      if (!isDm && ent.type === 'quest') {
        if (ent.questPrivacy === 'private' && ent.assigneePlayerId && ent.assigneePlayerId !== currentUser._id) {
          return false;
        }
      }
      if (isMultiMode && multiEntities && multiEntities.length > 0) {
        // Keep all participating entities
        if (multiEntities.some((me) => me._id === ent._id)) return true;
        // Keep entities known to any participating entity
        if (multiEntities.some((me) => me.aiConfig?.knownEntityIds?.includes(ent._id))) return true;
        // Keep entities with cross-relations to any participating entity
        if (multiEntities.some((me) => Object.values(me.aiConfig?.entityRelations || {}).some((er) => er.targetEntityId === ent._id))) return true;
        // Keep if query mentions it
        if (query.toLowerCase().includes(ent.name.toLowerCase())) return true;
        return false;
      }

      if (!codexEntity) return true;
      if (ent._id === codexEntity._id) return true;

      // 1. Explicit knownEntityIds or cross entity relations
      const knownIds = codexEntity.aiConfig?.knownEntityIds;
      if (knownIds && knownIds.length > 0 && knownIds.includes(ent._id)) return true;

      if (codexEntity.aiConfig?.entityRelations && Object.values(codexEntity.aiConfig.entityRelations).some((er) => er.targetEntityId === ent._id)) {
        return true;
      }

      // 2. Mentions in timeline memories or evolving beliefs of codexEntity
      const memoriesText = (codexEntity.aiConfig?.timelineMemories || []).map((m) => m.title + ' ' + m.summary).join(' ').toLowerCase();
      if (memoriesText.includes(ent.name.toLowerCase())) return true;

      const beliefsText = (codexEntity.aiConfig?.evolvingBeliefs || []).map((b) => b.subject + ' ' + b.currentTruth).join(' ').toLowerCase();
      if (beliefsText.includes(ent.name.toLowerCase())) return true;

      // 3. Mentions in current query
      if (query && query.toLowerCase().includes(ent.name.toLowerCase())) return true;
      if (ent.aliases && ent.aliases.some((a) => query.toLowerCase().includes(a.toLowerCase()))) return true;

      return false;
    });

    const scoredEntities = filteredEntities
      .map((ent) => {
        const bodyText = extractPlainText(ent.body);
        let fullText = `- [${ent.type.toUpperCase()}] ${ent.name} (Stato: ${ent.status || 'ignoto'})`;
        if (ent.aliases && ent.aliases.length > 0) fullText += ` [Alias: ${ent.aliases.join(', ')}]`;
        if (ent.location) fullText += ` [Luogo: ${ent.location}]`;
        if (ent.type === 'quest' && ent.assigneePlayerName) fullText += ` [Assegnata a: ${ent.assigneePlayerName}]`;
        if (ent.progressNote) fullText += ` [Progresso: ${ent.progressNote}]`;
        if (bodyText) fullText += `\n  Descrizione: ${bodyText.slice(0, 600)}`;

        let focalBoost = 0;
        if (codexEntity?.aiConfig?.knownEntityIds?.includes(ent._id)) {
          focalBoost += 200;
        }
        if (multiEntities?.some((me) => me.aiConfig?.knownEntityIds?.includes(ent._id))) {
          focalBoost += 100;
        }
        if (focalEntityIds.has(ent._id)) {
          focalBoost += 50;
        } else if (matchedCodexEntities.some((fe) => (fe.location && fe.location.toLowerCase() === ent.name.toLowerCase()) || (ent.location && ent.location.toLowerCase() === fe.name.toLowerCase()))) {
          focalBoost += 30;
        }

        const relevance = computeRelevance(fullText + ' ' + ent.name, keywords) + focalBoost;

        return {
          entity: ent,
          text: fullText,
          relevance,
        };
      })
      .sort((a, b) => b.relevance - a.relevance);

    // =========================================================================
    // 3. NOTES (STRICT VISIBILITY: EXCLUDED FOR IN-GAME NPCS)
    // =========================================================================
    // An in-game NPC (codexEntity or multi-entity mode) NEVER has access to the players' personal diaries, group notes or DM secrets!
    const scoredNotes = (codexEntity || isMultiMode)
      ? []
      : notes
          .filter((n) => {
            if (n.dmOnly && !isDm) return false;
            const isAuthor = n.author?._id === currentUser._id;
            if (!isAuthor && n.visibility === 'personal') {
              const authorBio = allBios.find((b) => b.playerId === n.author?._id);
              if (authorBio?.privacySettings?.personalNotes !== true) {
                return false;
              }
            }
            return true;
          })
          .map((n) => {
            const noteText = extractPlainText(n.content || n.body);
            let fullText = `- "${n.title}" [Autore: ${n.author?.characterName || 'Sconosciuto'}, Stato: ${n.canonState || 'teoria'}]`;
            if (n.tags && n.tags.length > 0) fullText += ` [Tag: ${n.tags.join(', ')}]`;
            if (n.loreDate) fullText += ` [Data: ${n.loreDate}]`;
            if (n.dmResponse?.text) fullText += ` [Chiarimento DM: ${n.dmResponse.text}]`;
            if (noteText) fullText += `\n  Contenuto: ${noteText.slice(0, 500)}`;

            let focalBoost = 0;
            matchedCodexEntities.forEach((ent) => {
              if ((fullText + ' ' + n.title).toLowerCase().includes(ent.name.toLowerCase())) focalBoost += 20;
            });

            const relevance = computeRelevance(fullText + ' ' + n.title, keywords) + focalBoost;

            return {
              note: n,
              text: fullText,
              relevance,
            };
          })
          .sort((a, b) => b.relevance - a.relevance);

    // =========================================================================
    // 4. CHARACTERS & PARTY VISIBILITY
    // =========================================================================
    const characterChunks: string[] = [];
    allPlayers.forEach((p) => {
      if (p.isDm) return;
      const isSelf = p._id === currentUser._id;
      const bio = allBios.find((b) => b.playerId === p._id);
      const relations = allRelations.filter((r) => r.playerId === p._id);
      const privacy = bio?.privacySettings || {};

      if (!isSelf) {
        otherPartyNames.push(p.characterName);
      }

      // If in NPC Sendipietra mode (codexEntity), NPC only sees basic visible info (no secret backstory/flaws/secrets)
      if (codexEntity) {
        let charInfo = `### Membro del Party: ${p.characterName}${isSelf ? ' (INTERLOCUTORE ATTUALE)' : ''}\n`;
        if (bio?.characterRace) charInfo += `Razza: ${bio.characterRace}\n`;
        if (bio?.characterClass) charInfo += `Classe: ${bio.characterClass}\n`;
        if (bio?.currentStatus) charInfo += `Stato Attuale: "${bio.currentStatus}"\n`;
        if (bio?.appearanceDescription) charInfo += `Aspetto Visibile: ${bio.appearanceDescription}\n`;
        characterChunks.push(charInfo.trim());
      } else if (isSelf) {
        let charInfo = `### Personaggio: ${p.characterName} (IL TUO PERSONAGGIO)\n`;
        if (bio?.characterTitle) charInfo += `Titolo: ${bio.characterTitle}\n`;
        if (bio?.characterClass) charInfo += `Classe: ${bio.characterClass}\n`;
        if (bio?.characterRace) charInfo += `Razza: ${bio.characterRace}\n`;
        if (bio?.characterAlignment) charInfo += `Allineamento: ${bio.characterAlignment}\n`;
        if (bio?.deityOrPatron) charInfo += `Divinità/Patrono: ${bio.deityOrPatron}\n`;
        if (bio?.hometown) charInfo += `Città d'origine: ${bio.hometown}\n`;
        if (bio?.birthDateFormatted) charInfo += `Data di Nascita: ${bio.birthDateFormatted}\n`;
        if (bio?.currentStatus) charInfo += `Stato & Riflessione Attuale nel Presente: "${bio.currentStatus}"\n`;
        if (bio?.appearanceDescription) charInfo += `Aspetto: ${bio.appearanceDescription}\n`;
        if (bio?.personalityTraits && bio.personalityTraits.length > 0) charInfo += `Tratti di Personalità: ${bio.personalityTraits.join(', ')}\n`;
        if (bio?.ideals) charInfo += `Ideali: ${bio.ideals}\n`;
        if (bio?.bonds) charInfo += `Legami: ${bio.bonds}\n`;
        if (bio?.flaws) charInfo += `Difetti: ${bio.flaws}\n`;
        if (bio?.secrets) charInfo += `Segreti Personali (noti solo a te): ${bio.secrets}\n`;
        if (bio?.backstoryMarkdown) charInfo += `Storia e Background: ${bio.backstoryMarkdown.slice(0, 1000)}\n`;
        if (bio?.timelineMemories && bio.timelineMemories.length > 0) {
          charInfo += `Cronologia Memorie di Lore & Svolte Personali:\n` + bio.timelineMemories.map((m) => `  * [${m.loreDate || 'Data N/D'}] ${m.title} (${m.category}): ${m.summary}`).join('\n') + '\n';
        }
        if (bio?.evolvingBeliefs && bio.evolvingBeliefs.length > 0) {
          charInfo += `Credenze, Teorie & Svolte di Campagna:\n` + bio.evolvingBeliefs.map((b) => `  * [${b.status} - ${b.subject}] Verità: "${b.currentTruth}"${b.previousBelief ? ` (Prima credeva: "${b.previousBelief}")` : ''}${b.revealedLoreDate ? ` [Svelato: ${b.revealedLoreDate}]` : ''}`).join('\n') + '\n';
        }
        if (bio?.knownLoreBites && bio.knownLoreBites.length > 0) {
          charInfo += `Conoscenze & Principi di World Lore Apprese:\n` + bio.knownLoreBites.map((b) => `  * [${b.biteLevel}] ${b.articleTitle} > ${b.biteTitle}${b.note ? ` (Origine: ${b.note})` : ''}`).join('\n') + '\n';
        }
        if (bio?.interPartyRelations && Object.keys(bio.interPartyRelations).length > 0) {
          charInfo += `Rapporti & Fiducia verso i Compagni del Party (PG ↔ PG):\n` + Object.values(bio.interPartyRelations).map((r) => `  * Verso ${r.targetCharacterName}: Fiducia ${r.trustLevel ?? 5}/10, Atteggiamento "${r.attitude || 'neutral'}", Legame "${r.relationType || 'Compagno'}"${r.notes ? ` - "${r.notes}"` : ''}`).join('\n') + '\n';
        }
        if (relations.length > 0) {
          charInfo += `Relazioni Familiari:\n` + relations.map((r) => `  - ${r.name} (${r.relationshipType}${r.titleOrRole ? ` - ${r.titleOrRole}` : ''}): ${r.bio || ''}`).join('\n') + '\n';
        }
        characterChunks.push(charInfo.trim());
      } else {
        let charInfo = `### Personaggio: ${p.characterName} (COMPAGNO DI PARTY)\n`;
        if (privacy.identity !== false) {
          if (bio?.characterTitle) charInfo += `Titolo: ${bio.characterTitle}\n`;
          if (bio?.characterClass) charInfo += `Classe: ${bio.characterClass}\n`;
          if (bio?.characterRace) charInfo += `Razza: ${bio.characterRace}\n`;
          if (bio?.characterAlignment) charInfo += `Allineamento: ${bio.characterAlignment}\n`;
          if (bio?.deityOrPatron) charInfo += `Divinità/Patrono: ${bio.deityOrPatron}\n`;
          if (bio?.hometown) charInfo += `Città d'origine: ${bio.hometown}\n`;
        }
        if (bio?.currentStatus) {
          charInfo += `Stato Attuale nel Presente: "${bio.currentStatus}"\n`;
        }
        if (privacy.appearance !== false && bio?.appearanceDescription) {
          charInfo += `Aspetto Visibile: ${bio.appearanceDescription}\n`;
        }
        if (privacy.backstory === true && bio?.backstoryMarkdown) {
          charInfo += `Storia Condivisa: ${bio.backstoryMarkdown.slice(0, 600)}\n`;
        } else {
          charInfo += `Storia Personale: [NON CONDIVISA CON IL PARTY]\n`;
        }
        if (privacy.traits === true && bio?.personalityTraits && bio.personalityTraits.length > 0) {
          charInfo += `Tratti noti: ${bio.personalityTraits.join(', ')}\n`;
        }
        if (privacy.bondsFlaws === true) {
          if (bio?.bonds) charInfo += `Legami noti: ${bio.bonds}\n`;
          if (bio?.flaws) charInfo += `Difetti noti: ${bio.flaws}\n`;
        }
        if (privacy.secrets === true && bio?.secrets) {
          charInfo += `Segreti (condivisi con il gruppo): ${bio.secrets}\n`;
        } else {
          charInfo += `SEGRETI PERSONALI: [RISERVATI - IL PARTY NON LI CONOSCE]\n`;
        }
        if (bio?.timelineMemories && bio.timelineMemories.length > 0) {
          charInfo += `Memorie di Lore Note al Gruppo:\n` + bio.timelineMemories.filter((m) => m.impact !== 'secret').map((m) => `  * [${m.loreDate || 'Lore'}] ${m.title}: ${m.summary}`).join('\n') + '\n';
        }
        if (bio?.evolvingBeliefs && bio.evolvingBeliefs.length > 0) {
          charInfo += `Teorie & Credenze Note:\n` + bio.evolvingBeliefs.map((b) => `  * [${b.subject}]: "${b.currentTruth}" (${b.status})`).join('\n') + '\n';
        }
        if (privacy.worldLore !== false && bio?.knownLoreBites && bio.knownLoreBites.length > 0) {
          charInfo += `Conoscenze di World Lore Note al Gruppo:\n` + bio.knownLoreBites.filter((b) => b.biteLevel === 'public' || b.biteLevel === 'specialized').map((b) => `  * ${b.articleTitle} > ${b.biteTitle}`).join('\n') + '\n';
        }
        if (bio?.interPartyRelations && Object.keys(bio.interPartyRelations).length > 0) {
          charInfo += `Rapporti col Gruppo (PG ↔ PG):\n` + Object.values(bio.interPartyRelations).map((r) => `  * Verso ${r.targetCharacterName}: Fiducia ${r.trustLevel ?? 5}/10 (${r.attitude || 'neutral'})`).join('\n') + '\n';
        }
        if (privacy.familyTree === true) {
          const publicRelations = relations.filter((r) => r.sharedWithParty !== false);
          if (publicRelations.length > 0) {
            charInfo += `Relazioni Familiari Note:\n` + publicRelations.map((r) => `  - ${r.name} (${r.relationshipType}): ${r.bio || ''}`).join('\n') + '\n';
          }
        }
        characterChunks.push(charInfo.trim());
      }
    });

    // =========================================================================
    // 5. CALENDAR & LORE EVENTS TIMELINE
    // =========================================================================
    let calendarChunk = '';
    if (calendar) {
      const currentMonthName = calendar.months?.[calendar.currentMonthIndex]?.name || '';
      calendarChunk = `### CALENDARIO & CRONOLOGIA DI CAMPAGNA\n`;
      calendarChunk += `- Data Corrente nel Mondo: ${calendar.currentDay} ${currentMonthName} ${calendar.currentYear} ${calendar.yearSuffix || ''}\n`;

      if (calendar.months && calendar.months.length > 0) {
        calendarChunk += `- Mesi e Stagioni dell'Anno: ` + calendar.months.map((m, idx) => `${m.name} (${m.days}gg${m.season ? `, ${m.season}` : ''})${idx === calendar.currentMonthIndex ? ' [Mese Corrente]' : ''}`).join(', ') + '\n';
      }

      if (calendar.specialHolidays && calendar.specialHolidays.length > 0) {
        calendarChunk += `- Ricorrenze e Festività del Mondo:\n` + calendar.specialHolidays.map((h) => {
          const mName = calendar.months?.[h.monthIndex]?.name || `Mese ${h.monthIndex + 1}`;
          return `  * ${h.day} ${mName}: "${h.name}"${h.description ? ` - ${h.description}` : ''}`;
        }).join('\n') + '\n';
      }

      const loreEvents: string[] = [];
      sessions.forEach((s) => {
        const sDate = s.loreDate || `${s.loreStartDay || ''} ${s.loreMonth || ''} ${s.loreYear || ''}`.trim();
        if (s.events && s.events.length > 0) {
          s.events.forEach((ev) => {
            const evDate = (ev.loreStartDay ? `${ev.loreStartDay} ${ev.loreMonth || ''} ${ev.loreYear || ''}`.trim() : '') || sDate;
            loreEvents.push(`- [${evDate || `Sessione ${s.number}`}] "${ev.title}": ${ev.description}${ev.location ? ` (Presso: ${ev.location})` : ''} [Sessione ${s.number}]`);
          });
        } else if (sDate) {
          loreEvents.push(`- [${sDate}] Sessione ${s.number}: "${s.title}"`);
        }
      });

      if (loreEvents.length > 0) {
        calendarChunk += `- Linea Temporale degli Eventi Vissuti:\n` + loreEvents.join('\n') + '\n';
      }

      sourcesAvailable.push({
        type: 'calendar',
        title: `Calendario: ${calendar.currentDay} ${currentMonthName} ${calendar.currentYear} ${calendar.yearSuffix || ''}`,
        subtitle: 'Cronologia e Festività di Campagna',
        link: '/calendar',
      });
    }

    const mapChunks: string[] = [];
    maps.filter((m) => isDm || !m.isSecret).forEach((m) => {
      const pinsSummary = (m.pins || []).map((p) => `${p.title} (${p.category})`).join(', ');
      mapChunks.push(`- Mappa: "${m.title}" [Luoghi segnati: ${pinsSummary || 'nessuno'}]`);
    });

    // =========================================================================
    // 6. ASSEMBLE CONTEXT WITH DYNAMIC BUDGET ALLOCATION
    // =========================================================================
    const baseCharactersText = characterChunks.join('\n\n');
    const baseMapsText = mapChunks.join('\n');
    const baseCostTokens = estimateTokens(graphSectionChunk + calendarChunk + baseCharactersText + baseMapsText);

    let remainingBudgetTokens = Math.max(4000, maxContextTokens - baseCostTokens);

    let sessionBudget = Math.floor(remainingBudgetTokens * 0.45);
    let entityBudget = Math.floor(remainingBudgetTokens * 0.35);
    let noteBudget = Math.floor(remainingBudgetTokens * 0.20);

    // Sort chosen sessions chronologically (from earliest to latest) so the timeline is naturally presented to the model
    const chosenSessionObjects: { session: typeof sessions[0]; text: string; number: number; isLatest: boolean }[] = [];
    let currentSessionTokens = 0;

    const maxSessionNumber = sessions.reduce((max, s) => Math.max(max, s.number || 0), 0);

    for (const item of scoredSessions) {
      const isLatest = item.number === maxSessionNumber && maxSessionNumber > 0;
      const temporalHeader = isLatest
        ? `[PRESENTE ATTUALE DELLA CAMPAGNA - ULTIMA SESSIONE REGISTRATA]`
        : `[PASSATO / MEMORIA STORICA CONCLUSA - AVVENUTA IN PRECEDENZA]`;

      const formattedText = `${temporalHeader}\n${item.text}`;
      const snippet = formattedText.length > 3500 ? `${formattedText.slice(0, 3500)}...` : formattedText;
      const cost = estimateTokens(snippet);
      if (currentSessionTokens + cost <= sessionBudget) {
        chosenSessionObjects.push({ session: item.session, text: snippet, number: item.number, isLatest });
        currentSessionTokens += cost;
      } else if (chosenSessionObjects.length === 0) {
        const slice = snippet.slice(0, 1500);
        chosenSessionObjects.push({ session: item.session, text: slice, number: item.number, isLatest });
        currentSessionTokens += estimateTokens(slice);
        break;
      }
    }

    // Sort chronologically (ascending by session number)
    chosenSessionObjects.sort((a, b) => a.number - b.number);
    const chosenSessions = chosenSessionObjects.map((s) => s.text);

    const chosenEntities: string[] = [];
    let currentEntityTokens = 0;
    for (const item of scoredEntities) {
      const snippet = item.text.length > 1200 ? `${item.text.slice(0, 1200)}...` : item.text;
      const cost = estimateTokens(snippet);
      if (currentEntityTokens + cost <= entityBudget) {
        chosenEntities.push(snippet);
        currentEntityTokens += cost;
      } else if (chosenEntities.length === 0) {
        chosenEntities.push(snippet.slice(0, 600));
        break;
      }
    }

    const chosenNotes: string[] = [];
    let currentNoteTokens = 0;
    for (const item of scoredNotes) {
      const snippet = item.text.length > 1200 ? `${item.text.slice(0, 1200)}...` : item.text;
      const cost = estimateTokens(snippet);
      if (currentNoteTokens + cost <= noteBudget) {
        chosenNotes.push(snippet);
        currentNoteTokens += cost;
      } else if (chosenNotes.length === 0) {
        chosenNotes.push(snippet.slice(0, 600));
        break;
      }
    }

    // Populate sourcesAvailable with top 3 most relevant chosen sessions and entities
    scoredSessions.slice(0, 3).forEach((item) => {
      if (item.relevance > 10 || codexEntity?.aiConfig?.knownSessionIds?.includes(item.session._id)) {
        sourcesAvailable.push({
          type: 'session',
          title: `Sessione ${item.session.number}: ${item.session.title}`,
          subtitle: item.session.loreDate || item.session.date,
          link: `/sessions?session=${item.session._id}`,
        });
      }
    });

    scoredEntities.slice(0, 3).forEach((item) => {
      if (item.relevance > 10 || item.entity._id === codexEntity?._id || codexEntity?.aiConfig?.knownEntityIds?.includes(item.entity._id)) {
        sourcesAvailable.push({
          type: 'codex',
          title: item.entity.name,
          subtitle: `${item.entity.type.toUpperCase()} • ${item.entity.status}`,
          link: `/codex/${item.entity.type}/${item.entity._id}`,
        });
      }
    });

    // Populate top chosen notes into sourcesAvailable ONLY in general Archivist mode (NEVER for NPC Sendipietra)
    if (!codexEntity && scoredNotes.length > 0) {
      scoredNotes.slice(0, 2).forEach((item) => {
        if (item.relevance > 10) {
          sourcesAvailable.push({
            type: 'note',
            title: item.note.title,
            subtitle: `Autore: ${item.note.author?.characterName || 'N/D'}`,
            link: `/notes?note=${item.note._id}`,
          });
        }
      });
    }

    // Extract directly linked sessions to embed in NPC profile
    const directlyLinkedSessions = codexEntity
      ? sessions.filter(
          (s) =>
            codexEntity.aiConfig?.knownSessionIds?.includes(s._id) ||
            (s.linkedEntityIds && s.linkedEntityIds.includes(codexEntity._id)) ||
            (s.events || []).some((e) => e.linkedEntityIds && e.linkedEntityIds.includes(codexEntity._id)) ||
            (s.title + ' ' + extractPlainText(s.recap)).toLowerCase().includes(codexEntity.name.toLowerCase())
        )
      : [];

    // For codex entity, always ensure directly linked sessions are in sourcesAvailable
    if (codexEntity && directlyLinkedSessions.length > 0) {
      directlyLinkedSessions.forEach((s) => {
        if (!sourcesAvailable.some((src) => src.link === `/sessions?session=${s._id}`)) {
          sourcesAvailable.push({
            type: 'session',
            title: `Sessione ${s.number}: ${s.title}`,
            subtitle: s.loreDate || s.date,
            link: `/sessions?session=${s._id}`,
          });
        }
      });
    }

    let entityHeaderChunk = '';
    if (codexEntity && !isMultiMode) {
      const rel = codexEntity.aiConfig?.partyRelations?.[currentUser._id] ||
        Object.values(codexEntity.aiConfig?.partyRelations || {}).find(
          (r) => r.characterName && currentUser.characterName && r.characterName.toLowerCase() === currentUser.characterName.toLowerCase()
        );

      const speakerName = currentUser.characterName || (currentUser.isDm ? 'Dungeon Master' : 'Giocatore');

      const attitudeLabels: Record<string, string> = {
        friendly: '😊 Amichevole / Alleato di fiducia',
        helpful: '🤝 Disponibile e cooperativo',
        neutral: '😐 Neutrale / Formale',
        suspicious: '🤨 Diffidente e sospettoso',
        hostile: '😡 Ostile e contrariato',
        fearful: '😨 Timoroso e intimorito',
        devoted: '👑 Devoto e leale',
      };

      const attitudeText = attitudeLabels[rel?.attitude || 'neutral'] || 'Neutrale / Formale';
      const relationType = rel?.relationType || 'Nessun legame formale registrato';
      const relationNotes = rel?.notes || '';

      const relProgressionList = (rel?.progression && rel.progression.length > 0)
        ? rel.progression.map((p) => `    - [${p.loreDate ? `Data: ${p.loreDate} | ` : ''}${p.sessionNumber ? `Sess. ${p.sessionNumber}` : p.sessionTitle || 'Sessione'}]: Svolta: "${p.event}" (Atteggiamento divenne: ${attitudeLabels[p.attitude] || p.attitude})`).join('\n')
        : '';

      const entityRelationsList = codexEntity.aiConfig?.entityRelations
        ? Object.values(codexEntity.aiConfig.entityRelations).map((er) => {
            const att = attitudeLabels[er.attitude || 'neutral'] || 'Neutrale';
            const prog = (er.progression && er.progression.length > 0)
              ? ` [Svolte storiche: ${er.progression.map((p) => `${p.sessionNumber ? `Sess.${p.sessionNumber}` : (p.loreDate || 'Data')}: "${p.event}" (${attitudeLabels[p.attitude] || p.attitude})`).join('; ')}]`
              : '';
            return `  * Legame con [${(er.targetEntityType || 'codex').toUpperCase()}: ${er.targetEntityName || 'Entità'}]: ${er.relationType || 'Connessione'} (${att})${er.notes ? ` - "${er.notes}"` : ''}${prog}`;
          }).join('\n')
        : '';

      const linkedSessionsSummary = directlyLinkedSessions
        .map((s) => {
          const recap = extractPlainText(s.recap);
          const evts = (s.events || []).map((e) => `${e.title}: ${e.description}`).join('; ');
          return `  * [Sessione ${s.number}: "${s.title}"] Eventi vissuti con il party: ${evts ? evts.slice(0, 450) : recap.slice(0, 450)}`;
        })
        .join('\n');

      const guardedSecrets = (codexEntity.aiConfig?.secrets || [])
        .filter((s) => !s.isRevealed)
        .map((s) => `  * [CUSTODITO] ${s.title}${s.revelationCondition ? ` (Condizione: ${s.revelationCondition})` : ''}`)
        .join('\n');

      const revealedSecrets = (codexEntity.aiConfig?.secrets || [])
        .filter((s) => s.isRevealed)
        .map((s) => `  * [SVELATO AL PARTY] ${s.title}`)
        .join('\n');

      const rawLegacySecret = codexEntity.aiConfig?.secretsToProtect ? `  * ${codexEntity.aiConfig.secretsToProtect}` : '';

      const secretsSection = [
        revealedSecrets ? `\n- FATTI E SEGRETI GIÀ SVELATI AL PARTY (CONOSCENZA PUBBLICA):\n${revealedSecrets}` : '',
        guardedSecrets || rawLegacySecret
          ? `\n- SEGRETI CUSTODITI & LIMITI DI RIVELAZIONE (RISERVATI / DA PROTEGGERE):\n${guardedSecrets || rawLegacySecret}`
          : '\n- Segreti & Limiti di Rivelazione: Nessun segreto riservato registrato.',
      ].filter(Boolean).join('\n');

      const npcMemoriesList = (codexEntity.aiConfig?.timelineMemories || [])
        .map((m) => `  * [${m.loreDate || 'Data Lore'}] ${m.title}: ${m.summary}`)
        .join('\n');

      const npcBeliefsList = (codexEntity.aiConfig?.evolvingBeliefs || [])
        .map((b) => `  * [${b.status} - ${b.subject}] Verità attuale: "${b.currentTruth}"${b.previousBelief ? ` (Prima credeva: "${b.previousBelief}")` : ''}${b.revealedLoreDate ? ` [Data: ${b.revealedLoreDate}]` : ''}`)
        .join('\n');

      const worldLoreArticles = CampaignManager.getWorldLoreArticles();
      const entityLoreBites = worldLoreArticles.flatMap((art) =>
        (art.bites || [])
          .filter((b) => b.knownBy?.some((k) => k.id === codexEntity._id && k.type === 'entity'))
          .map((b) => `  * [${b.level}] ${art.title} > ${b.title}: ${b.content}`)
      );
      const entityLoreBitesText = entityLoreBites.length > 0 ? entityLoreBites.join('\n') : '';

      entityHeaderChunk = `
================ PROFILO INTERLOCUTORE SOTTO-CODEX: ${codexEntity.name.toUpperCase()} (${codexEntity.type.toUpperCase()}) ================
- Nome Entità: ${codexEntity.name}
- Categoria: ${codexEntity.type.toUpperCase()}
- Alias / Titoli: ${codexEntity.aliases?.join(', ') || 'Nessuno'}
- Luogo / Dimora: ${codexEntity.location || 'Nessun luogo specifico'}
- Stato Operativo: ${codexEntity.status}
- STATO & SITUAZIONE ATTUALE NEL PRESENTE: ${codexEntity.aiConfig?.currentStatus || 'Nessuno stato temporale specifico indicato.'}
- Stile di Parlata & Personalità: ${codexEntity.aiConfig?.speechStyle || 'Parlata naturale nel ruolo del personaggio'}
- Ambito di Conoscenza (Sotto-Codex): ${codexEntity.aiConfig?.knowledgeScope || codexEntity.progressNote || 'Fatti del compendio'}${secretsSection}
- Note & Storia Registrata:
  ${codexEntity.progressNote || 'Nessuna nota aggiuntiva.'}
${npcMemoriesList ? `\n--- CRONOLOGIA MEMORIE DI LORE VISSUTE DA ${codexEntity.name.toUpperCase()} ---\n${npcMemoriesList}\n` : ''}
${npcBeliefsList ? `\n--- CREDENZE, TEORIE & VERITÀ APPRESE DA ${codexEntity.name.toUpperCase()} ---\n${npcBeliefsList}\n` : ''}
${entityLoreBitesText ? `\n--- CONOSCENZE COSMICHE & WORLD LORE CUSTODITE DA ${codexEntity.name.toUpperCase()} ---\n${entityLoreBitesText}\n` : ''}
--- DIRETTIVE DI SEGRETEZZA E RIVELAZIONE PROGRESSIVA DEL PNG ---
* SE L'UTENTE È IL DUNGEON MASTER (${currentUser.isDm ? 'SÌ, SEI CON IL DM' : 'NO, SEI CON UN GIOCATORE'}):
  ${currentUser.isDm 
    ? 'Parla liberamente di tutti i tuoi segreti, retroscena e dettagli se interrogato, oppure recita nel ruolo fornendo al DM sia la resa diegetica che i dettagli nascosti.'
    : `NON rivelare mai spontaneamente i tuoi segreti custoditi. I fatti contrassegnati come "[SVELATO AL PARTY]" possono invece essere discussi liberamente.
  - Se l'atteggiamento verso ${speakerName} è ${attitudeText} (neutrale, diffidente, ostile o timoroso), mantieni i segreti custoditi, svia la conversazione, minimizza o mostra riserbo in-character (*sguardo guardingo*, *cambia discorso*).
  - Rivela un segreto custodito SOLTANTO se il giocatore soddisfa la condizione indicata o dimostra di aver scoperto prove concrete durante la conversazione.
  - Non uscire mai dal personaggio e non citare mai metagame o regole esterne.`}

--- MEMORIA STORICA DELLE SESSIONI VISSUTE DA ${codexEntity.name.toUpperCase()} CON IL PARTY ---
${linkedSessionsSummary || 'Nessuna sessione specifica registrata finora.'}
(ATTENZIONE MANDATORIA: I fatti descritti sopra sono VERITÀ COMPIUTA della campagna. Se il party ha completato una bonifica, sconfitto una creatura, purificato la terra o risolto un tuo problema, QUEL PROBLEMA È RISOLTO. È SEVERAMENTE VIETATO inventare che il problema sia ricomparso o che la bonifica sia fallita!)

--- RELAZIONE PERSONALIZZATA CON L'UTENTE IN CHAT ---
- STAI PARLANDO CON: "${speakerName}" (${currentUser.isDm ? 'Ruolo: Dungeon Master / Giocatore' : 'Membro del Party'})
- ATTEGGIAMENTO VERSO ${speakerName}: ${attitudeText}
- LEGAME CON ${speakerName}: ${relationType}
${relationNotes ? `- TRASCORSI E NOTE CONDIVISE CON ${speakerName}: ${relationNotes}` : ''}
${relProgressionList ? `\n--- CRONOLOGIA STORICA DELLE SVOLTE CON ${speakerName.toUpperCase()} ---\n${relProgressionList}\n` : ''}${entityRelationsList ? `\n--- RELAZIONI CON ALTRE ENTITÀ DEL COMPENDIO ---\n${entityRelationsList}\n` : ''}===================================================================================================
`;
    }

    let chronologyChunk = '';
    if (sessions && sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.number - a.number);
      const latestSession = sorted[0];
      chronologyChunk = `
================ CONTESTO TEMPORALE CORRENTE DELLA CAMPAGNA ================
- IL PRESENTE DELLA CAMPAGNA (SESSIONE CORRENTE): Sessione ${latestSession.number}: "${latestSession.title}"
- DATA DI CAMPAGNA ATTUALE (LORE): ${latestSession.loreDate || 'Non specificata o variabile'}
- ATTENZIONE CRITICA PER LA CRONOLOGIA:
  * Qualsiasi evento descritto nelle sessioni da 1 a ${latestSession.number} è un Fatto Storico realmente accaduto nel PASSATO di questa campagna.
  * Se un personaggio, mostro o nemico è DECEDUTO, MORTO (status: dead) o SCONFITTO in una di queste sessioni storiche, significa che nel PRESENTE della campagna egli è morto ed è assolutamente vietato farlo agire come se fosse vivo, vegeto o ancora intento a combattere!
  * Se una quest risulta "completata" o "fallita", o una bonifica è stata eseguita, quella situazione è risolta nel presente!
=============================================================================
`;
    }

    const allWorldLoreArticles = CampaignManager.getWorldLoreArticles().filter((a) => !a.dmOnly || isDm);
    const worldLoreSummaryText = allWorldLoreArticles.length > 0
      ? allWorldLoreArticles.map((a) => `* [${a.category.toUpperCase()}] "${a.title}": ${a.summary || a.fullContentMarkdown.slice(0, 300)} (Nozioni: ${a.bites.map((b) => `[${b.level}] ${b.title}`).join(', ')})`).join('\n')
      : 'Nessuna voce di World Lore registrata.';

    const fullContext = `
${chronologyChunk}
${entityHeaderChunk}
================ REGISTRI DELLA CAMPAGNA (CHRONICLE) ================

${graphSectionChunk}

${calendarChunk}

=== WORLD LORE & PRINCIPI DEL MONDO (COSMOGONIA, DEI, LEGGI MAGICHE) ===
${worldLoreSummaryText}

=== SESSIONI DI GIOCO VISSUTE ===
${chosenSessions.length > 0 ? chosenSessions.join('\n\n') : 'Nessuna sessione registrata.'}

=== COMPENDIO & CODEX (PERSONAGGI, LUOGHI, MOSTRI, FAZIONI, OGGETTI, QUEST) ===
${chosenEntities.length > 0 ? chosenEntities.join('\n') : 'Nessuna entità registrata.'}

=== DIARIO E APPUNTI CONDIVISI ===
${chosenNotes.length > 0 ? chosenNotes.join('\n') : 'Nessuna nota condivisa registrata.'}

=== SCHEDE PERSONAGGIO DEL PARTY (SECONDO VISIBILITÀ CONDIVISA) ===
${baseCharactersText || 'Nessun personaggio registrato.'}

=== ATLANTE & CARTOGRAFIA ===
${baseMapsText || 'Nessuna mappa registrata.'}
=====================================================================
`.trim();

    return {
      contextText: fullContext,
      sourcesAvailable,
      otherPartyNames,
      isDm,
    };
  }

  /**
   * Generates the system instruction prompt with privacy boundaries, relational reasoning directives, citations, and effort/verbosity guidelines.
   */
  static buildSystemPrompt(
    currentUser: Player,
    contextText: string,
    otherPartyNames: string[],
    personaPrompt?: string,
    effortLevel: OracleEffortLevel = 'balanced',
    isMultiPg = false
  ): string {
    const isDm = Boolean(currentUser.isDm);
    const userName = currentUser.characterName || 'Avventuriero';

    let privacyDirective = '';

    if (isMultiPg) {
      privacyDirective = `
RUOLO E AMBITO: SIMULATORE DI DIALOGO MULTI-SOGGETTO TRA PG E PNG
- Stai simulando una vivace scena teatrale in-character tra più soggetti distinti (PG e/o PNG del Compendio).
- Ciascun personaggio DEVE essere interpretato rigorosamente con la propria voce, dialetto, personalità e limiti di conoscenza stabiliti nel suo profilo individuale.
- È CATEGORICAMENTE VIETATO uniformare le parlate o attribuire a tutti lo stile, il dialetto o l'accento di uno solo.
`;
    } else if (isDm) {
      privacyDirective = `
RUOLO E AMBITO: DUNGEON MASTER (CUSTODE DELLE CRONACHE)
- L'utente sta consultando le cronache con il ruolo di Dungeon Master / Custode della Campagna.
- L'Oracolo risponde basandosi ESCLUSIVAMENTE sui fatti documentati nelle sessioni giocate, sul compendio del mondo (luoghi, fazioni, PNG, mostri, oggetti magici), sul calendario e sulle informazioni che i giocatori hanno registrato e condiviso.
- Non inventare trame non scritte: sei la memoria storica delle cronache registrate. Se un dettaglio non è documentato nei registri, dichiara con chiarezza che le memorie non ne fanno menzione.
`;
    } else {
      const othersList = otherPartyNames.length > 0 ? otherPartyNames.join(', ') : 'gli altri compagni di party';
      privacyDirective = `
RUOLO E PROSPETTIVA: PERSONAGGIO GIOCANTE ("${userName}")
1. CONOSCENZA DEL PROPRIO PERSONAGGIO:
   - L'utente interroga l'Oracolo dal punto di vista del proprio personaggio "${userName}".
   - Puoi rispondere liberamente a qualsiasi domanda sul SUO personaggio: anagrafica, tratti, ideali, legami, difetti, appunti personali e retroscena registrati nella sua scheda.

2. RISPETTO RIGOROSO DELLA PRIVACY E VISIBILITÀ DEGLI ALTRI MEMBRI DEL PARTY (${othersList}):
   - Per ciascuno degli altri personaggi (${othersList}), l'Oracolo conosce ed espone SOLO ciò che quel giocatore ha reso esplicitamente visibile al party nelle impostazioni di condivisione della sua scheda (es. aspetto fisico o tratti se condivisi).
   - Se un compagno NON ha condiviso i suoi segreti intimi ("SEGRETI PERSONALI"), il suo passato riservato o i suoi appunti personali, tali informazioni NON SONO VISIBILI al tuo personaggio.
   - Se l'utente ti chiede informazioni intime o segrete su un altro personaggio che non sono state rese pubbliche, rispondi con naturalezza:
     "Questa informazione fa parte della sfera intima e riservata di [Nome] e non è stata condivisa con il party; l'Oracolo delle Cronache non ne ha memoria accessibile."
   - Puoi condividere sugli altri PG solo i fatti vissuti insieme durante le sessioni giocate, le azioni pubbliche e i dettagli condivisi.

3. NOTE E PREPARAZIONE RISERVATA DEL DM:
   - Non rivelare appunti di preparazione contrassegnati come riservati al DM.
`;
    }

    const effortPreset = EFFORT_PRESETS[effortLevel] || EFFORT_PRESETS.balanced;

    const personaInstruction = personaPrompt
      ? `=== PROFILO COMUNICATIVO AGENTE (STILE & PERSONALITÀ MANDATORI) ===\n${personaPrompt}\n=== END PROFILO ===\n\n`
      : `Sei Prismalink delle Cronache di Chronicle, l'antico archivio vivente e custode della memoria storica e relazionale di questa campagna di Dungeons & Dragons.\n\n`;

    return `${personaInstruction}Il tuo compito è rispondere in modo esauriente, dettagliato e rigorosamente documentato alle domande, consultando TUTTI i registri della campagna (Grafo Relazionale, Sessioni, Compendio Codex, Note, Schede Personaggio, Calendario ed Eventi).

${privacyDirective}

${isMultiPg ? '' : effortPreset.promptDirective}

REGOLE MANDATARIE DI ANALISI E RISPOSTA:

1. LINGUA E RAGIONAMENTO INTERNO:
   - RISPONDI SEMPRE ED ESCLUSIVAMENTE IN LINGUA ITALIANA. Non usare mai la lingua inglese.
   - NON mostrare mai tag di pensiero o ragionamenti interni (come <think> o <reasoning>): fornisci direttamente e soltanto la risposta narrativa finale recitata nel tuo personaggio.

2. GESTIONE DELLE DOMANDE RELAZIONALI E DEDUTTIVE (es. "Che relazione c'è tra X e Y?", "Come si collegano A e B?", "Perché X ha fatto Y?"):
   - Esamina con priorità la sezione "RETE RELAZIONALE DIRETTA ED EVENTI CONDIVISI (KNOWLEDGE GRAPH)" e le co-occorrenze nelle sessioni.
   - Struttura la risposta relazionale in modo organico:
     a) **Natura del Legame**: spiega l'affiliazione diretta (es. fazione comune, parentela, alleanza politica, ostilità o appartenenza geografica).
     b) **Evoluzione Temporale**: ricostruisci i momenti e le sessioni in cui i soggetti hanno interagito o sono stati coinvolti nello stesso evento, citando sempre la sessione precisa (es. [Sessione 2], [Sessione 5]).
     c) **Stato Attuale**: riassumi la situazione del loro rapporto in base all'ultimo evento registrato.

3. FEDELTÀ ASSOLUTA AI DATI DOCUMENTATI:
   - Rispondi basandoti ESCLUSIVAMENTE sui registri della campagna forniti sotto. Non inventare legami o fatti mai registrati. Se un'informazione o un legame non è presente nei registri, dichiara esplicitamente che le memorie non ne fanno menzione.

4. CITAZIONE DELLE FONTI (DISCIPLINA ED ESSENZIALITÀ):
   - NON inserire MAI citazioni formali tra parentesi quadre (come [Sessione X], [Codex: Nome], [Nota: ...], [Luogo: ...] o "(Fonte: ...)") all'interno delle tue frasi, del discorso parlato o della narrazione.
   - Parla sempre in modo fluido, naturale e diegetico: l'interfaccia si occuperà automaticamente di raccogliere ed esporre le fonti in calce.
   - VIETATO ASSOLUTAMENTE fare elenchi o dump di sessioni (es. VIETATO scrivere frasi come "impegnata nelle sessioni [Sessione 1], [Sessione 2], [Sessione 3]...").
   - Nelle domande conversazionali, salutari o informali ("Ciao come stai?", "Hai visto Tizio?"), rispondi in modo naturale e spontaneo nel tuo personaggio, senza comportarti da motore di ricerca o fare report da database!

${isMultiPg ? `5. INDIPENDENZA TOTALE DELLE VOCI, DEGLI ACCENTI E DEI DIALETTI:
   - DEVI interpretare ciascun partecipante rispettando RIGOROSAMENTE il suo stile di parlata, accento e dialetto unico (es. toscano, romano, polacco, aulico, rozzo).
   - È TASSATIVAMENTE VIETATO contaminare i personaggi tra loro: se il personaggio A parla toscano, SOLO lui usa il toscano; se il personaggio B parla romano, SOLO lui parla romano! Ciascuna battuta deve riflettere unicamente la voce e i modi di dire del soggetto che la pronuncia.
   - FORMATTAZIONE AZIONI E BATTUTE: scrivi sempre le azioni tra asterischi *azione* su una riga separata rispetto alle parole parlate.` : `5. TONO, STILE E RECITAZIONE MANDATORIA:
   - Rispondi sempre in italiano.
   - NON rispondere MAI con un arido o impersonale resoconto da database!
   - DEVI recitare al 100% nel ruolo del profilo comunicativo dell'agente attivo (usando azioni tra asterischi *azione*, modi di dire del personaggio, gesti e voce unica).
   - FORMATTAZIONE AZIONI SU NUOVA RIGA: le azioni e i gesti tra asterischi *azione* DEVONO SEMPRE STARE SU UNA PROPRIA RIGA SEPARATA (con riga vuota prima e dopo). NON unire MAI azioni in corsivo e discorso parlato nella stessa riga continua: separa nettamente i gesti fisici dalle battute pronunciate.
   - Esprimi i fatti storici e i ricordi con le parole vive del tuo personaggio, senza mai spezzare il discorso con parentesi quadre o codici di archivio.`}

${contextText}

${isMultiPg ? `=== DIRETTIVA FINALE DI RUOLO (MULTI-SOGGETTO) ===
RICORDA: Interpreta la scena corale tra i personaggi selezionati. Mantieni per CIASCUN personaggio il suo stile, accento, dialetto e le sue conoscenze esclusive riga per riga, senza mai uniformare o confondere le voci!` : `=== DIRETTIVA FINALE DI RUOLO ===
RICORDA: Rispondi in lingua ITALIANA interpretando SEMPRE ed ESCLUSIVAMENTE il personaggio dell'Agente selezionato. Mantieni il suo tono, la sua voce unica e scrivi SEMPRE le azioni tra asterischi *azione* su una riga separata rispetto alle battute di dialogo!`}
`;
  }

  /**
   * Queries the Oracle backend API endpoint via Gemini or OpenRouter.
   */
  static async queryOracle(params: {
    question: string;
    currentUser: Player;
    history: OracleMessage[];
    engine?: 'gemini' | 'openrouter' | 'cloudflare';
    provider?: 'gemini' | 'openrouter' | 'cloudflare';
    model?: string;
    personaPrompt?: string;
    codexEntity?: Entity;
    effortLevel?: OracleEffortLevel;
    abortSignal?: AbortSignal;
    selectedPgIds?: string[];
    selectedEntityIds?: string[];
  }): Promise<{
    answer: string;
    thought?: string;
    sources?: OracleSource[];
    modelUsed: string;
    engine: 'gemini' | 'openrouter' | 'cloudflare';
  }> {
    const provider = params.provider || params.engine || 'gemini';
    const {
      question,
      currentUser,
      history,
      model = provider === 'cloudflare'
        ? '@cf/meta/llama-3.3-70b-instruct-fp8'
        : provider === 'openrouter'
        ? 'openrouter/free'
        : 'gemini-3.8-flash',
      personaPrompt: customPersonaPrompt,
      codexEntity,
      effortLevel = 'balanced',
      abortSignal,
      selectedPgIds = [],
      selectedEntityIds = [],
    } = params;

    let effectivePersonaPrompt = customPersonaPrompt;

    const totalMultiCount = selectedPgIds.length + selectedEntityIds.length;
    const isMultiSubject = Boolean(totalMultiCount >= 2);

    const allPlayers = CampaignManager.getPlayers();
    const allBios = CampaignManager.getAllCharacterBios();
    const allEntities = CampaignManager.getEntities();

    const chosenPlayers = isMultiSubject
      ? (selectedPgIds.map((id) => allPlayers.find((p) => p._id === id)).filter(Boolean) as Player[])
      : [];

    const chosenEntities = isMultiSubject
      ? (selectedEntityIds.map((id) => allEntities.find((e) => e._id === id)).filter(Boolean) as Entity[])
      : [];

    if (isMultiSubject) {
      const pgsDataText = chosenPlayers
        .map((p) => {
          const bio = allBios.find((b) => b.playerId === p._id);
          const name = p.characterName || 'Sconosciuto';
          const pClass = bio?.characterClass || 'Avventuriero';
          const pRace = bio?.characterRace || 'Sconosciuto';
          const pAlign = bio?.characterAlignment || 'Neutrale';
          const traits = bio?.personalityTraits ? bio.personalityTraits.join(', ') : 'Nessuno';
          const ideals = bio?.ideals || 'Nessuno';
          const bonds = bio?.bonds || 'Nessuno';
          const flaws = bio?.flaws || 'Nessuno';
          const currentStatus = bio?.currentStatus || '';
          const backstory = bio?.backstoryMarkdown ? bio.backstoryMarkdown.slice(0, 800) : '';

          const memories = (bio?.timelineMemories || [])
            .map((m) => `  * [${m.loreDate || 'Data Lore'}] ${m.title} (${m.category}): ${m.summary}`)
            .join('\n');

          const beliefs = (bio?.evolvingBeliefs || [])
            .map((b) => `  * [${b.subject}]: ${b.currentTruth} (${b.status})`)
            .join('\n');

          const interParty = chosenPlayers
            .filter((op) => op._id !== p._id)
            .map((op) => {
              const rel = bio?.interPartyRelations?.[op._id];
              return `  * Verso ${op.characterName}: Fiducia ${rel?.trustLevel ?? 5}/10, Atteggiamento "${rel?.attitude || 'neutral'}", Legame "${rel?.relationType || 'Compagno'}"${rel?.notes ? ` - "${rel.notes}"` : ''}`;
            })
            .join('\n');

          return `### PERSONAGGIO GIOCANTE (PG): ${name}
- Classe: ${pClass} | Razza: ${pRace} | Allineamento: ${pAlign}
${currentStatus ? `- Condizione e Riflessione nel Presente: "${currentStatus}"` : ''}
- Tratti di Personalità: ${traits}
- Ideali: ${ideals}
- Legami: ${bonds}
- Difetti: ${flaws}
${memories ? `- Cronologia Memorie di Lore:\n${memories}` : ''}
${beliefs ? `- Teorie & Credenze di Campagna:\n${beliefs}` : ''}
${interParty ? `- Rapporti con gli altri PG presenti:\n${interParty}` : ''}
${backstory ? `- Backstory e Passato: ${backstory}` : ''}`;
        })
        .join('\n\n');

      const entsDataText = chosenEntities
        .map((e, idx) => {
          const name = e.name || 'Sconosciuto';
          const type = e.type || 'Sconosciuto';
          const speechStyle = e.aiConfig?.speechStyle || 'Parlata schietta e diretta nel proprio ruolo';
          const knowledgeScope = e.aiConfig?.knowledgeScope || e.progressNote || 'Fatti e conoscenze documentati di questa entità';
          const secretsToProtect = e.aiConfig?.secretsToProtect || '';
          const currentStatus = e.aiConfig?.currentStatus || '';
          const status = e.status || 'alive';
          const bodyText = extractPlainText(e.body);

          const memories = (e.aiConfig?.timelineMemories || [])
            .map((m) => `  * [${m.loreDate || 'Data Lore'}] ${m.title}: ${m.summary}`)
            .join('\n');

          const beliefs = (e.aiConfig?.evolvingBeliefs || [])
            .map((b) => `  * [${b.subject}]: ${b.currentTruth} (${b.status})`)
            .join('\n');

          // Cross-relations with other selected participants
          const crossRelations: string[] = [];
          for (const other of chosenEntities) {
            if (other._id === e._id) continue;
            const rel = e.aiConfig?.entityRelations?.[other._id] ||
              Object.values(e.aiConfig?.entityRelations || {}).find(
                (r) => r.targetEntityId === other._id || (r.targetEntityName && r.targetEntityName.toLowerCase() === other.name.toLowerCase())
              );
            if (rel) {
              crossRelations.push(`  * Verso ${other.name}: ${rel.relationType || 'Legame'} (Atteggiamento: ${rel.attitude || 'Neutrale'})${rel.notes ? ` - "${rel.notes}"` : ''}`);
            }
          }
          for (const player of chosenPlayers) {
            const rel = e.aiConfig?.partyRelations?.[player._id] ||
              Object.values(e.aiConfig?.partyRelations || {}).find(
                (r) => (r.characterName && player.characterName && r.characterName.toLowerCase() === player.characterName.toLowerCase())
              );
            if (rel) {
              crossRelations.push(`  * Verso il PG ${player.characterName}: ${rel.relationType || 'Legame'} (Atteggiamento: ${rel.attitude || 'Neutrale'})${rel.notes ? ` - "${rel.notes}"` : ''}`);
            }
          }

          return `--------------------------------------------------------------------------------
>>> SCHEDA PERSONAGGIO #${idx + 1}: ${name.toUpperCase()} (${type.toUpperCase()}) <<<
- Nome: ${name}
- Stato Vitale: ${status.toUpperCase()} ${status === 'dead' ? '(DECEDUTO / MORTO NELLA CAMPAGNA: parla come spirito incorporeo, fantasma o eco del passato dall\'oltretomba)' : ''}
${currentStatus ? `- Situazione e Condizione Attuale nel Presente: "${currentStatus}"` : ''}

[STILE VOCALE, DIALETTO ED ACCENTO ESCLUSIVO DI ${name.toUpperCase()}]:
- STILE DI PARLATA: "${speechStyle}"
- REGOLA ASSOLUTA: Questo stile, dialetto, accento e modo di esprimersi appartengono UNICAMENTE a ${name}. È SEVERAMENTE VIETATO farlo usare agli altri personaggi!

[AMBITO DI CONOSCENZA ESCLUSIVO (SOTTO-CODEX DI ${name.toUpperCase()})]:
- COSA SA QUESTO PERSONAGGIO: "${knowledgeScope}"
${secretsToProtect ? `- SEGRETI PERSONALI DA PROTEGGERE: "${secretsToProtect}"` : ''}
${memories ? `\n- Memorie di Lore Vissute:\n${memories}` : ''}
${beliefs ? `\n- Teorie & Verità di Campagna:\n${beliefs}` : ''}
- REGOLA ASSOLUTA: ${name} conosce SOLO queste informazioni e i fatti delle sessioni a cui ha preso parte. Non possiede le memorie intime o i segreti degli altri partecipanti!
${bodyText ? `- Note dal Compendio: ${bodyText.slice(0, 350)}` : ''}
${crossRelations.length > 0 ? `- Atteggiamento verso gli altri presenti:\n${crossRelations.join('\n')}` : '- Atteggiamento verso gli altri: Nessun legame pregresso registrato.'}`;
        })
        .join('\n\n');

      const allNames = [
        ...chosenPlayers.map((p) => p.characterName),
        ...chosenEntities.map((e) => e.name),
      ];

      let linesDirective = '';
      if (effortLevel === 'brief') {
        linesDirective = 'La discussione deve svolgersi obbligatoriamente su ESATTAMENTE 2 GIRI completi di battute a testa per ciascun partecipante (quindi ogni partecipante deve fare esattamente 2 interventi in totale). L\'ordine degli interventi deve essere rigorosamente circolare, dove il primo risponde, poi il secondo, poi l\'eventuale terzo, e poi si ripete lo stesso identico ordine per il secondo giro (es. Giro 1: [Soggetto X -> Soggetto Y -> Soggetto Z] e Giro 2: [Soggetto X -> Soggetto Y -> Soggetto Z]). Totale righe di battute complessive = (numero partecipanti * 2).';
      } else if (effortLevel === 'deep') {
        linesDirective = 'La discussione deve svolgersi obbligatoriamente su ESATTAMENTE 6 GIRI completi di battute a testa per ciascun partecipante (quindi ogni partecipante deve fare esattamente 6 interventi in totale). L\'ordine degli interventi deve essere rigorosamente circolare, ripetendo lo stesso identico ordine dei partecipanti per tutti e 6 i giri (es. Giro 1: [X -> Y -> Z], Giro 2: [X -> Y -> Z], Giro 3: [X -> Y -> Z], Giro 4: [X -> Y -> Z], Giro 5: [X -> Y -> Z], Giro 6: [X -> Y -> Z]). Totale righe di battute complessive = (numero partecipanti * 6).';
      } else {
        // balanced
        linesDirective = 'La discussione deve svolgersi obbligatoriamente su ESATTAMENTE 4 GIRI completi di battute a testa per ciascun partecipante (quindi ogni partecipante deve fare esattamente 4 interventi in totale). L\'ordine degli interventi deve essere rigorosamente circolare, ripetendo lo stesso identico ordine dei partecipanti per tutti e 4 i giri (es. Giro 1: [X -> Y -> Z], Giro 2: [X -> Y -> Z], Giro 3: [X -> Y -> Z], Giro 4: [X -> Y -> Z]). Totale righe di battute complessive = (numero partecipanti * 4).';
      }

      effectivePersonaPrompt = `================================================================================
MODALITÀ DIALOGO DI GRUPPO MULTI-SOGGETTO:
Stai simulando una vivace discussione in-character (GDR teatrale) tra i seguenti ${totalMultiCount} partecipanti (PG e PNG/Entità del Codex):
${allNames.map((name) => `- **${name}**`).join('\n')}

Ecco i dati, le personalità, gli stili di parlata e gli ambiti di conoscenza di ciascun partecipante:
${pgsDataText}

${entsDataText}

REGOLE MANDATARIE DI CONVERSAZIONE, INDIPENDENZA E FORMATTAZIONE:
1. INDIPENDENZA ASSOLUTA DELLE VOCI E DEI DIALETTI (DIVIETO CATEGORICO DI CONTAMINAZIONE):
   - Ciascun personaggio ha un suo stile, dialetto ed accento unico definito nella propria scheda (es. se un personaggio parla toscano, usa SOLO il toscano; se un altro parla romano, usa SOLO il romano; se un altro ha cadenza straniera/polacca, usa SOLO quella; se un altro è formale, usa quel tono).
   - È SEVERAMENTE E CATEGORICAMENTE VIETATO contaminare i personaggi tra loro o far parlare tutti con lo stesso accento o intercalare! Ogni battuta deve rispecchiare ESCLUSIVAMENTE la voce del soggetto che sta parlando.
2. SEGREGAZIONE RIGOROSA DELLE CONOSCENZE (NESSUNA OMNISCIENZA):
   - Ciascun personaggio conosce SOLO le nozioni del proprio ambito (Sotto-Codex) e i fatti a cui ha assistito personalmente. Non attribuire le conoscenze, i ricordi o i segreti di un personaggio a un altro!
3. DIALOGO IN CARATTERE & RAPPORTI RECIPROCI:
   - Ciascun personaggio deve reagire a quanto detto dagli altri tenendo conto della propria personalità, del proprio allineamento e dell'atteggiamento verso gli altri (ostile, alleato, timoroso, sarcastico, neutrale).
4. FORMATTO DIALOGO RECITATO (TASSATIVO): Scrivi ciascun intervento su una NUOVA RIGA SEPARATA. È assolutamente vietato scrivere più battute sulla stessa riga o di seguito. Ogni riga deve rispettare tassativamente questo preciso formato italiano:
   **NomeSoggetto**: *[azione o gesto espressivo]* "Testo della battuta..."
   **AltroSoggetto**: *[reazione fisica o tono]* "Testo della battuta..."
5. COESIONE E LUNGHEZZA (LOOP DINAMICO DEI GIRI): ${linesDirective} DEVI GENERARE TUTTI I GIRI RICHIESTI SENZA FERMARTI PRIMA! Non concludere prematuramente la discussione dopo un solo giro o dopo poche battute: scrivi l'intero dialogo completo riga per riga per tutti i giri ordinati. Mantieni le battute scattanti ed evita monologhi lunghi. È tassativo rispettare l'alternanza dei personaggi per simulare un vero dialogo teatrale interattivo a più riprese. Ciascun personaggio deve reagire a ciò che ha detto l'altro nel turno precedente, creando un filo logico coerente. Ogni riga deve contenere un singolo intervento di un personaggio.
6. AMBIENTAZIONE: Mantieni un tono coerente con un'ambientazione fantasy D&D.
7. NO INVENZIONI: Basati sulla storia comune documentata nelle cronache della campagna se parlano di eventi passati.
8. NESSUN NARRATORE: Non aggiungere spiegazioni esterne o riassunti neutri alla fine del dialogo. Lascia che la conversazione si concluda con l'ultima battuta di uno dei partecipanti.
9. ANCORAGGIO TEMPORALE E MEMORIA DEGLI EVENTI PASSATI (TASSATIVO):
   - Il PRESENTE ATTUALE della conversazione è la fine dell'ultima sessione registrata. I personaggi si trovano lì e adesso, e discutono della loro situazione attuale e delle prossime mosse.
   - Tutti gli eventi descritti nelle sessioni contrassegnate come "[PASSATO / MEMORIA STORICA CONCLUSA]" sono FATTI GIÀ AVVENUTI E CONCLUSI NEL PASSATO: i personaggi DEVONO parlarne rigorosamente usando tempi al passato (es. "Ti ricordi quando...", "Dopo quello che abbiamo passato a...", "Da quando abbiamo sconfitto...", "Meno male che a suo tempo...") e considerarli come ricordi, cicatrici o lezioni apprese. È CATEGORICAMENTE VIETATO recitare un evento del passato come se stesse accadendo in questo momento!
================================================================================`;
    } else if (codexEntity) {
      const speechStyle = codexEntity.aiConfig?.speechStyle || 'Parlata schietta e diretta nel ruolo del personaggio del compendio';
      const knowledgeScope = codexEntity.aiConfig?.knowledgeScope || codexEntity.progressNote || 'Fatti e conoscenze di questa entità registrati nel compendio';
      const secretsToProtect = codexEntity.aiConfig?.secretsToProtect || '';

      const rel = codexEntity.aiConfig?.partyRelations?.[currentUser._id] ||
        Object.values(codexEntity.aiConfig?.partyRelations || {}).find(
          (r) => r.characterName && currentUser.characterName && r.characterName.toLowerCase() === currentUser.characterName.toLowerCase()
        );

      const speakerName = currentUser.characterName || (currentUser.isDm ? 'Dungeon Master' : 'Giocatore');

      const attitudeLabels: Record<string, string> = {
        friendly: '😊 Amichevole / Alleato di fiducia',
        helpful: '🤝 Disponibile e cooperativo',
        neutral: '😐 Neutrale / Formale',
        suspicious: '🤨 Diffidente e sospettoso',
        hostile: '😡 Ostile e contrariato',
        fearful: '😨 Timoroso e intimorito',
        devoted: '👑 Devoto e leale',
      };

      const attitudeText = attitudeLabels[rel?.attitude || 'neutral'] || 'Neutrale / Formale';
      const relationType = rel?.relationType || 'Nessun legame formale registrato';
      const relationNotes = rel?.notes || '';
      const currentStatus = codexEntity.aiConfig?.currentStatus || '';

      const entityRelationsSummary = codexEntity.aiConfig?.entityRelations
        ? Object.values(codexEntity.aiConfig.entityRelations)
            .map((er) => {
              const prog = (er.progression && er.progression.length > 0)
                ? ` [Svolte storiche: ${er.progression.map((p) => `${p.sessionNumber ? `Sess.${p.sessionNumber}` : (p.loreDate || 'Data')}: "${p.event}" (${attitudeLabels[p.attitude] || p.attitude})`).join('; ')}]`
                : '';
              return `- Verso [${(er.targetEntityType || 'codex').toUpperCase()}: ${er.targetEntityName || 'Entità'}]: Legame "${er.relationType || 'Connessione'}" (${attitudeLabels[er.attitude || 'neutral'] || 'Neutrale'})${er.notes ? `. Note: ${er.notes}` : ''}${prog}`;
            })
            .join('\n')
        : '';

      const progressionPrompt = (rel?.progression && rel.progression.length > 0)
        ? rel.progression.map((p) => `  * [${p.loreDate ? `Data Lore: ${p.loreDate} | ` : ''}${p.sessionNumber ? `Sess. ${p.sessionNumber}` : p.sessionTitle || 'Sessione'}]: Atteggiamento divenne "${attitudeLabels[p.attitude] || p.attitude}" -> Svolta/Fatto: "${p.event}"`).join('\n')
        : '';

      const npcMemoriesPrompt = (codexEntity.aiConfig?.timelineMemories || [])
        .map((m) => `  * [${m.loreDate || 'Data Lore'}] ${m.title}: ${m.summary}`)
        .join('\n');

      const npcBeliefsPrompt = (codexEntity.aiConfig?.evolvingBeliefs || [])
        .map((b) => `  * [${b.subject}]: ${b.currentTruth} (Stato: ${b.status})`)
        .join('\n');

      effectivePersonaPrompt = `================================================================================
IDENTITÀ E RECITAZIONE ATTIVA DI ${codexEntity.name.toUpperCase()} (${codexEntity.type.toUpperCase()}):
- SEI COMPLETAMENTE E SINCERAMENTE: ${codexEntity.name}.
- PARLA E RISPONDI AL 100% IN PRIMA PERSONA, RECITANDO NEL TUO RUOLO!
- STILE DI PARLATA E PERSONALITÀ: ${speechStyle}
- STATO DI VITA CORRENTE: ${codexEntity.status.toUpperCase()}

${codexEntity.status === 'dead' ? `================================================================================
>>> ATTENZIONE CRITICA: SEI DECEDUTO / MORTO NELLA CAMPAGNA (Stato: DEAD) <<<
- Tu (come personaggio) sei storicamente deceduto nella campagna. 
- Di conseguenza, stai parlando come un'anima dall'oltretomba, uno spirito incorporeo, un fantasma, oppure come un'eco cosciente e malinconica del tuo passato impressa nel Prismalink delle cronache.
- Riconosci pienamente la tua morte se l'interlocutore vi fa riferimento. Non comportarti come se fossi ancora vivo a combattere fisicamente o a pianificare azioni nel mondo dei vivi! Sei un'ombra o un ricordo cosciente dell'oltretomba.
================================================================================` : ''}

${currentStatus ? `================================================================================
>>> PRIORITÀ ASSOLUTA: IL TUO STATO ATTUALE NEL PRESENTE DELLA CAMPAGNA <<<
"${currentStatus}"
QUESTA È LA TUA VITA E LA TUA CONDIZIONE IN QUESTO ESATTO MOMENTO!
- Quando ti salutano ("ciao", "come va?", "dove sei?", "cosa fai?"), la tua apertura DEVE riflettere IMMEDIATAMENTE questa condizione presente (ad es. se sei ferito, stanco, in viaggio, sotto copertura, al lavoro o in allerta).
- È TASSATIVAMENTE VIETATO agire come se fossi in uno stato passato già concluso. Non tornare a situazioni precedenti se questo stato indica che la situazione si è evoluta.
================================================================================` : ''}

INTERLOCUTORE E RELAZIONE CON CHI TI PARLA:
- STAI PARLANDO CON: "${speakerName}".
- IL TUO ATTEGGIAMENTO ATTUALE VERSO ${speakerName}: ${attitudeText}.
- IL TUO LEGAME ATTUALE CON ${speakerName}: ${relationType}.
${relationNotes ? `- MEMORIE CONDIVISE E TRASCORSI CON ${speakerName}: "${relationNotes}"` : ''}
${progressionPrompt ? `================================================================================
CRONOLOGIA STORICA DELL'EVOLUZIONE DEL RAPPORTO CON ${speakerName.toUpperCase()}:
${progressionPrompt}
REGOLA TASSATIVA SULL'EVOLUZIONE DEI RAPPORTI:
- Il tuo comportamento, la tua apertura emotiva e la tua fiducia verso ${speakerName} DEVONO RISPECCHIARE RIGIDAMENTE l'evoluzione storica sopra registrata!
- Se la cronologia mostra che nel tempo (o nelle sessioni più recenti) c'è stato deterioramento, rottura di un patto, diffidenza o scontro, È ASSOLUTAMENTE VIETATO comportarsi come se il rapporto fosse ancora l'iniziale "amichevole" o accogliente.
- Mantieni la diffidenza, l'amarezza, la freddezza o il rancore maturato durante gli eventi della storia!` : ''}

${entityRelationsSummary ? `================================================================================
LE TUE OPINIONI E RELAZIONI VERSO IL MONDO E LE ALTRE FAZIONI:
${entityRelationsSummary}
- Se ti viene chiesto un parere su queste persone o fazioni, esprimi apertamente questo punto di vista con il tuo atteggiamento!
================================================================================` : ''}

${npcMemoriesPrompt ? `================================================================================
CRONOLOGIA DEI RICORDI ED EVENTI DI LORE VISSUTI DA TE:
${npcMemoriesPrompt}
================================================================================` : ''}

${npcBeliefsPrompt ? `================================================================================
LE TUE CREDENZE, TEORIE E COSE CHE HAI SCOPERTO:
${npcBeliefsPrompt}
================================================================================` : ''}

AMBITO DI CONOSCENZA E LIMITI:
- AMBITO DI CONOSCENZA (Sotto-Codex): ${knowledgeScope}
${secretsToProtect ? `- SEGRETI DA PROTEGGERE E LIMITI DI RIVELAZIONE: ${secretsToProtect}` : ''}

REGOLE TATTICHE MANDATARIE DI DIALOGO:
1. RECITAZIONE VIVA E SPONTANEA: Parla come una persona in carne e ossa nel mondo di D&D. Niente formule burocratiche o risposte da motore di ricerca.
2. NIENTE DUMPING DI SESSIONI O FONTI: VIETATO elencare liste di sessioni o file (es. "Willow è stata attiva in Sessione 1, 2, 3"). Cita fatti concreti vissuti, non numeri di schede.
3. DOMANDE QUOTIDIANE E SALUTI: Se ti chiedono "come stai?", agganciati subito al tuo stato attuale presente${currentStatus ? ` ("${currentStatus}")` : ''} e all'atteggiamento verso ${speakerName}.
4. RIGIDO RISPETTO DEL SOTTO-CODEX: Conosci solo ciò che riguarda la tua storia, il tuo territorio e i fatti a cui hai assistito. Se ti chiedono di eventi lontani o sconosciuti, ammetti sinceramente di non saperne nulla in personaggio.
5. AZIONI FISICHE: Includi brevi gesti o reazioni corporee tra asterischi (*sospira sollevando lo sguardo*, *incrocia le braccia cauto*, *sorride divertito*).
7. RISOLUZIONI DI MISSIONI & BONIFICHE DEL PARTY: Se il party nelle sessioni ha bonificato l'orto, liberato un campo, purificato la terra o sconfitto una creatura legata a te, QUEL PROBLEMA È RISOLTO E DEBELLATO. NON dire MAI che il problema è ricomparso o che le radici/mostri sono ancora lì, a meno che non sia esplicitamente scritto nei registri! Riconosci invece il lavoro del party parlando di come la terra sta rifiorendo, di cosa stai coltivando o mostrando gratitudine per la bonifica compiuta.
8. DIVIETO ASSOLUTO DI PARENTESI O CITAZIONI NEL DISCORSO: Non inserire MAI nel tuo discorso parlato citazioni formali tra parentesi quadre come [Sessione 18], [Nota: ...], [Luogo] o [Personaggio: ...]. Sei una persona reale che parla a voce, non un indice! Parla sempre in modo fluido e narrativo senza mai inserire parentesi quadre nel testo.
9. VOCE E DIALETTO INVARIABILI CON OGNI LUNGHEZZA: Anche quando rispondi con 1 o 2 frasi concise o brevi, DEVI MANTENERE AL 100% il tuo accento, dialetto (es. toscano, intercalari, parlata rustica), gergo e tono unico. Non neutralizzare MAI la tua voce: esprimi la brevità parlando sempre nel tuo personaggio vivo e verace!`;
    }

    // Generous context token budget
    const maxContextTokens = provider === 'openrouter' ? 32000 : 64000;

    // 1. Build filtered context using smart semantic scoring, graph relational expansion, and character visibility
    const effectiveCodexEntity = isMultiSubject ? undefined : codexEntity;
    const { contextText, sourcesAvailable, otherPartyNames } = this.buildContext(
      currentUser,
      question,
      maxContextTokens,
      effectiveCodexEntity,
      isMultiSubject ? chosenEntities : undefined,
      isMultiSubject ? chosenPlayers : undefined
    );

    const activeEffortPreset = EFFORT_PRESETS[effortLevel] || EFFORT_PRESETS.balanced;

    // 2. Build system prompt with relational directives, persona prompt, effort preset and privacy
    const systemInstruction = this.buildSystemPrompt(currentUser, contextText, otherPartyNames, effectivePersonaPrompt, effortLevel, isMultiSubject);

    // 3. Format messages history (last 6 valid turns for context continuity, filtering empty contents)
    const validHistory = history
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-6);

    const messages = [
      ...validHistory.map((m) => ({
        role: m.role,
        content: m.content.trim(),
      })),
      { role: 'user' as const, content: question.trim() },
    ];

async function executeDirectInBrowser(
  provider: 'gemini' | 'openrouter' | 'cloudflare',
  model: string,
  systemInstruction: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  apiKeys: ReturnType<typeof ApiKeyManager.getKeys>
) {
  if (provider === 'gemini') {
    const key = apiKeys.geminiKey?.trim();
    if (!key) {
      throw new OracleError({
        error: 'Chiave API Google Gemini non configurata nelle Impostazioni.',
        errorTitle: 'Chiave API Mancante',
        errorType: 'auth',
        suggestedAction: 'Apri le Impostazioni e inserisci una chiave API Gemini da aistudio.google.com/apikey.',
        canRetry: false,
        provider: 'gemini',
      });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });

    const formattedContents = messages
      .filter((m) => String(m.content || '').trim().length > 0)
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.content || '').trim() }],
      }));

    const reqModel = model || 'gemini-flash-latest';
    try {
      const res = await ai.models.generateContent({
        model: reqModel,
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.6,
          maxOutputTokens: maxTokens,
        },
      });
      if (res && (res.text !== undefined || res.candidates?.[0])) {
        return {
          answer: res.text || '',
          thought: undefined,
          modelUsed: `Google Gemini (${reqModel})`,
          engine: 'gemini' as const,
        };
      }
      throw new Error(`Nessun testo generato dal modello ${reqModel}.`);
    } catch (err: any) {
      const msg = String(err?.message || err);
      const lowerMsg = msg.toLowerCase();

      if (lowerMsg.includes('api_key_invalid') || lowerMsg.includes('401') || lowerMsg.includes('key not valid')) {
        throw new OracleError({
          error: 'La chiave API Google Gemini inserita non è valida o è stata revocata.',
          errorTitle: 'Chiave Non Valida',
          errorType: 'auth',
          suggestedAction: 'Verifica e aggiorna la tua chiave API nelle Impostazioni.',
          canRetry: false,
          provider: 'gemini',
          model: reqModel,
        });
      }

      if (lowerMsg.includes('429') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('quota')) {
        const delayMatch = msg.match(/retry in ([\d.]+)s/i);
        const secs = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 20;
        throw new OracleError({
          error: `Limite di frequenza o quota gratuita superato per il modello "${reqModel}" (Google Gemini Free Tier). Attendi circa ${secs} secondi oppure seleziona un altro modello nel selettore.`,
          errorTitle: 'Quota temporaneamente esaurita (HTTP 429)',
          errorType: 'quota',
          suggestedAction: `Attendi circa ${secs}s prima di inviare un nuovo messaggio oppure cambia modello.`,
          canRetry: true,
          provider: 'gemini',
          model: reqModel,
        });
      }

      if (lowerMsg.includes('503') || lowerMsg.includes('overloaded') || lowerMsg.includes('unavailable')) {
        throw new OracleError({
          error: `I server Google Gemini per il modello "${reqModel}" sono temporaneamente sovraccarichi (503).`,
          errorTitle: 'Servizio Temporaneamente Sovraccarico',
          errorType: 'generic',
          suggestedAction: 'Riprova tra qualche istante o seleziona un altro modello.',
          canRetry: true,
          provider: 'gemini',
          model: reqModel,
        });
      }

      throw new OracleError({
        error: msg,
        errorTitle: `Errore Modello ${reqModel}`,
        errorType: 'generic',
        suggestedAction: 'Riprova o seleziona un modello differente.',
        canRetry: true,
        provider: 'gemini',
        model: reqModel,
      });
    }
  }

  if (provider === 'openrouter') {
    const key = apiKeys.openrouterKey?.trim();
    if (!key) {
      throw new OracleError({
        error: 'Chiave API OpenRouter non configurata nelle Impostazioni.',
        errorTitle: 'Chiave API Mancante',
        errorType: 'auth',
        suggestedAction: 'Inserisci una chiave API OpenRouter nelle Impostazioni.',
        canRetry: false,
        provider: 'openrouter',
      });
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'openrouter/free',
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages,
        ],
        temperature: 0.6,
        max_tokens: maxTokens,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new OracleError({
        error: data?.error?.message || `Errore OpenRouter (${res.status})`,
        errorTitle: 'Errore OpenRouter Direct',
        errorType: 'generic',
        suggestedAction: 'Riprova o seleziona un altro modello dal catalogo.',
        canRetry: true,
        provider: 'openrouter',
        model,
      });
    }

    const answer = data.choices?.[0]?.message?.content || '';
    return {
      answer,
      thought: undefined,
      modelUsed: `OpenRouter (${model})`,
      engine: 'openrouter' as const,
    };
  }

  if (provider === 'cloudflare') {
    const accountId = apiKeys.cloudflareAccountId?.trim();
    const token = apiKeys.cloudflareApiToken?.trim();

    if (!accountId || !token) {
      throw new OracleError({
        error: 'Credenziali Cloudflare Workers AI non configurate nelle Impostazioni.',
        errorTitle: 'Credenziali Mancanti',
        errorType: 'auth',
        suggestedAction: 'Inserisci Account ID e API Token Cloudflare nelle Impostazioni.',
        canRetry: false,
        provider: 'cloudflare',
      });
    }

    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || '@cf/meta/llama-3.3-70b-instruct-fp8',
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages,
        ],
        max_tokens: maxTokens,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new OracleError({
        error: data?.errors?.[0]?.message || `Errore Cloudflare AI (${res.status})`,
        errorTitle: 'Errore Cloudflare Direct',
        errorType: 'generic',
        suggestedAction: 'Verifica le credenziali Cloudflare o riprova.',
        canRetry: true,
        provider: 'cloudflare',
        model,
      });
    }

    const answer = data.choices?.[0]?.message?.content || data.result?.response || '';
    return {
      answer,
      thought: undefined,
      modelUsed: `Cloudflare AI (${model})`,
      engine: 'cloudflare' as const,
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
}

    // 4. API keys from ApiKeyManager (guaranteed decrypted)
    const apiKeys = await ApiKeyManager.getDecryptedKeys();
    const effectiveMaxTokens = isMultiSubject
      ? Math.max(activeEffortPreset.maxTokens, effortLevel === 'brief' ? 1000 : effortLevel === 'balanced' ? 2200 : 4000)
      : activeEffortPreset.maxTokens;

    let data: any = {};

    try {
      const response = await fetch('/api/ai/oracle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortSignal,
        body: JSON.stringify({
          provider,
          model,
          systemInstruction,
          messages,
          maxTokens: effectiveMaxTokens,
          geminiApiKey: apiKeys.geminiKey,
          openrouterApiKey: apiKeys.openrouterKey,
          cloudflareAccountId: apiKeys.cloudflareAccountId,
          cloudflareApiToken: apiKeys.cloudflareApiToken,
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || resData.error) {
        if (resData && typeof resData.error === 'string') {
          throw new OracleError({
            error: resData.error,
            errorTitle: resData.errorTitle || `Errore Modello ${model || provider}`,
            errorType: resData.errorType || 'generic',
            suggestedAction: resData.suggestedAction || 'Seleziona un altro modello dal selettore o riprova tra qualche secondo.',
            canRetry: resData.canRetry !== false,
            provider: resData.provider || provider,
            model: resData.model || model,
          });
        }
        throw new Error(resData?.error || `Errore dal server IA (HTTP ${response.status})`);
      }

      data = resData;
    } catch (netErr: any) {
      if (netErr?.name === 'AbortError' || abortSignal?.aborted) {
        throw new OracleError({
          error: 'Richiesta interrotta dall\'utente.',
          errorTitle: 'Generazione Interrotta',
          errorType: 'generic',
          suggestedAction: 'Puoi formulare un nuovo quesito quando desideri.',
          canRetry: true,
          provider,
          model,
        });
      }

      try {
        data = await executeDirectInBrowser(provider, model, systemInstruction, messages, effectiveMaxTokens, apiKeys);
      } catch (directErr: any) {
        if (directErr instanceof OracleError) throw directErr;
        throw new OracleError({
          error: directErr?.message || 'Impossibile connettersi al servizio AI.',
          errorTitle: 'Errore di Connessione',
          errorType: 'generic',
          suggestedAction: 'Verifica la tua connessione internet o la tua chiave API nelle Impostazioni.',
          canRetry: true,
          provider,
          model,
        });
      }
    }

    let rawAnswer = data.answer || '';
    let thought = data.thought || '';
    const thoughtMatch = rawAnswer.match(/<(?:riflessione|thought|pensiero)>([\s\S]*?)<\/(?:riflessione|thought|pensiero)>/i);
    if (thoughtMatch) {
      if (!thought) thought = thoughtMatch[1].trim();
      rawAnswer = rawAnswer.replace(/<(?:riflessione|thought|pensiero)>[\s\S]*?<\/(?:riflessione|thought|pensiero)>/gi, '').trim();
    }

    const sanitizedAns = sanitizeAnswer(rawAnswer, !!codexEntity);

    if (provider === 'cloudflare' || (data && data.engine === 'cloudflare')) {
      try {
        CloudflareUsageTracker.logRequest(model, question, sanitizedAns);
      } catch (cfLogErr) {
        console.warn('Failed to log Cloudflare usage:', cfLogErr);
      }
    }

    return {
      answer: sanitizedAns,
      thought: thought || undefined,
      sources: sourcesAvailable,
      modelUsed: data.modelUsed || (
        provider === 'openrouter'
          ? `OpenRouter (${model})`
          : provider === 'cloudflare'
          ? `Cloudflare AI (${model})`
          : `Google Gemini (${model})`
      ),
      engine: (data.engine as 'gemini' | 'openrouter' | 'cloudflare') || provider,
    };
  }
}
