import os
import json
import logging

logger = logging.getLogger(__name__)

# Resolve path to the JSON registry file in the analytics directory
JSON_PATH = os.path.join(os.path.dirname(__file__), 'analgesics.json')

def load_analgesics_registry():
    """Loads the analgesics list from analgesics.json."""
    try:
        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading analgesics.json: {e}")
    
    # Fallback default configuration if JSON loading fails
    return {
        "step3": ["morphine", "mst", "m-eslon", "fentanyl", "buprenorphine", "methadone", "oxycodone", "pentazocine", "fortwin"],
        "step2": ["tramadol", "ultracet", "codeine", "tapentadol"],
        "step1": ["paracetamol", "pcm", "dolo", "calpol", "crocin", "ibuprofen", "combiflam", "diclofenac", "dynapar", "naproxen", "aceclofenac", "pregabalin", "amitriptyline", "gabapentin", "ketorolac", "aspirin", "ecosprin"]
    }

def get_medication_pain_step(med_name, schedule_mode=None):
    """Classifies free-text medication name and schedule mode into WHO analgesic ladder step (0-3)."""
    if not med_name:
        return 0
        
    name_clean = med_name.lower().strip()

    # 1. Local Fast-Lookup List from analgesics.json (Prioritized)
    registry = load_analgesics_registry()
    
    if any(x in name_clean for x in registry.get("step3", [])):
        return 3
    if any(x in name_clean for x in registry.get("step2", [])):
        return 2
    if any(x in name_clean for x in registry.get("step1", [])):
        return 1

    # 2. Check schedule mode if not in the registry, but protect against
    # database pollution/defaults by validating the drug name against opioid keyword stems.
    if schedule_mode == "opioid":
        opioid_keywords = ["morphine", "fentanyl", "oxycodone", "buprenorphine", "methadone", "tramadol", "codeine", "tapentadol", "pethidine", "pentazocine", "sufentanil", "alfentanil", "remifentanil", "hydromorphone"]
        if any(kw in name_clean for kw in opioid_keywords):
            return 3

    return 0
