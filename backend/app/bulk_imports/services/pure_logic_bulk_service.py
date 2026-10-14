"""
Pure Logic Bulk Appointment Service
NO LLM - 100% deterministic logic for bulk appointment processing
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, time
from uuid import UUID
import json
from rapidfuzz import fuzz, process

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.common.models import User
from app.bulk_imports.models.bulk_import_session import BulkImportSession
from app.bulk_imports.models.bulk_import_item import BulkImportItem
from app.bulk_imports.services.file_parser_service import FileParserService
from app.bulk_imports.services.pure_logic_validators import RowValidator, DateTimeParser, FieldValidators
from app.bulk_imports.services.schedule_conflict_detector import (
    ProviderScheduleValidator, AppointmentConflictDetector, ConflictType
)
from app.bulk_imports.services.conflict_suggestion_generator import ConflictSuggestionGenerator

logger = logging.getLogger(__name__)


class PureLogicBulkService:
    """
    Pure logic bulk appointment service - NO LLM
    Deterministic validation and conflict detection
    """

    def __init__(self, user_id: UUID):
        """
        Initialize service

        Args:
            user_id: ID of user performing the import
        """
        self.user_id = user_id
        self.user = User.query.get(user_id)
        if not self.user:
            raise ValueError(f"User {user_id} not found")

        self.file_parser = FileParserService()
        self.row_validator = RowValidator()

    def process_file_upload(
        self,
        file_path: str,
        filename: str,
        file_type: str
    ) -> BulkImportSession:
        """
        Process uploaded file and create import session

        Args:
            file_path: Path to uploaded file
            filename: Original filename
            file_type: File type (xlsx, csv)

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
                llm_provider='none',  # Pure logic, no LLM
                extraction_method='pure_logic',
                uses_pure_logic=True,
                created_by=self.user_id,
                uploaded_by_name=self.user.full_name,
                status='uploaded'
            )
            db.session.add(session)
            db.session.commit()

            logger.info(f"Created pure logic import session {session.id} for file {filename}")
            return session

        except Exception as e:
            logger.error(f"Error processing file upload: {str(e)}")
            raise

    def process_and_validate(self, session_id: UUID) -> BulkImportSession:
        """
        Parse file, validate all rows, and detect conflicts

        Args:
            session_id: Import session ID

        Returns:
            Updated session with validation results
        """
        session = BulkImportSession.query.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = 'processing'
            session.started_at = datetime.utcnow()
            db.session.commit()

            # Parse file
            rows, file_metadata = self.file_parser.parse_file(session.file_path, session.file_type)
            session.total_rows = len(rows)

            logger.info(f"Parsed {len(rows)} rows from {session.filename}")

            # Process each row
            auto_approved = 0
            needs_review = 0
            rejected = 0
            missing_provider = 0

            for row_num, row_data in enumerate(rows, 1):
                try:
                    item = self._process_row(session, row_num, row_data)

                    if item.status == 'missing_provider':
                        missing_provider += 1
                    elif item.status == 'valid' and not item.has_conflict:
                        auto_approved += 1
                    elif item.status == 'valid' and item.has_conflict:
                        needs_review += 1
                    else:
                        rejected += 1

                except Exception as e:
                    logger.error(f"Error processing row {row_num}: {str(e)}")
                    # Create error item
                    item = BulkImportItem(
                        session_id=session.id,
                        row_number=row_num,
                        original_data=row_data,
                        status='invalid',
                        validation_errors=[{'field': 'general', 'message': str(e)}]
                    )
                    db.session.add(item)
                    rejected += 1

            # Update session statistics
            session.auto_approved_count = auto_approved
            session.needs_review_count = needs_review
            session.rejected_count = rejected
            session.missing_provider_count = missing_provider
            session.valid_count = auto_approved + needs_review
            session.status = 'validated'
            session.completed_at = datetime.utcnow()

            db.session.commit()

            logger.info(f"Validation complete: {auto_approved} auto-approved, {needs_review} need review, {missing_provider} missing providers, {rejected} rejected")
            return session

        except Exception as e:
            logger.error(f"Error validating appointments: {str(e)}")
            session.status = 'failed'
            session.error_message = str(e)
            db.session.commit()
            raise

    def _process_row(self, session: BulkImportSession, row_num: int, row_data: Dict) -> BulkImportItem:
        """Process a single row: validate, match entities, detect conflicts"""

        # Create import item
        item = BulkImportItem(
            session_id=session.id,
            row_number=row_num,
            original_data=row_data,
            extracted_data=row_data,
            status='pending'
        )

        # Step 1: Basic field validation
        is_valid, errors, warnings = self.row_validator.validate_row(row_data)

        if not is_valid:
            item.status = 'invalid'
            item.validation_errors = [e.to_dict() for e in errors]
            item.validation_warnings = [w.to_dict() for w in warnings] if warnings else []
            item.is_valid = False
            db.session.add(item)
            return item

        # Row is format-valid
        item.validation_warnings = [w.to_dict() for w in warnings] if warnings else []

        # Step 2: Match provider
        provider_match = self._match_provider(row_data)
        if not provider_match:
            # Provider not found - mark for resolution instead of rejecting
            item.status = 'missing_provider'
            item.original_provider_name = row_data.get('provider_name')
            item.is_valid = True  # Valid data, just needs provider resolution
            item.validation_warnings = [{
                'field': 'provider_name',
                'message': f"Provider '{row_data.get('provider_name')}' not found - needs resolution"
            }]
            db.session.add(item)
            return item

        item.provider_id = provider_match['id']
        item.provider_match_type = provider_match['match_type']
        item.provider_match_score = provider_match.get('match_score')

        # Step 3: Parse date and time
        parsed_date = DateTimeParser.parse_date(row_data.get('appointment_date'))
        parsed_time = DateTimeParser.parse_time(row_data.get('appointment_time'))

        # Step 4: Get duration (or use provider default)
        duration = row_data.get('duration_minutes')
        if not duration:
            provider = db.session.query(HealthcareProvider).get(item.provider_id)
            duration = provider.default_consultation_duration if provider else 30
        else:
            try:
                duration = int(duration)
            except:
                duration = 30

        # Step 5: Provider schedule validation
        schedule_valid, schedule_conflict, provider_schedule = ProviderScheduleValidator.validate_provider_schedule(
            provider_id=item.provider_id,
            appointment_date=parsed_date,
            appointment_time=parsed_time,
            duration_minutes=duration
        )

        if not schedule_valid:
            # Critical conflict - provider not working or outside hours
            item.status = 'invalid'
            item.has_conflict = True
            item.conflict_type = schedule_conflict.type
            item.conflict_severity = schedule_conflict.severity
            item.conflict_details = schedule_conflict.to_dict()
            item.is_valid = False
            db.session.add(item)
            return item

        # Step 6: Match patient
        patient_match = self._match_patient(row_data)
        if patient_match:
            item.patient_id = patient_match['id']
            item.patient_match_type = patient_match['match_type']
            item.patient_match_score = patient_match.get('match_score')
        else:
            # Patient will be auto-created
            item.patient_created = True
            item.created_patient_data = {
                'full_name': row_data.get('patient_name'),
                'phone_number': row_data.get('patient_phone'),
                'email': row_data.get('patient_email'),
                'date_of_birth': row_data.get('patient_dob')
            }

        # Step 7: Conflict detection
        conflicts = []

        # Check provider time overlaps
        provider_conflicts = AppointmentConflictDetector.detect_provider_conflicts(
            provider_id=item.provider_id,
            appointment_date=parsed_date,
            appointment_time=parsed_time,
            duration_minutes=duration
        )
        conflicts.extend(provider_conflicts)

        # Check patient double-booking (if patient matched)
        if item.patient_id:
            patient_conflicts = AppointmentConflictDetector.detect_patient_conflicts(
                patient_id=item.patient_id,
                appointment_date=parsed_date,
                appointment_time=parsed_time,
                duration_minutes=duration
            )
            conflicts.extend(patient_conflicts)

            # Check duplicate
            duplicate_conflict = AppointmentConflictDetector.detect_duplicate_appointment(
                patient_id=item.patient_id,
                provider_id=item.provider_id,
                appointment_date=parsed_date,
                appointment_time=parsed_time
            )
            if duplicate_conflict:
                conflicts.append(duplicate_conflict)

        # Check slot capacity
        if provider_schedule:
            capacity_conflict = AppointmentConflictDetector.detect_slot_capacity_conflict(
                provider_id=item.provider_id,
                schedule=provider_schedule,
                appointment_date=parsed_date,
                appointment_time=parsed_time
            )
            if capacity_conflict:
                conflicts.append(capacity_conflict)

        # Step 8: Generate suggestions for conflicts
        if conflicts:
            item.has_conflict = True
            item.conflict_type = conflicts[0].type  # Primary conflict
            item.conflict_severity = conflicts[0].severity
            item.conflict_details = {
                'conflicts': [c.to_dict() for c in conflicts]
            }

            # Generate suggestions
            conflict_types = [c.type for c in conflicts]
            suggestions = ConflictSuggestionGenerator.generate_suggestions(
                provider_id=item.provider_id,
                requested_date=parsed_date,
                requested_time=parsed_time,
                duration_minutes=duration,
                conflict_types=conflict_types
            )

            item.suggested_alternatives = [s.to_dict() for s in suggestions]
            item.status = 'valid'  # Valid but has conflicts
            item.is_valid = True
        else:
            # No conflicts - auto-approved
            item.status = 'valid'
            item.has_conflict = False
            item.is_valid = True

        db.session.add(item)
        return item

    def _match_provider(self, data: Dict) -> Optional[Dict]:
        """
        Match provider by name

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
                'match_type': 'fuzzy' if score < 100 else 'exact',
                'match_score': score
            }

        return None

    def _match_patient(self, data: Dict) -> Optional[Dict]:
        """
        Match patient by phone or name

        Returns:
            Patient match info or None
        """
        # Try phone number match first (more reliable)
        if data.get('patient_phone'):
            # Note: In production, you'd need to handle encrypted phone matching
            # For now, simplified matching by name
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
                    'match_type': 'fuzzy' if score < 100 else 'exact',
                    'match_score': score
                }

        return None
