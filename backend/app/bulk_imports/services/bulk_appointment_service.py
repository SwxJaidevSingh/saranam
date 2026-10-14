"""
Bulk Appointment Service
Core service for bulk appointment creation with AI-powered extraction
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from uuid import UUID
import json
from rapidfuzz import fuzz, process

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.services.models import Service
from app.encounters.models import Encounter
from app.common.models import User
from app.bulk_imports.models import BulkImportSession, BulkImportItem
from app.bulk_imports.services.llm_service import LLMService
from app.bulk_imports.services.file_parser_service import FileParserService
from app.appointments.services import AppointmentService
from app.bulk_imports.services.bulk_service_appointment_extension import ServiceBookingExtension


logger = logging.getLogger(__name__)


class BulkAppointmentService:
    """
    Service for bulk appointment creation
    """

    def __init__(self, user_id: UUID, llm_provider: str = 'openai', llm_api_key: Optional[str] = None, llm_model: Optional[str] = None):
        """
        Initialize service

        Args:
            user_id: ID of user performing the import
            llm_provider: LLM provider to use
            llm_api_key: Optional API key
            llm_model: Optional model name
        """
        self.user_id = user_id
        self.user = User.query.get(user_id)
        if not self.user:
            raise ValueError(f"User {user_id} not found")

        self.llm_service = LLMService(provider=llm_provider, api_key=llm_api_key, model_name=llm_model)
        self.file_parser = FileParserService()
        self.appointment_service = AppointmentService()

    def process_file_upload(
        self,
        file_path: str,
        filename: str,
        file_type: str,
        import_metadata: Optional[Dict] = None
    ) -> BulkImportSession:
        """
        Process uploaded file and create import session

        Args:
            file_path: Path to uploaded file
            filename: Original filename
            file_type: File type (xlsx, csv, pdf)
            import_metadata: Additional metadata (like LLM keys/models)

        Returns:
            BulkImportSession object
        """
        try:
            # Validate file
            file_info = self.file_parser.get_file_info(file_path)
            self.file_parser.validate_file_size(file_path)

            # Create session
            session = BulkImportSession(
                filename=filename,
                file_type=file_type,
                file_size=file_info['size_bytes'],
                file_path=file_path,
                llm_provider=self.llm_service.provider,
                created_by=self.user_id,
                uploaded_by_name=self.user.full_name,
                status='uploaded',
                import_metadata=import_metadata
            )
            db.session.add(session)
            db.session.commit()

            logger.info(f"Created import session {session.id} for file {filename}")
            return session

        except Exception as e:
            logger.error(f"Error processing file upload: {str(e)}")
            raise

    def extract_appointments(self, session_id: UUID) -> BulkImportSession:
        """
        Extract appointment data from uploaded file using LLM

        Args:
            session_id: Import session ID

        Returns:
            Updated session with extracted data
        """
        session = BulkImportSession.query.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = 'extracting'
            db.session.commit()

            # Parse file
            rows, file_metadata = self.file_parser.parse_file(session.file_path, session.file_type)
            session.total_rows = len(rows)

            # Check if file requires LLM processing
            if file_metadata.get('requires_llm') or session.file_type == 'pdf':
                # Unstructured data - use LLM
                text_data = rows[0].get('raw_text', '') if rows else ''
                if not text_data:
                    # Convert rows to text
                    text_data = json.dumps(rows, indent=2)

                appointments, llm_metadata = self.llm_service.extract_appointments_from_text(
                    text_data,
                    context=file_metadata
                )

                session.llm_tokens_used = llm_metadata.get('tokens_used', 0)
                session.llm_api_calls = 1
                session.extraction_method = 'llm'

            else:
                # Structured data - map columns + LLM enhancement
                appointments = self._extract_from_structured_data(rows, file_metadata)
                session.extraction_method = 'structured'

            # Create import items
            session.extracted_count = len(appointments)
            for row_num, appt_data in enumerate(appointments, 1):
                item = BulkImportItem(
                    session_id=session.id,
                    row_number=row_num,
                    original_data=appt_data,
                    extracted_data=appt_data,
                    status='extracted'
                )
                db.session.add(item)
                session.import_items.append(item)

            session.raw_extraction = appointments
            session.status = 'extracted'
            session.completed_at = datetime.utcnow()

            # Update LLM cost
            usage_stats = self.llm_service.get_usage_stats()
            session.llm_cost_estimate = usage_stats.get('estimated_cost', '$0.00')

            db.session.commit()

            logger.info(f"Extracted {len(appointments)} appointments from session {session_id}")
            return session

        except Exception as e:
            logger.error(f"Error extracting appointments: {str(e)}")
            session.mark_failed(str(e))
            db.session.commit()
            raise

    def _extract_from_structured_data(self, rows: List[Dict], metadata: Dict) -> List[Dict]:
        """
        Extract appointments from structured data (CSV/Excel with clear columns)

        Args:
            rows: Parsed rows
            metadata: File metadata with headers

        Returns:
            List of extracted appointments
        """
        appointments = []
        headers = metadata.get('headers', [])

        # Common column name mappings
        column_map = self._create_column_mapping(headers)

        for row in rows:
            if not row or all(v is None or str(v).strip() == '' for v in row.values()):
                continue  # Skip empty rows

            appt = {}

            # Map columns
            for field, possible_columns in column_map.items():
                for col in possible_columns:
                    if col in row and row[col]:
                        value = str(row[col]).strip()
                        if value:
                            appt[field] = value
                            break

            # Add if has minimum required data
            if appt.get('patient_name') or appt.get('appointment_date'):
                appointments.append(appt)

        return appointments

    def _create_column_mapping(self, headers: List[str]) -> Dict[str, List[str]]:
        """
        Create mapping of standard fields to possible column names

        Args:
            headers: Column headers from file

        Returns:
            Mapping dictionary
        """
        # Normalize headers (lowercase, no spaces)
        normalized = {h: h.lower().replace(' ', '_').replace('-', '_') for h in headers}

        mapping = {
            'patient_name': ['patient_name', 'patientname', 'name', 'patient', 'full_name', 'fullname'],
            'patient_phone': ['phone', 'mobile', 'phone_number', 'contact', 'patient_phone', 'telephone'],
            'patient_email': ['email', 'patient_email', 'email_address'],
            'patient_dob': ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'patient_dob'],
            'patient_gender': ['gender', 'sex', 'patient_gender'],
            'provider_name': ['doctor', 'provider', 'physician', 'dr', 'provider_name', 'doctor_name'],
            'appointment_date': ['date', 'appointment_date', 'appt_date', 'visit_date', 'scheduled_date'],
            'appointment_time': ['time', 'appointment_time', 'appt_time', 'scheduled_time', 'slot'],
            'appointment_type': ['type', 'appointment_type', 'visit_type', 'appt_type', 'service_type'],
            'duration_minutes': ['duration', 'length', 'time_duration', 'minutes'],
            'chief_complaint': ['complaint', 'reason', 'chief_complaint', 'reason_for_visit', 'notes'],
            'encounter_type': ['encounter_type', 'department', 'category']
        }

        # Find matches in actual headers
        matched = {}
        for field, possible in mapping.items():
            matched[field] = []
            for header in headers:
                norm_header = normalized[header]
                if any(p in norm_header for p in possible):
                    matched[field].append(header)

        return matched

    def validate_appointments(self, session_id: UUID) -> BulkImportSession:
        """
        Validate all extracted appointments

        Args:
            session_id: Import session ID

        Returns:
            Updated session with validation results
        """
        session = BulkImportSession.query.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = 'validating'
            db.session.commit()

            valid_count: int = 0
            errors_summary: List[Dict] = []
            warnings_summary: List[Dict] = []
            conflicts_summary: List[Dict] = []

            for item in session.import_items:
                try:
                    # Validate individual item
                    is_valid, errors, warnings = self._validate_appointment_item(item)

                    if is_valid:
                        item.mark_valid()
                        valid_count += 1

                        # Check for scheduling conflicts
                        has_conflict, conflict_details = self._check_scheduling_conflict(item)
                        if has_conflict:
                            item.set_conflict('time_conflict', conflict_details)
                            conflicts_summary.append({
                                'row': item.row_number,
                                'details': conflict_details
                            })
                    else:
                        item.mark_invalid(errors)
                        errors_summary.extend(errors)

                    if warnings:
                        for warning in warnings:
                            item.add_warning(warning['field'], warning['message'])
                        warnings_summary.extend(warnings)

                except Exception as e:
                    logger.error(f"Error validating item {item.id}: {str(e)}")
                    item.mark_invalid([{'field': 'general', 'message': str(e)}])

            session.valid_count = valid_count
            session.conflict_count = len(conflicts_summary)
            session.validation_summary = {
                'errors': errors_summary,
                'warnings': warnings_summary,
                'conflicts': conflicts_summary
            }
            session.status = 'validated'
            db.session.commit()

            logger.info(f"Validated session {session_id}: {valid_count} valid, {len(errors_summary)} errors")
            return session

        except Exception as e:
            logger.error(f"Error validating appointments: {str(e)}")
            session.mark_failed(str(e))
            db.session.commit()
            raise

    def _validate_appointment_item(self, item: BulkImportItem) -> Tuple[bool, List[Dict], List[Dict]]:
        """
        Validate a single appointment item

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        data = item.extracted_data

        # Required fields
        if not data.get('patient_name'):
            errors.append({'field': 'patient_name', 'message': 'Patient name is required'})

        if not data.get('appointment_date'):
            errors.append({'field': 'appointment_date', 'message': 'Appointment date is required'})

        if not data.get('appointment_time'):
            errors.append({'field': 'appointment_time', 'message': 'Appointment time is required'})

        # Match patient
        if data.get('patient_name'):
            patient = self._match_patient(data)
            if patient:
                item.patient_id = patient['id']
                item.patient_match_type = patient['match_type']
                item.patient_match_score = patient.get('match_score')
            else:
                # Auto-create patient flag
                item.patient_created = True
                item.created_patient_data = {
                    'full_name': data.get('patient_name'),
                    'phone_number': data.get('patient_phone'),
                    'email': data.get('patient_email'),
                    'date_of_birth': data.get('patient_dob'),
                    'gender': data.get('patient_gender')
                }
                warnings.append({'field': 'patient', 'message': 'Patient will be auto-created'})

        # Match provider
        if data.get('provider_name'):
            provider = self._match_provider(data)
            if provider:
                item.provider_id = provider['id']
                item.provider_match_type = provider['match_type']
                item.provider_match_score = provider.get('match_score')
            else:
                warnings.append({'field': 'provider', 'message': f"Provider '{data.get('provider_name')}' not found"})

        # Validate date/time
        try:
            parsed_date = self._parse_date(data.get('appointment_date'))
            parsed_time = self._parse_time(data.get('appointment_time'))
            if parsed_date and parsed_time:
                start_time = datetime.combine(parsed_date, parsed_time)
                if start_time < datetime.now():
                    warnings.append({'field': 'appointment_date', 'message': 'Appointment is in the past'})
        except Exception as e:
            errors.append({'field': 'appointment_date', 'message': f'Invalid date/time format: {str(e)}'})

        # Match service if provided
        if data.get('service_name') or data.get('service_type'):
            service_match = ServiceBookingExtension.match_service(data)
            if service_match:
                item.service_id = service_match['id']
                item.service_match_type = service_match['match_type']
                item.service_match_score = service_match['match_score']
                
                # Validate service-specific fields
                svc_errors, svc_warnings = ServiceBookingExtension.validate_service_fields(item, service_match['service_type'])
                errors.extend(svc_errors)
                warnings.extend(svc_warnings)
            else:
                warnings.append({'field': 'service', 'message': f"Could not match service strongly: {data.get('service_name') or data.get('service_type')}"})

        is_valid = len(errors) == 0

        return is_valid, errors, warnings

    def _match_patient(self, data: Dict) -> Optional[Dict]:
        """
        Match patient by name, phone, or ABHA ID

        Returns:
            Patient match info or None
        """
        # Try exact ABHA ID match first
        if data.get('patient_abha_id'):
            # Note: ABHA ID is encrypted in DB, would need special handling
            pass

        # Try phone number match
        if data.get('patient_phone'):
            # Note: Phone is encrypted, would need special handling
            pass

        # Fuzzy name matching
        if data.get('patient_name'):
            patients = Patient.query.filter(Patient.is_active == True).all()
            if not patients:
                return None

            patient_names = {p.id: p.full_name for p in patients}
            name_to_match = data.get('patient_name')

            # Use fuzzy matching
            match = process.extractOne(
                name_to_match,
                patient_names,
                scorer=fuzz.ratio,
                score_cutoff=80  # 80% similarity threshold
            )

            if match:
                matched_name, score, patient_id = match
                return {
                    'id': patient_id,
                    'match_type': 'fuzzy',
                    'match_score': score
                }

        return None

    def _match_provider(self, data: Dict) -> Optional[Dict]:
        """
        Match provider by name or specialization

        Returns:
            Provider match info or None
        """
        if not data.get('provider_name'):
            return None

        providers = HealthcareProvider.query.filter(HealthcareProvider.is_active == True).all()
        if not providers:
            return None

        provider_names = {p.id: p.full_name for p in providers}
        name_to_match = data.get('provider_name')

        # Fuzzy matching
        match = process.extractOne(
            name_to_match,
            provider_names,
            scorer=fuzz.ratio,
            score_cutoff=75
        )

        if match:
            matched_name, score, provider_id = match
            return {
                'id': provider_id,
                'match_type': 'fuzzy',
                'match_score': score
            }

        return None

    def _check_scheduling_conflict(self, item: BulkImportItem) -> Tuple[bool, Optional[Dict]]:
        """
        Check for scheduling conflicts

        Returns:
            Tuple of (has_conflict, conflict_details)
        """
        if not item.provider_id or not item.extracted_data.get('appointment_date'):
            return False, None

        try:
            date = self._parse_date(item.extracted_data['appointment_date'])
            time = self._parse_time(item.extracted_data['appointment_time'])
            start_time = datetime.combine(date, time)

            duration = item.extracted_data.get('duration_minutes', 30)
            end_time = start_time + timedelta(minutes=duration)

            # Check for existing appointments
            conflicts = Encounter.query.filter(
                Encounter.provider_id == item.provider_id,
                Encounter.start_time < end_time,
                Encounter.end_time > start_time,
                Encounter.status.in_(['scheduled', 'confirmed', 'in-progress'])
            ).all()

            if conflicts:
                return True, {
                    'conflicting_appointments': [str(c.id) for c in conflicts],
                    'requested_time': start_time.isoformat(),
                    'requested_end': end_time.isoformat()
                }

            return False, None

        except Exception as e:
            logger.error(f"Error checking conflict: {str(e)}")
            return False, None

    def _parse_date(self, date_str: str) -> Optional[datetime.date]:
        """Parse date from various formats"""
        from dateutil import parser
        try:
            return parser.parse(date_str).date()
        except:
            return None

    def _parse_time(self, time_str: str) -> Optional[datetime.time]:
        """Parse time from various formats"""
        from dateutil import parser
        try:
            return parser.parse(time_str).time()
        except:
            return None

    def create_appointments(self, session_id: UUID) -> BulkImportSession:
        """
        Create all valid appointments in bulk

        Args:
            session_id: Import session ID

        Returns:
            Updated session with creation results
        """
        session = BulkImportSession.query.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = 'creating'
            db.session.commit()

            created_count: int = 0
            failed_count: int = 0
            patients_created: int = 0

            # Process only valid items without unresolved conflicts
            for item in session.import_items:
                if not item.is_valid:
                    continue

                if item.has_conflict and not item.resolution_action:
                    continue  # Skip unresolved conflicts

                try:
                    # Create patient if needed
                    if item.patient_created and item.created_patient_data:
                        patient = self._create_patient(item.created_patient_data)
                        item.patient_id = patient.id
                        patients_created += 1

                    # Build appointment data
                    appointment_data = self._build_appointment_data(item)

                    # Create appointment
                    from app.appointments.services import AppointmentService
                    
                    # Extract required fields for the book_appointment signature
                    pid_str = appointment_data.get('patient_id')
                    patient_uuid = UUID(pid_str) if pid_str else item.patient_id
                    
                    prv_str = appointment_data.get('provider_id')
                    provider_uuid = UUID(prv_str) if prv_str else item.provider_id
                    
                    appt = AppointmentService.book_appointment(
                        patient_id=patient_uuid,
                        provider_id=provider_uuid,
                        appointment_type=appointment_data.get('appointment_type', 'consultation'),
                        start_time=appointment_data.get('start_time'),
                        duration=appointment_data.get('duration'),
                        chief_complaint=appointment_data.get('chief_complaint'),
                        appointment_data=appointment_data,
                        booked_by_id=self.user_id
                    )

                    item.mark_created(appt['id'])
                    created_count += 1

                except Exception as e:
                    logger.error(f"Failed to create appointment for item {item.id}: {str(e)}")
                    item.mark_failed(str(e))
                    failed_count += 1

            session.created_count = created_count
            session.failed_count = failed_count
            session.patients_created = patients_created
            session.mark_completed()
            db.session.commit()

            logger.info(f"Created {created_count} appointments, {failed_count} failed")
            return session

        except Exception as e:
            logger.error(f"Error creating appointments: {str(e)}")
            session.mark_failed(str(e))
            db.session.commit()
            raise

    def _create_patient(self, patient_data: Dict) -> Patient:
        """Create new patient from extracted data"""
        from app.patients.services import PatientService
        from app.patients.schemas import PatientCreateSchema

        # Build patient schema
        schema_data = {
            'full_name': patient_data.get('full_name'),
            'date_of_birth': patient_data.get('date_of_birth'),
            'gender': patient_data.get('gender'),
            'phone_number': patient_data.get('phone_number'),
            'email': patient_data.get('email'),
            'country': 'India'
        }

        # Remove None values
        schema_data = {k: v for k, v in schema_data.items() if v is not None}

        patient_schema = PatientCreateSchema(**schema_data)
        patient = PatientService.create_patient(patient_schema, self.user_id)

        return patient

    def _build_appointment_data(self, item: BulkImportItem) -> Dict:
        """Build appointment data from import item"""
        data = item.extracted_data

        # Handle conflict resolution
        if item.resolution_action and item.resolution_data:
            if item.resolution_data.get('new_time'):
                data['appointment_time'] = item.resolution_data['new_time']
            if item.resolution_data.get('new_date'):
                data['appointment_date'] = item.resolution_data['new_date']

        if item.service_id:
            # Get service type from match data or DB
            service_type = item.service_match_type
            if not service_type:
                service = Service.query.get(item.service_id)
                service_type = service.service_type.value if service else 'OPD'
                
            return ServiceBookingExtension.build_service_appointment_data(item, item.service_id, service_type)

        # Parse datetime
        date = self._parse_date(data['appointment_date'])
        time = self._parse_time(data['appointment_time'])
        start_time = datetime.combine(date, time)

        return {
            'patient_id': str(item.patient_id),
            'provider_id': str(item.provider_id) if item.provider_id else None,
            'start_time': start_time.isoformat(),
            'duration': data.get('duration_minutes', 30),
            'appointment_type': data.get('appointment_type', 'consultation'),
            'encounter_type': data.get('encounter_type', 'OPD'),
            'chief_complaint': data.get('chief_complaint'),
            'notes': data.get('notes'),
            'booking_source': 'staff'
        }
