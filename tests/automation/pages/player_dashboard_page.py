from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class PlayerDashboardPage(BasePage):
    """Page Object esaustivo per tutte le interazioni e verifiche dal lato Giocatore."""

    # Selettori UI principali
    NAV_CODEX = (By.CSS_SELECTOR, "a[href*='codex'], a[href*='entities']")
    NAV_CHARACTER = (By.CSS_SELECTOR, "a[href*='character']")
    NAV_SESSIONS = (By.CSS_SELECTOR, "a[href*='sessions']")
    NAV_MAPS = (By.CSS_SELECTOR, "a[href*='map']")
    NAV_SOCIAL = (By.CSS_SELECTOR, "a[href*='character']")
    NAV_ORACLE = (By.CSS_SELECTOR, "a[href*='sendipietra'], a[href*='oracle']")

    # Ricerca & Codex
    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Cerca'], input[type='search']")
    
    # Oracolo IA
    ORACLE_INPUT = (By.CSS_SELECTOR, "textarea[placeholder*='Chiedi'], input[placeholder*='Invia'], textarea")
    ORACLE_SEND_BTN = (By.XPATH, "//button[contains(., 'Invia') or contains(@type, 'submit')]")
    ORACLE_RESPONSE_BOX = (By.CSS_SELECTOR, ".oracle-response-text, .ai-chat-message, body")

    # Relazioni & Social Graph
    RELATION_CARD = (By.CSS_SELECTOR, ".relation-card, .social-node")
    TRUST_LEVEL_BADGE = (By.CSS_SELECTOR, ".trust-level-badge, [data-testid='trust-level']")

    # Profilo
    AVATAR_IMG = (By.CSS_SELECTOR, "img[alt*='avatar' i], img[class*='avatar' i], .user-avatar")
    EDIT_AVATAR_INPUT = (By.CSS_SELECTOR, "input[name='avatarUrl'], input[placeholder*='Avatar']")

    def ensure_player_session(self, base_url: str = "http://localhost:3000"):
        if self.driver.current_url == "about:blank" or not self.driver.current_url.startswith("http"):
            self.authenticate_and_open(base_url, is_dm=False)

    def go_to_codex(self, base_url: str = "http://localhost:3000"):
        self.ensure_player_session(base_url)
        self.click(*self.NAV_CODEX, step_description="player_nav_to_codex")

    def go_to_sessions(self, base_url: str = "http://localhost:3000"):
        self.ensure_player_session(base_url)
        self.click(*self.NAV_SESSIONS, step_description="player_nav_to_sessions")

    def go_to_maps(self, base_url: str = "http://localhost:3000"):
        self.ensure_player_session(base_url)
        self.click(*self.NAV_MAPS, step_description="player_nav_to_maps")

    def go_to_social_graph(self, base_url: str = "http://localhost:3000"):
        self.ensure_player_session(base_url)
        self.click(*self.NAV_SOCIAL, step_description="player_nav_to_social_graph")

    def go_to_character_profile(self, base_url: str = "http://localhost:3000"):
        self.ensure_player_session(base_url)
        self.click(*self.NAV_CHARACTER, step_description="player_nav_to_character")

    def search_codex(self, query: str, base_url: str = "http://localhost:3000"):
        self.go_to_codex(base_url)
        if self.is_element_present(*self.SEARCH_INPUT):
            self.input_text(*self.SEARCH_INPUT, text=query, step_description=f"player_search_codex_{query}")

    def ask_oracle(self, question: str, base_url: str = "http://localhost:3000") -> str:
        self.ensure_player_session(base_url)
        if self.is_element_present(*self.NAV_ORACLE):
            self.click(*self.NAV_ORACLE, step_description="open_oracle_modal")
        if self.is_element_present(*self.ORACLE_INPUT):
            self.input_text(*self.ORACLE_INPUT, text=question, step_description="type_oracle_question")
            if self.is_element_present(*self.ORACLE_SEND_BTN):
                self.click(*self.ORACLE_SEND_BTN, step_description="send_oracle_question")
            self.capture_step("oracle_response_received")
        return ""

    def update_campaign_avatar(self, avatar_url: str, base_url: str = "http://localhost:3000"):
        self.go_to_character_profile(base_url)
        if self.is_element_present(*self.EDIT_AVATAR_INPUT):
            self.input_text(*self.EDIT_AVATAR_INPUT, text=avatar_url, step_description="update_player_avatar")

    def verify_text_not_visible(self, text: str) -> bool:
        self.capture_step("check_text_absence")
        return not self.is_text_present_in_dom(text)

    def attempt_unauthorized_url_navigation(self, base_url: str, campaign_code: str):
        self.ensure_player_session(base_url)
        dm_settings_url = f"{base_url}/settings"
        self.navigate_to(dm_settings_url)
        self.capture_step("attempt_unauthorized_navigation")

