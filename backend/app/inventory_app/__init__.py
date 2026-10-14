"""Inventory module: medicine catalog, stock by source, dispensing, returns,
error reporting, reports and admin — built to match the Saranam Streamlit
inventory app, sharing its tables."""
from flask import Blueprint

inventory_app_bp = Blueprint('inventory_app', __name__, url_prefix='/api/inventory')

from app.inventory_app import routes  # noqa: F401, E402
