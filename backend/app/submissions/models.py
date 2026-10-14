"""Submission models."""
from sqlalchemy import Column, String, ForeignKey, Integer, DateTime, Numeric, Date, Time, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class FormSubmission(BaseModel):
    """
    Form Submission header model - Relational approach.

    Links to patient and encounter for clinical context.
    Individual field answers stored in FormAnswer table.
    """
    __tablename__ = 'form_submissions'

    # Form Reference
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True)
    form_version = Column(Integer)  # Snapshot of version used

    # Clinical Context (NEW - Critical for healthcare)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), index=True)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), index=True)

    # Submission Details
    submitted_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    submission_status = Column(String(50), default='draft', index=True)
    # Values: draft, submitted, verified, archived, deleted

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime)
    verified_at = Column(DateTime)
    verified_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Legacy JSONB backup (optional - for migration period)
    data_backup = Column(JSONB)  # Can store original JSONB for safety

    # External System Integration
    source_system = Column(String(50), default='cv_raman', nullable=False)  # cv_raman, health_screening, etc
    external_submission_id = Column(String(255))  # Original submission ID from external system
    external_metadata = Column(JSONB, default={})  # Additional external system data (camp_id, camp_name, etc)

    # Technical Details
    ip_address = Column(String(45))
    user_agent = Column(String(500))

    # Relationships
    form = relationship('Form', back_populates='form_submissions')
    patient = relationship('Patient', back_populates='form_submissions')
    encounter = relationship('Encounter', back_populates='form_submissions')
    submitted_by_user = relationship('User', foreign_keys=[submitted_by])
    verified_by_user = relationship('User', foreign_keys=[verified_by])
    answers = relationship('FormAnswer', back_populates='submission', lazy='dynamic', cascade='all, delete-orphan')
    risk_score = relationship('SubmissionRiskScore', back_populates='submission', uselist=False, cascade='all, delete-orphan')

    @classmethod
    def find_by_external_id(cls, source_system, external_submission_id):
        """
        Find submission by external system ID.

        Args:
            source_system: The external system name (e.g., 'health_screening')
            external_submission_id: The submission ID in the external system

        Returns:
            FormSubmission object or None if not found
        """
        from app.extensions import db
        return db.session.query(cls).filter_by(
            source_system=source_system,
            external_submission_id=str(external_submission_id)
        ).first()

    def to_dict(self):
        """Convert to dictionary."""
        result = super().to_dict()
        result['form_id'] = str(self.form_id) if self.form_id else None
        result['form_name'] = self.form.name if self.form else None
        result['patient_id'] = str(self.patient_id) if self.patient_id else None
        result['encounter_id'] = str(self.encounter_id) if self.encounter_id else None
        result['submitted_by'] = str(self.submitted_by)
        result['submitted_by_name'] = self.submitted_by_user.full_name if self.submitted_by_user else None
        result['submission_status'] = self.submission_status
        result['status'] = self.submission_status  # Backward compatibility
        result['started_at'] = self.started_at.isoformat() if self.started_at else None
        result['submitted_at'] = self.submitted_at.isoformat() if self.submitted_at else None
        result['verified_at'] = self.verified_at.isoformat() if self.verified_at else None
        result['source_system'] = self.source_system
        result['external_submission_id'] = self.external_submission_id
        result['external_metadata'] = self.external_metadata

        # Reconstruct data dict from answers (for backward compatibility with frontend)
        data_dict = {}
        if hasattr(self, 'answers'):
            answers_list = self.answers.all() if hasattr(self.answers, 'all') else self.answers
            for answer in answers_list:
                data_dict[answer.field_id] = answer.get_value()
            result['answers'] = [answer.to_dict() for answer in answers_list]

        # Use data_backup if available, otherwise use reconstructed data
        result['data'] = self.data_backup if self.data_backup else data_dict

        return result

    def __repr__(self):
        return f'<FormSubmission {self.id} - Form {self.form_id} - {self.submission_status}>'


class FormAnswer(BaseModel):
    """
    Form Answer model - Individual field answers (Relational storage).

    Replaces JSONB submissions.data with proper relational structure.
    Each field answer gets its own row with typed value columns.
    """
    __tablename__ = 'form_answers'

    # Submission Reference
    submission_id = Column(UUID(as_uuid=True), ForeignKey('form_submissions.id', ondelete='CASCADE'), nullable=False, index=True)

    # Field Reference (from form schema)
    field_id = Column(String(255), nullable=False, index=True)
    field_type = Column(String(50), nullable=False, index=True)
    field_label = Column(String(255))  # Snapshot for historical reference

    # Polymorphic Value Storage (only one should be filled)
    value_text = Column(String(5000))  # For text, email, url, phone, textarea
    value_numeric = Column(Numeric(10, 2), index=True)  # For number, painScale, linearScale
    value_date = Column(Date)  # For date fields
    value_time = Column(Time)  # For time fields
    value_boolean = Column(Boolean)  # For checkbox fields
    value_json = Column(JSONB)  # For select (multi), radio, complex types

    # Additional Context
    answer_order = Column(Integer, default=0)  # For multi-value fields
    unit = Column(String(50))  # For numeric values with units

    # Clinical Mapping (for integration with observations/diagnoses)
    maps_to_observation_type = Column(String(100))  # Link to observation_type
    loinc_code = Column(String(50))  # If this answer represents a coded observation

    # Relationships
    submission = relationship('FormSubmission', back_populates='answers')

    def get_value(self):
        """Get the value regardless of type."""
        if self.value_numeric is not None:
            return float(self.value_numeric)
        elif self.value_text is not None:
            return self.value_text
        elif self.value_boolean is not None:
            return self.value_boolean
        elif self.value_date is not None:
            return self.value_date.isoformat()
        elif self.value_time is not None:
            return self.value_time.isoformat()
        elif self.value_json is not None:
            return self.value_json
        return None

    def set_value(self, value, value_type=None):
        """Set value based on type."""
        # Reset all values
        self.value_numeric = None
        self.value_text = None
        self.value_boolean = None
        self.value_date = None
        self.value_time = None
        self.value_json = None

        if value is None:
            return

        # Auto-detect type if not specified
        if value_type is None:
            if isinstance(value, (int, float)):
                value_type = 'numeric'
            elif isinstance(value, bool):
                value_type = 'boolean'
            elif isinstance(value, str):
                value_type = 'text'
            elif isinstance(value, (dict, list)):
                value_type = 'json'

        # Set appropriate column
        if value_type == 'numeric':
            self.value_numeric = float(value)
        elif value_type == 'boolean':
            self.value_boolean = bool(value)
        elif value_type == 'text':
            self.value_text = str(value)
        elif value_type == 'json':
            self.value_json = value
        elif value_type == 'date':
            self.value_date = value
        elif value_type == 'time':
            self.value_time = value

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['submission_id'] = str(self.submission_id)
        data['field_id'] = self.field_id
        data['field_type'] = self.field_type
        data['field_label'] = self.field_label
        data['value'] = self.get_value()
        data['unit'] = self.unit
        data['maps_to_observation_type'] = self.maps_to_observation_type
        data['loinc_code'] = self.loinc_code

        return data

    def __repr__(self):
        return f'<FormAnswer {self.field_id}={self.get_value()}>'


# Legacy Submission model (keep for backward compatibility during migration)
class Submission(BaseModel):
    """Submission model for storing form responses."""
    __tablename__ = 'submissions'

    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    data = Column(JSONB, nullable=False)  # Actual form data
    status = Column(String(50), default='submitted', nullable=False)

    # Relationships
    form = relationship('Form', back_populates='submissions')
    submitted_by_user = relationship('User', back_populates='submissions')

    def validate_against_form(self):
        """Validate submission data against form schema."""
        if not self.form:
            return False, "Form not found"

        # Extract fields from schema (handle both single-page and multi-page)
        schema = self.form.schema
        if 'pages' in schema:
            # Multi-page form
            all_fields = []
            for page in schema.get('pages', []):
                all_fields.extend(page.get('fields', []))
            form_fields = {field['id']: field for field in all_fields}
        else:
            # Single-page form
            form_fields = {field['id']: field for field in schema.get('fields', [])}

        submission_data = self.data or {}
        errors = []

        # Helper function to check if field should be visible
        def is_field_visible(field_config):
            """Check if field should be visible based on visibility rules."""
            visibility_rules = field_config.get('visibilityRules', [])
            if not visibility_rules:
                return True  # No rules = always visible

            # ALL rules must be satisfied (AND logic)
            for rule in visibility_rules:
                rule_field = rule.get('field')
                operator = rule.get('operator')
                rule_value = rule.get('value')

                # Get the value from submission data
                field_value = submission_data.get(rule_field)

                # Evaluate the rule
                if operator == 'equals':
                    if field_value != rule_value:
                        return False
                elif operator == 'notEquals':
                    if field_value == rule_value:
                        return False
                elif operator == 'contains':
                    if not (isinstance(field_value, str) and rule_value.lower() in field_value.lower()):
                        return False
                elif operator == 'notContains':
                    if isinstance(field_value, str) and rule_value.lower() in field_value.lower():
                        return False
                elif operator == 'greaterThan':
                    try:
                        if not (float(field_value) > float(rule_value)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif operator == 'lessThan':
                    try:
                        if not (float(field_value) < float(rule_value)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif operator == 'greaterThanOrEqual':
                    try:
                        if not (float(field_value) >= float(rule_value)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif operator == 'lessThanOrEqual':
                    try:
                        if not (float(field_value) <= float(rule_value)):
                            return False
                    except (TypeError, ValueError):
                        return False

            return True  # All rules passed

        # Check required fields (only if they should be visible)
        for field_id, field_config in form_fields.items():
            # Skip validation for hidden fields
            if not is_field_visible(field_config):
                continue

            if field_config.get('required', False):
                if field_id not in submission_data or submission_data[field_id] in [None, '']:
                    errors.append(f"Field '{field_config['label']}' is required")

        # Validate field types and constraints
        for field_id, value in submission_data.items():
            if field_id not in form_fields:
                continue  # Skip unknown fields

            field_config = form_fields[field_id]
            field_type = field_config.get('type')

            # Type validation
            if field_type == 'number' and value is not None:
                try:
                    num_value = float(value)
                    # Check min/max if specified
                    if 'validation' in field_config:
                        validation = field_config['validation']
                        if 'min' in validation and num_value < validation['min']:
                            errors.append(f"Field '{field_config['label']}' must be at least {validation['min']}")
                        if 'max' in validation and num_value > validation['max']:
                            errors.append(f"Field '{field_config['label']}' must be at most {validation['max']}")
                except (TypeError, ValueError):
                    errors.append(f"Field '{field_config['label']}' must be a number")

            elif field_type == 'select' and value is not None:
                options = field_config.get('options', [])
                if value not in options:
                    errors.append(f"Invalid option for field '{field_config['label']}'")

            elif field_type == 'email' and value:
                import re
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, value):
                    errors.append(f"Invalid email format for field '{field_config['label']}'")

            elif field_type == 'painScale' and value is not None:
                try:
                    pain_value = int(value)
                    if pain_value < 0 or pain_value > 10:
                        errors.append(f"Field '{field_config['label']}' must be between 0 and 10")
                except (TypeError, ValueError):
                    errors.append(f"Field '{field_config['label']}' must be a valid pain scale value (0-10)")

        if errors:
            return False, errors

        return True, "Valid submission"

    def get_numeric_values(self):
        """Extract numeric values for aggregation."""
        if not self.form or not self.data:
            return {}

        numeric_fields = self.form.get_numeric_fields()
        result = {}

        for field_id in numeric_fields:
            if field_id in self.data:
                try:
                    result[field_id] = float(self.data[field_id])
                except (TypeError, ValueError):
                    result[field_id] = None

        return result

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['form_name'] = self.form.name if self.form else None
        data['submitted_by_name'] = self.submitted_by_user.full_name if self.submitted_by_user else None
        return data

    def __repr__(self):
        return f'<Submission {self.id} for Form {self.form_id}>'