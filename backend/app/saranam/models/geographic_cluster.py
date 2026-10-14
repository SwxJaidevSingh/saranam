"""Geographic Cluster model for patient area grouping."""
from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from app.common.models import BaseModel


class GeographicCluster(BaseModel):
    """Geographic cluster for grouping patients by area."""
    __tablename__ = 'geographic_clusters'

    name = Column(String(100), nullable=False, unique=True)
    color_hex = Column(String(7), nullable=False, default='#3B82F6')
    pin_codes = Column(JSONB, default=[])
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data
