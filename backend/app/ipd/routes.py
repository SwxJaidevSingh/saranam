"""
IPD API Routes
REST endpoints for IPD (In-Patient Department) management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from uuid import UUID
import math

from app.extensions import db
from app.ipd.services import (
    BedManagementService,
    AdmissionService,
    VitalsTrackingService,
    WaitingListService,
    IPDDashboardService
)
from app.ipd.schemas import (
    BedCreateSchema,
    BedUpdateSchema,
    BedResponseSchema,
    BedFilterSchema,
    BedAssignSchema,
    BedTransferSchema,
    IPDAdmissionCreateSchema,
    IPDAdmissionUpdateSchema,
    IPDAdmissionResponseSchema,
    DischargeSchema,
    AdmissionFilterSchema,
    VitalsRecordCreateSchema,
    VitalsRecordResponseSchema,
    WaitingListCreateSchema,
    WaitingListUpdateSchema,
    WaitingListResponseSchema,
    IPDDashboardSchema
)
from app.ipd.models import Bed, IPDAdmission, BedAssignment, BedWaitingList, VitalsRecord
from app.encounters.models import Encounter
from app.patients.models import Patient

# Create Blueprint
ipd_bp = Blueprint('ipd', __name__, url_prefix='/api/ipd')


# ==================== Dashboard ====================

@ipd_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Get IPD dashboard statistics"""
    try:
        stats = IPDDashboardService.get_dashboard_stats(db.session)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== Bed Management ====================

@ipd_bp.route('/beds', methods=['GET'])
@jwt_required()
def list_beds():
    """
    List beds with filters
    Query params: facility_id, building, floor, ward_name, bed_type, bed_status, page, per_page
    """
    try:
        # Parse query parameters
        facility_id = request.args.get('facility_id')
        building = request.args.get('building')
        floor = request.args.get('floor')
        ward_name = request.args.get('ward_name')
        bed_type = request.args.get('bed_type')
        bed_status = request.args.get('bed_status')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)

        # Build query
        query = db.session.query(Bed).filter(Bed.is_active == True)

        if facility_id:
            query = query.filter(Bed.facility_id == UUID(facility_id))
        if building:
            query = query.filter(Bed.building == building)
        if floor:
            query = query.filter(Bed.floor == floor)
        if ward_name:
            query = query.filter(Bed.ward_name.ilike(f'%{ward_name}%'))
        if bed_type:
            query = query.filter(Bed.bed_type == bed_type)
        if bed_status:
            query = query.filter(Bed.bed_status == bed_status)

        # Get total count
        total = query.count()

        # Paginate
        offset = (page - 1) * per_page
        beds = query.order_by(Bed.ward_name, Bed.bed_number).offset(offset).limit(per_page).all()

        # Convert to dict
        beds_data = []
        for bed in beds:
            bed_dict = bed.to_dict()
            beds_data.append(bed_dict)

        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'beds': beds_data,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/<uuid:bed_id>', methods=['GET'])
@jwt_required()
def get_bed(bed_id):
    """Get bed by ID"""
    try:
        bed = db.session.query(Bed).filter(Bed.id == bed_id).first()
        if not bed:
            return jsonify({'error': 'Bed not found'}), 404

        return jsonify(bed.to_dict()), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds', methods=['POST'])
@jwt_required()
def create_bed():
    """Create a new bed"""
    try:
        data = request.get_json()
        schema = BedCreateSchema(**data)

        bed = Bed(
            bed_number=schema.bed_number,
            facility_id=schema.facility_id,
            building=schema.building,
            floor=schema.floor,
            ward_name=schema.ward_name,
            room_number=schema.room_number,
            bed_type=schema.bed_type.value,
            bed_status=schema.bed_status.value,
            has_oxygen=schema.has_oxygen,
            has_ventilator=schema.has_ventilator,
            is_active=schema.is_active,
            notes=schema.notes
        )

        db.session.add(bed)
        db.session.commit()
        db.session.refresh(bed)

        return jsonify(bed.to_dict()), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except IntegrityError as e:
        db.session.rollback()
        error_message = str(e.orig)
        if 'ix_beds_bed_number' in error_message or 'bed_number' in error_message:
            return jsonify({'error': f'Bed number "{schema.bed_number}" already exists. Please use a unique bed number.'}), 400
        return jsonify({'error': 'Database integrity error occurred'}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/<uuid:bed_id>', methods=['PUT'])
@jwt_required()
def update_bed(bed_id):
    """Update a bed"""
    try:
        bed = db.session.query(Bed).filter(Bed.id == bed_id).first()
        if not bed:
            return jsonify({'error': 'Bed not found'}), 404

        data = request.get_json()
        schema = BedUpdateSchema(**data)

        # Update fields
        for field, value in schema.model_dump(exclude_unset=True).items():
            if hasattr(bed, field):
                if isinstance(value, type(lambda: None)):  # Skip enums
                    continue
                setattr(bed, field, value.value if hasattr(value, 'value') else value)

        db.session.commit()
        db.session.refresh(bed)

        return jsonify(bed.to_dict()), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/<uuid:bed_id>/assign', methods=['POST'])
@jwt_required()
def assign_bed(bed_id):
    """Assign a bed to a patient"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        schema = BedAssignSchema(**data)

        assignment, bed = BedManagementService.assign_bed(
            db=db.session,
            bed_id=bed_id,
            patient_id=schema.patient_id,
            admission_id=schema.admission_id,
            encounter_id=schema.encounter_id,
            assigned_by=UUID(current_user_id),
            notes=schema.notes
        )

        # Prepare response
        patient = db.session.query(Patient).filter(Patient.id == schema.patient_id).first()

        return jsonify({
            'assignment': {
                'id': str(assignment.id),
                'bed_id': str(assignment.bed_id),
                'bed_number': bed.bed_number,
                'patient_id': str(assignment.patient_id),
                'patient_name': patient.full_name if patient else None,
                'assigned_at': assignment.assigned_at.isoformat(),
                'assignment_status': assignment.assignment_status
            },
            'bed': bed.to_dict()
        }), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/<uuid:bed_id>/release', methods=['POST'])
@jwt_required()
def release_bed(bed_id):
    """Release a bed"""
    try:
        data = request.get_json() or {}
        notes = data.get('notes')

        bed = BedManagementService.release_bed(
            db=db.session,
            bed_id=bed_id,
            notes=notes
        )

        return jsonify(bed.to_dict()), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/transfer', methods=['POST'])
@jwt_required()
def transfer_bed():
    """Transfer patient from one bed to another"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        schema = BedTransferSchema(**data)

        # Get current bed assignment to find patient
        current_assignment = db.session.query(BedAssignment).filter(
            BedAssignment.bed_id == data.get('current_bed_id'),
            BedAssignment.assignment_status == 'active'
        ).first()

        if not current_assignment:
            return jsonify({'error': 'No active assignment found for current bed'}), 400

        old_assignment, new_assignment = BedManagementService.transfer_bed(
            db=db.session,
            current_bed_id=UUID(data.get('current_bed_id')),
            new_bed_id=schema.new_bed_id,
            patient_id=current_assignment.patient_id,
            admission_id=current_assignment.admission_id,
            transfer_reason=schema.transfer_reason,
            assigned_by=UUID(current_user_id)
        )

        return jsonify({
            'message': 'Bed transfer successful',
            'old_assignment': {
                'id': str(old_assignment.id),
                'status': old_assignment.assignment_status,
                'released_at': old_assignment.released_at.isoformat() if old_assignment.released_at else None
            },
            'new_assignment': {
                'id': str(new_assignment.id),
                'bed_id': str(new_assignment.bed_id),
                'status': new_assignment.assignment_status,
                'assigned_at': new_assignment.assigned_at.isoformat()
            }
        }), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/beds/availability', methods=['GET'])
@jwt_required()
def get_bed_availability():
    """Get bed availability by type"""
    try:
        stats = BedManagementService.get_bed_occupancy_stats(db.session)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== Admissions ====================

@ipd_bp.route('/admissions', methods=['GET'])
@jwt_required()
def list_admissions():
    """List IPD admissions with filters"""
    try:
        patient_id = request.args.get('patient_id')
        admission_type = request.args.get('admission_type')
        admitting_doctor_id = request.args.get('admitting_doctor_id')
        status = request.args.get('status', 'active')  # active or discharged
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)

        # Build query
        query = db.session.query(IPDAdmission).join(Encounter, IPDAdmission.encounter_id == Encounter.id)

        if patient_id:
            query = query.filter(IPDAdmission.patient_id == UUID(patient_id))
        if admission_type:
            query = query.filter(IPDAdmission.admission_type == admission_type)
        if admitting_doctor_id:
            query = query.filter(IPDAdmission.admitting_doctor_id == UUID(admitting_doctor_id))

        if status == 'active':
            query = query.filter(
                Encounter.status == 'in-progress',
                Encounter.discharge_date.is_(None)
            )
        elif status == 'discharged':
            query = query.filter(Encounter.discharge_date.isnot(None))

        # Get total
        total = query.count()

        # Paginate
        offset = (page - 1) * per_page
        admissions = query.order_by(Encounter.admission_date.desc()).offset(offset).limit(per_page).all()

        # Convert to dict with related data
        admissions_data = []
        for admission in admissions:
            adm_dict = admission.to_dict()
            # Add patient name
            if admission.patient:
                adm_dict['patient_name'] = admission.patient.full_name
            # Add doctor name
            if admission.admitting_doctor:
                adm_dict['admitting_doctor_name'] = admission.admitting_doctor.full_name
            # Add dates from encounter
            if admission.encounter:
                adm_dict['admission_date'] = admission.encounter.admission_date.isoformat() if admission.encounter.admission_date else None
                adm_dict['discharge_date'] = admission.encounter.discharge_date.isoformat() if admission.encounter.discharge_date else None
                if admission.encounter.admission_date:
                    los = AdmissionService.calculate_length_of_stay(
                        admission.encounter.admission_date,
                        admission.encounter.discharge_date
                    )
                    adm_dict['length_of_stay_days'] = los

            admissions_data.append(adm_dict)

        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'admissions': admissions_data,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>', methods=['GET'])
@jwt_required()
def get_admission(admission_id):
    """Get admission by ID"""
    try:
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        adm_dict = admission.to_dict()

        # Add related data
        if admission.patient:
            adm_dict['patient_name'] = admission.patient.full_name
        if admission.admitting_doctor:
            adm_dict['admitting_doctor_name'] = admission.admitting_doctor.full_name
        if admission.encounter:
            adm_dict['admission_date'] = admission.encounter.admission_date.isoformat() if admission.encounter.admission_date else None
            adm_dict['discharge_date'] = admission.encounter.discharge_date.isoformat() if admission.encounter.discharge_date else None
            if admission.encounter.admission_date:
                los = AdmissionService.calculate_length_of_stay(
                    admission.encounter.admission_date,
                    admission.encounter.discharge_date
                )
                adm_dict['length_of_stay_days'] = los

        return jsonify(adm_dict), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions', methods=['POST'])
@jwt_required()
def create_admission():
    """Admit a patient to IPD"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        schema = IPDAdmissionCreateSchema(**data)

        admission, encounter = AdmissionService.admit_patient(
            db=db.session,
            patient_id=schema.patient_id,
            admission_type=schema.admission_type.value,
            admitting_doctor_id=schema.admitting_doctor_id,
            encounter_id=schema.encounter_id,
            create_new_encounter=schema.create_new_encounter,
            chief_complaint=schema.chief_complaint,
            admission_source=schema.admission_source.value if schema.admission_source else None,
            admission_diagnosis=schema.admission_diagnosis,
            admission_notes=schema.admission_notes,
            estimated_length_of_stay_days=schema.estimated_length_of_stay_days,
            service_id=schema.service_id,
            bed_id=schema.bed_id,
            assigned_by=UUID(current_user_id),
            admission_form_id=schema.admission_form_id,
            form_data=schema.form_data
        )

        # Prepare response
        adm_dict = admission.to_dict()
        if admission.patient:
            adm_dict['patient_name'] = admission.patient.full_name
        if admission.admitting_doctor:
            adm_dict['admitting_doctor_name'] = admission.admitting_doctor.full_name
        adm_dict['admission_date'] = encounter.admission_date.isoformat() if encounter.admission_date else None

        return jsonify(adm_dict), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>', methods=['PUT'])
@jwt_required()
def update_admission(admission_id):
    """Update an admission"""
    try:
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        data = request.get_json()
        schema = IPDAdmissionUpdateSchema(**data)

        # Update fields
        for field, value in schema.model_dump(exclude_unset=True).items():
            if hasattr(admission, field):
                setattr(admission, field, value.value if hasattr(value, 'value') else value)

        db.session.commit()
        db.session.refresh(admission)

        return jsonify(admission.to_dict()), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>/discharge', methods=['POST'])
@jwt_required()
def discharge_patient(admission_id):
    """Discharge a patient"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        schema = DischargeSchema(**data)

        admission = AdmissionService.discharge_patient(
            db=db.session,
            admission_id=admission_id,
            discharge_type=schema.discharge_type.value,
            discharge_diagnosis=schema.discharge_diagnosis,
            discharge_summary=schema.discharge_summary,
            discharge_instructions=schema.discharge_instructions,
            doctor_notes=schema.doctor_notes,
            billing_summary=schema.billing_summary,
            schedule_follow_up=schema.schedule_follow_up,
            follow_up_days=schema.follow_up_days,
            follow_up_service_id=schema.follow_up_service_id,
            discharge_form_id=schema.discharge_form_id,
            form_data=schema.form_data,
            discharged_by=UUID(current_user_id)
        )

        adm_dict = admission.to_dict()
        if admission.patient:
            adm_dict['patient_name'] = admission.patient.full_name
        if admission.encounter:
            adm_dict['discharge_date'] = admission.encounter.discharge_date.isoformat() if admission.encounter.discharge_date else None

        return jsonify(adm_dict), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Vitals ====================

@ipd_bp.route('/admissions/<uuid:admission_id>/vitals', methods=['POST'])
@jwt_required()
def record_vitals(admission_id):
    """Record vitals for an admission"""
    try:
        current_user_id = get_jwt_identity()

        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        data = request.get_json()
        schema = VitalsRecordCreateSchema(**data)

        vitals = VitalsTrackingService.record_vitals(
            db=db.session,
            encounter_id=admission.encounter_id,
            patient_id=admission.patient_id,
            vitals_data=schema.vitals_data,
            recorded_by=UUID(current_user_id),
            recorded_at=schema.recorded_at,
            observation_notes=schema.observation_notes
        )

        # Prepare response
        vitals_dict = vitals.to_dict()
        if admission.patient:
            vitals_dict['patient_name'] = admission.patient.full_name

        return jsonify(vitals_dict), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>/vitals', methods=['GET'])
@jwt_required()
def get_vitals_history(admission_id):
    """Get vitals history for an admission"""
    try:
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        limit = int(request.args.get('limit', 50))

        vitals_records = VitalsTrackingService.get_vitals_history(
            db=db.session,
            encounter_id=admission.encounter_id,
            limit=limit
        )

        vitals_data = [v.to_dict() for v in vitals_records]

        return jsonify({
            'vitals': vitals_data,
            'total': len(vitals_data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/vitals/critical', methods=['GET'])
@jwt_required()
def get_critical_vitals():
    """Get all critical vitals"""
    try:
        hours = int(request.args.get('hours', 24))

        critical_vitals = VitalsTrackingService.get_critical_vitals(db.session, hours=hours)

        vitals_data = []
        for vitals in critical_vitals:
            v_dict = vitals.to_dict()
            if vitals.patient:
                v_dict['patient_name'] = vitals.patient.full_name
            vitals_data.append(v_dict)

        return jsonify({
            'critical_vitals': vitals_data,
            'total': len(vitals_data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== Waiting List ====================

@ipd_bp.route('/waiting-list', methods=['GET'])
@jwt_required()
def get_waiting_list():
    """Get bed waiting list"""
    try:
        status = request.args.get('status', 'waiting')
        priority = request.args.get('priority')
        bed_type = request.args.get('bed_type')

        waiting_list = WaitingListService.get_waiting_list(
            db=db.session,
            status=status,
            priority=priority,
            bed_type=bed_type
        )

        list_data = []
        for entry in waiting_list:
            entry_dict = entry.to_dict()
            if entry.patient:
                entry_dict['patient_name'] = entry.patient.full_name
            if entry.service:
                entry_dict['service_name'] = entry.service.name
            if entry.assigned_bed:
                entry_dict['assigned_bed_number'] = entry.assigned_bed.bed_number
            list_data.append(entry_dict)

        return jsonify({
            'waiting_list': list_data,
            'total': len(list_data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/waiting-list', methods=['POST'])
@jwt_required()
def add_to_waiting_list():
    """Add patient to waiting list"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        schema = WaitingListCreateSchema(**data)

        waiting_entry = WaitingListService.add_to_waiting_list(
            db=db.session,
            patient_id=schema.patient_id,
            requested_bed_type=schema.requested_bed_type.value,
            priority=schema.priority.value,
            service_id=schema.service_id,
            requested_by=UUID(current_user_id),
            notes=schema.notes
        )

        entry_dict = waiting_entry.to_dict()
        if waiting_entry.patient:
            entry_dict['patient_name'] = waiting_entry.patient.full_name

        return jsonify(entry_dict), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/waiting-list/<uuid:waiting_list_id>', methods=['PUT'])
@jwt_required()
def update_waiting_list(waiting_list_id):
    """Update waiting list entry"""
    try:
        waiting_entry = db.session.query(BedWaitingList).filter(
            BedWaitingList.id == waiting_list_id
        ).first()

        if not waiting_entry:
            return jsonify({'error': 'Waiting list entry not found'}), 404

        data = request.get_json()
        schema = WaitingListUpdateSchema(**data)

        for field, value in schema.model_dump(exclude_unset=True).items():
            if hasattr(waiting_entry, field):
                setattr(waiting_entry, field, value.value if hasattr(value, 'value') else value)

        db.session.commit()
        db.session.refresh(waiting_entry)

        return jsonify(waiting_entry.to_dict()), 200

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Clinical Documentation ====================

@ipd_bp.route('/admissions/<uuid:admission_id>/progress-notes', methods=['POST'])
@jwt_required()
def create_progress_note(admission_id):
    """Create a progress note for an admission"""
    try:
        from app.form_configurations.services import ClinicalDocumentationService
        from app.form_configurations.models import DocumentationType
        from app.submissions.models import FormSubmission

        current_user_id = get_jwt_identity()

        # Verify admission exists
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        data = request.get_json()
        form_id = data.get('form_id')
        form_data = data.get('form_data')
        notes = data.get('notes')

        # Create form submission if form data provided
        form_submission_id = None
        if form_data and form_id:
            form_submission = FormSubmission(
                form_id=UUID(form_id),
                patient_id=admission.patient_id,
                encounter_id=admission.encounter_id,
                submitted_by=UUID(current_user_id),
                data=form_data,
                status='submitted'
            )
            db.session.add(form_submission)
            db.session.flush()
            form_submission_id = form_submission.id

        # Create clinical documentation
        doc, message = ClinicalDocumentationService.create_documentation(
            admission_id=admission_id,
            patient_id=admission.patient_id,
            encounter_id=admission.encounter_id,
            documentation_type=DocumentationType.PROGRESS_NOTE.value,
            documented_by=UUID(current_user_id),
            form_submission_id=form_submission_id,
            notes=notes
        )

        if not doc:
            return jsonify({'error': message}), 400

        return jsonify({
            'message': message,
            'documentation': doc.to_dict()
        }), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>/nursing-assessments', methods=['POST'])
@jwt_required()
def create_nursing_assessment(admission_id):
    """Create a nursing assessment for an admission"""
    try:
        from app.form_configurations.services import ClinicalDocumentationService
        from app.form_configurations.models import DocumentationType
        from app.submissions.models import FormSubmission

        current_user_id = get_jwt_identity()

        # Verify admission exists
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        data = request.get_json()
        form_id = data.get('form_id')
        form_data = data.get('form_data')
        notes = data.get('notes')

        # Create form submission if form data provided
        form_submission_id = None
        if form_data and form_id:
            form_submission = FormSubmission(
                form_id=UUID(form_id),
                patient_id=admission.patient_id,
                encounter_id=admission.encounter_id,
                submitted_by=UUID(current_user_id),
                data=form_data,
                status='submitted'
            )
            db.session.add(form_submission)
            db.session.flush()
            form_submission_id = form_submission.id

        # Create clinical documentation
        doc, message = ClinicalDocumentationService.create_documentation(
            admission_id=admission_id,
            patient_id=admission.patient_id,
            encounter_id=admission.encounter_id,
            documentation_type=DocumentationType.NURSING_ASSESSMENT.value,
            documented_by=UUID(current_user_id),
            form_submission_id=form_submission_id,
            notes=notes
        )

        if not doc:
            return jsonify({'error': message}), 400

        return jsonify({
            'message': message,
            'documentation': doc.to_dict()
        }), 201

    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ipd_bp.route('/admissions/<uuid:admission_id>/clinical-documentation', methods=['GET'])
@jwt_required()
def get_clinical_documentation(admission_id):
    """Get all clinical documentation for an admission"""
    try:
        from app.form_configurations.services import ClinicalDocumentationService

        # Verify admission exists
        admission = db.session.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            return jsonify({'error': 'Admission not found'}), 404

        documentation_type = request.args.get('type')

        docs = ClinicalDocumentationService.get_documentation_for_admission(
            admission_id=admission_id,
            documentation_type=documentation_type
        )

        return jsonify({
            'documentation': [doc.to_dict() for doc in docs],
            'total': len(docs)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
