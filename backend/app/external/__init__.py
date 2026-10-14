"""External API module for integrating with external systems like Health Screening."""
from flask import Blueprint

external_bp = Blueprint('external', __name__, url_prefix='/api/external')

from app.external import routes
