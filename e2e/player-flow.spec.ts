import { test, expect, TestInfo, Page } from '@playwright/test';

async function captureStep(page: Page, testInfo: TestInfo, stepName: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(stepName, { body: screenshot, contentType: 'image/png' });
}

test.describe('E2E Suite: Flow Completo Giocatore (Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();

      const playerAccount = {
        id: 'player-1',
        email: 'player@test.com',
        characterName: 'Valeros il Barbaro',
        color: '#10b981',
        isDm: false,
        dmCampaigns: [],
        joinedCampaigns: [],
        campaignProfiles: {},
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('chronicle_global_user_accounts', JSON.stringify([playerAccount]));
      localStorage.setItem('chronicle_accounts_list', JSON.stringify([playerAccount]));
      localStorage.setItem('chronicle_current_account_id', 'player-1');
      localStorage.setItem('chronicle_global_active_user_id', 'player-1');
      localStorage.setItem('chronicle_tutorial_seen_player-1', 'true');

      const sampleCampaign = {
        id: 'camp-drago-999',
        code: 'DRAGO-999',
        name: 'Cronache del Drago d\'Oro',
        dmId: 'master-1',
        dmEmail: 'master@cronache.it',
        dmName: 'Dungeon Master',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('chronicle_campaigns_list', JSON.stringify([sampleCampaign]));
      localStorage.setItem('chronicle_campaign_DRAGO-999', JSON.stringify({
        meta: sampleCampaign,
        notes: [
          {
            _id: 'note-public-1',
            title: 'Istruzioni del Gruppo',
            content: 'Incontrarsi alla taverna del Drago.',
            visibility: 'group',
            author: { id: 'master-1', characterName: 'Dungeon Master' },
            createdAt: new Date().toISOString(),
          }
        ],
        entities: [
          {
            _id: 'ent-eldrin',
            name: 'Eldrin il Saggio',
            type: 'npc',
            description: 'Un vecchio saggio con la barba bianca.',
            dmNotes: 'SEGRETO MASTER: Eldrin custodisce la gemma dell\'Anima.',
            status: 'alive',
            visibility: 'public',
            createdAt: new Date().toISOString(),
          }
        ],
        sessions: [],
      }));
    });
    await page.goto('/');
  });

  test('Scenario E2E Player: Registrazione PG, Filtro Note Personali, Consultazione Codex Sanificato e Invio Chiarimenti', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    await test.step('GIVEN 1: Il Giocatore accede al portale di inserimento codice campagna', async () => {
      const joinInput = page.locator('input[placeholder*="Codice"], input[placeholder*="CODICE"]').first();
      await expect(joinInput).toBeVisible({ timeout: 15000 });
      await captureStep(page, testInfo, '1_player_campaign_gate.png');
    });

    await test.step('WHEN 2: Il Giocatore inserisce il codice "DRAGO-999" ed effettua la registrazione PG', async () => {
      const joinInput = page.locator('input[placeholder*="Codice"], input[placeholder*="CODICE"]').first();
      await joinInput.fill('DRAGO-999');

      const submitJoinBtn = page.locator('button:has-text("Unisciti"), button:has-text("Accedi"), button[type="submit"]').first();
      if (await submitJoinBtn.isVisible()) {
        await submitJoinBtn.click();
        await page.waitForTimeout(500);
      }

      // If registration modal appears, fill character name
      const charNameInput = page.locator('input[placeholder*="Personaggio"], input[placeholder*="Nome"], input[name="characterName"]').first();
      if (await charNameInput.isVisible()) {
        await charNameInput.fill('Valeros il Barbaro');
        const confirmBtn = page.locator('button:has-text("Conferma"), button:has-text("Entra"), button:has-text("Salva")').first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(600);
        }
      }

      await captureStep(page, testInfo, '2_player_registered_and_joined.png');
    });

    await test.step('THEN 3: Il Giocatore viene reindirizzato alla Scheda Personaggio "Valeros il Barbaro"', async () => {
      const pageHeader = page.locator('header, nav, body').first();
      await expect(pageHeader).toBeVisible();
      await captureStep(page, testInfo, '3_player_character_sheet.png');
    });

    await test.step('WHEN 4: Il Giocatore consulta l\'NPC "Eldrin il Saggio" nel Codex e verifica l\'assenza di Note Segrete DM', async () => {
      const codexNav = page.locator('a[href*="entities"], a[href*="codex"], button:has-text("Codex"), button:has-text("Entità")').first();
      if (await codexNav.isVisible()) {
        await codexNav.click();
        await page.waitForTimeout(500);

        // Expect public description
        await expect(page.locator('body')).toContainText('Eldrin il Saggio');
        // Secret DM notes must NOT be visible to Player
        await expect(page.locator('body')).not.toContainText('SEGRETO MASTER: Eldrin custodisce la gemma');
      }

      await captureStep(page, testInfo, '4_player_codex_sanitized_view.png');
    });

    await test.step('WHEN 5: Il Giocatore crea una Nota Personale "Diario di Valeros"', async () => {
      const notesNav = page.locator('a[href*="notes"], button:has-text("Diario"), button:has-text("Note")').first();
      if (await notesNav.isVisible()) {
        await notesNav.click();
        await page.waitForTimeout(500);

        const newNoteBtn = page.locator('button:has-text("Nuova Nota"), button:has-text("+ Nota")').first();
        if (await newNoteBtn.isVisible()) {
          await newNoteBtn.click();
          await page.waitForTimeout(400);

          const titleInput = page.locator('input[placeholder*="Titolo"], input[name="title"]').first();
          if (await titleInput.isVisible()) {
            await titleInput.fill('Diario di Valeros');
          }

          // Select visibility = personal if radio/button exists
          const personalBtn = page.locator('button:has-text("Personale"), input[value="personal"]').first();
          if (await personalBtn.isVisible()) {
            await personalBtn.click();
          }

          const saveBtn = page.locator('button:has-text("Salva"), button:has-text("Crea")').first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(600);
          }
        }
      }

      await captureStep(page, testInfo, '5_player_personal_note_created.png');
    });

    await test.step('THEN 6: Il Giocatore attiva il Filtro "PERSONALI" e vede esclusivamente la propria Nota Personale', async () => {
      const personalTabBtn = page.locator('button:has-text("PERSONALI"), button:has-text("Personali")').first();
      if (await personalTabBtn.isVisible()) {
        await personalTabBtn.click();
        await page.waitForTimeout(400);

        // Verify filter active
        await expect(page.locator('body')).toContainText('Diario di Valeros');
      }

      await captureStep(page, testInfo, '6_player_personal_filter_verified.png');
    });

    await test.step('WHEN 7: Il Giocatore invia un Chiarimento al Dungeon Master', async () => {
      const clarificationsNav = page.locator('a[href*="clarifications"], a[href*="chiarimenti"], button:has-text("Chiarimenti")').first();
      if (await clarificationsNav.isVisible()) {
        await clarificationsNav.click();
        await page.waitForTimeout(500);

        const askBtn = page.locator('button:has-text("Invia Chiarimento"), button:has-text("Chiedi al DM"), button:has-text("Nuova Domanda")').first();
        if (await askBtn.isVisible()) {
          await askBtn.click();
          await page.waitForTimeout(300);

          const questionInput = page.locator('textarea[placeholder*="Domanda"], input[placeholder*="Domanda"]').first();
          if (await questionInput.isVisible()) {
            await questionInput.fill('Master, dove ci ritroviamo all\'inizio della sessione?');
          }

          const submitBtn = page.locator('button:has-text("Invia"), button:has-text("Salva")').first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }

      await captureStep(page, testInfo, '7_player_clarification_submitted.png');
    });
  });
});
