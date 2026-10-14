"""Schedule Slot model - patient-day assignment."""
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Time, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ScheduleSlot(BaseModel):
    """One patient scheduled for one day. The core scheduling unit."""
    __tablename__ = 'schedule_slots'

    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id', ondelete='CASCADE'), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'), nullable=False, index=True)

    # Visit ordering
    slot_order = Column(Integer, nullable=False, default=0)

    # Execution status
    status = Column(String(20), nullable=False, default='scheduled')
    # Valid: scheduled, in_progress, completed, missed, cancelled

    # Reasons
    missed_reason = Column(Text)
    cancelled_reason = Column(Text)

    # Ad-hoc tracking
    is_adhoc = Column(Boolean, default=False)
    adhoc_reason = Column(Text)
    adhoc_added_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Link to actual visit record
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id'))

    # Vehicle assignment (which vehicle visits this patient)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id'), nullable=True, index=True)

    # Patient-specific notes
    exception_note = Column(Text)

    # Planned visit time
    scheduled_time = Column(Time, nullable=True)
    visit_duration_minutes = Column(Integer, nullable=True, default=30)

    # Time tracking
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    patient = db_relationship('Patient', foreign_keys=[patient_id])
    visit = db_relationship('PatientVisit', foreign_keys=[visit_id])
    vehicle = db_relationship('Vehicle', foreign_keys=[vehicle_id])

    __table_args__ = (
        UniqueConstraint('schedule_day_id', 'patient_id', name='uq_schedule_slot_patient_day'),
    )

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['schedule_day_id'] = str(self.schedule_day_id) if self.schedule_day_id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['adhoc_added_by'] = str(self.adhoc_added_by) if self.adhoc_added_by else None
        data['visit_id'] = str(self.visit_id) if self.visit_id else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['vehicle_name'] = self.vehicle.name if self.vehicle else None
        data['vehicle_base_hospital'] = self.vehicle.base_hospital if self.vehicle else None
        data['scheduled_time'] = self.scheduled_time.isoformat() if self.scheduled_time else None
        data['visit_duration_minutes'] = self.visit_duration_minutes
        data['started_at'] = self.started_at.isoformat() if self.started_at else None
        data['completed_at'] = self.completed_at.isoformat() if self.completed_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        # Include patient summary if loaded
        if self.patient:
            from app.patients.uhid_service import get_homecare_code
            data['patient_name'] = self.patient.full_name
            data['patient_uhid'] = self.patient.uhid
            try:
                data['patient_phone'] = self.patient.get_phone()
            except Exception:
                data['patient_phone'] = None
            data['patient_linked_hospital'] = self.patient.linked_hospital
            data['patient_homecare_code'] = get_homecare_code(self.patient.linked_hospital)
            data['patient_bsc_status'] = self.patient.bsc_status
            data['patient_is_onco'] = self.patient.is_onco
            data['patient_cluster'] = self.patient.geographic_cluster
            data['geographic_cluster'] = self.patient.geographic_cluster
            data['patient_diagnosis'] = self.patient.diagnosis
            data['patient_referred_from'] = self.patient.referred_from
            # Include GPS coordinates for map display
            meta = self.patient.external_metadata or {}
            if meta.get('latitude') and meta.get('longitude'):
                data['patient_gps'] = {'lat': meta['latitude'], 'lng': meta['longitude']}
            elif meta.get('gps_latitude') and meta.get('gps_longitude'):
                data['patient_gps'] = {'lat': meta['gps_latitude'], 'lng': meta['gps_longitude']}
            # Include address for info window
            try:
                data['patient_address'] = self.patient.get_address()
            except Exception:
                pass
        return data
