"""Central org-scoping guards — the single chokepoint for tenant isolation.

EVERY portal read/write that touches org-owned data MUST go through these
helpers rather than building filters inline, so the isolation rule lives in one
auditable place.

RULES:

- READ scope (`apply_org_scope` / `scoped_patient_query`):
    * Platform admin with NO active org (god view) → query is returned
      UNCHANGED (sees all orgs).
    * Everyone else → `query.filter(model.organization_id == ctx.active_org_id)`.
      Because `active_org_id` is only ever set to an org the caller has an
      active membership in (see context.resolve_tenant_context), this can never
      leak another org's rows.

- WRITE stamp (`assign_org_on_create`):
    * `organization_id` is FORCED to `ctx.active_org_id` server-side. It is
      NEVER read from client input. A write in unscoped god view (no active org)
      is refused — a row must belong to a concrete org.

- Single-object fetch (`get_scoped_patient_or_404`):
    * Fetches THROUGH the scoped query. A patient that exists but belongs to
      another org returns None (caller renders 404), NOT 403 — we must not leak
      the existence of out-of-scope rows.
"""
from app.patients.models import Patient


class OrgScopeError(Exception):
    """Raised on an illegal scoping operation (e.g. a god-view write)."""


def apply_org_scope(query, model, ctx):
    """Filter `query` to the caller's active org, or pass through for god view.

    Args:
        query: a SQLAlchemy query for `model`.
        model: the mapped class (must have an `organization_id` column).
        ctx: the resolved TenantContext.

    Returns:
        The query, filtered by `model.organization_id == ctx.active_org_id`,
        EXCEPT for an unscoped platform-admin god view, where it is returned
        unchanged.
    """
    # God view: platform admin with no active org → no scoping.
    if ctx.is_platform_admin and ctx.active_org_id is None:
        return query
    return query.filter(model.organization_id == ctx.active_org_id)


def scoped_patient_query(ctx):
    """Patient.query scoped to the caller's active org (god view = all)."""
    return apply_org_scope(Patient.query, Patient, ctx)


def assign_org_on_create(obj, ctx):
    """Stamp `obj.organization_id` from the context — NEVER from client input.

    Raises OrgScopeError if there is no active org (an unscoped god-view write):
    every owned row must belong to a concrete org.
    """
    if ctx.active_org_id is None:
        raise OrgScopeError(
            'Cannot create an org-owned record without an active organization. '
            'Platform admins must select an org (X-Org-Id) before writing.')
    obj.organization_id = ctx.active_org_id
    return obj


def get_scoped_patient_or_404(patient_id, ctx):
    """Fetch a patient by id WITHIN scope; return None if not visible.

    Returns the Patient if it exists AND is in the caller's scope, else None.
    Out-of-scope patients return None (→ 404 at the route) so we never reveal
    that a patient exists in another org (404-not-403).
    """
    return scoped_patient_query(ctx).filter(Patient.id == patient_id).first()
