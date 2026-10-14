"""Prescription versioning routes (under /api/saranam).

Issue an immutable prescription version (PDF generated client-side, stored
privately in Cloudinary), list a patient's versions for the Past Records modal,
stream/download a version (logged), and fetch the latest snapshot for auto-fill.
"""
import io
import json
import logging
from uuid import UUID

from flask import request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.auth.decorators import require_permission

from app.saranam import saranam_bp
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.prescription_version import PrescriptionVersion
from app.saranam.services import prescription_service as rx

logger = logging.getLogger(__name__)

DEFAULT_VERSION_LIMIT = 10
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB


def _uid():
    ident = get_jwt_identity()
    try:
        return UUID(ident) if ident else None
    except (ValueError, TypeError):
        return None


@saranam_bp.route('/visits/<uuid:visit_id>/prescription/issue', methods=['POST'])
@jwt_required()
@require_permission('manage_prescriptions')
def issue_prescription(visit_id):
    """Issue an immutable prescription version for a visit.

    Multipart form-data: file field `pdf` (the client-generated PDF) + a `data`
    field holding the JSON snapshot { medications, icd10_diagnosis, diagnosis_text,
    intervention_pharmacological, intervention_non_pharmacological, doctor }.
    """
    visit = PatientVisit.query.get(visit_id)
    if not visit:
        return jsonify({'error': 'Visit not found'}), 404

    f = request.files.get('pdf')
    if not f:
        return jsonify({'error': 'pdf file is required'}), 400
    pdf_bytes = f.read()
    if not pdf_bytes:
        return jsonify({'error': 'empty pdf'}), 400
    if len(pdf_bytes) > MAX_PDF_BYTES:
        return jsonify({'error': 'PDF too large (max 10 MB)'}), 400

    try:
        data = json.loads(request.form.get('data') or '{}')
    except (ValueError, TypeError):
        return jsonify({'error': 'invalid data payload'}), 400

    doctor = data.get('doctor') or {}
    snapshot = {
        'medications': data.get('medications') or [],
        'icd10_diagnosis': data.get('icd10_diagnosis') or '',
        'diagnosis_text': data.get('diagnosis_text') or '',
        'intervention_pharmacological': data.get('intervention_pharmacological') or '',
        'intervention_non_pharmacological': data.get('intervention_non_pharmacological') or '',
        'follow_up_notes': data.get('follow_up_notes') or '',
    }

    plan = PlanOfCare.query.filter_by(visit_id=visit_id).first()

    try:
        version, created = rx.issue_version(
            patient_id=visit.patient_id,
            visit_id=visit_id,
            plan_of_care_id=plan.id if plan else None,
            visit_type=data.get('visit_type') or getattr(visit, 'visit_type', None),
            snapshot=snapshot,
            doctor=doctor,
            pdf_bytes=pdf_bytes,
            created_by=_uid(),
        )
    except Exception:
        logger.exception('issue_prescription failed for visit %s', visit_id)
        return jsonify({'error': 'Could not issue prescription'}), 500

    return jsonify({
        'message': 'Prescription issued' if created else 'No change since last version',
        'created': created,
        'version': version.to_dict(),
    }), (201 if created else 200)


@saranam_bp.route('/patients/<uuid:patient_id>/prescription-versions', methods=['GET'])
@jwt_required()
@require_permission('manage_prescriptions')
def list_prescription_versions(patient_id):
    """List a patient's prescription versions (newest first) for Past Records."""
    try:
        limit = min(int(request.args.get('limit', DEFAULT_VERSION_LIMIT)), 50)
    except (ValueError, TypeError):
        limit = DEFAULT_VERSION_LIMIT
    rows = (PrescriptionVersion.query
            .filter_by(patient_id=patient_id)
            .order_by(PrescriptionVersion.version_number.desc())
            .limit(limit)
            .all())
    return jsonify({'versions': [v.to_dict() for v in rows], 'total': len(rows)}), 200


@saranam_bp.route('/prescription-versions/<uuid:version_id>/download', methods=['GET'])
@jwt_required()
@require_permission('manage_prescriptions')
def download_prescription_version(version_id):
    """Stream a version's PDF (fetched privately from Cloudinary) + log the download."""
    version = PrescriptionVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    if not version.cloudinary_public_id and not version.pdf_data:
        return jsonify({'error': 'No stored PDF for this version'}), 404

    try:
        pdf_bytes = rx.fetch_pdf_bytes(version)
    except Exception:
        logger.exception('fetch prescription pdf failed for version %s', version_id)
        return jsonify({'error': 'Could not fetch prescription PDF'}), 502

    try:
        rx.record_download(version, _uid())
    except Exception:
        logger.exception('record_download failed for version %s', version_id)

    fname = f'Prescription_v{version.version_number}.pdf'
    return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf',
                     as_attachment=True, download_name=fname)


@saranam_bp.route('/patients/<uuid:patient_id>/prescription/latest', methods=['GET'])
@jwt_required()
@require_permission('manage_prescriptions')
def latest_prescription(patient_id):
    """Return the data to auto-fill a new visit's prescription + the latest version.

    - `version`: the latest issued PrescriptionVersion (has an id) — drives the
      download button. May be null.
    - `carry_forward`: the prescription content to pre-fill the form (meds,
      diagnosis, notes), sourced from the latest version snapshot if one exists,
      otherwise the patient's most recent non-empty Plan of Care across visits.
      This makes auto-fill work even before any version was issued.
    - `doctor`: the prescribing-doctor snapshot from the latest version (if any).

    Excludes the current visit (`exclude_visit` query param) so a freshly-opened
    visit carries forward from a PRIOR prescription, not its own empty draft.
    """
    exclude_visit = request.args.get('exclude_visit')
    version = rx.latest_version(patient_id)

    carry_forward = None
    doctor = None
    if version is not None:
        carry_forward = version.snapshot
        doctor = version.prescribing_doctor
    else:
        q = PlanOfCare.query.filter_by(patient_id=patient_id)
        if exclude_visit:
            q = q.filter(PlanOfCare.visit_id != exclude_visit)
        plans = q.order_by(PlanOfCare.updated_at.desc()).limit(8).all()
        plan = next((p for p in plans
                     if (p.medications and len(p.medications) > 0)
                     or p.diagnosis_text or p.icd10_diagnosis
                     or p.intervention_pharmacological), None)
        if plan is not None:
            carry_forward = {
                'medications': plan.medications or [],
                'icd10_diagnosis': plan.icd10_diagnosis or '',
                'diagnosis_text': plan.diagnosis_text or '',
                'intervention_pharmacological': plan.intervention_pharmacological or '',
                'intervention_non_pharmacological': plan.intervention_non_pharmacological or '',
                'follow_up_notes': plan.follow_up_notes or '',
            }

    return jsonify({
        'version': version.to_dict() if version else None,
        'carry_forward': carry_forward,
        'doctor': doctor,
    }), 200
