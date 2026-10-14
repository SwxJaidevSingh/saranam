"""OPD (Out-Patient Department) models — Prescription and Lab Order management."""
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel


class PrescriptionStatus(enum.Enum):
    DRAFT = 'draft'
    FINALIZED = 'finalized'
    SENT_TO_PHARMACY = 'sent_to_pharmacy'
    DISPENSED = 'dispensed'


class LabOrderStatus(enum.Enum):
    ORDERED = 'ordered'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'


class LabUrgency(enum.Enum):
    ROUTINE = 'routine'
    URGENT = 'urgent'
    STAT = 'stat'


class OPDPrescription(BaseModel):
    """
    OPD Prescription — created by doctor during OPD consultation.
    One prescription per OPD visit (can have multiple items).
    Dispatched to pharmacy when finalized.
    """
    __tablename__ = 'opd_prescriptions'

    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True, unique=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    prescribed_by = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), nullable=False, index=True)

    status = Column(SQLEnum(PrescriptionStatus), default=PrescriptionStatus.DRAFT, nullable=False, index=True)
    notes = Column(Text)

    # Relationships
    encounter = relationship('Encounter', foreign_keys=[encounter_id])
    patient = relationship('Patient', foreign_keys=[patient_id])
    prescriber = relationship('HealthcareProvider', foreign_keys=[prescribed_by])
    items = relationship('OPDPrescriptionItem', back_populates='prescription', cascade='all, delete-orphan')

    def to_dict(self):
        data = super().to_dict()
        data['encounter_id'] = str(self.encounter_id)
        data['patient_id'] = str(self.patient_id)
        data['prescribed_by'] = str(self.prescribed_by)
        data['status'] = self.status.value if self.status else None
        data['notes'] = self.notes
        if self.prescriber:
            data['prescriber_name'] = self.prescriber.full_name
        data['items'] = [item.to_dict() for item in self.items] if self.items else []
        return data

    def __repr__(self):
        return f'<OPDPrescription encounter={self.encounter_id} status={self.status}>'


class OPDPrescriptionItem(BaseModel):
    """
    Individual medicine line in an OPD prescription.
    medicine_id links to inventory Medicine model (nullable for free-text entry).
    """
    __tablename__ = 'opd_prescription_items'

    prescription_id = Column(UUID(as_uuid=True), ForeignKey('opd_prescriptions.id', ondelete='CASCADE'), nullable=False, index=True)

    # Medicine — links to inventory, or free-text if not in inventory
    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), index=True)
    medicine_name = Column(String(255), nullable=False)
    dosage = Column(String(100))          # legacy free-text dosage, kept for backward compat
    dosage_morning = Column(String(10))   # structured dosage (legacy): "0", "¼", "½", "1", "1½", "2"
    dosage_afternoon = Column(String(10))
    dosage_night = Column(String(10))
    # Time-based dosage slots (opioid preset)
    dosage_6am = Column(String(10))
    dosage_10am = Column(String(10))
    dosage_2pm = Column(String(10))
    dosage_6pm = Column(String(10))
    dosage_10pm = Column(String(10))
    # Schedule mode (meeting §5.2, 2026-04-14) — decides which timing columns
    # are authoritative for this medicine row:
    #   'opioid' → dosage_6am..10pm (default; matches current behavior)
    #   'tds'    → dosage_morning/afternoon/night (legacy 3-slot columns)
    #   'custom' → custom_timings JSONB array of {time, dose}
    schedule_mode = Column(String(20), nullable=False, server_default='opioid')
    custom_timings = Column(JSONB, nullable=True)
    frequency = Column(String(100))       # e.g. "OD", "BD", "TDS", "Q8H"
    sos = Column(Boolean, default=False, nullable=False)  # secondary SOS/as-needed flag
    duration = Column(Integer)            # numeric value
    duration_unit = Column(String(20))    # days / weeks / months
    quantity = Column(Integer)            # total quantity to dispense
    instructions = Column(Text)           # e.g. "After food", "Empty stomach"
    route = Column(String(50))            # oral, IV, IM, topical, inhaled
    medicine_type = Column(String(30))    # immediate_release, sustained_release, extended_release
    dosage_form = Column(String(30))      # tablet, syrup, capsule, injection, etc.
    warning_signs = Column(Text)          # e.g. "If patient is too drowsy, stop this medicine"

    # Relationships
    prescription = relationship('OPDPrescription', back_populates='items')
    medicine = relationship('MedicineMaster', foreign_keys=[medicine_id])

    def to_dict(self):
        data = super().to_dict()
        data['prescription_id'] = str(self.prescription_id)
        data['medicine_id'] = str(self.medicine_id) if self.medicine_id else None
        data['medicine_name'] = self.medicine_name
        data['dosage'] = self.dosage
        data['dosage_morning'] = self.dosage_morning
        data['dosage_afternoon'] = self.dosage_afternoon
        data['dosage_night'] = self.dosage_night
        data['dosage_6am'] = self.dosage_6am
        data['dosage_10am'] = self.dosage_10am
        data['schedule_mode'] = self.schedule_mode
        data['custom_timings'] = self.custom_timings
        data['dosage_2pm'] = self.dosage_2pm
        data['dosage_6pm'] = self.dosage_6pm
        data['dosage_10pm'] = self.dosage_10pm
        data['frequency'] = self.frequency
        data['sos'] = self.sos
        data['duration'] = self.duration
        data['duration_unit'] = self.duration_unit
        data['quantity'] = self.quantity
        data['instructions'] = self.instructions
        data['route'] = self.route
        data['medicine_type'] = self.medicine_type
        data['dosage_form'] = self.dosage_form
        data['warning_signs'] = self.warning_signs
        return data

    def __repr__(self):
        return f'<OPDPrescriptionItem {self.medicine_name} {self.dosage}>'


class OPDLabOrder(BaseModel):
    """
    Lab Order created by doctor during OPD consultation.
    One lab order per OPD visit (can have multiple test items).
    Full lab integration to be built later — for now saves as form record.
    """
    __tablename__ = 'opd_lab_orders'

    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True, unique=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    ordered_by = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), nullable=False, index=True)

    status = Column(SQLEnum(LabOrderStatus), default=LabOrderStatus.ORDERED, nullable=False, index=True)
    notes = Column(Text)

    # Relationships
    encounter = relationship('Encounter', foreign_keys=[encounter_id])
    patient = relationship('Patient', foreign_keys=[patient_id])
    ordering_provider = relationship('HealthcareProvider', foreign_keys=[ordered_by])
    items = relationship('OPDLabOrderItem', back_populates='lab_order', cascade='all, delete-orphan')

    def to_dict(self):
        data = super().to_dict()
        data['encounter_id'] = str(self.encounter_id)
        data['patient_id'] = str(self.patient_id)
        data['ordered_by'] = str(self.ordered_by)
        data['status'] = self.status.value if self.status else None
        data['notes'] = self.notes
        if self.ordering_provider:
            data['ordering_provider_name'] = self.ordering_provider.full_name
        data['items'] = [item.to_dict() for item in self.items] if self.items else []
        return data

    def __repr__(self):
        return f'<OPDLabOrder encounter={self.encounter_id} status={self.status}>'


class OPDLabOrderItem(BaseModel):
    """
    Individual test in an OPD lab order.
    """
    __tablename__ = 'opd_lab_order_items'

    lab_order_id = Column(UUID(as_uuid=True), ForeignKey('opd_lab_orders.id', ondelete='CASCADE'), nullable=False, index=True)

    test_name = Column(String(255), nullable=False)
    urgency = Column(SQLEnum(LabUrgency), default=LabUrgency.ROUTINE, nullable=False)
    notes = Column(Text)

    # Results (filled later when lab integration is built)
    result = Column(Text)
    result_at = Column(DateTime)

    # Relationships
    lab_order = relationship('OPDLabOrder', back_populates='items')

    def to_dict(self):
        data = super().to_dict()
        data['lab_order_id'] = str(self.lab_order_id)
        data['test_name'] = self.test_name
        data['urgency'] = self.urgency.value if self.urgency else None
        data['notes'] = self.notes
        data['result'] = self.result
        data['result_at'] = self.result_at.isoformat() if self.result_at else None
        return data

    def __repr__(self):
        return f'<OPDLabOrderItem {self.test_name} - {self.urgency}>'
