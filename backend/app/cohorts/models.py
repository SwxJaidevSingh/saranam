"""
Patient Cohort Models
Database models for patient cohort management and analysis.
"""
import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.extensions import db


class PatientCohort(db.Model):
    """
    Patient cohort definition with flexible criteria.
    Supports dynamic patient grouping based on demographics, clinical data, and behaviors.
    """
    __tablename__ = 'patient_cohorts'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)

    # Criteria stored as JSONB for flexibility
    # Example: {"age": {"min": 40, "max": 65}, "gender": "female", "diagnoses": ["diabetes"]}
    criteria = db.Column(JSONB, nullable=False, default=dict)

    # Ownership and sharing
    owner_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    is_shared = db.Column(db.Boolean, default=False)
    shared_with = db.Column(JSONB, default=list)  # List of user IDs who can access

    # Auto-update configuration
    auto_update = db.Column(db.Boolean, default=True)
    update_frequency = db.Column(db.String(20), default='daily')  # daily, weekly, manual
    last_calculated_at = db.Column(db.DateTime)

    # Status
    is_active = db.Column(db.Boolean, default=True)
    member_count = db.Column(db.Integer, default=0)

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = db.relationship('User', backref='cohorts')
    members = db.relationship('CohortMember', back_populates='cohort', cascade='all, delete-orphan')
    activities = db.relationship('CohortActivity', back_populates='cohort', cascade='all, delete-orphan')
    outcomes = db.relationship('CohortOutcome', back_populates='cohort', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<PatientCohort {self.name}>'

    def to_dict(self):
        """Convert cohort to dictionary."""
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'criteria': self.criteria,
            'owner_id': str(self.owner_id),
            'is_shared': self.is_shared,
            'auto_update': self.auto_update,
            'update_frequency': self.update_frequency,
            'last_calculated_at': self.last_calculated_at.isoformat() if self.last_calculated_at else None,
            'is_active': self.is_active,
            'member_count': self.member_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class CohortMember(db.Model):
    """
    Materialized view of cohort membership.
    Stores which patients belong to which cohorts with join timestamps and snapshots.
    """
    __tablename__ = 'cohort_members'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cohort_id = db.Column(UUID(as_uuid=True), db.ForeignKey('patient_cohorts.id'), nullable=False)
    patient_id = db.Column(UUID(as_uuid=True), db.ForeignKey('patients.id'), nullable=False)

    # Timestamp when patient joined the cohort
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Snapshot of patient data at time of joining (for historical analysis)
    # Example: {"age": 45, "hba1c": 8.5, "bp_systolic": 140}
    snapshot_data = db.Column(JSONB, default=dict)

    # Track if patient still meets criteria
    still_qualifies = db.Column(db.Boolean, default=True)
    last_checked_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    cohort = db.relationship('PatientCohort', back_populates='members')
    patient = db.relationship('Patient', backref='cohort_memberships')

    # Composite index for fast lookups
    __table_args__ = (
        db.Index('ix_cohort_members_cohort_patient', 'cohort_id', 'patient_id'),
    )

    def __repr__(self):
        return f'<CohortMember cohort={self.cohort_id} patient={self.patient_id}>'

    def to_dict(self):
        """Convert member to dictionary."""
        return {
            'id': str(self.id),
            'cohort_id': str(self.cohort_id),
            'patient_id': str(self.patient_id),
            'joined_at': self.joined_at.isoformat(),
            'snapshot_data': self.snapshot_data,
            'still_qualifies': self.still_qualifies,
            'last_checked_at': self.last_checked_at.isoformat() if self.last_checked_at else None
        }


class CohortActivity(db.Model):
    """
    Activity log for cohort operations.
    Tracks all actions performed on cohorts (creation, updates, bulk actions, etc.)
    """
    __tablename__ = 'cohort_activities'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cohort_id = db.Column(UUID(as_uuid=True), db.ForeignKey('patient_cohorts.id'), nullable=False)

    # Activity type (created, updated, recalculated, bulk_action, exported, etc.)
    activity_type = db.Column(db.String(50), nullable=False)

    # Activity details stored as JSONB
    # Example for bulk_action: {"action": "send_reminder", "patient_count": 25, "message": "..."}
    details = db.Column(JSONB, default=dict)

    # User who performed the activity
    performed_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    cohort = db.relationship('PatientCohort', back_populates='activities')
    user = db.relationship('User', backref='cohort_activities')

    # Index for activity queries
    __table_args__ = (
        db.Index('ix_cohort_activities_cohort_created', 'cohort_id', 'created_at'),
    )

    def __repr__(self):
        return f'<CohortActivity {self.activity_type} on {self.cohort_id}>'

    def to_dict(self):
        """Convert activity to dictionary."""
        return {
            'id': str(self.id),
            'cohort_id': str(self.cohort_id),
            'activity_type': self.activity_type,
            'details': self.details,
            'performed_by': str(self.performed_by),
            'created_at': self.created_at.isoformat()
        }


class CohortOutcome(db.Model):
    """
    Outcome metrics for cohort tracking.
    Stores time-series data for cohort metrics (avg HbA1c, complication rates, etc.)
    """
    __tablename__ = 'cohort_outcomes'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cohort_id = db.Column(UUID(as_uuid=True), db.ForeignKey('patient_cohorts.id'), nullable=False)

    # Metric name (e.g., "avg_hba1c", "avg_bp_systolic", "complication_rate")
    metric_name = db.Column(db.String(100), nullable=False)

    # Metric value (stored as float for flexibility)
    metric_value = db.Column(db.Float, nullable=False)

    # Additional metric metadata
    # Example: {"unit": "mmol/L", "patient_count": 45, "std_dev": 1.2}
    metric_metadata = db.Column(JSONB, default=dict)

    # When this metric was recorded
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    cohort = db.relationship('PatientCohort', back_populates='outcomes')

    # Composite index for time-series queries
    __table_args__ = (
        db.Index('ix_cohort_outcomes_cohort_metric_time', 'cohort_id', 'metric_name', 'recorded_at'),
    )

    def __repr__(self):
        return f'<CohortOutcome {self.metric_name}={self.metric_value} for {self.cohort_id}>'

    def to_dict(self):
        """Convert outcome to dictionary."""
        return {
            'id': str(self.id),
            'cohort_id': str(self.cohort_id),
            'metric_name': self.metric_name,
            'metric_value': self.metric_value,
            'metric_metadata': self.metric_metadata,
            'recorded_at': self.recorded_at.isoformat()
        }
