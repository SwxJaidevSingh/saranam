"""Homecare dispatch system settings, stored as JSON in ``system_settings``.

Same fields, defaults and limits as the Saranam Streamlit "System Settings" page.
"""
import json
from typing import Any, Dict, List
from uuid import uuid4

from app.extensions import db
from app.reminders.models import SystemSetting

SETTINGS_KEY = "homecare_dispatch_settings"

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DEFAULT_SETTINGS: Dict[str, Any] = {
    "Emergency": 1,
    "Urgent": 1,
    "High": 4,
    "Medium": 8,
    "Low": 16,
    "New": 4,
    "homecare_weekdays": ["Monday", "Tuesday", "Thursday", "Friday"],
    "weight_Emergency": 150,
    "weight_Urgent": 125,
    "weight_High": 100,
    "weight_New": 75,
    "weight_Medium": 50,
    "weight_Low": 25,
    "boundary_buffer_km": 2.0,
    "draft_expiry_hours": 1.0,
    "locked_expiry_hours": 24.0,
}

# field -> (type, min, max), matching the Streamlit number inputs
LIMITS = {
    "Emergency": (int, 1, 30),
    "Urgent": (int, 1, 30),
    "High": (int, 1, 60),
    "Medium": (int, 1, 90),
    "Low": (int, 1, 180),
    "New": (int, 1, 60),
    "weight_Emergency": (int, 0, 500),
    "weight_Urgent": (int, 0, 500),
    "weight_High": (int, 0, 500),
    "weight_New": (int, 0, 500),
    "weight_Medium": (int, 0, 500),
    "weight_Low": (int, 0, 500),
    "boundary_buffer_km": (float, 0.5, 10.0),
    "draft_expiry_hours": (float, 0.25, 72.0),
    "locked_expiry_hours": (float, 1.0, 168.0),
}


class SettingsValidationError(ValueError):
    pass


def _row():
    return db.session.query(SystemSetting).filter(SystemSetting.key == SETTINGS_KEY).first()


def load_settings() -> Dict[str, Any]:
    """Stored settings merged over the defaults."""
    config = dict(DEFAULT_SETTINGS)
    config["homecare_weekdays"] = list(DEFAULT_SETTINGS["homecare_weekdays"])
    row = _row()
    if row and row.value:
        try:
            stored = json.loads(row.value)
            if isinstance(stored, dict):
                config.update({k: v for k, v in stored.items() if k in DEFAULT_SETTINGS})
        except (ValueError, TypeError):
            pass
    return config


def validate_settings(data: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce and bound-check a full settings payload; raises SettingsValidationError."""
    clean: Dict[str, Any] = {}
    errors: List[str] = []
    for field, (typ, lo, hi) in LIMITS.items():
        raw = data.get(field, DEFAULT_SETTINGS[field])
        try:
            val = typ(raw)
        except (TypeError, ValueError):
            errors.append(f"{field} must be a number.")
            continue
        if val < lo or val > hi:
            errors.append(f"{field} must be between {lo:g} and {hi:g}.")
            continue
        clean[field] = val

    weekdays = data.get("homecare_weekdays", DEFAULT_SETTINGS["homecare_weekdays"])
    if not isinstance(weekdays, list) or not weekdays:
        errors.append("Please select at least one active weekday.")
    else:
        bad = [d for d in weekdays if d not in WEEKDAY_NAMES]
        if bad:
            errors.append(f"Unknown weekday(s): {', '.join(map(str, bad))}.")
        clean["homecare_weekdays"] = [d for d in WEEKDAY_NAMES if d in weekdays]

    if errors:
        raise SettingsValidationError(" ".join(errors))
    return clean


def save_settings(data: Dict[str, Any]) -> Dict[str, Any]:
    clean = validate_settings(data)
    row = _row()
    value = json.dumps(clean)
    if row:
        row.value = value
    else:
        db.session.add(SystemSetting(
            id=uuid4(), key=SETTINGS_KEY, value=value,
            description="Homecare dispatch SLAs, priority weights, working days and expiry timings",
        ))
    db.session.commit()
    return load_settings()
