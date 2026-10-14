"""Vehicle Log model."""
from sqlalchemy import Column, String, Date, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship, backref as db_backref
from app.common.models import BaseModel


class VehicleLog(BaseModel):
    """Daily run logs for vehicles to track mileage, driver, and fuel."""
    __tablename__ = 'vehicle_logs'

    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False, index=True)
    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id', ondelete='SET NULL'), nullable=True, index=True)

    date = Column(Date, nullable=False)
    driver_name = Column(String(100), nullable=False)
    opening_kms = Column(Numeric(10, 1), nullable=False)
    closing_kms = Column(Numeric(10, 1), nullable=True)
    number_of_kms = Column(Numeric(10, 1), nullable=True)
    start_point = Column(String(255), default='Kidwai Hospital')
    destination_point = Column(String(255))
    fuel_liters = Column(Numeric(8, 2), nullable=True)
    mileage = Column(Numeric(8, 2), nullable=True)

    # Relationships
    vehicle = db_relationship('Vehicle', backref='vehicle_logs')
    schedule_day = db_relationship('ScheduleDay', backref=db_backref('vehicle_log', uselist=False))

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['schedule_day_id'] = str(self.schedule_day_id) if self.schedule_day_id else None
        data['date'] = self.date.isoformat() if self.date else None
        data['opening_kms'] = float(self.opening_kms) if self.opening_kms is not None else None
        data['closing_kms'] = float(self.closing_kms) if self.closing_kms is not None else None
        data['number_of_kms'] = float(self.number_of_kms) if self.number_of_kms is not None else None
        data['fuel_liters'] = float(self.fuel_liters) if self.fuel_liters is not None else None
        data['mileage'] = float(self.mileage) if self.mileage is not None else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        data['vehicle_name'] = self.vehicle.name if self.vehicle else None
        return data
