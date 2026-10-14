"""Portal login — HOSPITAL users only.

Realm separation: the Hospital Portal and the main (Saranam) dashboard are two
separate login realms that must never cross.
- Main dashboard login (`/api/auth/login`) accepts only platform/Saranam staff
  (`is_platform_admin=true`).
- Portal login (here, `/api/portal/auth/login`) accepts only users who have an
  ACTIVE organization membership. Saranam/platform-only users (no membership)
  are rejected — they belong in the main dashboard.

Credential checks (password, is_approved, is_active) reuse AuthService so the
two realms stay consistent; only the realm gate differs.
"""
from flask import jsonify, request
from marshmallow import Schema, fields, ValidationError

from app.auth.services import AuthService
from app.organizations.models import OrganizationMembership
from app.portal import portal_bp


class _PortalLoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)


@portal_bp.route('/auth/login', methods=['POST'])
def portal_login():
    """Authenticate a hospital user (must have an active org membership)."""
    try:
        data = _PortalLoginSchema().load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    result, message = AuthService.authenticate_user(
        email=data['email'], password=data['password']
    )
    if not result:
        return jsonify({'message': message, 'error': 'authentication_failed'}), 401

    # Realm gate: portal is for hospital users only.
    has_membership = OrganizationMembership.query.filter_by(
        user_id=result['user']['id'], is_active=True
    ).first() is not None
    if not has_membership:
        return jsonify({
            'message': 'This account does not belong to any hospital. '
                       'If you are Saranam staff, please use the main dashboard.',
            'error': 'no_org_access',
        }), 403

    return jsonify({
        'message': 'Login successful',
        'access_token': result['access_token'],
        'refresh_token': result['refresh_token'],
        'user': result['user'],
    }), 200
