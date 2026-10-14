"""Homecare Dispatch module: daily homecare scheduling, dispatch and reporting,
built to match the Saranam Streamlit dispatch console."""
from flask import Blueprint

homecare_dispatch_bp = Blueprint('homecare_dispatch', __name__, url_prefix='/api/homecare-dispatch')

from app.homecare_dispatch import routes  # noqa: F401, E402
