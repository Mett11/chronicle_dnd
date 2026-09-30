import { GoogleGenAI } from '@google/genai';
import {
  WorldLoreArticle,
  WorldLoreBite,
  WorldLoreCategory,
  LoreBiteLevel,
  Player,
  Entity,
} from '../types';
import { ApiKeyManager } from './apiKeyManager';
import { CampaignManager } from '../store/campaignStore';

export interface DecomposeLoreRequest {
  rawText: string;
  partyMembers?: Player[];
  entities?: Entity[];
  titleHint?: string;
  categoryHint?: string;
  provider?: 'gemini' | 'openrouter' | 'cloudflare';
  model?: string;
  customApiKey?: string;
}

export interface DecomposedBiteSuggestion {
  id: string;
  title: string;
  content: string;
  level: LoreBiteLevel;
  category?: WorldLoreCategory;
  customTag?: string;
  suggestAllParty: boolean;
  suggestedAssigneeIds: string[];
  linkedEntityIds?: string[];
  assignmentReason?: string;
}

export interface DecomposeLoreResponse {
  success: boolean;
  article: {
    title: string;
    subtitle?: string;
    category: WorldLoreCategory;
    summary?: string;
    fullContentMarkdown: string;
    tags?: string[];
    relatedEntityIds?: string[];
  };
  bites: DecomposedBiteSuggestion[];
  modelUsed?: string;
  providerUsed?: string;
  error?: string;
}

/**
 * Sanitizes unescaped control characters inside string literals before JSON parsing
 */
function sanitizeControlCharsInJson(jsonStr: string): string {
  let inString = false;
  let result = '';
  let escape = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escape) {
      escape = false;
      result += char;
      continue;
    }
    if (char === '\\') {
      escape = true;
      result += char;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        result += '\\r';
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }
    result += char;
  }
  return result;
}

/**
 * Sanitizes model identifier to avoid deprecated models
 */
function cleanGeminiModelId(model?: string): string {
  if (!model) return 'gemini-2.5-flash';
  const clean = model.trim();
  if (
    clean.includes('gemini-1.5') ||
    clean.includes('gemini-2.0') ||
    clean === 'gemini-pro' ||
    clean === 'gemini-flash'
  ) {
    return 'gemini-2.5-flash';
  }
  return clean;
}

/**
 * Resilient JSON parser and auto-repairer for LLM responses
 */
function parseAndRepairJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.trim();

  // 1. Strip Markdown Codeblocks anywhere in string
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    cleaned = markdownMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // 2. Direct Parse Attempt
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') return normalizeParsedPayload(direct);
  } catch {}

  // 2b. Parse Attempt with sanitized control chars
  try {
    const sanitized = sanitizeControlCharsInJson(cleaned);
    const parsed = JSON.parse(sanitized);
    if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
  } catch {}

  // 3. Extract JSON object substring { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}

    try {
      const sanitized = sanitizeControlCharsInJson(candidate);
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}

    // Try fixing trailing commas
    const fixedCommas = candidate.replace(/,\s*([\]}])/g, '$1');
    try {
      const parsed = JSON.parse(fixedCommas);
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}

    try {
      const sanitizedCommas = sanitizeControlCharsInJson(fixedCommas);
      const parsed = JSON.parse(sanitizedCommas);
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}
  }

  // 4. Auto-close truncated JSON if stream was interrupted
  if (firstBrace !== -1) {
    let truncated = cleaned.slice(firstBrace);
    // Remove unfinished trailing property / incomplete line
    truncated = truncated.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
    
    // Count open brackets
    let openCurly = 0;
    let openSquare = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < truncated.length; i++) {
      const char = truncated[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openCurly++;
        else if (char === '}') openCurly--;
        else if (char === '[') openSquare++;
        else if (char === ']') openSquare--;
      }
    }

    if (inString) truncated += '"';
    while (openSquare > 0) {
      truncated += ']';
      openSquare--;
    }
    while (openCurly > 0) {
      truncated += '}';
      openCurly--;
    }

    try {
      const parsed = JSON.parse(truncated.replace(/,\s*([\]}])/g, '$1'));
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}

    try {
      const sanitizedTrunc = sanitizeControlCharsInJson(truncated.replace(/,\s*([\]}])/g, '$1'));
      const parsed = JSON.parse(sanitizedTrunc);
      if (parsed && typeof parsed === 'object') return normalizeParsedPayload(parsed);
    } catch {}
  }

  return null;
}

/**
 * Normalizes different naming variations that LLMs might return
 */
function normalizeParsedPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return null;

  const title = payload.title || payload.titolo || payload.name || 'Nuovo Trattato di World Lore';
  const subtitle = payload.subtitle || payload.sottotitolo || '';
  const category = payload.category || payload.categoria || 'general';
  const summary = payload.summary || payload.riassunto || payload.sommario || '';
  const fullContentMarkdown = payload.fullContentMarkdown || payload.content || payload.testo || payload.markdown || '';
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const relatedEntityIds = Array.isArray(payload.relatedEntityIds) ? payload.relatedEntityIds : [];

  let rawBites = payload.bites || payload.nozioni || payload.knowledge || payload.elements || payload.points || [];
  if (!Array.isArray(rawBites)) {
    rawBites = [];
  }

  const bites = rawBites.map((b: any, idx: number) => {
    if (typeof b === 'string') {
      return {
        id: `bite_${Date.now()}_${idx + 1}`,
        title: `Nozione ${idx + 1}`,
        content: b,
        level: 'public',
        category,
        suggestAllParty: true,
        suggestedAssigneeIds: [],
        assignmentReason: 'Sapere diffuso',
      };
    }
    return {
      id: b.id || `bite_${Date.now()}_${idx + 1}`,
      title: b.title || b.titolo || `Nozione ${idx + 1}`,
      content: b.content || b.descrizione || b.testo || '',
      level: b.level || b.livello || 'public',
      category: b.category || b.categoria || category,
      customTag: b.customTag || b.tag || undefined,
      suggestAllParty: Boolean(b.suggestAllParty !== undefined ? b.suggestAllParty : b.level === 'public'),
      suggestedAssigneeIds: Array.isArray(b.suggestedAssigneeIds) ? b.suggestedAssigneeIds : [],
      linkedEntityIds: Array.isArray(b.linkedEntityIds) ? b.linkedEntityIds : [],
      assignmentReason: b.assignmentReason || b.motivo || '',
    };
  });

  return {
    title,
    subtitle,
    category,
    summary,
    fullContentMarkdown,
    tags,
    relatedEntityIds,
    bites,
  };
}

export class WorldLoreService {
  /**
   * Builds the comprehensive contrastive prompt for precise D&D World Lore decomposition
   */
  public static buildDecomposePrompt(req: DecomposeLoreRequest): { systemInstruction: string; userPrompt: string } {
    const partySummary = (req.partyMembers || [])
      .map((p) => {
        const bio = (typeof CampaignManager !== 'undefined' ? CampaignManager.getCharacterBio(p._id) : null) || (p as any).bio || {};
        return `- ID: "${p._id}", Nome: "${p.characterName || (p as any).username || 'Avventuriero'}", Classe: "${bio.characterClass || (p as any).characterClass || 'Avventuriero'}", Razza: "${bio.characterRace || (p as any).characterRace || 'Umano'}", Deità/Patrono: "${bio.deityOrPatron || 'N/D'}", Città Natale/Origine: "${bio.hometown || 'N/D'}", Background/Storia: "${(bio.backstoryMarkdown || '').slice(0, 300)}"`;
      })
      .join('\n');

    const entitiesSummary = (req.entities || [])
      .slice(0, 35)
      .map((e) => `- ID: "${e._id}", Nome: "${e.name}", Tipo: "${e.type.toUpperCase()}", Ruolo/Info: "${(e.progressNote || '').slice(0, 180)}"`)
      .join('\n');

    const systemInstruction = `Sei il Sommo Archivista Cosmologico, Teologo e Maestro delle Tradizioni di D&D.
Il tuo compito è analizzare un documento o estratto di World Lore (principi cosmici, divinità, leggi magiche, usanze, storia antica, fazioni) fornito dal Master o dai giocatori e trasformarlo in un articolo enciclopedico strutturato con NOZIONI GRANULARI (Lore Bites) categorizzate in modo inequivocabile e assegnate con precisione logica ai membri del party o entità del compendio.

GUIDA RIGIDA DI DEMARCAZIONE DELLE 8 CATEGORIE:
1. "pantheon": Esclusivamente divinità, pantheon, culti divini, dogmi sacri, liturgie, gerarchie religiose e ordini sacerdotali votati a un dio.
2. "cosmology": Esclusivamente piani di esistenza (Piano Astrale, Etereo, Piani Elementali, Piani Esterni), creazione del multiverso, sfere celesti e cosmogonia primordiale.
3. "magic_laws": Esclusivamente le REGOLE e LEGGI di funzionamento della magia (la Trama, scuole d'arcano, limiti all'incantamento, maledizioni universali, flussi di mana, regole sui rituali). NOTA: se narra una guerra passata è "ancient_history"; se spiega come opera la magia oggi è "magic_laws".
4. "ancient_history": Esclusivamente ere passate, imperi caduti, cataclismi antichi, guerre storiche concluse e cronache mitologiche del passato.
5. "customs_cultures": Esclusivamente tradizioni dei popoli, usanze popolari, lingue, tabù sociali, feste stagionali, galateo e folklore vivente.
6. "factions_orders": Esclusivamente gilde commerciali, ordini cavallereschi laici, confraternite militari e società segrete.
7. "geography_nature": Esclusivamente regioni geografiche mistiche, climi soprannaturali, terre selvagge, anomalie ambientali e geomorfologia sacra.
8. "general": Principi fondamentali universali o primer introduttivo che racchiude concetti generali del mondo.

LIVELLI DI PROFONDITÀ DELLE NOZIONI:
- "public": Sapere Popolare / Comune. Notizia o dogma noto a chiunque viva nel mondo (es. nome delle divinità principali, festività pubbliche).
- "specialized": Conoscenza Iniziatica o Accademica. Riservata a chierici/paladini del culto specifico, maghi per regole della Trama, studiosi o PG con background mirato.
- "esoteric": Sapere Arcano / Mito Dimenticato. Verità accessibile solo tramite tomi rari, maestri eremiti o indagini storiche profonde.
- "secret": Verità Proibita / Segreto Cosmico. Mistero sconvolgente, cospirazione celata o verità protetta dal Master.

FORMATO DI RISPOSTA RICHIESTO (STRETTAMENTE JSON, NESSUN TESTO FUORI DAL JSON):
{
  "title": "Titolo chiaro ed evocativo dell'articolo",
  "subtitle": "Sottotitolo descrittivo sintetico",
  "category": "pantheon" | "cosmology" | "magic_laws" | "ancient_history" | "customs_cultures" | "factions_orders" | "geography_nature" | "general",
  "summary": "Riassunto chiaro in 2-4 frasi della voce di lore",
  "fullContentMarkdown": "Trattato completo ed elegante formattato in Markdown con paragrafi ordinati",
  "tags": ["tag1", "tag2"],
  "relatedEntityIds": ["id_entita_codex_collegata"],
  "bites": [
    {
      "id": "bite_1",
      "title": "Titolo conciso della singola nozione",
      "content": "Spiegazione esaustiva della nozione (1-3 frasi chiare e prive di ambiguità)",
      "level": "public" | "specialized" | "esoteric" | "secret",
      "category": "pantheon" | "cosmology" | "magic_laws" | "ancient_history" | "customs_cultures" | "factions_orders" | "geography_nature" | "general",
      "customTag": "Dogma Sacerdotale" | "Legge Arcana" | "Tradizione Popolare" | "Mito Antico" | "Segreto Iniziatico" | null,
      "suggestAllParty": true se level è 'public', altrimenti false,
      "suggestedAssigneeIds": ["id_pg_o_npc_che_dovrebbe_saperlo"],
      "linkedEntityIds": ["id_entita_codex_citata"],
      "assignmentReason": "Motivo esplicito per cui questo PG/PNG possiede questa nozione (es. 'Chierico devoto alla divinità', 'Mago con competenza Arcana', 'Origine elfica')"
    }
  ]
}

REGOLE CRITICHE:
1. Scomponi il testo in 3-8 nozioni discrete e significative.
2. Ogni singola nozione (bite) DEVE avere il proprio campo "category" coerente con la regola di demarcazione.
3. Assegna le nozioni 'public' a tutto il party (suggestAllParty: true).
4. Assegna nozioni 'specialized' o 'esoteric' specificando chiaramente l'assignmentReason riferito al background o alla classe del PG.
5. Rispondi ESCLUSIVAMENTE con il JSON valido.`;

    const userPrompt = `ANALIZZA IL SEGUENTE DOCUMENTO DI WORLD LORE:

${req.titleHint ? `TITOLO SUGGERITO DAL MASTER: "${req.titleHint}"` : ''}
${req.categoryHint ? `CATEGORIA PRINCIPALE SUGGERITA: "${req.categoryHint}"` : ''}

MEMBRI DEL PARTY ATTUALI:
${partySummary || 'Nessun PG fornito.'}

ENTITÀ DEL COMPENDIO ATTUALI:
${entitiesSummary || 'Nessuna entità fornita.'}

TESTO DEL DOCUMENTO DA SCOMPORRE:
${req.rawText.slice(0, 25000)}
`;

    return { systemInstruction, userPrompt };
  }

  /**
   * Decomposes a World Lore document using Direct Multi-Provider Execution (Gemini SDK, OpenRouter, Cloudflare Workers AI)
   * with crystal-clear error reporting and no silent fallback masking.
   */
  static async decomposeLoreDocument(req: DecomposeLoreRequest): Promise<DecomposeLoreResponse> {
    if (!req.rawText || !req.rawText.trim()) {
      throw new Error('Inserisci il testo o l\'estratto della lore da analizzare.');
    }

    const { systemInstruction, userPrompt } = this.buildDecomposePrompt(req);

    // Get active keys from ApiKeyManager (handles campaign vs personal keys seamlessly)
    const keys = await ApiKeyManager.getDecryptedKeys();
    const campKeys = await ApiKeyManager.preloadCampaignKeys();
    const persKeys = await ApiKeyManager.preloadPersonalKeys();

    // Determine target provider
    let targetProvider = req.provider;
    if (!targetProvider) {
      try {
        targetProvider = (localStorage.getItem('chronicle_lore_provider') as any) ||
          (localStorage.getItem('chronicle_oracle_provider') as any) ||
          (localStorage.getItem('chronicle_extraction_provider') as any) ||
          (keys.openrouterKey && !keys.geminiKey ? 'openrouter' : 'gemini');
      } catch {
        targetProvider = 'gemini';
      }
    }

    // Check if we have direct credentials available on the client
    const activeGeminiKey = (
      req.customApiKey ||
      keys.geminiKey ||
      campKeys.geminiKey ||
      persKeys.geminiKey ||
      (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY ? process.env.VITE_GEMINI_API_KEY : '') ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('chronicle_gemini_api_key') || '' : '')
    ).trim();

    const activeOpenRouterKey = (keys.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey || '').trim();
    const cfAccountId = (keys.cloudflareAccountId || campKeys.cloudflareAccountId || persKeys.cloudflareAccountId)?.trim();
    const cfToken = (keys.cloudflareApiToken || campKeys.cloudflareApiToken || persKeys.cloudflareApiToken)?.trim();
    const hasCloudflareKeys = Boolean(cfAccountId && cfToken);

    // -------------------------------------------------------------
    // 1. DIRECT CALL TO GOOGLE GEMINI SDK
    // -------------------------------------------------------------
    if (targetProvider === 'gemini') {
      if (!activeGeminiKey) {
        throw new Error('Chiave API Google Gemini non configurata nelle Impostazioni o nella Campagna.');
      }

      const selectedModel = cleanGeminiModelId(
        req.model ||
        localStorage.getItem('chronicle_lore_gemini_model') ||
        localStorage.getItem('chronicle_oracle_gemini_model') ||
        'gemini-2.5-flash'
      );

      try {
        const ai = new GoogleGenAI({ apiKey: activeGeminiKey });
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawText = response.text || '';
        const parsed = parseAndRepairJson(rawText);
        if (parsed && parsed.title) {
          return this.formatSuccessResponse(parsed, req.rawText, selectedModel, 'gemini');
        }

        throw new Error('Il modello Gemini ha risposto ma la struttura JSON estratta non è valida. Riprova con un estratto più breve o un modello differente.');
      } catch (geminiErr: any) {
        console.error('[World Lore Direct Gemini Error]:', geminiErr);
        const msg = String(geminiErr?.message || geminiErr);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Quota Gemini temporaneamente esaurita (429). Riprova tra pochi istanti o seleziona OpenRouter/Cloudflare.');
        }
        if (msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('invalid api key')) {
          throw new Error('La chiave API Gemini non è valida o non ha i permessi necessari. Verifica nelle Impostazioni.');
        }
        if (msg.includes('SAFETY') || msg.includes('BLOCKED')) {
          throw new Error('La risposta è stata bloccata dai filtri di sicurezza dell\'IA. Riformula o rimuovi termini estremi.');
        }
        throw new Error(`Errore durante l'analisi Gemini (${selectedModel}): ${msg}`);
      }
    }

    // -------------------------------------------------------------
    // 2. DIRECT CALL TO OPENROUTER
    // -------------------------------------------------------------
    if (targetProvider === 'openrouter') {
      if (!activeOpenRouterKey) {
        throw new Error('Chiave API OpenRouter non configurata nelle Impostazioni o nella Campagna.');
      }
      const selectedModel = req.model || localStorage.getItem('chronicle_lore_openrouter_model') || localStorage.getItem('chronicle_oracle_openrouter_model') || 'openrouter/free';

      if (ApiKeyManager.isOpenRouterPaidBlocked()) {
        const isFree = selectedModel.endsWith(':free') || selectedModel.includes(':free') || selectedModel === 'openrouter/free';
        if (!isFree) {
          throw new Error(`Il modello OpenRouter "${selectedModel}" è a pagamento ed è bloccato dalla salvaguardia crediti. Seleziona un modello gratuito (:free) nel catalogo.`);
        }
      }

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeOpenRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chronicle-dnd.app',
            'X-Title': 'Chronicle D&D',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\nRispondi RIGOROSAMENTE con il JSON valido senza blocchi markdown.` },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Errore OpenRouter (${res.status})`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const parsed = parseAndRepairJson(content);
        if (parsed && parsed.title) {
          return this.formatSuccessResponse(parsed, req.rawText, selectedModel, 'openrouter');
        }
        throw new Error('Risposta non valida ricevuta da OpenRouter. Riprova con un altro modello.');
      } catch (orErr: any) {
        throw new Error(orErr?.message || 'Errore durante la connessione a OpenRouter.');
      }
    }

    // -------------------------------------------------------------
    // 3. DIRECT CALL TO CLOUDFLARE WORKERS AI
    // -------------------------------------------------------------
    if (targetProvider === 'cloudflare') {
      if (!hasCloudflareKeys) {
        throw new Error('Credenziali Cloudflare Workers AI (Account ID e API Token) non configurate nelle Impostazioni.');
      }
      const selectedModel = req.model || localStorage.getItem('chronicle_lore_cloudflare_model') || localStorage.getItem('chronicle_oracle_cloudflare_model') || '@cf/meta/llama-3.3-70b-instruct-fp8';

      try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\nRispondi RIGOROSAMENTE con il JSON valido.` },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.errors?.[0]?.message || `Errore Cloudflare Workers AI (${res.status})`);
        }

        const data = await res.json();
        let answer = data?.choices?.[0]?.message?.content || data?.result?.response || '';
        if (typeof answer === 'object') answer = JSON.stringify(answer);
        const parsed = parseAndRepairJson(answer);
        if (parsed && parsed.title) {
          return this.formatSuccessResponse(parsed, req.rawText, selectedModel, 'cloudflare');
        }
        throw new Error('Risposta non valida ricevuta da Cloudflare Workers AI.');
      } catch (cfErr: any) {
        throw new Error(cfErr?.message || 'Errore durante la connessione a Cloudflare Workers AI.');
      }
    }

    // -------------------------------------------------------------
    // 4. FALLBACK: SERVER PROXY (ONLY IF NO DIRECT CLIENT KEYS EXIST)
    // -------------------------------------------------------------
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (keys.geminiKey) headers['x-custom-api-key'] = keys.geminiKey;
      if (keys.openrouterKey) headers['x-openrouter-key'] = keys.openrouterKey;

      const serverRes = await fetch('/api/world-lore/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rawText: req.rawText,
          partyMembers: req.partyMembers || [],
          entities: req.entities || [],
          titleHint: req.titleHint,
          categoryHint: req.categoryHint,
          provider: targetProvider,
          model: req.model,
          geminiApiKey: keys.geminiKey,
          openrouterApiKey: keys.openrouterKey,
          cloudflareAccountId: keys.cloudflareAccountId,
          cloudflareApiToken: keys.cloudflareApiToken,
        }),
      });

      if (serverRes.ok) {
        const data: DecomposeLoreResponse = await serverRes.json();
        return data;
      }

      if (serverRes.status === 405 || serverRes.status === 404) {
        throw new Error('Ambiente statico (Cloudflare Pages): inserisci la chiave API (Gemini, OpenRouter o Cloudflare) nelle Impostazioni per eseguire l\'analisi direttamente dal browser.');
      }
    } catch (serverErr: any) {
      if (serverErr?.message && serverErr.message.includes('Ambiente statico')) {
        throw serverErr;
      }
    }

    throw new Error('Impossibile completare la scomposizione AI. Configura le chiavi API nelle Impostazioni.');
  }

  private static formatSuccessResponse(
    parsed: any,
    rawText: string,
    modelUsed: string,
    providerUsed: string
  ): DecomposeLoreResponse {
    const validCategories: WorldLoreCategory[] = [
      'pantheon',
      'cosmology',
      'magic_laws',
      'ancient_history',
      'customs_cultures',
      'factions_orders',
      'geography_nature',
      'general',
    ];

    const articleCategory = validCategories.includes(parsed.category) ? parsed.category : 'general';

    return {
      success: true,
      article: {
        title: parsed.title || 'Nuovo Trattato di World Lore',
        subtitle: parsed.subtitle || '',
        category: articleCategory,
        summary: parsed.summary || '',
        fullContentMarkdown: parsed.fullContentMarkdown || rawText,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        relatedEntityIds: Array.isArray(parsed.relatedEntityIds) ? parsed.relatedEntityIds : [],
      },
      bites: (parsed.bites || []).map((b: any, idx: number) => ({
        id: `bite_${Date.now()}_${idx + 1}`,
        title: b.title || `Nozione ${idx + 1}`,
        content: b.content || '',
        level: ['public', 'specialized', 'esoteric', 'secret'].includes(b.level) ? b.level : 'public',
        category: validCategories.includes(b.category) ? b.category : articleCategory,
        customTag: b.customTag || undefined,
        suggestAllParty: Boolean(b.suggestAllParty !== undefined ? b.suggestAllParty : b.level === 'public'),
        suggestedAssigneeIds: Array.isArray(b.suggestedAssigneeIds) ? b.suggestedAssigneeIds : [],
        linkedEntityIds: Array.isArray(b.linkedEntityIds) ? b.linkedEntityIds : [],
        assignmentReason: b.assignmentReason || '',
      })),
      modelUsed,
      providerUsed,
    };
  }
}
