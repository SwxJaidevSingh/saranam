"""
Patient Schemas for Data Validation
Pydantic schemas for patient creation, update, and response
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
import re


class PatientCreateSchema(BaseModel):
    """Schema for creating a new patient"""
    full_name: str = Field(..., min_length=2, max_length=255, description="Patient's full name")
    date_of_birth: Optional[date] = Field(None, description="Patient's date of birth")
    gender: Optional[str] = Field(None, description="Patient's gender")
    phone_number: Optional[str] = Field(None, description="Contact phone number")
    email: Optional[str] = Field(None, description="Email address")
    address_line1: Optional[str] = Field(None, max_length=500, description="Address line 1")
    address_line2: Optional[str] = Field(None, max_length=500, description="Address line 2")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State/Province")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal/ZIP code")
    country: str = Field(default="India", max_length=100, description="Country")
    abha_id: Optional[str] = Field(None, description="ABHA ID (14 digits)")
    abha_address: Optional[str] = Field(None, description="ABHA Address (username@abdm)")
    emergency_contact_name: Optional[str] = Field(None, max_length=255, description="Emergency contact name")
    emergency_contact_phone: Optional[str] = Field(None, description="Emergency contact phone")
    blood_group: Optional[str] = Field(None, max_length=10, description="Blood group (A+, B-, etc.)")
    allergies: Optional[str] = Field(None, description="Known allergies")
    chronic_conditions: Optional[str] = Field(None, description="Chronic medical conditions")
    current_medications: Optional[str] = Field(None, description="Current medications")
    insurance_provider: Optional[str] = Field(None, max_length=255, description="Insurance provider")
    insurance_policy_number: Optional[str] = Field(None, description="Insurance policy number")
    preferred_language: Optional[str] = Field(None, max_length=50, description="Preferred language")
    educational_status: Optional[str] = Field(None, max_length=100, description="Educational status")
    occupation: Optional[str] = Field(None, max_length=100, description="Occupation")
    religion: Optional[str] = Field(None, max_length=50, description="Religion")
    marital_status: Optional[str] = Field(None, max_length=50, description="Marital status")
    barriers_to_communication: Optional[str] = Field(None, max_length=255, description="Any barriers to communication")
    no_of_children: Optional[int] = Field(None, ge=0, description="Number of children")
    source_of_information: Optional[str] = Field(None, max_length=255, description="Source of information")
    notes: Optional[str] = Field(None, description="Additional notes")
    external_metadata: Optional[dict] = Field(None, description="External metadata (lat/lng, etc.)")
    ignore_duplicate: Optional[bool] = Field(default=False, description="Whether to ignore duplicate check during patient creation")

    # Family Chart — list of family-member rows (the UI sends an array), stored as JSON
    family_chart: Optional[list] = Field(None, description="Family chart rows (genogram)")
    genogram: Optional[dict] = Field(None, description="Genogram layout and relationships")


    # Diagnosis & Referral
    diagnosis: Optional[str] = Field(None, max_length=100, description="Primary diagnosis")
    referred_from: Optional[str] = Field(None, max_length=100, description="Referral source")
    is_approximate_dob: bool = Field(default=False, description="Whether DOB was estimated from approximate age")

    # Bangalore Zone Clustering
    is_bangalore_resident: bool = Field(default=False, description="Whether patient resides in Bangalore")
    geographic_cluster: Optional[str] = Field(None, description="Bangalore zone: North, South, East, West, Central")

    # Linked hospital (drives the Homecare UHID Code display prefix)
    # Required for Bangalore-resident patients. Values: KMIO, KCGH, SWON.
    linked_hospital: Optional[str] = Field(None, description="Linked hospital code: KMIO, KCGH, SWON")

    # Hospital UHID — free-form ID issued by the external hospital (Kidwai/KCGH)
    hospital_uhid: Optional[str] = Field(None, max_length=30, description="Hospital-issued UHID (copied from patient's hospital file)")

    # BSC Status & Onco — None = Not Yet Determined
    bsc_status: Optional[bool] = Field(default=None, description="Best Supportive Care status (True=BSC, False=N-BSC, None=Not Yet Determined)")
    is_onco: Optional[bool] = Field(default=None, description="Oncology status (True=Onco, False=Non-Onco, None=Not Yet Determined)")
    clinical_complexity: Optional[str] = Field(default=None, description="Clinical complexity: high, medium, low, not_yet_determined")
    patient_priority: Optional[str] = Field(default=None, description="Patient priority: ultra_high, high, medium, low")

    # Alternative Phone (Caregiver/Backup)
    alternative_phone: Optional[str] = Field(None, description="Alternative/backup phone number")
    alternative_phone_name: Optional[str] = Field(None, max_length=100, description="Name/relationship of alternative phone owner")

    # Care Circle — captured at Initial Assessment (baseline)
    primary_caregiver_name: Optional[str] = Field(None, max_length=100)
    primary_caregiver_relationship: Optional[str] = Field(None, max_length=50)
    primary_caregiver_phone: Optional[str] = Field(None, max_length=20)
    decision_maker_name: Optional[str] = Field(None, max_length=100)
    decision_maker_designation: Optional[str] = Field(None, max_length=50)
    decision_maker_phone: Optional[str] = Field(None, max_length=20)

    # Custom registration date (user-entered, distinct from system created_at)
    registration_date: Optional[date] = Field(None, description="User-entered registration date")

    # Three-state patient status (§3, 2026-04-14)
    care_status: Optional[str] = Field(None, description="Home-care state: active | inactive")
    place_of_death: Optional[str] = Field(None, description="home | hospital | on_the_way | others")
    place_of_death_remarks: Optional[str] = Field(None, max_length=500)
    is_contacted: Optional[bool] = Field(default=None, description="Whether the patient/family was contacted")
    home_care_decline_reason: Optional[str] = Field(None, max_length=100, description="Reason for home care decline")

    @field_validator('alternative_phone')
    @classmethod
    def validate_alternative_phone(cls, v):
        if not v:
            return None
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^(\+?\d{1,4})?\d{7,15}$', cleaned):
            raise ValueError('Invalid alternative phone number format')
        return cleaned

    @field_validator('geographic_cluster')
    @classmethod
    def validate_geographic_cluster(cls, v):
        if not v:
            return None
        # Single source of truth: ZONE_CODES from uhid_service
        from app.patients.uhid_service import VALID_ZONE_NAMES
        if v not in VALID_ZONE_NAMES:
            raise ValueError(f'Geographic cluster must be one of: {", ".join(VALID_ZONE_NAMES)}')
        return v

    @field_validator('clinical_complexity')
    @classmethod
    def validate_clinical_complexity(cls, v):
        # Treat empty string / whitespace the same as None so a stray blank
        # from any caller (legacy form, PATCH, external API, bulk import)
        # can't trigger a 400 validation error for a field that's genuinely
        # optional. Matches the semantics of `patient_priority` validator above.
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        valid_levels = ['high', 'medium', 'low', 'not_yet_determined']
        if v not in valid_levels:
            raise ValueError(f'Clinical complexity must be one of: {", ".join(valid_levels)}')
        return v

    @field_validator('patient_priority')
    @classmethod
    def validate_patient_priority(cls, v):
        if v is None:
            return None
        valid_levels = ['not_yet_determined', 'high', 'medium', 'low']
        if v not in valid_levels:
            raise ValueError(f'Patient priority must be one of: {", ".join(valid_levels)}')
        return v

    @field_validator('care_status')
    @classmethod
    def validate_care_status(cls, v):
        if v is None or v == '':
            return None
        valid = ['active', 'inactive']
        if v not in valid:
            raise ValueError(f'care_status must be one of: {", ".join(valid)}')
        return v

    @field_validator('place_of_death')
    @classmethod
    def validate_place_of_death(cls, v):
        if v is None or v == '':
            return None
        valid = ['home', 'hospital', 'on_the_way', 'others']
        if v not in valid:
            raise ValueError(f'place_of_death must be one of: {", ".join(valid)}')
        return v

    @field_validator('registration_date', mode='before')
    @classmethod
    def validate_registration_date(cls, v):
        if not v:
            return None
        if isinstance(v, str):
            try:
                v = date.fromisoformat(v)
            except ValueError:
                raise ValueError('Invalid registration date format. Use YYYY-MM-DD')
        if v > date.today():
            raise ValueError('Registration date cannot be in the future')
        return v

    @field_validator('date_of_birth', mode='before')
    @classmethod
    def validate_date_of_birth(cls, v):
        if not v:
            return None
        if isinstance(v, str):
            try:
                v = date.fromisoformat(v)
            except ValueError:
                raise ValueError('Invalid date format. Use YYYY-MM-DD')
        if v > date.today():
            raise ValueError('Date of birth cannot be in the future')
        age = (date.today() - v).days / 365.25
        if age > 150:
            raise ValueError('Age cannot be more than 150 years')
        if age < 0:
            raise ValueError('Invalid date of birth')
        return v

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v):
        if not v:
            return None
        valid_genders = ['Male', 'Female', 'Other', 'Prefer not to say']
        if v not in valid_genders:
            raise ValueError(f'Gender must be one of: {", ".join(valid_genders)}')
        return v

    @field_validator('phone_number', 'emergency_contact_phone')
    @classmethod
    def validate_phone(cls, v):
        if not v:
            return None
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        # Check if it's a valid format (allowing various international formats)
        if not re.match(r'^(\+?\d{1,4})?\d{7,15}$', cleaned):
            raise ValueError('Invalid phone number format. Examples: +919876543210, 9876543210')
        return cleaned

    @field_validator('abha_id')
    @classmethod
    def validate_abha_id(cls, v):
        if not v:
            return None
        # ABHA ID should be 14 digits
        cleaned = re.sub(r'[\s\-]', '', v)
        if not re.match(r'^\d{14}$', cleaned):
            raise ValueError('ABHA ID must be 14 digits')
        return cleaned

    @field_validator('abha_address')
    @classmethod
    def validate_abha_address(cls, v):
        if not v:
            return None
        # ABHA Address format: username@abdm or username@sbx
        if not re.match(r'^[a-zA-Z0-9._-]+@(abdm|sbx)$', v):
            raise ValueError('ABHA Address must be in format: username@abdm')
        return v

    @field_validator('blood_group')
    @classmethod
    def validate_blood_group(cls, v):
        if not v:
            return None
        valid_groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
        if v not in valid_groups:
            raise ValueError(f'Blood group must be one of: {", ".join(valid_groups)}')
        return v

    @model_validator(mode='after')
    def validate_linked_hospital(self):
        # Live lookup — the hospital catalog is DB-backed and editable.
        from app.patients.uhid_service import get_valid_hospital_codes
        if self.is_bangalore_resident and not self.linked_hospital:
            raise ValueError('linked_hospital is required for Bangalore-resident patients')
        if self.linked_hospital:
            valid_codes = get_valid_hospital_codes()
            if self.linked_hospital not in valid_codes:
                raise ValueError(
                    f'linked_hospital must be one of: {", ".join(valid_codes)}'
                )
        return self

    class Config:
        from_attributes = True


class PatientUpdateSchema(BaseModel):
    """Schema for updating a patient (all fields optional)"""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    address_line1: Optional[str] = Field(None, max_length=500)
    address_line2: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    abha_id: Optional[str] = None
    abha_address: Optional[str] = None
    emergency_contact_name: Optional[str] = Field(None, max_length=255)
    emergency_contact_phone: Optional[str] = None
    blood_group: Optional[str] = Field(None, max_length=10)
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    insurance_provider: Optional[str] = Field(None, max_length=255)
    insurance_policy_number: Optional[str] = None
    preferred_language: Optional[str] = Field(None, max_length=50)
    educational_status: Optional[str] = Field(None, max_length=100)
    occupation: Optional[str] = Field(None, max_length=100)
    religion: Optional[str] = Field(None, max_length=50)
    marital_status: Optional[str] = Field(None, max_length=50)
    barriers_to_communication: Optional[str] = Field(None, max_length=255)
    no_of_children: Optional[int] = Field(None, ge=0)
    source_of_information: Optional[str] = Field(None, max_length=255)
    # Family Chart — list of family-member rows (the UI sends an array), stored as JSON
    family_chart: Optional[list] = Field(None, description="Family chart rows (genogram)")
    genogram: Optional[dict] = Field(None, description="Genogram layout and relationships")

    notes: Optional[str] = None

    # Diagnosis & Referral
    diagnosis: Optional[str] = Field(None, max_length=100)
    referred_from: Optional[str] = Field(None, max_length=100)
    is_approximate_dob: Optional[bool] = None

    # Bangalore Zone Clustering
    is_bangalore_resident: Optional[bool] = None
    geographic_cluster: Optional[str] = None

    # Linked hospital (Homecare UHID Code source)
    linked_hospital: Optional[str] = None

    # Hospital UHID — free-form ID issued by the external hospital
    hospital_uhid: Optional[str] = Field(None, max_length=30)

    # BSC Status & Onco
    bsc_status: Optional[bool] = None
    is_onco: Optional[bool] = None
    clinical_complexity: Optional[str] = None
    patient_priority: Optional[str] = None

    # Alternative Phone (Caregiver/Backup)
    alternative_phone: Optional[str] = None
    alternative_phone_name: Optional[str] = Field(None, max_length=100)

    # Care Circle
    primary_caregiver_name: Optional[str] = Field(None, max_length=100)
    primary_caregiver_relationship: Optional[str] = Field(None, max_length=50)
    primary_caregiver_phone: Optional[str] = Field(None, max_length=20)
    decision_maker_name: Optional[str] = Field(None, max_length=100)
    decision_maker_designation: Optional[str] = Field(None, max_length=50)
    decision_maker_phone: Optional[str] = Field(None, max_length=20)

    # Palliative outcome (set from the last visit form when team learns of death)
    is_deceased: Optional[bool] = None
    date_of_death: Optional[date] = None

    # Custom registration date
    registration_date: Optional[date] = None

    # Three-state patient status (§3, 2026-04-14)
    care_status: Optional[str] = None
    place_of_death: Optional[str] = None
    place_of_death_remarks: Optional[str] = Field(None, max_length=500)
    is_contacted: Optional[bool] = None
    home_care_decline_reason: Optional[str] = None
    external_metadata: Optional[dict] = Field(None, description="External metadata (lat/lng, etc.)")

    # Use the same validators as create schema
    _validate_dob = field_validator('date_of_birth')(PatientCreateSchema.validate_date_of_birth.__func__)
    _validate_registration_date = field_validator('registration_date')(PatientCreateSchema.validate_registration_date.__func__)
    _validate_gender = field_validator('gender')(PatientCreateSchema.validate_gender.__func__)
    _validate_phone = field_validator('phone_number', 'emergency_contact_phone')(PatientCreateSchema.validate_phone.__func__)
    _validate_abha_id = field_validator('abha_id')(PatientCreateSchema.validate_abha_id.__func__)
    _validate_abha_address = field_validator('abha_address')(PatientCreateSchema.validate_abha_address.__func__)
    _validate_blood_group = field_validator('blood_group')(PatientCreateSchema.validate_blood_group.__func__)
    _validate_geographic_cluster = field_validator('geographic_cluster')(PatientCreateSchema.validate_geographic_cluster.__func__)
    _validate_clinical_complexity = field_validator('clinical_complexity')(PatientCreateSchema.validate_clinical_complexity.__func__)
    _validate_patient_priority = field_validator('patient_priority')(PatientCreateSchema.validate_patient_priority.__func__)
    _validate_care_status = field_validator('care_status')(PatientCreateSchema.validate_care_status.__func__)
    _validate_place_of_death = field_validator('place_of_death')(PatientCreateSchema.validate_place_of_death.__func__)
    _validate_alternative_phone = field_validator('alternative_phone')(PatientCreateSchema.validate_alternative_phone.__func__)

    @field_validator('linked_hospital')
    @classmethod
    def validate_linked_hospital(cls, v):
        if v is None or v == '':
            return None
        from app.patients.uhid_service import get_valid_hospital_codes
        valid_codes = get_valid_hospital_codes()
        if v not in valid_codes:
            raise ValueError(
                f'linked_hospital must be one of: {", ".join(valid_codes)}'
            )
        return v

    class Config:
        from_attributes = True


class PatientResponseSchema(BaseModel):
    """Schema for patient response (excludes encrypted fields)"""
    id: UUID
    uhid: Optional[str] = None  # System-generated UHID (Bangalore patients only)
    linked_hospital: Optional[str] = None  # KMIO / KCGH / SWON
    homecare_code: Optional[str] = None  # Derived prefix like KAGBAKMIO
    hospital_uhid: Optional[str] = None  # Hospital-issued UHID (from external hospital file)
    full_name: str
    date_of_birth: Optional[date] = None
    age: Optional[int] = None  # Calculated field
    gender: Optional[str] = None
    phone: Optional[str] = None  # Decrypted phone number
    email: Optional[str] = None  # Decrypted email
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    abha_address: Optional[str] = None  # Decrypted ABHA address
    has_abha: bool = False  # Whether patient has ABHA ID
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None  # Decrypted
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    insurance_provider: Optional[str] = None
    preferred_language: Optional[str] = None
    educational_status: Optional[str] = None
    occupation: Optional[str] = None
    religion: Optional[str] = None
    marital_status: Optional[str] = None
    barriers_to_communication: Optional[str] = None
    no_of_children: Optional[int] = None
    source_of_information: Optional[str] = None
    family_chart: Optional[list] = None
    genogram: Optional[dict] = None

    notes: Optional[str] = None
    diagnosis: Optional[str] = None
    referred_from: Optional[str] = None
    is_approximate_dob: bool = False
    is_bangalore_resident: bool = False
    geographic_cluster: Optional[str] = None
    bsc_status: Optional[bool] = None
    is_onco: Optional[bool] = None
    clinical_complexity: Optional[str] = None
    patient_priority: Optional[str] = None
    alternative_phone: Optional[str] = None
    alternative_phone_name: Optional[str] = None
    primary_caregiver_name: Optional[str] = None
    primary_caregiver_relationship: Optional[str] = None
    primary_caregiver_phone: Optional[str] = None
    decision_maker_name: Optional[str] = None
    decision_maker_designation: Optional[str] = None
    decision_maker_phone: Optional[str] = None
    is_deceased: Optional[bool] = False
    date_of_death: Optional[date] = None
    care_status: Optional[str] = 'active'
    place_of_death: Optional[str] = None
    place_of_death_remarks: Optional[str] = None
    is_contacted: Optional[bool] = None
    home_care_decline_reason: Optional[str] = None
    registration_date: Optional[date] = None
    submission_count: Optional[int] = 0
    last_submission: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class PatientListItemSchema(BaseModel):
    """Compact schema for patient list view"""
    id: UUID
    uhid: Optional[str] = None  # System-generated UHID (Bangalore patients only)
    linked_hospital: Optional[str] = None
    homecare_code: Optional[str] = None  # Derived prefix like KAGBAKMIO
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    has_abha: bool = False
    diagnosis: Optional[str] = None
    is_approximate_dob: bool = False
    bsc_status: Optional[bool] = None
    is_onco: Optional[bool] = None
    geographic_cluster: Optional[str] = None
    submission_count: Optional[int] = 0
    last_submission: Optional[datetime] = None
    registration_date: Optional[date] = None
    care_status: Optional[str] = 'active'
    created_at: datetime

    class Config:
        from_attributes = True


class PatientSearchSchema(BaseModel):
    """Schema for advanced patient search"""
    query: Optional[str] = Field(None, description="Search query (name, phone, ABHA)")
    gender: Optional[str] = None
    age_min: Optional[int] = Field(None, ge=0, le=150)
    age_max: Optional[int] = Field(None, ge=0, le=150)
    city: Optional[str] = None
    state: Optional[str] = None
    has_abha: Optional[bool] = None
    has_submissions: Optional[bool] = None
    bsc_status: Optional[bool] = None
    is_onco: Optional[bool] = None
    is_contacted: Optional[bool] = None
    geographic_cluster: Optional[str] = None
    created_after: Optional[date] = None
    created_before: Optional[date] = None
    sort_by: str = Field(default="created_at", description="Field to sort by")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)

    class Config:
        from_attributes = True


class PatientSearchResultSchema(BaseModel):
    """Schema for search results"""
    patients: list[PatientListItemSchema]
    total: int
    page: int
    per_page: int
    total_pages: int

    class Config:
        from_attributes = True


class RecentPatientSchema(BaseModel):
    """Schema for recently accessed patients"""
    id: UUID
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    last_accessed: datetime
    access_count: int

    class Config:
        from_attributes = True
