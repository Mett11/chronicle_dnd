# 🤖 ROADMAP: TEST AUTOMATION SUITE (Python + Selenium + Pytest)

Roadmap operativa per lo sviluppo dell'infrastruttura di **Test Automation End-to-End** per la piattaforma RPG Lore/Campaign Manager.

---

## 🏛️ 1. Architettura della Suite di Test

```
tests/automation/
├── data/                      # Data Preparation Layer
│   ├── campaign_fixtures.json  # Dati di test per campagne, capitoli e sessioni
│   ├── user_profiles.json      # Account DM e Giocatori per i test
│   └── test_media/             # Immagini ed allegati mock per upload test
├── pages/                     # Page Object Model (POM)
│   ├── base_page.py            # Utility Selenium: explicit waits, screenshots, click, input
│   ├── campaign_gate_page.py   # Login, Creazione ed Unione a Campagne
│   ├── dm_dashboard_page.py    # Gestione Sessioni, AI Sync, Codex, Segreti e Mappe
│   ├── player_profile_page.py  # Gestione Profilo Personaggio e Avatar
│   ├── social_graph_page.py    # Grafico Sociale, Relazioni e Trust Levels
│   └── storyline_page.py       # Modalità Presentazione e Slide Capitolo
├── reports/                   # Output dei Report HTML e Screenshot di Test
│   ├── screenshots/            # Screenshot catturati ad ogni step o fallimento
│   └── report.html             # Report finale HTML auto-contenuto con log e immagini
├── test_suites/               # Test Cases Eseguibili
│   ├── test_data_prep.py       # Suite di Inizializzazione Dati e Seeding DB
│   ├── test_dm_scenarios.py    # Suite Test Automation per Dungeon Master (P0/P1)
│   └── test_player_scenarios.py# Suite Test Automation per Giocatori (P0/P1)
├── conftest.py                # Fixtures Pytest: WebDriver, Hooks Report HTML, Captures
└── requirements.txt           # Dipendenze Python (selenium, pytest, pytest-html)
```

---

## 🚀 2. Fasi della Roadmap di Sviluppo

### 📍 FASE 1: Setup dell'Ambiente e Configurazione Framework
- [x] Definizione della struttura delle cartelle e `requirements.txt`.
- [ ] Implementazione di `conftest.py`:
  - Fixture per inizializzazione Chrome WebDriver (supporto Headless e UI standard).
  - Fixture per cattura automatica di screenshot ad ogni passo rilevante o in caso di errore.
  - Hook per la personalizzazione del report HTML tramite `pytest-html`.

### 📍 FASE 2: Data Preparation Layer & Fixtures
- [ ] Creazione dei file JSON con i payload di test (`campaign_fixtures.json`).
- [ ] Sviluppo dello script `test_data_prep.py` per:
  - Generazione dinamica di una campagna di test pulita (es. `AUTO-TEST-CAMP`).
  - Creazione di capitoli, sessioni, entità codex e profili PG per il collaudo isolato.

### 📍 FASE 3: Stesura del Page Object Model (POM)
- [ ] **`base_page.py`**: Incapsulamento di metodi robusti (`wait_for_element`, `safe_click`, `fill_text`, `take_step_screenshot`).
- [ ] **`campaign_gate_page.py`**: Interazioni con la pagina d'ingresso, login, inserimento codice campagna.
- [ ] **`dm_dashboard_page.py`**: Interazioni con creazione sessioni, modale AI Sync, gestione Segreti DM e Mappe.
- [ ] **`social_graph_page.py`**: Interazioni con nodi del grafico, impostazione relazioni e trust levels.
- [ ] **`storyline_page.py`**: Navigazione slide e verifica unicità della copertina capitolo.

### 📍 FASE 4: Stesura Testcase con Asserzioni e Screenshot per Step
- [ ] **`test_dm_scenarios.py`**:
  - `test_dm_create_secret_and_verify_protection()`: Creazione segreto DM e asserzione che non sia visibile sul DOM del player + screenshot.
  - `test_dm_ai_sync_and_trust_levels()`: Avvio sincronizzazione memoria IA, modifica manuale memorie ed asserzione aggiornamento trust level + screenshot.
  - `test_dm_storyline_chapter_cover_uniqueness()`: Avvio Storyline e asserzione che la copertina del capitolo apra il capitolo e non sia duplicata + screenshot.
- [ ] **`test_player_scenarios.py`**:
  - `test_player_unauthorized_dm_access_blocked()`: Tentativo di navigazione verso rotte DM e asserzione reindirizzamento/blocco + screenshot.
  - `test_player_campaign_profile_isolation()`: Modifica avatar in Campagna A e asserzione che l'avatar in Campagna B non venga alterato + screenshot.

### 📍 FASE 5: Generazione Report HTML Finale ed Esecuzione
- [ ] Comando di esecuzione della suite:
  ```bash
  pytest tests/automation/test_suites/ --html=tests/automation/reports/report.html --self-contained-html
  ```
- [ ] Verifica del report finale HTML contenente:
  - Tabella riassuntiva Pass/Fail.
  - Screenshot incorporati per ogni step chiave e per ogni eventuale errore.
  - Log dettagliati delle asserzioni.

---
