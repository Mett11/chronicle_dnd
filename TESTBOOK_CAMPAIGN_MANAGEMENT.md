# 📜 CHRONICLE D&D - TESTBOOK MANUALE DI COLLAUDO COMPLETO (TESTOPS EDITION)

> **Documento:** Testbook Operativo per Collaudo Manuale della Piattaforma Chronicle D&D  
> **Ruolo Target:** QA Engineer / TestOps / DM / Beta Tester  
> **Versione Schema:** Supabase PostgreSQL Schema v2.4 (Allineato a `public.campaigns`, `public.campaign_members`, `public.character_bios`, `public.sessions`, `public.notes`, `public.maps`, `public.entities`, `public.scrapbook`, `public.audio_logs`, `public.family_relations`)  
> **Ambito di Copertura:** Fuori Campagna, Gestione Campagna, Gestione DM vs Player, Impostazioni, AI Provider, Regressione Schema, Quality Data & Boundary, E2E Multi-utente.

---

## 🎯 1. STRATEGIA DI TEST E MATRICE SITI/AMBIENTI

### 1.1 Prerequisiti dell'Ambiente di Test
* **Account A (DM Owner):** Account e-mail testato come Dungeon Master e creatore della campagna.
* **Account B (Giocatore Standard):** Account e-mail di test con ruolo `player`.
* **Account C (Co-DM / Giocatore Espulso):** Account secondario per test di permessi e kick.
* **Browser:** Chrome/Edge (Chromium based) + Firefox o Safari (Verifica storage locale e WebSocket/Sync).
* **AI Provider Keys:** Almeno una chiave API valida per Google Gemini (`@google/genai`) ed eventualmente OpenAI/HuggingFace/Custom Proxy per i test dei provider AI.

### 1.2 Matrice di Severità Bug
* **P0 - Blocker:** Crash dell'applicazione, perdita dati, schermata bianca incontenibile, fallimento completo della sincronizzazione Supabase per tabelle primarie.
* **P1 - Critical:** Impossibilità di accedere alla campagna, permessi violati (es. player che vede note segrete DM), errore di colonna SQL inesistente non intercettato (`42703`).
* **P2 - Major:** AI Entity extraction non funzionante, mappe o immagini non caricate correttamente, disallineamento dello stato locale dopo il reload.
* **P3 - Minor:** Difetto estetico, etichetta non tradotta, sovrapposizione grafica su schermi mobile.

---

## 🧪 SUITE 1: TEST FUNZIONALI (FUNCTIONAL TEST MATRIX)

### 1.1 Dashboard & Operazioni "Fuori dalla Campagna" (Global & Campaign Gate)

| ID Test | Titolo Test | Prerequisiti | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-OUT-001** | Caricamento Lista Campagne Utente (`getUserCampaigns`) | Utente autenticato con almeno 1 campagna creata e 1 a cui partecipa. | 1. Effettuare il login con l'Account B.<br>2. Navigare alla Campaign Gate Dashboard.<br>3. Verificare la presenza delle campagne. | Vengono visualizzate sia le campagne in cui l'utente è DM sia quelle in cui è membro/player. Nessun errore 400 SQL nei log. | Funzionale |
| **FUN-OUT-002** | Creazione Nuova Campagna (DM) | Utente autenticato. | 1. Cliccare su "Nuova Campagna".<br>2. Inserire Titolo, Sottotitolo, Descrizione, Sistema ("D&D 5e").<br>3. Selezionare Font e Titolo Effect.<br>4. Salvare. | La campagna viene creata su Supabase (`public.campaigns`), genera un `code` alfanumerico univoco e aggiunge l'utente a `campaign_members` come `role = 'dm'`. | Funzionale |
| **FUN-OUT-003** | Join Campagna con Codice Valido | Account B non ancora membro della campagna X. | 1. Inserire il codice univoco della campagna X nel campo "Unisciti a Campagna".<br>2. Cliccare "Unisciti". | L'utente viene registrato in `public.campaign_members` con `role = 'player'`, `status = 'active'` e permessi standard JSONB. Viene ridirezionato alla vista campagna. | Funzionale |
| **FUN-OUT-004** | Join Campagna con Codice Errato/Inesistente | Account B autenticato. | 1. Inserire il codice `INVALID-9999-XYZ`.<br>2. Cliccare "Unisciti". | Viene mostrato un messaggio d'errore chiaro ("Campagna non trovata" o "Codice non valido"). Nessun blocco dell'interfaccia. | Boundary |
| **FUN-OUT-005** | Filtro e Ricerca Campagne | Più campagne presenti in dashboard. | 1. Usare la barra di ricerca in dashboard digitando il nome della campagna.<br>2. Cambiare filtri tra "Tutte", "Mie Campagne", "Archiviate". | La lista si aggiorna istantaneamente in locale senza rieseguire query ridondanti. | Funzionale |

---

### 1.2 Gestione Impostazioni & AI Provider Globali / Campagna

| ID Test | Titolo Test | Prerequisiti | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-CFG-001** | Configurazione AI Provider (Gemini API Key) | Ruolo DM o Impostazioni Utente. | 1. Aprire il pannello Impostazioni AI.<br>2. Selezionare Provider "Google Gemini".<br>3. Inserire la chiave API valida.<br>4. Testare la connessione o salvare. | La chiave viene salvata localmente/in configurazione in modo sicuro. L'indicatore mostra stato "Connesso/Attivo". | Funzionale |
| **FUN-CFG-002** | Fallback per AI Key Mancante o Invalida | Nessuna API Key configurata o chiave errata (`AI_KEY_DUMMY`). | 1. Tentare di eseguire una funzione AI (es. Estrazione Entità o Riassunto Sessione). | L'app cattura l'errore ed espone un feedback amichevole ("Configura una chiave API valida nelle impostazioni"), evitando eccezioni uncaught o schermate bianche. | Edge Case |
| **FUN-CFG-003** | Personalizzazione Calendario della Campagna (`calendar_system`) | Ruolo DM nella campagna. | 1. Aprire Impostazioni Campagna -> Calendario.<br>2. Modificare i nomi dei mesi, i giorni della settimana e la durata dell'anno.<br>3. Salvare. | La colonna JSONB `calendar_system` nella tabella `campaigns` viene aggiornata. I componenti di note e sessioni usano il nuovo sistema di date. | Funzionale |

---

### 1.3 Gestione Campagna & Permessi (Lato DM)

| ID Test | Titolo Test | Prerequisiti | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-DM-001** | Modifica Dati Campagna | Ruolo DM. | 1. Cambiare Titolo, Sottotitolo e Descrizione.<br>2. Salvare le modifiche. | La query di update invia **solo** i campi esistenti nello schema (`title`, `subtitle`, `description`, `system`, `calendar_system`, `ai_config`, `title_font`, `title_effect`, `map_folders`, `dm_is_player`). Nessuna colonna fantasma inviata. | Regressione / SQL |
| **FUN-DM-002** | Gestione Membri & Assegnazione Permessi JSONB | Ruolo DM, Account B presente come Player. | 1. Aprire la scheda Membri.<br>2. Attivare il permesso `can_edit_lore` e `can_create_entities` per Account B.<br>3. Salvare. | La colonna `permissions` in `public.campaign_members` viene aggiornata con le nuove chiavi boolean nell'oggetto JSONB. | Funzionale |
| **FUN-DM-003** | Promozione/Demozione Co-DM | Ruolo DM. | 1. Promuovere Account B a `co_dm`.<br>2. Verificare che Account B acquisisca visibilità sulle sezioni DM.<br>3. Ridurlo nuovamente a `player`. | Il ruolo in `campaign_members.role` passa da `player` a `co_dm` e viceversa. | Funzionale |
| **FUN-DM-004** | Espulsione Giocatore (Kick Player) | Ruolo DM, Account C presente. | 1. Selezionare Account C e cliccare "Espelli Giocatore".<br>2. Confermare l'operazione. | In `campaign_members`, lo stato passa a `status = 'expelled'`. L'account C viene rimosso dalla lista membri attivi e perde immediatamente l'accesso alla campagna. | Security / Funzionale |

---

### 1.4 Esperienza Giocatore & Dossier Personaggio (Lato Player)

| ID Test | Titolo Test | Prerequisiti | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-PLY-001** | Creazione e Modifica Scheda / Bio Personaggio (`character_bios`) | Account B (Player) iscritto alla campagna. | 1. Navigare nella sezione "Mio Personaggio".<br>2. Compilare Nome, Avatar URL, Classe/Livello, Allineamento, Background, Personalità, Ideali, Legami, Difetti.<br>3. Salvare. | Salva la riga nella tabella `public.character_bios` identificata dalla chiave primaria composta `(campaign_code, player_id)`. | Funzionale |
| **FUN-PLY-002** | Gestione Segreti del Personaggio (`secrets`) | Account B (Player). | 1. Inserire un testo nel campo Segreti.<br>2. Verificare le impostazioni di privacy in `privacy_settings`. | Il testo dei segreti è visibile solo al Player e al DM della campagna. Gli altri player non vedono questo campo nelle schede altrui. | Privacy / Security |
| **FUN-PLY-003** | Creazione Nota Personale / Di Gruppo (`public.notes`) | Account B (Player). | 1. Creare una nuova Nota con Titolo, Contenuto e Tag.<br>2. Impostare Visibilità: `group` o `dm_only`.<br>3. Selezionare la spunta `ask_dm` (Chiedi al DM). | La nota viene salvata in `public.notes` popolando `author_id`, `author_name`, `ask_dm = true`. Se visibile solo al DM, gli altri giocatori non la vedono nel feed. | Funzionale |
| **FUN-PLY-004** | Risposta DM a Nota Giocatore (`dm_reply`) | Nota creata con `ask_dm = true`. Account A (DM). | 1. Il DM apre la nota del giocatore.<br>2. Inserisce la risposta nel campo `dm_reply`.<br>3. Salva la nota. | Il campo `dm_reply` viene salvato e diventa visibile al giocatore autore della nota. | Funzionale |

---

### 1.5 Moduli di Contenuto (Capitoli, Sessioni, Entità, Mappe, Scrapbook, Audio)

| ID Test | Titolo Test | Prerequisiti | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-MOD-001** | Gestione Capitoli (`public.chapters`) | Ruolo DM. | 1. Creare un Capitolo con Numero, Titolo, Sinossi, Colore e Immagine di Copertina.<br>2. Modificare l'ordine (`order_index`). | Il capitolo si salva correttamente e permette di associare le successive sessioni tramite `chapter_id`. | Funzionale |
| **FUN-MOD-002** | Creazione Sessione di Gioco (`public.sessions`) | Ruolo DM. | 1. Creare Sessione N.1 abbinata al Capitolo creato.<br>2. Inserire Titolo, Data Reale (`date_str`), Data di Calendario Lore (`calendar_date`), Eventi di Trama (JSONB array), Citazioni (JSONB array). | Registrato in `public.sessions`. I campi JSONB (`plot_events`, `recap`, `quotes`, `tags`) sono salvati come array JSON validi. | Funzionale |
| **FUN-MOD-003** | Creazione Entità NPC/Mostro/Luogo (`public.entities`) | Permesso `can_create_entities` o Ruolo DM. | 1. Creare Entità con Nome, Tipo (`npc`, `location`, `faction`), Stato (`alive`, `dead`, `unknown`), Descrizione, Attributes JSONB. | Salva in `public.entities`. L'entità appare nella lista enciclopedia/lore della campagna. | Funzionale |
| **FUN-MOD-004** | Albero Genealogico & Relazioni Familiare (`public.family_relations`) | Almeno 2 entità o personaggi creati. | 1. Aprire il modulo Genealogia.<br>2. Collegare Entità A ad Entità B specificando `relationship_type` (es. `parent`, `child`, `spouse`) e `side_of_family`. | La relazione viene salvata in `family_relations` con `source_entity_id` e `target_entity_id` validi. | Funzionale |
| **FUN-MOD-005** | Mappe Interattive & Pin Coordinate (`public.maps`) | Permesso gestione mappe o Ruolo DM. | 1. Caricare/Inserire URL Immagine Mappa.<br>2. Aggiungere un Pin specificando coordinate x, y, titolo e `entity_id` associato.<br>3. Configurare Fog of War (JSONB). | Salva la mappa in `public.maps` con l'array `pins` e l'oggetto `fog_of_war` validi. I pin sono cliccabili sulla mappa. | Funzionale |
| **FUN-MOD-006** | Scrapbook / Moments (`public.scrapbook`) | Utente con permessi. | 1. Aggiungere una foto nello Scrapbook con Titolo, Didascalia, Immagine URL, `aspect_ratio` e `category`.<br>2. Impostare `is_secret = true`. | Salva in `public.scrapbook`. Se `is_secret = true`, viene nascosto agli utenti non autorizzati. | Funzionale |
| **FUN-MOD-007** | Audio Logs (`public.audio_logs`) | Utente registrato. | 1. Inserire un nuovo registro audio con Titolo, Audio URL e Durata in secondi.<br>2. Associare l'audio a una Sessione o Entità. | Salva in `public.audio_logs` mantenendo la relazione con la sessione/entità target. | Funzionale |

---

## 🔄 SUITE 2: TEST DI REGRESSIONE (REGRESSION & SCHEMA SUITE)

> **Focus Critico:** Verificare che nessun aggiornamento recente introduca query verso colonne eliminati o inesistenti nel DB PostgreSQL / Supabase live.

| ID Test | Titolo Test | Passaggi di Esecuzione | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- |
| **REG-SCH-001** | Assenza Query su `campaigns.expelled_accounts` | 1. Eseguire la sincronizzazione metadati campagna (`saveCampaign` o `updateCampaignMetadata`).<br>2. Ispezionare il traffico di rete / DevTools Network tab per le richieste Supabase PostgREST. | La richiesta `PATCH /rest/v1/campaigns` **non contiene** il payload `expelled_accounts`. Il server risponde con `HTTP 200 OK` anziché `HTTP 400 (42703)`. | Regressione Critica |
| **REG-SCH-002** | Assenza Query su `campaigns.active_players` | 1. Caricare i dati completi della campagna (`loadCampaignData` o `fetchAllCampaigns`).<br>2. Controllare le clausole `.select()`. | La select query non include `active_players`. Gli account attivi vengono derivati dinamicamente interrogando la tabella `public.campaign_members` con `status = 'active'`. | Regressione Critica |
| **REG-SCH-003** | Assenza Query su colonna o tabella `dossier` | 1. Navigare nella vista Schede Personaggio e Biografie.<br>2. Eseguire salvataggio bio. | Le query usano esclusivamente la tabella `public.character_bios`. Nessun riferimento alla colonna obsoleta `dossier`. | Regressione Critica |
| **REG-SCH-004** | Calcolo Dinamico Account Espulsi da `campaign_members` | 1. Espellere un giocatore.<br>2. Ricaricare la campagna da un altro browser o dispositivo. | `expelledAccounts` viene calcolato eseguendo `.filter(m => m.status === 'expelled')` sui dati di `campaign_members`. L'utente espulso non può ricaricare la campagna. | Regressione |
| **REG-SCH-005** | Risoluzione Utente in `getUserCampaigns` tramite `.in()` | 1. Autenticarsi con un utente avente e-mail o id multipli derivati (`candidateUserIds`).<br>2. Invocare `getUserCampaigns`. | La ricerca membri usa il filtro valido `.in('user_id', idList)` anziché `.or()` malformati con stringhe vuote. Nessun errore di sintassi PostgREST. | Regressione |

---

## 📐 SUITE 3: QUALITY DATA, BOUNDARY & EDGE CASES (DATA INTEGRITY)

### 3.1 Input Limiti & String Boundary

| ID Test | Titolo Test | Payload / Data Input | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- |
| **DAT-BND-001** | Testo Nota di Danno Extremamente Lungo | Testo di oltre 50.000 caratteri nel campo `content` della nota. | Salva ed effettua il render senza blocco di memoria. La visualizzazione usa lo scrolling verticale o la paginazione amichevole. | Boundary |
| **DAT-BND-002** | Titolo Campagna con Caratteri Speciali & Emoji | `⚔️ Valhalla & Dragons: "L'Ombra dell'Eternità" 'OR '1'='1` | La stringa viene correttamente memorizzata, sottoposta a sanitizzazione/escaping in PostgreSQL e renderizzata senza problemi di codifica UTF-8. | Boundary / Encoding |
| **DAT-BND-003** | Test Iniezione HTML / Script Injection nel Note Content | `<script>alert('XSS')</script><iframe src="javascript:alert(1)"></iframe>` | L'applicazione sanifica l'input HTML in fase di rendering (tramite DomPurify o React escaping standard). Lo script non viene mai eseguito nel browser. | Security / Data Quality |
| **DAT-BND-004** | Array Vuoti o Nulli nei Campi JSONB | Inviare `{ plot_events: [], recap: null, tags: [] }` in `sessions`. | L'applicazione gestisce in modo sicuro i valori `null` convertendoli in fallback `[]` o `{}` evitando l'errore `TypeError: cannot read properties of null (reading 'map')`. | Robustezza Data Quality |

---

### 3.2 AI Parsing & Resilience Testing

| ID Test | Titolo Test | Scenario Input AI | Esito Atteso | Tipologia |
| :--- | :--- | :--- | :--- | :--- |
| **DAT-AI-001** | Risposta AI Malformata / Non-JSON durante Estrazione Entità | L'LLM restituisce un testo generico anziché un JSON (`"Ecco le entità che ho trovato: Elminster, Neverwinter..."`). | Il parser del client o server cattura il fallimento del `JSON.parse`, isola la sezione JSON o mostra un fallback pulito ("Impossibile estrarre automaticamente le entità"). Nessun crash. | AI Resilience |
| **DAT-AI-002** | Timeout o Rate Limit dall'API Gemini / Provider AI | Simulazione di errore HTTP 429 (Too Many Requests) o Timeout di Rete. | L'applicazione mostra un messaggio di retry ("Servizio AI momentaneamente occupato, riprova tra poco") liberando il pulsante di caricamento. | AI Resilience |
| **DAT-AI-003** | Generazione Riassunto per Sessione Molto Lunga | Resoconto di sessione di oltre 20 pagine inviato al modello AI. | Il prompt viene troncato in modo sicuro entro i limiti del contesto del modello senza superare i token max di output. | AI Boundary |

---

## 🌐 SUITE 4: SCENARI END-TO-END (E2E WORKFLOW SUITE)

### E2E-001: Flusso Completo della Campagna (Dal Setup al Primo Gioco)

```
[1. DM Crea Campagna] ──> [2. Configura Calendario & AI] ──> [3. Genera Codice & Invita Player]
                                                                      │
                                                                      ▼
[6. Primo Riassunto AI] <── [5. DM Registra Sessione 1] <── [4. Player Entra & Compila Bio]
```

#### Fasi di Verifica E2E-001:
1. **Passo 1 (DM):** Accedere con l'Account A, creare la campagna *"I Signori del Destino"*.
2. **Passo 2 (DM):** Configurare un sistema di calendario personalizzato di 10 mesi da 30 giorni e impostare la chiave API Gemini.
3. **Passo 3 (DM):** Copiare il codice univoco della campagna (es. `SGN-DEST-2026`).
4. **Passo 4 (Player):** Accedere con l'Account B su un secondo browser, inserire il codice, completare la propria Bio Personaggio inserendo Nome *"Thorgan Barbadaccia"*, Razza *"Nano"*, Classe *"Guerriero Liv 3"*.
5. **Passo 5 (DM):** Creare il Capitolo 1 e la Sessione 1. Aggiungere 3 eventi di trama e associare una mappa con un pin per la locanda.
6. **Passo 6 (DM/Player):** Il Player crea una nota *"Sospetti sul Locandiere"* flaggando `ask_dm`. Il DM vede la nota, risponde *"Il locandiere ha un tatuaggio del Culto"* e la contrassegna come Canonica.
7. **Verifica Finale:** Tutti i dati sono persistiti su Supabase, visibili in tempo reale o al refresh, senza alcun errore SQL o di sincronizzazione.

---

### E2E-002: Sicurezza & Isolatione Utente Espulso (Expulsion & Lockdown E2E)

#### Fasi di Verifica E2E-002:
1. **Passo 1:** L'Account C entra nella campagna ed effettua il caricamento della sua scheda personaggio e di una nota privata.
2. **Passo 2:** Il DM (Account A) apre la lista membri ed esegue l'azione "Espelli Giocatore" su Account C.
3. **Passo 3:** L'Account C tenta di aggiornare la pagina o navigare nelle sezioni della campagna.
4. **Esito Atteso:** L'Account C viene immediatamente reindirizzato al Gate iniziale ("Sei stato rimosso da questa campagna"). Tentando di reinserire il codice invito, il sistema respinge la richiesta rilevando lo stato `status = 'expelled'` nella tabella `campaign_members`.

---

## 📊 TABELLA DI TRACCIABILITÀ E VERIFICA COLLAUDO MANUAL

Segnare con una **X** i test completati durante la sessione di 24 ore:

- [ ] **FUN-OUT-001** - Caricamento Lista Campagne Utente
- [ ] **FUN-OUT-002** - Creazione Nuova Campagna
- [ ] **FUN-OUT-003** - Join Campagna con Codice Valido
- [ ] **FUN-OUT-004** - Join Campagna con Codice Errato
- [ ] **FUN-OUT-005** - Filtro e Ricerca Campagne
- [ ] **FUN-CFG-001** - Configurazione AI Provider
- [ ] **FUN-CFG-002** - Fallback AI Key Mancante
- [ ] **FUN-CFG-003** - Personalizzazione Calendario Campagna
- [ ] **FUN-DM-001** - Modifica Dati Campagna (No Ghost Columns)
- [ ] **FUN-DM-002** - Gestione Membri & Permessi JSONB
- [ ] **FUN-DM-003** - Promozione/Demozione Co-DM
- [ ] **FUN-DM-004** - Espulsione Giocatore
- [ ] **FUN-PLY-001** - Creazione e Modifica Bio Personaggio
- [ ] **FUN-PLY-002** - Gestione Segreti Personaggio
- [ ] **FUN-PLY-003** - Creazione Nota Giocatore
- [ ] **FUN-PLY-004** - Risposta DM a Nota Giocatore
- [ ] **FUN-MOD-001** - Gestione Capitoli
- [ ] **FUN-MOD-002** - Creazione Sessione di Gioco
- [ ] **FUN-MOD-003** - Creazione Entità Enciclopedia
- [ ] **FUN-MOD-004** - Albero Genealogico & Relazioni
- [ ] **FUN-MOD-005** - Mappe Interattive & Pin
- [ ] **FUN-MOD-006** - Scrapbook / Moments
- [ ] **FUN-MOD-007** - Audio Logs
- [ ] **REG-SCH-001** - Assenza `expelled_accounts` in `campaigns` Update
- [ ] **REG-SCH-002** - Assenza `active_players` in `campaigns` Select
- [ ] **REG-SCH-003** - Assenza riferimenti `dossier`
- [ ] **REG-SCH-004** - Calcolo Espulsi da `campaign_members`
- [ ] **REG-SCH-005** - Risoluzione Utente in `getUserCampaigns` via `.in()`
- [ ] **DAT-BND-001** - Testo Nota Lungo (50k+ char)
- [ ] **DAT-BND-002** - Caratteri Speciali & Emoji
- [ ] **DAT-BND-003** - Sanitizzazione XSS / Injection
- [ ] **DAT-BND-004** - Gestione JSONB Null / Empty
- [ ] **DAT-AI-001** - Parsing Risposta AI Malformata
- [ ] **DAT-AI-002** - Handling Timeout / Rate Limit AI
- [ ] **DAT-AI-003** - Resoconto Sessione Molto Lunga
- [ ] **E2E-001** - Flusso Completo Campagna (DM + Player)
- [ ] **E2E-002** - Flusso Espulsione & Isolatione Sicurezza

---
*Testbook generato da TestOps Engineering per Chronicle D&D.*
