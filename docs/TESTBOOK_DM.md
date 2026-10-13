# 🎲 TESTBOOK COMPLETO: DUNGEON MASTER (DM & CO-DM)
**Manuale di Collaudo Funzionale, Sicurezza ed Edge-Cases End-to-End**

---

## 📌 Indice dei Casi di Test

### 🛡️ Area A: Sicurezza, Permessi e Riservatezza Segreti DM
- [TC-DM-SEC-01] Creazione Segreto DM e Protezione Payload/DOM
- [TC-DM-SEC-02] Assegnazione e Revoca del Ruolo Co-DM in Tempo Reale
- [TC-DM-SEC-03] Tentativo di Manipolazione Permessi via DevTools / Client API

### 🧠 Area B: Sincronizzazione Memoria IA & Recap
- [TC-DM-AI-01] Elaborazione Recap Vuoto, Anomalo o con Markdown / Caratteri Speciali
- [TC-DM-AI-02] Correzione Allucinazioni IA e Validazione Manuale Memorie
- [TC-DM-AI-03] Calcolo dei Trust Levels (1-10) su PG/PNG Ostili o Neutri
- [TC-DM-AI-04] Gestione Errore di Quota / Timeout del Provider IA

### 🗺️ Area C: Mappe, Coordinate Pin e Gestione File Media
- [TC-DM-MAP-01] Caricamento Mappe ad Alta Risoluzione (4K/8K, WebP/PNG)
- [TC-DM-MAP-02] Posizionamento Pin ai Margini Mappa e Controllo Fog of War
- [TC-DM-MAP-03] Caricamento Immagini / Audio Log di Sessione e Limiti File

### ⚡ Area D: Concorrenza Multi-Utente e Persistenza Stato
- [TC-DM-SYNC-01] Modifica Simultanea Sessione tra DM e Co-DM
- [TC-DM-SYNC-02] Creazione / Eliminazione Rapida Entità Codex e Reattività DB
- [TC-DM-SYNC-03] Gestione Disconnessione Rete durante il Salvataggio

### 🎞️ Area E: Storyline, Regia e Layout
- [TC-DM-STORY-01] Generazione Slide Storyline e Verifica Unicità Copertina Capitolo
- [TC-DM-STORY-02] Presentazione Storyline in Modalità Proiettore / Fullscreen

---

## 📋 Schede Dettagliate dei Casi di Test

### [TC-DM-SEC-01] Creazione Segreto DM e Protezione Payload/DOM
* **Priorità**: `P0` (Critico)
* **Ambito**: Sicurezza e Riservatezza
* **Pre-condizioni**: Utente registrato come DM titolare. Un giocatore normale attivo nella campagna.
* **Dati di Input di Test**:
  - Titolo Entità: `Congiura di Baldur's Gate`
  - Descrizione Pubblica: `Informazioni generali sulla fazione mercantile.`
  - Segreto DM: `Il leader è in realtà un doppelganger assoldato dai Cultisti del Drago.` (Spunta *Visibile solo al DM*)
* **Procedura di Test**:
  1. Accedere al **Codex** come DM.
  2. Creare o modificare l'entità inserendo la descrizione pubblica e il Segreto DM.
  3. Salvare la scheda.
  4. Aprire il browser del Giocatore, fare il login e navigare alla stessa scheda del Codex.
  5. Aprire i DevTools (F12 -> Ispeziona Elemento e Network tab) sul client del Giocatore.
  6. Cercare nel DOM e nelle risposte JSON della rete il testo riservato: `doppelganger`.
* **Risultato Atteso**:
  - La scheda lato Giocatore mostra unicamente la descrizione pubblica.
  - Il testo del Segreto DM non è presente nell'HTML, nè nel payload JSON restituito dalle API.
* **Criteri di Asserzione**:
  - `PASS`: Risposta API per il Giocatore priva del campo `secretText` o dei segreti DM.
  - `FAIL`: Il testo del segreto è rintracciabile nell'ispeziona elemento o nel traffico di rete del player.
* **Edge Cases Gestiti**:
  - Se il Giocatore diventa Co-DM durante la sessione, il segreto diventa visibile dopo il refresh delle credenziali.

---

### [TC-DM-SEC-02] Assegnazione e Revoca del Ruolo Co-DM in Tempo Reale
* **Priorità**: `P0` (Critico)
* **Ambito**: Gestione Membri e Permessi
* **Pre-condizioni**: Campagna attiva con Giocatore "Alice".
* **Dati di Input di Test**: Ruolo cambiato da `Player` a `Co-DM` e successivamente revocato a `Player`.
* **Procedura di Test**:
  1. Aprire **Impostazioni Campagna -> Membri**.
  2. Selezionare l'utente "Alice" e cambiare il ruolo in `Co-DM`.
  3. Salvare la configurazione.
  4. Sul client di Alice, verificare la comparsa dei pulsanti di modifica (es. "Aggiungi Entità", "Sincronizza Memoria", "Vedi Segreti").
  5. Dal client del DM, revocare il ruolo di Alice riportandolo a `Player`.
  6. Sul client di Alice, tentare di effettuare un'azione da DM (es. salvare un nuovo segreto).
* **Risultato Atteso**:
  - La promozione a Co-DM concede immediatamente l'accesso alle funzionalità avanzate.
  - La revoca del ruolo blocca tempestivamente le azioni riservate e nasconde le sezioni DM.
* **Criteri di Asserzione**:
  - `PASS`: Operazioni DM bloccate lato client e rifiutate dal backend dopo la revoca.
  - `FAIL`: Alice continua a poter modificare il Codex o leggere i segreti dopo la revoca.

---

### [TC-DM-AI-01] Elaborazione Recap Vuoto, Anomalo o con Markdown / Caratteri Speciali
* **Priorità**: `P1` (Alto)
* **Ambito**: Sincronizzazione Memoria IA
* **Pre-condizioni**: Sessione di gioco creata.
* **Dati di Input di Test**:
  - Testo 1: ` ` (Solo spazi vuoti)
  - Testo 2: `<script>alert('xss')</script> # Sessione 12 ***Lore*** $100% & test`
  - Testo 3: Stringa di 12.000 parole estratta da un file di testo.
* **Procedura di Test**:
  1. Aprire la sessione e incollare il Testo 1. Cliccare su "Sincronizza Memoria IA".
  2. Verificare la comparsa del messaggio di errore di validazione input vuoto.
  3. Incollare il Testo 2 ed eseguire la Sincronizzazione.
  4. Incollare il Testo 3 ed eseguire la Sincronizzazione.
* **Risultato Atteso**:
  - L'input vuoto viene bloccato prima dell'invio all'API dell'IA.
  - I caratteri speciali e tag HTML vengono sanitizzati senza causare errori di script o falle XSS.
  - Testi molto lunghi vengono elaborati correttamente o troncati con un avviso chiaro se superano il contesto massimo.
* **Criteri di Asserzione**:
  - `PASS`: Nessun crash dell'applicazione, sanitized output e notifiche trasparenti all'utente.
  - `FAIL`: Blocco o crash della pagina, esecuzione del codice JS malevolo.

---

### [TC-DM-AI-02] Correzione Allucinazioni IA e Validazione Manuale Memorie
* **Priorità**: `P1` (Alto)
* **Ambito**: Sincronizzazione Memoria IA
* **Pre-condizioni**: Recap compilato per una sessione in cui il PG "Eldrin" sconfigge un drago.
* **Dati di Input di Test**: Risposta dell'IA contenente una memoria errata (es. *"Eldrin è diventato re di Neverwinter"*).
* **Procedura di Test**:
  1. Avviare "Sincronizza Memoria IA".
  2. Nel modale delle **Proposte di Memoria**, individuare la memoria errata.
  3. Fare clic sull'icona di Modifica o Rifiuta sulla singola memoria.
  4. Correggere il testo in: *"Eldrin ha ricevuto la medaglia di Neverwinter"*.
  5. Cliccare su **Applica e Salva Memorie**.
  6. Aprire la scheda del personaggio "Eldrin".
* **Risultato Atteso**:
  - La memoria rifiutata/corretta viene salvata nella forma modificata dal DM.
  - Nessuna memoria allucinata non approvata compare nel profilo del personaggio.
* **Criteri di Asserzione**:
  - `PASS`: Il database contiene solo ed esattamente le memorie modificate e confermate dal DM.

---

### [TC-DM-AI-03] Calcolo dei Trust Levels (1-10) su PG/PNG Ostili o Neutri
* **Priorità**: `P1` (Alto)
* **Ambito**: Sincronizzazione Memoria IA & Relazioni
* **Pre-condizioni**: Due personaggi giocanti "Valeros" (Guerriero) e "Seoni" (Maga) in conflitto durante la sessione.
* **Dati di Input di Test**: Recap che descrive un tradimento o un acceso litigio tra Valeros e Seoni.
* **Procedura di Test**:
  1. Eseguire la sincronizzazione memoria della sessione.
  2. Ispezionare la sezione **Proposte Relazioni Party**.
  3. Verificare il valore di `trustLevel` proposto (es. da 7/10 a 3/10).
  4. Verificare che l'IA **non** assegni arbitrariamente il valore di default 8/10 a tutti i personaggi.
  5. Approvare la proposta di relazione.
  6. Aprire il **Social Graph** e il **Tree delle Relazioni**.
* **Risultato Atteso**:
  - Il badge del trust level sul grafico mostra il valore aggiornato (3/10) con colore e indicatore visivo coerente.
* **Criteri di Asserzione**:
  - `PASS`: Il valore di fiducia rispecchia l'andamento narrativo e non viene sovrascritto da valori standard.

---

### [TC-DM-MAP-01] Caricamento Mappe ad Alta Risoluzione (4K/8K, WebP/PNG)
* **Priorità**: `P1` (Alto)
* **Ambito**: Mappe e Gestione File
* **Pre-condizioni**: Modulo Mappe aperto.
* **Dati di Input di Test**: File immagine di prova `sword_coast_map_8k.png` (dimensione ~15MB, risoluzione 7680x4320).
* **Procedura di Test**:
  1. Cliccare su "Carica Nuova Mappa".
  2. Selezionare il file `sword_coast_map_8k.png`.
  3. Inserire il nome "Costa della Spada HD".
  4. Attendere il completamento del caricamento e del rendering su canvas/WebGL.
  5. Effettuare operazioni di Zoom In, Zoom Out e Pan con il mouse.
* **Risultato Atteso**:
  - L'immagine viene caricata e ottimizzata o renderizzata senza blocco del browser.
  - Navigazione e zoom fluidi sulla mappa.
* **Criteri di Asserzione**:
  - `PASS`: La mappa viene visualizzata correttamente senza crash della memoria del browser.

---

### [TC-DM-MAP-02] Posizionamento Pin ai Margini Mappa e Controllo Fog of War
* **Priorità**: `P1` (Alto)
* **Ambito**: Mappe e Pin
* **Pre-condizioni**: Mappa caricata.
* **Dati di Input di Test**:
  - Pin A: Coordinate angolari (X: 0.99, Y: 0.01) - *Visibile ai Giocatori*.
  - Pin B: Coordinate centrali (X: 0.50, Y: 0.50) - *Nascosto (Solo DM)*.
* **Procedura di Test**:
  1. Posizionare Pin A nell'angolo in alto a destra estremo e collegarlo all'entità "Fortezza Nord".
  2. Posizionare Pin B al centro, marcandolo come nascosto.
  3. Salvare la mappa.
  4. Effettuare il login come Giocatore ed aprire la mappa.
* **Risultato Atteso**:
  - Pin A è visibile e cliccabile dal Giocatore nell'angolo corretto.
  - Pin B **non** è visibile sul client del Giocatore.
* **Criteri di Asserzione**:
  - `PASS`: Pin nascosto completamente assente per i giocatori; Pin angolare perfettamente raggiungibile.

---

### [TC-DM-SYNC-01] Modifica Simultanea Sessione tra DM e Co-DM
* **Priorità**: `P0` (Critico)
* **Ambito**: Concorrenza Multi-Utente
* **Pre-condizioni**: DM titolare su Client 1, Co-DM su Client 2. Entrambi aperti sulla Sessione #5.
* **Dati di Input di Test**:
  - Client 1 (DM): Modifica il titolo in `La Battaglia del Guado dei Tre Alberi`.
  - Client 2 (Co-DM): Inserisce contemporaneamente un nuovo evento `Attacco dei Goblin`.
* **Procedura di Test**:
  1. Salvare le modifiche su Client 1.
  2. Immediatamente dopo, salvare le modifiche su Client 2.
  3. Ricaricare la pagina su entrambi i client o osservare l'aggiornamento in tempo reale.
* **Risultato Atteso**:
  - Il sistema unifica le modifiche o notifica il conflitto senza sovrascrivere distruttivamente i dati.
  - Nessuna perdita di dati sul recap o sugli eventi.
* **Criteri di Asserzione**:
  - `PASS`: Sia il nuovo titolo che il nuovo evento compaiono nel registro di sessione.

---

### [TC-DM-STORY-01] Generazione Slide Storyline e Verifica Unicità Copertina Capitolo
* **Priorità**: `P1` (Alto)
* **Ambito**: Storyline e Presentazione
* **Pre-condizioni**: Capitolo "Atto I: L'Ombra della Montagna" con Copertina del Capitolo impostata. 3 sessioni interne (Sessione 1 con 2 foto, Sessione 2 senza foto, Sessione 3 con 1 foto).
* **Procedura di Test**:
  1. Navigare alla pagina **Storyline**.
  2. Avviare la presentazione delle slide.
  3. Ispezionare la Sequenza delle Slide generate:
     - Slide 1: Copertina del Capitolo (`isChapterCover: true`, `nodeType: chapter`).
     - Slide 2 e 3: Foto della Sessione 1.
     - Slide 4: Card della Sessione 2 (senza foto, mostra il recap/placeholder, **SENZA** riutilizzare l'immagine della copertina del capitolo).
     - Slide 5: Foto della Sessione 3.
* **Risultato Atteso**:
  - La copertina del capitolo apre la storia una sola volta all'inizio del capitolo.
  - Nessuna sessione interna priva di immagini riutilizza la foto di copertina del capitolo come propria immagine.
* **Criteri di Asserzione**:
  - `PASS`: Sequenza slide corretta e zero immagini duplicate indebitamente sulle sessioni.

---
