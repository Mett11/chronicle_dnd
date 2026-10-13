import json
import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from conftest import take_step_screenshot

class BasePage:
    """Classe base per il Page Object Model (POM) con utility avanzate di attesa e screenshot."""

    def __init__(self, driver, timeout=10):
        self.driver = driver
        self.timeout = timeout
        self.wait = WebDriverWait(driver, timeout)

    def navigate_to(self, url: str):
        """Naviga verso l'URL specificato."""
        self.driver.get(url)

    def authenticate_and_open(self, base_url: str, is_dm: bool = True, user_id: str = None, campaign_code: str = "AUTO-TEST-2026"):
        """Inizializza la sessione utente e la campagna attiva in localStorage per isolare i test."""
        uid = user_id or ("master-1" if is_dm else "player-1")
        role_name = "Dungeon Master" if is_dm else "Valeros il Barbaro"
        email = "master@test.com" if is_dm else "player@test.com"

        user_account = {
            "id": uid,
            "_id": uid,
            "email": email,
            "characterName": role_name,
            "color": "#6366f1" if is_dm else "#10b981",
            "isDm": is_dm,
            "dmCampaigns": [campaign_code] if is_dm else [],
            "joinedCampaigns": [campaign_code],
            "campaignProfiles": {
                campaign_code: {
                    "characterName": role_name,
                    "color": "#6366f1" if is_dm else "#10b981"
                }
            },
            "createdAt": "2026-10-12T00:00:00.000Z"
        }

        sample_campaign = {
            "id": f"camp-{campaign_code.lower()}",
            "code": campaign_code,
            "name": "La Leggenda della Costa della Spada (Test Auto)",
            "dmId": "master-1",
            "dmEmail": "master@test.com",
            "dmName": "Dungeon Master",
            "createdAt": "2026-10-12T00:00:00.000Z"
        }

        if self.driver.current_url == "about:blank" or not self.driver.current_url.startswith("http"):
            self.driver.get(base_url)

        script = f"""
        localStorage.setItem('chronicle_global_user_accounts', JSON.stringify({json.dumps([user_account])}));
        localStorage.setItem('chronicle_accounts_list', JSON.stringify({json.dumps([user_account])}));
        localStorage.setItem('chronicle_current_account_id', '{uid}');
        localStorage.setItem('chronicle_global_active_user_id', '{uid}');
        localStorage.setItem('chronicle_active_campaign_code', '{campaign_code}');
        localStorage.setItem('chronicle_tutorial_seen_{uid}', 'true');
        localStorage.setItem('chronicle_campaigns_list', JSON.stringify({json.dumps([sample_campaign])}));
        """
        try:
            self.driver.execute_script(script)
        except Exception:
            pass

        self.driver.get(f"{base_url}/character")
        time.sleep(0.5)

    def find_element(self, by: By, value: str):
        """Trova un elemento attendendo che sia presente nel DOM."""
        return self.wait.until(EC.presence_of_element_located((by, value)))

    def find_visible_element(self, by: By, value: str):
        """Trova un elemento attendendo che sia visibile a schermo."""
        return self.wait.until(EC.visibility_of_element_located((by, value)))

    def click(self, by: By, value: str, step_description: str = ""):
        """Esegue un click sicuro con fallback JavaScript se l'elemento è coperto da sovrapposizioni."""
        try:
            element = self.wait.until(EC.element_to_be_clickable((by, value)))
            element.click()
        except Exception:
            try:
                element = self.find_element(by, value)
                self.driver.execute_script("arguments[0].click();", element)
            except Exception as e:
                raise e

        if step_description:
            self.capture_step(step_description)

    def input_text(self, by: By, value: str, text: str, clear_first: bool = True, step_description: str = ""):
        """Inserisce del testo in un campo di input."""
        element = self.find_visible_element(by, value)
        if clear_first:
            element.clear()
        element.send_keys(text)
        if step_description:
            self.capture_step(step_description)

    def is_element_present(self, by: By, value: str, timeout: int = 3) -> bool:
        """Verifica se un elemento è presente a schermo senza sollevare eccezioni bloccanti."""
        try:
            WebDriverWait(self.driver, timeout).until(EC.presence_of_element_located((by, value)))
            return True
        except Exception:
            return False

    def is_text_present_in_dom(self, text: str) -> bool:
        """Verifica se una stringa è presente nell'intero sorgente HTML della pagina."""
        return text in self.driver.page_source

    def capture_step(self, step_name: str) -> str:
        """Cattura uno screenshot per lo step corrente."""
        time.sleep(0.3)
        return take_step_screenshot(self.driver, step_name)

