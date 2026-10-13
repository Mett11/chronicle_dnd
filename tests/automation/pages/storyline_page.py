from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class StorylinePage(BasePage):
    """Page Object per la presentazione e navigazione della Storyline."""

    # Selettori UI
    SLIDE_CONTAINER = (By.CSS_SELECTOR, ".storyline-slide, [data-testid='storyline-slide']")
    NEXT_SLIDE_BTN = (By.CSS_SELECTOR, "button[aria-label*='Avanti'], button[aria-label*='Next'], .slide-next-btn")
    PREV_SLIDE_BTN = (By.CSS_SELECTOR, "button[aria-label*='Indietro'], button[aria-label*='Prev'], .slide-prev-btn")
    CHAPTER_COVER_HEADER = (By.CSS_SELECTOR, ".chapter-cover-title, [data-node-type='chapter']")
    SESSION_SLIDE_HEADER = (By.CSS_SELECTOR, ".session-slide-title, [data-node-type='session']")

    def open_storyline(self, base_url: str, campaign_code: str):
        """Apre la vista Storyline della campagna."""
        url = f"{base_url}/campaign/{campaign_code}/storyline"
        self.navigate_to(url)
        self.capture_step("open_storyline_presentation")

    def is_chapter_cover_slide_active(self) -> bool:
        """Verifica se la slide attualmente attiva è la Copertina di Capitolo."""
        return self.is_element_present(*self.CHAPTER_COVER_HEADER)

    def advance_to_next_slide(self):
        """Avanza alla slide successiva."""
        if self.is_element_present(*self.NEXT_SLIDE_BTN):
            self.click(*self.NEXT_SLIDE_BTN, step_description="advance_storyline_slide")
