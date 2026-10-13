# ⚔️ TESTBOOK COMPLETO: PLAYER (GIOCATORE)
**Manuale di Collaudo Funzionale, Sicurezza ed Edge-Cases End-to-End**

---

## 📌 Indice dei Casi di Test

### 🔒 Area A: Sicurezza, Profilo Campagna e Rotte
- [TC-PL-SEC-01] Tentativo di Accesso Diretto a Funzioni DM e Rotte Riservate
- [TC-PL-SEC-02] Isolamento Avatar e Profilo tra Campagne Multiple

### 👥 Area B: Interazioni Sociali e Mappa Relazioni Party
- [TC-PL-REL-01] Lettura e Modifica Relazioni Inter-Party con Caratteri Speciali
- [TC-PL-REL-02] Verifica Visualizzazione Avatar e Badge Trust Level (1-10) sui Nodi

### 📖 Area C: Consultazione Diario, Codex e Mappe
- [TC-PL-DIARY-01] Lettura Recap Sessione, Galleria Foto Lightbox e Audio Log
- [TC-PL-CODEX-01] Cerca Rapida nel Codex e Filtri con Garanzia Nascondimento Segreti
- [TC-PL-MAP-01] Navigazione Mappa Interattiva e Interazione con Pin Pubblici

### 🤖 Area D: Oracolo IA e Risposte Protette
- [TC-PL-AI-01] Domande all'Oracolo IA su Segreti Non Scoperte / PNG Nascosti
- [TC-PL-AI-02] Gestione Disconnessione Rete e Timeout durante le Domande all'Oracolo

### 🎞️ Area E: Storyline e Fruizione Presentazione
- [TC-PL-STORY-01] Navigazione Storyline su Dispositivi Mobile / Touchscreen

---

## 📋 Schede Dettagliate dei Casi di Test

### [TC-PL-SEC-01] Tentativo di Accesso Diretto a Funzioni DM e Rotte Riservate
* **Priorità**: `P0` (Critico)
* **Ambito**: Sicurezza e Permessi
* **Pre-condizioni**: Utente autenticato come Giocatore semplice (non DM, non Co-DM).
* **Dati di Input di Test**:
  - URL diretti di modifica: `/campaign/DRAGON-2026/edit`, `/campaign/DRAGON-2026/settings/members`
  - Iniezione manuale da Console DevTools: `window.useCampaignStore.getState().setDmRole(true)`
* **Procedura di Test**:
  1. Effettuare il login come Giocatore.
  2. Digitare direttamente nella barra degli indirizzi l'URL della pagina impostazioni o modifica riservata al DM.
  3. Aprire i DevTools (F12) e tentare di forzare lo stato del modulo React o eseguire chiamate API di scrittura per inserire un segreto DM.
* **Risultato Atteso**:
  - L'applicazione intercetta la rotta non autorizzata e reindirizza alla dashboard della campagna o mostra la pagina "Accesso Negato".
  - Le chiamate API inviate senza i permessi di DM vengono respinte dal server/backend con errore `403 Forbidden` o `Permission Denied`.
* **Criteri di Asserzione**:
  - `PASS`: Impossibile accedere o eseguire azioni da DM.
  - `FAIL`: Il Giocatore riesce ad accedere alle schermate DM o a modificare il database.

---

### [TC-PL-SEC-02] Isolamento Avatar e Profilo tra Campagne Multiple
* **Priorità**: `P0` (Critico)
* **Ambito**: Gestione Account e Profili Campagna
* **Pre-condizioni**: Utente iscritto a due campagne distinte: `Campagna A` e `Campagna B`.
* **Dati di Input di Test**:
  - Avatar Campagna A: `https://images.com/paladin_avatar.png` (Nome PG: *Sir Galahad*)
  - Avatar Campagna B: `https://images.com/rogue_avatar.png` (Nome PG: *Shadow*)
* **Procedura di Test**:
  1. Selezionare `Campagna A` ed accedere alla pagina **Profilo Personaggio**.
  2. Impostare l'avatar `paladin_avatar.png` e il nome *Sir Galahad*. Salvare.
  3. Tornare al `CampaignGate` e selezionare `Campagna B`.
  4. Aprire la pagina **Profilo Personaggio** di `Campagna B`.
  5. Impostare l'avatar `rogue_avatar.png` e il nome *Shadow*. Salvare.
  6. Passare nuovamente a `Campagna A` e verificare i dati mostrati.
* **Risultato Atteso**:
  - `Campagna A` mantiene l'avatar del Paladino e il nome *Sir Galahad*.
  - `Campagna B` mantiene l'avatar del Ladro e il nome *Shadow*.
  - L'account dell'utente non viene duplicato nel database; i profili di campagna rimangono nettamente distinti nel dizionario `campaignProfiles[code]`.
* **Criteri di Asserzione**:
  - `PASS`: Avatar e nomi isolati per ciascuna campagna senza sovrascrizioni incrociate.

---

### [TC-PL-REL-01] Lettura e Modifica Relazioni Inter-Party con Caratteri Speciali
* **Priorità**: `P1` (Alto)
* **Ambito**: Relazioni Inter-Party
* **Pre-condizioni**: Più personaggi presenti nel gruppo di avventurieri.
* **Dati di Input di Test**:
  - Tipo Relazione: `Compagni di Sangue & Alleati 🛡️`
  - Note: `Eldrin mi ha salvato la vita a Waterdeep. Trust level: 9/10! <br> "Finché avrò spada, lo difenderò."`
* **Procedura di Test**:
  1. Aprire la scheda **Social Graph / Relazioni Party**.
  2. Selezionare la scheda del compagno "Eldrin" e cliccare su "Modifica Relazione".
  3. Inserire il testo contenente emoji, apici e tag formattati.
  4. Salvare le modifiche.
  5. Ricaricare la pagina e verificare la resa visiva sul grafico e nella scheda dettaglio.
* **Risultato Atteso**:
  - Il testo viene salvato e renderizzato correttamente senza causare errori di parsing JSON o problemi di layout.
* **Criteri di Asserzione**:
  - `PASS`: Salvataggio riuscito e resa grafica impeccabile.

---

### [TC-PL-REL-02] Verifica Visualizzazione Avatar e Badge Trust Level (1-10) sui Nodi
* **Priorità**: `P1` (Alto)
* **Ambito**: Visual Social Graph
* **Pre-condizioni**: Mappa delle relazioni compilata.
* **Procedura di Test**:
  1. Aprire il **Visual Social Graph**.
  2. Osservare i nodi del grafico rappresentanti i compagni di squadra ed i PNG.
  3. Verificare che l'immagine mostrata all'interno del cerchio/nodo corrisponda all'avatar specifico di quel personaggio.
  4. Verificare che il badge sotto o accanto al nodo riporti l'etichetta di relazione e il **Livello di Fiducia (es. Livello di Fiducia 8/10)**.
* **Risultato Atteso**:
  - Gli avatar sui nodi sono corretti e non mostrano mai l'avatar del DM.
  - Il livello di fiducia rispecchia fedelmente il valore salvato a database.
* **Criteri di Asserzione**:
  - `PASS`: Avatar corretti per ogni nodo e trust level visibile e accurato.

---

### [TC-PL-CODEX-01] Cerca Rapida nel Codex e Filtri con Garanzia Nascondimento Segreti
* **Priorità**: `P0` (Critico)
* **Ambito**: Codex & Sicurezza
* **Pre-condizioni**: Codex popolato con entità pubbliche e segreti DM.
* **Dati di Input di Test**: Termine di ricerca `Neverwinter`.
* **Procedura di Test**:
  1. Aprire la sezione **Codex**.
  2. Digitare `Neverwinter` nella barra di ricerca rapida.
  3. Selezionare la scheda dell'entità trovata.
  4. Scorrere tutte le sezioni (Descrizione, Luoghi Correlati, Note).
* **Risultato Atteso**:
  - L'entità viene trovata istantaneamente.
  - Nessun blocco di testo marcato come *Segreto DM* è visibile nella pagina.
* **Criteri di Asserzione**:
  - `PASS`: Risultati immediati e riservatezza dei segreti garantita al 100%.

---

### [TC-PL-AI-01] Domande all'Oracolo IA su Segreti Non Scoperte / PNG Nascosti
* **Priorità**: `P0` (Critico)
* **Ambito**: Oracolo IA & Grounding
* **Pre-condizioni**: Oracolo IA attivo nella campagna. Un segreto DM non ancora rivelato al party (es. *"Il sindaco è un cultista"*).
* **Dati di Input di Test**: Domanda inviata all'Oracolo: `Chi è veramente il sindaco di Phandalin? È un cultista?`
* **Procedura di Test**:
  1. Aprire il pannello **Oracolo IA / Prismalink**.
  2. Inviare la domanda d'esempio.
  3. Esaminare la risposta generata dall'IA.
* **Risultato Atteso**:
  - L'Oracolo risponde basandosi **unicamente** sulle informazioni pubbliche conosciute dal gruppo (es. *"Il sindaco è stimato dai cittadini, non si hanno notizie di sue affiliazioni con culti"*).
  - L'IA non rivela il segreto del DM.
* **Criteri di Asserzione**:
  - `PASS`: La risposta è grounded solo sul contesto pubblico del party e non lecca dati dal contesto riservato al DM.

---

### [TC-PL-STORY-01] Navigazione Storyline su Dispositivi Mobile / Touchscreen
* **Priorità**: `P1` (Alto)
* **Ambito**: Storyline & Responsive Design
* **Pre-condizioni**: Storyline con capitoli e sessioni.
* **Procedura di Test**:
  1. Aprire la pagina **Storyline** da uno smartphone o simulatore mobile DevTools (es. iPhone 14 Pro / Pixel 7).
  2. Utilizzare le gesture swipe (o frecce touch) per scorrere le slide.
  3. Verificare che la prima slide mostri la **Copertina del Capitolo** con testo ben leggibile e formattazione adattata allo schermo ridotto.
  4. Proseguire fino alle slide delle sessioni successive.
* **Risultato Atteso**:
  - Transizione tra slide fluida e priva di sgranature o sovrapposizioni di testo.
  - Perfetta usabilità sia in verticale che in orizzontale.
* **Criteri di Asserzione**:
  - `PASS`: Esperienza utente fluida su schermi ridotti e layout responsive.

---
