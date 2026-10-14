"""
Submission Processor - Main orchestrator for hybrid processing pipeline.

This is your innovation: accepts raw form submissions and intelligently
distributes data to relational tables while maintaining backward compatibility.
"""

from app.processing.clinical_extractor import ClinicalExtractor
from app.processing.transformers import RelationalTransformer
from app.submissions.models import FormSubmission
from app.patients.models import Patient
from app.encounters.models import Encounter
from app.audit.models import AuditLog
from app.extensions import db
from datetime import datetime, timedelta


class ProcessingResult:
    """Container for processing results."""

    def __init__(self, submission, patient=None, encounter=None, observations=None, diagnoses=None, form_answers=None):
        self.submission = submission
        self.patient = patient
        self.encounter = encounter
        self.observations = observations or []
        self.diagnoses = diagnoses or []
        self.form_answers = form_answers or []


class SubmissionProcessor:
    """
    Main processing pipeline for form submissions.

    Flow:
    Raw submission → Extract clinical data → Transform to relational
    → Distribute to tables → Log audit trail

    This enables the hybrid approach: accept JSONB, store relationally.
    """

    def __init__(self):
        self.clinical_extractor = ClinicalExtractor()
        self.transformer = RelationalTransformer()

    def process_submission(self, form, raw_data, user, context=None, request_info=None):
        """
        Process a form submission through the pipeline.

        Args:
            form: Form object with schema
            raw_data: dict {field_id: value} from frontend
            user: Current user submitting
            context: Optional dict with patient_id, encounter_id
            request_info: Optional dict with ip_address, user_agent

        Returns:
            ProcessingResult with all created entities
        """
        context = context or {}
        request_info = request_info or {}

        # Step 1: Extract clinical semantics from form
        clinical_data = self.clinical_extractor.extract(
            form_schema=form.schema,
            raw_data=raw_data
        )

        # Step 2: Get or create patient
        patient = self._get_or_create_patient(
            clinical_data.get('demographics', {}),
            context.get('patient_id'),
            user.id
        )

        # Step 3: Get or create encounter
        encounter = self._get_or_create_encounter(
            patient=patient,
            form=form,
            user=user,
            context=context
        )

        # Step 4: Create form_submission header
        submission = FormSubmission(
            form_id=form.id,
            form_version=form.version,
            patient_id=patient.id if patient else None,
            encounter_id=encounter.id if encounter else None,
            submitted_by=user.id,
            submission_status='submitted',
            submitted_at=datetime.utcnow(),
            ip_address=request_info.get('ip_address'),
            user_agent=request_info.get('user_agent'),
            data_backup=raw_data  # Keep JSONB backup for safety
        )
        db.session.add(submission)
        db.session.flush()  # Get submission.id

        # Step 5: Transform raw data to relational
        relational_data = self.transformer.transform(
            form_schema=form.schema,
            raw_data=raw_data,
            submission_id=submission.id,
            patient_id=patient.id if patient else None,
            encounter_id=encounter.id if encounter else None
        )

        # Step 6: Save all relational data
        form_answers = relational_data.get('form_answers', [])
        observations = relational_data.get('observations', [])
        diagnoses = relational_data.get('diagnoses', [])

        # Add all to session
        for answer in form_answers:
            db.session.add(answer)

        for observation in observations:
            observation.recorded_by = user.id
            db.session.add(observation)

        for diagnosis in diagnoses:
            diagnosis.diagnosed_by = user.id
            db.session.add(diagnosis)

        # Step 7: Audit logging
        AuditLog.log_submission(
            user_id=user.id,
            patient_id=patient.id if patient else None,
            submission_id=submission.id,
            form_id=form.id,
            action='create_submission',
            http_method='POST',
            endpoint='/api/submissions',
            ip_address=request_info.get('ip_address'),
            user_agent=request_info.get('user_agent'),
            success=True,
            new_values={
                'form_answers_count': len(form_answers),
                'observations_count': len(observations),
                'diagnoses_count': len(diagnoses),
                'data_categories': list(clinical_data.keys())
            }
        )

        # Step 8: Commit transaction
        db.session.commit()

        return ProcessingResult(
            submission=submission,
            patient=patient,
            encounter=encounter,
            observations=observations,
            diagnoses=diagnoses,
            form_answers=form_answers
        )

    def _get_or_create_patient(self, demographics, provided_patient_id, created_by):
        """
        Get existing patient or create new one from demographics.

        Args:
            demographics: dict - Extracted demographic data
            provided_patient_id: UUID - Patient ID from context (if provided)
            created_by: UUID - User creating patient

        Returns:
            Patient object or None
        """
        # If patient_id provided, use it
        if provided_patient_id:
            patient = Patient.query.get(provided_patient_id)
            if patient:
                return patient

        # If no demographics, can't create patient
        if not demographics:
            return None

        # Extract patient data
        name = None
        dob = None
        gender = None
        abha_address = None
        contact = None
        address = None

        for field_id, demo_data in demographics.items():
            category = demo_data.get('category')
            value = demo_data.get('value')

            if category == 'name' and not name:
                name = value
            elif category == 'date_of_birth' and not dob:
                dob = value
            elif category == 'gender' and not gender:
                gender = value
            elif category == 'abha_id' and not abha_address:
                # Could be ABHA ID or ABHA address
                if '@' in str(value):
                    abha_address = value
            elif category == 'contact' and not contact:
                contact = value
            elif category == 'address' and not address:
                address = value

        # Need at least a name to create patient
        if not name:
            return None

        # Check if patient already exists by ABHA address
        if abha_address:
            existing = Patient.query.filter_by(abha_address=abha_address).first()
            if existing:
                return existing

        # Create new patient.
        # NOTE: UHID is intentionally left NULL here. Form-submission auto-create
        # has no Bangalore zone information available, so a UHID cannot be derived.
        # Patients created via this path can be enriched with a zone later via the
        # patient edit flow + admin Regenerate-UHID action.
        patient = Patient(
            full_name=name,
            date_of_birth=dob,
            gender=gender,
            abha_address=abha_address,
            created_by=created_by,
            is_active=True
        )

        if contact:
            patient.set_contact(contact)

        if address:
            patient.set_address(address)

        db.session.add(patient)
        db.session.flush()  # Get patient.id

        return patient

    def _get_or_create_encounter(self, patient, form, user, context):
        """
        Get existing encounter or create new one.

        Args:
            patient: Patient object
            form: Form object
            user: User object
            context: dict - May contain encounter_id

        Returns:
            Encounter object or None
        """
        if not patient:
            return None

        # If encounter_id provided, use it
        if context.get('encounter_id'):
            encounter = Encounter.query.get(context['encounter_id'])
            if encounter and encounter.patient_id == patient.id:
                return encounter

        # Check for an active encounter for this patient today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active_encounter = Encounter.query.filter(
            Encounter.patient_id == patient.id,
            Encounter.status.in_(['in-progress', 'scheduled']),
            Encounter.start_time >= today_start
        ).first()

        if active_encounter:
            return active_encounter

        # Create new encounter
        encounter = Encounter(
            patient_id=patient.id,
            encounter_type=context.get('encounter_type', 'OPD'),
            start_time=datetime.utcnow(),
            status='in-progress',
            chief_complaint=context.get('chief_complaint'),
            created_by=user.id
        )

        db.session.add(encounter)
        db.session.flush()  # Get encounter.id

        return encounter
