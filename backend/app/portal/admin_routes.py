"""Platform-admin onboarding controls — PLATFORM ADMIN ONLY.

Everything here is reserved for CV Raman platform admins (User.is_platform_admin
== True, surfaced as tenant_ctx.is_platform_admin). A regular org_admin must NEVER
be able to approve orgs or grant cross-org access, so these handlers use
`@portal_auth(require_org=False)` (identity-only — no active org required) and then
hard-gate on `tenant_ctx.is_platform_admin`, returning 403 otherwise.

This is the *approval* half of the self-signup → approval state machine started in
onboarding_routes.py.
"""
import logging
from datetime import datetime
from uuid import UUID

from flask import jsonify, request
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.common.models import User
from app.organizations.models import Organization, OrganizationMembership
from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.email_util import send_email

logger = logging.getLogger(__name__)

# Roles a platform admin may grant on a cross-org membership.
GRANTABLE_ROLES = ('org_admin', 'org_data_entry', 'org_viewer')


def _platform_admin_only(tenant_ctx):
    """Return a (payload, 403) response if the caller isn't a platform admin.

    Returns None when the caller IS a platform admin (proceed).
    """
    if not tenant_ctx.is_platform_admin:
        return jsonify({
            'message': 'Platform administrator access required',
            'error': 'platform_admin_required',
        }), 403
    return None


def _coerce_uuid(value):
    """Validate a path/body UUID. Returns str(UUID) or None if malformed."""
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


class GrantMembershipSchema(Schema):
    user_id = fields.UUID(required=True)
    organization_id = fields.UUID(required=True)
    role = fields.Str(required=True, validate=validate.OneOf(GRANTABLE_ROLES))


@portal_bp.route('/admin/pending-orgs', methods=['GET'])
@portal_auth(require_org=False)
def list_pending_orgs(tenant_ctx):
    """PLATFORM ADMIN ONLY: list orgs awaiting approval + their requesting admin."""
    denied = _platform_admin_only(tenant_ctx)
    if denied:
        return denied

    orgs = (
        Organization.query
        .filter_by(status='pending_approval')
        .order_by(Organization.created_at.asc())
        .all()
    )

    items = []
    for org in orgs:
        # The requesting org_admin is the (still inactive) org_admin membership.
        membership = OrganizationMembership.query.filter_by(
            organization_id=org.id,
            role='org_admin',
        ).order_by(OrganizationMembership.created_at.asc()).first()
        requester = None
        if membership:
            user = User.query.get(membership.user_id)
            if user:
                requester = {
                    'user_id': str(user.id),
                    'email': user.email,
                    'full_name': user.full_name,
                    'is_approved': user.is_approved,
                }
        items.append({
            'id': str(org.id),
            'code': org.code,
            'name': org.name,
            'type': org.type,
            'status': org.status,
            'created_at': org.created_at.isoformat() if org.created_at else None,
            'requested_by': requester,
        })

    return jsonify({'organizations': items, 'total': len(items)}), 200


@portal_bp.route('/admin/orgs/<org_id>/approve', methods=['POST'])
@portal_auth(require_org=False)
def approve_org(org_id, tenant_ctx):
    """PLATFORM ADMIN ONLY: activate a pending org + its org_admin.

    Flips: org.status -> 'active', org_admin membership is_active -> True,
    requesting user is_approved -> True. Idempotent-ish: only acts on a
    pending_approval org.
    """
    denied = _platform_admin_only(tenant_ctx)
    if denied:
        return denied

    org_id = _coerce_uuid(org_id)
    if not org_id:
        return jsonify({'message': 'Invalid organization id', 'error': 'invalid_org_id'}), 400

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'message': 'Organization not found', 'error': 'org_not_found'}), 404
    if org.status != 'pending_approval':
        return jsonify({
            'message': f'Organization is not pending approval (status={org.status})',
            'error': 'not_pending',
        }), 409

    try:
        org.status = 'active'

        membership = OrganizationMembership.query.filter_by(
            organization_id=org.id,
            role='org_admin',
        ).order_by(OrganizationMembership.created_at.asc()).first()

        approved_user = None
        if membership:
            membership.is_active = True
            membership.joined_at = membership.joined_at or datetime.utcnow()
            approved_user = User.query.get(membership.user_id)
            if approved_user:
                approved_user.is_approved = True

        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('approve_org failed for %s', org_id)
        return jsonify({'message': 'Approval failed', 'error': 'approval_failed'}), 500

    # Best-effort notification (degrades gracefully if SMTP unset).
    if approved_user and approved_user.email:
        send_email(
            to=approved_user.email,
            subject=f'Your organization "{org.name}" has been approved',
            html_body=(
                f'<p>Hello {approved_user.full_name},</p>'
                f'<p>Your organization <strong>{org.name}</strong> ({org.code}) has '
                f'been approved. You can now sign in to the portal as an organization '
                f'administrator.</p>'
            ),
        )

    return jsonify({
        'message': 'Organization approved',
        'organization': {'id': str(org.id), 'code': org.code, 'status': org.status},
    }), 200


@portal_bp.route('/admin/orgs/<org_id>/reject', methods=['POST'])
@portal_auth(require_org=False)
def reject_org(org_id, tenant_ctx):
    """PLATFORM ADMIN ONLY: reject a pending org.

    Sets status='suspended' (the row is KEPT for audit, never deleted). The
    org_admin membership stays inactive and the user stays unapproved, so access
    remains denied.
    """
    denied = _platform_admin_only(tenant_ctx)
    if denied:
        return denied

    org_id = _coerce_uuid(org_id)
    if not org_id:
        return jsonify({'message': 'Invalid organization id', 'error': 'invalid_org_id'}), 400

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'message': 'Organization not found', 'error': 'org_not_found'}), 404
    if org.status != 'pending_approval':
        return jsonify({
            'message': f'Organization is not pending approval (status={org.status})',
            'error': 'not_pending',
        }), 409

    try:
        org.status = 'suspended'
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('reject_org failed for %s', org_id)
        return jsonify({'message': 'Rejection failed', 'error': 'rejection_failed'}), 500

    return jsonify({
        'message': 'Organization rejected',
        'organization': {'id': str(org.id), 'code': org.code, 'status': org.status},
    }), 200


@portal_bp.route('/admin/grant-membership', methods=['POST'])
@portal_auth(require_org=False)
def grant_membership(tenant_ctx):
    """PLATFORM ADMIN ONLY: insert an ACTIVE cross-org membership.

    This is the cross-org access mechanism — only platform admins can hand a user
    access to an org they didn't sign up for. Rejects duplicate (user, org) rows
    (the unique constraint also backstops this).
    """
    denied = _platform_admin_only(tenant_ctx)
    if denied:
        return denied

    schema = GrantMembershipSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    user_id = str(data['user_id'])
    organization_id = str(data['organization_id'])
    role = data['role']

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found', 'error': 'user_not_found'}), 404
    org = Organization.query.get(organization_id)
    if not org:
        return jsonify({'message': 'Organization not found', 'error': 'org_not_found'}), 404

    existing = OrganizationMembership.query.filter_by(
        user_id=user_id,
        organization_id=organization_id,
    ).first()
    if existing:
        return jsonify({
            'message': 'User already has a membership in this organization',
            'error': 'membership_exists',
        }), 409

    try:
        membership = OrganizationMembership(
            user_id=user_id,
            organization_id=organization_id,
            role=role,
            is_active=True,
            invited_by=tenant_ctx.user.id,
            joined_at=datetime.utcnow(),
        )
        db.session.add(membership)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('grant_membership failed')
        return jsonify({'message': 'Grant failed', 'error': 'grant_failed'}), 500

    return jsonify({
        'message': 'Membership granted',
        'membership': membership.to_dict(),
    }), 201
