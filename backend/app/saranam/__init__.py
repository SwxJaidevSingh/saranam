"""Saranam Palliative Care Module."""
from flask import Blueprint

saranam_bp = Blueprint('saranam', __name__, url_prefix='/api/saranam')

from app.saranam.routes import register_routes  # noqa: E402


def init_saranam(app):
    """Initialize Saranam module."""
    register_routes(saranam_bp)
    app.register_blueprint(saranam_bp)
