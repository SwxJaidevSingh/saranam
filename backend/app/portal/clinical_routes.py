"""Org-scoped clinical read+write routes — visits, baseline (Initial
Assessment), body-map, and AI patient summary, surfaced under `/api/portal`.

Design notes (read before changing anything):

- These routes do NOT reimplement clinical logic. They are thin, org-scoped
  wrappers around the SAME services/models the main Saranam app uses:
    * VisitService           (app.saranam.services.visit_service)
    * AssessmentService      (app.saranam.services.assessment_service)
    * PatientAiSummary       (app.saranam.models.patient_ai_summary)
    * app.ai.assessment_summary (summarize_patient / flatten_blocks)
    * app.ai.body_locations     (merge_ai_body_locations)
  so the portal and main app stay byte-for-byte consistent on payload shape.

- ORG ISOLATION. The clinical tables (patient_visits, *_assessment,
  patient_ai_summaries) carry NO organization_id of their own — they hang off a
  patient via patient_id. So org-scoping is enforced AT THE PATIENT: every
  handler resolves the patient through `get_scoped_patient_or_404(patient_id,
  ctx)` FIRST and returns 404 if it's None (out-of-scope patients are
  indistinguishable from non-existent ones — never leak cross-org existence).
  Once the patient is confirmed in scope, all of that patient's clinical rows
  are in scope by construction. For visit-keyed writes we additionally verify
  the target visit belongs to that same in-scope patient (`_scoped_visit_or_404`).

- ROLES. Reads use `@portal_auth()` (any authenticated org member, or platform
  admin). Writes use `@portal_auth(*WRITE_ROLES)` so only
  org_data_entry|org_admin|platform_admin can mutate clinical data.
"""
from uuid import UUID

from flask import request, jsonify

from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.scoping import get_scoped_patient_or_404

from app.saranam.services.visit_service import VisitService
from app.saranam.services.assessment_service import AssessmentService
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.patient_ai_summary import PatientAiSummary
from app.extensions import db


# Roles permitted to write clinical data. Platform admins bypass the role
# check inside @portal_auth (god-level access), but still need an active org
# (X-Org-Id) for any write — see assign/scope guards.
WRITE_ROLES = ('org_data_entry', 'org_admin', 'platform_admin')


# Portal baseline `form` segment -> AssessmentService assessment_type.
# The portal exposes friendly names; AssessmentService keys some types
# differently (physio->physiotherapy, plan-of-care->care-plan). This is the
# ONLY place that mapping lives.
BASELINE_FORM_TO_TYPE = {
    'nursing': 'nursing',
    'doctor': 'doctor',
    'esas': 'esas',
    'pps': 'pps',
    'physio': 'physiotherapy',
    'psychological': 'psychological',
    'plan-of-care': 'care-plan',
}

# The forms that make up the full Initial Assessment (Baseline) bundle, in the
# order the frontend renders them.
BASELINE_FORMS = (
    'nursing', 'doctor', 'esas', 'pps', 'physio', 'psychological', 'plan-of-care',
)


def _scoped_visit_or_404(patient, visit_id):
    """Return the visit IFF it belongs to the (already org-scoped) patient.

    The patient is the tenant boundary; a visit is in scope only when its
    patient_id matches an in-scope patient. Cross-patient/cross-org visit ids
    resolve to None so the caller renders 404 (never 403 — don't leak existence).
    """
    visit = PatientVisit.query.get(visit_id)
    if not visit or str(visit.patient_id) != str(patient.id):
        return None
    return visit


# --------------------------------------------------------------------------- #
# Visits
# --------------------------------------------------------------------------- #

@portal_bp.route('/patients/<uuid:patient_id>/visits', methods=['GET'])
@portal_auth()
def portal_list_visits(patient_id, tenant_ctx):
    """List the patient's visits INCLUDING the initial/baseline visit.

    Org-scoped: the patient must be visible to the caller (else 404). Reuses
    VisitService.get_patient_visits with include_initial=True so the baseline
    (visit_type='initial', visit_number 0) is returned alongside follow-ups,
    newest visit_number first.
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    visits = VisitService.get_patient_visits(patient_id, include_initial=True)
    return jsonify({'visits': visits, 'total': len(visits)}), 200


# --------------------------------------------------------------------------- #
# Baseline (Initial Assessment) bundle
# --------------------------------------------------------------------------- #

@portal_bp.route('/patients/<uuid:patient_id>/baseline', methods=['GET'])
@portal_auth()
def portal_get_baseline(patient_id, tenant_ctx):
    """Full Initial Assessment (Baseline) bundle for the patient's initial visit.

    Returns the initial visit plus every baseline form keyed by the portal form
    name (nursing|doctor|esas|pps|physio|psychological|plan-of-care). Each form
    value is the assessment row's to_dict() or null when not yet filled. If the
    patient has no initial visit yet, `visit` is null and all forms are null.

    Org-scoped via the patient (404 if out of scope).
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    visit = VisitService.get_initial_visit(patient_id)

    forms = {form: None for form in BASELINE_FORMS}
    if visit:
        visit_id = visit['id']
        for form in BASELINE_FORMS:
            assessment_type = BASELINE_FORM_TO_TYPE[form]
            forms[form] = AssessmentService.get_assessment(visit_id, assessment_type)

    return jsonify({
        'patient_id': str(patient_id),
        'visit': visit,
        'forms': forms,
    }), 200


@portal_bp.route('/patients/<uuid:patient_id>/baseline/<form>', methods=['PUT'])
@portal_auth(*WRITE_ROLES)
def portal_save_baseline_form(patient_id, form, tenant_ctx):
    """Save/update ONE baseline form on the patient's initial visit (upsert).

    `form` ∈ nursing|doctor|esas|pps|physio|psychological|plan-of-care.
    The initial visit must already exist (created during intake). Reuses
    AssessmentService.save_assessment so validation/cleaning/priority-sync
    behave exactly like the main app.

    Org-scoped: patient must be visible (404), AND the resolved initial visit
    must belong to that patient.
    """
    assessment_type = BASELINE_FORM_TO_TYPE.get(form)
    if not assessment_type:
        return jsonify({
            'error': 'invalid_form',
            'message': f'form must be one of: {", ".join(BASELINE_FORMS)}',
        }), 400

    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    # A baseline form attaches to the patient's initial visit. It must exist
    # (the visit is created at intake); we never auto-create it here.
    visit = VisitService.get_initial_visit(patient_id)
    if not visit:
        return jsonify({
            'error': 'no_initial_visit',
            'message': 'This patient has no initial (baseline) visit yet.',
        }), 404

    data = request.get_json() or {}
    try:
        result = AssessmentService.save_assessment(
            visit_id=UUID(visit['id']),
            assessment_type=assessment_type,
            data=data,
            user_id=UUID(tenant_ctx.user_id),
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    return jsonify({'form': form, 'data': result}), 200


# --------------------------------------------------------------------------- #
# Body map (patient-scoped body_locations on the AI summary snapshot)
# --------------------------------------------------------------------------- #

@portal_bp.route('/patients/<uuid:patient_id>/body-map', methods=['GET'])
@portal_auth()
def portal_get_body_map(patient_id, tenant_ctx):
    """Read the patient's body-map highlights (body_locations).

    Body-map highlights live on the patient-level AI summary snapshot
    (PatientAiSummary.body_locations) — same source the main app's body-map UI
    reads. Returns an empty list when no snapshot exists yet. Org-scoped via
    the patient (404 if out of scope).
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    record = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
    body_locations = (record.body_locations or []) if record else []
    return jsonify({
        'patient_id': str(patient_id),
        'body_locations': body_locations,
    }), 200


@portal_bp.route('/patients/<uuid:patient_id>/body-map', methods=['PUT'])
@portal_auth(*WRITE_ROLES)
def portal_save_body_map(patient_id, tenant_ctx):
    """Replace the patient's body-map highlights (body_locations).

    Accepts {"body_locations": [ {id, zoneSlug, text, userEdited, createdAt,
    updatedAt}, ... ]}. Upserts the patient-level Ai summary snapshot, writing
    ONLY the body_locations column (summary_text is preserved / defaulted empty
    on first create). Org-scoped: patient must be visible (404).
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    data = request.get_json() or {}
    body_locations_in = data.get('body_locations')
    if not isinstance(body_locations_in, list):
        return jsonify({
            'error': 'validation_failed',
            'message': 'body_locations must be a list',
        }), 400

    try:
        record = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
        if record is None:
            # First write: create a snapshot row holding only body-map data.
            # summary_text is NOT NULL, so seed it empty; AI generation/save
            # fills it later via the ai-summary endpoints.
            record = PatientAiSummary(
                patient_id=patient_id,
                summary_text='',
                body_locations=body_locations_in,
                generated_by=UUID(tenant_ctx.user_id),
            )
            db.session.add(record)
        else:
            record.body_locations = body_locations_in
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    return jsonify({
        'patient_id': str(patient_id),
        'body_locations': record.body_locations or [],
    }), 200


# --------------------------------------------------------------------------- #
# AI patient summary
# --------------------------------------------------------------------------- #

@portal_bp.route('/patients/<uuid:patient_id>/ai-summary', methods=['GET'])
@portal_auth()
def portal_get_ai_summary(patient_id, tenant_ctx):
    """Fetch the saved AI patient summary snapshot (or null if none).

    Mirrors the main app's GET /saranam/patients/<id>/summary. Org-scoped via
    the patient (404 if out of scope).
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    record = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
    if record is None:
        return jsonify(None), 200
    return jsonify(record.to_dict()), 200


@portal_bp.route('/patients/<uuid:patient_id>/ai-summary/generate', methods=['POST'])
@portal_auth(*WRITE_ROLES)
def portal_generate_ai_summary(patient_id, tenant_ctx):
    """Generate (DOES NOT persist) the AI patient summary + body-map draft.

    Reuses app.ai.assessment_summary.summarize_patient + flatten_blocks and
    app.ai.body_locations.merge_ai_body_locations, exactly like the main app's
    POST /saranam/patients/<id>/summary/generate. The frontend reviews/edits
    the result then persists via PUT (here: the body-map PUT) / the main save.

    Generation is a write-capable operation (it reads the full clinical record
    and may incur LLM cost), so it's gated to WRITE_ROLES. Org-scoped via the
    patient (404 if out of scope).
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    try:
        from app.ai.assessment_summary import summarize_patient, flatten_blocks
        from app.ai.body_locations import merge_ai_body_locations

        existing = PatientAiSummary.query.filter_by(patient_id=patient_id).first()
        prev_locations = (existing.body_locations or []) if existing else []

        blocks, ai_locations_raw, model = summarize_patient(patient_id, prev_locations)
        merged, diff = merge_ai_body_locations(prev_locations, ai_locations_raw)

        return jsonify({
            'summary_blocks': blocks,
            'summary_text': flatten_blocks(blocks),
            'body_locations': merged,
            'diff_stats': diff,
            'model': model,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI summary generation failed: {e}'}), 502
