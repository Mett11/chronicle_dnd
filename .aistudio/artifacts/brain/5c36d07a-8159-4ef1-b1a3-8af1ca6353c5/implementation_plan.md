# 📋 Piano di Implementazione: Espansione Testbook Completi (DM e Giocatore)

## 📌 Obiettivo
Trasformare i Testbook in **manuali di collaudo ed erogazione test altamente rigorosi** per **Dungeon Master (DM/Co-DM)** e **Giocatori (Player)**. Ciascun caso di test comprenderà dati di input espliciti, criteri di asserzione, verifiche di sicurezza, gestione degli errori e copertura di tutti gli edge case critici richiamati.

---

## 📐 Struttura Standardizzata dei Casi di Test

Ciascun caso di test nei nuovi documenti conterrà la seguente scheda formattata:
- **ID & Titolo**: Identificativo univoco e priorità (`P0` Critico, `P1` Alto, `P2` Medio).
- **Ambito & Tag**: Area di appartenenza (es. *Sicurezza*, *IA Sync*, *Media*, *Concorrenza*).
- **Pre-condizioni**: Stato iniziale necessario.
- **Dati di Input di Test**: Stringhe, URL, file, payload o ruoli specifici usati durante la prova.
- **Procedura Passo-Passo**: Azioni dettagliate da compiere nell'interfaccia o tramite devtools.
- **Risultato Atteso**: Comportamento corretto dell'applicazione.
- **Criteri di Asserzione (Pass/Fail)**: Verifiche oggettive per decretare il successo della prova.
- **Casi Limite ed Errori Gestiti (Edge Cases)**: Cosa succede in condizioni anomale (network disconnesso, dati corrotti, tentativi di scavalcamento permessi).

---

## 🎲 1. Ampliamento Testbook Dungeon Master (`docs/TESTBOOK_DM.md`)

I casi di test per il DM passeranno da 10 ad alto livello a **15 scenari di collaudo approfonditi**, organizzati nelle seguenti macro-aree:

1. **Sicurezza e Riservatezza dei Segreti DM (P0)**:
   - **TC-DM-SEC-01**: Creazione di Segreti DM e verifica che non vengano esposti nel DOM/payload di rete per gli utenti non-DM.
   - **TC-DM-SEC-02**: Passaggio di un giocatore a Co-DM e revoca dei permessi (modifica al volo dei privilegi durante una sessione attiva).
2. **Sincronizzazione Memoria IA ed Edge Cases dei Recap (P0/P1)**:
   - **TC-DM-AI-01**: Analisi di Recap con testo vuoto, lunghissimo (>10.000 parole) o contenente formattazione Markdown/HTML complessa.
   - **TC-DM-AI-02**: Rilevamento allucinazioni o nomi errati nelle memorie estratte dall'IA e verifica delle modifiche manuali del DM prima dell'applicazione.
   - **TC-DM-AI-03**: Calcolo dei *Trust Levels* (1-10) with personaggi fortemente ostili o neutri (verifica che l'IA non assegni livelli di fiducia di default pari a 8/10).
3. **Mappe, Pin e Gestione File Media (P1)**:
   - **TC-DM-MAP-01**: Caricamento mappe ad altissima risoluzione (4K/8K, WebP/PNG) e verifica del limite di peso/performance.
   - **TC-DM-MAP-02**: Posizionamento Pin ai margini o fuori dai confini della mappa e gestione dei filtri per la Nebbia di Guerra (*Fog of War*).
4. **Concorrenza e Persistenza dello Stato (P0/P1)**:
   - **TC-DM-SYNC-01**: Modifica contemporanea di una sessione da parte di un DM e di un Co-DM (gestione conflitti di scrittura).
   - **TC-DM-SYNC-02**: Creazione e cancellazione rapida di entità del Codex e verifica della sincronizzazione immediata su Supabase/Firestore.
5. **Storyline e Regia delle Copertine (P1)**:
   - **TC-DM-STORY-01**: Generazione slide Storyline con capitolo senza copertina, sessioni con immagini multiple e sessioni senza foto (verifica assenza di duplicazioni).

---

## ⚔️ 2. Ampliamento Testbook Giocatore (`docs/TESTBOOK_PLAYER.md`)

I casi di test per il Giocatore verranno espansi a **15 scenari di collaudo completi**, focalizzati sulle seguenti casistiche:

1. **Sicurezza e Tentativi di Scavalcamento (P0)**:
   - **TC-PL-SEC-01**: Tentativo di accesso diretto agli URL di edit/DM tramite modifica della rotte o ispezione elementi (verifica blocco permessi).
   - **TC-PL-SEC-02**: Cambio di campagna attiva nell'account e verifica che l'avatar di campagna A non sovrascriva l'avatar della campagna B.
2. **Interazioni Sociali e Mappa delle Relazioni (P1)**:
   - **TC-PL-REL-01**: Visualizzazione e modifica delle note di relazione tra PG con caratteri speciali, emoji o testo lungo.
   - **TC-PL-REL-02**: Lettura dei badge di fiducia e verifica della corretta corrispondenza tra l'avatar mostrato sul nodo e l'avatar reale del PG.
3. **Storyline e Presentation Mode (P1/P2)**:
   - **TC-PL-STORY-01**: Sfoglio Storyline da dispositivi mobile/touchscreen e verifica del corretto ordine cronologico (Slide Copertina Capitolo -> Sessioni).
4. **Oracolo IA e Risposte Protette (P0/P1)**:
   - **TC-PL-AI-01**: Domande dell'Oracolo IA su segreti non ancora scoperti o PNG nascosti (verifica che l'Oracolo non riveli le informazioni riservate al DM).
   - **TC-PL-AI-02**: Gestione del timeout di rete o errore di quota provider durante le domande all'Oracolo.

---

## 🔄 Prossimi Passi
Una volta confermato questo piano, aggiornerò direttamente i file `docs/TESTBOOK_DM.md` e `docs/TESTBOOK_PLAYER.md` inserendo tutte le schede dettagliate e la matrice di tracciabilità.
