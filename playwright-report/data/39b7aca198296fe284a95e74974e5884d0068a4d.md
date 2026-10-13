# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: master-flow.spec.ts >> E2E Suite: Flow Completo Dungeon Master (Master) >> Scenario E2E Master: Creazione Campagna, Gestione Entità con Note Segrete e Verifica Eredità Cross-View
- Location: e2e/master-flow.spec.ts:32:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
Timeout: 10000ms
- Expected substring  - 1
+ Received string     + 7

- Eldrin
+
+     
+     
+   
+
+
+

Call log:
  - Expect "toContainText" locator('body') with timeout 10000ms
  - waiting for locator('body')
    21 × locator resolved to <body>…</body>
       - unexpected value "
    Cronache del Drago d'OroDiario & AppuntiTomo SessioniStorylineCodexWorld LoreSendipietraStrumenti & EsplorazioneCerca⌘KNotifiche & ChiarimentiAtlanteGuida & TutorialData di Lore15 Alturiak (Artiglio d’Inverno) 1492 CVDDungeon MasterDungeon Master🐉Tema: Dungeon Master Installa App Impostazioni Cambia Campagna EsciCerca in tutta la campagna...⌘KInvita PartyCronache del Drago d'OroArchivio & Ricerca Globale della CronacaConsultazione rapida con anteprima istantanea di note, sessioni e schede del Codex.Naviga con:↑ ↓Apri con:InvioFiltri AvanzatiTutti (0) Note (0) Sessioni (0) NPC (0) Mostri (0) Luoghi (0) Quest (0) Oggetti (0) Fazioni (0)Nessun elemento corrisponde ai criteri o ai filtri impostati.Prova ad allargare i filtri temporali o a rimuovere i vincoli sui personaggi.
    
  


"
    2 × locator resolved to <body>…</body>
      - unexpected value "
    
    
  


"

```

# Test source

```ts
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
  41  |     await test.step('WHEN 2: Il Master crea una nuova campagna "Cronache del Drago d\'Oro"', async () => {
  42  |       const openCreateModalBtn = page.locator('#btn-open-create-modal');
  43  |       if (await openCreateModalBtn.isVisible()) {
  44  |         await openCreateModalBtn.click();
  45  |         await page.waitForTimeout(300);
  46  | 
  47  |         const nameInput = page.locator('#create-camp-name-input');
  48  |         await nameInput.fill('Cronache del Drago d\'Oro');
  49  | 
  50  |         const submitBtn = page.locator('#btn-submit-create-campaign');
  51  |         await submitBtn.click();
  52  |         await page.waitForTimeout(1000);
  53  |       }
  54  | 
  55  |       await captureStep(page, testInfo, '2_master_campaign_created.png');
  56  |     });
  57  | 
  58  |     await test.step('THEN 3: L\'interfaccia accede al Tomo della campagna e mostra i moduli del Master', async () => {
  59  |       const characterLink = page.locator('a[href*="character"], a[href*="notes"]').first();
  60  |       await expect(characterLink).toBeVisible();
  61  |       await captureStep(page, testInfo, '3_master_dashboard_loaded.png');
  62  |     });
  63  | 
  64  |     await test.step('WHEN 4: Il Master crea l\'NPC "Eldrin il Saggio" con Note Segrete DM nel Codex', async () => {
  65  |       const codexNav = page.locator('a[href*="entities"], a[href*="codex"], button:has-text("Codex"), button:has-text("Entità")').first();
  66  |       if (await codexNav.isVisible()) {
  67  |         await codexNav.click();
  68  |         await page.waitForTimeout(500);
  69  |       }
  70  | 
  71  |       const createEntityBtn = page.locator('button:has-text("Nuova Entità"), button:has-text("+ Entità"), button:has-text("Aggiungi Entità")').first();
  72  |       if (await createEntityBtn.isVisible()) {
  73  |         await createEntityBtn.click();
  74  |         await page.waitForTimeout(400);
  75  | 
  76  |         const nameInput = page.locator('input[placeholder*="Nome"], input[name="name"]').first();
  77  |         if (await nameInput.isVisible()) {
  78  |           await nameInput.fill('Eldrin il Saggio');
  79  |         }
  80  | 
  81  |         const dmNotesInput = page.locator('textarea[placeholder*="Segret"], textarea[placeholder*="Master"], textarea[name="dmNotes"]').first();
  82  |         if (await dmNotesInput.isVisible()) {
  83  |           await dmNotesInput.fill('SEGRETO MASTER: Eldrin custodisce in segreto la gemma dell\'Anima.');
  84  |         }
  85  | 
  86  |         const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea"), button[type="submit"]').first();
  87  |         if (await saveBtn.isVisible()) {
  88  |           await saveBtn.click();
  89  |           await page.waitForTimeout(600);
  90  |         }
  91  |       }
  92  | 
  93  |       await captureStep(page, testInfo, '4_master_entity_created.png');
  94  |     });
  95  | 
  96  |     await test.step('THEN 5: Il Master effettua una Ricerca Globale e trova l\'entità creata', async () => {
  97  |       const searchNav = page.locator('a[href*="search"], button:has-text("Cerca"), button:has-text("Ricerca")').first();
  98  |       if (await searchNav.isVisible()) {
  99  |         await searchNav.click();
  100 |         await page.waitForTimeout(500);
  101 | 
  102 |         const searchInput = page.locator('input[type="text"], input[placeholder*="Cerca"]').first();
  103 |         if (await searchInput.isVisible()) {
  104 |           await searchInput.fill('Eldrin');
  105 |           await page.waitForTimeout(500);
> 106 |           await expect(page.locator('body')).toContainText('Eldrin');
      |                                              ^ Error: expect(locator).toContainText(expected) failed
  107 |         }
  108 |       }
  109 | 
  110 |       await captureStep(page, testInfo, '5_master_global_search_results.png');
  111 |     });
  112 | 
  113 |     await test.step('WHEN 6: Il Master registra la Sessione 1 ("La Profezia del Drago")', async () => {
  114 |       const sessionsNav = page.locator('a[href*="sessions"], button:has-text("Sessioni")').first();
  115 |       if (await sessionsNav.isVisible()) {
  116 |         await sessionsNav.click();
  117 |         await page.waitForTimeout(500);
  118 | 
  119 |         const addSessionBtn = page.locator('button:has-text("Nuova Sessione"), button:has-text("Aggiungi Sessione")').first();
  120 |         if (await addSessionBtn.isVisible()) {
  121 |           await addSessionBtn.click();
  122 |           await page.waitForTimeout(300);
  123 | 
  124 |           const titleInput = page.locator('input[placeholder*="Titolo"], input[name="title"]').first();
  125 |           if (await titleInput.isVisible()) {
  126 |             await titleInput.fill('Sessione 1: La Profezia del Drago');
  127 |           }
  128 | 
  129 |           const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea")').first();
  130 |           if (await saveBtn.isVisible()) {
  131 |             await saveBtn.click();
  132 |             await page.waitForTimeout(500);
  133 |           }
  134 |         }
  135 |       }
  136 | 
  137 |       await captureStep(page, testInfo, '6_master_session_created.png');
  138 |     });
  139 | 
  140 |     await test.step('THEN 7: Il Master verifica le Impostazioni della Campagna e il QR Code di Invito', async () => {
  141 |       const settingsNav = page.locator('a[href*="settings"], button:has-text("Impostazioni")').first();
  142 |       if (await settingsNav.isVisible()) {
  143 |         await settingsNav.click();
  144 |         await page.waitForTimeout(500);
  145 |         await expect(page.locator('body')).toContainText('DRAGO-999');
  146 |       }
  147 | 
  148 |       await captureStep(page, testInfo, '7_master_campaign_settings_and_qr.png');
  149 |     });
  150 |   });
  151 | });
  152 | 
```