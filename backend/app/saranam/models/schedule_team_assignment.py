"""Schedule Team Assignment model."""
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ScheduleTeamAssignment(BaseModel):
    """Team member (provider) assigned to a specific day + vehicle."""
    __tablename__ = 'schedule_team_assignments'

    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id', ondelete='CASCADE'), nullable=False, index=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    # Valid roles: Physician, Nurse, Counselor, Physiotherapist, Social Worker, Driver

    # Vehicle this team member is assigned to (null = default/all vehicles)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id'), nullable=True, index=True)

    provider = db_relationship('HealthcareProvider', foreign_keys=[provider_id])
    vehicle = db_relationship('Vehicle', foreign_keys=[vehicle_id])

    __table_args__ = (
        UniqueConstraint('schedule_day_id', 'role', 'provider_id', 'vehicle_id', name='uq_team_assignment_day_role_provider_vehicle'),
    )

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['schedule_day_id'] = str(self.schedule_day_id) if self.schedule_day_id else None
        data['provider_id'] = str(self.provider_id) if self.provider_id else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['vehicle_name'] = self.vehicle.name if self.vehicle else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if self.provider:
            data['provider_name'] = self.provider.full_name
            data['specialization'] = self.provider.specialization
        return data
