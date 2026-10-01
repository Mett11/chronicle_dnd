import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import * as dotenv from 'dotenv';
dotenv.config();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Google Gemini API Key Validation Endpoint (metadata check - zero generation quota consumed)
  app.post('/api/ai/gemini/validate', async (req: any, res: any) => {
    try {
      const apiKey = req.body?.apiKey?.trim() || req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'Chiave API non fornita.' });
      }

      // Check key validity via Google API Gateway metadata endpoint (no generation quota used)
      const metaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`);
      const data = await metaRes.json().catch(() => ({}));

      if (metaRes.ok && Array.isArray(data?.models)) {
        return res.json({ valid: true, message: 'Chiave API Google Gemini valida e operativa!' });
      }

      if (data?.error) {
        const msg = String(data.error.message || '');
        const code = data.error.code || metaRes.status;
        if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || code === 400) {
          return res.json({ valid: false, error: 'La chiave API di Google Gemini inserita non è valida o è stata revocata.' });
        }
        if (code === 429 || code === 503 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('high demand')) {
          return res.json({ valid: true, message: 'Chiave API Google Gemini valida e autorizzata! (Server Google in alta affluenza HTTP 429/503)' });
        }
      }

      if (metaRes.status === 429 || metaRes.status === 503) {
        return res.json({ valid: true, message: 'Chiave API Google Gemini valida e autorizzata! (Server Google in alta affluenza HTTP 429/503)' });
      }

      return res.json({ valid: false, error: 'Impossibile verificare la chiave API con i server Google.' });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('401') || msg.includes('400')) {
        return res.json({ valid: false, error: 'La chiave API di Google Gemini inserita non è valida o è stata revocata.' });
      }
      if (msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED')) {
        return res.json({ valid: true, message: 'Chiave API valida (Server Google temporaneamente saturi).' });
      }
      return res.json({ valid: false, error: `Errore durante la verifica: ${msg}` });
    }
  });

  // OpenRouter API Key Validation Endpoint
  app.post('/api/ai/openrouter/validate', async (req: any, res: any) => {
    try {
      const apiKey = req.body?.apiKey?.trim() || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'Chiave API OpenRouter non fornita.' });
      }

      const orRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const data = await orRes.json().catch(() => ({}));
      if (orRes.ok && data?.data) {
        return res.json({ valid: true, message: 'Chiave OpenRouter valida e attiva!', usage: data.data });
      }

      return res.json({ valid: false, error: data?.error?.message || 'Chiave OpenRouter non valida.' });
    } catch (err: any) {
      return res.json({ valid: false, error: err?.message || 'Errore di connessione a OpenRouter.' });
    }
  });

  // Cloudflare Workers AI Validation Endpoint
  app.post('/api/ai/cloudflare/validate', async (req: any, res: any) => {
    try {
      const accountId = req.body?.accountId?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID;
      const token = req.body?.token?.trim() || process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !token) {
        return res.status(400).json({ valid: false, error: "Inserisci sia l'Account ID che il Token API Cloudflare." });
      }

      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await cfRes.json().catch(() => ({}));
      if (cfRes.ok && data?.success) {
        return res.json({ valid: true, message: 'Credenziali Cloudflare Workers AI valide!' });
      }

      return res.json({ valid: false, error: data?.errors?.[0]?.message || 'Credenziali Cloudflare non valide o senza permessi Workers AI.' });
    } catch (err: any) {
      return res.json({ valid: false, error: err?.message || 'Errore di connessione con Cloudflare.' });
    }
  });

  // OCR Endpoint with safe file extraction and Gemini API integration
  app.post(
    '/api/ocr',
    (req: any, res: any, next: any) => {
      upload.any()(req, res, (err: any) => {
        if (err) {
          console.error('Multer upload error:', err);
          return res.status(400).json({ error: `Errore caricamento file: ${err.message}` });
        }
        next();
      });
    },
    async (req: any, res: any) => {
      try {
        let base64Data = '';
        let mimeType = 'image/jpeg';

        // Check if file was uploaded via multipart/form-data
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          const file = req.files[0];
          base64Data = file.buffer.toString('base64');
          mimeType = file.mimetype || 'image/jpeg';
        } else if (req.file) {
          base64Data = req.file.buffer.toString('base64');
          mimeType = req.file.mimetype || 'image/jpeg';
        } else if (req.body?.imageBase64) {
          const rawBase64 = req.body.imageBase64;
          const match = rawBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            base64Data = rawBase64;
            mimeType = req.body.mimeType || 'image/jpeg';
          }
        }

        if (!base64Data) {
          return res.status(400).json({ error: 'Nessuna immagine fornita per la trascrizione' });
        }

        const requestedEngine = req.body?.engine || 'auto';

        // Multi-model cascade for Gemini Vision
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Analizza questa immagine di appunti (presumibilmente scritti a mano o stampati relativi a sessioni di D&D / GdR).
Trascrivi tutto il testo rilevato con la massima accuratezza.
Linee guida:
1. Correggi automaticamente evidenti refusi od omissioni dovute alla grafia o alla scansione.
2. Mantieni e struttura paragrafi, elenchi, intestazioni e nomi propri (personaggi, mostri, luoghi).
3. Restituisci ESCLUSIVAMENTE il testo trascritto e formattato, senza preamboli, note introduttive o commenti meta.`;

          const candidateModels = [
            'gemini-flash-latest',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.1-flash-lite',
          ];

          for (const modelName of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        inlineData: {
                          data: base64Data,
                          mimeType,
                        },
                      },
                      { text: prompt },
                    ],
                  },
                ],
              });

              const extractedText = response.text || '';
              if (extractedText.trim()) {
                return res.json({ text: extractedText, engine: 'gemini', model: modelName });
              }
            } catch (geminiErr: any) {
              console.warn(
                `[OCR] Modello ${modelName} non disponibile (${geminiErr?.status || geminiErr?.message}). Tentativo prossimo modello o fallback...`
              );
            }
          }
        }

        // Return clear status for client-side Puter.js / Mistral OCR fallback
        return res.status(503).json({
          error: 'Servizio server momentaneamente occupato o quota esaurita. Attivazione motore di riserva...',
          fallbackNeeded: true,
        });
      } catch (err: any) {
        console.error('OCR Fatal Error:', err);
        return res.status(500).json({ error: err?.message || 'Errore durante la trascrizione dell\'immagine.', fallbackNeeded: true });
      }
    }
  );

  // Dedicated endpoint to list available Gemini models dynamically
  app.get('/api/ai/gemini/models', async (req: any, res: any) => {
    try {
      const customKey = (req.headers['x-custom-api-key'] || req.headers['x-gemini-key'] || req.query.key || '')?.toString().trim();
      const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        return res.json({
          models: [
            { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Velocità eccezionale, contesto esteso di 1 Milione di token.' },
            { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', description: 'Latenza ridotta per risposte istantanee.' },
            { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Capacità multimodale e ragionamento avanzato.' },
            { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Alias sempre aggiornato all\'ultima versione stabile.' },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Modello ragionativo di fascia alta.' },
          ],
        });
      }

      const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (googleRes.ok) {
        const data = await googleRes.json().catch(() => null);
        if (Array.isArray(data?.models) && data.models.length > 0) {
          const mapped = data.models
            .filter((m: any) => {
              const name = String(m.name || m.id || '').toLowerCase();
              const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
              const supportsGenerate = methods.length === 0 || methods.includes('generateContent');
              return name.includes('gemini') && !name.includes('embedding') && !name.includes('imagen') && !name.includes('aqa') && supportsGenerate;
            })
            .map((m: any) => {
              const id = String(m.name || m.id || '').replace(/^models\//, '');
              return {
                id,
                name: m.displayName || id,
                description: m.description || 'Modello Google Gemini ufficialmente supportato.',
              };
            });
          if (mapped.length > 0) {
            return res.json({ models: mapped });
          }
        }
      }

      return res.json({
        models: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Velocità eccezionale, contesto esteso di 1 Milione di token.' },
          { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', description: 'Latenza ridotta per risposte istantanee.' },
          { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Capacità multimodale e ragionamento avanzato.' },
          { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Alias sempre aggiornato all\'ultima versione stabile.' },
        ],
      });
    } catch (err: any) {
      return res.json({
        models: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Velocità eccezionale, contesto esteso di 1 Milione di token.' },
          { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', description: 'Latenza ridotta per risposte istantanee.' },
        ],
      });
    }
  });

  // Dedicated endpoint to analyze session chronicle and extract new + existing entities with AI-generated descriptions
  app.post('/api/ai/extract-entities', async (req: any, res: any) => {
    try {
      const {
        text,
        existingEntityNames,
        playerNames,
        provider = 'gemini',
        model,
        geminiApiKey: reqGeminiKey,
        openrouterApiKey: reqOpenRouterKey,
        cloudflareAccountId: reqCloudflareAccount,
        cloudflareApiToken: reqCloudflareToken,
      } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Nessun testo fornito per l\'analisi' });
      }

      const normalizeStr = (s: string) => {
        if (!s) return '';
        return s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
      };

      // Extract all @ mentions from the source text
      const extractedMentionNames = new Set<string>();
      const bracketMatch = text.matchAll(/@\[(.*?)\]/g);
      for (const m of bracketMatch) {
        if (m[1]?.trim()) extractedMentionNames.add(m[1].trim());
      }
      const singleWordMatch = text.matchAll(/(?<![a-zA-Z0-9_[\u00C0-\u017F])@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g);
      for (const m of singleWordMatch) {
        const clean = m[1]?.replace(/[.,;:!?]+$/, '').trim();
        if (clean && clean.length > 1 && !/^\d+$/.test(clean) && !clean.includes('@')) {
          extractedMentionNames.add(clean);
        }
      }

      const existingNormSet = new Set((existingEntityNames || []).map((e: string) => normalizeStr(e)));
      const playerNormSet = new Set((playerNames || []).map((p: string) => normalizeStr(p)));

      const taggedOrphanMentions = Array.from(extractedMentionNames).filter((m) => {
        const norm = normalizeStr(m);
        return norm && !existingNormSet.has(norm) && !playerNormSet.has(norm);
      });

      const taggedOrphansPrompt = taggedOrphanMentions.length > 0
        ? `\n\nTAG ESPLICITI @ DELL'AUTORE DA INCLUDERE OBBLIGATORIAMENTE:\nL'autore della cronaca ha contrassegnato con '@' i seguenti elementi chiave: ${taggedOrphanMentions.join(', ')}.\nDEVI OBBLIGATORIAMENTE analizzare ciascuno di questi elementi ed estrarlo in 'newEntities', deducendone la tipologia corretta (npc, monster, place, item, faction, quest), la descrizione e lo status dal contesto!`
        : '';

      // Pre-clean text for AI analysis so existing @ or @[..] tags don't confuse tokenization
      const cleanTextForAnalysis = text
        .replace(/@\[(.*?)\]/g, '$1')
        .replace(/@([a-zA-Z0-9_'\u00C0-\u017F-]+)/g, '$1')
        .replace(/@+/g, '');

      const knownEntitiesPrompt = Array.isArray(existingEntityNames) && existingEntityNames.length > 0
        ? `Ecco le entità già registrate nel compendio/codex della campagna (NON estrarle MAI come newEntities): ${existingEntityNames.slice(0, 300).join(', ')}.`
        : '';

      const knownPlayersPrompt = Array.isArray(playerNames) && playerNames.length > 0
        ? `Ecco i Personaggi Giocanti del party già registrati: ${playerNames.join(', ')}.`
        : '';

      const systemInstruction = `Sei un assistente specializzato per Dungeon Master di D&D e giochi di ruolo fantasy.
Il tuo compito è analizzare la cronaca di una sessione di gioco ed estrarre con estrema precisione le entità del mondo fantasy: PNG (personaggi non giocanti del DM), Mostri/Nemici, Luoghi/Città/Dungeon/Istituzioni/Locali, Fazioni/Ordini/Gilde, Oggetti Magici/Reliquie e Missioni/Quest citati nel testo.

${knownEntitiesPrompt}
${knownPlayersPrompt}
${taggedOrphansPrompt}

REGOLE CRITICHE SUI NOMI, TIPOLOGIE E DESCRIZIONI:
1. NOMI COMPLETI E MAI TRONCATI: Estrai sempre il NOME COMPLETO E PROPRIO per esteso dell'entità, inclusi toponimi, sigle, titoli e complementi (es. "Ristorante Trattoria del Fenomeno", "Accademia T.A.V.", "Porta Lumìnia", "Terra di Fiumi Spezzati").
2. CLASSIFICAZIONE RIGOROSA DELLE TIPOLOGIE ('type'):
   - 'place': Luoghi geografici, città, regioni, ma anche EDIFICI, STRUTTURE, LOCALI, RISTORANTI, TAVERNE, LOCANDE, ACCADEMIE, PORTE, TORRI (es. "Ristorante Trattoria del Fenomeno", "Locanda del Cinghiale", "Porta Lumìnia"). Non classificare mai locali o strutture come 'npc'!
   - 'faction': Fazioni, gilde, ordini, sette, culti, clan, confraternite o eserciti.
   - 'item': Oggetti magici, armi, reliquie, tomi, pergamene, pozioni, artefatti.
   - 'monster': Mostri, creature selvatiche, aberrazioni o nemici non-umanoidi.
   - 'quest': Missioni, contratti, profezie o obiettivi.
   - 'npc': Personaggi singoli (PNG, figure storiche, mercanti, nobili).
3. DESCRIZIONI NARRATIVE COMPLETE E AUTONOME:
   - MAI incollare spezzoni grezzi tagliati a metà della cronaca.
   - MAI includere tag come '@' o '@[' all'interno del campo description.
   - Scrivi 2-3 frasi fluide e ben scritte in terza persona in italiano, che spieghino chiaramente cos'è l'entità e qual è il suo ruolo o cosa è accaduto in questa sessione.
4. PERSONAGGI GIOCANTI / PARTY: Se un personaggio menzionato sembra essere un eroe/PG del party (anche se l'utente non lo ha ancora registrato formalmente nel sistema), inseriscilo comunque in 'newEntities' impostando 'isPartyMember': true.
5. ENTITÀ GIÀ REGISTRATE: Se un'entità è già presente nell'elenco delle entità note fornito, NON inserirla in 'newEntities'; segnalala solo in 'existingDetected'.
6. STRUTTURA:
   - 'name': Nome proprio completo e pulito.
   - 'type': 'place' | 'npc' | 'monster' | 'item' | 'faction' | 'quest'.
   - 'description': Descrizione narrativa autonoma e completa in italiano.
   - 'status': 'alive' | 'dead' | 'open' | 'completed'.
   - 'location': Luogo in cui si trova, se specificato.
   - 'aliases': Eventuali soprannomi o acronimi.
   - 'isPartyMember': boolean opzionale.

Rispondi ESCLUSIVAMENTE in formato JSON valido conforme al seguente schema:
{
  "newEntities": [
    {
      "name": "string",
      "type": "place" | "npc" | "monster" | "item" | "faction" | "quest",
      "description": "string",
      "status": "alive" | "dead" | "open" | "completed",
      "location": "string opzionale",
      "aliases": ["string opzionale"],
      "isPartyMember": false
    }
  ],
  "existingDetected": ["string"]
}`;

      const userPrompt = `Analizza questa cronaca di sessione ed estrai con nomi completi le entità secondo le istruzioni:\n\n${cleanTextForAnalysis.slice(0, 40000)}`;

      const sanitizeAndFilter = (parsed: any, modelUsed: string) => {
        const existingSet = new Set<string>();
        (existingEntityNames || []).forEach((e: string) => {
          const norm = normalizeStr(e);
          if (norm) existingSet.add(norm);
        });

        const playerNormMap = new Map<string, string>();
        (playerNames || []).forEach((p: string) => {
          const norm = normalizeStr(p);
          if (norm) playerNormMap.set(norm, p);
        });

        const detectedExisting = new Set<string>(
          (Array.isArray(parsed?.existingDetected) ? parsed.existingDetected : [])
            .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
        );

        const cleanedNew: any[] = [];

        (Array.isArray(parsed?.newEntities) ? parsed.newEntities : []).forEach((ent: any) => {
          if (!ent || !ent.name || typeof ent.name !== 'string') return;
          const nameTrim = ent.name.trim();
          const nameNorm = normalizeStr(nameTrim);
          if (!nameNorm) return;

          // Check if matches an existing entity name or alias
          const aliasesNorm = (Array.isArray(ent.aliases) ? ent.aliases : []).map((a: string) => normalizeStr(a)).filter(Boolean);

          const matchesExisting = existingSet.has(nameNorm) || aliasesNorm.some((a: string) => existingSet.has(a));

          if (matchesExisting) {
            // Add to detected existing for auto-tagging
            detectedExisting.add(nameTrim);
            return;
          }

          // Check if matches a Party Member
          const matchedPlayerOriginal = playerNormMap.get(nameNorm) || aliasesNorm.map((a: string) => playerNormMap.get(a)).find(Boolean);

          const isPartyMember = Boolean(matchedPlayerOriginal || ent.isPartyMember);

          cleanedNew.push({
            ...ent,
            name: nameTrim,
            isPartyMember,
            matchedPlayerName: matchedPlayerOriginal || (isPartyMember ? nameTrim : undefined),
          });
        });

        return {
          newEntities: cleanedNew,
          existingDetected: Array.from(detectedExisting),
          model: modelUsed,
          provider,
        };
      };

      const parseJsonFromText = (raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
        }
        return null;
      };

      // ==========================================
      // 1. CLOUDFLARE WORKERS AI PROVIDER
      // ==========================================
      if (provider === 'cloudflare') {
        const cfAccountId = (reqCloudflareAccount || req.headers['x-cloudflare-account'] || process.env.CLOUDFLARE_ACCOUNT_ID || '')?.trim();
        const cfToken = (reqCloudflareToken || req.headers['x-cloudflare-token'] || process.env.CLOUDFLARE_API_TOKEN || '')?.trim();

        if (!cfAccountId || !cfToken) {
          return res.status(400).json({ error: 'Credenziali Cloudflare Workers AI non configurate nelle Impostazioni.' });
        }

        const requestedModel = (model && typeof model === 'string' && model.trim())
          ? model.trim()
          : '@cf/meta/llama-3.3-70b-instruct-fp8';

        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\nRispondi SOLO in formato JSON.` },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 4096,
          }),
        });

        const cfData = await cfRes.json().catch(() => ({}));
        let answer = cfData?.choices?.[0]?.message?.content || cfData?.result?.response || '';
        if (typeof answer === 'object') answer = JSON.stringify(answer);

        const parsed = parseJsonFromText(answer);
        if (parsed) {
          return res.json(sanitizeAndFilter(parsed, requestedModel));
        }

        return res.status(500).json({ error: 'Impossibile interpretare la risposta JSON da Cloudflare Workers AI.' });
      }

      // ==========================================
      // 2. OPENROUTER PROVIDER
      // ==========================================
      if (provider === 'openrouter') {
        const openrouterKey = (reqOpenRouterKey || req.headers['x-openrouter-key'] || process.env.OPENROUTER_API_KEY || '')?.trim();
        if (!openrouterKey) {
          return res.status(400).json({ error: 'Chiave API OpenRouter non configurata nelle Impostazioni.' });
        }

        const requestedModel = sanitizeOpenRouterModelId(model || 'openrouter/free');

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://chronicle-dnd.local',
            'X-Title': 'Chronicle D&D',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 4096,
            response_format: { type: 'json_object' },
          }),
        });

        const orData = await orRes.json().catch(() => ({}));
        const rawContent = orData?.choices?.[0]?.message?.content || '';
        const parsed = parseJsonFromText(rawContent);
        if (parsed) {
          return res.json(sanitizeAndFilter(parsed, requestedModel));
        }

        return res.status(500).json({ error: orData?.error?.message || 'Impossibile interpretare la risposta JSON da OpenRouter.' });
      }

      // ==========================================
      // 3. GOOGLE GEMINI PROVIDER
      // ==========================================
      const customKey = (reqGeminiKey || req.headers['x-custom-api-key'] || req.headers['x-gemini-key'] || '')?.trim();
      const serverKey = process.env.GEMINI_API_KEY;
      const apiKeysToTry: string[] = [];
      if (customKey) apiKeysToTry.push(customKey);
      if (serverKey && serverKey !== customKey) apiKeysToTry.push(serverKey);

      if (apiKeysToTry.length === 0) {
        return res.status(503).json({
          error: 'Nessuna chiave API Gemini disponibile. Inserisci la tua chiave nelle Impostazioni.',
        });
      }

      const requestedModel = (model && typeof model === 'string' && model.trim()) ? model.trim() : 'gemini-flash-latest';
      const candidateModels = Array.from(
        new Set([
          requestedModel,
          'gemini-flash-latest',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.1-flash-lite',
        ].filter(Boolean))
      );

      let lastErrMsg = '';
      let isRateLimitQuota = false;
      let retryDelaySeconds = 0;

      for (const apiKey of apiKeysToTry) {
        if (req.destroyed || res.writableEnded) break;
        const isCurrentKeyCustom = apiKey === customKey;
        const ai = new GoogleGenAI({ apiKey });

        for (const modelName of candidateModels) {
          if (req.destroyed || res.writableEnded) break;
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userPrompt }],
                },
              ],
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });

            const rawText = response.text || '';
            if (rawText.trim()) {
              const parsed = parseJsonFromText(rawText);
              if (parsed) {
                const result = sanitizeAndFilter(parsed, modelName);
                return res.json({
                  ...result,
                  source: isCurrentKeyCustom ? 'custom_key' : 'server',
                });
              }
            }
          } catch (geminiErr: any) {
            const status = geminiErr?.status || geminiErr?.statusCode || 500;
            const msg = String(geminiErr?.message || geminiErr);
            lastErrMsg = msg;

            if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              isRateLimitQuota = true;
              const delayMatch = msg.match(/retry in ([\d.]+)s/i);
              if (delayMatch) {
                retryDelaySeconds = Math.ceil(parseFloat(delayMatch[1]));
              }
            }

            console.warn(
              `[Entity Extraction] Modello ${modelName} fallito (${status}): ${msg.slice(0, 150)}`
            );
          }
        }
      }

      if (isRateLimitQuota) {
        return res.status(429).json({
          error: `Limite di quota gratuita superato per i modelli Gemini.${retryDelaySeconds > 0 ? ` Riprova tra circa ${retryDelaySeconds} secondi.` : ' Riprova tra pochi istanti.'}`,
          isQuota: true,
          retryDelay: retryDelaySeconds || 30,
        });
      }

      return res.status(500).json({ error: lastErrMsg || 'Impossibile analizzare il testo con l\'IA al momento.' });
    } catch (err: any) {
      console.error('Extract Entities API Error:', err);
      return res.status(500).json({ error: err.message || 'Errore durante l\'estrazione entità.' });
    }
  });

  // Dedicated endpoint to draft a single entity card from an orphan mention with surrounding context
  app.post('/api/ai/draft-entity-from-mention', async (req: any, res: any) => {
    try {
      const {
        mentionName,
        snippets = [],
        fullText = '',
        provider = 'gemini',
        model,
        geminiApiKey: reqGeminiKey,
        openrouterApiKey: reqOpenRouterKey,
        cloudflareAccountId: reqCloudflareAccount,
        cloudflareApiToken: reqCloudflareToken,
      } = req.body;

      if (!mentionName || typeof mentionName !== 'string' || !mentionName.trim()) {
        return res.status(400).json({ error: 'Nessun nome di menzione fornito.' });
      }

      const systemInstruction = `Sei un assistente specializzato per Dungeon Master di D&D e GDR fantasy.
Ti viene fornito il nome di un'entità menzionata nella cronaca di gioco e i passaggi di contesto in cui appare.
Il tuo compito è dedurre con precisione la tipologia corretta dell'entità e generare una descrizione sintetica (2-3 frasi in perfetto italiano) autonoma, narrativa e fluida.

REGOLE CRITICHE SULLA TIPOLOGIA ('type'):
- 'place': Assegna 'place' se il nome è o contiene una struttura, edificio, locale, attività, toponimo, città, taverna, locanda, ristorante, trattoria, accademia, tempio, torre, porta, bosco, fiume, etc. (Esempi: "Ristorante Trattoria del Fenomeno", "Taverna del Drago", "Accademia T.A.V.", "Porta Lumìnia", "Tabula"). NON classificare mai locali o strutture come 'npc'!
- 'faction': Gilde, ordini, sette, culti, famiglie, clan, alleanze o eserciti.
- 'item': Oggetti magici, armi, artefatti, pergamene, anelli, pozioni.
- 'monster': Creature mostruose, mostri, bestie o nemici non-umanoidi.
- 'quest': Missioni, contratti o compiti del party.
- 'npc': Personaggi singoli (alleati, PNG del DM, figure chiave umane/umanoidi).

REGOLE CRITICHE SULLA DESCRIZIONE ('description'):
- NON copiare o incollare spezzoni grezzi di testo tagliati o frammentati.
- NON includere simboli di markup come '@[' o '@'.
- Scrivi una descrizione narrativa autonoma e completa in terza persona che spieghi cos'è questa entità e cosa è accaduto in relazione al gruppo durante la sessione (es. "Ristorante e trattoria situato a Tabula, scelto come punto di ritrovo dove i membri del gruppo e le sette eccezioni sono stati invitati per ricevere i dettagli del loro test pratico.").

Rispondi ESCLUSIVAMENTE in formato JSON valido conforme al seguente schema:
{
  "name": "${mentionName.trim()}",
  "type": "place" | "npc" | "monster" | "item" | "faction" | "quest",
  "description": "string",
  "status": "alive" | "dead" | "open" | "completed",
  "location": "string opzionale",
  "aliases": ["string opzionale"],
  "isPartyMember": false
}`;

      const contextText = snippets.length > 0
        ? `Contesto rilevato nella cronaca:\n${snippets.join('\n---\n')}`
        : fullText
        ? `Testo della sessione:\n${fullText.slice(0, 8000)}`
        : `Nome menzionato: ${mentionName}`;

      const userPrompt = `Analizza l'entità "${mentionName}" nel seguente contesto e crea la scheda JSON:\n\n${contextText}`;

      // 1. Cloudflare Workers AI
      if (provider === 'cloudflare') {
        const cfAccountId = (reqCloudflareAccount || req.headers['x-cloudflare-account'] || process.env.CLOUDFLARE_ACCOUNT_ID || '')?.trim();
        const cfToken = (reqCloudflareToken || req.headers['x-cloudflare-token'] || process.env.CLOUDFLARE_API_TOKEN || '')?.trim();

        if (!cfAccountId || !cfToken) {
          return res.status(400).json({ error: 'Credenziali Cloudflare Workers AI non configurate.' });
        }

        const requestedModel = (model && typeof model === 'string' && model.trim())
          ? model.trim()
          : '@cf/meta/llama-3.3-70b-instruct-fp8';

        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\nRispondi SOLO in formato JSON.` },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
          }),
        });

        const cfData = await cfRes.json().catch(() => ({}));
        let answer = cfData?.choices?.[0]?.message?.content || cfData?.result?.response || '';
        if (typeof answer === 'object') answer = JSON.stringify(answer);
        if (answer) {
          try {
            const parsed = JSON.parse(answer);
            return res.json({ entity: parsed, model: requestedModel });
          } catch {}
          const m = answer.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              return res.json({ entity: parsed, model: requestedModel });
            } catch {}
          }
        }
      }

      // 2. OpenRouter
      if (provider === 'openrouter') {
        const openrouterKey = (
          reqOpenRouterKey ||
          req.headers['x-openrouter-key'] ||
          process.env.OPENROUTER_API_KEY ||
          process.env.VITE_OPENROUTER_API_KEY ||
          ''
        )?.trim();

        if (!openrouterKey) {
          return res.status(400).json({ error: 'Chiave API OpenRouter non configurata.' });
        }

        const requestedModel = (model && typeof model === 'string' && model.trim())
          ? model.trim()
          : 'openrouter/free';

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chronicle-dnd.app',
            'X-Title': 'Chronicle DND Manager',
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        const orData = await orRes.json().catch(() => ({}));
        const rawContent = orData.choices?.[0]?.message?.content || '';
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent);
            return res.json({ entity: parsed, model: requestedModel });
          } catch {}
          const m = rawContent.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              return res.json({ entity: parsed, model: requestedModel });
            } catch {}
          }
        }
      }

      // 3. Google Gemini
      const customKey = (reqGeminiKey || req.headers['x-custom-api-key'] || '')?.trim();
      const serverKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
      const apiKeysToTry: string[] = [];
      if (customKey) apiKeysToTry.push(customKey);
      if (serverKey && !apiKeysToTry.includes(serverKey)) apiKeysToTry.push(serverKey);

      if (apiKeysToTry.length === 0) {
        return res.status(500).json({ error: 'Nessuna chiave API Gemini disponibile.' });
      }

      const candidateModels = [
        model && typeof model === 'string' && model.trim() ? model.trim() : 'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.1-flash-lite',
      ];

      for (const currentKey of apiKeysToTry) {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });

            const rawText = response.text || '';
            if (rawText.trim()) {
              try {
                const parsed = JSON.parse(rawText);
                return res.json({ entity: parsed, model: modelName });
              } catch {}
              const m = rawText.match(/\{[\s\S]*\}/);
              if (m) {
                try {
                  const parsed = JSON.parse(m[0]);
                  return res.json({ entity: parsed, model: modelName });
                } catch {}
              }
            }
          } catch (geminiErr: any) {
            console.warn(`[Draft Entity] Model ${modelName} failed:`, geminiErr.message?.slice(0, 100));
          }
        }
      }

      return res.status(500).json({ error: 'Impossibile compilare la scheda con l\'IA al momento.' });
    } catch (err: any) {
      console.error('Draft Entity API Error:', err);
      return res.status(500).json({ error: err.message || 'Errore durante la compilazione della scheda.' });
    }
  });

  // Unified Session Memory Sync API handler
  const handleSessionMemorySync = async (req: any, res: any) => {
    try {
      const {
        session,
        entities = [],
        players = [],
        provider = 'gemini',
        model,
        orphanTags = [],
      } = req.body;

      if (!session || (!session.title && !session.recapText)) {
        return res.status(400).json({ error: 'Dati della sessione incompleti per l\'analisi.' });
      }

      const customKey = (req.headers['x-custom-api-key'] as string)?.trim();
      const serverKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
      const openrouterApiKey = (
        req.headers['x-openrouter-key'] ||
        process.env.OPENROUTER_API_KEY ||
        process.env.VITE_OPENROUTER_API_KEY ||
        ''
      )?.trim();

      const apiKeysToTry: string[] = [];
      if (customKey) apiKeysToTry.push(customKey);
      if (serverKey && !apiKeysToTry.includes(serverKey)) apiKeysToTry.push(serverKey);

      // Compact representation of candidate entities for the prompt
      const entitiesCatalog = (entities as any[]).map((e: any) => {
        const partyRelSummary = e.aiConfig?.partyRelations
          ? Object.values(e.aiConfig.partyRelations)
              .map((r: any) => `${r.characterName || 'PG'}: att=${r.attitude || 'neutral'}, legame="${r.relationType || ''}"`)
              .join(' | ')
          : 'nessuna';

        const entityRelSummary = e.aiConfig?.entityRelations
          ? Object.values(e.aiConfig.entityRelations)
              .map((r: any) => `${r.targetEntityName || 'Entità'}: legame="${r.relationType || ''}"`)
              .join(' | ')
          : 'nessuna';

        const beliefsSummary = Array.isArray(e.aiConfig?.evolvingBeliefs) && e.aiConfig.evolvingBeliefs.length > 0
          ? e.aiConfig.evolvingBeliefs.map((b: any) => `[${b.subject}]: ${b.currentTruth} (${b.status})`).join('; ')
          : 'nessuna registrata';

        const recentMemories = Array.isArray(e.aiConfig?.timelineMemories) && e.aiConfig.timelineMemories.length > 0
          ? e.aiConfig.timelineMemories.slice(-3).map((m: any) => `${m.loreDate || 'Data N/D'}: ${m.title}`).join(' | ')
          : 'nessuna';

        return `- [ID: ${e._id}] ${e.name} (${e.type.toUpperCase()})${e.aliases?.length ? ` [Alias: ${e.aliases.join(', ')}]` : ''}
  Stato: "${e.aiConfig?.currentStatus || e.status || 'attivo'}"
  Credenze / Teorie: ${beliefsSummary}
  Memorie Recenti: ${recentMemories}
  Relazioni Party: ${partyRelSummary}
  Relazioni Compendio: ${entityRelSummary}`;
      }).join('\n\n');

      const playersCatalog = (players as any[])
        .map((p: any) => {
          const bio = p.bio || null;
          const beliefsSummary = Array.isArray(bio?.evolvingBeliefs) && bio.evolvingBeliefs.length > 0
            ? bio.evolvingBeliefs.map((b: any) => `[${b.subject}]: ${b.currentTruth} (${b.status})`).join('; ')
            : 'nessuna teoria registrata';

          const recentMemories = Array.isArray(bio?.timelineMemories) && bio.timelineMemories.length > 0
            ? bio.timelineMemories.slice(-3).map((m: any) => `${m.loreDate || 'Data N/D'}: ${m.title}`).join(' | ')
            : 'nessun ricordo recente';

          const interPartySummary = bio?.interPartyRelations
            ? Object.values(bio.interPartyRelations)
                .map((r: any) => `${r.targetCharacterName}: fiducia=${r.trustLevel ?? 5}/10, att=${r.attitude || 'neutral'}`)
                .join(' | ')
            : 'legame standard di gruppo';

          return `- [ID: ${p._id}] ${p.characterName || 'Personaggio'}${p.isDm ? ' (DM)' : ''}${
            p.isRegistered === false ? ' (Membro Party / Compagno Non Registrato)' : ''
          }
  Stato PG: "${bio?.currentStatus || 'In viaggio col gruppo'}"
  Credenze & Sospetti PG: ${beliefsSummary}
  Ultimi Ricordi di Lore: ${recentMemories}
  Rapporti con i Compagni (PG ↔ PG): ${interPartySummary}`;
        })
        .join('\n\n');

      const orphanCatalog = (orphanTags as string[]).map((tag: string) => `- ${tag} (UNREGISTERED/ORFANO)`).join('\n');

      const sessionText = `
=== INFORMAZIONI SESSIONE & DATA DI LORE ===
- Numero Sessione: ${session.number || 'N/D'}
- Titolo: ${session.title}
- Data di Lore (Calendario del Mondo): ${session.loreDate || 'N/D'}

=== RECAP NARRATIVO DELLA SESSIONE ===
${(session.recapText || '').slice(0, 16000)}

=== EVENTI SALIENTI REGISTRATI ===
${(session.events || []).slice(0, 12).map((ev: any) => `* ${ev.title}: ${(ev.description || '').slice(0, 300)} (Luogo: ${ev.location || 'N/D'}) [Personaggi: ${(ev.involvedCharacters || []).join(', ') || 'Party'}]`).join('\n') || 'Nessun evento formale registrato.'}
`;

      const systemInstruction = `Sei l'Archivista Arcano e Storico della Campagna di D&D.
Il tuo compito fondamentale è analizzare la cronaca della sessione conclusa e determinare in modo TEMPORALMENTE COERENTE:
1. L'EVOLUZIONE DELLA MEMORIA VIVA E DEI RICORDI DEI PERSONAGGI GIOCANTI (PG) DEL PARTY.
2. L'EVOLUZIONE DELLE RELAZIONI INTER-PARTY (PG ↔ PG, fiducia tra compagni, legami, attriti o segreti scoperti).
3. L'EVOLUZIONE DELLE CREDENZE (Teorie passate verificate o smentite da nuove rivelazioni di Lore).
4. L'EVOLUZIONE DEI PNG E DELLE ENTITÀ DEL COMPENDIO (Memoria storica, relazioni, stato attuale).

DATA DI LORE DI RIFERIMENTO DELLA SESSIONE: "${session.loreDate || 'Data Attuale di Campagna'}"

ELENCO DEI MEMBRI DEL PARTY & PERSONAGGI (AVVENTURIERI DELLA CAMPAGNA):
${playersCatalog}

${orphanTags && orphanTags.length > 0 ? `ELENCO DEI PERSONAGGI/SOGGETTI NON ANCORA REGISTRATI (MANCANTI/ORFANI):
${orphanCatalog}
` : ''}

CATALOGO DELLE ENTITÀ DEL COMPENDIO REGISTRATE:
${entitiesCatalog}

REGOLE FONDAMENTALI DI ANALISI:
0. DIVIETO ASSOLUTO DI SOSTITUZIONE ARBITRARIA:
   - Non confondere PG diversi tra loro.
1. ANCORAGGIO ALLA DATA DI LORE:
   - Tutte le voci di memoria (timelineMemories) e credenze (evolvingBeliefs) DEVONO fare riferimento alla Data di Lore della sessione ("${session.loreDate || 'Data della sessione'}").
2. MEMORIA E CREDENZE DEI PG (playerProposals):
   - Per ciascun membro del gruppo presente nella sessione, genera:
     * timelineMemories: 1-2 ricordi significativi (svolte, traumi, scoperte, imprese, patti o segreti personali).
     * evolvingBeliefs: se il PG aveva una teoria o credenza e in questa sessione è stata confermata o smentita ('proven_fact', 'shattered_belief', 'active_theory', 'suspicion').
     * interPartyRelationUpdates: se sono cambiate la stima, la fiducia (1-10) o il rapporto con altri compagni del gruppo.
     * suggestedCurrentStatus: stato o riflessione attuale del PG dopo questa sessione.
3. MEMORIA E RELAZIONI DELLE ENTITÀ / PNG (detectedEntities):
   - Per i PNG/entità comparsi o rilevanti nella sessione:
     * suggestedCurrentStatus: cosa fa o dove si trova ora il PNG.
     * timelineMemories: 1 ricordo saliente per il PNG ancorato alla Data di Lore.
     * evolvingBeliefs: credenze o scoperte del PNG.
     * partyRelationUpdates: relazione con ciascun PG interagente.
       REGOLE MANDATORIE DI EVOLUZIONE & ATTRITO DEI RAPPORTI:
       - NON MANTENERE PASSIVAMENTE L'ATTEGGIAMENTO PRECEDENTE! Se nella sessione ci sono stati contrasti, bugie svelate, disobbedienze, litigi, traumi, fallimenti, segreti occultati o motivi di allontanamento tra un PG (es. Kaelen) e questo PNG (es. Insegnante, Mentore, Alleato, Autorità, "la Prof"), DEVI RETROCEDERE L'ATTEGGIAMENTO (es. da friendly a neutral, suspicious o hostile).
       - Compila SEMPRE "milestoneEvent" spiegando il fatto narrativo esatto accaduto in questa sessione (es. "Forte delusione per aver manomesso il tomo proibito; fiducia revocata").
       - Se invece c'è stato un riavvicinamento, riconoscenza o patto d'alleanza, aumenta l'atteggiamento (es. a helpful, friendly o devoted) con relativo "milestoneEvent".
     * entityRelationUpdates: relazioni con altre fazioni o PNG (con eventuale "milestoneEvent").
     * shouldAddSessionToMemory: true se il PNG era coinvolto.
     * suggestedNewKnowledge: nuovi fatti appresi.

Rispondi ESCLUSIVAMENTE in formato JSON valido conforme al seguente schema:
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
          "revealedLoreDate": "${session.loreDate || ''}"
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
          "milestoneEvent": "string",
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
          "milestoneEvent": "string",
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
          "milestoneEvent": "string",
          "reason": "string"
        }
      ],
      "shouldAddSessionToMemory": true,
      "suggestedNewKnowledge": "string"
    }
  ]
}`;

      function parseModelResponseToJson(text: string): any {
        if (!text || typeof text !== 'string') return null;
        let cleaned = text.trim();
        cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

        // 1. Direct JSON parse
        try {
          return JSON.parse(cleaned);
        } catch {}

        // 2. Extract first valid JSON object {...}
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            return JSON.parse(objMatch[0]);
          } catch {}
        }

        // 3. Extract first valid JSON array [...]
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try {
            return JSON.parse(arrMatch[0]);
          } catch {}
        }

        return null;
      }

      let parsedResult: any = null;
      let lastErrorMessage = '';

      // 1. Explicit OpenRouter Provider (No silent fallback to Gemini)
      if (provider === 'openrouter') {
        if (!openrouterApiKey) {
          return res.status(400).json({
            error: 'Chiave API OpenRouter non configurata. Inseriscila nelle Impostazioni per usare OpenRouter.',
          });
        }

        const requestedModel = sanitizeOpenRouterModelId(model || 'openrouter/free');
        try {
          console.log(`[Session Memory Sync] Richiesta OpenRouter con modello: ${requestedModel}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 85000);

          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openrouterApiKey}`,
              'HTTP-Referer': 'https://chronicle-dnd.local',
              'X-Title': 'Chronicle DnD Campaign Manager',
            },
            body: JSON.stringify({
              model: requestedModel,
              messages: [
                { role: 'system', content: `${systemInstruction}\n\nIMPORTANTE: Rispondi ESCLUSIVAMENTE con un blocco JSON valido e nient'altro.` },
                { role: 'user', content: `Analizza questa sessione ed aggiorna la memoria del mondo:\n\n${sessionText}` },
              ],
              temperature: 0.2,
            }),
          });
          clearTimeout(timeoutId);

          if (!orRes.ok) {
            const errBody = await orRes.text();
            console.warn(`[Session Memory Sync] OpenRouter errore HTTP ${orRes.status}:`, errBody.slice(0, 200));
            if (orRes.status === 429) {
              return res.status(429).json({
                error: `Il modello ${requestedModel} è temporaneamente saturo/rate-limited da OpenRouter (429 Too Many Requests). I nodi gratuiti sono condivisi a livello globale; prova tra qualche istante oppure seleziona un altro modello (es. Qwen 3.8 o Google Gemini).`,
              });
            }
            return res.status(orRes.status).json({
              error: `Errore OpenRouter (${requestedModel}): ${errBody.slice(0, 200)}`,
            });
          }

          const data = await orRes.json();
          const rawContent = data.choices?.[0]?.message?.content || '';
          if (rawContent) {
            parsedResult = parseModelResponseToJson(rawContent);
          }

          // MICRO-CHUNKING AGENTIC FALLBACK: If monolithic response was truncated or failed to parse JSON,
          // run focused micro-prompts per entity (Map-Reduce) to ensure free models succeed within token limits
          if (!parsedResult || !Array.isArray(parsedResult?.detectedEntities || parsedResult?.entities || (Array.isArray(parsedResult) ? parsedResult : null))) {
            console.log(`[Session Memory Sync] Monolithic parsing incomplete. Avvio Micro-Chunking (Map-Reduce) su tutte le entità con ${requestedModel}...`);
            const targetEntities = (entities as any[]).slice(0, 12);

            const chunkPromises = targetEntities.map(async (ent: any) => {
              try {
                const currentStatus = ent.aiConfig?.currentStatus || 'N/D';
                const partyRelSummary = ent.aiConfig?.partyRelations
                  ? Object.values(ent.aiConfig.partyRelations)
                      .map((r: any) => `${r.characterName || 'PG'}: ${r.attitude || 'neutral'}`)
                      .join(' | ')
                  : 'nessuna';

                const microPrompt = `Sei l'Archivista Arcano di D&D. In base alla cronaca della sessione, analizza l'entità "${ent.name}" (Tipo: ${ent.type}, ID: "${ent._id}").
Membri del Party: ${playersCatalog}
Stato attuale noto: "${currentStatus}"
Legami noti col party: "${partyRelSummary}"

Se l'entità NON ha alcun ruolo nella sessione (nemmeno citata), rispondi con: null
Se l'entità è presente o citata, rispondi ESCLUSIVAMENTE con questo blocco JSON:
{
  "entityId": "${ent._id}",
  "entityName": "${ent.name}",
  "entityType": "${ent.type}",
  "involvementType": "direct_participant",
  "reason": "Motivazione concisa del suo coinvolgimento",
  "suggestedCurrentStatus": "Cosa fa o dove si trova alla fine di questa sessione (1 frase)",
  "suggestedNewKnowledge": "Fatto o segreto emerso in questa sessione (1 frase, o stringa vuota)",
  "shouldAddSessionToMemory": true,
  "partyRelationUpdates": [
    {
      "characterName": "Nome del PG del party",
      "newAttitude": "friendly",
      "newRelationType": "Legame sintetico",
      "newNotes": "Cosa è accaduto tra loro"
    }
  ],
  "entityRelationUpdates": []
}

Cronaca della sessione:
${sessionText.slice(0, 8000)}`;

                const microRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${openrouterApiKey}`,
                    'HTTP-Referer': 'https://chronicle-dnd.local',
                    'X-Title': 'Chronicle DnD Campaign Manager',
                  },
                  body: JSON.stringify({
                    model: requestedModel,
                    messages: [{ role: 'user', content: microPrompt }],
                    temperature: 0.1,
                    max_tokens: 550,
                  }),
                });

                if (microRes.ok) {
                  const mData = await microRes.json();
                  const mContent = mData.choices?.[0]?.message?.content || '';
                  return parseModelResponseToJson(mContent);
                }
              } catch (chunkErr) {
                console.warn(`[Micro-Chunking] Entità ${ent.name} fallita:`, chunkErr);
              }
              return null;
            });

            const chunkResults = await Promise.allSettled(chunkPromises);
            const assembledEntities: any[] = [];
            chunkResults.forEach((r, rIdx) => {
              const ent = targetEntities[rIdx];
              if (r.status === 'fulfilled' && r.value) {
                const val = r.value;
                if (val && (val.entityId || val.entityName || val.name)) {
                  assembledEntities.push({
                    entityId: val.entityId || ent?._id || '',
                    entityName: val.entityName || val.name || ent?.name || '',
                    entityType: val.entityType || ent?.type || 'npc',
                    involvementType: val.involvementType || 'direct_participant',
                    reason: val.reason || 'Coinvolto nella sessione',
                    suggestedCurrentStatus: val.suggestedCurrentStatus || val.currentStatus || '',
                    suggestedNewKnowledge: val.suggestedNewKnowledge || val.newKnowledge || '',
                    shouldAddSessionToMemory: val.shouldAddSessionToMemory !== false,
                    partyRelationUpdates: Array.isArray(val.partyRelationUpdates) ? val.partyRelationUpdates : [],
                    entityRelationUpdates: Array.isArray(val.entityRelationUpdates) ? val.entityRelationUpdates : [],
                  });
                } else if (Array.isArray(val)) {
                  assembledEntities.push(...val);
                }
              }
            });

            if (assembledEntities.length > 0) {
              console.log(`[Micro-Chunking] Riassemblate con successo ${assembledEntities.length} entità!`);
              parsedResult = { detectedEntities: assembledEntities };
            }
          }
        } catch (orErr: any) {
          console.error('[Session Memory Sync] Errore OpenRouter:', orErr);
          const isTimeout = orErr?.name === 'AbortError' || String(orErr?.message).includes('aborted');
          return res.status(isTimeout ? 504 : 500).json({
            error: isTimeout
              ? `Il modello OpenRouter (${requestedModel}) ha impiegato troppo tempo a rispondere (timeout 85s). I server gratuiti possono avere code lunghe; prova un altro modello o Gemini Flash.`
              : `Errore chiamata OpenRouter: ${orErr?.message || orErr}`,
          });
        }
      } else {
        // 2. Explicit Gemini Provider
        if (apiKeysToTry.length === 0) {
          return res.status(400).json({
            error: 'Nessuna chiave API Gemini configurata.',
          });
        }

        const effectiveModel = (model && !model.includes('2.') ? model : 'gemini-3.8-flash') || 'gemini-3.8-flash';
        const candidateModels = [
          effectiveModel,
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
          'gemini-flash-latest',
          'gemini-3.1-pro-preview',
        ].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);

        for (const apiKey of apiKeysToTry) {
          if (parsedResult) break;
          const ai = new GoogleGenAI({ apiKey });

          for (const modelName of candidateModels) {
            try {
              console.log(`[Session Memory Sync] Tentativo con modello Gemini: ${modelName}`);
              const responsePromise = ai.models.generateContent({
                model: modelName,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `Analizza la cronaca della sessione e proponi gli aggiornamenti di memoria, stato e relazioni delle entità:\n\n${sessionText}`,
                      },
                    ],
                  },
                ],
                config: {
                  systemInstruction,
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                },
              });

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout tentativo modello ${modelName} (60s)`)), 60000)
              );

              const response: any = await Promise.race([responsePromise, timeoutPromise]);

              const rawText = response.text || '';
              if (rawText.trim()) {
                parsedResult = parseModelResponseToJson(rawText);
                if (parsedResult) break;
              }
            } catch (geminiErr: any) {
              const status = geminiErr?.status || geminiErr?.statusCode || 500;
              const msg = String(geminiErr?.message || geminiErr);
              lastErrorMessage = `Gemini (${modelName}): ${msg.slice(0, 150)}`;
              console.warn(`[Session Memory Sync] Modello ${modelName} fallito:`, msg.slice(0, 150));
            }
          }
        }
      }

      // Extract array of detected entities from whatever structure the model returned
      let rawDetectedList: any[] = [];
      if (Array.isArray(parsedResult)) {
        rawDetectedList = parsedResult;
      } else if (parsedResult && typeof parsedResult === 'object') {
        if (Array.isArray(parsedResult.detectedEntities)) {
          rawDetectedList = parsedResult.detectedEntities;
        } else if (Array.isArray(parsedResult.entities)) {
          rawDetectedList = parsedResult.entities;
        } else if (Array.isArray(parsedResult.detected_entities)) {
          rawDetectedList = parsedResult.detected_entities;
        } else if (Array.isArray(parsedResult.proposals)) {
          rawDetectedList = parsedResult.proposals;
        } else if (Array.isArray(parsedResult.characters)) {
          rawDetectedList = parsedResult.characters;
        } else if (Array.isArray(parsedResult.memoryUpdates)) {
          rawDetectedList = parsedResult.memoryUpdates;
        }
      }

      if (!rawDetectedList || rawDetectedList.length === 0) {
        return res.status(500).json({
          error: lastErrorMessage || 'Nessun aggiornamento di memoria estratto dal modello IA per questa sessione. Prova a rianalizzare o a selezionare un modello diverso.',
        });
      }

      // Build entity lookup map to attach previous values and validate IDs
      const entityMap = new Map<string, any>();
      (entities as any[]).forEach((ent) => {
        entityMap.set(ent._id, ent);
      });

      const playerMap = new Map<string, any>();
      (players as any[]).forEach((p) => {
        playerMap.set(p._id, p);
      });

      const sanitizedDetected = rawDetectedList
        .map((prop: any) => {
          // Resolve entity
          let matchedEnt = entityMap.get(prop.entityId);
          if (!matchedEnt && prop.entityName) {
            const nameLower = String(prop.entityName).toLowerCase().trim();
            matchedEnt = (entities as any[]).find(
              (e) =>
                e.name.toLowerCase().trim() === nameLower ||
                e.aliases?.some((a: string) => a.toLowerCase().trim() === nameLower) ||
                (nameLower.includes('prof') && (e.name.toLowerCase().includes('prof') || e.aliases?.some((a: string) => a.toLowerCase().includes('prof'))))
            );
          }

          if (!matchedEnt) return null;

          const existingAi = matchedEnt.aiConfig || {};

          // Sanitize party relation updates: STRICT MATCHING
          const partyUpdates: any[] = [];
          const extraEntityUpdates: any[] = [];

          (Array.isArray(prop.partyRelationUpdates) ? prop.partyRelationUpdates : []).forEach((pru: any) => {
            const reqCharName = String(pru.characterName || '').toLowerCase().trim();

            // Look for registered player whose characterName matches
            const matchedP = (players as any[]).find((p) => {
              const pName = String(p.characterName || '').toLowerCase().trim();
              return pName && (pName === reqCharName || pName.includes(reqCharName) || reqCharName.includes(pName));
            });

            const milestoneText = pru.milestoneEvent || pru.reason || pru.newNotes || '';

            if (matchedP) {
              const prevRel = existingAi.partyRelations?.[matchedP._id];
              partyUpdates.push({
                playerId: matchedP._id,
                characterName: matchedP.characterName,
                previousAttitude: prevRel?.attitude || 'neutral',
                newAttitude: pru.newAttitude || prevRel?.attitude || 'neutral',
                previousRelationType: prevRel?.relationType || '',
                newRelationType: pru.newRelationType || prevRel?.relationType || '',
                previousNotes: prevRel?.notes || '',
                newNotes: pru.newNotes || prevRel?.notes || '',
                milestoneEvent: milestoneText,
                reason: pru.reason || 'Aggiornamento sessione',
                applied: true,
              });
            } else {
              // Not a registered player! Check if it corresponds to another entity in the Codex
              const matchedTarget = (entities as any[]).find(
                (e) => e.name.toLowerCase().trim() === reqCharName || e.aliases?.some((a: string) => a.toLowerCase().trim() === reqCharName)
              );
              if (matchedTarget) {
                const prevRel = existingAi.entityRelations?.[matchedTarget._id];
                extraEntityUpdates.push({
                  targetEntityId: matchedTarget._id,
                  targetEntityName: matchedTarget.name,
                  targetEntityType: matchedTarget.type,
                  previousAttitude: prevRel?.attitude || 'neutral',
                  newAttitude: pru.newAttitude || prevRel?.attitude || 'neutral',
                  previousRelationType: prevRel?.relationType || '',
                  newRelationType: pru.newRelationType || prevRel?.relationType || '',
                  previousNotes: prevRel?.notes || '',
                  newNotes: pru.newNotes || prevRel?.notes || '',
                  milestoneEvent: milestoneText,
                  reason: pru.reason || `Aggiornamento verso ${matchedTarget.name}`,
                  applied: true,
                });
              } else {
                // Not in players, not in codex -> treat as unregistered player/character!
                partyUpdates.push({
                  playerId: 'unregistered',
                  characterName: pru.characterName || 'Personaggio Non Registrato',
                  previousAttitude: 'neutral',
                  newAttitude: pru.newAttitude || 'neutral',
                  previousRelationType: '',
                  newRelationType: pru.newRelationType || '',
                  previousNotes: '',
                  newNotes: pru.newNotes || '',
                  milestoneEvent: milestoneText,
                  reason: pru.reason || 'Aggiornamento per personaggio non registrato',
                  applied: false, // Don't auto-apply to db because ID is unregistered
                });
              }
            }
          });

          // Sanitize entity relation updates with before/after diffs
          const entityUpdates = [
            ...extraEntityUpdates,
            ...(Array.isArray(prop.entityRelationUpdates) ? prop.entityRelationUpdates : [])
              .map((eru: any) => {
                let matchedTarget = entityMap.get(eru.targetEntityId);
                if (!matchedTarget && eru.targetEntityName) {
                  const tNameLower = String(eru.targetEntityName).toLowerCase().trim();
                  matchedTarget = (entities as any[]).find(
                    (e) => e.name.toLowerCase().trim() === tNameLower || e.aliases?.some((a: string) => a.toLowerCase().trim() === tNameLower)
                  );
                }
                if (!matchedTarget) return null;

                const tId = matchedTarget._id;
                const prevRel = existingAi.entityRelations?.[tId];
                const milestoneText = eru.milestoneEvent || eru.reason || eru.newNotes || '';

                return {
                  targetEntityId: tId,
                  targetEntityName: matchedTarget.name,
                  targetEntityType: matchedTarget.type,
                  previousAttitude: prevRel?.attitude || 'neutral',
                  newAttitude: eru.newAttitude || prevRel?.attitude || 'neutral',
                  previousRelationType: prevRel?.relationType || '',
                  newRelationType: eru.newRelationType || prevRel?.relationType || '',
                  previousNotes: prevRel?.notes || '',
                  newNotes: eru.newNotes || prevRel?.notes || '',
                  milestoneEvent: milestoneText,
                  reason: eru.reason || 'Aggiornamento sessione',
                  applied: true,
                };
              })
              .filter(Boolean),
          ];

          const cleanStatusText = (str: string) => {
            return String(str || '')
              .toLowerCase()
              .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""'“’”]/g, "")
              .replace(/\s+/g, " ")
              .trim();
          };

          const isStatusChanged = !!prop.suggestedCurrentStatus && 
            (cleanStatusText(prop.suggestedCurrentStatus) !== cleanStatusText(existingAi.currentStatus || ''));

          const timelineMemories = (Array.isArray(prop.timelineMemories) ? prop.timelineMemories : []).map((m: any, mIdx: number) => ({
            id: m.id || `mem_ent_${session._id}_${matchedEnt._id}_${mIdx}_${Date.now()}`,
            sessionId: session._id,
            sessionNumber: session.number,
            sessionTitle: session.title,
            loreDate: m.loreDate || session.loreDate || session.date,
            category: m.category || 'event',
            title: m.title || `Memoria di ${matchedEnt.name}`,
            summary: m.summary || '',
            impact: m.impact || 'normal',
          }));

          const evolvingBeliefs = (Array.isArray(prop.evolvingBeliefs) ? prop.evolvingBeliefs : []).map((b: any, bIdx: number) => ({
            id: b.id || `bel_ent_${session._id}_${matchedEnt._id}_${bIdx}_${Date.now()}`,
            subject: b.subject || 'Soggetto di Lore',
            previousBelief: b.previousBelief || '',
            currentTruth: b.currentTruth || '',
            status: b.status || 'active_theory',
            revealedLoreDate: b.revealedLoreDate || session.loreDate || '',
            revealedInSessionId: session._id,
            revealedInSessionNumber: session.number,
          }));

          return {
            entityId: matchedEnt._id,
            entityName: matchedEnt.name,
            entityType: matchedEnt.type,
            involvementType: prop.involvementType || 'direct_participant',
            reason: prop.reason || 'Coinvolto negli eventi della sessione',
            currentStatusBefore: existingAi.currentStatus || '',
            suggestedCurrentStatus: prop.suggestedCurrentStatus || '',
            applyCurrentStatus: isStatusChanged,
            timelineMemories,
            applyTimelineMemories: timelineMemories.length > 0,
            evolvingBeliefs,
            applyEvolvingBeliefs: evolvingBeliefs.length > 0,
            partyRelationUpdates: partyUpdates,
            entityRelationUpdates: entityUpdates,
            shouldAddSessionToMemory: prop.shouldAddSessionToMemory !== false,
            applySessionToMemory: prop.shouldAddSessionToMemory !== false,
            suggestedNewKnowledge: prop.suggestedNewKnowledge || '',
            applyNewKnowledge: !!prop.suggestedNewKnowledge,
          };
        })
        .filter(Boolean);

      // Process Player Proposals
      const rawPlayersList = Array.isArray(parsedResult?.playerProposals)
        ? parsedResult.playerProposals
        : Array.isArray(parsedResult?.players)
        ? parsedResult.players
        : [];

      const sanitizedPlayers = rawPlayersList.map((pp: any, idx: number) => {
        const charName = String(pp.characterName || '').trim();
        const matchedP = (players as any[]).find((p) => {
          const pName = String(p.characterName || '').toLowerCase().trim();
          return pName && (pName === charName.toLowerCase() || pName.includes(charName.toLowerCase()) || charName.toLowerCase().includes(pName));
        });

        const pId = pp.playerId || matchedP?._id || `player_${idx}`;
        const finalCharName = matchedP?.characterName || charName || `Personaggio ${idx + 1}`;

        const timelineMemories = (Array.isArray(pp.timelineMemories) ? pp.timelineMemories : []).map((m: any, mIdx: number) => ({
          id: m.id || `mem_pg_${session._id}_${pId}_${mIdx}_${Date.now()}`,
          sessionId: session._id,
          sessionNumber: session.number,
          sessionTitle: session.title,
          loreDate: m.loreDate || session.loreDate || session.date,
          category: m.category || 'milestone',
          title: m.title || `Esperienza di ${finalCharName}`,
          summary: m.summary || '',
          impact: m.impact || 'normal',
        }));

        const evolvingBeliefs = (Array.isArray(pp.evolvingBeliefs) ? pp.evolvingBeliefs : []).map((b: any, bIdx: number) => ({
          id: b.id || `bel_pg_${session._id}_${pId}_${bIdx}_${Date.now()}`,
          subject: b.subject || 'Soggetto di Lore',
          previousBelief: b.previousBelief || '',
          currentTruth: b.currentTruth || '',
          status: b.status || 'active_theory',
          revealedLoreDate: b.revealedLoreDate || session.loreDate || '',
          revealedInSessionId: session._id,
          revealedInSessionNumber: session.number,
        }));

        const interPartyRelationUpdates = (Array.isArray(pp.interPartyRelationUpdates) ? pp.interPartyRelationUpdates : []).map((ru: any) => {
          const tName = String(ru.targetCharacterName || '').trim();
          const targetP = (players as any[]).find((p) => {
            const pName = String(p.characterName || '').toLowerCase().trim();
            return pName && (pName === tName.toLowerCase() || pName.includes(tName.toLowerCase()) || tName.toLowerCase().includes(pName));
          });

          return {
            targetPlayerId: targetP?._id || ru.targetPlayerId || 'unregistered',
            targetCharacterName: targetP?.characterName || tName || 'Compagno',
            previousAttitude: 'neutral',
            newAttitude: ru.newAttitude || 'neutral',
            previousRelationType: '',
            newRelationType: ru.newRelationType || '',
            previousTrust: 5,
            newTrust: typeof ru.newTrust === 'number' ? ru.newTrust : 5,
            notes: ru.notes || '',
            milestoneEvent: ru.milestoneEvent || ru.reason || '',
            reason: ru.reason || 'Evoluzione rapporto tra compagni',
            applied: true,
          };
        });

        return {
          playerId: pId,
          characterName: finalCharName,
          involvementType: pp.involvementType || 'direct_participant',
          reason: pp.reason || 'Presente agli eventi della sessione',
          currentStatusBefore: '',
          suggestedCurrentStatus: pp.suggestedCurrentStatus || '',
          applyCurrentStatus: !!pp.suggestedCurrentStatus,
          timelineMemories,
          applyTimelineMemories: timelineMemories.length > 0,
          evolvingBeliefs,
          applyEvolvingBeliefs: evolvingBeliefs.length > 0,
          interPartyRelationUpdates,
        };
      });

      return res.json({
        sessionId: session._id,
        sessionNumber: session.number,
        sessionTitle: session.title,
        loreDate: session.loreDate,
        detectedEntities: sanitizedDetected,
        playerProposals: sanitizedPlayers,
      });
    } catch (err: any) {
      console.error('Sync Session Memory API Fatal Error:', err);
      return res.status(500).json({ error: err.message || 'Errore durante la sincronizzazione della memoria.' });
    }
  };

  app.post('/api/sessions/sync-memory', handleSessionMemorySync);
  app.post('/api/ai/session-memory-sync', handleSessionMemorySync);

  // === WORLD LORE / KNOWLEDGE SCOMPOSE & ASSIGNMENT API ===
  app.post('/api/world-lore/analyze', async (req: any, res: any) => {
    try {
      const parseJsonFromText = (raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              return JSON.parse(match[0]);
            } catch {}
          }
          return null;
        }
      };

      const {
        rawText,
        partyMembers = [],
        entities = [],
        titleHint = '',
        categoryHint = '',
        customApiKey,
      } = req.body;

      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ error: 'Testo di lore o documento non fornito.' });
      }

      const customKey = (customApiKey || req.headers['x-custom-api-key'] as string)?.trim();
      const serverKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
      const openrouterApiKey = (
        req.headers['x-openrouter-key'] ||
        process.env.OPENROUTER_API_KEY ||
        process.env.VITE_OPENROUTER_API_KEY ||
        ''
      )?.trim();

      const apiKeysToTry: string[] = [];
      if (customKey) apiKeysToTry.push(customKey);
      if (serverKey && !apiKeysToTry.includes(serverKey)) apiKeysToTry.push(serverKey);

      const partySummary = (partyMembers as any[])
        .map((p: any) => {
          const bio = p.bio || {};
          return `- ID: "${p._id || p.id}", Nome: "${p.characterName || p.name}", Classe: "${bio.characterClass || p.characterClass || 'Avventuriero'}", Razza: "${bio.characterRace || p.characterRace || 'Umano'}", Deità/Patrono: "${bio.deityOrPatron || 'N/D'}", Città Natale/Origine: "${bio.hometown || 'N/D'}", Background/Storia: "${(bio.backstoryMarkdown || '').slice(0, 200)}"`;
        })
        .join('\n');

      const entitiesSummary = (entities as any[])
        .slice(0, 30)
        .map((e: any) => `- ID: "${e._id || e.id}", Nome: "${e.name}", Tipo: "${e.type}", Ruolo: "${e.role || 'N/D'}"`)
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
- "public": Sapere Popolare / Comune. Notizia o dogma noto a chiunque viva nel mondo.
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

TITOLO SUGGERITO (OPZIONALE): ${titleHint || 'N/D'}
CATEGORIA SUGGERITA (OPZIONALE): ${categoryHint || 'N/D'}

MEMBRI DEL PARTY ATTUALI:
${partySummary || 'Nessun PG fornito.'}

PNG & COMPENDIO RILEVANTI:
${entitiesSummary || 'Nessun PNG fornito.'}

TESTO DEL DOCUMENTO DA SCOMPORRE:
${rawText.slice(0, 20000)}
`;

      const candidateModels = Array.from(
        new Set([
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-flash-latest',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
        ])
      );

      let lastErrMsg = '';

      for (const apiKey of apiKeysToTry) {
        const ai = new GoogleGenAI({ apiKey });

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            });

            const rawResponseText = response.text || '';
            if (rawResponseText.trim()) {
              const parsed = parseJsonFromText(rawResponseText);
              if (parsed && parsed.title && Array.isArray(parsed.bites)) {
                return res.json({
                  success: true,
                  article: {
                    title: parsed.title,
                    subtitle: parsed.subtitle || '',
                    category: parsed.category || 'general',
                    summary: parsed.summary || '',
                    fullContentMarkdown: parsed.fullContentMarkdown || rawText,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                  },
                  bites: parsed.bites.map((b: any, idx: number) => ({
                    id: `bite_${Date.now()}_${idx + 1}`,
                    title: b.title || `Nozione ${idx + 1}`,
                    content: b.content || '',
                    level: ['public', 'specialized', 'esoteric', 'secret'].includes(b.level) ? b.level : 'public',
                    customTag: b.customTag || undefined,
                    suggestAllParty: Boolean(b.suggestAllParty || b.level === 'public'),
                    suggestedAssigneeIds: Array.isArray(b.suggestedAssigneeIds) ? b.suggestedAssigneeIds : [],
                    assignmentReason: b.assignmentReason || '',
                  })),
                  modelUsed: modelName,
                });
              }
            }
          } catch (geminiErr: any) {
            const status = geminiErr?.status || geminiErr?.statusCode || 500;
            const msg = String(geminiErr?.message || geminiErr);
            lastErrMsg = msg;
            console.warn(`[World Lore Analysis] Modello ${modelName} fallito (${status}): ${msg.slice(0, 150)}`);
          }
        }
      }

      // If Gemini fails and OpenRouter key is available, try OpenRouter fallback
      if (openrouterApiKey) {
        try {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openrouterApiKey}`,
              'HTTP-Referer': 'https://chronicle-dnd.app',
              'X-Title': 'Chronicle D&D',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.0-flash-001',
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.2,
              response_format: { type: 'json_object' },
            }),
          });

          if (openRouterRes.ok) {
            const openRouterData = await openRouterRes.json();
            const content = openRouterData?.choices?.[0]?.message?.content;
            if (content) {
              const parsed = parseJsonFromText(content);
              if (parsed && parsed.title && Array.isArray(parsed.bites)) {
                return res.json({
                  success: true,
                  article: {
                    title: parsed.title,
                    subtitle: parsed.subtitle || '',
                    category: parsed.category || 'general',
                    summary: parsed.summary || '',
                    fullContentMarkdown: parsed.fullContentMarkdown || rawText,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                  },
                  bites: parsed.bites.map((b: any, idx: number) => ({
                    id: `bite_${Date.now()}_${idx + 1}`,
                    title: b.title || `Nozione ${idx + 1}`,
                    content: b.content || '',
                    level: ['public', 'specialized', 'esoteric', 'secret'].includes(b.level) ? b.level : 'public',
                    customTag: b.customTag || undefined,
                    suggestAllParty: Boolean(b.suggestAllParty || b.level === 'public'),
                    suggestedAssigneeIds: Array.isArray(b.suggestedAssigneeIds) ? b.suggestedAssigneeIds : [],
                    assignmentReason: b.assignmentReason || '',
                  })),
                  modelUsed: 'openrouter',
                });
              }
            }
          }
        } catch (orErr: any) {
          console.warn('[World Lore OpenRouter Fallback Failed]:', orErr);
        }
      }

      return res.status(500).json({
        error: lastErrMsg || 'Impossibile analizzare il documento di lore con l\'IA al momento.',
      });
    } catch (err: any) {
      console.error('Analyze World Lore API Fatal Error:', err);
      return res.status(500).json({ error: err.message || 'Errore durante l\'analisi del documento di lore.' });
    }
  });

  // Helper to sanitize model IDs copied from OpenRouter website, URLs, or inputs
  function sanitizeOpenRouterModelId(input: any): string {
    if (!input || typeof input !== 'string') return 'openrouter/free';
    let cleaned = input.trim();
    // Strip markdown code backticks, quotes, brackets
    cleaned = cleaned.replace(/^[`"'\[{\(\s]+|[`"'\]}\)\s]+$/g, '').trim();
    // Strip full URLs or hostnames: https://openrouter.ai/models/... or openrouter.ai/...
    cleaned = cleaned.replace(/^https?:\/\/openrouter\.ai\/models\//i, '');
    cleaned = cleaned.replace(/^https?:\/\/openrouter\.ai\//i, '');
    cleaned = cleaned.replace(/^openrouter\.ai\/models\//i, '');
    cleaned = cleaned.replace(/^openrouter\.ai\//i, '');
    // Strip leading 'models/' or 'model:' or 'model='
    cleaned = cleaned.replace(/^models\//i, '');
    cleaned = cleaned.replace(/^model[:=]\s*/i, '');
    // Strip multiple leading or trailing slashes
    cleaned = cleaned.replace(/^\/+|\/+$/g, '').trim();
    return cleaned || 'openrouter/free';
  }

  // Cache for OpenRouter live models catalog
  let cachedOpenRouterModels: any[] = [];
  let lastOpenRouterFetchTime = 0;

  // Endpoint to get live models from OpenRouter
  app.get('/api/ai/openrouter/models', async (req: any, res: any) => {
    try {
      const now = Date.now();
      // Use cache for 10 minutes if available
      if (cachedOpenRouterModels.length > 0 && now - lastOpenRouterFetchTime < 10 * 60 * 1000) {
        return res.json({ models: cachedOpenRouterModels, cached: true });
      }

      const headers: Record<string, string> = {};
      const userKey =
        (req.query.key as string) ||
        (req.headers['x-openrouter-key'] as string) ||
        process.env.OPENROUTER_API_KEY ||
        '';
      if (userKey) {
        headers['Authorization'] = `Bearer ${userKey.trim()}`;
      }

      const orRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
      });

      if (!orRes.ok) {
        if (cachedOpenRouterModels.length > 0) {
          return res.json({ models: cachedOpenRouterModels, cached: true });
        }
        return res.status(orRes.status).json({ error: 'Impossibile recuperare i modelli da OpenRouter' });
      }

      const data = await orRes.json();
      const rawList = Array.isArray(data?.data) ? data.data : [];

      const models = rawList.map((m: any) => {
        const isFree =
          m.id.endsWith(':free') ||
          (Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0);
        return {
          id: m.id,
          name: m.name || m.id,
          description: m.description || '',
          contextLength: m.context_length || 0,
          isFree,
          pricing: m.pricing || {},
          architecture: m.architecture || {},
        };
      });

      if (models.length > 0) {
        cachedOpenRouterModels = models;
        lastOpenRouterFetchTime = now;
      }

      return res.json({ models, cached: false });
    } catch (err: any) {
      console.error('Error fetching OpenRouter models:', err);
      if (cachedOpenRouterModels.length > 0) {
        return res.json({ models: cachedOpenRouterModels, cached: true });
      }
      return res.status(500).json({ error: err.message || 'Errore nel recupero modelli' });
    }
  });

  // Endpoint to get live models dynamically from Cloudflare Workers AI
  app.get('/api/ai/cloudflare/models', async (req: any, res: any) => {
    try {
      const accountId =
        (req.query.account as string) ||
        (req.headers['x-cloudflare-account'] as string) ||
        process.env.CLOUDFLARE_ACCOUNT_ID ||
        '';

      const token =
        (req.query.token as string) ||
        (req.headers['x-cloudflare-token'] as string) ||
        process.env.CLOUDFLARE_API_TOKEN ||
        '';

      if (!accountId || !token) {
        return res.status(401).json({
          models: [],
          keyRequired: true,
          error: 'Inserisci il tuo Cloudflare Account ID e API Token nelle Impostazioni.',
        });
      }

      let cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?task=Text%20Generation`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      });

      let rawList: any[] = [];
      if (cfRes.ok) {
        const data = await cfRes.json().catch(() => ({}));
        rawList = Array.isArray(data?.result) ? data.result : Array.isArray(data?.data) ? data.data : [];
      } else {
        // Fallback without task filter
        const fallbackRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`, {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
          },
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json().catch(() => ({}));
          rawList = Array.isArray(data?.result) ? data.result : Array.isArray(data?.data) ? data.data : [];
        }
      }

      if (!cfRes.ok && rawList.length === 0) {
        const errText = await cfRes.text().catch(() => '');
        return res.status(cfRes.status || 500).json({
          models: [],
          error: `Impossibile recuperare i modelli da Cloudflare API (${cfRes.status}): ${errText.slice(0, 150)}`,
        });
      }

      const models = rawList
        .filter((m: any) => {
          const id = m.name || m.id || '';
          if (!id) return false;
          const idLower = String(id).toLowerCase();
          return !idLower.includes('whisper') && !idLower.includes('transcribe') && !idLower.includes('bge-') && !idLower.includes('stable-diffusion') && !idLower.includes('flux');
        })
        .map((m: any) => {
          const id = m.name || m.id;
          return {
            id,
            name: id,
            description: m.description || `Modello gratuito Cloudflare Workers AI (${m.task?.name || 'Text Generation'}).`,
            contextLength: m.properties?.context_window || 32768,
            isFree: true,
          };
        });

      return res.json({ models, cached: false });
    } catch (err: any) {
      console.error('Error fetching Cloudflare models:', err);
      return res.status(500).json({ models: [], error: err.message || 'Errore nel recupero modelli Cloudflare AI' });
    }
  });

  // Endpoint to validate Cloudflare credentials and detect if it is a Free or Paid account
  const validateCloudflareHandler = async (req: any, res: any) => {
    try {
      const { accountId, token } = req.body;
      const cleanAccountId = String(accountId || '').trim();
      const cleanToken = String(token || '').trim();

      if (!cleanAccountId || !cleanToken) {
        return res.status(400).json({ valid: false, error: 'Account ID e Token sono obbligatori per la verifica.' });
      }

      // 1. Verify credentials by calling Cloudflare Workers AI models search endpoint
      let isValid = false;
      let detailedError = '';
      let modelsCount = 0;

      let cfModelsRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/models/search?task=Text%20Generation`,
        {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
          },
        }
      );

      if (cfModelsRes.ok) {
        const data = await cfModelsRes.json().catch(() => ({}));
        if (data && data.success !== false) {
          isValid = true;
          const list = Array.isArray(data.result) ? data.result : Array.isArray(data.data) ? data.data : [];
          modelsCount = list.length;
        } else {
          detailedError = data.errors?.map((e: any) => e.message).join(', ') || 'Errore di risposta Cloudflare';
        }
      } else {
        // Try general search fallback without query
        const fallbackRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/models/search?per_page=5`,
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
            },
          }
        );

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json().catch(() => ({}));
          if (fbData && fbData.success !== false) {
            isValid = true;
            const list = Array.isArray(fbData.result) ? fbData.result : [];
            modelsCount = list.length;
          }
        }

        if (!isValid) {
          // Check token status via verify endpoint to provide precise diagnostics to user
          try {
            const tokenVerifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
              headers: {
                Authorization: `Bearer ${cleanToken}`,
              },
            });
            const tokenData = await tokenVerifyRes.json().catch(() => ({}));
            if (tokenVerifyRes.ok && tokenData?.result?.status === 'active') {
              detailedError = `API Token Cloudflare valido, ma non ha permessi o accesso all'Account ID "${cleanAccountId}". Assicurati che l'Account ID sia esatto e che il Token includa il permesso 'Workers AI: Read' o 'Workers AI: Edit' per tale account.`;
            } else {
              const errs = tokenData?.errors?.map((e: any) => e.message).join(', ');
              detailedError = `API Token Cloudflare non valido o scaduto${errs ? `: ${errs}` : ''} (HTTP ${cfModelsRes.status}).`;
            }
          } catch {
            const errText = await cfModelsRes.text().catch(() => '');
            detailedError = `Errore API Cloudflare (HTTP ${cfModelsRes.status}): ${errText.slice(0, 120)}`;
          }
        }
      }

      if (!isValid) {
        return res.json({ valid: false, plan: 'free', error: detailedError || 'Credenziali Cloudflare non valide o non autorizzate.' });
      }

      // 2. Try to fetch subscriptions to detect if they are on "workers_paid" plan
      let plan: 'free' | 'paid' = 'free';
      try {
        const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/subscriptions`, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
          },
        });
        if (subRes.ok) {
          const subData = await subRes.json().catch(() => ({}));
          const subs = subData?.result || [];
          const hasPaidPlan = subs.some((s: any) => {
            const subStr = JSON.stringify(s).toLowerCase();
            return (
              subStr.includes('workers_paid') ||
              subStr.includes('workers-paid') ||
              subStr.includes('paid-workers') ||
              s.id?.includes('paid') ||
              s.rate_plan?.id?.includes('paid')
            );
          });
          if (hasPaidPlan) {
            plan = 'paid';
          }
        } else {
          console.warn(`[Cloudflare Validation] Subscriptions returned ${subRes.status}`);
        }
      } catch (subErr) {
        console.warn('[Cloudflare Validation] Subscriptions call failed:', subErr);
      }

      return res.json({
        valid: true,
        plan,
        modelsCount,
        message: 'Credenziali Cloudflare verificate con successo.',
      });
    } catch (err: any) {
      console.error('[Cloudflare Validation Error]:', err);
      return res.status(500).json({ valid: false, error: err.message || 'Errore interno del server durante la verifica.' });
    }
  };

  app.post('/api/ai/cloudflare/validate', validateCloudflareHandler);
  app.post('/api/ai/cloudflare/validate-account', validateCloudflareHandler);

  // Endpoint to validate Google Gemini API key and return tier info
  app.post('/api/ai/gemini/validate', async (req: any, res: any) => {
    try {
      const apiKey = (req.body.apiKey || req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || '')?.trim();
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'Chiave API Gemini mancante o non fornita.' });
      }

      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!testRes.ok) {
        const errText = await testRes.text().catch(() => '');
        let detailedError = `Chiave Google Gemini non valida (HTTP ${testRes.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            detailedError = parsed.error.message;
          }
        } catch {}
        return res.json({ valid: false, error: detailedError });
      }

      const data = await testRes.json().catch(() => ({}));
      const models = data?.models || [];
      const hasPro = models.some((m: any) => m.name?.includes('pro'));

      return res.json({
        valid: true,
        tier: hasPro ? 'Standard AI Studio (Free / Pay-as-you-go)' : 'Quota Standard Google AI Studio',
        modelsCount: models.length,
      });
    } catch (err: any) {
      console.error('[Gemini Validation Error]:', err);
      return res.status(500).json({ valid: false, error: err?.message || 'Errore di connessione con Google Gemini.' });
    }
  });

  // Endpoint to validate OpenRouter API key and return tier / credit info
  app.post('/api/ai/openrouter/validate', async (req: any, res: any) => {
    try {
      const apiKey = (req.body.apiKey || req.headers['x-openrouter-key'] || process.env.OPENROUTER_API_KEY || '')?.trim();
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'Chiave API OpenRouter mancante o non fornita.' });
      }

      const testRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://chronicle-dnd.local',
          'X-Title': 'Chronicle D&D',
        },
      });

      if (!testRes.ok) {
        const errText = await testRes.text().catch(() => '');
        let detailedError = `Chiave OpenRouter non valida (HTTP ${testRes.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            detailedError = parsed.error.message;
          }
        } catch {}
        return res.json({ valid: false, error: detailedError });
      }

      const data = await testRes.json().catch(() => ({}));
      const keyData = data?.data || {};
      const isFreeTier = Boolean(keyData.is_free_tier);
      const usage = typeof keyData.usage === 'number' ? keyData.usage : 0;
      const limit = typeof keyData.limit === 'number' ? keyData.limit : null;

      let tier = isFreeTier ? 'Tier Gratuito (Modelli con suffisso :free)' : 'Tier con Credito / Paid';
      if (!isFreeTier && limit !== null) {
        tier += ` (Spesa: $${usage.toFixed(2)} / Limite: $${limit.toFixed(2)})`;
      } else if (!isFreeTier) {
        tier += ` (Spesa totale: $${usage.toFixed(2)})`;
      }

      return res.json({
        valid: true,
        tier,
        isFreeTier,
        usage,
        limit,
        label: keyData.label || 'Chiave OpenRouter',
        rateLimit: keyData.rate_limit,
      });
    } catch (err: any) {
      console.error('[OpenRouter Validation Error]:', err);
      return res.status(500).json({ valid: false, error: err?.message || 'Errore di connessione con OpenRouter.' });
    }
  });

  // Endpoint to get dynamic live models from Gemini
  app.get('/api/ai/gemini/models', async (req: any, res: any) => {
    try {
      const customKey = (req.query.key as string) || (req.headers['x-custom-api-key'] as string) || '';
      const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

      if (!apiKey) {
        return res.json({
          models: [
            { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Veloce / Consigliato)' },
            { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
            { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
          ],
        });
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const modelPager = await ai.models.list();
      const rawList: any[] = [];
      for await (const m of modelPager) {
        rawList.push(m);
      }

      const validModels = rawList
        .filter((m: any) => {
          const id = (m.name || m.id || '').replace(/^models\//, '');
          if (id.includes('embed') || id.includes('image') || id.includes('tts') || id.includes('transcribe') || id.includes('veo') || id.includes('lyria')) {
            return false;
          }
          if (id.includes('2.0') || id.includes('2.5') || id.includes('1.5')) {
            return false; // Exclude deprecated models
          }
          return id.includes('flash') || id.includes('pro') || id.includes('gemini');
        })
        .map((m: any) => {
          const cleanId = (m.name || m.id || '').replace(/^models\//, '');
          return {
            id: cleanId,
            name: m.displayName || cleanId,
            description: m.description || '',
          };
        });

      if (validModels.length > 0) {
        return res.json({ models: validModels });
      }

      return res.json({
        models: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Veloce / Consigliato)' },
          { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
          { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
        ],
      });
    } catch (err: any) {
      console.warn('[Gemini Models API Error]:', err?.message || err);
      return res.json({
        models: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Veloce / Consigliato)' },
          { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
          { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
        ],
      });
    }
  });

  // Oracle Agent Endpoint: Google Gemini, Groq & OpenRouter
  app.post('/api/ai/oracle', async (req: any, res: any) => {
    try {
      const {
        provider = 'gemini',
        model,
        systemInstruction,
        messages,
        maxTokens,
        geminiApiKey: reqGeminiKey,
        openrouterApiKey: reqOpenRouterKey,
        cloudflareAccountId: reqCloudflareAccount,
        cloudflareApiToken: reqCloudflareToken,
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Nessun messaggio fornito per l\'Oracolo.' });
      }

      const requestedMaxTokens = typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 4096;

      // ==========================================
      // 1. CLOUDFLARE WORKERS AI PROVIDER (100% Free)
      // ==========================================
      if (provider === 'cloudflare') {
        const cloudflareAccountId = (
          reqCloudflareAccount ||
          req.body.cloudflareAccountId ||
          req.headers['x-cloudflare-account'] ||
          process.env.CLOUDFLARE_ACCOUNT_ID ||
          ''
        )?.trim();

        const cloudflareApiToken = (
          reqCloudflareToken ||
          req.body.cloudflareApiToken ||
          req.headers['x-cloudflare-token'] ||
          process.env.CLOUDFLARE_API_TOKEN ||
          ''
        )?.trim();

        if (!cloudflareAccountId || !cloudflareApiToken) {
          return res.status(400).json({
            error:
              'Account ID o API Token Cloudflare non configurati. Inseriscili nelle Impostazioni per consultare l\'Oracolo tramite Cloudflare Workers AI.',
            errorTitle: 'Credenziali Cloudflare Mancanti',
            errorType: 'auth',
            suggestedAction: 'Apri le Impostazioni e inserisci il tuo Account ID e API Token di Cloudflare Workers AI.',
            canRetry: false,
            provider: 'cloudflare',
          });
        }

        const requestedModel = (model && typeof model === 'string' && model.trim())
          ? model.trim()
          : '@cf/meta/llama-3.3-70b-instruct-fp8';

        const cfMessages = [
          ...(systemInstruction && typeof systemInstruction === 'string'
            ? [{ role: 'system', content: systemInstruction }]
            : []),
          ...messages
            .filter((m: any) => String(m.content || '').trim().length > 0)
            .map((m: any) => ({
              role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
              content: String(m.content || '').trim(),
            })),
        ];

        console.log(`[Oracle Cloudflare] Querying model: ${requestedModel} (max_tokens: ${requestedMaxTokens})`);

        try {
          let resCF = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cloudflareApiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: requestedModel,
              messages: cfMessages,
              temperature: 0.6,
              max_tokens: requestedMaxTokens,
            }),
          });

          let data = await resCF.json().catch(() => ({}));

          if (!resCF.ok) {
            console.log(`[Oracle Cloudflare] Chat completion failed (${resCF.status}), trying direct run endpoint for ${requestedModel}`);
            resCF = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/${requestedModel}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${cloudflareApiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: cfMessages,
                max_tokens: requestedMaxTokens,
              }),
            });
            data = await resCF.json().catch(() => ({}));
          }

          const isCFSuccess = data?.success !== false;
          let answer = data?.choices?.[0]?.message?.content || data?.result?.response || data?.result?.description || data?.result || '';
          if (typeof answer === 'object' && answer !== null) {
            answer = answer.response || answer.text || JSON.stringify(answer);
          }

          if (!resCF.ok || !answer || !isCFSuccess) {
            let errMsg = '';
            if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
              errMsg = data.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ');
            } else if (data?.error?.message) {
              errMsg = data.error.message;
            } else if (typeof data?.error === 'string') {
              errMsg = data.error;
            } else if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
              errMsg = data.messages.map((m: any) => m.message || JSON.stringify(m)).join(', ');
            } else {
              errMsg = `HTTP ${resCF.status}`;
            }
            
            const errLower = String(errMsg).toLowerCase();
            const isAuthErr = resCF.status === 401 || errLower.includes('key') || errLower.includes('token') || errLower.includes('unauthorized');

            console.error(`[Oracle Cloudflare Error] Model ${requestedModel} failed (${resCF.status}):`, errMsg);

            return res.status(resCF.status || 500).json({
              error: errMsg || `Errore dalla richiesta Cloudflare AI per il modello ${requestedModel}.`,
              errorTitle: isAuthErr ? 'Credenziali Cloudflare Non Valide (401)' : 'Errore Provider Cloudflare AI',
              errorType: isAuthErr ? 'auth' : 'generic',
              suggestedAction: isAuthErr
                ? 'Verifica il tuo Account ID e API Token su dash.cloudflare.com.'
                : 'Seleziona un altro modello dal catalogo Cloudflare o riprova tra qualche secondo.',
              canRetry: !isAuthErr,
              provider: 'cloudflare',
              model: requestedModel,
            });
          }

          let thought = '';
          const thoughtMatch = String(answer).match(/<(?:think|reasoning|riflessione|thought|pensiero)>([\s\S]*?)<\/(?:think|reasoning|riflessione|thought|pensiero)>/i);
          if (thoughtMatch) {
            thought = thoughtMatch[1].trim();
          }

          answer = String(answer)
            .replace(/<(?:think|reasoning|riflessione|thought|pensiero)>[\s\S]*?<\/(?:think|reasoning|riflessione|thought|pensiero)>/gi, '')
            .replace(/^Thinking Process:[\s\S]*?\n\n/gi, '')
            .replace(/^Thought:[\s\S]*?\n\n/gi, '')
            .replace(/^\[Thinking[\s\S]*?\]\n\n/gi, '')
            .trim();

          return res.json({
            answer,
            thought: thought || undefined,
            modelUsed: `Cloudflare AI (${requestedModel})`,
            engine: 'cloudflare',
          });
        } catch (err: any) {
          console.error(`[Oracle Cloudflare Exception] Model ${requestedModel}:`, err?.message || err);
          return res.status(500).json({
            error: err?.message || `Eccezione durante la chiamata a Cloudflare Workers AI per il modello ${requestedModel}.`,
            errorTitle: 'Errore Connessione Cloudflare',
            errorType: 'generic',
            suggestedAction: 'Riprova tra qualche istante o seleziona un altro modello.',
            canRetry: true,
            provider: 'cloudflare',
            model: requestedModel,
          });
        }
      }

      // ==========================================
      // 1. OPENROUTER PROVIDER
      // ==========================================
      if (provider === 'openrouter') {
        const openrouterApiKey = (
          reqOpenRouterKey ||
          req.headers['x-openrouter-key'] ||
          process.env.OPENROUTER_API_KEY ||
          ''
        )?.trim();

        if (!openrouterApiKey) {
          return res.status(400).json({
            error:
              'Chiave API OpenRouter non configurata. Inseriscila nelle Impostazioni per consultare l\'Oracolo tramite OpenRouter.',
            errorTitle: 'Chiave OpenRouter Mancante',
            errorType: 'auth',
            suggestedAction: 'Apri le Impostazioni e inserisci la tua chiave OpenRouter (openrouter.ai/keys).',
            canRetry: false,
            provider: 'openrouter',
          });
        }

        const requestedModel = sanitizeOpenRouterModelId(model);

        const openRouterMessages = [
          ...(systemInstruction && typeof systemInstruction === 'string'
            ? [{ role: 'system', content: systemInstruction }]
            : []),
          ...messages
            .filter((m: any) => String(m.content || '').trim().length > 0)
            .map((m: any) => ({
              role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
              content: String(m.content || '').trim(),
            })),
        ];

        console.log(`[Oracle] Querying OpenRouter model: ${requestedModel} (max_tokens: ${requestedMaxTokens})`);

        const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': 'https://chronicle-dnd.local',
            'X-Title': 'Chronicle D&D',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: openRouterMessages,
            temperature: 0.6,
            max_tokens: requestedMaxTokens,
          }),
        });

        let openRouterData: any = {};
        try {
          openRouterData = await openRouterRes.json();
        } catch {
          openRouterData = {};
        }

        if (!openRouterRes.ok) {
          console.error('[Oracle OpenRouter Error Body]:', openRouterData);
          let rawErr = '';
          if (typeof openRouterData?.error === 'string') {
            rawErr = openRouterData.error;
          } else if (openRouterData?.error?.message) {
            rawErr = openRouterData.error.message;
          } else if (openRouterData?.message) {
            rawErr = openRouterData.message;
          } else if (openRouterData?.error) {
            rawErr = JSON.stringify(openRouterData.error);
          } else {
            rawErr = `Errore OpenRouter (${openRouterRes.status})`;
          }

          const lower = String(rawErr).toLowerCase();

          let errorType: 'overloaded' | 'quota' | 'context_length' | 'auth' | 'safety' | 'generic' = 'generic';
          let errorTitle = 'Errore OpenRouter';
          let errorExplanation = String(rawErr);
          let suggestedAction = 'Verifica il Model ID o seleziona un modello dal catalogo OpenRouter.';
          let canRetry = true;
          let statusCode = openRouterRes.status || 500;

          if (statusCode === 401 || lower.includes('key') || lower.includes('auth') || lower.includes('unauthorized')) {
            statusCode = 401;
            errorType = 'auth';
            errorTitle = 'Chiave API OpenRouter Non Valida (401)';
            errorExplanation = `Dettaglio OpenRouter: ${rawErr}`;
            suggestedAction = 'Vai nelle Impostazioni e inserisci una chiave valida generata su openrouter.ai/keys.';
            canRetry = false;
          } else if (statusCode === 402 || lower.includes('insufficient') || lower.includes('credit')) {
            statusCode = 402;
            errorType = 'quota';
            errorTitle = 'Credito Insufficiente su OpenRouter (402)';
            errorExplanation = `Dettaglio OpenRouter: ${rawErr}`;
            suggestedAction = 'Ricarica il tuo saldo su openrouter.ai/credits oppure scegli uno dei modelli gratuiti con suffisso :free.';
            canRetry = false;
          } else if (statusCode === 429 || lower.includes('rate limit') || lower.includes('quota') || lower.includes('free limit')) {
            statusCode = 429;
            errorType = 'quota';
            errorTitle = 'Limite Concorrenza / Rate Limit OpenRouter (429)';
            errorExplanation = `Dettaglio OpenRouter: ${rawErr}`;
            suggestedAction = requestedModel.endsWith(':free')
              ? 'I modelli con suffisso ":free" condividono code pubbliche globali. Se hai credito OpenRouter, prova a usare il modello senza suffisso ":free" per avere priorità immediata.'
              : 'È stato raggiunto il limite di richieste al minuto. Attendi qualche secondo e riprova.';
            canRetry = true;
          } else if (statusCode === 404 || lower.includes('not found') || lower.includes('does not exist') || lower.includes('no available provider') || lower.includes('no endpoints')) {
            statusCode = 404;
            errorType = 'generic';
            errorTitle = `Modello "${requestedModel}" Non Trovato o Non Disponibile`;
            errorExplanation = `Dettaglio OpenRouter: ${rawErr}`;
            suggestedAction = requestedModel.endsWith(':free')
              ? `Il provider gratuito per "${requestedModel}" potrebbe essere momentaneamente offline. Prova un altro modello dal catalogo.`
              : `Il Model ID "${requestedModel}" non è stato trovato su OpenRouter. Verifica il nome esatto su openrouter.ai/models.`;
            canRetry = false;
          } else if (lower.includes('context') || lower.includes('token') || lower.includes('too large')) {
            statusCode = 400;
            errorType = 'context_length';
            errorTitle = 'Limite di Contesto Superato';
            errorExplanation = `Dettaglio OpenRouter: ${rawErr}`;
            suggestedAction = 'Azzera la cronologia della chat per ripartire con un contesto pulito.';
            canRetry = false;
          }

          return res.status(statusCode).json({
            error: errorExplanation,
            errorTitle,
            errorType,
            suggestedAction,
            canRetry,
            provider: 'openrouter',
            model: requestedModel,
          });
        }

        // Check if there is an error embedded in a 200 OK response
        if (openRouterData?.error) {
          const errMsg = openRouterData.error?.message || JSON.stringify(openRouterData.error);
          return res.status(500).json({
            error: `Errore OpenRouter: ${errMsg}`,
            errorTitle: 'Errore Risposta OpenRouter',
            errorType: 'generic',
            suggestedAction: 'Riprova a porre il quesito o seleziona un altro modello dal catalogo.',
            canRetry: true,
            provider: 'openrouter',
            model: requestedModel,
          });
        }

        // Comprehensive response extraction (handles string, array of parts)
        let answer = '';
        const firstChoice = openRouterData?.choices?.[0];

        if (typeof firstChoice?.message?.content === 'string' && firstChoice.message.content.trim()) {
          answer = firstChoice.message.content.trim();
        } else if (Array.isArray(firstChoice?.message?.content)) {
          answer = firstChoice.message.content
            .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
            .filter(Boolean)
            .join('\n')
            .trim();
        } else if (typeof firstChoice?.text === 'string' && firstChoice.text.trim()) {
          answer = firstChoice.text.trim();
        }

        // Extract internal thought/reasoning tags BEFORE stripping them (<think>...</think>, <reasoning>...</reasoning>, <thought>...</thought>, etc.)
        let thought = '';
        const thoughtMatch = answer.match(/<(?:think|reasoning|riflessione|thought|pensiero)>([\s\S]*?)<\/(?:think|reasoning|riflessione|thought|pensiero)>/i);
        if (thoughtMatch) {
          thought = thoughtMatch[1].trim();
        }

        // Clean out internal thought/reasoning tags
        answer = answer
          .replace(/<(?:think|reasoning|riflessione|thought|pensiero)>[\s\S]*?<\/(?:think|reasoning|riflessione|thought|pensiero)>/gi, '')
          .replace(/^Thinking Process:[\s\S]*?\n\n/gi, '')
          .replace(/^Thought:[\s\S]*?\n\n/gi, '')
          .replace(/^\[Thinking[\s\S]*?\]\n\n/gi, '')
          .trim();

        // Strip OpenRouter reasoning leakage (e.g., "We need to respond as...", "The user asks:", etc.)
        if (/We need to|The user asks:|So we need to answer|According to the provided records/i.test(answer)) {
          const paragraphs = answer.split(/\n\s*\n/);
          const cleanParagraphs = paragraphs.filter((p) => {
            const trimmed = p.trim();
            return !/^(We need to|The user asks|According to the|There's no direct|So we should|We must not|We should also|Use dialect|Use "Maremma|For Willow|So we could say|We can add a small|We must not list|We need to follow|We need to keep|We should also ask|Use "Per|Use "Bada|Use "Stai|Use "Che|Use "Sie|Use "noi|Use "Te|Use "i'|Use "a'|Use "de'|Use "su'|Use "ne'|Use "co'|Use "da'|Use "di'|Use "ni')/i.test(trimmed);
          });
          if (cleanParagraphs.length > 0) {
            answer = cleanParagraphs.join('\n\n').trim();
          }
        }

        if (!answer.trim()) {
          console.warn('[Oracle OpenRouter Empty Response]:', JSON.stringify(openRouterData));
          return res.status(500).json({
            error: 'Il modello OpenRouter selezionato ha completato la richiesta senza generare testo.',
            errorTitle: 'Risposta Vuota dal Modello',
            errorType: 'generic',
            suggestedAction: 'Questo modello specifico potrebbe essere temporaneamente muto o saturo. Prova a selezionare un altro modello gratuito dal catalogo (es. openrouter/free o qwen/qwen3.8-27b:free).',
            canRetry: true,
            provider: 'openrouter',
            model: requestedModel,
          });
        }

        return res.json({
          answer,
          thought: thought || undefined,
          modelUsed: `OpenRouter (${requestedModel})`,
          engine: 'openrouter',
        });
      }

      // ==========================================
      // 2. GOOGLE GEMINI PROVIDER
      // ==========================================
      const geminiApiKey = (
        reqGeminiKey ||
        req.headers['x-gemini-key'] ||
        process.env.GEMINI_API_KEY ||
        ''
      )?.trim();

      if (!geminiApiKey) {
        return res.status(400).json({
          error:
            'Chiave API Google Gemini non configurata. Inseriscila nelle Impostazioni per consultare l\'Oracolo.',
          errorTitle: 'Chiave API Mancante',
          errorType: 'auth',
          suggestedAction: 'Apri le Impostazioni e inserisci una chiave API Gemini valida da aistudio.google.com/apikey.',
          canRetry: false,
          provider: 'gemini',
        });
      }

      const requestedModel =
        model && typeof model === 'string' && model.trim()
          ? model.trim()
          : 'gemini-3.8-flash';

      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey: geminiApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        // Convert chat messages to Gemini contents structure (filter empty texts)
        const formattedContents = messages
          .filter((m: any) => String(m.content || '').trim().length > 0)
          .map((m: any) => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(m.content || '').trim() }],
          }));

        if (formattedContents.length === 0) {
          return res.status(400).json({ error: 'Nessun messaggio valido fornito per l\'Oracolo.' });
        }

        const config: any = {
          temperature: 0.6,
          maxOutputTokens: requestedMaxTokens,
        };
        if (systemInstruction && typeof systemInstruction === 'string') {
          config.systemInstruction = systemInstruction;
        }

        let response: any = null;
        const targetModel = requestedModel;

        try {
          console.log(`[Oracle] Querying Gemini model: ${targetModel}`);
          response = await ai.models.generateContent({
            model: targetModel,
            contents: formattedContents,
            config,
          });
        } catch (err: any) {
          const status = err?.status || err?.statusCode || 500;
          const msg = String(err?.message || err);
          const lowerMsg = msg.toLowerCase();

          console.warn(`[Oracle Error] Model ${targetModel} failed (${status}): ${msg}`);

          if (lowerMsg.includes('api_key_invalid') || lowerMsg.includes('401') || lowerMsg.includes('key not valid')) {
            return res.status(401).json({
              error: 'La chiave API Google Gemini inserita non è valida o è stata revocata.',
              errorTitle: 'Chiave Non Valida (401)',
              errorType: 'auth',
              suggestedAction: 'Verifica la tua chiave API nelle Impostazioni.',
              canRetry: false,
              provider: 'gemini',
              model: targetModel,
            });
          }

          if (status === 429 || lowerMsg.includes('429') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('quota')) {
            const delayMatch = msg.match(/retry in ([\d.]+)s/i);
            const secs = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 30;
            return res.status(429).json({
              error: `Limite di frequenza o quota gratuita superato per il modello "${targetModel}" (HTTP 429). Attendi circa ${secs} secondi oppure seleziona un altro modello nel selettore in alto.`,
              errorTitle: 'Quota temporaneamente esaurita (429)',
              errorType: 'quota',
              suggestedAction: `Attendi circa ${secs}s prima di inviare un nuovo messaggio oppure cambia modello dal selettore.`,
              canRetry: true,
              provider: 'gemini',
              model: targetModel,
            });
          }

          if (status === 503 || lowerMsg.includes('503') || lowerMsg.includes('overloaded') || lowerMsg.includes('unavailable')) {
            return res.status(503).json({
              error: `I server Google Gemini per il modello "${targetModel}" sono temporaneamente sovraccarichi (503).`,
              errorTitle: 'Servizio Temporaneamente Sovraccarico',
              errorType: 'generic',
              suggestedAction: 'Riprova tra qualche istante o seleziona un altro modello dal selettore.',
              canRetry: true,
              provider: 'gemini',
              model: targetModel,
            });
          }

          return res.status(status).json({
            error: `Errore dal modello Google Gemini (${targetModel}): ${msg}`,
            errorTitle: `Errore Modello ${targetModel}`,
            errorType: 'generic',
            suggestedAction: 'Seleziona un altro modello dal selettore o riprova.',
            canRetry: true,
            provider: 'gemini',
            model: targetModel,
          });
        }

        if (!response || (!response.text && !response.candidates?.[0])) {
          return res.status(500).json({
            error: `Nessuna risposta generata dal modello Google Gemini (${targetModel}).`,
            errorTitle: 'Risposta Vuota',
            errorType: 'generic',
            suggestedAction: 'Riprova o seleziona un altro modello dal selettore.',
            canRetry: true,
            provider: 'gemini',
            model: targetModel,
          });
        }

        let answer = response.text || '';
        let thought = '';
        const thoughtMatch = answer.match(/<(?:riflessione|thought|pensiero)>([\s\S]*?)<\/(?:riflessione|thought|pensiero)>/i);
        if (thoughtMatch) {
          thought = thoughtMatch[1].trim();
          answer = answer.replace(/<(?:riflessione|thought|pensiero)>[\s\S]*?<\/(?:riflessione|thought|pensiero)>/gi, '').trim();
        }

        return res.json({
          answer,
          thought: thought || undefined,
          modelUsed: `Google Gemini (${targetModel})`,
          engine: 'gemini',
        });
      } catch (geminiErr: any) {
        console.error('[Oracle Gemini Error]:', geminiErr);
        const rawErr = geminiErr?.message || String(geminiErr);
        const lower = rawErr.toLowerCase();

        let errorType: 'overloaded' | 'quota' | 'context_length' | 'auth' | 'safety' | 'generic' = 'generic';
        let errorTitle = 'Errore Google Gemini';
        let errorExplanation = rawErr;
        let suggestedAction = 'Riprova tra qualche istante o verifica la configurazione.';
        let canRetry = true;
        let statusCode = geminiErr?.status || geminiErr?.statusCode || 500;

        if (
          lower.includes('503') ||
          lower.includes('unavailable') ||
          lower.includes('high demand') ||
          lower.includes('overloaded') ||
          lower.includes('try again later') ||
          lower.includes('temporarily unavailable') ||
          lower.includes('capacity')
        ) {
          statusCode = 503;
          errorType = 'overloaded';
          errorTitle = 'Server Google Gemini Temporaneamente Sovraccarichi';
          errorExplanation =
            'I server di Google Gemini stanno gestendo un picco globale di traffico (errore 503 / High Demand) e hanno temporaneamente esaurito la capacità istantanea. Non dipende dalla tua campagna: è una congestione momentanea dei server di Google.';
          suggestedAction =
            'Attendi circa 5-10 secondi e clicca "Riprova". Il sistema proverà automaticamente anche i modelli alternativi.';
          canRetry = true;
        } else if (
          lower.includes('not found') ||
          lower.includes('404') ||
          lower.includes('is not supported') ||
          lower.includes('unsupported model') ||
          lower.includes('invalid model')
        ) {
          statusCode = 404;
          errorType = 'generic';
          errorTitle = `Modello Gemini "${requestedModel}" Non Disponibile`;
          errorExplanation = `Il modello "${requestedModel}" non è stato trovato o non è supportato dall'API per la tua chiave. Puoi provare con "gemini-3.7-flash", "gemini-3.8-flash" o "gemini-3.1-flash-lite".`;
          suggestedAction = 'Seleziona un modello attivo dal menu a tendina o inserisci un identificatore valido.';
          canRetry = false;
        } else if (
          lower.includes('429') ||
          lower.includes('resource_exhausted') ||
          lower.includes('quota') ||
          lower.includes('rate limit')
        ) {
          statusCode = 429;
          errorType = 'quota';
          errorTitle = 'Limite di Quota o Frequenza Raggiunto';
          errorExplanation =
            'È stato superato il limite di richieste al minuto (RPM) o la quota gratuita per la tua chiave API Google Gemini.';
          suggestedAction =
            'Attendi 20-30 secondi prima di inviare un nuovo quesito.';
          canRetry = true;
        } else if (
          lower.includes('context') ||
          lower.includes('token') ||
          lower.includes('too large') ||
          lower.includes('exceeded')
        ) {
          statusCode = 400;
          errorType = 'context_length';
          errorTitle = 'Volume di Memorie Superiore alla Finestra di Contesto';
          errorExplanation =
            'La conversazione e le memorie storiche inviate superano la capacità di ricezione del modello.';
          suggestedAction =
            'Azzera la cronologia della conversazione con l\'icona cestino per ripartire con una sessione pulita.';
          canRetry = false;
        } else if (
          lower.includes('api_key_invalid') ||
          lower.includes('api key not valid') ||
          lower.includes('unauthenticated') ||
          lower.includes('permission') ||
          lower.includes('401') ||
          lower.includes('403')
        ) {
          statusCode = 401;
          errorType = 'auth';
          errorTitle = 'Chiave API Google Gemini Non Valida o Scaduta';
          errorExplanation =
            'La chiave API di Google Gemini configurata non è valida o non dispone dei permessi necessari per invocare il modello.';
          suggestedAction =
            'Apri le Impostazioni dell\'applicazione e inserisci una chiave API Google Gemini valida (aistudio.google.com/apikey).';
          canRetry = false;
        } else if (
          lower.includes('safety') ||
          lower.includes('blocked') ||
          lower.includes('filter') ||
          lower.includes('harm')
        ) {
          statusCode = 400;
          errorType = 'safety';
          errorTitle = 'Risposta Trattenuta dai Filtri di Sicurezza';
          errorExplanation =
            'Il contenuto del quesito o delle memorie invocate ha attivato le linee guida automatiche di moderazione del modello.';
          suggestedAction =
            'Prova a riformulare la domanda evitando espressioni che possano innescare i filtri automatici.';
          canRetry = false;
        }

        return res.status(statusCode).json({
          error: errorExplanation,
          errorTitle,
          errorType,
          suggestedAction,
          canRetry,
          provider: 'gemini',
          model: requestedModel,
        });
      }
    } catch (err: any) {
      console.error('Oracle API Error:', err);
      return res.status(500).json({
        error: err.message || 'Errore imprevisto durante la consultazione dell\'Oracolo.',
      });
    }
  });

  // Global API error handler ensuring JSON responses instead of default Express HTML errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path?.startsWith('/api/')) {
      console.error('[API Global Error]:', err);
      return res.status(err.status || err.statusCode || 500).json({
        error: err.message || 'Errore interno del server API.',
      });
    }
    next(err);
  });

  // Catch-all for undefined /api routes (prevent falling through to Vite SPA index.html)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route non trovata: ${req.method} ${req.path}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

