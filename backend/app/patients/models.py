"""Patient model - Core healthcare entity."""
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db
from cryptography.fernet import Fernet
import os


class Patient(BaseModel):
    """
    Patient model for storing patient demographics and ABHA information.

    Compliant with ABDM standards and DPDPA 2023 requirements.
    Sensitive data (ABHA ID, contact) is encrypted at rest.
    """
    __tablename__ = 'patients'

    # UHID — system-generated business identifier (YYYY+ZZ+NNNN, e.g. 2026010001)
    # Generated only for Bangalore-resident patients with a geographic_cluster set.
    # Immutable by default; admins can regenerate via the dedicated route which logs
    # the change in uhid_history. UUID `id` remains the internal primary key.
    uhid = Column(String(20), unique=True, index=True, nullable=True)

    # Linked hospital — drives the displayed "Homecare UHID Code" prefix
    # (e.g. KMIO -> 'KAGBAKMIO'). Required via schema validator when
    # is_bangalore_resident=True. Value constrained to
    # app.patients.uhid_service.HOSPITAL_CATALOG keys. Editing this field
    # does NOT regenerate the UHID — only the displayed prefix updates.
    linked_hospital = Column(String(10), nullable=True)

    # Hospital UHID — ID issued by the external hospital (Kidwai/KCGH) and
    # copied from the patient's file. Free-form string; no format validation.
    hospital_uhid = Column(String(30), nullable=True)

    # ABDM Integration
    abha_id_encrypted = Column(Text, unique=True, index=True)  # Encrypted 14-digit ABHA ID
    abha_address = Column(String(255), unique=True, index=True)  # username@abdm format

    # Demographics
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    gender = Column(String(20))  # Male, Female, Other, Unknown
    family_chart = Column(JSONB, nullable=True)
    genogram = Column(JSONB, nullable=True)


    # Contact Information (Encrypted)
    contact_encrypted = Column(Text)  # Encrypted phone/email
    address_encrypted = Column(Text)  # Encrypted address

    # Alternative Phone (Caregiver/Backup)
    alternative_phone = Column(String(20), nullable=True)  # Backup phone number
    alternative_phone_name = Column(String(100), nullable=True)  # Name/relationship of phone owner

    # Care Circle — captured at Initial Assessment (baseline), separate from the
    # registration-time alternative_phone_* contact. Primary Caregiver is the
    # family member doing hands-on care; Decision Maker is the clinical
    # authority (treating physician / oncologist / palliative consultant).
    primary_caregiver_name = Column(String(100), nullable=True)
    primary_caregiver_relationship = Column(String(50), nullable=True)
    primary_caregiver_phone = Column(String(20), nullable=True)
    decision_maker_name = Column(String(100), nullable=True)
    decision_maker_designation = Column(String(50), nullable=True)
    decision_maker_phone = Column(String(20), nullable=True)

    # External System Integration
    source_system = Column(String(50), default='cv_raman', nullable=False)  # cv_raman, health_screening, etc
    external_id = Column(String(255))  # Original ID from external system
    external_metadata = Column(JSONB, default={})  # Additional external system data (camp_id, GPS coordinates, etc)

    # Bangalore Zone Clustering
    is_bangalore_resident = Column(Boolean, default=False, nullable=False)
    geographic_cluster = Column(String(20))  # North, South, East, West, Central

    # Diagnosis & Referral
    diagnosis = Column(String(100), nullable=True)  # Cancer type or other diagnosis
    referred_from = Column(String(100), nullable=True)  # Referral source
    is_approximate_dob = Column(Boolean, default=False)  # True if DOB was calculated from approximate age

    # ── Multi-tenant ownership (Hospital Portal Phase 1) ──────────────────────
    # The tenant org that entered/owns this patient → the isolation key. This is
    # a SEPARATE concept from linked_hospital (UHID prefix) and origin_* (referral
    # source). Added nullable, backfilled to the seed 'CVRAMAN' org, then set
    # NOT NULL in the same migration.
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.id'),
        nullable=True,
        index=True,
    )

    # ── Structured referral origin (upgrades free-text referred_from) ─────────
    # Where the patient was referred FROM. origin_type is required at intake in
    # the portal (kept nullable on the model for backward-compat / backfill).
    # Values: hospital | doctor | camp | self | ngo | govt_scheme | online | other
    origin_type = Column(String(20), nullable=True, index=True)
    # Referring hospital catalog code when origin_type='hospital'.
    origin_source_code = Column(String(10), nullable=True)
    # Set when the referrer is itself a tenant org.
    origin_organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.id'),
        nullable=True,
    )
    # Doctor/camp/NGO/scheme name (free text).
    origin_source_name = Column(String(150), nullable=True)
    origin_referral_date = Column(Date, nullable=True)
    origin_notes = Column(Text, nullable=True)

    # BSC Status (Best Supportive Care)
    bsc_status = Column(Boolean, nullable=True)  # True=BSC, False=N-BSC, None=Not Yet Determined
    is_onco = Column(Boolean, nullable=True)  # True=Oncology, False=Non-Oncology, None=Not Yet Determined
    # Derived priority bucket — AUTO-POPULATED from latest_pps_score via
    # app.patients.priority_service.sync_patient_priority_from_pps.
    # Mapping (meeting §2.1, 2026-04-14):
    #   PPS 0-40   → 'high'
    #   PPS 50-70  → 'medium'
    #   PPS 80-100 → 'low'
    # Values: high, medium, low, not_yet_determined — None until first PPS.
    clinical_complexity = Column(String(20), nullable=True)

    # Cached most-recent PPS score — kept in sync with pps_scores.pps_score on
    # every PPS save. Source of truth for the patient's "current functional
    # state" displayed on cards and the PpsCard component.
    latest_pps_score = Column(Integer, nullable=True)

    # DEPRECATED: no consumers in backend scheduler or frontend. Kept
    # nullable so existing data is preserved; do not reference going forward.
    patient_priority = Column(String(20), nullable=True)

    # Palliative outcome (set on the last visit form when the team learns of death)
    is_deceased = Column(Boolean, default=False, nullable=False, server_default='false', index=True)
    date_of_death = Column(Date, nullable=True, index=True)

    # Three-state patient status (meeting §3, 2026-04-14).
    # care_status is the clinical home-care state: 'active' (currently
    # receiving home care) vs 'inactive' (registered but not receiving care
    # — unwilling, paused, relocated). Orthogonal to is_deceased, but the
    # service auto-demotes care_status to 'inactive' when is_deceased=true.
    # Display logic combines them into: Alive & Active / Alive & Inactive / Deceased.
    care_status = Column(String(20), nullable=False, server_default='active', index=True)

    is_contacted = Column(Boolean, default=True, nullable=True)
    home_care_decline_reason = Column(String(100), nullable=True)

    # Place of Death — captured when marking deceased. Values:
    # 'home' | 'hospital' | 'on_the_way' | 'others'. When 'others',
    # place_of_death_remarks carries the free-text detail.
    place_of_death = Column(String(30), nullable=True)
    place_of_death_remarks = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    geographic_cluster = Column(String(100), index=True)

    # Custom registration date — user-entered date when the patient was
    # registered with the organization.  Distinct from the auto-generated
    # `created_at` timestamp which records when the DB row was inserted.
    registration_date = Column(Date, nullable=True)

    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    creator = db_relationship('User', foreign_keys=[created_by])
    encounters = db_relationship('Encounter', back_populates='patient', lazy='dynamic', cascade='all, delete-orphan')
    observations = db_relationship('Observation', back_populates='patient', lazy='dynamic', cascade='all, delete-orphan')
    diagnoses = db_relationship('Diagnosis', back_populates='patient', lazy='dynamic', cascade='all, delete-orphan')
    form_submissions = db_relationship('FormSubmission', back_populates='patient', lazy='dynamic')
    consent_artifacts = db_relationship('ConsentArtifact', back_populates='patient', lazy='dynamic', cascade='all, delete-orphan')

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
        f = Fernet(Patient._get_encryption_key())
        return f.encrypt(data.encode()).decode()

    @staticmethod
    def decrypt_data(encrypted_data):
        """Decrypt sensitive data."""
        if not encrypted_data:
            return None
        f = Fernet(Patient._get_encryption_key())
        return f.decrypt(encrypted_data.encode()).decode()

    def set_abha_id(self, abha_id):
        """Set encrypted ABHA ID."""
        self.abha_id_encrypted = self.encrypt_data(abha_id)

    def get_abha_id(self):
        """Get decrypted ABHA ID."""
        return self.decrypt_data(self.abha_id_encrypted)

    def set_contact(self, contact):
        """Set encrypted contact information."""
        self.contact_encrypted = self.encrypt_data(contact)

    def get_contact(self):
        """Get decrypted contact information."""
        return self.decrypt_data(self.contact_encrypted)

    def get_phone(self):
        """Extract phone number from contact (supports JSON, key-value, or plain string)."""
        import json as _json
        import re
        contact = self.get_contact()
        if not contact:
            return None
        # Try JSON: {"phone": "...", "email": "..."}
        try:
            data = _json.loads(contact)
            if isinstance(data, dict):
                return data.get('phone')
        except (ValueError, TypeError):
            pass
        # Try "Phone: +91xxx; Email: xxx" format
        phone_match = re.search(r'(?:phone|mobile|ph)[:\s]*([+\d\s\-]+)', contact, re.IGNORECASE)
        if phone_match:
            return phone_match.group(1).strip()
        # Plain phone number string
        digits = re.sub(r'[^\d+]', '', contact)
        if len(digits) >= 10 and '@' not in contact:
            return digits
        return None

    def get_email(self):
        """Extract email from contact (supports JSON, key-value, or plain string)."""
        import json as _json
        import re
        contact = self.get_contact()
        if not contact:
            return None
        # Try JSON: {"phone": "...", "email": "..."}
        try:
            data = _json.loads(contact)
            if isinstance(data, dict):
                return data.get('email')
        except (ValueError, TypeError):
            pass
        # Try "Email: xxx@yyy.com" format or extract email from mixed string
        email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', contact)
        if email_match:
            return email_match.group(0)
        return None

    def set_address(self, address):
        """Set encrypted address."""
        self.address_encrypted = self.encrypt_data(address)

    def get_address(self):
        """Get decrypted address."""
        return self.decrypt_data(self.address_encrypted)

    @classmethod
    def find_by_external_id(cls, source_system, external_id):
        """
        Find patient by external system ID.

        Args:
            source_system: The external system name (e.g., 'health_screening')
            external_id: The patient ID in the external system

        Returns:
            Patient object or None if not found
        """
        from app.extensions import db
        return db.session.query(cls).filter_by(
            source_system=source_system,
            external_id=str(external_id)
        ).first()

    def to_dict(self, include_sensitive=False):
        """
        Convert to dictionary.

        Args:
            include_sensitive: If True, include decrypted sensitive data
        """
        # Local import avoids a circular dep (uhid_service imports from db)
        from app.patients.uhid_service import get_homecare_code

        data = super().to_dict()
        data['uhid'] = self.uhid
        data['linked_hospital'] = self.linked_hospital
        data['homecare_code'] = get_homecare_code(self.linked_hospital)
        data['hospital_uhid'] = self.hospital_uhid
        data['full_name'] = self.full_name
        data['date_of_birth'] = self.date_of_birth.isoformat() if self.date_of_birth else None
        data['gender'] = self.gender
        data['educational_status'] = self.educational_status
        data['occupation'] = self.occupation
        data['religion'] = self.religion
        data['marital_status'] = self.marital_status
        data['preferred_language'] = self.preferred_language
        data['barriers_to_communication'] = self.barriers_to_communication
        data['no_of_children'] = self.no_of_children
        data['family_chart'] = self.family_chart
        data['genogram'] = self.genogram

        data['source_of_information'] = self.source_of_information
        data['abha_address'] = self.abha_address
        data['is_active'] = self.is_active
        data['source_system'] = self.source_system
        data['external_id'] = self.external_id
        data['external_metadata'] = self.external_metadata
        data['is_bangalore_resident'] = self.is_bangalore_resident
        data['geographic_cluster'] = self.geographic_cluster
        data['diagnosis'] = self.diagnosis
        data['referred_from'] = self.referred_from
        data['is_approximate_dob'] = self.is_approximate_dob
        # Multi-tenant ownership + structured referral origin (Hospital Portal P1)
        data['organization_id'] = str(self.organization_id) if self.organization_id else None
        data['origin_type'] = self.origin_type
        data['origin_source_code'] = self.origin_source_code
        data['origin_organization_id'] = str(self.origin_organization_id) if self.origin_organization_id else None
        data['origin_source_name'] = self.origin_source_name
        data['origin_referral_date'] = self.origin_referral_date.isoformat() if self.origin_referral_date else None
        data['origin_notes'] = self.origin_notes
        data['bsc_status'] = self.bsc_status
        data['is_onco'] = self.is_onco
        data['clinical_complexity'] = self.clinical_complexity
        data['latest_pps_score'] = self.latest_pps_score
        data['patient_priority'] = self.patient_priority
        # Best-reachable phone for clinical staff UI (e.g. teleconsult initiator).
        # Decrypts contact_encrypted; falls back to caregiver phone fields. Email
        # / ABHA / contact JSON stay sensitive — those are still gated behind
        # include_sensitive=True below.
        try:
            data['phone'] = (
                self.primary_caregiver_phone
                or self.get_phone()
                or self.decision_maker_phone
            )
        except Exception:
            data['phone'] = None
        data['alternative_phone'] = self.alternative_phone
        data['alternative_phone_name'] = self.alternative_phone_name
        data['primary_caregiver_name'] = self.primary_caregiver_name
        data['primary_caregiver_relationship'] = self.primary_caregiver_relationship
        data['primary_caregiver_phone'] = self.primary_caregiver_phone
        data['decision_maker_name'] = self.decision_maker_name
        data['decision_maker_designation'] = self.decision_maker_designation
        data['decision_maker_phone'] = self.decision_maker_phone
        data['is_deceased'] = self.is_deceased
        data['date_of_death'] = self.date_of_death.isoformat() if self.date_of_death else None
        data['care_status'] = self.care_status
        data['place_of_death'] = self.place_of_death
        data['place_of_death_remarks'] = self.place_of_death_remarks
        data['registration_date'] = self.registration_date.isoformat() if self.registration_date else None

        if include_sensitive:
            data['abha_id'] = self.get_abha_id()
            data['contact'] = self.get_contact()
            data['address'] = self.get_address()
        else:
            # Masked data for non-sensitive views
            abha_id = self.get_abha_id()
            if abha_id and len(abha_id) >= 4:
                data['abha_id_masked'] = f"XX-XXXX-XXXX-{abha_id[-4:]}"
            else:
                data['abha_id_masked'] = None

        return data

    @property
    def educational_status(self):
        return (self.external_metadata or {}).get('educational_status')

    @educational_status.setter
    def educational_status(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['educational_status'] = value
        self.external_metadata = meta

    @property
    def occupation(self):
        return (self.external_metadata or {}).get('occupation')

    @occupation.setter
    def occupation(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['occupation'] = value
        self.external_metadata = meta

    @property
    def religion(self):
        return (self.external_metadata or {}).get('religion')

    @religion.setter
    def religion(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['religion'] = value
        self.external_metadata = meta

    @property
    def marital_status(self):
        return (self.external_metadata or {}).get('marital_status')

    @marital_status.setter
    def marital_status(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['marital_status'] = value
        self.external_metadata = meta

    @property
    def preferred_language(self):
        return (self.external_metadata or {}).get('preferred_language')

    @preferred_language.setter
    def preferred_language(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['preferred_language'] = value
        self.external_metadata = meta

    @property
    def barriers_to_communication(self):
        return (self.external_metadata or {}).get('barriers_to_communication')

    @barriers_to_communication.setter
    def barriers_to_communication(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['barriers_to_communication'] = value
        self.external_metadata = meta

    @property
    def no_of_children(self):
        val = (self.external_metadata or {}).get('no_of_children')
        return int(val) if val is not None else None

    @no_of_children.setter
    def no_of_children(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['no_of_children'] = int(value) if value is not None else None
        self.external_metadata = meta

    @property
    def source_of_information(self):
        return (self.external_metadata or {}).get('source_of_information')

    @source_of_information.setter
    def source_of_information(self, value):
        if self.external_metadata is None:
            self.external_metadata = {}
        meta = dict(self.external_metadata)
        meta['source_of_information'] = value
        self.external_metadata = meta

    def __repr__(self):
        return f'<Patient {self.full_name} ({self.abha_address or "No ABHA"})>'


class PatientCaregiver(BaseModel):
    """
    Patient Caregiver model for managing family members and authorized caregivers.

    Enables family members, guardians, or designated caregivers to:
    - Book appointments on behalf of patients
    - View patient medical data (with appropriate consent)
    - Manage patient healthcare activities

    Compliant with DPDPA 2023 consent and authorization requirements.
    """
    __tablename__ = 'patient_caregivers'

    # Patient Reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Caregiver User Reference
    caregiver_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    # Relationship Type
    relationship = Column(String(50), nullable=False)  # parent, spouse, guardian, sibling, child, professional_caregiver, other

    # Permissions
    can_book_appointments = Column(Boolean, default=True, nullable=False)
    can_view_medical_data = Column(Boolean, default=False, nullable=False)
    can_update_patient_info = Column(Boolean, default=False, nullable=False)
    can_access_reports = Column(Boolean, default=False, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_primary_caregiver = Column(Boolean, default=False, nullable=False)  # Primary contact person

    # Consent and Authorization
    authorization_document = Column(Text)  # File path or document reference
    consent_given_at = Column(Date)  # Date when patient gave consent
    consent_expires_at = Column(Date)  # Optional expiry date for caregiver access

    # Emergency Contact
    is_emergency_contact = Column(Boolean, default=False, nullable=False)

    # Notes
    notes = Column(Text)  # Additional information, special instructions

    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    patient = db_relationship('Patient', backref='caregivers')
    caregiver_user = db_relationship('User', foreign_keys=[caregiver_user_id], backref='patient_care_relationships')
    creator = db_relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['caregiver_user_id'] = str(self.caregiver_user_id)
        data['relationship'] = self.relationship
        data['can_book_appointments'] = self.can_book_appointments
        data['can_view_medical_data'] = self.can_view_medical_data
        data['can_update_patient_info'] = self.can_update_patient_info
        data['can_access_reports'] = self.can_access_reports
        data['is_active'] = self.is_active
        data['is_primary_caregiver'] = self.is_primary_caregiver
        data['authorization_document'] = self.authorization_document
        data['consent_given_at'] = self.consent_given_at.isoformat() if self.consent_given_at else None
        data['consent_expires_at'] = self.consent_expires_at.isoformat() if self.consent_expires_at else None
        data['is_emergency_contact'] = self.is_emergency_contact
        data['notes'] = self.notes

        # Include related names if loaded
        if self.patient:
            data['patient_name'] = self.patient.full_name
        if self.caregiver_user:
            data['caregiver_name'] = self.caregiver_user.full_name
            data['caregiver_email'] = self.caregiver_user.email

        return data

    def __repr__(self):
        return f'<PatientCaregiver {self.relationship} for Patient {self.patient_id}>'


class RecentPatient(db.Model):
    """
    Track recently accessed patients for quick access.

    Maintains a history of which patients each user has recently viewed,
    enabling the "Recently Accessed" feature in the patient selector UI.

    Note: Inherits from db.Model (not BaseModel) to avoid extra id/timestamp columns.
    Uses composite primary key (user_id, patient_id).
    """
    __tablename__ = 'recent_patients'

    # Composite Primary Key
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'),
                     primary_key=True, nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'),
                        primary_key=True, nullable=False)

    # Tracking Information
    last_accessed = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    access_count = Column(Integer, server_default='1', nullable=False)

    # Relationships
    user = db_relationship('User', backref='recent_patients')
    patient = db_relationship('Patient', backref='recent_accesses')

    def to_dict(self):
        """Convert to dictionary."""
        # Note: We exclude BaseModel's default fields (id, created_at, updated_at)
        # since this table uses a composite primary key
        return {
            'user_id': str(self.user_id),
            'patient_id': str(self.patient_id),
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'access_count': self.access_count
        }

    def __repr__(self):
        return f'<RecentPatient user={self.user_id} patient={self.patient_id} count={self.access_count}>'


class UhidCounter(BaseModel):
    """
    Atomic per-(year, zone) sequence tracker for UHID generation.

    Each row represents one (year, zone) bucket with its current last_sequence.
    UHID generation uses an INSERT...ON CONFLICT...DO UPDATE...RETURNING upsert
    on this table — single statement, atomic, no SELECT-then-INSERT race.
    Burned sequence numbers (e.g. from admin regeneration) are never reused —
    the counter only ever increments forward.
    """
    __tablename__ = 'uhid_counters'

    year = Column(Integer, nullable=False)
    zone_code = Column(String(2), nullable=False)
    last_sequence = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint('year', 'zone_code', name='uq_uhid_counter_year_zone'),
    )

    def __repr__(self):
        return f'<UhidCounter {self.year}/{self.zone_code} seq={self.last_sequence}>'


class UhidHistory(BaseModel):
    """
    Audit trail for admin UHID regenerations.

    Each row records the moment an admin replaced a patient's UHID. Allows
    finding patients by their old UHID (search joins this table) and provides
    a queryable history of who changed what and why.
    """
    __tablename__ = 'uhid_history'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    old_uhid = Column(String(20), nullable=False, index=True)
    new_uhid = Column(String(20), nullable=True)
    replaced_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    replaced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reason = Column(Text, nullable=True)

    # Relationships
    patient = db_relationship('Patient', backref='uhid_history')

    def to_dict(self):
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['replaced_by'] = str(self.replaced_by) if self.replaced_by else None
        data['replaced_at'] = self.replaced_at.isoformat() if self.replaced_at else None
        return data

    def __repr__(self):
        return f'<UhidHistory patient={self.patient_id} {self.old_uhid}->{self.new_uhid}>'
