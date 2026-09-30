# Chronicle

Un diario di campagna D&D per il tuo party, progettato per l'uso al tavolo.

## Configurazione Sanity

1. Crea un progetto Sanity (`npx sanity@latest init`).
2. Sostituisci i file in `schemaTypes` (nello Studio) con quelli che trovi in `sanity/schemas` in questo progetto.
3. Esegui il deploy del progetto Sanity (`npx sanity deploy`).
4. Da [Sanity Manage](https://manage.sanity.io), invita i tuoi giocatori tramite l'email del loro account Google/GitHub. **Solo gli utenti invitati nel progetto Sanity (es. ruolo Viewer o Editor) avranno accesso**.
5. Vai nella sezione **API > CORS origins** in Sanity Manage e aggiungi l'URL della tua webapp (es. `http://localhost:3000` per lo sviluppo locale e il dominio finale di produzione) abilitando "Allow credentials".

## Variabili d'ambiente

Configura le seguenti variabili d'ambiente (copiando `.env.example` in `.env.local`):
- `VITE_SANITY_PROJECT_ID`: L'ID del tuo progetto Sanity.
- `VITE_SANITY_DATASET`: Dataset (solitamente `production`).

## Seed Iniziale (Manuale nello Studio)

Il DB Sanity partirà vuoto. Prima di usare l'app, accedi a Sanity Studio (es. `localhost:3333`) e crea:
1. **Categorie**: "Lore", "Obiettivi", "Mostri", "Luoghi", "NPC", "Oggetti", "Fazioni", "Sessioni", "Teorie".
2. **Player placeholder**: Crea i player inserendo almeno "Nome Personaggio", selezionando eventuali colori/avatar e inserendo la loro "Email" (lowercase).
3. **DM**: Assicurati di creare il tuo player (DM) con la tua email esatta e metti la spunta su `isDm: true`.

L'app rileverà l'utente loggato, mapperà l'email con il player e salverà il `sanityUserId` per le future sessioni.

## Avvio App

```bash
npm install
npm run dev
```

## Produzione

Puoi effettuare la build ed eseguire il deploy su servizi statici (es. Cloudflare Pages, Vercel, Netlify):

```bash
npm run build
```
Ricordati di aggiornare il CORS in Sanity Manage e le variabili d'ambiente nella piattaforma di hosting.
