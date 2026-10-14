"""OPD API Routes — Full OPD workflow endpoints."""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID
import math

from app.opd import opd_bp
from app.opd.services import (
    OPDVisitService,
    OPDVitalsService,
    OPDDoctorAssessmentService,
    OPDDiagnosisService,
    OPDPrescriptionService,
    OPDLabOrderService
)


# ---------------------------------------------------------------------------
# Dashboard & Queue
# ---------------------------------------------------------------------------

@opd_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """OPD dashboard statistics."""
    try:
        stats = OPDVisitService.get_dashboard_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/queue', methods=['GET'])
@jwt_required()
def get_queue():
    """Today's OPD queue. Pass ?date=YYYY-MM-DD to get a specific day."""
    try:
        queue_date = request.args.get('date')
        visits = OPDVisitService.get_queue(queue_date)
        return jsonify({'visits': visits, 'total': len(visits)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Visits (CRUD)
# ---------------------------------------------------------------------------

@opd_bp.route('/visits', methods=['GET'])
@jwt_required()
def list_visits():
    """List all OPD visits with optional filters."""
    try:
        patient_id = request.args.get('patient_id')
        provider_id = request.args.get('provider_id')
        status = request.args.get('status')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        offset = (page - 1) * per_page

        visits, total = OPDVisitService.list_visits(
            patient_id=patient_id,
            provider_id=provider_id,
            status=status,
            from_date=from_date,
            to_date=to_date,
            limit=per_page,
            offset=offset
        )

        return jsonify({
            'visits': visits,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': math.ceil(total / per_page) if total > 0 else 0
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits', methods=['POST'])
@jwt_required()
def create_visit():
    """Book a new OPD visit."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data.get('patient_id'):
            return jsonify({'error': 'patient_id is required'}), 400
        if not data.get('start_time'):
            return jsonify({'error': 'start_time is required'}), 400

        visit = OPDVisitService.create_visit(
            patient_id=UUID(data['patient_id']),
            provider_id=UUID(data['provider_id']) if data.get('provider_id') else None,
            start_time=data['start_time'],
            duration=data.get('duration'),
            chief_complaint=data.get('chief_complaint'),
            notes=data.get('notes'),
            booked_by_id=UUID(current_user_id)
        )

        # Send booking confirmation email + calendar invite (async, non-blocking)
        try:
            _send_booking_email(visit, data.get('duration', 30))
        except Exception as mail_err:
            import logging
            logging.getLogger(__name__).warning(f'Booking email failed: {mail_err}')

        return jsonify(visit), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>', methods=['GET'])
@jwt_required()
def get_visit(visit_id):
    """Get full OPD visit detail including vitals, diagnoses, prescription, lab orders."""
    try:
        visit = OPDVisitService.get_visit(visit_id)
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(visit), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/provider', methods=['PATCH'])
@jwt_required()
def update_provider(visit_id):
    """Reassign or set provider for a visit."""
    try:
        data = request.get_json()
        if not data.get('provider_id'):
            return jsonify({'error': 'provider_id is required'}), 400

        visit = OPDVisitService.update_provider(visit_id, UUID(data['provider_id']))
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(visit), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Visit Status Transitions
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/check-in', methods=['POST'])
@jwt_required()
def check_in(visit_id):
    """Check in patient for OPD visit."""
    try:
        visit = OPDVisitService.check_in(visit_id)
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(visit), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/no-show', methods=['POST'])
@jwt_required()
def mark_no_show(visit_id):
    """Mark patient as no-show."""
    try:
        visit = OPDVisitService.mark_no_show(visit_id)
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(visit), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/complete', methods=['POST'])
@jwt_required()
def complete_visit(visit_id):
    """Complete an OPD visit."""
    try:
        data = request.get_json() or {}
        visit = OPDVisitService.complete_visit(
            visit_id=visit_id,
            follow_up_required=data.get('follow_up_required', False),
            follow_up_date=data.get('follow_up_date'),
            referral_service=data.get('referral_service'),
            final_notes=data.get('final_notes')
        )
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(visit), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Vitals
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/vitals', methods=['POST'])
@jwt_required()
def save_vitals(visit_id):
    """Save vitals for an OPD visit."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Get patient_id from the visit
        from app.extensions import db
        from app.encounters.models import Encounter
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404

        vitals = OPDVitalsService.save_vitals(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            vitals_data=data.get('vitals', {}),
            recorded_by_id=UUID(current_user_id),
            assessment_data=data.get('assessment_data'),
            visit_summary=data.get('visit_summary')
        )

        return jsonify(vitals), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/vitals', methods=['GET'])
@jwt_required()
def get_vitals(visit_id):
    """Get vitals for an OPD visit."""
    try:
        vitals = OPDVitalsService.get_vitals(visit_id)
        return jsonify({'vitals': vitals}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Doctor's Assessment
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/doctor-assessment', methods=['POST'])
@jwt_required()
def save_doctor_assessment(visit_id):
    """Save doctor's clinical assessment for an OPD visit."""
    try:
        data = request.get_json() or {}
        result = OPDDoctorAssessmentService.save_assessment(
            visit_id=visit_id,
            assessment_data=data.get('assessment', {})
        )
        if not result:
            return jsonify({'error': 'OPD visit not found'}), 404
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/doctor-assessment', methods=['GET'])
@jwt_required()
def get_doctor_assessment(visit_id):
    """Get doctor's clinical assessment for an OPD visit."""
    try:
        assessment = OPDDoctorAssessmentService.get_assessment(visit_id)
        return jsonify({'assessment': assessment}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Diagnoses
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/diagnoses', methods=['POST'])
@jwt_required()
def save_diagnoses(visit_id):
    """Save/replace diagnoses for an OPD visit."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        from app.extensions import db
        from app.encounters.models import Encounter
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404

        diagnoses = OPDDiagnosisService.save_diagnoses(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            diagnoses_data=data.get('diagnoses', []),
            diagnosed_by_id=UUID(current_user_id)
        )

        return jsonify({'diagnoses': diagnoses}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/diagnoses', methods=['GET'])
@jwt_required()
def get_diagnoses(visit_id):
    """Get diagnoses for an OPD visit."""
    try:
        diagnoses = OPDDiagnosisService.get_diagnoses(visit_id)
        return jsonify({'diagnoses': diagnoses}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/prescriptions', methods=['POST'])
@jwt_required()
def save_prescription(visit_id):
    """Create or update prescription for an OPD visit."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        from app.extensions import db
        from app.encounters.models import Encounter
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404

        provider_id = visit.provider_id
        if not provider_id:
            return jsonify({'error': 'No provider assigned to this visit'}), 400

        prescription = OPDPrescriptionService.save_prescription(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            provider_id=provider_id,
            items=data.get('items', []),
            notes=data.get('notes'),
            finalize=data.get('finalize', False)
        )

        # Store non-pharmacological plan in service_metadata
        non_pharma = data.get('non_pharmacological')
        if non_pharma is not None:
            meta = visit.service_metadata or {}
            meta['non_pharmacological'] = non_pharma
            visit.service_metadata = meta
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(visit, 'service_metadata')
            db.session.commit()

        return jsonify(prescription), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/prescriptions', methods=['GET'])
@jwt_required()
def get_prescription(visit_id):
    """Get prescription for an OPD visit."""
    try:
        prescription = OPDPrescriptionService.get_prescription(visit_id)
        return jsonify({'prescription': prescription}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/prescriptions/status', methods=['PATCH'])
@jwt_required()
def update_prescription_status(visit_id):
    """Update prescription status (draft → finalized → sent_to_pharmacy)."""
    try:
        data = request.get_json()
        status = data.get('status')
        if not status:
            return jsonify({'error': 'status is required'}), 400

        prescription = OPDPrescriptionService.update_status(visit_id, status)
        if not prescription:
            return jsonify({'error': 'Prescription not found'}), 404

        return jsonify(prescription), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Lab Orders
# ---------------------------------------------------------------------------

@opd_bp.route('/visits/<uuid:visit_id>/lab-orders', methods=['POST'])
@jwt_required()
def save_lab_order(visit_id):
    """Create or update lab order for an OPD visit."""
    try:
        data = request.get_json()

        from app.extensions import db
        from app.encounters.models import Encounter
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if not visit:
            return jsonify({'error': 'OPD visit not found'}), 404

        provider_id = visit.provider_id
        if not provider_id:
            return jsonify({'error': 'No provider assigned to this visit'}), 400

        lab_order = OPDLabOrderService.save_lab_order(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            provider_id=provider_id,
            items=data.get('items', []),
            notes=data.get('notes')
        )

        return jsonify(lab_order), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@opd_bp.route('/visits/<uuid:visit_id>/lab-orders', methods=['GET'])
@jwt_required()
def get_lab_order(visit_id):
    """Get lab order for an OPD visit."""
    try:
        lab_order = OPDLabOrderService.get_lab_order(visit_id)
        return jsonify({'lab_order': lab_order}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Booking Email Helper
# ---------------------------------------------------------------------------

def _send_booking_email(visit_data, duration_minutes=30):
    """Send booking confirmation + calendar invite after OPD visit creation."""
    from app.extensions import db
    from app.patients.models import Patient
    from app.providers.models import HealthcareProvider
    from app.reminders.notification_service import BookingNotificationService
    from app.reminders.scheduler import get_settings
    from datetime import datetime as dt
    import pytz

    settings = get_settings()
    if settings.get('reminder_enabled', '').lower() != 'true':
        return

    pid = visit_data.get('patient_id')
    if isinstance(pid, str):
        from uuid import UUID as _UUID
        pid = _UUID(pid)
    patient = db.session.query(Patient).filter(Patient.id == pid).first()
    provider = None
    prov_id = visit_data.get('provider_id')
    if prov_id:
        if isinstance(prov_id, str):
            from uuid import UUID as _UUID
            prov_id = _UUID(prov_id)
        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == prov_id
        ).first()

    patient_name = patient.full_name if patient else 'Patient'
    patient_email = patient.get_email() if patient else None
    provider_name = provider.full_name if provider else 'Doctor'
    provider_email = provider.get_email() if provider and hasattr(provider, 'get_email') else None

    # Parse start_time
    start_str = visit_data.get('start_time', '')
    if isinstance(start_str, str):
        normalized = start_str.replace('Z', '+00:00')
        if 'T' in normalized and normalized.count(':') == 1:
            normalized += ':00'
        start_dt = dt.fromisoformat(normalized)
    else:
        start_dt = start_str

    IST = pytz.timezone('Asia/Kolkata')
    if start_dt.tzinfo is None:
        start_dt = IST.localize(start_dt)

    appt_date = start_dt.strftime('%d %b %Y')
    appt_time = start_dt.strftime('%I:%M %p')

    patient_phone = patient.get_phone() if patient else None
    patient_address = patient.get_address() if patient else None

    BookingNotificationService.send_booking_confirmation(
        patient_name=patient_name,
        patient_email=patient_email,
        provider_name=provider_name,
        provider_email=provider_email,
        appointment_date=appt_date,
        appointment_time=appt_time,
        start_dt=start_dt,
        duration_minutes=int(duration_minutes or 30),
        chief_complaint=visit_data.get('chief_complaint', ''),
        settings=settings,
        patient_phone=patient_phone,
        patient_address=patient_address,
    )
