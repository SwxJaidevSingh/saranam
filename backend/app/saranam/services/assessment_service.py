"""Assessment Service — generic CRUD for all assessment types."""
from datetime import datetime
from uuid import UUID
from typing import Optional

from app.extensions import db
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.psychological_assessment import PsychologicalAssessment
from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.pps_score import PpsScore
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.procedures_record import ProceduresRecord
from app.saranam.models.social_history_assessment import SocialHistoryAssessment
from app.saranam.models.bereavement_assessment import BereavementAssessment

# Map assessment type names to model classes
ASSESSMENT_MODELS = {
    'nursing': NursingAssessment,
    'doctor': DoctorAssessment,
    'psychological': PsychologicalAssessment,
    'physiotherapy': PhysiotherapyAssessment,
    'esas': EsasScore,
    'pps': PpsScore,
    'care-plan': PlanOfCare,
    'procedures': ProceduresRecord,
    'social-history': SocialHistoryAssessment,
    'bereavement': BereavementAssessment,
}

# Fields that should not be set directly from request data
PROTECTED_FIELDS = {'id', 'created_at', 'updated_at', 'patient_id', 'visit_id'}


class AssessmentService:
    """Generic CRUD service for all assessment types."""

    @staticmethod
    def get_assessment(visit_id: UUID, assessment_type: str) -> Optional[dict]:
        """Get an assessment by visit_id and type."""
        model = ASSESSMENT_MODELS.get(assessment_type)
        if not model:
            raise ValueError(f'Unknown assessment type: {assessment_type}')

        record = model.query.filter_by(visit_id=visit_id).first()
        if not record:
            return None
        return record.to_dict()

    @staticmethod
    def save_assessment(visit_id: UUID, assessment_type: str, data: dict, user_id: UUID) -> dict:
        """Create or update an assessment for a visit (upsert)."""
        model = ASSESSMENT_MODELS.get(assessment_type)
        if not model:
            raise ValueError(f'Unknown assessment type: {assessment_type}')

        visit = PatientVisit.query.get(visit_id)
        if not visit:
            raise ValueError('Visit not found')

        # Clean data: convert empty strings to None for numeric/boolean columns
        import sqlalchemy
        cleaned_data = {}
        for key, value in data.items():
            if key in PROTECTED_FIELDS or not hasattr(model, key):
                continue
            # Get column type to determine if we need to convert empty strings
            col = getattr(model, key, None)
            if col is not None and hasattr(col, 'property') and hasattr(col.property, 'columns'):
                col_type = col.property.columns[0].type
                if isinstance(col_type, (sqlalchemy.Integer, sqlalchemy.Numeric, sqlalchemy.Boolean)):
                    if value == '' or value is None:
                        value = None
                    elif isinstance(value, str):
                        try:
                            if isinstance(col_type, sqlalchemy.Integer):
                                value = int(value)
                            elif isinstance(col_type, sqlalchemy.Numeric):
                                value = float(value)
                        except (ValueError, TypeError):
                            value = None
            cleaned_data[key] = value

        # Check if assessment already exists for this visit
        record = model.query.filter_by(visit_id=visit_id).first()

        if record:
            # Update existing
            for key, value in cleaned_data.items():
                setattr(record, key, value)
            record.updated_at = datetime.utcnow()
        else:
            # Create new
            filtered_data = cleaned_data
            record = model(
                patient_id=visit.patient_id,
                visit_id=visit_id,
                **filtered_data,
            )
            # Set user fields
            if hasattr(record, 'assessed_by'):
                record.assessed_by = user_id
            if hasattr(record, 'recorded_by'):
                record.recorded_by = user_id
            if hasattr(record, 'created_by'):
                record.created_by = user_id

            db.session.add(record)

        db.session.commit()

        # Priority sync — when a PPS score is saved, update the patient's
        # cached latest_pps_score + derived clinical_complexity. (Meeting §2.1, 2026-04-14)
        if assessment_type == 'pps':
            try:
                from app.patients.priority_service import sync_patient_priority_from_pps
                sync_patient_priority_from_pps(visit.patient_id)
            except Exception:
                # Priority sync must not block the PPS save.
                pass

        return record.to_dict()

    @staticmethod
    def get_all_assessments_for_visit(visit_id: UUID) -> dict:
        """Get all assessment statuses for a visit (used for status chips)."""
        statuses = {}
        for name, model in ASSESSMENT_MODELS.items():
            record = model.query.filter_by(visit_id=visit_id).first()
            statuses[name] = {
                'exists': record is not None,
                'data': record.to_dict() if record else None,
            }
        return statuses

    @staticmethod
    def get_patient_scores(patient_id: UUID, score_type: str):
        """Get time-series scores for trending (ESAS-R, PPS, or Vitals)."""
        if score_type == 'esas':
            records = EsasScore.query.filter_by(patient_id=patient_id).order_by(EsasScore.recorded_at.asc()).all()
        elif score_type == 'pps':
            records = PpsScore.query.filter_by(patient_id=patient_id).order_by(PpsScore.recorded_at.asc()).all()
        elif score_type == 'vitals':
            from app.saranam.services.vitals_service import VitalsService
            return VitalsService.get_patient_vitals_trend(patient_id)
        else:
            raise ValueError(f'Unknown score type: {score_type}')

        return [r.to_dict() for r in records]
