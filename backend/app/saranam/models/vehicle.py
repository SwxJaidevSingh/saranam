"""Vehicle model for ambulance/vehicle registry."""
from sqlalchemy import Column, String, Integer, Boolean, Text
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.common.models import BaseModel


class Vehicle(BaseModel):
    """Vehicle/ambulance registry."""
    __tablename__ = 'vehicles'

    name = Column(String(100), nullable=False)
    registration_number = Column(String(50))
    vehicle_type = Column(String(50), default='ambulance')
    capacity = Column(Integer, default=6)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Hospital where this vehicle is based (KMIO / KCGH). Drives the route
    # origin for every schedule assigned to this vehicle — route math starts
    # from the base hospital rather than the hardcoded Kidwai. Defaults to
    # Kidwai since the current fleet leaves from there every morning.
    base_hospital = Column(String(10), nullable=False, default='KMIO', server_default='KMIO')

    # Geographic zones/clusters this vehicle is assigned to handle (e.g. ['North', 'South'])
    zones = Column(JSONB, default=[])

    weekly_schedules = db_relationship('WeeklySchedule', backref='vehicle', lazy='dynamic')

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['base_hospital'] = self.base_hospital
        data['zones'] = self.zones or []
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data
