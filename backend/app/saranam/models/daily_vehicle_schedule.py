"""Daily Vehicle Schedule model for daily route dispatch."""
from sqlalchemy import Column, String, Date, Integer, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class DailyVehicleSchedule(BaseModel):
    """Daily scheduled visits for vehicles and patients."""
    __tablename__ = 'daily_vehicle_schedules'

    schedule_date = Column(Date, nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False, index=True)
    slot_order = Column(Integer, nullable=False, default=1)
    status = Column(String(50), nullable=False, default='pending')  # pending, active, completed, failed
    priority_at_visit = Column(String(50), nullable=True)
    patient_type_at_visit = Column(String(50), nullable=True, default='existing')
    gap_days_at_visit = Column(Integer, nullable=True, default=0)
    urgency_score_at_visit = Column(Numeric(10, 3), nullable=True, default=0.0)
    homecare_days_at_schedule = Column(Text, nullable=True)
    sla_days_at_visit = Column(Integer, nullable=True)
    visit_type = Column(String(50), nullable=True, default='follow_up')  # initial, follow_up, bereavement
    drive_distance_km = Column(Numeric(10, 2), nullable=True)
    drive_duration_min = Column(Numeric(10, 1), nullable=True)
    homecare_days_at_schedule = Column(String(50), nullable=True)
    sla_days_at_visit = Column(Integer, nullable=True)
    visit_type = Column(String(50), nullable=True)

    # Relationships
    patient = db_relationship('Patient', backref='daily_schedules')
    vehicle = db_relationship('Vehicle', backref='daily_schedules')

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        data['schedule_date'] = self.schedule_date.isoformat() if self.schedule_date else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['slot_order'] = self.slot_order
        data['status'] = self.status
        data['priority_at_visit'] = self.priority_at_visit
        data['patient_type_at_visit'] = self.patient_type_at_visit
        data['gap_days_at_visit'] = self.gap_days_at_visit
        data['urgency_score_at_visit'] = float(self.urgency_score_at_visit) if self.urgency_score_at_visit is not None else 0.0
        data['homecare_days_at_schedule'] = self.homecare_days_at_schedule
        data['sla_days_at_visit'] = self.sla_days_at_visit
        data['visit_type'] = self.visit_type or ('initial' if self.patient_type_at_visit == 'new' else 'follow_up')
        data['drive_distance_km'] = float(self.drive_distance_km) if self.drive_distance_km is not None else None
        data['drive_duration_min'] = float(self.drive_duration_min) if self.drive_duration_min is not None else None
        
        # Joined patient metadata
        if self.patient:
            data['patient_name'] = self.patient.full_name
            data['uhid'] = self.patient.uhid
            data['hospital_uhid'] = getattr(self.patient, 'hospital_uhid', None)
            data['zone'] = getattr(self.patient, 'geographic_cluster', None)
            
            # Coordinates
            ext = getattr(self.patient, 'external_metadata', {}) or {}
            if isinstance(ext, str):
                import json
                try:
                    ext = json.loads(ext)
                except Exception:
                    ext = {}
            data['lat'] = ext.get('latitude') or ext.get('lat')
            data['lon'] = ext.get('longitude') or ext.get('lon') or ext.get('lng')
            
            # Decrypted or direct contacts
            data['phone'] = getattr(self.patient, 'phone', None)
            data['address'] = getattr(self.patient, 'address', None)
            data['alternative_phone'] = getattr(self.patient, 'alternative_phone', None)
            data['primary_caregiver_phone'] = getattr(self.patient, 'primary_caregiver_phone', None)
            data['decision_maker_phone'] = getattr(self.patient, 'decision_maker_phone', None)
        
        if self.vehicle:
            data['vehicle_name'] = self.vehicle.name
            data['registration_number'] = getattr(self.vehicle, 'registration_number', None)

        return data
