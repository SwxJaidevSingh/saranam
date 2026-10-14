"""Home Care module."""
from flask import Blueprint

homecare_bp = Blueprint('homecare', __name__, url_prefix='/api/homecare')

from app.homecare import routes  # noqa: F401, E402
