"""Schedule Configuration model - singleton settings table."""
from sqlalchemy import Column, String, Integer, Boolean, Time, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import ForeignKey
from app.common.models import BaseModel


class ScheduleConfig(BaseModel):
    """Global scheduling configuration. Single row table."""
    __tablename__ = 'schedule_config'

    # Visit day configuration
    visit_days = Column(JSONB, nullable=False, default=["monday", "tuesday", "thursday", "friday"])
    non_visit_day_labels = Column(JSONB, default={})

    # Planning configuration
    planning_day = Column(String(20), nullable=False, default="friday")
    planning_deadline_time = Column(Time)
    approval_deadline_day = Column(String(20), nullable=False, default="saturday")
    approval_deadline_time = Column(Time)

    # Capacity
    max_patients_per_vehicle_per_day = Column(Integer, nullable=False, default=4)
    recommended_patients_per_day = Column(Integer, nullable=False, default=3)
    active_vehicles = Column(Integer, nullable=False, default=1)

    # Clustering
    cluster_efficiency_target = Column(Numeric(5, 2), nullable=False, default=50.0)

    # Service radius from Kidwai (km)
    service_radius_km = Column(Integer, nullable=False, default=15)

    # Alerts
    visit_gap_alert_threshold_days = Column(Integer, nullable=False, default=7)
    monthly_visit_threshold_days = Column(Integer, nullable=False, default=30)

    # Notifications
    notification_methods = Column(JSONB, default=["in_app"])

    # Proactive calls
    proactive_call_days = Column(JSONB, default=["wednesday", "saturday"])
    proactive_call_window_start = Column(Time)
    proactive_call_window_end = Column(Time)

    # Auto-schedule creation
    auto_create_schedule = Column(Boolean, default=True)

    # Updated by
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['updated_by'] = str(self.updated_by) if self.updated_by else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        data['planning_deadline_time'] = self.planning_deadline_time.isoformat() if self.planning_deadline_time else None
        data['approval_deadline_time'] = self.approval_deadline_time.isoformat() if self.approval_deadline_time else None
        data['proactive_call_window_start'] = self.proactive_call_window_start.isoformat() if self.proactive_call_window_start else None
        data['proactive_call_window_end'] = self.proactive_call_window_end.isoformat() if self.proactive_call_window_end else None
        data['cluster_efficiency_target'] = float(self.cluster_efficiency_target) if self.cluster_efficiency_target is not None else None
        return data
