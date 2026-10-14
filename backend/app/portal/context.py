"""TenantContext + @portal_auth — the core tenant-isolation logic.

This module resolves, per request, WHO the caller is and WHICH org they are
acting in. Every portal route is gated through `@portal_auth`, which builds a
`TenantContext` and injects it as the `tenant_ctx` kwarg. The scoping helpers in
`app.portal.scoping` then consume that context to filter/stamp queries.

ISOLATION RULES (security-critical — read before changing anything):

- The active org is taken ONLY from the `X-Org-Id` request header — never from a
  query string, body, or JWT claim the client could forge.
- Platform admins (`user.is_platform_admin`) get a "god view": with no
  `X-Org-Id` they see everything unscoped; with `X-Org-Id` they act as that org.
- Regular users MUST send `X-Org-Id`. We then require an ACTIVE
  `OrganizationMembership` (user_id + organization_id + is_active=true) AND an
  active org (`status == 'active'`). Missing membership / inactive org → 403.
  This membership check is the isolation gate: a user can only ever set an
  active org they actually belong to, so the downstream scoping filter can
  never be pointed at someone else's org.
"""
from functools import wraps
from uuid import UUID

from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from app.common.models import User
from app.organizations.models import Organization, OrganizationMembership

# Header carrying the active organization id. The ONLY trusted source of the
# active org — deliberately not read from JWT claims or request body.
ORG_HEADER = 'X-Org-Id'

PLATFORM_ADMIN_ROLE = 'platform_admin'


class TenantContext:
    """Per-request resolved tenant/identity state for portal routes.

    Attributes:
        user_id: str — JWT identity (user UUID as string).
        user: User — the authenticated user row.
        is_platform_admin: bool — CV Raman staff "god view" flag.
        active_org_id: UUID | None — the org the caller is acting in. None ONLY
            for a platform admin who sent no X-Org-Id (unscoped god view).
        role_in_org: str — 'platform_admin' for platform admins, else the
            membership role ('org_admin' | 'org_data_entry' | 'org_viewer').
        membership: OrganizationMembership | None — the matched membership row
            (None for platform admins).
        organization: Organization | None — the active org row, when resolved.
    """

    def __init__(self, user, is_platform_admin, active_org_id,
                 role_in_org, membership=None, organization=None):
        self.user = user
        self.user_id = str(user.id)
        self.is_platform_admin = is_platform_admin
        self.active_org_id = active_org_id
        self.role_in_org = role_in_org
        self.membership = membership
        self.organization = organization

    @property
    def is_god_view(self):
        """True when a platform admin is acting WITHOUT a specific active org.

        In this state reads are unscoped (all orgs) and writes are refused
        (a write must target a concrete org)."""
        return self.is_platform_admin and self.active_org_id is None

    def __repr__(self):
        return (f'<TenantContext user={self.user_id} '
                f'platform_admin={self.is_platform_admin} '
                f'org={self.active_org_id} role={self.role_in_org}>')


class TenantContextError(Exception):
    """Raised while resolving the TenantContext. Carries an HTTP status + body.

    `@portal_auth` catches this and returns (payload, status_code) so the
    isolation failures (401/400/403) surface as clean JSON responses.
    """

    def __init__(self, status_code, error, message):
        super().__init__(message)
        self.status_code = status_code
        self.payload = {'message': message, 'error': error}


def resolve_tenant_context(require_org=True):
    """Build the TenantContext for the current request. THE core security path.

    Raises TenantContextError (401/400/403) on any failure. Returns a fully
    populated TenantContext on success.

    require_org=False relaxes the rule that a regular user must send X-Org-Id —
    used by bootstrap endpoints (e.g. GET /orgs/me) that a user must be able to
    call BEFORE selecting an org. With it False and no X-Org-Id, a regular user
    gets an identity-only context (active_org_id=None, role_in_org=None).
    """
    # 1) Authenticate (reuse flask_jwt_extended exactly like require_auth).
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        raise TenantContextError(401, 'invalid_user', 'User not found')

    # 2) The active org comes ONLY from the X-Org-Id header. Never trust the
    #    body / query string for this — it's the tenant boundary.
    raw_org_id = request.headers.get(ORG_HEADER)
    raw_org_id = raw_org_id.strip() if raw_org_id else None
    # Validate the header is a well-formed UUID before any DB lookup, so a
    # malformed X-Org-Id returns a clean 400 instead of a DB error / 500.
    if raw_org_id:
        try:
            raw_org_id = str(UUID(raw_org_id))
        except (ValueError, TypeError):
            raise TenantContextError(400, 'invalid_org_id',
                                     f'{ORG_HEADER} must be a valid UUID')
    else:
        raw_org_id = None

    # 3) Platform admins ("god view"): may act in any org, or none.
    if user.is_platform_admin:
        if not raw_org_id:
            # No org → fully unscoped god view.
            return TenantContext(
                user=user,
                is_platform_admin=True,
                active_org_id=None,
                role_in_org=PLATFORM_ADMIN_ROLE,
                membership=None,
                organization=None,
            )
        # Acting as a specific org. Validate the org id is a real org so we
        # don't stamp writes with a bogus organization_id, but DO NOT require a
        # membership (that's the whole point of god view).
        org = Organization.query.get(raw_org_id)
        if not org:
            raise TenantContextError(404, 'org_not_found',
                                     'Organization not found')
        return TenantContext(
            user=user,
            is_platform_admin=True,
            active_org_id=org.id,
            role_in_org=PLATFORM_ADMIN_ROLE,
            membership=None,
            organization=org,
        )

    # 4) Regular user: X-Org-Id is normally REQUIRED — except for bootstrap
    #    endpoints (require_org=False), where we return an identity-only context
    #    so the user can discover their memberships before picking an org.
    if not raw_org_id:
        if not require_org:
            return TenantContext(
                user=user,
                is_platform_admin=False,
                active_org_id=None,
                role_in_org=None,
                membership=None,
                organization=None,
            )
        raise TenantContextError(
            400, 'org_required',
            f'{ORG_HEADER} header is required')

    # 5) THE ISOLATION GATE — require an ACTIVE membership for (user, org).
    #    No membership → 403. A user can therefore only ever resolve an
    #    active_org_id they actually belong to.
    membership = OrganizationMembership.query.filter_by(
        user_id=user.id,
        organization_id=raw_org_id,
        is_active=True,
    ).first()
    if not membership:
        raise TenantContextError(
            403, 'no_org_access',
            'You do not have access to this organization')

    # 6) The org itself must be active.
    org = Organization.query.get(membership.organization_id)
    if not org or org.status != 'active':
        raise TenantContextError(
            403, 'org_inactive',
            'This organization is not active')

    return TenantContext(
        user=user,
        is_platform_admin=False,
        active_org_id=org.id,
        role_in_org=membership.role,
        membership=membership,
        organization=org,
    )


def portal_auth(*allowed_org_roles, require_org=True):
    """Decorator: resolve the TenantContext and (optionally) enforce org roles.

    Usage:
        @portal_auth()                      # any authenticated org member
        @portal_auth('org_admin', 'org_data_entry')   # role-gated

    Injects the resolved context as the `tenant_ctx` kwarg. If
    `allowed_org_roles` is non-empty, the caller's `role_in_org` must be in that
    set OR the caller must be a platform admin (platform admins bypass role
    checks — they have god-level access). Mirrors require_auth / require_role.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                ctx = resolve_tenant_context(require_org=require_org)
            except TenantContextError as e:
                return jsonify(e.payload), e.status_code

            if allowed_org_roles and not ctx.is_platform_admin:
                if ctx.role_in_org not in allowed_org_roles:
                    return jsonify({
                        'message': (
                            'Access denied. Required role: '
                            f'{", ".join(allowed_org_roles)}'),
                        'error': 'insufficient_permissions',
                    }), 403

            return f(*args, tenant_ctx=ctx, **kwargs)
        return decorated_function
    return decorator
