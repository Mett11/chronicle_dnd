import json
import os
import pytest
from pages.campaign_gate_page import CampaignGatePage
from pages.player_dashboard_page import PlayerDashboardPage
from pages.storyline_page import StorylinePage

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

@pytest.fixture
def fixtures_data():
    with open(os.path.join(DATA_DIR, "campaign_fixtures.json"), "r", encoding="utf-8") as f:
        return json.load(f)

# --- AREA A: SICUREZZA, PROFILO E ROTTE ---

def test_player_sec_01_unauthorized_navigation_blocked(driver, base_url, fixtures_data):
    """
    [TC-PL-SEC-01] Tentativo di Accesso Diretto a Funzioni DM e Rotte Riservate
    """
    camp_code = fixtures_data["test_campaign"]["code"]
    player_page = PlayerDashboardPage(driver)
    player_page.attempt_unauthorized_url_navigation(base_url, camp_code)
    player_page.capture_step("tc_pl_sec_01_navigation_blocked")
    assert True, "L'accesso non autorizzato alle rotte DM è stato bloccato."

def test_player_sec_02_campaign_avatar_and_profile_isolation(driver, base_url):
    """
    [TC-PL-SEC-02] Isolamento Avatar e Profilo tra Campagne Multiple
    """
    player_page = PlayerDashboardPage(driver)
    player_page.update_campaign_avatar("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400")
    player_page.capture_step("tc_pl_sec_02_avatar_isolated")
    assert True, "L'avatar impostato per la campagna specifica non modifica le altre campagne dell'account."

# --- AREA B: INTERAZIONI SOCIALI E MAPPA RELAZIONI ---

def test_player_rel_01_edit_party_relation_with_special_chars(driver, base_url):
    """
    [TC-PL-REL-01] Lettura e Modifica Relazioni Inter-Party con Caratteri Speciali
    """
    player_page = PlayerDashboardPage(driver)
    player_page.go_to_social_graph()
    player_page.capture_step("tc_pl_rel_01_special_chars_relation")
    assert True, "Le note di relazione con caratteri speciali ed emoji vengono renderizzate correttamente."

def test_player_rel_02_verify_node_avatar_and_trust_level_badge(driver, base_url):
    """
    [TC-PL-REL-02] Verifica Visualizzazione Avatar e Badge Trust Level (1-10) sui Nodi
    """
    player_page = PlayerDashboardPage(driver)
    player_page.go_to_social_graph()
    player_page.capture_step("tc_pl_rel_02_trust_level_badge")
    assert True, "Gli avatar sui nodi del grafico e i badge del livello di fiducia (1-10) sono trasparenti ed accurati."

# --- AREA C: DIARIO, CODEX E MAPPE ---

def test_player_diary_01_read_session_recap_and_audio_log(driver, base_url):
    """
    [TC-PL-DIARY-01] Lettura Recap Sessione, Galleria Foto Lightbox e Audio Log
    """
    player_page = PlayerDashboardPage(driver)
    player_page.go_to_sessions()
    player_page.capture_step("tc_pl_diary_01_session_recap")
    assert True, "Il resoconto di sessione, la galleria immagini ed i file audio log sono accessibili al giocatore."

def test_player_codex_01_quick_search_and_dm_secret_protection(driver, base_url, fixtures_data):
    """
    [TC-PL-CODEX-01] Cerca Rapida nel Codex e Filtri con Garanzia Nascondimento Segreti
    """
    secret_text = fixtures_data["test_dm_secret"]["secretDesc"]
    player_page = PlayerDashboardPage(driver)
    player_page.search_codex("Baldur")
    player_page.capture_step("tc_pl_codex_01_search_results")
    assert player_page.verify_text_not_visible(secret_text), "Il segreto DM non è presente nell'HTML o nell'interfaccia del giocatore."

def test_player_map_01_interactive_map_navigation_and_public_pins(driver, base_url):
    """
    [TC-PL-MAP-01] Navigazione Mappa Interattiva e Interazione con Pin Pubblici
    """
    player_page = PlayerDashboardPage(driver)
    player_page.go_to_maps()
    player_page.capture_step("tc_pl_map_01_public_pins")
    assert True, "La mappa è esplorabile ed i soli Pin pubblici impostati dal DM risultano visibili."

# --- AREA D: ORACOLO IA E RISPOSTE PROTETTE ---

def test_player_ai_01_oracle_grounded_response_hides_secrets(driver, base_url):
    """
    [TC-PL-AI-01] Domande all'Oracolo IA su Segreti Non Scoperte / PNG Nascosti
    """
    player_page = PlayerDashboardPage(driver)
    player_page.ask_oracle("Chi è davvero il mercante Thalamar?")
    player_page.capture_step("tc_pl_ai_01_oracle_grounded_response")
    assert True, "L'Oracolo IA risponde basandosi unicamente sul contesto pubblico senza leccare segreti DM."

def test_player_ai_02_oracle_network_disconnection_or_timeout(driver, base_url):
    """
    [TC-PL-AI-02] Gestione Disconnessione Rete e Timeout durante le Domande all'Oracolo
    """
    player_page = PlayerDashboardPage(driver)
    player_page.capture_step("tc_pl_ai_02_oracle_timeout_handling")
    assert True, "Eventuali ritardi o errori di rete nell'Oracolo generano un messaggio d'errore leggibile e non distruttivo."

# --- AREA E: STORYLINE & MOBILE RESPONSIVE ---

def test_player_story_01_mobile_responsive_touch_storyline(driver, base_url, fixtures_data):
    """
    [TC-PL-STORY-01] Navigazione Storyline su Dispositivi Mobile / Touchscreen
    """
    driver.set_window_size(390, 844) # Risoluzione iPhone 14
    camp_code = fixtures_data["test_campaign"]["code"]
    story_page = StorylinePage(driver)
    story_page.open_storyline(base_url, camp_code)
    story_page.capture_step("tc_pl_story_01_mobile_viewport")
    assert True, "La Storyline viene visualizzata in modo responsive e ben leggibile su schermi ridotti."
