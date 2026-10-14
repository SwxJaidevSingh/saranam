"""Daily Vehicle Route model: shareable Google Maps links for a locked vehicle run."""
from sqlalchemy import Column, Date, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.common.models import BaseModel


class DailyVehicleRoute(BaseModel):
    """Round-trip and one-way route links per vehicle per dispatch date."""
    __tablename__ = 'daily_vehicle_routes'
    __table_args__ = (
        UniqueConstraint('vehicle_id', 'schedule_date', name='unique_vehicle_schedule_date'),
    )

    schedule_date = Column(Date, nullable=False, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    round_trip_url = Column(Text)
    one_way_url = Column(Text)
    round_trip_short_url = Column(Text)
    one_way_short_url = Column(Text)

    def to_dict(self):
        return {
            'vehicle_id': str(self.vehicle_id) if self.vehicle_id else None,
            'schedule_date': self.schedule_date.isoformat() if self.schedule_date else None,
            'round_trip_url': self.round_trip_url,
            'one_way_url': self.one_way_url,
            'round_trip_short_url': self.round_trip_short_url,
            'one_way_short_url': self.one_way_short_url,
        }
