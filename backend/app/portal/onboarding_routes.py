"""Org self-signup — PUBLIC (unauthenticated) onboarding entry point.

POST /api/portal/auth/register-org creates a *pending* org + its requesting
org_admin user, but grants NO portal access yet. The state it lands in is
deliberately inert until a platform admin approves it (see admin_routes.py):

    Organization.status        = 'pending_approval'
    User.is_approved           = False          (also can't log in via /api/auth)
    OrganizationMembership      role='org_admin', is_active=False

Why the new admin genuinely cannot use the portal before approval:
`resolve_tenant_context` (app.portal.context) requires BOTH an ACTIVE membership
AND an org whose status == 'active'. Here the membership is inactive AND the org
is pending — so any `/api/portal/*` call with this org returns 403. The user also
can't authenticate through `/api/auth/login` because `is_approved` is False.

SECURITY: this endpoint is unauthenticated and CREATES accounts. It therefore
NEVER trusts client-supplied roles/flags — role is hardcoded 'org_admin' for the
signup admin, the org is forced to status='pending_approval'/type='hospital', and
is_approved/is_active are forced off. The body carries only org name/code and the
admin's email/password/full_name.
"""
import logging

from flask import jsonify, request
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.common.models import User
from app.organizations.models import Organization, OrganizationMembership
from app.portal import portal_bp

logger = logging.getLogger(__name__)


class _OrgSignupOrgSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    code = fields.Str(required=True, validate=validate.Length(min=2, max=16))


class _OrgSignupAdminSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    full_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))


class RegisterOrgSchema(Schema):
    """Self-signup payload. Note there is NO role/status/flag field — those are
    forced server-side; the client cannot influence them."""
    organization = fields.Nested(_OrgSignupOrgSchema, required=True)
    admin = fields.Nested(_OrgSignupAdminSchema, required=True)


@portal_bp.route('/auth/register-org', methods=['POST'])
def register_org():
    """PUBLIC: create a pending org + its org_admin (inactive until approved)."""
    schema = RegisterOrgSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    org_in = data['organization']
    admin_in = data['admin']

    # Normalize identifiers for uniqueness checks.
    code = org_in['code'].strip().upper()
    email = admin_in['email'].strip().lower()

    # Uniqueness — org code and admin email must be free (409 on conflict).
    if Organization.query.filter_by(code=code).first():
        return jsonify({
            'message': 'An organization with this code already exists',
            'error': 'org_code_taken',
        }), 409
    if User.query.filter_by(email=email).first():
        return jsonify({
            'message': 'A user with this email already exists',
            'error': 'email_taken',
        }), 409

    try:
        # 1) Pending org. status + type are forced; never read from the client.
        org = Organization(
            code=code,
            name=org_in['name'].strip(),
            type='hospital',
            status='pending_approval',
        )
        db.session.add(org)
        db.session.flush()  # assign org.id for the membership FK

        # 2) Requesting admin user — NOT approved (can't log in yet).
        user = User(
            email=email,
            full_name=admin_in['full_name'].strip(),
            role='viewer',          # main-app role; portal role lives on membership
            is_approved=False,
            is_active=True,
        )
        user.set_password(admin_in['password'])
        db.session.add(user)
        db.session.flush()  # assign user.id for the membership FK

        # 3) org_admin membership — INACTIVE until approval. Role hardcoded;
        #    a self-signup can only ever request org_admin of its own new org.
        membership = OrganizationMembership(
            user_id=user.id,
            organization_id=org.id,
            role='org_admin',
            is_active=False,
        )
        db.session.add(membership)

        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('register_org failed')
        return jsonify({
            'message': 'Registration failed',
            'error': 'registration_failed',
        }), 500

    return jsonify({
        'message': (
            'Registration received. Your organization is pending approval by a '
            'platform administrator. You will be notified once approved.'),
        'organization': {
            'id': str(org.id),
            'code': org.code,
            'name': org.name,
            'status': org.status,
        },
    }), 202
