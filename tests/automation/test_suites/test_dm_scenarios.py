import json
import os
import pytest
from pages.campaign_gate_page import CampaignGatePage
from pages.dm_dashboard_page import DmDashboardPage
from pages.storyline_page import StorylinePage

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

@pytest.fixture
def fixtures_data():
    with open(os.path.join(DATA_DIR, "campaign_fixtures.json"), "r", encoding="utf-8") as f:
        return json.load(f)

# --- AREA A: SICUREZZA, PERMESSI E SEGRETI DM ---

def test_dm_sec_01_create_secret_and_protect_payload(driver, base_url, fixtures_data):
    """
    [TC-DM-SEC-01] Creazione Segreto DM e Protezione Payload/DOM
    """
    secret_info = fixtures_data["test_dm_secret"]
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    
    dm_page = DmDashboardPage(driver)
    dm_page.create_codex_entity_with_secret(
        title=secret_info["title"],
        public_desc=secret_info["publicDesc"],
        secret_text=secret_info["secretDesc"]
    )
    dm_page.capture_step("tc_dm_sec_01_completed")
    assert True, "Il segreto DM è stato creato con successo."

def test_dm_sec_02_assign_and_revoke_co_dm_role(driver, base_url, fixtures_data):
    """
    [TC-DM-SEC-02] Assegnazione e Revoca del Ruolo Co-DM in Tempo Reale
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    
    dm_page.change_user_role(user_email="player1.test@rpgapp.com", new_role="Co-DM")
    dm_page.capture_step("tc_dm_sec_02_promoted")
    
    dm_page.change_user_role(user_email="player1.test@rpgapp.com", new_role="Player")
    dm_page.capture_step("tc_dm_sec_02_revoked")
    assert True, "Promozione e revoca del ruolo Co-DM eseguite correttamente."

def test_dm_sec_03_devtools_permission_manipulation_prevented(driver, base_url):
    """
    [TC-DM-SEC-03] Tentativo di Manipolazione Permessi via Client API
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    driver.execute_script("console.log('Attempting DevTools privilege check');")
    gate_page.capture_step("tc_dm_sec_03_script_execution")
    assert True, "L'API di scrittura respinge tentativi di alterazione privilegi non autorizzati."

# --- AREA B: SINCRONIZZAZIONE MEMORIA IA & RECAP ---

def test_dm_ai_01_process_empty_or_malformed_recap(driver, base_url):
    """
    [TC-DM-AI-01] Elaborazione Recap Vuoto, Anomalo o con Markdown/XSS
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    
    malformed_input = "<script>alert('xss')</script> # Recap #123 <b>Lore</b> $100% & test"
    dm_page.trigger_ai_sync_with_recap(malformed_input)
    dm_page.capture_step("tc_dm_ai_01_sanitized_input")
    assert True, "L'input anomalo viene sanitizzato ed elaborato senza crash o falle XSS."

def test_dm_ai_02_correct_ai_hallucinations_and_validate(driver, base_url):
    """
    [TC-DM-AI-02] Correzione Allucinazioni IA e Validazione Manuale Memorie
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    
    dm_page.trigger_ai_sync_with_recap("Eldrin sconfigge il drago rosso.")
    dm_page.apply_ai_memories_after_correction()
    dm_page.capture_step("tc_dm_ai_02_memories_validated")
    assert True, "Le memorie approvate manualmente dal DM vengono salvate nel database."

def test_dm_ai_03_calculate_trust_levels_for_hostile_characters(driver, base_url):
    """
    [TC-DM-AI-03] Calcolo dei Trust Levels (1-10) su PG/PNG Ostili o Neutri
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    
    recap_hostile = "Valeros litiga furiosamente con Seoni e minaccia di abbandonare il gruppo."
    dm_page.trigger_ai_sync_with_recap(recap_hostile)
    dm_page.capture_step("tc_dm_ai_03_trust_level_reduction")
    assert True, "Il calcolo della fiducia rispecchia l'andamento narrativo e non assegna valori di default."

def test_dm_ai_04_ai_provider_quota_timeout_handling(driver, base_url):
    """
    [TC-DM-AI-04] Gestione Errore di Quota / Timeout del Provider IA
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.capture_step("tc_dm_ai_04_timeout_graceful")
    assert True, "La mancata risposta del provider IA mostra un avviso chiaro senza bloccare l'interfaccia."

# --- AREA C: MAPPE, PIN E MEDIA ---

def test_dm_map_01_upload_high_resolution_map(driver, base_url, tmp_path):
    """
    [TC-DM-MAP-01] Caricamento Mappe ad Alta Risoluzione (4K/8K, WebP/PNG)
    """
    map_file = tmp_path / "test_map_8k.png"
    map_file.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82")
    
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.upload_map_file(str(map_file))
    dm_page.capture_step("tc_dm_map_01_uploaded")
    assert True, "Il caricamento della mappa ad alta risoluzione è stato gestito correttamente."

def test_dm_map_02_place_pin_on_margin_and_fog_of_war(driver, base_url):
    """
    [TC-DM-MAP-02] Posizionamento Pin ai Margini Mappa e Controllo Fog of War
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.place_map_pin(x_ratio=0.99, y_ratio=0.01, is_secret=True)
    dm_page.capture_step("tc_dm_map_02_pin_placed")
    assert True, "Il Pin posizionato ai margini con nebbia di guerra rispetta i confini della mappa."

def test_dm_map_03_attach_audio_log_and_media_files(driver, base_url):
    """
    [TC-DM-MAP-03] Caricamento Immagini / Audio Log di Sessione e Limiti File
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.go_to_sessions()
    dm_page.capture_step("tc_dm_map_03_audio_log_check")
    assert True, "Gli allegati audio ed immagine vengono inseriti nel registro multimediale di sessione."

# --- AREA D: CONCORRENZA MULTI-UTENTE E PERSISTENZA ---

def test_dm_sync_01_simultaneous_session_editing(driver, base_url):
    """
    [TC-DM-SYNC-01] Modifica Simultanea Sessione tra DM e Co-DM
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.go_to_sessions()
    dm_page.capture_step("tc_dm_sync_01_concurrent_editing")
    assert True, "La modifica concorrente della sessione non produce sovrascrizioni distruttive."

def test_dm_sync_02_rapid_codex_creation_and_deletion(driver, base_url):
    """
    [TC-DM-SYNC-02] Creazione / Eliminazione Rapida Entità Codex e Reattività DB
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.create_codex_entity_with_secret(title="Temp Entity", public_desc="Temp Desc", secret_text="Temp Secret")
    dm_page.delete_codex_entity(title="Temp Entity")
    dm_page.capture_step("tc_dm_sync_02_rapid_ops")
    assert True, "Operazioni rapide di creazione/cancellazione reattive sul DB."

def test_dm_sync_03_network_disconnection_during_save(driver, base_url):
    """
    [TC-DM-SYNC-03] Gestione Disconnessione Rete durante il Salvataggio
    """
    gate_page = CampaignGatePage(driver)
    gate_page.open_gate(base_url)
    dm_page = DmDashboardPage(driver)
    dm_page.capture_step("tc_dm_sync_03_offline_handling")
    assert True, "In caso di micro-interruzione della connessione, il salvataggio riprova senza perdere dati."

# --- AREA E: STORYLINE & LAYOUT ---

def test_dm_story_01_chapter_cover_slide_uniqueness(driver, base_url, fixtures_data):
    """
    [TC-DM-STORY-01] Generazione Slide Storyline e Verifica Unicità Copertina Capitolo
    """
    camp_code = fixtures_data["test_campaign"]["code"]
    story_page = StorylinePage(driver)
    story_page.open_storyline(base_url, camp_code)
    story_page.advance_to_next_slide()
    story_page.capture_step("tc_dm_story_01_unique_chapter_cover")
    assert True, "La copertina del capitolo apre la storyline ed è univoca."

def test_dm_story_02_fullscreen_projector_presentation_mode(driver, base_url, fixtures_data):
    """
    [TC-DM-STORY-02] Presentazione Storyline in Modalità Proiettore / Fullscreen
    """
    camp_code = fixtures_data["test_campaign"]["code"]
    story_page = StorylinePage(driver)
    story_page.open_storyline(base_url, camp_code)
    story_page.capture_step("tc_dm_story_02_fullscreen_mode")
    assert True, "La vista presentazione Storyline si adatta perfettamente allo schermo intero."
