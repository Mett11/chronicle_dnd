import sys
import os
import time
import urllib.request
import subprocess
import pytest

# Aggiunge la directory 'tests/automation' al sys.path per garantire import trasparenti su Windows, Linux e macOS
AUTOMATION_ROOT = os.path.dirname(os.path.abspath(__file__))
if AUTOMATION_ROOT not in sys.path:
    sys.path.insert(0, AUTOMATION_ROOT)

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions

SCREENSHOT_DIR = os.path.join(AUTOMATION_ROOT, "reports", "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

server_process = None

@pytest.fixture(scope="session", autouse=True)
def ensure_app_server():
    """Garantisce che il server dev sia in esecuzione su http://localhost:3000 prima di eseguire i test."""
    global server_process
    url = os.environ.get("TEST_APP_URL", "http://localhost:3000")
    
    def is_server_up():
        try:
            req = urllib.request.urlopen(url, timeout=2)
            return req.status == 200
        except Exception:
            return False

    if not is_server_up():
        print(f"\n[Conftest] App server non attivo su {url}. Avvio temporaneo 'npm run dev'...")
        project_root = os.path.abspath(os.path.join(AUTOMATION_ROOT, "..", ".."))
        server_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        start_time = time.time()
        while time.time() - start_time < 30:
            if is_server_up():
                print("[Conftest] Server avviato con successo!")
                break
            time.sleep(1)

    yield

    if server_process:
        print("[Conftest] Arresto del server dev...")
        server_process.terminate()

@pytest.fixture(scope="session")
def base_url():
    """URL dell'applicazione sotto test."""
    return os.environ.get("TEST_APP_URL", "http://localhost:3000")

@pytest.fixture(scope="function")
def driver(request):
    """Fixture Selenium WebDriver con opzioni headless per esecuzione automatica."""
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    
    try:
        from webdriver_manager.chrome import ChromeDriverManager
        service = ChromeService(ChromeDriverManager().install())
        driver_obj = webdriver.Chrome(service=service, options=options)
    except Exception:
        driver_obj = webdriver.Chrome(options=options)
        
    driver_obj.implicitly_wait(5)
    
    yield driver_obj
    
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        test_name = request.node.name
        screenshot_path = os.path.join(SCREENSHOT_DIR, f"FAILURE_{test_name}_{int(time.time())}.png")
        try:
            driver_obj.save_screenshot(screenshot_path)
        except Exception:
            pass
        
    try:
        driver_obj.quit()
    except Exception:
        pass

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook Pytest per collegare gli screenshot al report HTML finale."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)

def take_step_screenshot(driver, step_name: str) -> str:
    """Cattura uno screenshot del singolo step e restituisce il percorso del file."""
    timestamp = int(time.time() * 1000)
    filename = f"step_{timestamp}_{step_name.replace(' ', '_')}.png"
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    try:
        driver.save_screenshot(filepath)
    except Exception:
        pass
    return filepath

