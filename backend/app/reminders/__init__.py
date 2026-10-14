"""Appointment Reminder System — Email (Gmail SMTP) + SMS (MSG91)."""
from flask import Blueprint

reminders_bp = Blueprint('reminders', __name__, url_prefix='/api/reminders')

from app.reminders import routes  # noqa: F401, E402
