# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: master-flow.spec.ts >> E2E Suite: Flow Completo Dungeon Master (Master) >> Scenario E2E Master: Creazione Campagna, Gestione Entità con Note Segrete e Verifica Eredità Cross-View
- Location: e2e/master-flow.spec.ts:32:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a[href*="character"], a[href*="notes"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('a[href*="character"], a[href*="notes"]').first() with timeout 10000ms
  - waiting for locator('a[href*="character"], a[href*="notes"]').first()

```

```yaml
- banner:
  - text: Chronicle Tavolo delle Campagne master@test.com
  - button "Disconnetti account"
- main:
  - paragraph: ✦ Liber Campagnarum · I Tomi Attivi
  - heading "Il Tavolo delle Cronache" [level=1]
  - paragraph: Seleziona un tomo per entrare nella cronaca del tuo party, consulta i tuoi compagni d’avventura o forgia una nuova saga.
  - button "Inserisci Codice Invito"
  - button "Aggiorna elenco campagne"
  - button "Forgia Nuova Campagna"
  - heading "I Tuoi Tomi Registrati (1)" [level=2]
  - text: ⌜ ⌝ ⌞ ⌟ Dungeon Master DRAGO-999
  - heading "Cronache del Drago d'Oro" [level=3]
  - button "Invito"
  - button "Elimina definitivamente campagna (Solo Master)"
  - text: Apri Tomo
  - heading "Unisciti a un Party Esistente" [level=2]
  - paragraph: Hai ricevuto un link d'invito o un codice dal tuo Dungeon Master? Incolla qui il codice per registrare il tuo personaggio nel compendio di quel tavolo.
  - textbox "Incolla Link o Codice (es. WATERDEEP)"
  - button "Entra nel Party" [disabled]
  - text: Account Connesso
  - paragraph: master@test.com
  - button "Disconnetti Account"
- button
- heading "Forgia Nuova Campagna" [level=3]
- text: Creerai come Dungeon Master (DM)
- paragraph: Verrà generato un codice esclusivo da condividere con i tuoi giocatori per farli accedere al tuo tavolo.
- text: Questo codice è già in uso. Generane uno diverso. Nome della Campagna *
- textbox "Es. La Maledizione di Strahd": Cronache del Drago d'Oro
- text: Codice Campagna Generato
- button "Rigenera"
- textbox "Es. STRAHD-4821": DRAGO-999
- paragraph: Sono il Dungeon Master (DM)
- paragraph: Sarai il Master ufficiale con pieni poteri di gestione del tavolo
- checkbox [checked]
- button "Annulla"
- button "Crea & Entra come Master"
- contentinfo:
  - text: Chronicle • Portale delle Campagne
  - button "Privacy Policy"
  - text: •
  - button "Cookie Policy"
  - text: •
  - button "Termini & GDPR"
  - text: Tavolo di Ruolo Attivo • D&D 5E
```

# Test source

```ts
  1   | import { test, expect, TestInfo, Page } from '@playwright/test';
  2   | 
  3   | async function captureStep(page: Page, testInfo: TestInfo, stepName: string) {
  4   |   const screenshot = await page.screenshot({ fullPage: true });
  5   |   await testInfo.attach(stepName, { body: screenshot, contentType: 'image/png' });
  6   | }
  7   | 
  8   | test.describe('E2E Suite: Flow Completo Dungeon Master (Master)', () => {
  9   |   test.beforeEach(async ({ page }) => {
  10  |     await page.addInitScript(() => {
  11  |       localStorage.clear();
  12  |       const masterAccount = {
  13  |         id: 'master-1',
  14  |         email: 'master@test.com',
  15  |         characterName: 'Dungeon Master',
  16  |         color: '#6366f1',
  17  |         isDm: true,
  18  |         dmCampaigns: [],
  19  |         joinedCampaigns: [],
  20  |         campaignProfiles: {},
  21  |         createdAt: new Date().toISOString(),
  22  |       };
  23  |       localStorage.setItem('chronicle_global_user_accounts', JSON.stringify([masterAccount]));
  24  |       localStorage.setItem('chronicle_accounts_list', JSON.stringify([masterAccount]));
  25  |       localStorage.setItem('chronicle_current_account_id', 'master-1');
  26  |       localStorage.setItem('chronicle_global_active_user_id', 'master-1');
  27  |       localStorage.setItem('chronicle_tutorial_seen_master-1', 'true');
  28  |     });
  29  |     await page.goto('/');
  30  |   });
  31  | 
  32  |   test('Scenario E2E Master: Creazione Campagna, Gestione Entità con Note Segrete e Verifica Eredità Cross-View', async ({ page }, testInfo) => {
  33  |     await page.waitForLoadState('networkidle');
  34  | 
  35  |     await test.step('GIVEN 1: Il Master accede alla schermata di selezione/creazione campagna', async () => {
  36  |       const openCreateModalBtn = page.locator('#btn-open-create-modal');
  37  |       await expect(openCreateModalBtn).toBeVisible({ timeout: 15000 });
  38  |       await captureStep(page, testInfo, '1_master_campaign_gate.png');
  39  |     });
  40  | 
  41  |     await test.step('WHEN 2: Il Master crea una nuova campagna "Cronache del Drago d\'Oro" (Codice: DRAGO-999)', async () => {
  42  |       const openCreateModalBtn = page.locator('#btn-open-create-modal');
  43  |       if (await openCreateModalBtn.isVisible()) {
  44  |         await openCreateModalBtn.click();
  45  |         await page.waitForTimeout(300);
  46  | 
  47  |         const nameInput = page.locator('#create-camp-name-input');
  48  |         await nameInput.fill('Cronache del Drago d\'Oro');
  49  | 
  50  |         const codeInput = page.locator('#create-camp-code-input');
  51  |         await codeInput.fill('DRAGO-999');
  52  | 
  53  |         const submitBtn = page.locator('#btn-submit-create-campaign');
  54  |         await submitBtn.click();
  55  |         await page.waitForTimeout(1000);
  56  |       }
  57  | 
  58  |       await captureStep(page, testInfo, '2_master_campaign_created.png');
  59  |     });
  60  | 
  61  |     await test.step('THEN 3: L\'interfaccia accede al Tomo della campagna e mostra i moduli del Master', async () => {
  62  |       const characterLink = page.locator('a[href*="character"], a[href*="notes"]').first();
> 63  |       await expect(characterLink).toBeVisible();
      |                                   ^ Error: expect(locator).toBeVisible() failed
  64  |       await captureStep(page, testInfo, '3_master_dashboard_loaded.png');
  65  |     });
  66  | 
  67  |     await test.step('WHEN 4: Il Master crea l\'NPC "Eldrin il Saggio" con Note Segrete DM nel Codex', async () => {
  68  |       const codexNav = page.locator('a[href*="entities"], a[href*="codex"], button:has-text("Codex"), button:has-text("Entità")').first();
  69  |       if (await codexNav.isVisible()) {
  70  |         await codexNav.click();
  71  |         await page.waitForTimeout(500);
  72  |       }
  73  | 
  74  |       const createEntityBtn = page.locator('button:has-text("Nuova Entità"), button:has-text("+ Entità"), button:has-text("Aggiungi Entità")').first();
  75  |       if (await createEntityBtn.isVisible()) {
  76  |         await createEntityBtn.click();
  77  |         await page.waitForTimeout(400);
  78  | 
  79  |         const nameInput = page.locator('input[placeholder*="Nome"], input[name="name"]').first();
  80  |         if (await nameInput.isVisible()) {
  81  |           await nameInput.fill('Eldrin il Saggio');
  82  |         }
  83  | 
  84  |         const dmNotesInput = page.locator('textarea[placeholder*="Segret"], textarea[placeholder*="Master"], textarea[name="dmNotes"]').first();
  85  |         if (await dmNotesInput.isVisible()) {
  86  |           await dmNotesInput.fill('SEGRETO MASTER: Eldrin custodisce in segreto la gemma dell\'Anima.');
  87  |         }
  88  | 
  89  |         const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea"), button[type="submit"]').first();
  90  |         if (await saveBtn.isVisible()) {
  91  |           await saveBtn.click();
  92  |           await page.waitForTimeout(600);
  93  |         }
  94  |       }
  95  | 
  96  |       await captureStep(page, testInfo, '4_master_entity_created.png');
  97  |     });
  98  | 
  99  |     await test.step('THEN 5: Il Master effettua una Ricerca Globale e trova l\'entità creata', async () => {
  100 |       const searchNav = page.locator('a[href*="search"], button:has-text("Cerca"), button:has-text("Ricerca")').first();
  101 |       if (await searchNav.isVisible()) {
  102 |         await searchNav.click();
  103 |         await page.waitForTimeout(500);
  104 | 
  105 |         const searchInput = page.locator('input[type="text"], input[placeholder*="Cerca"]').first();
  106 |         if (await searchInput.isVisible()) {
  107 |           await searchInput.fill('Eldrin');
  108 |           await page.waitForTimeout(500);
  109 |           await expect(page.locator('body')).toContainText('Eldrin');
  110 |         }
  111 |       }
  112 | 
  113 |       await captureStep(page, testInfo, '5_master_global_search_results.png');
  114 |     });
  115 | 
  116 |     await test.step('WHEN 6: Il Master registra la Sessione 1 ("La Profezia del Drago")', async () => {
  117 |       const sessionsNav = page.locator('a[href*="sessions"], button:has-text("Sessioni")').first();
  118 |       if (await sessionsNav.isVisible()) {
  119 |         await sessionsNav.click();
  120 |         await page.waitForTimeout(500);
  121 | 
  122 |         const addSessionBtn = page.locator('button:has-text("Nuova Sessione"), button:has-text("Aggiungi Sessione")').first();
  123 |         if (await addSessionBtn.isVisible()) {
  124 |           await addSessionBtn.click();
  125 |           await page.waitForTimeout(300);
  126 | 
  127 |           const titleInput = page.locator('input[placeholder*="Titolo"], input[name="title"]').first();
  128 |           if (await titleInput.isVisible()) {
  129 |             await titleInput.fill('Sessione 1: La Profezia del Drago');
  130 |           }
  131 | 
  132 |           const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea")').first();
  133 |           if (await saveBtn.isVisible()) {
  134 |             await saveBtn.click();
  135 |             await page.waitForTimeout(500);
  136 |           }
  137 |         }
  138 |       }
  139 | 
  140 |       await captureStep(page, testInfo, '6_master_session_created.png');
  141 |     });
  142 | 
  143 |     await test.step('THEN 7: Il Master verifica le Impostazioni della Campagna e il QR Code di Invito', async () => {
  144 |       const settingsNav = page.locator('a[href*="settings"], button:has-text("Impostazioni")').first();
  145 |       if (await settingsNav.isVisible()) {
  146 |         await settingsNav.click();
  147 |         await page.waitForTimeout(500);
  148 |         await expect(page.locator('body')).toContainText('DRAGO-999');
  149 |       }
  150 | 
  151 |       await captureStep(page, testInfo, '7_master_campaign_settings_and_qr.png');
  152 |     });
  153 |   });
  154 | });
  155 | 
```