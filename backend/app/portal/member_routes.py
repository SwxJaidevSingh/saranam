"""Org member management — ORG ADMIN, strictly scoped to the active org.

Both endpoints use @portal_auth('org_admin') so the active org comes from the
membership-validated X-Org-Id. Mutations ONLY ever touch memberships whose
organization_id == the active org; a membership in another org returns 404 (never
acted upon). A safety check prevents an org_admin from demoting/deactivating the
LAST active org_admin, which would orphan the org with no one able to manage it.
"""
import logging

from flask import jsonify, request
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.common.models import User
from app.organizations.models import OrganizationMembership
from app.portal import portal_bp
from app.portal.context import portal_auth

logger = logging.getLogger(__name__)

MEMBER_ROLES = ('org_admin', 'org_data_entry', 'org_viewer')


class UpdateMemberSchema(Schema):
    """PATCH body — both fields optional, but at least one must be present."""
    role = fields.Str(required=False, validate=validate.OneOf(MEMBER_ROLES))
    is_active = fields.Bool(required=False)


@portal_bp.route('/members', methods=['GET'])
@portal_auth('org_admin')
def list_members(tenant_ctx):
    """ORG ADMIN (active org): list memberships (user name/email, role, active)."""
    org_id = tenant_ctx.active_org_id
    if org_id is None:
        return jsonify({
            'message': 'X-Org-Id is required to list members',
            'error': 'org_required',
        }), 400

    rows = (
        OrganizationMembership.query
        .filter_by(organization_id=org_id)
        .order_by(OrganizationMembership.created_at.asc())
        .all()
    )
    members = []
    for m in rows:
        user = User.query.get(m.user_id)
        members.append({
            'membership_id': str(m.id),
            'user_id': str(m.user_id),
            'full_name': user.full_name if user else None,
            'email': user.email if user else None,
            'role': m.role,
            'is_active': m.is_active,
            'joined_at': m.joined_at.isoformat() if m.joined_at else None,
        })
    return jsonify({'members': members, 'total': len(members)}), 200


@portal_bp.route('/members/<membership_id>', methods=['PATCH'])
@portal_auth('org_admin')
def update_member(membership_id, tenant_ctx):
    """ORG ADMIN (active org): change a member's role and/or is_active.

    Scoped to the active org (404 for any other org's membership). Refuses to
    remove the last active org_admin (demote or deactivate) to avoid orphaning.
    """
    org_id = tenant_ctx.active_org_id
    if org_id is None:
        return jsonify({
            'message': 'X-Org-Id is required to manage members',
            'error': 'org_required',
        }), 400

    schema = UpdateMemberSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400
    if not data:
        return jsonify({
            'message': 'Provide at least one of: role, is_active',
            'error': 'no_changes',
        }), 400

    # Scoped lookup — never touch another org's membership.
    membership = OrganizationMembership.query.filter_by(
        id=membership_id,
        organization_id=org_id,
    ).first()
    if not membership:
        return jsonify({'message': 'Member not found', 'error': 'member_not_found'}), 404

    new_role = data.get('role', membership.role)
    new_active = data.get('is_active', membership.is_active)

    # Orphan guard: would this change leave the org with zero active org_admins?
    currently_active_admin = membership.is_active and membership.role == 'org_admin'
    will_be_active_admin = new_active and new_role == 'org_admin'
    if currently_active_admin and not will_be_active_admin:
        other_active_admins = OrganizationMembership.query.filter(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.role == 'org_admin',
            OrganizationMembership.is_active.is_(True),
            OrganizationMembership.id != membership.id,
        ).count()
        if other_active_admins == 0:
            return jsonify({
                'message': 'Cannot remove the last active organization admin',
                'error': 'last_admin',
            }), 409

    try:
        membership.role = new_role
        membership.is_active = new_active
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('update_member failed')
        return jsonify({'message': 'Could not update member', 'error': 'update_failed'}), 500

    return jsonify({'message': 'Member updated', 'membership': membership.to_dict()}), 200
