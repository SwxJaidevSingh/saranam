"""
Service models for healthcare services management
"""

from sqlalchemy import Column, String, Text, Boolean, Integer, Time, DateTime, ForeignKey, Enum as SQLEnum, Index, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.common.models import BaseModel


class ServiceType(enum.Enum):
    """Types of healthcare services offered"""
    IPD = "IPD"  # In-Patient Department
    OPD = "OPD"  # Out-Patient Department
    PHYSIOTHERAPY = "PHYSIOTHERAPY"
    HOME_CARE = "HOME_CARE"


class ServiceStatus(enum.Enum):
    """Status of a service booking"""
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class FormType(enum.Enum):
    """Types of forms associated with services"""
    INITIAL = "INITIAL"
    FOLLOW_UP = "FOLLOW_UP"
    DISCHARGE = "DISCHARGE"
    ASSESSMENT = "ASSESSMENT"
    PROGRESS_NOTE = "PROGRESS_NOTE"
    DAILY_REPORT = "DAILY_REPORT"


class Service(BaseModel):
    """Healthcare service entity"""
    __tablename__ = 'services'

    # Basic Information
    name = Column(String(255), nullable=False)
    service_type = Column(SQLEnum(ServiceType), nullable=False, index=True)
    description = Column(Text)
    department = Column(String(100))

    # Service Configuration
    is_active = Column(Boolean, default=True, nullable=False)
    requires_admission = Column(Boolean, default=False, nullable=False)  # True for IPD
    requires_referral = Column(Boolean, default=False)
    default_duration_minutes = Column(Integer, default=30)
    max_daily_capacity = Column(Integer)  # Max bookings per day

    # Cost Information
    base_cost = Column(DECIMAL(10, 2))
    cost_currency = Column(String(3), default='INR')

    # Form Templates
    default_form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='SET NULL'))
    intake_form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='SET NULL'))
    discharge_form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='SET NULL'))

    # Service-specific settings (JSON for flexibility)
    settings = Column(JSONB, default={})
    # Example settings:
    # {
    #   "requires_equipment": ["wheelchair", "oxygen"],
    #   "min_staff_required": 2,
    #   "allows_emergency": true,
    #   "follow_up_days": 7,
    #   "requires_consent": true
    # }

    # Relationships
    providers = relationship("ServiceProvider", back_populates="service", cascade="all, delete-orphan")
    schedules = relationship("ServiceSchedule", back_populates="service", cascade="all, delete-orphan")
    service_forms = relationship("ServiceForm", back_populates="service", cascade="all, delete-orphan")
    encounters = relationship("Encounter", back_populates="service", foreign_keys="[Encounter.service_id]")

    # Indexes
    __table_args__ = (
        Index('idx_service_type_active', 'service_type', 'is_active'),
        Index('idx_service_department', 'department'),
    )

    def to_dict(self, include_relationships=False):
        """Convert to dictionary"""
        data = super().to_dict()
        data.update({
            'name': self.name,
            'service_type': self.service_type.value if self.service_type else None,
            'description': self.description,
            'department': self.department,
            'is_active': self.is_active,
            'requires_admission': self.requires_admission,
            'requires_referral': self.requires_referral,
            'default_duration_minutes': self.default_duration_minutes,
            'max_daily_capacity': self.max_daily_capacity,
            'base_cost': float(self.base_cost) if self.base_cost else None,
            'cost_currency': self.cost_currency,
            'default_form_id': str(self.default_form_id) if self.default_form_id else None,
            'intake_form_id': str(self.intake_form_id) if self.intake_form_id else None,
            'discharge_form_id': str(self.discharge_form_id) if self.discharge_form_id else None,
            'settings': self.settings or {}
        })

        if include_relationships:
            data['providers'] = [sp.to_dict() for sp in self.providers if sp.is_active]
            data['schedules'] = [s.to_dict() for s in self.schedules if s.is_active]
            data['forms'] = [sf.to_dict() for sf in self.service_forms]

        return data


class ServiceProvider(BaseModel):
    """Mapping between services and healthcare providers"""
    __tablename__ = 'service_providers'

    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id', ondelete='CASCADE'), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id', ondelete='CASCADE'), nullable=False)

    is_primary = Column(Boolean, default=False)  # Primary provider for the service
    is_active = Column(Boolean, default=True)

    # Provider-specific service settings
    settings = Column(JSONB, default={})
    # Example: {"preferred_slots": ["morning"], "max_patients_per_day": 20}

    # Relationships
    service = relationship("Service", back_populates="providers")
    provider = relationship("HealthcareProvider", backref="service_assignments")

    # Indexes
    __table_args__ = (
        Index('idx_service_provider', 'service_id', 'provider_id', unique=True),
        Index('idx_provider_active', 'provider_id', 'is_active'),
    )

    def to_dict(self):
        """Convert to dictionary"""
        data = super().to_dict()
        data.update({
            'service_id': str(self.service_id) if self.service_id else None,
            'provider_id': str(self.provider_id) if self.provider_id else None,
            'is_primary': self.is_primary,
            'is_active': self.is_active,
            'settings': self.settings or {}
        })

        # Include provider details if relationship is loaded
        if hasattr(self, 'provider') and self.provider:
            data['provider'] = {
                'id': str(self.provider.id),
                'full_name': self.provider.full_name,
                'specialization': self.provider.specialization,
                'department': self.provider.department
            }

        return data


class ServiceSchedule(BaseModel):
    """Service availability schedule"""
    __tablename__ = 'service_schedules'

    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id', ondelete='CASCADE'), nullable=False)

    # Schedule details (similar to provider schedules)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    # Capacity management
    max_capacity = Column(Integer, default=10)  # Max bookings for this time slot
    buffer_minutes = Column(Integer, default=0)  # Buffer between appointments

    # Break times (JSON array of time ranges)
    break_times = Column(JSONB, default=[])
    # Example: [{"start": "12:00", "end": "13:00"}]

    is_active = Column(Boolean, default=True)

    # Special schedule (for holidays, special events)
    effective_from = Column(DateTime)
    effective_until = Column(DateTime)

    # Relationships
    service = relationship("Service", back_populates="schedules")

    # Indexes
    __table_args__ = (
        Index('idx_service_schedule', 'service_id', 'day_of_week'),
        Index('idx_schedule_active', 'service_id', 'is_active'),
    )

    def to_dict(self):
        """Convert to dictionary"""
        data = super().to_dict()
        data.update({
            'service_id': str(self.service_id) if self.service_id else None,
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'max_capacity': self.max_capacity,
            'buffer_minutes': self.buffer_minutes,
            'break_times': self.break_times or [],
            'is_active': self.is_active,
            'effective_from': self.effective_from.isoformat() if self.effective_from else None,
            'effective_until': self.effective_until.isoformat() if self.effective_until else None
        })
        return data


class ServiceForm(BaseModel):
    """Mapping between services and forms"""
    __tablename__ = 'service_forms'

    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id', ondelete='CASCADE'), nullable=False)
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False)

    form_type = Column(SQLEnum(FormType), nullable=False)
    is_mandatory = Column(Boolean, default=False)
    sequence_order = Column(Integer, default=0)  # Order in which forms should be filled

    # Conditional settings (when this form should be used)
    conditions = Column(JSONB, default={})
    # Example: {"patient_age_min": 18, "service_status": "IN_PROGRESS"}

    # Relationships
    service = relationship("Service", back_populates="service_forms")
    form = relationship("Form", backref="service_assignments")

    # Indexes
    __table_args__ = (
        Index('idx_service_form', 'service_id', 'form_id', unique=True),
        Index('idx_service_form_type', 'service_id', 'form_type'),
    )

    def to_dict(self):
        """Convert to dictionary"""
        data = super().to_dict()
        data.update({
            'service_id': str(self.service_id) if self.service_id else None,
            'form_id': str(self.form_id) if self.form_id else None,
            'form_type': self.form_type.value if self.form_type else None,
            'is_mandatory': self.is_mandatory,
            'sequence_order': self.sequence_order,
            'conditions': self.conditions or {}
        })

        # Include form details if relationship is loaded
        if hasattr(self, 'form') and self.form:
            data['form'] = {
                'id': str(self.form.id),
                'name': self.form.name,
                'description': self.form.description,
                'version': self.form.version
            }

        return data