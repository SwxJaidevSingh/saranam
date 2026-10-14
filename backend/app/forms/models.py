"""Form models."""
import secrets
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel


class Form(BaseModel):
    """Form model for storing form templates."""
    __tablename__ = 'forms'

    name = Column(String(255), nullable=False)
    description = Column(Text)
    schema = Column(JSONB, nullable=False)  # Form structure as JSON
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)

    # Sharing and public access
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    share_token = Column(String(64), unique=True, nullable=True, index=True)

    # Template fields
    is_template = Column(Boolean, default=False, nullable=False, index=True, server_default='false')
    template_category = Column(String(100), nullable=True, index=True)  # 'physiotherapy', 'msw', 'opd', etc.
    template_description = Column(Text, nullable=True)

    # Relationships
    creator = relationship('User', back_populates='forms_created')
    submissions = relationship('Submission', back_populates='form', lazy='dynamic', cascade='all, delete-orphan')
    form_submissions = relationship('FormSubmission', back_populates='form', lazy='dynamic', cascade='all, delete-orphan')
    risk_rules = relationship('FieldRiskRule', back_populates='form', lazy='dynamic', cascade='all, delete-orphan')
    risk_levels = relationship('FormRiskLevel', back_populates='form', lazy='dynamic', cascade='all, delete-orphan')

    def validate_schema(self):
        """Validate form schema structure."""
        if not isinstance(self.schema, dict):
            return False, "Schema must be a JSON object"

        # Support both single-page ('fields' array) and multi-page ('pages' array) forms
        has_fields = 'fields' in self.schema
        has_pages = 'pages' in self.schema

        if not has_fields and not has_pages:
            return False, "Schema must contain either 'fields' array or 'pages' array"

        if has_fields and has_pages:
            return False, "Schema cannot have both 'fields' and 'pages' at root level"

        # Collect all fields for validation
        all_fields = []
        if has_pages:
            if not isinstance(self.schema['pages'], list):
                return False, "'pages' must be an array"
            for page in self.schema['pages']:
                if not isinstance(page, dict):
                    return False, "Each page must be an object"
                if 'id' not in page:
                    return False, "Each page must have an 'id'"
                if 'fields' not in page or not isinstance(page['fields'], list):
                    return False, f"Page '{page['id']}' must have a 'fields' array"
                all_fields.extend(page['fields'])
        else:
            if not isinstance(self.schema['fields'], list):
                return False, "'fields' must be an array"
            all_fields = self.schema['fields']

        # Validate each field
        required_field_properties = ['id', 'type', 'label']
        valid_types = [
            'text', 'number', 'date', 'select', 'email', 'textarea',
            'checkbox', 'radio', 'file', 'linearScale', 'section',
            'time', 'url', 'phone', 'painScale', 'severityRating',
            'symptomChecklist', 'functionalStatus', 'riskScoreDisplay',
            'geoLocation', 'numeric'
        ]

        field_ids = set()

        for field in all_fields:
            # Check required properties
            for prop in required_field_properties:
                if prop not in field:
                    return False, f"Field missing required property: {prop}"

            # Check for duplicate field IDs
            if field['id'] in field_ids:
                return False, f"Duplicate field ID: {field['id']}"
            field_ids.add(field['id'])

            # Validate field type
            if field['type'] not in valid_types:
                return False, f"Invalid field type: {field['type']}"

            # Validate select and radio fields have options
            if field['type'] in ['select', 'radio'] and 'options' not in field:
                return False, f"{field['type'].capitalize()} field '{field['id']}' must have options"

            # Validate number fields
            if field['type'] == 'number':
                if 'validation' in field:
                    validation = field['validation']
                    if 'min' in validation and 'max' in validation:
                        if validation['min'] > validation['max']:
                            return False, f"Invalid min/max for field '{field['id']}'"

            # Validate linearScale fields
            if field['type'] == 'linearScale':
                if 'config' not in field:
                    return False, f"linearScale field '{field['id']}' must have 'config' object"
                config = field['config']
                if 'min' not in config or 'max' not in config:
                    return False, f"linearScale field '{field['id']}' must have 'min' and 'max' in config"
                if config['min'] >= config['max']:
                    return False, f"linearScale field '{field['id']}' min must be less than max"

            # Validate painScale fields
            if field['type'] == 'painScale':
                if 'config' not in field:
                    return False, f"painScale field '{field['id']}' must have 'config' object"
                config = field['config']
                if 'min' not in config or 'max' not in config:
                    return False, f"painScale field '{field['id']}' must have 'min' and 'max' in config"
                # Pain scale should be 0-10
                if config['min'] != 0:
                    return False, f"painScale field '{field['id']}' must start at 0"
                if config['max'] != 10:
                    return False, f"painScale field '{field['id']}' must end at 10"

            # Validate file upload fields
            if field['type'] == 'file':
                if 'config' in field:
                    config = field['config']
                    if 'maxSize' in config and not isinstance(config['maxSize'], (int, float)):
                        return False, f"file field '{field['id']}' maxSize must be a number"

            # Validate visibility rules (conditional logic)
            if 'visibilityRules' in field:
                if not isinstance(field['visibilityRules'], list):
                    return False, f"Field '{field['id']}' visibilityRules must be an array"
                for rule in field['visibilityRules']:
                    if not isinstance(rule, dict):
                        return False, f"Each visibility rule must be an object"
                    if 'field' not in rule or 'operator' not in rule or 'value' not in rule:
                        return False, f"Visibility rule must have 'field', 'operator', and 'value'"
                    valid_operators = ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual']
                    if rule['operator'] not in valid_operators:
                        return False, f"Invalid visibility rule operator: {rule['operator']}"

            # Validate pattern (regex) validation
            if 'validation' in field and 'pattern' in field['validation']:
                pattern = field['validation']['pattern']
                if not isinstance(pattern, str):
                    return False, f"Pattern for field '{field['id']}' must be a string"

        return True, "Valid schema"

    def get_field_ids(self):
        """Get list of field IDs from schema."""
        if not self.schema:
            return []
        
        if isinstance(self.schema, dict):
            if 'fields' in self.schema:
                return [field['id'] for field in self.schema['fields'] if 'id' in field]
            
            if 'pages' in self.schema and isinstance(self.schema['pages'], list):
                field_ids = []
                for page in self.schema['pages']:
                    elements = page.get('elements', []) or page.get('fields', [])
                    field_ids.extend([el['id'] for el in elements if 'id' in el])
                return field_ids
                
            if 'sections' in self.schema and isinstance(self.schema['sections'], list):
                field_ids = []
                for section in self.schema['sections']:
                    fields = section.get('fields', [])
                    field_ids.extend([f['id'] for f in fields if 'id' in f])
                return field_ids
                
        elif isinstance(self.schema, list):
            return [field['id'] for field in self.schema if 'id' in field]
            
        return []

    def get_numeric_fields(self):
        """Get list of numeric field IDs for aggregation."""
        if not self.schema:
            return []
            
        fields_list = []
        if isinstance(self.schema, dict):
            if 'fields' in self.schema:
                fields_list = self.schema['fields']
            elif 'pages' in self.schema and isinstance(self.schema['pages'], list):
                for page in self.schema['pages']:
                    elements = page.get('elements', []) or page.get('fields', [])
                    fields_list.extend(elements)
            elif 'sections' in self.schema and isinstance(self.schema['sections'], list):
                for section in self.schema['sections']:
                    fields_list.extend(section.get('fields', []))
        elif isinstance(self.schema, list):
            fields_list = self.schema
            
        return [
            field['id']
            for field in fields_list
            if field.get('type') in ['number', 'numeric'] and 'id' in field
        ]

    def generate_share_token(self):
        """Generate a unique share token for public access."""
        self.share_token = secrets.token_urlsafe(32)
        return self.share_token

    def enable_public_access(self):
        """Enable public access and generate share token if needed."""
        self.is_public = True
        if not self.share_token:
            self.generate_share_token()
        return self.share_token

    def disable_public_access(self):
        """Disable public access."""
        self.is_public = False
        # Keep the token for possible re-enabling

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['creator_email'] = self.creator.email if self.creator else None
        data['submission_count'] = self.submissions.count()
        data['is_public'] = self.is_public
        data['share_token'] = self.share_token if self.is_public else None
        return data

    def __repr__(self):
        return f'<Form {self.name}>'