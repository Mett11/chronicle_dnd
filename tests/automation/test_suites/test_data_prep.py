import json
import os
import pytest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def test_load_campaign_fixtures():
    """Verifica che i file di fixture per la campagna siano validi e ben formattati."""
    filepath = os.path.join(DATA_DIR, "campaign_fixtures.json")
    assert os.path.exists(filepath), f"File fixture non trovato: {filepath}"
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    assert "test_campaign" in data
    assert "code" in data["test_campaign"]
    assert "test_dm_secret" in data
    assert "secretDesc" in data["test_dm_secret"]

def test_load_user_profiles():
    """Verifica che i profili utente di test per DM e Giocatore siano caricati correttamente."""
    filepath = os.path.join(DATA_DIR, "user_profiles.json")
    assert os.path.exists(filepath), f"File profili utente non trovato: {filepath}"
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    assert "dm_user" in data
    assert "player_user" in data
    assert data["dm_user"]["role"] == "dm"
    assert data["player_user"]["role"] == "player"
