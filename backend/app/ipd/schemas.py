"""
IPD Schemas for Data Validation
Pydantic schemas for IPD admissions, beds, vitals, and discharge management
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from uuid import UUID
from enum import Enum


# Enums
class BedType(str, Enum):
    """Bed types"""
    GENERAL = "general"
    ICU = "icu"
    SEMI_PRIVATE = "semi_private"
    PRIVATE = "private"
    ISOLATION = "isolation"


class BedStatus(str, Enum):
    """Bed status"""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    CLEANING = "cleaning"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"


class AdmissionType(str, Enum):
    """Admission types"""
    EMERGENCY = "emergency"
    ELECTIVE = "elective"
    TRANSFER = "transfer"


class AdmissionSource(str, Enum):
    """Admission source"""
    EMERGENCY_ROOM = "emergency_room"
    OPD = "opd"
    REFERRAL = "referral"
    DIRECT = "direct"


class DischargeType(str, Enum):
    """Discharge types"""
    NORMAL = "normal"
    AGAINST_MEDICAL_ADVICE = "against_medical_advice"
    TRANSFER = "transfer"
    DEATH = "death"


class WaitingListPriority(str, Enum):
    """Waiting list priority levels"""
    EMERGENCY = "emergency"
    URGENT = "urgent"
    ROUTINE = "routine"


class WaitingListStatus(str, Enum):
    """Waiting list status"""
    WAITING = "waiting"
    ASSIGNED = "assigned"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class AssignmentStatus(str, Enum):
    """Bed assignment status"""
    ACTIVE = "active"
    COMPLETED = "completed"
    TRANSFERRED = "transferred"


# Bed Schemas
class BedCreateSchema(BaseModel):
    """Schema for creating a new bed"""
    bed_number: str = Field(..., min_length=1, max_length=50, description="Unique bed number")
    facility_id: Optional[UUID] = Field(None, description="Facility ID for multi-facility support")
    building: Optional[str] = Field(None, max_length=100, description="Building name")
    floor: Optional[str] = Field(None, max_length=50, description="Floor number/name")
    ward_name: str = Field(..., max_length=100, description="Ward name")
    room_number: Optional[str] = Field(None, max_length=50, description="Room number")
    bed_type: BedType = Field(..., description="Type of bed")
    bed_status: BedStatus = Field(default=BedStatus.AVAILABLE, description="Current bed status")
    has_oxygen: bool = Field(default=False, description="Has oxygen supply")
    has_ventilator: bool = Field(default=False, description="Has ventilator")
    is_active: bool = Field(default=True, description="Is bed active")
    notes: Optional[str] = Field(None, description="Additional notes")

    class Config:
        from_attributes = True


class BedUpdateSchema(BaseModel):
    """Schema for updating a bed"""
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[str] = Field(None, max_length=50)
    ward_name: Optional[str] = Field(None, max_length=100)
    room_number: Optional[str] = Field(None, max_length=50)
    bed_type: Optional[BedType] = None
    bed_status: Optional[BedStatus] = None
    has_oxygen: Optional[bool] = None
    has_ventilator: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class BedResponseSchema(BaseModel):
    """Schema for bed response"""
    id: UUID
    bed_number: str
    facility_id: Optional[UUID] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    ward_name: str
    room_number: Optional[str] = None
    bed_type: str
    bed_status: str
    has_oxygen: bool
    has_ventilator: bool
    is_active: bool
    notes: Optional[str] = None
    current_patient: Optional[Dict[str, Any]] = None  # Populated if occupied
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# IPD Admission Schemas
class IPDAdmissionCreateSchema(BaseModel):
    """Schema for creating a new IPD admission"""
    patient_id: UUID = Field(..., description="Patient ID")
    encounter_id: Optional[UUID] = Field(None, description="Existing encounter ID (if linking to existing)")
    admission_type: AdmissionType = Field(..., description="Type of admission")
    admission_source: Optional[AdmissionSource] = Field(None, description="Source of admission")
    admitting_doctor_id: Optional[UUID] = Field(None, description="Admitting doctor ID")
    admission_diagnosis: Optional[str] = Field(None, description="Admission diagnosis")
    admission_notes: Optional[str] = Field(None, description="Admission notes")
    estimated_length_of_stay_days: Optional[int] = Field(None, ge=0, description="Estimated LOS in days")
    bed_id: Optional[UUID] = Field(None, description="Bed to assign (if available)")
    service_id: Optional[UUID] = Field(None, description="IPD service ID")

    # Encounter fields (if creating new encounter)
    create_new_encounter: bool = Field(default=True, description="Create new encounter or use existing")
    chief_complaint: Optional[str] = Field(None, description="Chief complaint (for new encounter)")

    # Dynamic form fields
    admission_form_id: Optional[UUID] = Field(None, description="Admission form ID (if using dynamic forms)")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Admission form data")

    class Config:
        from_attributes = True


class IPDAdmissionUpdateSchema(BaseModel):
    """Schema for updating an IPD admission"""
    admission_type: Optional[AdmissionType] = None
    admission_source: Optional[AdmissionSource] = None
    admitting_doctor_id: Optional[UUID] = None
    admission_diagnosis: Optional[str] = None
    admission_notes: Optional[str] = None
    estimated_length_of_stay_days: Optional[int] = Field(None, ge=0)
    doctor_notes: Optional[str] = None

    class Config:
        from_attributes = True


class DischargeSchema(BaseModel):
    """Schema for discharging a patient"""
    discharge_type: DischargeType = Field(..., description="Type of discharge")
    discharge_diagnosis: Optional[str] = Field(None, description="Final diagnosis")
    discharge_summary: Optional[str] = Field(None, description="Discharge summary")
    discharge_instructions: Optional[str] = Field(None, description="Discharge instructions for patient")
    doctor_notes: Optional[str] = Field(None, description="Doctor's notes")
    schedule_follow_up: bool = Field(default=False, description="Schedule follow-up appointment")
    follow_up_days: Optional[int] = Field(None, ge=1, description="Days until follow-up")
    follow_up_service_id: Optional[UUID] = Field(None, description="Service for follow-up")
    billing_summary: Optional[Dict[str, Any]] = Field(None, description="Billing information")

    # Dynamic form fields
    discharge_form_id: Optional[UUID] = Field(None, description="Discharge form ID (if using dynamic forms)")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Discharge form data")

    class Config:
        from_attributes = True


class IPDAdmissionResponseSchema(BaseModel):
    """Schema for IPD admission response"""
    id: UUID
    encounter_id: UUID
    patient_id: UUID
    patient_name: Optional[str] = None
    admission_form_submission_id: Optional[UUID] = None
    admission_type: str
    admission_source: Optional[str] = None
    admitting_doctor_id: Optional[UUID] = None
    admitting_doctor_name: Optional[str] = None
    admission_diagnosis: Optional[str] = None
    admission_notes: Optional[str] = None
    estimated_length_of_stay_days: Optional[int] = None
    discharge_form_submission_id: Optional[UUID] = None
    discharge_type: Optional[str] = None
    discharge_diagnosis: Optional[str] = None
    discharge_summary: Optional[str] = None
    discharge_instructions: Optional[str] = None
    follow_up_appointment_id: Optional[UUID] = None
    next_appointment_date: Optional[datetime] = None
    doctor_notes: Optional[str] = None
    billing_summary: Optional[Dict[str, Any]] = None
    current_bed: Optional[Dict[str, Any]] = None
    admission_date: Optional[datetime] = None  # From encounter
    discharge_date: Optional[datetime] = None  # From encounter
    length_of_stay_days: Optional[int] = None  # Calculated
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Bed Assignment Schemas
class BedAssignSchema(BaseModel):
    """Schema for assigning a bed"""
    patient_id: UUID = Field(..., description="Patient ID")
    admission_id: Optional[UUID] = Field(None, description="Admission ID")
    encounter_id: Optional[UUID] = Field(None, description="Encounter ID")
    notes: Optional[str] = Field(None, description="Assignment notes")

    class Config:
        from_attributes = True


class BedTransferSchema(BaseModel):
    """Schema for transferring a patient to a new bed"""
    new_bed_id: UUID = Field(..., description="New bed ID")
    transfer_reason: str = Field(..., description="Reason for transfer")
    notes: Optional[str] = Field(None, description="Transfer notes")

    class Config:
        from_attributes = True


class BedAssignmentResponseSchema(BaseModel):
    """Schema for bed assignment response"""
    id: UUID
    bed_id: UUID
    bed_number: Optional[str] = None
    ward_name: Optional[str] = None
    admission_id: Optional[UUID] = None
    patient_id: UUID
    patient_name: Optional[str] = None
    encounter_id: Optional[UUID] = None
    assigned_at: datetime
    released_at: Optional[datetime] = None
    assigned_by: Optional[UUID] = None
    assignment_status: str
    transfer_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Waiting List Schemas
class WaitingListCreateSchema(BaseModel):
    """Schema for adding patient to waiting list"""
    patient_id: UUID = Field(..., description="Patient ID")
    service_id: Optional[UUID] = Field(None, description="Requested service")
    requested_bed_type: BedType = Field(..., description="Requested bed type")
    priority: WaitingListPriority = Field(..., description="Priority level")
    notes: Optional[str] = Field(None, description="Additional notes")

    class Config:
        from_attributes = True


class WaitingListUpdateSchema(BaseModel):
    """Schema for updating waiting list entry"""
    priority: Optional[WaitingListPriority] = None
    status: Optional[WaitingListStatus] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class WaitingListResponseSchema(BaseModel):
    """Schema for waiting list response"""
    id: UUID
    patient_id: UUID
    patient_name: Optional[str] = None
    service_id: Optional[UUID] = None
    service_name: Optional[str] = None
    requested_bed_type: str
    priority: str
    requested_at: datetime
    requested_by: Optional[UUID] = None
    status: str
    assigned_bed_id: Optional[UUID] = None
    assigned_bed_number: Optional[str] = None
    assigned_at: Optional[datetime] = None
    notes: Optional[str] = None
    wait_time_hours: Optional[float] = None  # Calculated
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Vitals Schemas
class VitalsRecordCreateSchema(BaseModel):
    """Schema for recording vitals"""
    encounter_id: UUID = Field(..., description="Encounter ID")
    patient_id: UUID = Field(..., description="Patient ID")
    recorded_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="Recording time")
    vitals_data: Dict[str, Any] = Field(..., description="Vitals data in JSON format")
    observation_notes: Optional[str] = Field(None, description="Observation notes")

    @field_validator('vitals_data')
    @classmethod
    def validate_vitals_data(cls, v):
        """Validate vitals data structure"""
        if not v:
            raise ValueError("Vitals data cannot be empty")

        # Validate numeric ranges for common vitals
        validations = {
            'bp_systolic': (50, 250),
            'bp_diastolic': (30, 150),
            'temperature': (90, 110),  # Fahrenheit
            'pulse': (30, 200),
            'respiratory_rate': (5, 60),
            'spo2': (0, 100),
            'blood_sugar': (20, 600),
            'weight': (0, 500),  # kg
            'pain_score': (0, 10)
        }

        for vital, (min_val, max_val) in validations.items():
            if vital in v and v[vital] is not None:
                value = v[vital]
                if not isinstance(value, (int, float)):
                    raise ValueError(f"{vital} must be a number")
                if value < min_val or value > max_val:
                    raise ValueError(f"{vital} must be between {min_val} and {max_val}")

        return v

    class Config:
        from_attributes = True


class VitalsRecordResponseSchema(BaseModel):
    """Schema for vitals record response"""
    id: UUID
    encounter_id: UUID
    patient_id: UUID
    patient_name: Optional[str] = None
    recorded_at: datetime
    recorded_by: Optional[UUID] = None
    recorder_name: Optional[str] = None
    vitals_data: Dict[str, Any]
    observation_notes: Optional[str] = None
    is_critical: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dashboard and Statistics Schemas
class IPDDashboardSchema(BaseModel):
    """Schema for IPD dashboard statistics"""
    total_admissions: int
    active_admissions: int
    total_discharges_today: int
    total_beds: int
    occupied_beds: int
    available_beds: int
    cleaning_beds: int
    maintenance_beds: int
    bed_occupancy_rate: float
    average_length_of_stay: float
    waiting_list_count: int
    critical_vitals_count: int

    class Config:
        from_attributes = True


class BedAvailabilitySchema(BaseModel):
    """Schema for bed availability by type"""
    bed_type: str
    total: int
    occupied: int
    available: int
    occupancy_rate: float

    class Config:
        from_attributes = True


# List and Filter Schemas
class BedFilterSchema(BaseModel):
    """Schema for filtering beds"""
    facility_id: Optional[UUID] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    ward_name: Optional[str] = None
    bed_type: Optional[BedType] = None
    bed_status: Optional[BedStatus] = None
    has_oxygen: Optional[bool] = None
    has_ventilator: Optional[bool] = None
    is_active: Optional[bool] = Field(default=True)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)

    class Config:
        from_attributes = True


class AdmissionFilterSchema(BaseModel):
    """Schema for filtering admissions"""
    patient_id: Optional[UUID] = None
    admission_type: Optional[AdmissionType] = None
    admitting_doctor_id: Optional[UUID] = None
    status: Optional[str] = Field(None, description="active or discharged")
    admission_date_from: Optional[date] = None
    admission_date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)

    class Config:
        from_attributes = True
