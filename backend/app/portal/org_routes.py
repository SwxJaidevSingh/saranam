"""Portal org-context routes: the caller's org/memberships + the org directory.

NEVER expose patient data here — these endpoints are about organizations only.
"""
from flask import jsonify

from app.portal import portal_bp
from app.portal.context import portal_auth
from app.organizations.models import Organization, OrganizationMembership


def _membership_summary(membership, org):
    """Compact {org id, code, name, display_name, role} for a membership row."""
    return {
        'organization_id': str(org.id),
        'code': org.code,
        'name': org.name,
        'display_name': org.display_name,
        'role': membership.role,
    }


@portal_bp.route('/orgs/me', methods=['GET'])
@portal_auth(require_org=False)
def get_my_orgs(tenant_ctx):
    """Return the caller's active org + the orgs they're a member of.

    For platform admins, flag `is_platform_admin=true`. Platform admins may have
    no memberships of their own — that's expected (they use god view / X-Org-Id).
    """
    # All active memberships for this user, with their orgs.
    rows = (
        OrganizationMembership.query
        .filter_by(user_id=tenant_ctx.user.id, is_active=True)
        .all()
    )
    memberships = []
    for m in rows:
        org = Organization.query.get(m.organization_id)
        if org:
            memberships.append(_membership_summary(m, org))

    active_org = tenant_ctx.organization.to_dict() if tenant_ctx.organization else None

    return jsonify({
        'is_platform_admin': tenant_ctx.is_platform_admin,
        'active_org': active_org,
        'active_org_id': str(tenant_ctx.active_org_id) if tenant_ctx.active_org_id else None,
        'role_in_org': tenant_ctx.role_in_org,
        'memberships': memberships,
    }), 200


@portal_bp.route('/org-directory', methods=['GET'])
@portal_auth()
def org_directory(tenant_ctx):
    """Names/codes of OTHER orgs — gated by the active org's directory toggle.

    Returned ONLY if the active org's `can_view_org_directory` is true, or the
    caller is a platform admin. NEVER includes patient data. Other orgs remain
    inaccessible (no data) until a membership is granted.
    """
    if not tenant_ctx.is_platform_admin:
        org = tenant_ctx.organization
        if org is None or not org.can_view_org_directory:
            return jsonify({
                'message': 'Org directory is not enabled for your organization',
                'error': 'directory_disabled',
            }), 403

    # Names/codes of OTHER orgs (exclude the caller's active org). For a
    # platform admin in god view (no active org), list all orgs.
    query = Organization.query
    if tenant_ctx.active_org_id is not None:
        query = query.filter(Organization.id != tenant_ctx.active_org_id)

    others = [
        {
            'id': str(o.id),
            'code': o.code,
            'name': o.name,
            'display_name': o.display_name,
            'type': o.type,
        }
        for o in query.order_by(Organization.name.asc()).all()
    ]

    return jsonify({'organizations': others, 'total': len(others)}), 200
