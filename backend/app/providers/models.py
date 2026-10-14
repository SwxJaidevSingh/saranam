"""Healthcare Provider models - doctors, nurses, therapists, and their schedules."""
from sqlalchemy import Column, String, Text, Integer, Time, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from cryptography.fernet import Fernet
import os


class HealthcareProvider(BaseModel):
    """
    Healthcare Provider model for doctors, nurses, therapists, and other healthcare professionals.

    ABDM-compliant with HPR (Healthcare Professional Registry) integration.
    Sensitive contact data is encrypted at rest.
    """
    __tablename__ = 'healthcare_providers'

    # ABDM Integration
    hpr_id = Column(String(100), unique=True, index=True)  # Healthcare Professional Registry ID

    # Link to User (optional - provider may or may not have login)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), unique=True, index=True)

    # Basic Information
    full_name = Column(String(255), nullable=False, index=True)
    email_encrypted = Column(Text)  # Encrypted email
    phone_encrypted = Column(Text)  # Encrypted phone

    # Professional Details
    specialization = Column(String(100), index=True)  # Cardiology, Pediatrics, General Medicine, etc.
    department = Column(String(100), index=True)  # Emergency, OPD, ICU, etc.
    license_number = Column(String(100), unique=True)  # Medical license/registration number
    qualification = Column(String(255))  # MBBS, MD, etc.
    designation = Column(String(100))  # e.g., Senior Consultant, HOD
    signature_image = Column(Text)  # Base64-encoded signature image for prescription PDF

    # Facility Information
    facility_hfr_id = Column(String(100), index=True)  # Healthcare Facility Registry ID (primary facility)

    # Professional Bio
    bio = Column(Text)  # Professional background, expertise
    years_of_experience = Column(Integer)

    # Consultation Settings
    default_consultation_duration = Column(Integer, default=30)  # Default appointment duration in minutes
    accepts_new_patients = Column(Boolean, default=True, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Bulk Import Support
    is_placeholder = Column(Boolean, default=False, nullable=False)  # True for "Unknown Provider" placeholder
    created_from_bulk_import = Column(Boolean, default=False, nullable=False)  # True if created via bulk import
    bulk_import_session_id = Column(UUID(as_uuid=True), ForeignKey('bulk_import_sessions.id'))  # Session that created this provider

    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    user = relationship('User', foreign_keys=[user_id], backref='provider_profile')
    creator = relationship('User', foreign_keys=[created_by])
    schedules = relationship('ProviderSchedule', back_populates='provider', lazy='dynamic', cascade='all, delete-orphan')
    # Note: appointments relationship will be added when Encounter is extended

    @staticmethod
    def _get_encryption_key():
        """Get encryption key from environment."""
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not set in environment")
        return key.encode()

    @staticmethod
    def encrypt_data(data):
        """Encrypt sensitive data."""
        if not data:
            return None
        f = Fernet(HealthcareProvider._get_encryption_key())
        return f.encrypt(data.encode()).decode()

    @staticmethod
    def decrypt_data(encrypted_data):
        """Decrypt sensitive data."""
        if not encrypted_data:
            return None
        f = Fernet(HealthcareProvider._get_encryption_key())
        return f.decrypt(encrypted_data.encode()).decode()

    def set_email(self, email):
        """Set encrypted email."""
        self.email_encrypted = self.encrypt_data(email)

    def get_email(self):
        """Get decrypted email."""
        return self.decrypt_data(self.email_encrypted)

    def set_phone(self, phone):
        """Set encrypted phone."""
        self.phone_encrypted = self.encrypt_data(phone)

    def get_phone(self):
        """Get decrypted phone."""
        return self.decrypt_data(self.phone_encrypted)

    def to_dict(self, include_sensitive=False):
        """
        Convert to dictionary.

        Args:
            include_sensitive: If True, include decrypted sensitive data
        """
        data = super().to_dict()
        data['hpr_id'] = self.hpr_id
        data['user_id'] = str(self.user_id) if self.user_id else None
        data['full_name'] = self.full_name
        data['specialization'] = self.specialization
        data['department'] = self.department
        data['license_number'] = self.license_number
        data['qualification'] = self.qualification
        data['designation'] = self.designation
        data['signature_image'] = self.signature_image
        data['facility_hfr_id'] = self.facility_hfr_id
        data['bio'] = self.bio
        data['years_of_experience'] = self.years_of_experience
        data['default_consultation_duration'] = self.default_consultation_duration
        data['accepts_new_patients'] = self.accepts_new_patients
        data['is_active'] = self.is_active
        data['is_placeholder'] = self.is_placeholder
        data['created_from_bulk_import'] = self.created_from_bulk_import
        data['bulk_import_session_id'] = str(self.bulk_import_session_id) if self.bulk_import_session_id else None

        if include_sensitive:
            data['email'] = self.get_email()
            data['phone'] = self.get_phone()
        else:
            # Masked data for non-sensitive views
            phone = self.get_phone()
            if phone and len(phone) >= 4:
                data['phone_masked'] = f"****{phone[-4:]}"
            else:
                data['phone_masked'] = None

        return data

    def __repr__(self):
        return f'<HealthcareProvider {self.full_name} - {self.specialization or "General"}>'


class ProviderSchedule(BaseModel):
    """
    Provider Schedule model for managing healthcare provider availability.

    Defines weekly recurring schedule with working hours and appointment slot configuration.
    """
    __tablename__ = 'provider_schedules'

    # Provider Reference
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id', ondelete='CASCADE'), nullable=False, index=True)

    # Schedule Details
    day_of_week = Column(Integer, nullable=False, index=True)  # 0=Monday, 1=Tuesday, ..., 6=Sunday
    start_time = Column(Time, nullable=False)  # Work start time (e.g., 09:00:00)
    end_time = Column(Time, nullable=False)  # Work end time (e.g., 17:00:00)

    # Appointment Configuration
    slot_duration = Column(Integer, default=30, nullable=False)  # Duration of each appointment slot in minutes (15, 30, 60, etc.)
    max_appointments_per_slot = Column(Integer, default=1, nullable=False)  # For group sessions or multiple patients per slot

    # Break Times (stored as JSON in future if needed, for now use simple approach)
    break_start_time = Column(Time)  # Optional lunch/break start
    break_end_time = Column(Time)  # Optional lunch/break end

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Special Notes
    notes = Column(Text)  # e.g., "Surgery day - limited appointments"

    # Relationships
    provider = relationship('HealthcareProvider', back_populates='schedules')

    # Unique constraint: one schedule per provider per day of week
    __table_args__ = (
        UniqueConstraint('provider_id', 'day_of_week', name='uq_provider_day'),
    )

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['provider_id'] = str(self.provider_id)
        data['day_of_week'] = self.day_of_week
        data['day_name'] = self.get_day_name()
        data['start_time'] = self.start_time.isoformat() if self.start_time else None
        data['end_time'] = self.end_time.isoformat() if self.end_time else None
        data['slot_duration'] = self.slot_duration
        data['max_appointments_per_slot'] = self.max_appointments_per_slot
        data['break_start_time'] = self.break_start_time.isoformat() if self.break_start_time else None
        data['break_end_time'] = self.break_end_time.isoformat() if self.break_end_time else None
        data['is_active'] = self.is_active
        data['notes'] = self.notes

        # Include provider name if loaded
        if self.provider:
            data['provider_name'] = self.provider.full_name

        return data

    def get_day_name(self):
        """Get human-readable day name."""
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return days[self.day_of_week] if 0 <= self.day_of_week <= 6 else 'Unknown'

    def __repr__(self):
        return f'<ProviderSchedule {self.get_day_name()} {self.start_time}-{self.end_time}>'


class ProviderSpecialization(BaseModel):
    """
    Provider Specialization options.
    Stores both predefined and custom specializations.
    """
    __tablename__ = 'provider_specializations'

    name = Column(String(100), unique=True, nullable=False, index=True)
    is_predefined = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    creator = relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['name'] = self.name
        data['is_predefined'] = self.is_predefined
        data['is_active'] = self.is_active
        data['created_by'] = str(self.created_by) if self.created_by else None
        return data

    def __repr__(self):
        return f'<ProviderSpecialization {self.name}>'


class ProviderDepartment(BaseModel):
    """
    Provider Department options.
    Stores both predefined and custom departments.
    """
    __tablename__ = 'provider_departments'

    name = Column(String(100), unique=True, nullable=False, index=True)
    is_predefined = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    creator = relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['name'] = self.name
        data['is_predefined'] = self.is_predefined
        data['is_active'] = self.is_active
        data['created_by'] = str(self.created_by) if self.created_by else None
        return data

    def __repr__(self):
        return f'<ProviderDepartment {self.name}>'
