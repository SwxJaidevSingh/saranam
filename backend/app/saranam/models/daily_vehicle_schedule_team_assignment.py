"""Daily Vehicle Schedule Team Assignment model for standalone daily dispatch."""
from sqlalchemy import Column, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class DailyVehicleScheduleTeamAssignment(BaseModel):
    """Crew member (doctor, nurse, driver, counselor, etc.) assigned to a daily vehicle dispatch run."""
    __tablename__ = 'daily_vehicle_schedule_team_assignments'

    schedule_date = Column(Date, nullable=False, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=True, index=True)
    daily_vehicle_schedule_id = Column(UUID(as_uuid=True), ForeignKey('daily_vehicle_schedules.id', ondelete='SET NULL'), nullable=True, index=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    # Valid roles: Physician, Nurse, Counselor, Physiotherapist, Social Worker, Driver, Coordinator

    # Relationships
    provider = db_relationship('HealthcareProvider', foreign_keys=[provider_id])
    vehicle = db_relationship('Vehicle', foreign_keys=[vehicle_id])
    daily_schedule = db_relationship('DailyVehicleSchedule', foreign_keys=[daily_vehicle_schedule_id])

    __table_args__ = (
        UniqueConstraint('schedule_date', 'role', 'provider_id', 'vehicle_id', name='uq_daily_veh_sched_team'),
    )

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['schedule_date'] = self.schedule_date.isoformat() if self.schedule_date else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['vehicle_name'] = self.vehicle.name if self.vehicle else None
        data['daily_vehicle_schedule_id'] = str(self.daily_vehicle_schedule_id) if self.daily_vehicle_schedule_id else None
        data['provider_id'] = str(self.provider_id) if self.provider_id else None
        data['role'] = self.role
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None

        if self.provider:
            data['provider_name'] = getattr(self.provider, 'full_name', None) or 'Healthcare Provider'
            data['specialization'] = getattr(self.provider, 'specialization', None)
            data['department'] = getattr(self.provider, 'department', None)
        else:
            data['provider_name'] = 'Unknown Provider'
            data['specialization'] = None
            data['department'] = None

        return data
