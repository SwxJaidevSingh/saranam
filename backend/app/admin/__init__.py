"""Admin blueprint (`/api/admin`) — MAIN-dashboard "Manage Hospitals" module.

This is §2 of the multi-tenant platform: Saranam (platform) admins manage
hospitals/orgs and their users from the MAIN dashboard (NOT the hospital portal).
Every route here is PLATFORM-ADMIN ONLY.

Auth model (defence in depth — three layers):
  1. The global realm gate in app.__init__ blocks any *non-platform* JWT on
     /api/* (this prefix is not exempt) with 403, but lets token-LESS requests
     through. So the gate alone is not sufficient.
  2. `@jwt_required()` on every route rejects token-less callers with 401.
  3. `@platform_admin_required` (below) loads the JWT identity's User and 403s
     unless `is_platform_admin` is True.

Routes live in routes.py and register on `admin_bp` defined here. The module is
imported at the bottom to avoid circular imports (routes.py imports admin_bp
from this package).
"""
from flask import Blueprint

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Import route handlers to bind them onto admin_bp. Kept at the bottom so
# routes.py can `from app.admin import admin_bp` without a circular import.
from app.admin import routes  # noqa: E402,F401

__all__ = ['admin_bp']
