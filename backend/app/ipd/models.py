"""IPD (In-Patient Department) models for hospital admission management."""
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class Bed(BaseModel):
    """
    Bed model for hospital bed inventory management.

    Supports multi-facility bed tracking with real-time availability,
    equipment details, and bed categorization.
    """
    __tablename__ = 'beds'

    # Bed Identification
    bed_number = Column(String(50), nullable=False, unique=True, index=True)

    # Location Hierarchy
    facility_id = Column(UUID(as_uuid=True), index=True)  # Multi-facility support
    building = Column(String(100))
    floor = Column(String(50))
    ward_name = Column(String(100), nullable=False, index=True)
    room_number = Column(String(50))

    # Bed Classification
    bed_type = Column(String(50), nullable=False, index=True)  # general, icu, semi_private, private, isolation
    bed_status = Column(String(50), nullable=False, index=True)  # available, occupied, cleaning, maintenance, reserved

    # Equipment & Capabilities
    has_oxygen = Column(Boolean, default=False, nullable=False)
    has_ventilator = Column(Boolean, default=False, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text)

    # Relationships
    assignments = db_relationship('BedAssignment', back_populates='bed', lazy='dynamic', cascade='all, delete-orphan')
    waiting_list_assignments = db_relationship('BedWaitingList', foreign_keys='BedWaitingList.assigned_bed_id', back_populates='assigned_bed', lazy='dynamic')

    def __repr__(self):
        return f'<Bed {self.bed_number} - {self.ward_name} - {self.bed_status}>'

    def to_dict(self):
        """Convert to dictionary with additional computed fields."""
        data = super().to_dict()
        # Add current assignment if occupied
        if self.bed_status == 'occupied':
            current_assignment = self.assignments.filter_by(assignment_status='active').first()
            if current_assignment:
                data['current_patient'] = {
                    'patient_id': str(current_assignment.patient_id),
                    'patient_name': current_assignment.patient.full_name if current_assignment.patient else None,
                    'assigned_at': current_assignment.assigned_at.isoformat() if current_assignment.assigned_at else None
                }
        return data


class IPDAdmission(BaseModel):
    """
    IPD Admission model for managing inpatient admissions.

    Wraps Encounter with IPD-specific workflow, linking admission forms,
    discharge summaries, and clinical documentation.
    """
    __tablename__ = 'ipd_admissions'

    # Core References
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Admission Details
    admission_form_submission_id = Column(UUID(as_uuid=True), ForeignKey('form_submissions.id'))
    admission_type = Column(String(50), nullable=False, index=True)  # emergency, elective, transfer
    admission_source = Column(String(50))  # emergency_room, opd, referral, direct
    admitting_doctor_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), index=True)
    admission_diagnosis = Column(Text)
    admission_notes = Column(Text)
    estimated_length_of_stay_days = Column(Integer)

    # Discharge Details
    discharge_form_submission_id = Column(UUID(as_uuid=True), ForeignKey('form_submissions.id'))
    discharge_type = Column(String(50))  # normal, against_medical_advice, transfer, death
    discharge_diagnosis = Column(Text)
    discharge_summary = Column(Text)
    discharge_instructions = Column(Text)

    # Follow-up
    follow_up_appointment_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id'))
    next_appointment_date = Column(DateTime)
    doctor_notes = Column(Text)

    # Billing Integration
    billing_summary = Column(JSON)  # {'services': [], 'total_cost': 0, 'payment_status': ''}

    # Relationships
    encounter = db_relationship('Encounter', foreign_keys=[encounter_id], back_populates='ipd_admission')
    patient = db_relationship('Patient', foreign_keys=[patient_id])
    admitting_doctor = db_relationship('HealthcareProvider', foreign_keys=[admitting_doctor_id])
    admission_form = db_relationship('FormSubmission', foreign_keys=[admission_form_submission_id])
    discharge_form = db_relationship('FormSubmission', foreign_keys=[discharge_form_submission_id])
    follow_up_appointment = db_relationship('Encounter', foreign_keys=[follow_up_appointment_id])
    bed_assignments = db_relationship('BedAssignment', back_populates='admission', lazy='dynamic', cascade='all, delete-orphan')
    vitals_records = db_relationship('VitalsRecord',
                                     primaryjoin='IPDAdmission.encounter_id == VitalsRecord.encounter_id',
                                     foreign_keys='[VitalsRecord.encounter_id]',
                                     back_populates='admission',
                                     lazy='dynamic')

    def __repr__(self):
        return f'<IPDAdmission {self.patient_id} - {self.admission_type}>'

    def to_dict(self):
        """Convert to dictionary with related data."""
        data = super().to_dict()
        # Add current bed assignment
        current_bed = self.bed_assignments.filter_by(assignment_status='active').first()
        if current_bed:
            data['current_bed'] = {
                'bed_id': str(current_bed.bed_id),
                'bed_number': current_bed.bed.bed_number if current_bed.bed else None,
                'ward_name': current_bed.bed.ward_name if current_bed.bed else None
            }
        # Add service_id from encounter (needed for form configuration)
        if self.encounter:
            data['service_id'] = str(self.encounter.service_id) if self.encounter.service_id else None
        return data


class BedAssignment(BaseModel):
    """
    Bed Assignment model for tracking bed allocation history.

    Maintains complete audit trail of all bed assignments, transfers,
    and releases throughout a patient's IPD stay.
    """
    __tablename__ = 'bed_assignments'

    # Core References
    bed_id = Column(UUID(as_uuid=True), ForeignKey('beds.id', ondelete='CASCADE'), nullable=False, index=True)
    admission_id = Column(UUID(as_uuid=True), ForeignKey('ipd_admissions.id', ondelete='CASCADE'), index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'))

    # Assignment Timeline
    assigned_at = Column(DateTime, nullable=False, index=True)
    released_at = Column(DateTime)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Assignment Status & Context
    assignment_status = Column(String(50), nullable=False, index=True)  # active, completed, transferred
    transfer_reason = Column(Text)
    notes = Column(Text)

    # Relationships
    bed = db_relationship('Bed', back_populates='assignments')
    admission = db_relationship('IPDAdmission', back_populates='bed_assignments')
    patient = db_relationship('Patient')
    encounter = db_relationship('Encounter')
    assigner = db_relationship('User', foreign_keys=[assigned_by])

    def __repr__(self):
        return f'<BedAssignment {self.bed_id} to {self.patient_id} - {self.assignment_status}>'


class BedWaitingList(BaseModel):
    """
    Bed Waiting List model for managing bed allocation queue.

    Prioritized queue for patients awaiting bed assignment with
    automatic assignment when beds become available.
    """
    __tablename__ = 'bed_waiting_list'

    # Core References
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id'))

    # Request Details
    requested_bed_type = Column(String(50), nullable=False)  # general, icu, semi_private, private, isolation
    priority = Column(String(50), nullable=False, index=True)  # emergency, urgent, routine
    requested_at = Column(DateTime, nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Assignment Status
    status = Column(String(50), nullable=False, index=True)  # waiting, assigned, cancelled, expired
    assigned_bed_id = Column(UUID(as_uuid=True), ForeignKey('beds.id'))
    assigned_at = Column(DateTime)
    notes = Column(Text)

    # Relationships
    patient = db_relationship('Patient')
    service = db_relationship('Service')
    assigned_bed = db_relationship('Bed', foreign_keys=[assigned_bed_id], back_populates='waiting_list_assignments')
    requester = db_relationship('User', foreign_keys=[requested_by])

    def __repr__(self):
        return f'<BedWaitingList {self.patient_id} - {self.priority} - {self.status}>'

    def to_dict(self):
        """Convert to dictionary with computed wait time."""
        data = super().to_dict()
        if self.requested_at and self.status == 'waiting':
            from datetime import datetime
            wait_time = datetime.utcnow() - self.requested_at
            data['wait_time_hours'] = wait_time.total_seconds() / 3600
        return data


class VitalsRecord(BaseModel):
    """
    Vitals Record model for daily patient vitals tracking.

    Stores structured vital signs data with customizable fields,
    abnormal value detection, and trend analysis support.
    """
    __tablename__ = 'vitals_records'

    # Core References
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Recording Details
    recorded_at = Column(DateTime, nullable=False, index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Vitals Data (Flexible JSONB structure)
    # Example: {
    #   "bp_systolic": 120, "bp_diastolic": 80,
    #   "temperature": 98.6, "pulse": 72,
    #   "respiratory_rate": 16, "spo2": 98,
    #   "blood_sugar": 110, "weight": 70,
    #   "intake_output": {"intake_ml": 2000, "output_ml": 1800},
    #   "pain_score": 3
    # }
    vitals_data = Column(JSON, nullable=False)
    assessment_data = Column(JSON)  # JSONB: general_physical_exam, pain, symptoms, hygiene
    visit_summary = Column(Text)    # Auto-generated + editable nursing visit summary
    observation_notes = Column(Text)

    # Alert Status
    is_critical = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    encounter = db_relationship('Encounter', foreign_keys=[encounter_id], overlaps='admission,vitals_records')
    patient = db_relationship('Patient', foreign_keys=[patient_id])
    recorder = db_relationship('User', foreign_keys=[recorded_by])
    admission = db_relationship('IPDAdmission',
                               primaryjoin='foreign(VitalsRecord.encounter_id) == IPDAdmission.encounter_id',
                               back_populates='vitals_records',
                               uselist=False,
                               overlaps='encounter,vitals_records')

    def __repr__(self):
        return f'<VitalsRecord {self.patient_id} at {self.recorded_at}>'

    def check_critical_values(self):
        """
        Check if any vital signs are in critical range.
        Override this method to customize thresholds per institution.
        """
        if not self.vitals_data:
            return False

        critical_thresholds = {
            'bp_systolic': (60, 180),  # (min, max)
            'bp_diastolic': (40, 120),
            'temperature': (95.0, 104.0),  # Fahrenheit
            'pulse': (40, 140),
            'respiratory_rate': (8, 30),
            'spo2': (85, 100),  # Only min matters
            'blood_sugar': (40, 300)  # mg/dL
        }

        for vital, (min_val, max_val) in critical_thresholds.items():
            if vital in self.vitals_data:
                value = self.vitals_data[vital]
                if value is not None and (value < min_val or value > max_val):
                    return True

        return False
