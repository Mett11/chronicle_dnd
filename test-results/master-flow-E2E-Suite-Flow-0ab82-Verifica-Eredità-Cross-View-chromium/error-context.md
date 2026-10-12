# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: master-flow.spec.ts >> E2E Suite: Flow Completo Dungeon Master (Master) >> Scenario E2E Master: Creazione Campagna, Gestione Entità con Note Segrete e Verifica Eredità Cross-View
- Location: e2e/master-flow.spec.ts:32:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#create-camp-code-input')
    - locator resolved to <input readonly type="text" id="create-camp-code-input" value="CHR-JAQH-V7CW-DALG-DS7A" class="w-full rounded-xl px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider outline-none border cursor-not-allowed select-all"/>
    - fill("DRAGO-999")
  - attempting fill action
    2 × waiting for element to be visible, enabled and editable
      - element is not editable
    - retrying fill action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and editable
      - element is not editable
    - retrying fill action
      - waiting 100ms
    108 × waiting for element to be visible, enabled and editable
        - element is not editable
      - retrying fill action
        - waiting 500ms
    - waiting for element to be visible, enabled and editable

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: Chronicle
        - generic [ref=e8]: Tavolo delle Campagne
      - generic [ref=e9]:
        - generic "master@test.com" [ref=e10]
        - button "Disconnetti account" [ref=e15] [cursor=pointer]
  - main [ref=e19]:
    - generic [ref=e20]:
      - generic [ref=e21]:
        - paragraph [ref=e22]: ✦ Liber Campagnarum · I Tomi Attivi
        - heading "Il Tavolo delle Cronache" [level=1] [ref=e23]
        - paragraph [ref=e24]: Seleziona un tomo per entrare nella cronaca del tuo party, consulta i tuoi compagni d’avventura o forgia una nuova saga.
      - generic [ref=e25]:
        - button "Inserisci Codice Invito" [ref=e26] [cursor=pointer]
        - button "Aggiorna elenco campagne" [ref=e34] [cursor=pointer]
        - button "Forgia Nuova Campagna" [ref=e40] [cursor=pointer]
    - generic [ref=e44]:
      - heading "I Tuoi Tomi Registrati (1)" [level=2] [ref=e46]
      - generic [ref=e51] [cursor=pointer]:
        - generic [ref=e52]: ⌜
        - generic [ref=e53]: ⌝
        - generic [ref=e54]: ⌞
        - generic [ref=e55]: ⌟
        - generic [ref=e56]:
          - generic [ref=e57]:
            - generic [ref=e58]: Dungeon Master
            - generic "Copia codice campagna" [ref=e61]: DRAGO-999
          - heading "Cronache del Drago d'Oro" [level=3] [ref=e66]
        - generic [ref=e67]:
          - generic [ref=e68]:
            - button "Invito" [ref=e69]
            - button "Elimina definitivamente campagna (Solo Master)" [ref=e77]
          - generic [ref=e81]: Apri Tomo
    - generic [ref=e86]:
      - heading "Unisciti a un Party Esistente" [level=2] [ref=e94]
      - paragraph [ref=e95]: Hai ricevuto un link d'invito o un codice dal tuo Dungeon Master? Incolla qui il codice per registrare il tuo personaggio nel compendio di quel tavolo.
      - generic [ref=e96]:
        - textbox "Incolla Link o Codice (es. WATERDEEP)" [ref=e97]
        - button "Entra nel Party" [disabled] [ref=e98] [cursor=pointer]
    - generic [ref=e104]:
      - generic [ref=e110]:
        - generic [ref=e111]:
          - generic [ref=e112]: Account Connesso
          - generic "Sincronizzato" [ref=e113]
        - paragraph [ref=e114]: master@test.com
      - button "Disconnetti Account" [ref=e115] [cursor=pointer]
  - generic [ref=e121]:
    - button [ref=e122] [cursor=pointer]
    - generic [ref=e130]:
      - heading "Forgia Nuova Campagna" [level=3] [ref=e131]
      - text: Creerai come Dungeon Master (DM)
    - paragraph [ref=e132]: Verrà generato un codice esclusivo da condividere con i tuoi giocatori per farli accedere al tuo tavolo.
    - generic [ref=e133]:
      - generic [ref=e134]:
        - generic [ref=e135]: Nome della Campagna *
        - textbox "Es. La Maledizione di Strahd" [active] [ref=e136]: Cronache del Drago d'Oro
      - generic [ref=e137]:
        - generic [ref=e138]: Codice Campagna Assegnato (Permanente)
        - textbox [ref=e140]: CHR-JAQH-V7CW-DALG-DS7A
        - paragraph [ref=e141]: Codice univoco generato automaticamente dal sistema. Non modificabile.
      - generic [ref=e142] [cursor=pointer]:
        - generic [ref=e147]:
          - paragraph [ref=e148]: Sono il Dungeon Master (DM)
          - paragraph [ref=e149]: Sarai il Master ufficiale con pieni poteri di gestione del tavolo
        - checkbox [checked] [ref=e150]
      - generic [ref=e151]:
        - button "Annulla" [ref=e152] [cursor=pointer]
        - button "Crea & Entra come Master" [ref=e153] [cursor=pointer]
  - contentinfo [ref=e157]:
    - generic [ref=e158]:
      - generic [ref=e159]:
        - generic [ref=e160]: Chronicle
        - generic [ref=e161]: •
        - generic [ref=e162]: Portale delle Campagne
      - generic [ref=e163]:
        - button "Privacy Policy" [ref=e164] [cursor=pointer]
        - generic [ref=e165]: •
        - button "Cookie Policy" [ref=e166] [cursor=pointer]
        - generic [ref=e167]: •
        - button "Termini & GDPR" [ref=e168] [cursor=pointer]
      - generic [ref=e169]: Tavolo di Ruolo Attivo • D&D 5E
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
> 51  |         await codeInput.fill('DRAGO-999');
      |                         ^ Error: locator.fill: Test timeout of 60000ms exceeded.
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
  63  |       await expect(characterLink).toBeVisible();
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
```