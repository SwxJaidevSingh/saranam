"""Visit Service — business logic for patient visits."""
from datetime import date, datetime
from uuid import UUID
from typing import Optional, List, Dict, Tuple

from sqlalchemy import text

from app.extensions import db
from app.saranam.models.patient_visit import PatientVisit
from app.patients.models import Patient


class VisitService:
    """Service for patient visit operations."""

    @staticmethod
    def create_visit(patient_id: UUID, data: dict, created_by: UUID) -> dict:
        """Create a new visit for a patient."""
        patient = Patient.query.get(patient_id)
        if not patient:
            raise ValueError('Patient not found')

        visit_number = PatientVisit.next_visit_number(patient_id)

        # Multi-select consultation flags
        c_flags = {}
        for role in ['doctor_consultation', 'nursing_consultation', 'counsellor_consultation', 'physiotherapy_consultation', 'social_worker_consultation']:
            if role in data:
                c_flags[role] = bool(data[role])
        if 'consultation_types' in data and isinstance(data['consultation_types'], list):
            c_list = [c.lower() for c in data['consultation_types'] if isinstance(c, str)]
            c_flags['doctor_consultation'] = any('doc' in c or 'physician' in c for c in c_list)
            c_flags['nursing_consultation'] = any('nurse' in c for c in c_list)
            c_flags['counsellor_consultation'] = any('counsel' in c for c in c_list)
            c_flags['physiotherapy_consultation'] = any('physio' in c for c in c_list)
            c_flags['social_worker_consultation'] = any('social' in c or 'msw' in c for c in c_list)

        visit = PatientVisit(
            patient_id=patient_id,
            visit_number=visit_number,
            visit_type=data.get('visit_type', 'follow_up'),
            doctor_consultation=c_flags.get('doctor_consultation', False),
            nursing_consultation=c_flags.get('nursing_consultation', False),
            counsellor_consultation=c_flags.get('counsellor_consultation', False),
            physiotherapy_consultation=c_flags.get('physiotherapy_consultation', False),
            social_worker_consultation=c_flags.get('social_worker_consultation', False),
            visit_date=data.get('visit_date', date.today()),
            visit_location=data.get('visit_location'),
            team_members=data.get('team_members'),
            vehicle_id=data.get('vehicle_id'),
            # Vitals
            vitals_pr=data.get('vitals_pr'),
            vitals_bp_systolic=data.get('vitals_bp_systolic'),
            vitals_bp_diastolic=data.get('vitals_bp_diastolic'),
            vitals_rr=data.get('vitals_rr'),
            vitals_spo2=data.get('vitals_spo2'),
            vitals_temperature=data.get('vitals_temperature'),
            vitals_grbs=data.get('vitals_grbs'),
            # Notes
            visit_summary=data.get('visit_summary'),
            advice_pharmacological=data.get('advice_pharmacological'),
            advice_non_pharmacological=data.get('advice_non_pharmacological'),
            follow_up_advice=data.get('follow_up_advice'),
            # Status — new follow-ups start as 'scheduled', initial visits as 'completed'
            status=data.get('status', 'scheduled' if data.get('visit_type', 'follow_up') != 'initial' else 'completed'),
            next_visit_recommended=data.get('next_visit_recommended'),
            next_visit_priority=data.get('next_visit_priority'),
            created_by=created_by,
        )

        db.session.add(visit)
        db.session.commit()

        return visit.to_dict()

    @staticmethod
    def get_visit(visit_id: UUID) -> Optional[dict]:
        """Get a single visit by ID."""
        visit = PatientVisit.query.get(visit_id)
        if not visit:
            return None
        return visit.to_dict()

    @staticmethod
    def get_initial_visit(patient_id: UUID) -> Optional[dict]:
        """Get the initial (baseline) visit for a patient (visit_number=0, visit_type='initial')."""
        visit = PatientVisit.query.filter_by(
            patient_id=patient_id,
            visit_type='initial',
        ).first()
        if not visit:
            return None
        return visit.to_dict()

    @staticmethod
    def get_patient_visits(patient_id: UUID, include_initial: bool = False) -> List[dict]:
        """Get all follow-up visits for a patient, ordered by visit_number desc."""
        query = PatientVisit.query.filter_by(patient_id=patient_id)
        if not include_initial:
            query = query.filter(PatientVisit.visit_type != 'initial')
        visits = query.order_by(PatientVisit.visit_number.desc()).all()
        return [v.to_dict() for v in visits]

    @staticmethod
    def update_visit(visit_id: UUID, data: dict) -> Optional[dict]:
        """Update a visit."""
        visit = PatientVisit.query.get(visit_id)
        if not visit:
            return None

        updatable_fields = [
            'visit_type', 'visit_date', 'visit_location', 'team_members', 'vehicle_id',
            'doctor_consultation', 'nursing_consultation', 'counsellor_consultation',
            'physiotherapy_consultation', 'social_worker_consultation',
            'vitals_pr', 'vitals_bp_systolic', 'vitals_bp_diastolic', 'vitals_rr',
            'vitals_spo2', 'vitals_temperature', 'vitals_grbs',
            'visit_summary', 'advice_pharmacological', 'advice_non_pharmacological',
            'follow_up_advice', 'status', 'next_visit_recommended', 'next_visit_priority',
        ]

        for field in updatable_fields:
            if field in data:
                setattr(visit, field, data[field])

        if 'consultation_types' in data and isinstance(data['consultation_types'], list):
            c_list = [c.lower() for c in data['consultation_types'] if isinstance(c, str)]
            visit.doctor_consultation = any('doc' in c or 'physician' in c for c in c_list)
            visit.nursing_consultation = any('nurse' in c for c in c_list)
            visit.counsellor_consultation = any('counsel' in c for c in c_list)
            visit.physiotherapy_consultation = any('physio' in c for c in c_list)
            visit.social_worker_consultation = any('social' in c or 'msw' in c for c in c_list)

        # Auto-complete: if clinical data is being saved and status is still 'scheduled',
        # transition to 'in_progress' or 'completed'
        clinical_fields = ['vitals_pr', 'vitals_bp_systolic', 'visit_summary',
                          'advice_pharmacological', 'advice_non_pharmacological']
        has_clinical_data = any(data.get(f) for f in clinical_fields)
        if has_clinical_data and visit.status == 'scheduled':
            visit.status = 'completed'

        visit.updated_at = datetime.utcnow()

        # Initial Assessment complete → assign UHID if the patient doesn't
        # have one yet. Idempotent (NULL check) + row lock to serialize
        # concurrent completions from multiple team members.
        assigned_uhid = None
        if (
            visit.visit_type == 'initial'
            and visit.status == 'completed'
            and visit.patient
            and not visit.patient.uhid
            and visit.patient.is_bangalore_resident
            and visit.patient.geographic_cluster
        ):
            from app.patients.uhid_service import generate_uhid
            db.session.execute(
                text('SELECT id FROM patients WHERE id = :pid FOR UPDATE'),
                {'pid': str(visit.patient_id)},
            )
            db.session.refresh(visit.patient)
            if not visit.patient.uhid:
                assigned_uhid = generate_uhid(visit.patient.geographic_cluster)
                visit.patient.uhid = assigned_uhid

        db.session.commit()

        result = visit.to_dict()
        if assigned_uhid:
            result['assigned_uhid'] = assigned_uhid
        return result
