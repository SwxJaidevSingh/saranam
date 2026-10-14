"""OPD (Out-Patient Department) module."""
from flask import Blueprint

opd_bp = Blueprint('opd', __name__, url_prefix='/api/opd')

from app.opd import routes  # noqa: F401, E402
