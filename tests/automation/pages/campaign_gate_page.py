from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class CampaignGatePage(BasePage):
    """Page Object per il Gate di Accesso, Creazione ed Unione a Campagne."""

    # Selettori UI
    CREATE_CAMPAIGN_BTN = (By.CSS_SELECTOR, "#btn-open-create-modal")
    CAMPAIGN_CODE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Codice'], input[placeholder*='CODICE'], input[placeholder*='WATERDEEP']")
    JOIN_CAMPAIGN_BTN = (By.XPATH, "//button[contains(., 'Entra') or contains(., 'Unisciti')]")
    TITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='nome'], input[placeholder*='Titolo'], input[placeholder*='Nome']")
    SUBTITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='codice'], input[placeholder*='CODICE']")
    SAVE_CAMPAIGN_BTN = (By.XPATH, "//button[contains(., 'Forgia') or contains(., 'Salva') or contains(., 'Crea')]")
    CAMPAIGN_CARD = (By.CSS_SELECTOR, ".campaign-card, [data-testid='campaign-card']")

    def open_gate(self, base_url: str):
        """Apre la pagina principale delle campagne ed assicura l'autenticazione iniziale."""
        if self.driver.current_url == "about:blank" or not self.driver.current_url.startswith("http"):
            self.authenticate_and_open(base_url, is_dm=True)
        self.navigate_to(base_url)
        self.capture_step("open_campaign_gate")

    def join_campaign(self, code: str):
        """Inserisce il codice invito ed esegue l'accesso alla campagna."""
        if self.is_element_present(*self.CAMPAIGN_CODE_INPUT):
            self.input_text(*self.CAMPAIGN_CODE_INPUT, text=code, step_description=f"type_campaign_code_{code}")
            if self.is_element_present(*self.JOIN_CAMPAIGN_BTN):
                self.click(*self.JOIN_CAMPAIGN_BTN, step_description="click_join_campaign")

    def create_campaign(self, title: str, subtitle: str):
        """Crea una nuova campagna con i dati specificati."""
        if self.is_element_present(*self.CREATE_CAMPAIGN_BTN):
            self.click(*self.CREATE_CAMPAIGN_BTN, step_description="open_create_campaign_modal")
            if self.is_element_present(*self.TITLE_INPUT):
                self.input_text(*self.TITLE_INPUT, text=title, step_description="type_campaign_title")
            if self.is_element_present(*self.SUBTITLE_INPUT):
                self.input_text(*self.SUBTITLE_INPUT, text=subtitle, step_description="type_campaign_subtitle")
            if self.is_element_present(*self.SAVE_CAMPAIGN_BTN):
                self.click(*self.SAVE_CAMPAIGN_BTN, step_description="save_new_campaign")

    def is_in_campaign(self) -> bool:
        """Verifica se l'utente è atterrato nella dashboard della campagna."""
        return "/campaign/" in self.driver.current_url or self.is_element_present(By.CSS_SELECTOR, "aside, nav, .sidebar, .campaign-header")

