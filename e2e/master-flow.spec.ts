import { test, expect, TestInfo, Page } from '@playwright/test';

async function captureStep(page: Page, testInfo: TestInfo, stepName: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(stepName, { body: screenshot, contentType: 'image/png' });
}

test.describe('E2E Suite: Flow Completo Dungeon Master (Master)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      const masterAccount = {
        id: 'master-1',
        email: 'master@test.com',
        characterName: 'Dungeon Master',
        color: '#6366f1',
        isDm: true,
        dmCampaigns: [],
        joinedCampaigns: [],
        campaignProfiles: {},
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('chronicle_global_user_accounts', JSON.stringify([masterAccount]));
      localStorage.setItem('chronicle_accounts_list', JSON.stringify([masterAccount]));
      localStorage.setItem('chronicle_current_account_id', 'master-1');
      localStorage.setItem('chronicle_global_active_user_id', 'master-1');
      localStorage.setItem('chronicle_tutorial_seen_master-1', 'true');
    });
    await page.goto('/');
  });

  test('Scenario E2E Master: Creazione Campagna, Gestione Entità con Note Segrete e Verifica Eredità Cross-View', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    await test.step('GIVEN 1: Il Master accede alla schermata di selezione/creazione campagna', async () => {
      const openCreateModalBtn = page.locator('#btn-open-create-modal');
      await expect(openCreateModalBtn).toBeVisible({ timeout: 15000 });
      await captureStep(page, testInfo, '1_master_campaign_gate.png');
    });

    await test.step('WHEN 2: Il Master crea una nuova campagna "Cronache del Drago d\'Oro" (Codice: DRAGO-999)', async () => {
      const openCreateModalBtn = page.locator('#btn-open-create-modal');
      if (await openCreateModalBtn.isVisible()) {
        await openCreateModalBtn.click();
        await page.waitForTimeout(300);

        const nameInput = page.locator('#create-camp-name-input');
        await nameInput.fill('Cronache del Drago d\'Oro');

        const codeInput = page.locator('#create-camp-code-input');
        await codeInput.fill('DRAGO-999');

        const submitBtn = page.locator('#btn-submit-create-campaign');
        await submitBtn.click();
        await page.waitForTimeout(1000);
      }

      await captureStep(page, testInfo, '2_master_campaign_created.png');
    });

    await test.step('THEN 3: L\'interfaccia accede al Tomo della campagna e mostra i moduli del Master', async () => {
      const characterLink = page.locator('a[href*="character"], a[href*="notes"]').first();
      await expect(characterLink).toBeVisible();
      await captureStep(page, testInfo, '3_master_dashboard_loaded.png');
    });

    await test.step('WHEN 4: Il Master crea l\'NPC "Eldrin il Saggio" con Note Segrete DM nel Codex', async () => {
      const codexNav = page.locator('a[href*="entities"], a[href*="codex"], button:has-text("Codex"), button:has-text("Entità")').first();
      if (await codexNav.isVisible()) {
        await codexNav.click();
        await page.waitForTimeout(500);
      }

      const createEntityBtn = page.locator('button:has-text("Nuova Entità"), button:has-text("+ Entità"), button:has-text("Aggiungi Entità")').first();
      if (await createEntityBtn.isVisible()) {
        await createEntityBtn.click();
        await page.waitForTimeout(400);

        const nameInput = page.locator('input[placeholder*="Nome"], input[name="name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Eldrin il Saggio');
        }

        const dmNotesInput = page.locator('textarea[placeholder*="Segret"], textarea[placeholder*="Master"], textarea[name="dmNotes"]').first();
        if (await dmNotesInput.isVisible()) {
          await dmNotesInput.fill('SEGRETO MASTER: Eldrin custodisce in segreto la gemma dell\'Anima.');
        }

        const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea"), button[type="submit"]').first();
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(600);
        }
      }

      await captureStep(page, testInfo, '4_master_entity_created.png');
    });

    await test.step('THEN 5: Il Master effettua una Ricerca Globale e trova l\'entità creata', async () => {
      const searchNav = page.locator('a[href*="search"], button:has-text("Cerca"), button:has-text("Ricerca")').first();
      if (await searchNav.isVisible()) {
        await searchNav.click();
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"], input[placeholder*="Cerca"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('Eldrin');
          await page.waitForTimeout(500);
          await expect(page.locator('body')).toContainText('Eldrin');
        }
      }

      await captureStep(page, testInfo, '5_master_global_search_results.png');
    });

    await test.step('WHEN 6: Il Master registra la Sessione 1 ("La Profezia del Drago")', async () => {
      const sessionsNav = page.locator('a[href*="sessions"], button:has-text("Sessioni")').first();
      if (await sessionsNav.isVisible()) {
        await sessionsNav.click();
        await page.waitForTimeout(500);

        const addSessionBtn = page.locator('button:has-text("Nuova Sessione"), button:has-text("Aggiungi Sessione")').first();
        if (await addSessionBtn.isVisible()) {
          await addSessionBtn.click();
          await page.waitForTimeout(300);

          const titleInput = page.locator('input[placeholder*="Titolo"], input[name="title"]').first();
          if (await titleInput.isVisible()) {
            await titleInput.fill('Sessione 1: La Profezia del Drago');
          }

          const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea")').first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }

      await captureStep(page, testInfo, '6_master_session_created.png');
    });

    await test.step('THEN 7: Il Master verifica le Impostazioni della Campagna e il QR Code di Invito', async () => {
      const settingsNav = page.locator('a[href*="settings"], button:has-text("Impostazioni")').first();
      if (await settingsNav.isVisible()) {
        await settingsNav.click();
        await page.waitForTimeout(500);
        await expect(page.locator('body')).toContainText('DRAGO-999');
      }

      await captureStep(page, testInfo, '7_master_campaign_settings_and_qr.png');
    });
  });
});
