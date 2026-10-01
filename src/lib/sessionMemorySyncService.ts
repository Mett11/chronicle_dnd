import {
  Entity,
  Player,
  Session,
  SessionMemorySyncResult,
  EntityMemoryProposal,
  PlayerMemoryProposal,
  TimelineMemoryEntry,
  EvolvingBelief,
  InterPartyRelation,
  CharacterBio,
} from '../types';
import { ApiKeyManager } from './apiKeyManager';
import { CampaignManager } from '../store/campaignStore';

export interface SyncSessionMemoryOptions {
  session: Session;
  entities?: Entity[];
  players?: Player[];
  preferredProvider?: 'gemini' | 'cloudflare' | 'openrouter';
  preferredModel?: string;
  includeDmAsPlayer?: boolean;
  orphanTags?: string[];
  signal?: AbortSignal;
}

async function analyzeDirectInBrowser(
  payload: any,
  keys: ReturnType<typeof ApiKeyManager.getKeys>
): Promise<any> {
  const { session, entities, players, orphanTags, provider, model } = payload;

  const entitiesCatalog = (entities as any[])
    .map((e: any) => {
      const partyRelSummary = e.aiConfig?.partyRelations
        ? Object.values(e.aiConfig.partyRelations)
            .map(
              (r: any) => {
                const lastMilestone = r.progression?.length ? r.progression[r.progression.length - 1] : null;
                return `${r.characterName || 'PG'}: att=${r.attitude || 'neutral'}, legame="${r.relationType || ''}"${
                  lastMilestone ? ` (Ultima svolta [${lastMilestone.loreDate || 'Lore'}]: "${lastMilestone.event}")` : ''
                }`;
              }
            )
            .join(' | ')
        : 'nessuna';

      const entityRelSummary = e.aiConfig?.entityRelations
        ? Object.values(e.aiConfig.entityRelations)
            .map(
              (r: any) =>
                `${r.targetEntityName || 'Entità'}: legame="${r.relationType || ''}"`
            )
            .join(' | ')
        : 'nessuna';

      const beliefsSummary = Array.isArray(e.aiConfig?.evolvingBeliefs) && e.aiConfig.evolvingBeliefs.length > 0
        ? e.aiConfig.evolvingBeliefs.map((b: any) => `[${b.subject}]: ${b.currentTruth} (${b.status})`).join('; ')
        : 'nessuna registrata';

      const recentMemories = Array.isArray(e.aiConfig?.timelineMemories) && e.aiConfig.timelineMemories.length > 0
        ? e.aiConfig.timelineMemories.slice(-3).map((m: any) => `${m.loreDate || 'Data N/D'}: ${m.title}`).join(' | ')
        : 'nessuna';

      return `- [ID: ${e._id}] ${e.name} (${e.type.toUpperCase()})${
        e.aliases?.length ? ` [Alias: ${e.aliases.join(', ')}]` : ''
      }
  Stato Attuale: "${e.aiConfig?.currentStatus || e.status || 'attivo'}"
  Credenze / Teorie Note: ${beliefsSummary}
  Memorie Recenti: ${recentMemories}
  Relazioni con il Party: ${partyRelSummary}
  Relazioni Compendio: ${entityRelSummary}`;
    })
    .join('\n\n');

  const playersCatalog = (players as any[])
    .map((p: any) => {
      const bio: CharacterBio | null = p.bio || null;
      const beliefsSummary = Array.isArray(bio?.evolvingBeliefs) && bio.evolvingBeliefs.length > 0
        ? bio.evolvingBeliefs.map((b: any) => `[${b.subject}]: ${b.currentTruth} (${b.status})`).join('; ')
        : 'nessuna teoria registrata';

      const recentMemories = Array.isArray(bio?.timelineMemories) && bio.timelineMemories.length > 0
        ? bio.timelineMemories.slice(-3).map((m: any) => `${m.loreDate || 'Data N/D'}: ${m.title}`).join(' | ')
        : 'nessun ricordo recente';

      const interPartySummary = bio?.interPartyRelations
        ? Object.values(bio.interPartyRelations)
            .map((r: any) => `${r.targetCharacterName}: Fiducia ${r.trustLevel ?? 5}/10, Atteggiamento "${r.attitude || 'neutral'}", Legame "${r.relationType || "Compagno d'Armi"}"${r.notes ? ` ("${r.notes}")` : ''}`)
            .join(' | ')
        : 'fiducia di base 5/10 con tutti i compagni';

      return `- [ID: ${p._id}] ${p.characterName || 'Personaggio'}${p.isDm ? ' (DM)' : ''}${
        p.isRegistered === false ? ' (Membro Party / Compagno Non Registrato)' : ''
      }
  Stato Attuale PG: "${bio?.currentStatus || 'In viaggio col gruppo'}"
  Credenze & Sospetti PG: ${beliefsSummary}
  Ultimi Ricordi di Lore: ${recentMemories}
  Rapporti con i Compagni di Squadra (PG ↔ PG): ${interPartySummary}`;
    })
    .join('\n\n');

  const orphanCatalog = (orphanTags as string[])
    .map((tag: string) => `- ${tag} (UNREGISTERED/ORFANO)`)
    .join('\n');

  const sessionText = `
=== INFORMAZIONI TEMPORALI & SESSIONE ===
- Numero Sessione: ${session.number || 'N/D'}
- Titolo: ${session.title}
- Data di Lore (Calendario di Campagna): ${session.loreDate || 'N/D'}

=== RECAP NARRATIVO DELLA SESSIONE ===
${(session.recapText || '').slice(0, 16000)}

=== EVENTI SALIENTI REGISTRATI ===
${
  (session.events || [])
    .slice(0, 12)
    .map(
      (ev: any) =>
        `* ${ev.title}: ${(ev.description || '').slice(0, 300)} (Luogo: ${ev.location || 'N/D'}) [Personaggi: ${(ev.involvedCharacters || []).join(', ') || 'Party'}]`
    )
    .join('\n') || 'Nessun evento formale registrato.'
}
`;

  const systemInstruction = `Sei l'Archivista Arcano e Storico della Campagna di D&D.
Il tuo compito fondamentale è analizzare la cronaca della sessione conclusa e determinare in modo ACCURATO E TEMPORALMENTE COERENTE:
1. L'EVOLUZIONE DELLA MEMORIA VIVA E DEI RICORDI DEI PERSONAGGI GIOCANTI (PG) DEL PARTY.
2. L'EVOLUZIONE DELLE RELAZIONI INTER-PARTY (PG ↔ PG, fiducia tra compagni, legami, attriti o segreti scoperti).
3. L'EVOLUZIONE DELLE CREDENZE (Teorie passate verificate o smentite da nuove rivelazioni di Lore).
4. L'EVOLUZIONE DEI PNG E DELLE ENTITÀ DEL COMPENDIO (Memoria storica, relazioni, stato attuale).

DATA DI LORE DI RIFERIMENTO DELLA SESSIONE: "${session.loreDate || 'Data Attuale di Campagna'}"

ELENCO DEI MEMBRI DEL PARTY & AVVENTURIERI (PG):
${playersCatalog}

${
  orphanTags && orphanTags.length > 0
    ? `ELENCO DEI PERSONAGGI/SOGGETTI NON ANCORA REGISTRATI (MANCANTI/ORFANI):
${orphanCatalog}
`
    : ''
}

CATALOGO DELLE ENTITÀ DEL COMPENDIO REGISTRATE:
${entitiesCatalog}

REGOLE FONDAMENTALI DI ANALISI:
0. DIVIETO ASSOLUTO DI SOSTITUZIONE ARBITRARIA:
   - Non confondere PG diversi tra loro.
1. ANCORAGGIO ALLA DATA DI LORE:
   - Tutte le voci di memoria (timelineMemories) e rivelazioni di credenze (evolvingBeliefs) DEVONO fare riferimento alla Data di Lore della sessione ("${session.loreDate || 'Data della sessione'}").
2. MEMORIA, CREDENZE E RAPPORTI DEL PARTY (playerProposals):
   - Per ciascun membro del gruppo (PG):
     * timelineMemories: 1-2 ricordi significativi (svolte, traumi, scoperte, imprese, patti o segreti personali).
     * evolvingBeliefs: se il PG aveva una teoria o credenza su un PNG/luogo/oggetto e in questa sessione è stata confermata o smentita ('proven_fact', 'shattered_belief', 'active_theory', 'suspicion').
     * interPartyRelationUpdates: MANDATORIO! Devi valutare e aggiornare il rapporto e il livello di FIDUCIA (scala 1-10, atteggiamento, legame) nei confronti di TUTTI GLI ALTRI PG DEL PARTY (coppie PG A -> PG B, PG B -> PG A, ecc.).
       REGOLE MANDATORIE PER I RAPPORTI TRA COMPAGNI (PG ↔ PG):
       - NON LIMITARTI A UN SOLO PERSONAGGIO O AL DM! Genera un aggiornamento di relazione per OGNI coppia di PG presente nel party.
       - Ogni avventura, combattimento spalla a spalla, conversazione, strategia o scelta vissuta insieme fa EVOLVERE o RICONFERMARE il livello di fiducia (1-10) tra i compagni (es. collaborazione in combattimento +1 fiducia, disaccordo -1 fiducia, stima reciproca +1 fiducia).
       - Compila 'newTrust' (1-10), 'newAttitude', 'newRelationType', e spiega sempre la motivazione narratica in 'reason' e 'notes' basata sugli eventi di questa sessione.
     * suggestedCurrentStatus: stato o riflessione attuale del PG dopo questa sessione.
3. MEMORIA E RELAZIONI DELLE ENTITÀ / PNG (detectedEntities):
   - Per i PNG/entità comparsi o rilevanti nella sessione:
     * suggestedCurrentStatus: cosa fa o dove si trova ora il PNG nel presente della campagna.
     * timelineMemories: 1 ricordo saliente per il PNG ancorato alla Data di Lore.
     * evolvingBeliefs: credenze o scoperte del PNG.
     * partyRelationUpdates: relazione con ciascun PG interagente.
       REGOLE MANDATORIE DI EVOLUZIONE & ATTRITO DEI RAPPORTI:
       - NON MANTENERE PASSIVAMENTE L'ATTEGGIAMENTO PRECEDENTE! Se nella sessione ci sono stati contrasti, bugie svelate, disobbedienze, litigi, traumi, fallimenti, segreti occultati o motivi di allontanamento tra un PG (es. Kaelen) e questo PNG (es. Insegnante, Mentore, Alleato, Autorità), DEVI RETROCEDERE L'ATTEGGIAMENTO (es. da friendly a neutral, suspicious o hostile).
       - Compila SEMPRE 'milestoneEvent' spiegando il fatto narrativo esatto accaduto in questa sessione (es. "Forte delusione per aver manomesso il tomo proibito; fiducia revocata").
       - Se invece c'è stato un riavvicinamento, riconoscenza o patto d'alleanza, aumenta l'atteggiamento (es. a helpful, friendly o devoted) con relativo 'milestoneEvent'.
     * entityRelationUpdates: relazioni con altre fazioni o PNG (con eventuale 'milestoneEvent').
     * shouldAddSessionToMemory: true se il PNG era coinvolto.
     * suggestedNewKnowledge: nuovi fatti appresi.

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "playerProposals": [
    {
      "playerId": "string",
      "characterName": "string",
      "involvementType": "direct_participant" | "indirect_observer" | "mentioned",
      "reason": "string",
      "suggestedCurrentStatus": "string",
      "timelineMemories": [
        {
          "category": "discovery" | "belief_shift" | "relationship" | "milestone" | "trauma" | "secret" | "event",
          "title": "string",
          "summary": "string",
          "impact": "major" | "normal" | "secret",
          "loreDate": "${session.loreDate || ''}"
        }
      ],
      "evolvingBeliefs": [
        {
          "subject": "string",
          "previousBelief": "string",
          "currentTruth": "string",
          "status": "active_theory" | "proven_fact" | "shattered_belief" | "suspicion",
          "revealedLoreDate": "${session.loreDate || ''}",
          "notes": "string"
        }
      ],
      "interPartyRelationUpdates": [
        {
          "targetPlayerId": "string",
          "targetCharacterName": "string",
          "newAttitude": "friendly" | "helpful" | "neutral" | "suspicious" | "hostile" | "fearful" | "devoted",
          "newRelationType": "string",
          "newTrust": 7,
          "notes": "string",
          "reason": "string"
        }
      ]
    }
  ],
  "detectedEntities": [
    {
      "entityId": "string",
      "entityName": "string",
      "entityType": "npc" | "monster" | "place" | "item" | "faction" | "quest",
      "involvementType": "direct_participant" | "indirect_observer" | "mentioned",
      "reason": "string",
      "suggestedCurrentStatus": "string",
      "timelineMemories": [
        {
          "category": "event" | "discovery" | "belief_shift" | "relationship" | "milestone" | "trauma" | "secret",
          "title": "string",
          "summary": "string",
          "impact": "major" | "normal" | "secret",
          "loreDate": "${session.loreDate || ''}"
        }
      ],
      "evolvingBeliefs": [
        {
          "subject": "string",
          "previousBelief": "string",
          "currentTruth": "string",
          "status": "active_theory" | "proven_fact" | "shattered_belief" | "suspicion",
          "revealedLoreDate": "${session.loreDate || ''}"
        }
      ],
      "partyRelationUpdates": [
        {
          "playerId": "string",
          "characterName": "string",
          "newAttitude": "friendly" | "helpful" | "neutral" | "suspicious" | "hostile" | "fearful" | "devoted",
          "newRelationType": "string",
          "newNotes": "string",
          "milestoneEvent": "string (descrizione specifica della svolta accaduta in questa sessione)",
          "reason": "string"
        }
      ],
      "entityRelationUpdates": [
        {
          "targetEntityId": "string",
          "targetEntityName": "string",
          "targetEntityType": "npc" | "monster" | "place" | "item" | "faction" | "quest",
          "newAttitude": "friendly" | "helpful" | "neutral" | "suspicious" | "hostile" | "fearful" | "devoted",
          "newRelationType": "string",
          "newNotes": "string",
          "milestoneEvent": "string (svolta o patto tra entità)",
          "reason": "string"
        }
      ],
      "shouldAddSessionToMemory": true,
      "suggestedNewKnowledge": "string"
    }
  ]
}`;

  const parseJson = (text: string) => {
    if (!text) return null;
    let clean = text.trim().replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {}
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return null;
  };

  if (provider === 'gemini') {
    const key = keys.geminiKey?.trim();
    if (!key) {
      throw new Error('Chiave API Google Gemini non configurata nelle Impostazioni.');
    }
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });

    const reqModel = model || 'gemini-flash-latest';
    try {
      const res = await ai.models.generateContent({
        model: reqModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analizza questa sessione ed aggiorna la memoria viva cronologica di PG ed Entità:\n\n${sessionText}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      const parsed = parseJson(res.text || '');
      if (parsed) return parsed;
      throw new Error(`Risposta JSON non valida dal modello ${reqModel}.`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      const lowerMsg = msg.toLowerCase();

      if (
        lowerMsg.includes('429') ||
        lowerMsg.includes('resource_exhausted') ||
        lowerMsg.includes('quota')
      ) {
        const delayMatch = msg.match(/retry in ([\d.]+)s/i);
        const secs = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 20;
        throw new Error(
          `Limite di quota/frequenza superato per "${reqModel}" (Google Gemini Free Tier). Attendi ~${secs}s o seleziona un altro modello.`
        );
      }

      if (
        lowerMsg.includes('503') ||
        lowerMsg.includes('overloaded') ||
        lowerMsg.includes('unavailable')
      ) {
        throw new Error(
          `Il modello "${reqModel}" è momentaneamente sovraccarico (503). Riprova tra pochi istanti.`
        );
      }

      throw e;
    }
  }

  if (provider === 'openrouter') {
    const key = keys.openrouterKey?.trim();
    if (!key) {
      throw new Error('Chiave API OpenRouter non configurata nelle Impostazioni.');
    }
    const reqModel = model || 'openrouter/free';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: reqModel,
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: `Analizza questa sessione ed aggiorna la memoria viva cronologica di PG ed Entità:\n\n${sessionText}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const rawContent = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(rawContent);
    if (parsed) return parsed;
    throw new Error(data?.error?.message || 'Risposta da OpenRouter non valida.');
  }

  if (provider === 'cloudflare') {
    const accountId = keys.cloudflareAccountId?.trim();
    const token = keys.cloudflareApiToken?.trim();
    if (!accountId || !token) {
      throw new Error('Credenziali Cloudflare Workers AI non configurate nelle Impostazioni.');
    }
    const reqModel = model || '@cf/meta/llama-3.3-70b-instruct-fp8';
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: reqModel,
          messages: [
            { role: 'system', content: `${systemInstruction}\n\nRispondi SOLO in formato JSON.` },
            { role: 'user', content: sessionText },
          ],
          temperature: 0.1,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    let answer = data?.choices?.[0]?.message?.content || data?.result?.response || '';
    if (typeof answer === 'object') answer = JSON.stringify(answer);
    const parsed = parseJson(answer);
    if (parsed) return parsed;
    throw new Error(data?.errors?.[0]?.message || 'Risposta da Cloudflare Workers AI non valida.');
  }

  throw new Error(`Provider non supportato: ${provider}`);
}

export class SessionMemorySyncService {
  /**
   * Calls the AI engine to analyze a session chronicle and extract chronological memories,
   * beliefs, and relationships for both Party Players and Codex Entities.
   */
  static async analyzeSession(options: SyncSessionMemoryOptions): Promise<SessionMemorySyncResult> {
    const { session, preferredProvider, preferredModel } = options;
    const entities = options.entities || CampaignManager.getEntities();
    const players = options.players || CampaignManager.getPlayers();

    const keys = await ApiKeyManager.getDecryptedKeys();
    let savedProvider = 'gemini';
    let savedOpenRouterModel = 'openrouter/free';
    try {
      savedProvider =
        (localStorage.getItem('chronicle_oracle_provider') as any) ||
        (keys.openrouterKey && !keys.geminiKey ? 'openrouter' : 'gemini');
      savedOpenRouterModel =
        localStorage.getItem('chronicle_oracle_openrouter_model') || 'openrouter/free';
    } catch {}

    const provider = preferredProvider || savedProvider;
    const model = preferredModel || (provider === 'openrouter' ? savedOpenRouterModel : undefined);

    // Extract plain text from session recap and events recursively
    function extractTextFromContent(content: any): string {
      if (!content) return '';
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content.map(extractTextFromContent).filter(Boolean).join('\n');
      }
      if (typeof content === 'object') {
        if (typeof content.text === 'string') return content.text;
        if (Array.isArray(content.children)) {
          return content.children.map(extractTextFromContent).filter(Boolean).join('');
        }
      }
      return '';
    }

    let recapText = extractTextFromContent(session.recap);
    if (!recapText && session.events && session.events.length > 0) {
      recapText = session.events.map((e) => `${e.title}: ${e.description}`).join('\n\n');
    }

    // Pre-filtering: Gather explicit IDs from session and event links first
    const explicitlyLinkedIds = new Set<string>();
    (session.linkedEntityIds || []).forEach((id) => id && explicitlyLinkedIds.add(id));
    (session.events || []).forEach((ev) => {
      (ev.linkedEntityIds || []).forEach((id) => id && explicitlyLinkedIds.add(id));
    });

    const eventLocations = (session.events || [])
      .map((ev) => (ev.location || '').trim().toLowerCase())
      .filter((loc) => loc.length > 2);

    const fullSessionText = (
      (session.title || '') +
      ' ' +
      recapText +
      ' ' +
      (session.events || [])
        .map(
          (e) =>
            `${e.title} ${e.description} ${(e.involvedCharacters || []).join(' ')} ${
              e.location || ''
            }`
        )
        .join(' ')
    ).toLowerCase();

    const candidateMap = new Map<string, Entity>();

    // 1. Explicitly linked entities
    entities.forEach((ent) => {
      if (explicitlyLinkedIds.has(ent._id)) {
        candidateMap.set(ent._id, ent);
      }
    });

    // 2. Mentioned / Involved in text or event locations
    entities.forEach((ent) => {
      if (candidateMap.has(ent._id)) return;
      const cleanName = (ent.name || '').trim().toLowerCase();
      if (!cleanName || cleanName.length < 2) return;

      if (cleanName.length >= 3 && fullSessionText.includes(cleanName)) {
        candidateMap.set(ent._id, ent);
        return;
      }

      // Check significant individual name tokens (e.g. "Valeria", "Althaus", "Corvus")
      const nameTokens = cleanName.split(/\s+/).filter((t) => t.length >= 4);
      for (const tok of nameTokens) {
        if (fullSessionText.includes(tok)) {
          candidateMap.set(ent._id, ent);
          return;
        }
      }

      // Check common Italian titles & colloquial aliases (e.g. "la prof", "la professoressa", "il capitano", "il maestro")
      if (
        (cleanName.includes('prof') && (fullSessionText.includes('prof') || fullSessionText.includes('insegnante'))) ||
        (cleanName.includes('maestr') && fullSessionText.includes('maestr')) ||
        (cleanName.includes('capitan') && fullSessionText.includes('capitan')) ||
        (cleanName.includes('direttor') && fullSessionText.includes('direttor'))
      ) {
        candidateMap.set(ent._id, ent);
        return;
      }
      if (Array.isArray(ent.aliases)) {
        for (const alias of ent.aliases) {
          const cleanAlias = (alias || '').trim().toLowerCase();
          if (cleanAlias.length >= 3 && fullSessionText.includes(cleanAlias)) {
            candidateMap.set(ent._id, ent);
            return;
          }
        }
      }
      if (
        eventLocations.some(
          (loc) => loc === cleanName || loc.includes(cleanName) || cleanName.includes(loc)
        )
      ) {
        candidateMap.set(ent._id, ent);
        return;
      }
      const isExplicitlyInvolved = (session.events || []).some((e) =>
        (e.involvedCharacters || []).some((ic) => ic.toLowerCase().includes(cleanName))
      );
      if (isExplicitlyInvolved) {
        candidateMap.set(ent._id, ent);
      }
    });

    let candidateEntities = Array.from(candidateMap.values());
    if (candidateEntities.length < 10) {
      const additional = entities
        .filter((ent) => !candidateMap.has(ent._id))
        .filter((ent) => ent.type === 'npc' || ent.type === 'monster' || ent.aiConfig?.enabled);
      candidateEntities.push(...additional.slice(0, 10 - candidateEntities.length));
    }

    const shouldIncludeDmAsPlayer =
      options.includeDmAsPlayer ??
      (typeof window !== 'undefined' &&
        localStorage.getItem('chronicle_include_dm_as_player') === 'true');

    // Gather party members with their CharacterBio context
    const knownPartyMap = new Map<
      string,
      { _id: string; characterName: string; isDm?: boolean; isRegistered?: boolean; bio?: CharacterBio | null }
    >();

    const excludedIds = new Set(session.excludedPlayerIds || []);
    const excludedNames = new Set(
      players
        .filter((p) => excludedIds.has(p._id))
        .map((p) => (p.characterName || '').trim().toLowerCase())
        .filter(Boolean)
    );

    players.forEach((p) => {
      if (excludedIds.has(p._id)) return; // Excluded from this session
      const isDmSelf = !!p.isDm;
      const treatAsPlayer = shouldIncludeDmAsPlayer && isDmSelf;
      const name = (p.characterName || '').trim();
      if (name && !excludedNames.has(name.toLowerCase())) {
        const bio = CampaignManager.getCharacterBio(p._id);
        knownPartyMap.set(name.toLowerCase(), {
          _id: p._id,
          characterName: name,
          isDm: treatAsPlayer ? false : isDmSelf,
          isRegistered: true,
          bio,
        });
      }
    });

    // Also look at events and orphan tags (ignoring any excluded character names)
    (session.events || []).forEach((ev) => {
      (ev.involvedCharacters || []).forEach((ic) => {
        const clean = (ic || '').trim();
        if (
          clean.length > 1 &&
          !excludedNames.has(clean.toLowerCase()) &&
          !knownPartyMap.has(clean.toLowerCase())
        ) {
          knownPartyMap.set(clean.toLowerCase(), {
            _id: `unregistered_${clean.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`,
            characterName: clean,
            isDm: false,
            isRegistered: false,
            bio: null,
          });
        }
      });
    });

    (options.orphanTags || []).forEach((tag) => {
      const clean = (tag || '').trim();
      if (
        clean.length > 1 &&
        !excludedNames.has(clean.toLowerCase()) &&
        !knownPartyMap.has(clean.toLowerCase())
      ) {
        knownPartyMap.set(clean.toLowerCase(), {
          _id: `unregistered_${clean.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`,
          characterName: clean,
          isDm: false,
          isRegistered: false,
          bio: null,
        });
      }
    });

    const combinedPartyList = Array.from(knownPartyMap.values());

    const payload = {
      session: {
        _id: session._id,
        number: session.number,
        title: session.title,
        loreDate: session.loreDate || session.date,
        recapText: recapText.trim().slice(0, 18000),
        events: (session.events || []).map((e) => ({
          title: e.title,
          description: (e.description || '').slice(0, 500),
          location: e.location,
          involvedCharacters: e.involvedCharacters,
        })),
      },
      entities: candidateEntities.map((ent) => ({
        _id: ent._id,
        name: ent.name,
        type: ent.type,
        aliases: ent.aliases || [],
        status: ent.status,
        progressNote: (ent.progressNote || '').slice(0, 200),
        aiConfig: {
          currentStatus: ent.aiConfig?.currentStatus || '',
          evolvingBeliefs: ent.aiConfig?.evolvingBeliefs || [],
          timelineMemories: ent.aiConfig?.timelineMemories || [],
          partyRelations: ent.aiConfig?.partyRelations || {},
          entityRelations: ent.aiConfig?.entityRelations || {},
        },
      })),
      players: combinedPartyList,
      orphanTags: options.orphanTags || [],
      provider,
      model,
    };

    let rawResult: any = null;

    // 1. Try server proxy route first
    try {
      const res = await fetch('/api/ai/session-memory-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          keys: {
            geminiKey: keys.geminiKey,
            openrouterKey: keys.openrouterKey,
            cloudflareAccountId: keys.cloudflareAccountId,
            cloudflareApiToken: keys.cloudflareApiToken,
          },
        }),
      });
      if (res.ok) {
        rawResult = await res.json();
      }
    } catch {
      // Ignore network failure and fallback to browser direct analysis
    }

    // 2. Direct browser analysis fallback
    if (!rawResult || !rawResult.detectedEntities) {
      rawResult = await analyzeDirectInBrowser(payload, keys);
    }

    if (!rawResult) {
      throw new Error("Nessuna risposta valida dall'analisi AI della memoria di sessione.");
    }

    // Process player proposals (strictly filtering out any excluded players)
    const playerProposals: PlayerMemoryProposal[] = (
      Array.isArray(rawResult.playerProposals) ? rawResult.playerProposals : []
    )
      .filter((pp: any) => {
        const charName = (pp.characterName || '').trim().toLowerCase();
        const pId = pp.playerId;
        if (pId && excludedIds.has(pId)) return false;
        if (charName && excludedNames.has(charName)) return false;
        return true;
      })
      .map((pp: any, idx: number) => {
      const charName = pp.characterName || `Avventuriero ${idx + 1}`;
      const matchedParty = combinedPartyList.find(
        (p) => p.characterName.toLowerCase() === charName.toLowerCase()
      );
      const playerId = pp.playerId || matchedParty?._id || `player_${idx}`;

      const timelineMemories: TimelineMemoryEntry[] = (
        Array.isArray(pp.timelineMemories) ? pp.timelineMemories : []
      ).map((m: any, mIdx: number) => ({
        id: `mem_pg_${session._id}_${idx}_${mIdx}_${Date.now()}`,
        sessionId: session._id,
        sessionNumber: session.number,
        sessionTitle: session.title,
        loreDate: m.loreDate || session.loreDate || session.date,
        loreStartDay: session.loreStartDay,
        loreMonth: session.loreMonth,
        loreYear: session.loreYear,
        category: m.category || 'milestone',
        title: m.title || `Esperienza di ${charName}`,
        summary: m.summary || '',
        impact: m.impact || 'normal',
      }));

      const evolvingBeliefs: EvolvingBelief[] = (
        Array.isArray(pp.evolvingBeliefs) ? pp.evolvingBeliefs : []
      ).map((b: any, bIdx: number) => ({
        id: `bel_pg_${session._id}_${idx}_${bIdx}_${Date.now()}`,
        subject: b.subject || 'Soggetto di Lore',
        previousBelief: b.previousBelief || '',
        currentTruth: b.currentTruth || '',
        status: b.status || 'active_theory',
        revealedInSessionId: session._id,
        revealedInSessionNumber: session.number,
        revealedLoreDate: b.revealedLoreDate || session.loreDate || session.date,
        notes: b.notes || '',
      }));

      const interPartyRelationUpdates = (
        Array.isArray(pp.interPartyRelationUpdates) ? pp.interPartyRelationUpdates : []
      ).map((rel: any) => ({
        targetPlayerId: rel.targetPlayerId || '',
        targetCharacterName: rel.targetCharacterName || 'Compagno',
        previousAttitude: 'neutral' as const,
        newAttitude: rel.newAttitude || 'friendly',
        previousRelationType: '',
        newRelationType: rel.newRelationType || 'Compagno di Squadra',
        previousTrust: 5,
        newTrust: typeof rel.newTrust === 'number' ? rel.newTrust : 6,
        notes: rel.notes || '',
        reason: rel.reason || '',
        applied: true,
      }));

      return {
        playerId,
        characterName: charName,
        involvementType: pp.involvementType || 'direct_participant',
        reason: pp.reason || 'Ha partecipato attivamente agli eventi della sessione.',
        currentStatusBefore: matchedParty?.bio?.currentStatus || '',
        suggestedCurrentStatus: pp.suggestedCurrentStatus || '',
        applyCurrentStatus: Boolean(pp.suggestedCurrentStatus),
        timelineMemories,
        applyTimelineMemories: timelineMemories.length > 0,
        evolvingBeliefs,
        applyEvolvingBeliefs: evolvingBeliefs.length > 0,
        interPartyRelationUpdates,
      };
    });

    // Process entity proposals
    const detectedEntities: EntityMemoryProposal[] = (
      Array.isArray(rawResult.detectedEntities) ? rawResult.detectedEntities : []
    ).map((ent: any, idx: number) => {
      const entityId = ent.entityId || `entity_${idx}`;
      const matchedEntity = candidateEntities.find((e) => e._id === entityId);

      const timelineMemories: TimelineMemoryEntry[] = (
        Array.isArray(ent.timelineMemories) ? ent.timelineMemories : []
      ).map((m: any, mIdx: number) => ({
        id: `mem_ent_${session._id}_${idx}_${mIdx}_${Date.now()}`,
        sessionId: session._id,
        sessionNumber: session.number,
        sessionTitle: session.title,
        loreDate: m.loreDate || session.loreDate || session.date,
        loreStartDay: session.loreStartDay,
        loreMonth: session.loreMonth,
        loreYear: session.loreYear,
        category: m.category || 'event',
        title: m.title || `Evento di ${ent.entityName || 'Entità'}`,
        summary: m.summary || '',
        impact: m.impact || 'normal',
      }));

      const evolvingBeliefs: EvolvingBelief[] = (
        Array.isArray(ent.evolvingBeliefs) ? ent.evolvingBeliefs : []
      ).map((b: any, bIdx: number) => ({
        id: `bel_ent_${session._id}_${idx}_${bIdx}_${Date.now()}`,
        subject: b.subject || 'Fatto di Lore',
        previousBelief: b.previousBelief || '',
        currentTruth: b.currentTruth || '',
        status: b.status || 'proven_fact',
        revealedInSessionId: session._id,
        revealedInSessionNumber: session.number,
        revealedLoreDate: b.revealedLoreDate || session.loreDate || session.date,
      }));

      const partyRelationUpdates = (
        Array.isArray(ent.partyRelationUpdates) ? ent.partyRelationUpdates : []
      ).map((rel: any) => {
        const rawPlayerId = rel.playerId || '';
        const prevRel = matchedEntity?.aiConfig?.partyRelations?.[rawPlayerId] ||
          (rawPlayerId.startsWith('unregistered_')
            ? undefined
            : Object.values(matchedEntity?.aiConfig?.partyRelations || {}).find(
                (r) => r.characterName && rel.characterName && r.characterName.toLowerCase() === rel.characterName.toLowerCase()
              ));

        return {
          playerId: rawPlayerId || prevRel?.playerId || '',
          characterName: rel.characterName || prevRel?.characterName || 'Avventuriero',
          previousAttitude: prevRel?.attitude || ('neutral' as const),
          newAttitude: rel.newAttitude || prevRel?.attitude || 'neutral',
          previousRelationType: prevRel?.relationType || '',
          newRelationType: rel.newRelationType || prevRel?.relationType || '',
          previousNotes: prevRel?.notes || '',
          newNotes: rel.newNotes || '',
          milestoneEvent: rel.milestoneEvent || rel.reason || '',
          reason: rel.reason || '',
          applied: true,
        };
      });

      const entityRelationUpdates = (
        Array.isArray(ent.entityRelationUpdates) ? ent.entityRelationUpdates : []
      ).map((rel: any) => {
        const prevRel = matchedEntity?.aiConfig?.entityRelations?.[rel.targetEntityId];
        return {
          targetEntityId: rel.targetEntityId || '',
          targetEntityName: rel.targetEntityName || '',
          targetEntityType: rel.targetEntityType || 'npc',
          previousAttitude: prevRel?.attitude || ('neutral' as const),
          newAttitude: rel.newAttitude || prevRel?.attitude || 'neutral',
          previousRelationType: prevRel?.relationType || '',
          newRelationType: rel.newRelationType || prevRel?.relationType || '',
          previousNotes: prevRel?.notes || '',
          newNotes: rel.newNotes || '',
          milestoneEvent: rel.milestoneEvent || rel.reason || '',
          reason: rel.reason || '',
          applied: true,
        };
      });

      return {
        entityId,
        entityName: ent.entityName || matchedEntity?.name || 'Entità',
        entityType: ent.entityType || matchedEntity?.type || 'npc',
        involvementType: ent.involvementType || 'direct_participant',
        reason: ent.reason || '',
        currentStatusBefore: matchedEntity?.aiConfig?.currentStatus || '',
        suggestedCurrentStatus: ent.suggestedCurrentStatus || '',
        applyCurrentStatus: Boolean(ent.suggestedCurrentStatus),
        partyRelationUpdates,
        entityRelationUpdates,
        timelineMemories,
        applyTimelineMemories: timelineMemories.length > 0,
        evolvingBeliefs,
        applyEvolvingBeliefs: evolvingBeliefs.length > 0,
        shouldAddSessionToMemory: ent.shouldAddSessionToMemory !== false,
        applySessionToMemory: ent.shouldAddSessionToMemory !== false,
        suggestedNewKnowledge: ent.suggestedNewKnowledge || '',
        applyNewKnowledge: Boolean(ent.suggestedNewKnowledge),
      };
    });

    return {
      sessionId: session._id,
      sessionNumber: session.number,
      sessionTitle: session.title,
      loreDate: session.loreDate,
      detectedEntities,
      playerProposals,
    };
  }

  /**
   * Applies approved memory, belief, and relationship proposals for both
   * Party Players and Codex Entities.
   */
  static applyApprovedProposals(
    proposals: EntityMemoryProposal[],
    sessionId: string,
    playerProposals?: PlayerMemoryProposal[]
  ): { updatedCount: number; updatedEntityNames: string[] } {
    let updatedCount = 0;
    const updatedEntityNames: string[] = [];

    const allEntities = CampaignManager.getEntities();
    const currentSession = CampaignManager.getSessions().find((s) => s._id === sessionId);

    // 1. Apply Entity proposals
    proposals.forEach((prop) => {
      const entity = allEntities.find((e) => e._id === prop.entityId);
      if (!entity) return;

      let changed = false;
      const currentAiConfig = { ...(entity.aiConfig || {}) };

      // 1.1 Add session to knownSessionIds
      if (prop.applySessionToMemory) {
        const existingSessionIds = currentAiConfig.knownSessionIds || [];
        if (!existingSessionIds.includes(sessionId)) {
          currentAiConfig.knownSessionIds = [...existingSessionIds, sessionId];
          changed = true;
        }
      }

      // 1.2 Update currentStatus
      if (prop.applyCurrentStatus && prop.suggestedCurrentStatus?.trim()) {
        currentAiConfig.currentStatus = prop.suggestedCurrentStatus.trim();
        changed = true;
      }

      // 1.3 Timeline Memories
      if (prop.applyTimelineMemories && Array.isArray(prop.timelineMemories) && prop.timelineMemories.length > 0) {
        const existingMemories = currentAiConfig.timelineMemories || [];
        const newOnes = prop.timelineMemories.filter(
          (m) => !existingMemories.some((em) => em.id === m.id || (em.sessionId === sessionId && em.title === m.title))
        );
        if (newOnes.length > 0) {
          currentAiConfig.timelineMemories = [...existingMemories, ...newOnes];
          changed = true;
        }
      }

      // 1.4 Evolving Beliefs
      if (prop.applyEvolvingBeliefs && Array.isArray(prop.evolvingBeliefs) && prop.evolvingBeliefs.length > 0) {
        const existingBeliefs = currentAiConfig.evolvingBeliefs || [];
        const updatedBeliefs = [...existingBeliefs];
        prop.evolvingBeliefs.forEach((bel) => {
          const matchIdx = updatedBeliefs.findIndex(
            (eb) => eb.id === bel.id || eb.subject.toLowerCase().trim() === bel.subject.toLowerCase().trim()
          );
          if (matchIdx !== -1) {
            updatedBeliefs[matchIdx] = bel;
          } else {
            updatedBeliefs.push(bel);
          }
        });
        currentAiConfig.evolvingBeliefs = updatedBeliefs;
        changed = true;
      }

      // 1.5 Party Relations
      if (prop.partyRelationUpdates && prop.partyRelationUpdates.length > 0) {
        const partyRelations = { ...(currentAiConfig.partyRelations || {}) };
        prop.partyRelationUpdates.forEach((relUpdate) => {
          if (!relUpdate.applied) return;
          const charNameClean = (relUpdate.characterName || '').trim();
          const rawPlayerId = relUpdate.playerId || '';
          const isUnregistered =
            !rawPlayerId || rawPlayerId === 'unregistered' || rawPlayerId.startsWith('unregistered_');

          const targetKey = isUnregistered
            ? `unregistered_${charNameClean.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'soggetto'}`
            : rawPlayerId;

          if (partyRelations['unregistered']) {
            delete partyRelations['unregistered'];
          }

          const prev = partyRelations[targetKey] || {
            playerId: targetKey,
            characterName: charNameClean,
            attitude: 'neutral',
            relationType: '',
            notes: '',
          };

          // Append to progression timeline
          const newProgression = [...(prev.progression || [])];
          const milestoneText = (relUpdate.milestoneEvent || relUpdate.newNotes || relUpdate.reason || '').trim();
          if (milestoneText && !newProgression.some((m) => m.sessionId === sessionId && m.event === milestoneText)) {
            newProgression.push({
              sessionId,
              sessionNumber: currentSession?.number,
              sessionTitle: currentSession?.title,
              loreDate: currentSession?.loreDate,
              attitude: relUpdate.newAttitude || prev.attitude || 'neutral',
              relationType: relUpdate.newRelationType ?? prev.relationType,
              event: milestoneText,
              createdAt: new Date().toISOString(),
            });
          }

          partyRelations[targetKey] = {
            ...prev,
            playerId: targetKey,
            characterName: charNameClean || prev.characterName,
            attitude: relUpdate.newAttitude || prev.attitude,
            relationType: relUpdate.newRelationType ?? prev.relationType,
            notes: relUpdate.newNotes ?? prev.notes,
            progression: newProgression,
          };
          changed = true;
        });
        currentAiConfig.partyRelations = partyRelations;
      }

      // 1.6 Entity Relations
      if (prop.entityRelationUpdates && prop.entityRelationUpdates.length > 0) {
        const entityRelations = { ...(currentAiConfig.entityRelations || {}) };
        const knownEntityIds = new Set(currentAiConfig.knownEntityIds || []);

        prop.entityRelationUpdates.forEach((relUpdate) => {
          if (!relUpdate.applied) return;
          const prev = entityRelations[relUpdate.targetEntityId] || {
            targetEntityId: relUpdate.targetEntityId,
            targetEntityName: relUpdate.targetEntityName,
            targetEntityType: relUpdate.targetEntityType,
            attitude: 'neutral',
            relationType: '',
            notes: '',
          };

          const newProgression = [...(prev.progression || [])];
          const milestoneText = (relUpdate.milestoneEvent || relUpdate.newNotes || relUpdate.reason || '').trim();
          if (milestoneText && !newProgression.some((m) => m.sessionId === sessionId && m.event === milestoneText)) {
            newProgression.push({
              sessionId,
              sessionNumber: currentSession?.number,
              sessionTitle: currentSession?.title,
              loreDate: currentSession?.loreDate,
              attitude: relUpdate.newAttitude || prev.attitude || 'neutral',
              relationType: relUpdate.newRelationType ?? prev.relationType,
              event: milestoneText,
              createdAt: new Date().toISOString(),
            });
          }

          entityRelations[relUpdate.targetEntityId] = {
            ...prev,
            targetEntityName: relUpdate.targetEntityName || prev.targetEntityName,
            targetEntityType: relUpdate.targetEntityType || prev.targetEntityType,
            attitude: relUpdate.newAttitude || prev.attitude,
            relationType: relUpdate.newRelationType ?? prev.relationType,
            notes: relUpdate.newNotes ?? prev.notes,
            progression: newProgression,
          };

          knownEntityIds.add(relUpdate.targetEntityId);
          changed = true;
        });

        currentAiConfig.entityRelations = entityRelations;
        currentAiConfig.knownEntityIds = Array.from(knownEntityIds);
      }

      // 1.7 Knowledge Scope
      if (prop.applyNewKnowledge && prop.suggestedNewKnowledge?.trim()) {
        const currentScope = currentAiConfig.knowledgeScope || '';
        const newFact = prop.suggestedNewKnowledge.trim();
        if (!currentScope.toLowerCase().includes(newFact.toLowerCase())) {
          currentAiConfig.knowledgeScope = currentScope.trim()
            ? `${currentScope.trim()}\n- ${newFact}`
            : `- ${newFact}`;
          changed = true;
        }
      }

      if (changed) {
        if (!currentAiConfig.enabled) {
          currentAiConfig.enabled = true;
        }

        CampaignManager.updateEntity(entity._id, {
          aiConfig: currentAiConfig,
        });

        updatedCount++;
        updatedEntityNames.push(entity.name);
      }
    });

    // 2. Apply Player Character proposals (PG)
    if (Array.isArray(playerProposals)) {
      playerProposals.forEach((pp) => {
        if (!pp.playerId || pp.playerId.startsWith('unregistered_')) return;
        const currentBio = CampaignManager.getCharacterBio(pp.playerId) || { playerId: pp.playerId };
        let bioChanged = false;
        let updatedBio = { ...currentBio };

        // 2.1 Current status
        if (pp.applyCurrentStatus && pp.suggestedCurrentStatus?.trim()) {
          updatedBio.currentStatus = pp.suggestedCurrentStatus.trim();
          bioChanged = true;
        }

        // 2.2 Timeline memories
        if (pp.applyTimelineMemories && Array.isArray(pp.timelineMemories) && pp.timelineMemories.length > 0) {
          const existingMemories = updatedBio.timelineMemories || [];
          const newMemories = pp.timelineMemories.filter(
            (m) => !existingMemories.some((em) => em.id === m.id || (em.sessionId === sessionId && em.title === m.title))
          );
          if (newMemories.length > 0) {
            updatedBio.timelineMemories = [...existingMemories, ...newMemories];
            bioChanged = true;
          }
        }

        // 2.3 Evolving beliefs
        if (pp.applyEvolvingBeliefs && Array.isArray(pp.evolvingBeliefs) && pp.evolvingBeliefs.length > 0) {
          const existingBeliefs = updatedBio.evolvingBeliefs || [];
          const updatedBeliefs = [...existingBeliefs];
          pp.evolvingBeliefs.forEach((bel) => {
            const matchIdx = updatedBeliefs.findIndex(
              (eb) => eb.id === bel.id || eb.subject.toLowerCase().trim() === bel.subject.toLowerCase().trim()
            );
            if (matchIdx !== -1) {
              updatedBeliefs[matchIdx] = bel;
            } else {
              updatedBeliefs.push(bel);
            }
          });
          updatedBio.evolvingBeliefs = updatedBeliefs;
          bioChanged = true;
        }

        // 2.4 Inter-Party Relations
        if (Array.isArray(pp.interPartyRelationUpdates) && pp.interPartyRelationUpdates.length > 0) {
          const currentInter = { ...(updatedBio.interPartyRelations || {}) };
          pp.interPartyRelationUpdates.forEach((rel) => {
            if (!rel.applied || !rel.targetPlayerId) return;
            const prev = currentInter[rel.targetPlayerId] || {
              targetPlayerId: rel.targetPlayerId,
              targetCharacterName: rel.targetCharacterName,
              attitude: 'neutral',
              trustLevel: 5,
            };

            const newProgression = [...(prev.progression || [])];
            const milestoneText = (rel.milestoneEvent || rel.notes || rel.reason || '').trim();
            if (milestoneText && !newProgression.some((m) => m.sessionId === sessionId && m.event === milestoneText)) {
              newProgression.push({
                sessionId,
                sessionNumber: currentSession?.number,
                sessionTitle: currentSession?.title,
                loreDate: currentSession?.loreDate,
                attitude: rel.newAttitude || prev.attitude || 'neutral',
                relationType: rel.newRelationType ?? prev.relationType,
                event: milestoneText,
                trustLevel: rel.newTrust ?? prev.trustLevel,
                createdAt: new Date().toISOString(),
              });
            }

            currentInter[rel.targetPlayerId] = {
              ...prev,
              targetCharacterName: rel.targetCharacterName || prev.targetCharacterName,
              attitude: rel.newAttitude || prev.attitude,
              relationType: rel.newRelationType ?? prev.relationType,
              trustLevel: rel.newTrust ?? prev.trustLevel,
              notes: rel.notes ?? prev.notes,
              progression: newProgression,
              updatedAt: new Date().toISOString(),
            };
            bioChanged = true;
          });
          updatedBio.interPartyRelations = currentInter;
        }

        if (bioChanged) {
          CampaignManager.saveCharacterBio(updatedBio);
          updatedCount++;
          updatedEntityNames.push(`${pp.characterName} (Memoria PG)`);
        }
      });
    }

    // 3. Reconcile unregistered relations
    const currentPlayers = CampaignManager.getPlayers();
    currentPlayers.forEach((p) => {
      if (p._id && p.characterName) {
        CampaignManager.reconcileUnregisteredRelations(p._id, p.characterName);
      }
    });

    // 4. Mark this session as memory-synchronized
    if (sessionId) {
      CampaignManager.updateSession(sessionId, {
        memorySynced: true,
        memorySyncedAt: new Date().toISOString(),
      });
    }

    return {
      updatedCount,
      updatedEntityNames,
    };
  }
}
