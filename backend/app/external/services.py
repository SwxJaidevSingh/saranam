"""External submission service for processing data from external systems."""
from app.patients.models import Patient
from app.submissions.models import FormSubmission
from app.forms.models import Form
from app.processing.submission_processor import SubmissionProcessor
from app.extensions import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ExternalSubmissionService:
    """Service for handling external submissions from systems like Health Screening."""

    def __init__(self):
        self.processor = SubmissionProcessor()

    def _build_summary(self, result):
        """Build processing summary from result object."""
        summary = {}
        if result.patient:
            summary['patient_name'] = result.patient.full_name
        if result.encounter:
            summary['encounter_type'] = getattr(result.encounter, 'encounter_type', 'OPD')
        if result.observations:
            summary['vitals_recorded'] = [
                {
                    'type': obs.observation_type,
                    'value': f"{obs.value_numeric} {obs.unit}" if obs.value_numeric else obs.value_text,
                    'loinc_code': obs.loinc_code
                }
                for obs in result.observations[:5]  # Limit to first 5
            ]
        return summary

    def process_external_submission(self, form_id, submission_data, user, external_context=None):
        """
        Process a submission from an external system.

        Args:
            form_id: CV Raman form ID (UUID)
            submission_data: dict with field_id: value pairs
            user: Service account user
            external_context: dict with external system metadata
                {
                    'source_system': 'health_screening',
                    'external_submission_id': '1203',
                    'external_patient_id': '501',
                    'external_form_id': '10',
                    'metadata': {
                        'camp_id': 5,
                        'camp_name': 'Rural Health Camp',
                        'latitude': 25.5941,
                        'longitude': 85.1376
                    }
                }

        Returns:
            dict with submission details and processing summary
        """
        try:
            print(f"\n=== EXTERNAL SUBMISSION DEBUG ===", flush=True)
            print(f"Form ID: {form_id}", flush=True)
            print(f"Source: {external_context.get('source_system') if external_context else 'unknown'}", flush=True)
            print(f"Submission data keys: {list(submission_data.keys())}", flush=True)
            print(f"Submission data: {submission_data}", flush=True)
            if external_context:
                print(f"External patient ID: {external_context.get('external_patient_id')}", flush=True)
                print(f"External metadata: {external_context.get('metadata')}", flush=True)
            print("=================================\n", flush=True)

            # Get form
            form = Form.query.get(form_id)
            if not form:
                return {
                    'success': False,
                    'error': 'Form not found',
                    'form_id': str(form_id)
                }, 404

            if not form.is_active:
                return {
                    'success': False,
                    'error': 'Form is not active',
                    'form_id': str(form_id)
                }, 400

            # Check for duplicate submission
            if external_context:
                source_system = external_context.get('source_system', 'unknown')
                external_submission_id = external_context.get('external_submission_id')

                if external_submission_id:
                    existing = FormSubmission.find_by_external_id(
                        source_system,
                        external_submission_id
                    )
                    if existing:
                        return {
                            'success': True,
                            'duplicate': True,
                            'message': 'Submission already exists (idempotent)',
                            'submission_id': str(existing.id),
                            'cv_raman_id': str(existing.id),
                            'external_submission_id': external_submission_id
                        }, 200

            # Handle patient lookup/creation with external ID
            patient = None
            patient_created = False
            if external_context and external_context.get('external_patient_id'):
                source_system = external_context.get('source_system', 'unknown')
                external_patient_id = external_context.get('external_patient_id')

                # Try to find existing patient by external ID
                patient = Patient.find_by_external_id(source_system, external_patient_id)

                # For health_screening, create patient if not found with full data
                # DISABLED: health_screening patient auto-creation turned off for production
                if False and not patient and source_system == 'health_screening':
                    print(f"No existing patient found, creating new from health_screening", flush=True)
                    metadata = external_context.get('metadata', {})

                    # Extract patient data from submission
                    patient_name = submission_data.get('patient_name')
                    print(f"Patient name from submission: {patient_name}", flush=True)
                    if patient_name:
                        print(f"Creating new patient: {patient_name}", flush=True)
                        patient = Patient(
                            full_name=patient_name,
                            gender=submission_data.get('gender'),
                            source_system=source_system,
                            external_id=external_patient_id,
                            external_metadata=metadata,
                            created_by=user.id,
                            is_active=True
                        )

                        # Set date of birth if provided
                        if submission_data.get('date_of_birth'):
                            try:
                                from datetime import datetime
                                dob_str = submission_data.get('date_of_birth')
                                patient.date_of_birth = datetime.fromisoformat(dob_str).date()
                                logger.info(f"Set patient DOB: {patient.date_of_birth}")
                            except Exception as e:
                                logger.warning(f"Could not parse DOB: {e}")

                        # Set contact from submission data or metadata
                        contact = submission_data.get('patient_contact') or submission_data.get('phone_number') or metadata.get('phone_no')
                        print(f"Contact to set: {contact}", flush=True)
                        if contact:
                            patient.set_contact(str(contact))
                            print(f"Called set_contact with: {contact}", flush=True)
                            print(f"Contact encrypted field after set: {patient.contact_encrypted is not None}", flush=True)

                        # Set address from submission data or metadata
                        address = submission_data.get('patient_address')
                        if not address and metadata:
                            address_parts = []
                            if metadata.get('address'):
                                address_parts.append(metadata.get('address'))
                            if metadata.get('village'):
                                address_parts.append(metadata.get('village'))
                            if metadata.get('district'):
                                address_parts.append(metadata.get('district'))
                            if address_parts:
                                address = ', '.join(address_parts)

                        print(f"Address to set: {address}", flush=True)
                        if address:
                            patient.set_address(address)
                            print(f"Called set_address with: {address}", flush=True)
                            print(f"Address encrypted field after set: {patient.address_encrypted is not None}", flush=True)

                        # NOTE: UHID is intentionally left NULL for external imports.
                        # The health_screening source system does not carry Bangalore zone
                        # info, so geographic_cluster cannot be determined here. Patients
                        # imported this way can be enriched later via the patient edit
                        # flow + admin Regenerate-UHID action once a zone is assigned.
                        db.session.add(patient)
                        db.session.flush()  # Get the patient ID
                        patient_created = True
                        print(f"Patient created with ID: {patient.id}", flush=True)
                        print(f"Patient has contact: {patient.contact_encrypted is not None}", flush=True)
                        print(f"Patient has address: {patient.address_encrypted is not None}", flush=True)
                        print(f"Patient external_id: {patient.external_id}", flush=True)
                        print(f"Patient source_system: {patient.source_system}", flush=True)

                        # Commit the patient immediately to ensure fields are saved
                        # before submission processor runs
                        db.session.commit()
                        print(f"Patient committed to database", flush=True)

            # Build context for submission processor
            context = {
                'patient_id': str(patient.id) if patient else None,
                'encounter_id': None,  # Will be created by processor if needed
                'skip_patient_creation': patient_created  # Don't recreate if we just made it
            }

            # Process submission using existing pipeline
            result = self.processor.process_submission(
                form=form,
                raw_data=submission_data,
                user=user,
                context=context,
                request_info=None
            )

            # Update submission with external tracking info
            if external_context and result.submission:
                submission = result.submission
                source_system = external_context.get('source_system', 'unknown')
                external_submission_id = external_context.get('external_submission_id')
                metadata = external_context.get('metadata', {})

                submission.source_system = source_system
                submission.external_submission_id = external_submission_id
                submission.external_metadata = metadata

                # Update patient with external tracking and data
                if result.patient:
                    patient_obj = result.patient
                    external_patient_id = external_context.get('external_patient_id')

                    # Always update external tracking for health_screening patients
                    if source_system == 'health_screening' and external_patient_id:
                        logger.info(f"Updating patient from health_screening metadata: {metadata}")
                        patient_obj.source_system = source_system
                        patient_obj.external_id = external_patient_id
                        patient_obj.external_metadata = metadata

                        # Extract and set patient fields from metadata
                        if metadata:
                            # Set phone/contact if available
                            if metadata.get('phone_no') and not patient_obj.contact_encrypted:
                                logger.info(f"Setting patient phone: {metadata.get('phone_no')}")
                                patient_obj.set_contact(str(metadata.get('phone_no')))

                            # Set address if available
                            if not patient_obj.address_encrypted:
                                address_parts = []
                                if metadata.get('address'):
                                    address_parts.append(metadata.get('address'))
                                if metadata.get('village'):
                                    address_parts.append(metadata.get('village'))
                                if metadata.get('district'):
                                    address_parts.append(metadata.get('district'))

                                if address_parts:
                                    full_address = ', '.join(address_parts)
                                    logger.info(f"Setting patient address: {full_address}")
                                    patient_obj.set_address(full_address)

                db.session.commit()

            # Use the patient we created or the one from processor
            final_patient = patient if patient_created else result.patient

            return {
                'success': True,
                'message': 'Submission processed successfully',
                'submission_id': str(result.submission.id),
                'cv_raman_id': str(result.submission.id),
                'external_submission_id': external_context.get('external_submission_id') if external_context else None,
                'patient_id': str(final_patient.id) if final_patient else None,
                'patient_created': patient_created or getattr(result, 'patient_created', False),
                'encounter_id': str(result.encounter.id) if result.encounter else None,
                'encounter_created': getattr(result, 'encounter_created', False),
                'observations_created': len(result.observations) if result.observations else 0,
                'processing_summary': self._build_summary(result)
            }, 201

        except Exception as e:
            logger.error(f"Error processing external submission: {str(e)}", exc_info=True)
            db.session.rollback()
            return {
                'success': False,
                'error': 'Internal server error',
                'message': str(e)
            }, 500

    def bulk_process_submissions(self, submissions, user):
        """
        Process multiple submissions in batch.

        Args:
            submissions: list of dicts, each containing form_id, data, and external_context
            user: Service account user

        Returns:
            dict with batch results
        """
        results = {
            'total': len(submissions),
            'success': 0,
            'failed': 0,
            'duplicates': 0,
            'errors': [],
            'submissions': []
        }

        for idx, submission_data in enumerate(submissions):
            try:
                form_id = submission_data.get('form_id')
                data = submission_data.get('data', {})
                external_context = submission_data.get('external_context', {})

                result, status_code = self.process_external_submission(
                    form_id=form_id,
                    submission_data=data,
                    user=user,
                    external_context=external_context
                )

                if result.get('success'):
                    if result.get('duplicate'):
                        results['duplicates'] += 1
                    else:
                        results['success'] += 1
                    results['submissions'].append({
                        'index': idx,
                        'status': 'success',
                        'submission_id': result.get('submission_id'),
                        'external_submission_id': result.get('external_submission_id')
                    })
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'index': idx,
                        'error': result.get('error'),
                        'message': result.get('message')
                    })

            except Exception as e:
                logger.error(f"Error in batch submission {idx}: {str(e)}")
                results['failed'] += 1
                results['errors'].append({
                    'index': idx,
                    'error': 'Processing error',
                    'message': str(e)
                })

        return results
