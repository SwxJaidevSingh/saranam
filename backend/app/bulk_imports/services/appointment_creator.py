"""
Appointment Creator Service
Creates actual appointments from validated bulk import items
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from uuid import UUID

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.encounters.models import Encounter
from app.bulk_imports.models.bulk_import_session import BulkImportSession
from app.bulk_imports.models.bulk_import_item import BulkImportItem
from app.bulk_imports.services.pure_logic_validators import DateTimeParser
from app.patients.services import PatientService
from app.patients.schemas import PatientCreateSchema

logger = logging.getLogger(__name__)


class AppointmentCreator:
    """Creates appointments from bulk import items"""

    @staticmethod
    def create_appointments_from_session(session_id: UUID, user_id: UUID) -> Dict:
        """
        Create all valid, non-conflicting appointments from a session

        Args:
            session_id: Import session ID
            user_id: User performing the creation

        Returns:
            Dict with creation statistics
        """
        session = BulkImportSession.query.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = 'creating'
            db.session.commit()

            created_count = 0
            failed_count = 0
            skipped_count = 0
            patients_created = 0

            # Get all valid items (auto-approved + resolved conflicts)
            items_to_process = BulkImportItem.query.filter(
                BulkImportItem.session_id == session.id,
                BulkImportItem.is_valid == True,
                BulkImportItem.status.in_(['valid', 'resolved'])
            ).all()

            # Also include items with conflicts that were resolved
            conflicted_resolved = BulkImportItem.query.filter(
                BulkImportItem.session_id == session.id,
                BulkImportItem.has_conflict == True,
                BulkImportItem.resolution_action.isnot(None),
                BulkImportItem.resolution_action != 'skip'
            ).all()

            items_to_process.extend(conflicted_resolved)

            logger.info(f"Processing {len(items_to_process)} items for appointment creation")

            for item in items_to_process:
                try:
                    # Skip if already created or explicitly skipped
                    if item.created_appointment_id or item.resolution_action == 'skip':
                        skipped_count += 1
                        continue

                    # Debug logging
                    logger.info(f"Processing item {item.row_number}: patient_id={item.patient_id}, patient_created={item.patient_created}, has_patient_data={bool(item.created_patient_data)}")

                    # Create patient if needed
                    if item.patient_created and item.created_patient_data:
                        patient = AppointmentCreator._create_patient(
                            item.created_patient_data, user_id
                        )
                        # PatientService returns a dict, extract the ID
                        item.patient_id = UUID(patient['id'])
                        patients_created += 1
                    elif not item.patient_id:
                        # Neither matched nor created - this shouldn't happen
                        raise ValueError(f"Row {item.row_number}: No patient_id and patient_created={item.patient_created}, has_data={bool(item.created_patient_data)}")

                    # Build appointment data
                    appointment_data = AppointmentCreator._build_appointment_data(item)

                    # Create encounter (appointment)
                    encounter = AppointmentCreator._create_encounter(
                        appointment_data, user_id
                    )

                    # Update item
                    item.created_appointment_id = encounter.id
                    item.status = 'created'
                    item.processed_at = datetime.utcnow()
                    created_count += 1

                    logger.info(f"Created appointment {encounter.id} for row {item.row_number}")

                except Exception as e:
                    logger.error(f"Failed to create appointment for item {item.id}: {str(e)}")
                    item.status = 'failed'
                    item.error_message = str(e)
                    item.error_details = {'error': str(e)}
                    failed_count += 1

            # Update session statistics
            session.created_count = created_count
            session.failed_count = failed_count
            session.skipped_count = skipped_count
            session.patients_created = patients_created
            session.status = 'completed'
            session.completed_at = datetime.utcnow()

            db.session.commit()

            logger.info(f"Bulk import complete: {created_count} created, {failed_count} failed, {skipped_count} skipped")

            return {
                'created': created_count,
                'failed': failed_count,
                'skipped': skipped_count,
                'patients_created': patients_created
            }

        except Exception as e:
            logger.error(f"Error creating appointments: {str(e)}")
            session.status = 'failed'
            session.error_message = str(e)
            db.session.commit()
            raise

    @staticmethod
    def _create_patient(patient_data: Dict, user_id: UUID) -> Patient:
        """Create new patient from import data"""
        try:
            # Build patient schema
            schema_data = {
                'full_name': patient_data.get('full_name'),
                'phone_number': patient_data.get('phone_number'),
                'email': patient_data.get('email'),
                'country': 'India'
            }

            # Add date of birth if available
            if patient_data.get('date_of_birth'):
                dob_str = patient_data.get('date_of_birth')
                if isinstance(dob_str, str):
                    dob = DateTimeParser.parse_date(dob_str)
                    if dob:
                        schema_data['date_of_birth'] = dob.isoformat()

            # Remove None values
            schema_data = {k: v for k, v in schema_data.items() if v is not None}

            # Create patient
            patient_schema = PatientCreateSchema(**schema_data)
            patient = PatientService.create_patient(patient_schema, user_id)

            return patient

        except Exception as e:
            logger.error(f"Error creating patient: {str(e)}")
            raise

    @staticmethod
    def _build_appointment_data(item: BulkImportItem) -> Dict:
        """Build appointment data from import item"""
        data = item.extracted_data.copy()

        # Handle conflict resolution
        if item.resolution_action and item.resolution_data:
            if item.resolution_action == 'accept_suggestion':
                # Get selected suggestion
                suggestion_idx = item.resolution_data.get('suggestion_index', 0)
                suggestions = item.suggested_alternatives or []

                if suggestion_idx < len(suggestions):
                    suggestion = suggestions[suggestion_idx]
                    data['appointment_date'] = suggestion['date']
                    data['appointment_time'] = suggestion['time']

                    # Update provider if alternative provider was suggested
                    if suggestion.get('provider_id'):
                        item.provider_id = UUID(suggestion['provider_id'])

            elif item.resolution_action == 'manual_time':
                # Use custom date/time
                if item.resolution_data.get('custom_date'):
                    data['appointment_date'] = item.resolution_data['custom_date']
                if item.resolution_data.get('custom_time'):
                    data['appointment_time'] = item.resolution_data['custom_time']

        # Parse date and time
        appointment_date = DateTimeParser.parse_date(data.get('appointment_date'))
        appointment_time = DateTimeParser.parse_time(data.get('appointment_time'))

        if not appointment_date or not appointment_time:
            raise ValueError("Invalid date or time format")

        start_datetime = datetime.combine(appointment_date, appointment_time)

        # Get duration
        duration = data.get('duration_minutes')
        if duration:
            try:
                duration = int(duration)
            except:
                duration = 30
        else:
            # Use provider's default
            provider = db.session.query(HealthcareProvider).get(item.provider_id)
            duration = provider.default_consultation_duration if provider else 30

        return {
            'patient_id': item.patient_id,
            'provider_id': item.provider_id,
            'start_time': start_datetime,
            'end_time': start_datetime + timedelta(minutes=duration),
            'appointment_type': data.get('appointment_type', 'consultation'),
            'chief_complaint': data.get('chief_complaint'),
            'notes': data.get('notes'),
            'status': 'scheduled',
            'booking_source': 'bulk_import'
        }

    @staticmethod
    def _create_encounter(appointment_data: Dict, user_id: UUID) -> Encounter:
        """Create encounter (appointment) in database"""
        try:
            encounter = Encounter(
                patient_id=appointment_data['patient_id'],
                provider_id=appointment_data['provider_id'],
                start_time=appointment_data['start_time'],
                end_time=appointment_data['end_time'],
                encounter_type='OPD',  # Default to OPD
                status=appointment_data['status'],
                chief_complaint=appointment_data.get('chief_complaint'),
                created_by=user_id
            )

            db.session.add(encounter)
            db.session.flush()  # Get the ID without committing

            return encounter

        except Exception as e:
            logger.error(f"Error creating encounter: {str(e)}")
            raise
