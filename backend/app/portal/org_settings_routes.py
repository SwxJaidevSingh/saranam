"""Org Settings + Referral Feedback — §5 of the Hospital Portal.

Two org-scoped slices for the portal, both resolved/isolated via @portal_auth:

1. Org Settings — an org_admin VIEWS their active org's full profile and EDITS
   only its branding (display_name, logo_url, accent_color). Everything else
   (status, code, type, linked_hospital_code, the toggles) is owned by Saranam
   and changed only from the main (god-view) dashboard, so this route refuses to
   touch those fields — they are never read from the request body.

2. Referral Feedback — a CURATED, de-sensitized outcome summary of THIS org's
   OWN patients, gated by the org's `show_referral_feedback` toggle. SAFE fields
   only: no diagnoses, visit notes, PPS, observations, contact, ABHA, or any
   clinical record ever leaves this endpoint.

Org isolation is automatic: the active org comes only from the X-Org-Id header
(see app.portal.context) and patient reads flow through scoped_patient_query
(see app.portal.scoping), so a caller can only ever see their own org's data.
"""
import math

from flask import jsonify, request

from app.extensions import db
from app.patients.models import Patient
from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.scoping import scoped_patient_query

# The ONLY org fields an org_admin may edit from the portal. Everything else
# (status, code, type, linked_hospital_code, can_view_org_directory,
# show_referral_feedback, ...) is Saranam-controlled from the main dashboard and
# is deliberately NOT in this allow-list, so it can never be changed here.
BRANDING_FIELDS = ('display_name', 'logo_url', 'accent_color')


def _safe_patient_summary(p):
    """De-sensitized, SAFE-fields-only view of a patient for referral feedback.

    Explicit allow-list — NEVER spread the model. No diagnoses, visit notes,
    PPS, observations, contact, ABHA, caregiver, or any clinical record.
    """
    return {
        'id': str(p.id) if p.id else None,
        'full_name': p.full_name,
        'care_status': p.care_status,
        'is_deceased': p.is_deceased,
        'date_of_death': p.date_of_death.isoformat() if p.date_of_death else None,
        'last_update': p.updated_at.isoformat() if p.updated_at else None,
        'origin_type': p.origin_type,
    }


# ── Org Settings ──────────────────────────────────────────────────────────────

@portal_bp.route('/org-settings', methods=['GET'])
@portal_auth()
def get_org_settings(tenant_ctx):
    """Return the active org's full profile.

    400 for a platform admin in unscoped god view (no active org) — there is no
    single org to view; they manage orgs from the main dashboard instead.
    """
    org = tenant_ctx.organization
    if org is None:
        return jsonify({
            'error': 'no_active_org',
            'message': 'No active organization. Select one via X-Org-Id.',
        }), 400
    return jsonify(org.to_dict()), 200


@portal_bp.route('/org-settings', methods=['PUT'])
@portal_auth('org_admin')
def update_org_settings(tenant_ctx):
    """Update ONLY the active org's branding (display_name, logo_url, accent_color).

    Any other field in the body is ignored — status, code, type,
    linked_hospital_code and the toggles are Saranam's and are never read here.
    """
    org = tenant_ctx.organization
    if org is None:
        return jsonify({
            'error': 'no_active_org',
            'message': 'No active organization. Select one via X-Org-Id.',
        }), 400

    data = request.get_json(silent=True) or {}

    # Apply ONLY branding fields that were actually supplied. Everything else in
    # the payload is silently ignored (never written) — the branding-only rule.
    for field in BRANDING_FIELDS:
        if field in data:
            value = data[field]
            # Normalise empty string to NULL; trim incidental whitespace.
            if isinstance(value, str):
                value = value.strip() or None
            setattr(org, field, value)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    return jsonify(org.to_dict()), 200


# ── Referral Feedback ─────────────────────────────────────────────────────────

# Optional ?status= filter values for the de-sensitized patient list.
FEEDBACK_STATUSES = ('active', 'inactive', 'deceased')


def _apply_feedback_status_filter(query, status):
    """Filter the org-scoped patient query by the referral-feedback status.

    - active   → alive, currently in care: is_active & ~is_deceased & care_status='active'
    - inactive → alive, not in care: is_active & ~is_deceased & care_status='inactive'
    - deceased → is_deceased (regardless of care_status)
    """
    if status == 'active':
        return query.filter(
            Patient.is_active.is_(True),
            Patient.is_deceased.is_(False),
            Patient.care_status == 'active',
        )
    if status == 'inactive':
        return query.filter(
            Patient.is_active.is_(True),
            Patient.is_deceased.is_(False),
            Patient.care_status == 'inactive',
        )
    if status == 'deceased':
        return query.filter(Patient.is_deceased.is_(True))
    return query


@portal_bp.route('/referral-feedback', methods=['GET'])
@portal_auth()
def referral_feedback(tenant_ctx):
    """Curated, de-sensitized outcome summary of the org's OWN patients.

    Gated by the active org's `show_referral_feedback` toggle: if it is False
    (and the caller is not a platform admin) → 403 {error: 'feedback_disabled'}.

    Returns aggregate `counts` plus a paginated, SAFE-fields-only `patients`
    list. Supports an optional ?status=active|inactive|deceased filter and the
    same page/per_page pagination as the patients list.
    """
    # ── The feature gate. Platform admins bypass it (god-level access). ──
    if not tenant_ctx.is_platform_admin:
        org = tenant_ctx.organization
        if org is None or not org.show_referral_feedback:
            return jsonify({
                'message': 'Referral feedback is not enabled for your organization',
                'error': 'feedback_disabled',
            }), 403

    # Optional status filter — reject unknown values with a clean 400.
    status = request.args.get('status', '').strip().lower() or None
    if status is not None and status not in FEEDBACK_STATUSES:
        return jsonify({
            'error': 'invalid_status',
            'message': f"status must be one of: {', '.join(FEEDBACK_STATUSES)}",
        }), 400

    # Pagination, consistent with the patients list (default 20, cap 100).
    page = max(int(request.args.get('page', 1)), 1)
    per_page = min(max(int(request.args.get('per_page', 20)), 1), 100)

    # ── The isolation boundary: only THIS org's patients (god view = all). ──
    base = scoped_patient_query(tenant_ctx)

    # Aggregate counts over the org-scoped set (independent of the status filter).
    total = base.count()
    active = base.filter(
        Patient.is_active.is_(True),
        Patient.is_deceased.is_(False),
        Patient.care_status == 'active',
    ).count()
    inactive = base.filter(
        Patient.is_active.is_(True),
        Patient.is_deceased.is_(False),
        Patient.care_status == 'inactive',
    ).count()
    deceased = base.filter(Patient.is_deceased.is_(True)).count()

    # The (optionally filtered) page of de-sensitized patient summaries.
    listing = _apply_feedback_status_filter(base, status)
    filtered_total = listing.count()
    offset = (page - 1) * per_page
    rows = (
        listing.order_by(Patient.updated_at.desc())
        .limit(per_page)
        .offset(offset)
        .all()
    )
    patients = [_safe_patient_summary(p) for p in rows]
    total_pages = math.ceil(filtered_total / per_page) if filtered_total > 0 else 0

    return jsonify({
        'counts': {
            'total': total,
            'active': active,
            'inactive': inactive,
            'deceased': deceased,
        },
        'patients': patients,
        'status': status,
        'total': filtered_total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    }), 200
