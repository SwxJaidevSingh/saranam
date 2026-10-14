from typing import Dict, List
from sqlalchemy import func
from app.models import IPDAdmission, Bed, BedAssignment
from app.extensions import db

class OperationalAnalyticsService:
    @staticmethod
    def get_bed_occupancy_metrics() -> Dict:
        """
        Calculate bed occupancy and turnover.
        """
        total_beds = db.session.query(func.count(Bed.id)).filter(Bed.is_active == True).scalar() or 0
        occupied_beds = db.session.query(func.count(Bed.id)).filter(
            Bed.is_active == True,
            Bed.bed_status == 'occupied'
        ).scalar() or 0

        # Occupancy rate by ward
        ward_occupancy = db.session.query(
            Bed.ward_name,
            func.count(Bed.id).label('total'),
            func.sum(case((Bed.bed_status == 'occupied', 1), else_=0)).label('occupied')
        ).filter(Bed.is_active == True).group_by(Bed.ward_name).all()

        return {
            'total_beds': total_beds,
            'occupied_beds': occupied_beds,
            'overall_occupancy_rate': round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0,
            'by_ward': [
                {
                    'ward': r.ward_name,
                    'total': r.total,
                    'occupied': int(r.occupied or 0),
                    'occupancy_rate': round((int(r.occupied or 0) / r.total * 100), 1) if r.total > 0 else 0
                }
                for r in ward_occupancy
            ]
        }

    @staticmethod
    def get_financial_summary() -> Dict:
        """
        Aggregate financial/billing summaries from IPD admissions.
        Note: billing_summary is a JSONB field.
        """
        # This is a simplified aggregation of the JSONB fields
        # In a real system, you'd use PostgreSQL JSONB operators
        admissions = IPDAdmission.query.filter(IPDAdmission.billing_summary.isnot(None)).all()
        
        total_revenue = 0
        total_patients = len(admissions)
        
        for adm in admissions:
            billing = adm.billing_summary
            if isinstance(billing, dict):
                total_revenue += billing.get('total_cost', 0)

        return {
            'total_revenue': total_revenue,
            'total_billed_patients': total_patients,
            'average_revenue_per_patient': round(total_revenue / total_patients, 2) if total_patients > 0 else 0
        }

    @staticmethod
    def get_bed_turnover_rate(days: int = 30) -> float:
        """
        Turnover rate = Total discharges / Total beds
        """
        from datetime import datetime, timedelta
        start_date = datetime.utcnow() - timedelta(days=days)
        
        total_beds = db.session.query(func.count(Bed.id)).filter(Bed.is_active == True).scalar() or 0
        
        discharges = db.session.query(func.count(IPDAdmission.id)).join(
            Encounter, IPDAdmission.encounter_id == Encounter.id
        ).filter(
            Encounter.discharge_date >= start_date
        ).scalar() or 0

        return round(discharges / total_beds, 2) if total_beds > 0 else 0

from sqlalchemy import case
