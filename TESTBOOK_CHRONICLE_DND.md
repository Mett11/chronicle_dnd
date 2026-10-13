# 🧪 TESTBOOK DI COLLAUDO & QA MATRIX - CHRONICLE DND

---

## 📋 INFORMAZIONI GENERALI
- **Progetto**: Chronicle D&D Application
- **Versione**: 1.0.0-Production
- **Ambiente di Test**: Staging / Production Preview
- **Database**: Supabase PostgreSQL + Firebase Auth JWT
- **Data Pianificazione**: 13 Ottobre 2026
- **Autore**: TestOps & Lead QA Engineer

---

## 📊 LEGENDA RUOLI & TIPI DI TEST

### Ruoli Utente
- **GLOBAL**: Funzionalità esterne alle campagne (Auth, Impostazioni Utente, API Keys).
- **DM**: Dungeon Master / Master della campagna (permessi di scrittura ed editing completi).
- **CO-DM**: Co-Master (permessi amministrativi delegati).
- **PLAYER**: Giocatore partecipante (accesso limitato ai contenuti pubblici e alla propria scheda PG).

### Tipi di Test
- **[FUNC]**: Test Funzionale
- **[REG]**: Test di Regressione
- **[DQ]**: Test di Data Quality & Coerenza Dati
- **[E2E]**: Test End-to-End
- **[PERF]**: Performance & Memory Test
- **[SEC]**: Security & RBAC Test

### Priorità
- **P1 (Critical)**: Bloccante per l'uso dell'applicazione o perdita/corruzione dati.
- **P2 (High)**: Impatta importanti funzionalità utente.
- **P3 (Medium/Low)**: Difetti cosmetici o minor UX.

---

## 📌 MATRICE COMPLETA DEI TEST CASE

### MODULO 0: AUTENTICAZIONE & PROFILO GLOBALE (`user_accounts`, `user_preferences`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-AUTH-001** | GLOBAL | Login/Signup via Supabase Auth | Account non presente o già registrato | 1. Inserisci Email e Password o usa OAuth.<br>2. Clicca Login/Sign-up. | `Email: test.player@example.com` | Accesso eseguito. Creata/aggiornata la riga in `user_accounts`. Redirezione al Campaign Gate. | [FUNC] | P1 |
| **TC-AUTH-002** | GLOBAL | Normalizzazione Case-Insensitive Email | N/A | 1. Inserisci Email con maiuscole/minuscole miste.<br>2. Esegui Login. | `Email: TeSt.PlaYeR@ExAmPlE.CoM` | L'email viene trimmata e convertita in lowercase. Gli ID e le associazioni vengono risolti senza duplicati. | [DQ] | P1 |
| **TC-AUTH-003** | GLOBAL | Aggiornamento Profilo Globale (Avatar, Colore, Nome) | Utente autenticato | 1. Apri Impostazioni Utente.<br>2. Modifica Nome PG di default, Avatar URL e Colore.<br>3. Salva. | `Name: Thorin`<br>`Color: #ef4444`<br>`Avatar: https://img.png` | Riconferma salvataggio su Supabase `user_accounts`. Al reload i dati rimangono invariati. | [FUNC] | P2 |
| **TC-AUTH-004** | GLOBAL | Logout Sincrono e Pulizia Sessione | Utente connesso con dati in cache | 1. Effettua il Logout dal menù utente.<br>2. Verifica LocalStorage e cache in-memory. | N/A | `chronicle_current_account_id` viene rimosso. La cache utente viene azzerata. Reindirizzamento immediato a Login. | [REG] | P1 |
| **TC-AUTH-005** | GLOBAL | Switch Utente sullo Stesso Browser | 2 account distinti | 1. Logout da Utente A.<br>2. Login come Utente B sullo stesso browser. | `User A -> User B` | I dati dell'Utente A non contaminano la dashboard o le campagne dell'Utente B. | [REG] | P1 |

---

### MODULO 1: PROVIDER AI & GESTIONE API KEYS (`apiKeyManager`, Vault)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-AI-001** | GLOBAL | Inserimento e Cifratura API Key Gemini | Nessuna chiave memorizzata | 1. Apri Impostazioni AI Globali.<br>2. Inserisci Google Gemini API Key.<br>3. Clicca "Verifica e Salva". | `Key: AIzaSyD...` (con spazi iniziali/finali) | La chiave viene sanitizzata con `.trim()`. Ping su `gemini-2.5-flash` con esito "Valida". Salva nel vault. | [FUNC] | P1 |
| **TC-AI-002** | GLOBAL | Configurazione Provider OpenRouter / OpenAI | API Key OpenRouter | 1. Seleziona Provider OpenRouter.<br>2. Inserisci Key e Model ID.<br>3. Salva. | `BaseURL: https://openrouter.ai/api/v1`<br>`Model: anthropic/claude-3.5-sonnet` | Le chiamate ai servizi AI utilizzano l'endpoint OpenRouter con gli header corretti. | [FUNC] | P2 |
| **TC-AI-003** | GLOBAL | Fallback su Server Proxy in Assenza di Chiave Locale | Nessuna chiave salvata | 1. Rimuovi le API Key locali.<br>2. Invocazione funzione AI (es. "Genera Recap"). | N/A | L'app utilizza la rotta proxy `/api/genai` con la chiave lato server, senza bloccare l'UI. | [FUNC] | P2 |
| **TC-AI-004** | GLOBAL | Gestione Errori Key Revocata / Quota Exceeded | Key scaduta o revocata | 1. Inserisci una chiave non valida.<br>2. Genera una descrizione lore. | `Key: AIzaSyINVALID_KEY` | Viene mostrato un avviso di errore chiaro e non bloccante. Nessun crash o schermata nera. | [REG] | P2 |

---

### MODULO 2: CAMPAIGN GATE & NAVIGAZIONE GLOBALE (`CampaignGate`, `AuthProvider`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-GATE-001** | GLOBAL | Rendering Campagne DM vs Player | Utente appartiene a campagne come DM e come Giocatore | 1. Apri la schermata principale Campaign Gate.<br>2. Verifica le schede campagna. | N/A | Le campagne DM mostrano il badge "DM". Le campagne Giocatore mostrano il badge "Giocatore" e la miniatura del PG. | [FUNC] | P1 |
| **TC-GATE-002** | GLOBAL | Copia Rapida Codice Campagna | Almeno una campagna presente | 1. Clicca sul badge codice campagna (es. `CHR-ABCD`). | N/A | Il codice viene copiato nella clipboard. Appare il feedback visivo "Copiato!". | [FUNC] | P3 |
| **TC-GATE-003** | GLOBAL | Modifica Rapida Profilo PG dal Gate | Utente Giocatore in una campagna | 1. Clicca l'icona matita sulla scheda campagna nel Gate.<br>2. Cambia Nome PG e Colore. | `Name: Aragorn`<br>`Color: #10b981` | Il profilo PG per la specifica campagna viene aggiornato senza dover entrare nella campagna. | [FUNC] | P2 |
| **TC-GATE-004** | GLOBAL | Tolleranza Errore e Persistenza su Query Fallite | Connessione lenta o risposta parziale | 1. Apri il Gate in modalità Offline o con risposte incomplete da Supabase. | N/A | L'applicazione ripristina la lista campagne dal LocalStorage/Cache senza svuotare il Gate o cancellare le campagne locali. | [DQ] | P1 |

---

### MODULO 3: CREAZIONE, UNIONE & GESTIONE CAMPAGNA (`campaigns`, `campaign_members`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-CAMP-001** | DM | Creazione Nuova Campagna | Utente autenticato | 1. Clicca "Nuova Campagna".<br>2. Compila Titolo, Sottotitolo, Descrizione, Sistema, Font e Effetti.<br>3. Salva. | `Title: Le Ombre di Waterdeep`<br>`System: D&D 5e`<br>`Font: Cinzel` | Campagna creata. Generato codice univoco (es. `CHR-WDP-8821`). Creata riga in `campaigns` e riga DM in `campaign_members`. | [FUNC] | P1 |
| **TC-CAMP-002** | PLAYER | Join Campagna con Codice Univoco | Campagna esistente creata da DM | 1. Clicca "Unisciti a Campagna".<br>2. Inserisci il Codice Campagna e Nome PG.<br>3. Invia. | `Code: CHR-WDP-8821`<br>`PG Name: Legolas` | Il giocatore entra nella campagna. Viene creata la riga in `campaign_members` (`status = 'active'`) e la riga in `character_bios`. | [FUNC] | P1 |
| **TC-CAMP-003** | PLAYER | Join con Codice con Spazi e Lettere Minuscole | Campagna creata | 1. Inserisci codice con spazi e minuscole. | `Code:   chr-wdp-8821   ` | Il codice viene trimmato e convertito in uppercase. Il join completa con successo. | [DQ] | P2 |
| **TC-CAMP-004** | REG | Assenza Query `expelled_accounts` su Tabella `campaigns` | Join o re-join campagna | 1. Apri la scheda Network di F12.<br>2. Esegui il Join a una campagna. | N/A | **Nessuna chiamata SQL con errore 42703 (column campaigns.expelled_accounts does not exist)**. Risposta HTTP 200/201. | [REG] | P1 |
| **TC-CAMP-005** | DM | Eliminazione Campagna da parte del DM | DM della campagna | 1. Apri Impostazioni Campagna.<br>2. Clicca "Elimina Campagna" e conferma. | `Confirm Code: CHR-WDP-8821` | Campagna rimossa da `campaigns`, `campaign_members` e cascata sulle tabelle collegate. I giocatori non la vedono più. | [FUNC] | P1 |

---

### MODULO 4: CONTROLLO ACCESSI & RUOLI RBAC (DM, Co-DM, Player, Permessi Granulari)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-RBAC-001** | DM | Configurazione Permessi Granulari Ruolo Player | Campagna con giocatori attivi | 1. Apri Gestione Campagna -> Permessi.<br>2. Disattiva "Può creare note lore".<br>3. Salva. | `can_create_lore: false` | I giocatori non vedono il pulsante "Nuova Nota Lore". Tentativi di inserimento via console vengono respinti. | [SEC] | P1 |
| **TC-RBAC-002** | DM | Promozione Giocatore a Co-DM / Co-Master | Giocatore presente nel party | 1. Apri Gestione Party.<br>2. Seleziona Giocatore B e cambia ruolo in "Co-Master". | `Role: co-dm` | Il Giocatore B acquisisce permessi di lettura/scrittura su mappe segrete, note DM e capitoli. | [SEC] | P2 |
| **TC-RBAC-003** | DM | Espulsione Giocatore (Kick / Expel) | Giocatore attivo nella campagna | 1. Clicca "Espelli Giocatore" sulla riga del Giocatore B.<br>2. Conferma espulsione. | `UserId: user_123` | Lo status in `campaign_members` diventa `'expelled'`. Il Giocatore B viene disconnesso dalla campagna e non la vede più nel Gate. | [SEC] | P1 |
| **TC-RBAC-004** | PLAYER | Tentativo di Re-entry di Giocatore Espulso | Giocatore espulso dallo status `'expelled'` | 1. Il Giocatore B inserisce nuovamente il codice della campagna da cui è stato espulso. | `Code: CHR-WDP-8821` | Il sistema blocca il join con il messaggio: "Sei stato espulso da questa campagna". Accesso negato. | [SEC] | P1 |
| **TC-RBAC-005** | DM | Annullamento Espulsione (Un-expel) | Giocatore presente nella lista espulsi | 1. Apri Lista Espulsi.<br>2. Clicca "Annulla Espulsione".<br>3. Il giocatore riprova il join. | Status in `campaign_members` passa a `'active'` o viene rimosso il blocco. Il giocatore rientra mantenendo la sua scheda PG. | [SEC] | P2 |

---

### MODULO 5: IMPOSTAZIONI & PERSONALIZZAZIONE CAMPAGNA

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-SETT-001** | DM | Personalizzazione Font & Effetti Titolo | DM nella campagna | 1. Apri Impostazioni Campagna.<br>2. Seleziona Font (Cinzel, Medieval, Inter) ed Effetto Titolo (Glow, Gold, Neon). | `Font: Medieval`<br>`Effect: Gold` | L'intestazione della campagna aggiorna il font e lo stile visivo sia per il DM che per i giocatori. | [FUNC] | P3 |
| **TC-SETT-002** | DM | Configurazione Calendario Fantasy Personalizzato | DM nella campagna | 1. Modifica la configurazione del Calendario (Mesi, Giorni per Mese, Nomi delle Lune, Anno Corrente). | `Year: 1492 DR`<br>`Months: 12` | Le date di lore e le sessioni utilizzano i nomi dei mesi e il formato del calendario fantasy configurato. | [FUNC] | P2 |
| **TC-SETT-003** | DM | Toggle "DM è anche Giocatore" (`dm_is_player`) | DM nella campagna | 1. Attiva l'interruttore "Visualizza la mia Scheda PG". | `dm_is_player: true` | Il DM appare nella lista del party come personaggio giocabile e può compilare la propria scheda PG. | [FUNC] | P3 |

---

### MODULO 6: CAPITOLI & SESSIONI (`chapters`, `sessions`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-SESS-001** | DM | Creazione Capitolo e Ordinamento | DM nella campagna | 1. Crea Capitolo 1 ("Atto I - Il Risveglio") e Capitolo 2 ("Atto II - La Fuga").<br>2. Riordina i capitoli. | `OrderIndex: 1, 2` | I capitoli compaiono nell'ordine specificato con i relativi badge e colori tematici. | [FUNC] | P2 |
| **TC-SESS-002** | DM | Creazione e Assegnazione Sessione a Capitolo | Capitolo esistente | 1. Nuova Sessione.<br>2. Imposta Numero, Titolo, Data Reale, Data Fantasy e seleziona Capitolo 1. | `Num: 1`<br>`Title: La Taverna dell'Oca D'Oro` | La sessione viene creata e associata al Capitolo 1. I contatori di sessione nel capitolo si aggiornano. | [FUNC] | P1 |
| **TC-SESS-003** | REG | Assenza Colonne Deprecate `audio_url`/`audio_logs` su `sessions` | Apertura modulo Sessioni | 1. Apri la schermata Sessioni.<br>2. Ispeziona la console di sviluppatore. | N/A | **Nessun warning o errore "column sessions.audio_url does not exist"**. Query SQL eseguita pulita. | [REG] | P1 |
| **TC-SESS-004** | DM/PLAYER | Inserimento Recap, Events, Citazioni e Presenze | Sessione creata | 1. Apri Dettaglio Sessione.<br>2. Compila Recap (Markdown), Eventi Chiave, Citazioni e seleziona Giocatori Presenti. | `Attendees: ["user_1", "user_2"]` | Tutti i campi vengono salvati e sincronizzati. Le citazioni vengono attribuite ai rispettivi PG. | [FUNC] | P2 |
| **TC-SESS-005** | DM | Auto-Generazione AI del Recap di Sessione | API Key valida e note di sessione presenti | 1. Clicca "Genera Recap con AI". | N/A | L'AI elabora le note e gli eventi e genera un riassunto narrativo strutturato. | [FUNC] | P2 |

---

### MODULO 7: SCHEDE PERSONAGGIO PG (`character_bios`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-BIO-001** | PLAYER | Compilazione Scheda PG (SSOT `character_bios`) | Giocatore partecipante | 1. Apri "Il Mio Personaggio".<br>2. Compila Razza, Classe/Livello, Allineamento, Ideali, Legami, Difetti e Foto. | `Race: Elf`<br>`Class: Wizard 5` | I dati vengono salvati su Supabase nella tabella `character_bios` con chiave (`campaign_code`, `player_id`). | [FUNC] | P1 |
| **TC-BIO-002** | PLAYER/DM | Gestione Segreti e Privacy Settings | Scheda PG aperta | 1. Inserisci un Segreto nel campo "Segreti".<br>2. Imposta Privacy a "Solo DM & Io". | `Privacy: dm_and_me` | Il segreto è visibile solo all'autore del PG e al DM. Gli altri giocatori vedono la sezione bloccata o nascosta. | [SEC] | P1 |
| **TC-BIO-003** | PLAYER | Gestione Timeline Ricordi & Convinzioni | Scheda PG aperta | 1. Aggiungi un Ricordo della Timeline (Anno, Titolo, Descrizione).<br>2. Aggiungi una Convinzione Evolutiva. | `Memory: Distruzione del Villaggio (1480)` | La timeline del PG si aggiorna in ordine cronologico. | [FUNC] | P2 |
| **TC-BIO-004** | DM | Visualizzazione e Modifica Scheda PG da parte del DM | DM della campagna | 1. Il DM apre la scheda di un Giocatore dal Party.<br>2. Apporta una modifica al background o nota DM. | N/A | Il DM può visualizzare e aggiornare le schede di tutti i PG del party con sincronizzazione immediata. | [FUNC] | P2 |

---

### MODULO 8: MAPPE DEL MONDO & CARTELLE (`maps`, `map_folders`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-MAP-001** | REG | Prevenzione Ricorsione Infinita su Eventi Cartelle | Modulo Mappe | 1. Apri la schermata Mappe.<br>2. Crea o modifica una cartella mappe.<br>3. Monitora la CPU e i Log Console. | `Folder Name: Regioni del Nord` | **Nessun errore "RangeError: Maximum call stack size exceeded"**. L'evento non entra in loop. CPU stabile. | [REG] | P1 |
| **TC-MAP-002** | DM | Caricamento Mappa e Collegamento ad Entità/Luogo | Immagine Mappa | 1. Clicca "Nuova Mappa".<br>2. Inserisci Titolo, URL Immagine, Scala e seleziona Cartella/Entità. | `Title: Costa della Spada`<br>`URL: https://...` | Mappa creata e posizionata nella cartella corretta. | [FUNC] | P1 |
| **TC-MAP-003** | DM | Posizionamento Segnalini (Pins) e Fog of War | Mappa aperta | 1. Clicca sulla mappa per aggiungere un Pin.<br>2. Configura il Pin (Nome, Categoria, Visibilità Segreta).<br>3. Disegna un'area Nebbia di Guerra. | `Pin: Covo dei Pirati (Segreto)` | Pin e Fog of War vengono salvati. I giocatori non vedono i Pin segreti né le aree coperte da nebbia. | [FUNC] | P1 |
| **TC-MAP-004** | DM | Impostazione Mappa Predefinita (Default Map) | Molteplici mappe presenti | 1. Seleziona una mappa e clicca "Imposta come Predefinita". | `is_default: true` | Tutti gli utenti che aprono la sezione Mappe vedono per prima la Mappa Predefinita. | [FUNC] | P2 |

---

### MODULO 9: ENCICLOPEDIA WORLD LORE & SCRAPBOOK (`world_lore_articles`, `scrapbook`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-LORE-001**| DM/PLAYER | Creazione Articolo Lore con Categorie e Tag | Permesso creazione lore attivo | 1. Clicca "Nuovo Articolo".<br>2. Inserisci Titolo, Sottotitolo, Categoria, Contenuto, Immagini e Tag. | `Category: Geografia`<br>`Tags: ["Montagne", "Rune"]` | L'articolo viene salvato su `world_lore_articles` e indicizzato con ricerca istantanea. | [FUNC] | P1 |
| **TC-LORE-002**| DM | Bozze e Pubblicazione Articoli Lore | DM nella campagna | 1. Crea un articolo e spunta "Bozza (Draft)".<br>2. Salva.<br>3. Successivamente pubblica l'articolo. | `is_draft: true -> false` | Finché è in stato Bozza, l'articolo è visibile solo al DM. Una volta pubblicato, diventa visibile al party. | [SEC] | P2 |
| **TC-SCRAP-001**| ALL | Aggiunta Foto / Memoria nello Scrapbook | Immagine o illustrazione | 1. Apri Scrapbook.<br>2. Carica foto, inserisci Didascalia, Categoria, Aspect Ratio e collega alla Sessione. | `Category: Momento Epico`<br>`Ratio: 16:9` | La memoria appare nello Scrapbook e nella galleria della sessione collegata. | [FUNC] | P2 |

---

### MODULO 10: NOTE & REGISTRO DIARIO (`notes`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-NOTE-001**| ALL | Creazione Nota Personale vs Nota Gruppo | Modulo Note aperto | 1. Crea Nota A con visibilità "Gruppo".<br>2. Crea Nota B con visibilità "Personale". | `Vis B: private` | La Nota A è visibile a tutti. La Nota B è visibile unicamente all'autore. | [FUNC] | P1 |
| **TC-NOTE-002**| DM | Creazione Nota DM-Only e Pinning | DM nella campagna | 1. Crea una Nota e spunta "Solo DM" e "In Evidenza (Pinned)". | `is_dm_only: true`<br>`is_pinned: true` | La nota rimane in alto, visibile solo al DM, con badge visivo informativo. | [SEC] | P2 |
| **TC-NOTE-003**| PLAYER | Funzione "Chiedi al DM" (`ask_dm`) su Nota Giocatore | Giocatore con nota personale | 1. Il Giocatore B attiva "Chiedi al DM" su una nota.<br>2. Il DM risponde nel campo `dm_reply`. | `Ask DM: true`<br>`Reply: "È una leggenda vera"` | Il DM riceve la notifica/richiesta e può fornire la risposta riservata al giocatore. | [FUNC] | P2 |

---

### MODULO 11: ALBERO GENEALOGICO & RELAZIONI FAMILIARI (`family_relations`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-FAM-001** | ALL | Creazione Relazione Familiare tra Entità | Almeno 2 entità create | 1. Apri Albero Genealogico.<br>2. Collega Entità Sorgente ad Entità Destinazione.<br>3. Seleziona Tipo Relazione (Genitore, Figlio, Fratello, Coniuge). | `Source: Re Alden`<br>`Target: Principe Eric`<br>`Type: parent` | Viene creata la riga su `family_relations`. Il grafico ad albero aggiorna i rami genealogici. | [FUNC] | P2 |
| **TC-FAM-002** | DM | Relazione Familiare Segreta | DM della campagna | 1. Crea una relazione e attiva "Segreto DM". | `is_secret: true` | La relazione appare nell'albero del DM (con icona lucchetto), ma viene nascosta nell'albero dei giocatori. | [SEC] | P2 |
| **TC-FAM-003** | DQ | Gestione Cicli Genealogici Potenzialmente Infiniti | Albero complesso | 1. Crea una struttura con molteplici rami e matrimoni incrociati. | N/A | Il motore di rendering dell'albero gestisce i nodi senza andare in crash o entrare in loop infinito. | [DQ] | P3 |

---

### MODULO 12: REGISTRO AUDIO & TRASCRIZIONI (`audio_logs`)

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-AUD-001** | ALL | Aggiunta Traccia Audio e Riproduzione | File audio o URL | 1. Apri Registro Audio.<br>2. Carica traccia con Titolo, Durata e Collegamento a Sessione/Lore. | `Title: Discorso del Re`<br>`URL: https://...audio.mp3` | Traccia salvata nella tabella `audio_logs`. Il player audio riproduce il file correttamente. | [FUNC] | P2 |
| **TC-AUD-002** | DM | Assegnazione Traccia Audio a Entità / Mappa | Traccia audio presente | 1. Modifica la traccia audio e associala all'Entità "Drago Rosso". | `associated_type: entity`<br>`associated_id: ent_99` | L'audio appare tra le risorse multimediali collegate nella scheda dell'Entità "Drago Rosso". | [FUNC] | P3 |

---

### MODULO 13: DATA QUALITY, PERSISTENZA & FALLBACK SUPABASE

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-DQ-001**  | SYSTEM | Safe Upsert & Deprecated Column Stripping | Query verso Supabase | 1. Simula l'invio di un oggetto con una colonna non più presente nel DB. | Payload con colonna non valida | `safeUpsert` rileva l'errore SQL, rimuove la colonna dal payload e riesegue con successo il salvataggio. | [DQ] | P1 |
| **TC-DQ-002**  | SYSTEM | Coerenza Tipi Dati JSONB | Salvataggio array/oggetti | 1. Salva dati strutturati (es. `calendar_system`, `ai_config`, `plot_events`, `permissions`). | Oggetti JSON complessi | I dati vengono serializzati e deserializzati mantenendo integri i tipi booleani, le stringhe ed i numeri. | [DQ] | P1 |
| **TC-DQ-003**  | SYSTEM | Preservazione Modifiche Parziali (No Overwrite) | Dati esistenti nel DB | 1. Aggiorna solo il titolo della campagna via `updateCampaignMetadata`. | `patch = { title: "Nuovo Titolo" }` | Vengono aggiornati unicamente il titolo e `updated_at`. Gli altri campi (`ai_config`, `calendar_system`) rimangono intatti. | [DQ] | P1 |

---

### MODULO 14: SINCRONIZZAZIONE CLOUD, CACHE & FALLBACK OFFLINE

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-SYNC-001**| SYSTEM | Funzionamento Cache In-Memory con TTL | Dati già scaricati | 1. Naviga tra i moduli entro 60 secondi dal primo caricamento. | N/A | I dati vengono forniti dalla cache locale senza eseguire chiamate HTTP di rete superflue. | [PERF] | P2 |
| **TC-SYNC-002**| SYSTEM | Sincronizzazione Offline-to-Online | Connessione di rete disattivata | 1. Disattiva il Wi-Fi.<br>2. Effettua modifiche (note, sessioni).<br>3. Riattiva il Wi-Fi. | N/A | I dati salvati nel LocalStorage temporaneo vengono sincronizzati automaticamente su Supabase al ripristino della rete. | [FUNC] | P1 |
| **TC-SYNC-003**| SYSTEM | Risoluzione Concorrenza (Race Condition) | 2 utenti salvano contemporaneamente | 1. Utente A e Utente B salvano la stessa sessione nello stesso istante. | N/A | L'applicazione gestisce il salvataggio senza eccezioni o stato incerto, applicando l'ultimo aggiornamento valido. | [DQ] | P2 |

---

### MODULO 15: SCENARI END-TO-END (E2E) & BOUNDARY MATRIX

| ID Test | Ruolo | Titolo Test Case | Precondizioni | Passi di Esecuzione | Dati / Payload Input | Esito Atteso | Tipo | Pri. |
|---|---|---|---|---|---|---|---|---|
| **TC-E2E-001** | DM/PLAYER | Workflow Completo Flusso Campagna Live | 2 Account Utente | 1. DM crea campagna, mappe e capitolo 1.<br>2. Player esegue il join e crea il PG.<br>3. DM gioca la Sessione 1, prende note e genera recap AI.<br>4. Player legge il recap e aggiunge nota personale. | Flusso completo End-to-End | Nessun errore in console, sincronizzazione perfetta bidirezionale, permessi e segreti rispettati. | [E2E] | P1 |
| **TC-BND-001** | ALL | Stress Test Stringhe Estreme e Caratteri Speciali | Campi di testo | 1. Inserisci stringhe con oltre 5.000 caratteri, emoji, caratteri unicode e tag markdown nei campi titolo e contenuto. | `Unicode: ⚔️🛡️🐉, Markdown: # Header` | L'applicazione formatta e renderizza il testo in modo sicuro senza rompere il layout o generare crash. | [PERF] | P3 |
| **TC-BND-002** | ALL | Stress Test Numero Elevato di Entità e Mappe | Campagna con centinaia di elementi | 1. Carica una campagna contenente 200+ entità e 50+ mappe. | 200 Entità, 50 Mappe | I filtri di ricerca istantanea rispondono in < 100ms. La memoria rimane stabile. | [PERF] | P2 |

---

## ✒️ FIRMA E APPROVAZIONE REPORT DI COLLAUDO

- **Esito Collaudo Generale**: [ ] PASSED  |  [ ] FAILED  |  [ ] PASSED WITH WARNINGS
- **Note del QA Lead**: ____________________________________________________
- **Data Completamento Test**: ________________________
- **Firma QA Engineer**: ______________________________
