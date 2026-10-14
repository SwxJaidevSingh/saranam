"""Hospital Portal blueprint (`/api/portal`) — multi-tenant, org-scoped API.

Phase 2 (Wave 1) ships tenant isolation + org context + org-scoped patients.
Future waves (provisioning/self-signup/approval, invites+email, analytics,
referral feedback) slot in as additional route modules importing the same
`portal_bp` defined here.

All portal routes authenticate + resolve their org via `@portal_auth`
(app.portal.context) and scope data through app.portal.scoping.
"""
from flask import Blueprint

portal_bp = Blueprint('portal', __name__, url_prefix='/api/portal')

# Import route modules to register their handlers on portal_bp. Kept at the
# bottom to avoid circular imports (the modules import portal_bp from here).
from app.portal import auth_routes  # noqa: E402,F401  (portal login — hospital realm)
from app.portal import org_routes  # noqa: E402,F401
from app.portal import org_settings_routes  # noqa: E402,F401  (org settings + referral feedback)
from app.portal import patient_routes  # noqa: E402,F401
from app.portal import clinical_routes  # noqa: E402,F401
from app.portal import analytics_routes  # noqa: E402,F401
# Wave 2 — onboarding lifecycle (self-signup, approval, invites, members).
from app.portal import onboarding_routes  # noqa: E402,F401
from app.portal import admin_routes  # noqa: E402,F401
from app.portal import invite_routes  # noqa: E402,F401
from app.portal import member_routes  # noqa: E402,F401

__all__ = ['portal_bp']
