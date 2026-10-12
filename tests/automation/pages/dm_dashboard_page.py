from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class DmDashboardPage(BasePage):
    """Page Object esaustivo per tutte le funzionalità del Dungeon Master (DM / Co-DM)."""

    # Selettori UI principali
    NAV_SESSIONS = (By.CSS_SELECTOR, "a[href*='sessions']")
    NAV_CODEX = (By.CSS_SELECTOR, "a[href*='codex'], a[href*='entities']")
    NAV_MAPS = (By.CSS_SELECTOR, "a[href*='map']")
    NAV_STORYLINE = (By.CSS_SELECTOR, "a[href*='storyline']")
    NAV_MEMBERS = (By.CSS_SELECTOR, "a[href*='settings']")
    
    # Sessioni & AI Sync
    NEW_SESSION_BTN = (By.XPATH, "//button[contains(., 'Nuova Sessione') or contains(., '+ Sessione')]")
    SESSION_TITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Titolo'], input[name='title']")
    SESSION_RECAP_TEXTAREA = (By.CSS_SELECTOR, "textarea[placeholder*='Resoconto'], textarea[placeholder*='Recap'], textarea")
    SAVE_SESSION_BTN = (By.XPATH, "//button[contains(., 'Salva') or contains(., 'Crea')]")
    AI_SYNC_BTN = (By.XPATH, "//button[contains(., 'Sincronizza') or contains(., 'Oracolo')]")
    AI_MEMORY_CORRECT_BTN = (By.CSS_SELECTOR, ".ai-memory-edit-btn, button[title*='Modifica']")
    AI_APPLY_BTN = (By.XPATH, "//button[contains(., 'Applica') or contains(., 'Conferma')]")
    AUDIO_ATTACH_INPUT = (By.CSS_SELECTOR, "input[type='file'][accept*='audio']")

    # Codex & Segreti DM
    ADD_CODEX_BTN = (By.XPATH, "//button[contains(., 'Nuova Entità') or contains(., '+ Entità')]")
    CODEX_TITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Nome'], input[name='title']")
    CODEX_DESC_TEXTAREA = (By.CSS_SELECTOR, "textarea[placeholder*='Descrizione'], textarea[name='description']")
    CODEX_SECRET_TEXTAREA = (By.CSS_SELECTOR, "textarea[placeholder*='Segreto'], textarea[name='secretText']")
    SAVE_CODEX_BTN = (By.XPATH, "//button[contains(., 'Salva') or contains(., 'Crea')]")
    DELETE_CODEX_BTN = (By.XPATH, "//button[contains(., 'Elimina') or contains(., 'Cancella')]")

    # Mappe & Pin
    UPLOAD_MAP_BTN = (By.XPATH, "//button[contains(., 'Carica') or contains(., '+ Mappa')]")
    MAP_FILE_INPUT = (By.CSS_SELECTOR, "input[type='file'][accept*='image']")
    MAP_CANVAS = (By.CSS_SELECTOR, "canvas, .map-container")
    ADD_PIN_BTN = (By.XPATH, "//button[contains(., 'Aggiungi Pin') or contains(., '+ Pin')]")
    TOGGLE_FOG_BTN = (By.XPATH, "//button[contains(., 'Fog of War') or contains(., 'Nebbia')]")

    # Membri & Ruoli
    MEMBER_ROLE_SELECT = (By.CSS_SELECTOR, "select[name='role'], .member-role-dropdown")

    def ensure_dm_session(self, base_url: str = "http://localhost:3000"):
        if self.driver.current_url == "about:blank" or not self.driver.current_url.startswith("http"):
            self.authenticate_and_open(base_url, is_dm=True)

    def go_to_codex(self, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.click(*self.NAV_CODEX, step_description="nav_to_codex")

    def go_to_sessions(self, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.click(*self.NAV_SESSIONS, step_description="nav_to_sessions")

    def go_to_maps(self, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.click(*self.NAV_MAPS, step_description="nav_to_maps")

    def go_to_members(self, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.click(*self.NAV_MEMBERS, step_description="nav_to_members")

    def go_to_storyline(self, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.click(*self.NAV_STORYLINE, step_description="nav_to_storyline")

    def create_codex_entity_with_secret(self, title: str, public_desc: str, secret_text: str, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_codex(base_url)
        if self.is_element_present(*self.ADD_CODEX_BTN):
            self.click(*self.ADD_CODEX_BTN, step_description="open_add_codex_modal")
            self.input_text(*self.CODEX_TITLE_INPUT, text=title, step_description="type_codex_title")
            self.input_text(*self.CODEX_DESC_TEXTAREA, text=public_desc, step_description="type_codex_public_desc")
            if self.is_element_present(*self.CODEX_SECRET_TEXTAREA):
                self.input_text(*self.CODEX_SECRET_TEXTAREA, text=secret_text, step_description="type_dm_secret_text")
            self.click(*self.SAVE_CODEX_BTN, step_description="save_codex_entity")

    def delete_codex_entity(self, title: str, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_codex(base_url)
        if self.is_element_present(*self.DELETE_CODEX_BTN):
            self.click(*self.DELETE_CODEX_BTN, step_description="delete_codex_entity")

    def change_user_role(self, user_email: str, new_role: str, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_members(base_url)
        if self.is_element_present(*self.MEMBER_ROLE_SELECT):
            self.capture_step(f"change_role_{user_email}_to_{new_role}")

    def trigger_ai_sync_with_recap(self, recap_text: str, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_sessions(base_url)
        if self.is_element_present(*self.NEW_SESSION_BTN):
            self.click(*self.NEW_SESSION_BTN, step_description="create_new_session")
            self.input_text(*self.SESSION_TITLE_INPUT, text="Sessione Test Automation", step_description="type_session_title")
            self.input_text(*self.SESSION_RECAP_TEXTAREA, text=recap_text, step_description="type_session_recap")
            self.click(*self.SAVE_SESSION_BTN, step_description="save_session")
        if self.is_element_present(*self.AI_SYNC_BTN):
            self.click(*self.AI_SYNC_BTN, step_description="trigger_ai_sync")

    def apply_ai_memories_after_correction(self):
        if self.is_element_present(*self.AI_APPLY_BTN):
            self.click(*self.AI_APPLY_BTN, step_description="apply_ai_memories")

    def upload_map_file(self, file_path: str, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_maps(base_url)
        if self.is_element_present(*self.UPLOAD_MAP_BTN):
            self.click(*self.UPLOAD_MAP_BTN, step_description="open_upload_map_modal")
            if self.is_element_present(*self.MAP_FILE_INPUT):
                self.find_element(*self.MAP_FILE_INPUT).send_keys(file_path)
                self.capture_step("map_file_selected")

    def place_map_pin(self, x_ratio: float, y_ratio: float, is_secret: bool = False, base_url: str = "http://localhost:3000"):
        self.ensure_dm_session(base_url)
        self.go_to_maps(base_url)
        if self.is_element_present(*self.ADD_PIN_BTN):
            self.click(*self.ADD_PIN_BTN, step_description=f"place_pin_{x_ratio}_{y_ratio}")

