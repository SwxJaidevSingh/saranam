"""Risk assessment models for form risk scoring."""
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Numeric, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from app.extensions import db
from datetime import datetime


class FieldRiskRule(BaseModel):
    """Risk rules for individual form fields."""
    __tablename__ = 'field_risk_rules'

    field_id = Column(String(255), nullable=False, index=True)
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True)
    rule_type = Column(String(50), nullable=False, index=True)  # 'range' or 'categorical'
    condition = Column(JSONB, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    # Relationships
    form = relationship('Form', back_populates='risk_rules')
    creator = relationship('User', foreign_keys=[created_by])

    # Constraints
    __table_args__ = (
        CheckConstraint("rule_type IN ('range', 'categorical')", name='valid_rule_type'),
    )

    def validate_condition(self):
        """Validate condition structure based on rule type."""
        if not isinstance(self.condition, dict):
            return False, "Condition must be a JSON object"

        if self.rule_type == 'range':
            # Range rule: { "low": { "lower": 0, "upper": 3, "score": 1 }, ... }
            for key, value in self.condition.items():
                if not isinstance(value, dict):
                    return False, f"Range '{key}' must be an object"
                if 'score' not in value:
                    return False, f"Range '{key}' missing 'score' field"
                if 'lower' in value and 'upper' in value:
                    if not isinstance(value['lower'], (int, float)):
                        return False, f"Range '{key}' lower must be numeric"
                    if not isinstance(value['upper'], (int, float)):
                        return False, f"Range '{key}' upper must be numeric"

        elif self.rule_type == 'categorical':
            # Categorical rule: { "mild": { "score": 1 }, "moderate": { "score": 2 }, ... }
            for key, value in self.condition.items():
                if not isinstance(value, dict):
                    return False, f"Category '{key}' must be an object"
                if 'score' not in value:
                    return False, f"Category '{key}' missing 'score' field"
                if not isinstance(value['score'], (int, float)):
                    return False, f"Category '{key}' score must be numeric"

        return True, "Valid condition"

    def calculate_score(self, field_value):
        """Calculate risk score for given field value."""
        if field_value is None:
            return 0

        try:
            if self.rule_type == 'range':
                # Convert field value to number
                num_value = float(field_value)

                # Find matching range
                for range_key, range_def in self.condition.items():
                    if 'lower' in range_def and 'upper' in range_def:
                        if range_def['lower'] <= num_value <= range_def['upper']:
                            return float(range_def.get('score', 0))
                    elif 'lower' in range_def:
                        if num_value >= range_def['lower']:
                            return float(range_def.get('score', 0))
                    elif 'upper' in range_def:
                        if num_value <= range_def['upper']:
                            return float(range_def.get('score', 0))

            elif self.rule_type == 'categorical':
                # Match exact category value (case-insensitive)
                field_value_lower = str(field_value).lower()

                for category, category_def in self.condition.items():
                    if category.lower() == field_value_lower:
                        return float(category_def.get('score', 0))

        except (ValueError, TypeError):
            # If conversion fails, return 0
            return 0

        # No match found
        return 0

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': str(self.id),
            'field_id': self.field_id,
            'form_id': str(self.form_id),
            'rule_type': self.rule_type,
            'condition': self.condition,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class FormRiskLevel(BaseModel):
    """Risk level thresholds for forms."""
    __tablename__ = 'form_risk_levels'

    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True)
    level_name = Column(String(50), nullable=False, index=True)
    min_score = Column(Numeric(10, 2), nullable=False)
    max_score = Column(Numeric(10, 2), nullable=False)
    color_code = Column(String(20), nullable=True)  # Hex color code
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    # Relationships
    form = relationship('Form', back_populates='risk_levels')
    creator = relationship('User', foreign_keys=[created_by])

    def validate_scores(self):
        """Validate that min_score < max_score."""
        if self.min_score >= self.max_score:
            return False, "min_score must be less than max_score"
        return True, "Valid scores"

    def matches_score(self, score):
        """Check if score falls within this risk level."""
        return self.min_score <= score <= self.max_score

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': str(self.id),
            'form_id': str(self.form_id),
            'level_name': self.level_name,
            'min_score': float(self.min_score) if self.min_score is not None else None,
            'max_score': float(self.max_score) if self.max_score is not None else None,
            'color_code': self.color_code,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class SubmissionRiskScore(db.Model):
    """Cached risk scores for form submissions.

    Note: This model does NOT inherit from BaseModel because it uses
    submission_id as the primary key instead of id, and doesn't have created_at.
    """
    __tablename__ = 'submission_risk_scores'

    submission_id = Column(UUID(as_uuid=True), ForeignKey('form_submissions.id', ondelete='CASCADE'),
                          primary_key=True)
    total_score = Column(Numeric(10, 2), nullable=False, index=True)
    risk_level = Column(String(50), nullable=False, index=True)
    field_scores = Column(JSONB, nullable=True)  # Breakdown by field
    calculated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    submission = relationship('FormSubmission', back_populates='risk_score', uselist=False)

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'submission_id': str(self.submission_id),
            'total_score': float(self.total_score) if self.total_score is not None else None,
            'risk_level': self.risk_level,
            'field_scores': self.field_scores,
            'calculated_at': self.calculated_at.isoformat() if self.calculated_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class FieldSection(BaseModel):
    """Reusable field sections for form building."""
    __tablename__ = 'field_sections'

    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)  # 'vitals', 'assessment', 'history'
    fields = Column(JSONB, nullable=False)  # Array of field definitions
    is_system = Column(Boolean, nullable=False, default=False, index=True, server_default='false')
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    # Relationships
    creator = relationship('User', foreign_keys=[created_by])

    def validate_fields(self):
        """Validate fields structure."""
        if not isinstance(self.fields, list):
            return False, "Fields must be an array"

        for field in self.fields:
            if not isinstance(field, dict):
                return False, "Each field must be an object"
            if 'type' not in field:
                return False, "Each field must have a 'type' property"
            if 'label' not in field:
                return False, "Each field must have a 'label' property"

        return True, "Valid fields"

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'fields': self.fields,
            'is_system': self.is_system,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
