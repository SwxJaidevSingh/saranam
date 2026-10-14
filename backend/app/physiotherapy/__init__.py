"""Physiotherapy module."""
from flask import Blueprint

physio_bp = Blueprint('physiotherapy', __name__, url_prefix='/api/physiotherapy')

from app.physiotherapy import routes  # noqa: F401, E402
