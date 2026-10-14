from typing import Dict, List
from sqlalchemy import func, case, text
from datetime import datetime, timedelta
from app.models import IPDAdmission, Encounter, Patient
from app.extensions import db

class ClinicalAnalyticsService:
    @staticmethod
    def get_length_of_stay_metrics() -> Dict:
        """
        Calculate Average Length of Stay (LoS) for IPD.
        """
        # Average LoS in days
        avg_los = db.session.query(
            func.avg(
                func.extract('epoch', Encounter.discharge_date) - 
                func.extract('epoch', Encounter.admission_date)
            ).label('avg_seconds')
        ).filter(
            Encounter.admission_date != None,
            Encounter.discharge_date != None
        ).scalar() or 0

        # LoS by admission type
        los_by_type = db.session.query(
            IPDAdmission.admission_type,
            func.avg(
                func.extract('epoch', Encounter.discharge_date) - 
                func.extract('epoch', Encounter.admission_date)
            ).label('avg_seconds')
        ).join(Encounter, IPDAdmission.encounter_id == Encounter.id).filter(
            Encounter.admission_date != None,
            Encounter.discharge_date != None
        ).group_by(IPDAdmission.admission_type).all()

        return {
            'average_los_days': round(avg_los / (24 * 3600), 1),
            'by_admission_type': [
                {
                    'type': r.admission_type, 
                    'avg_days': round(r.avg_seconds / (24 * 3600), 1)
                }
                for r in los_by_type
            ]
        }

    @staticmethod
    def get_readmission_rates() -> Dict:
        """
        Calculate 30-day readmission rate.
        A readmission is defined as an IPD admission within 30 days of a previous discharge.
        """
        # Get all admissions sorted by patient and date
        admissions = db.session.query(
            IPDAdmission.patient_id,
            Encounter.admission_date,
            Encounter.discharge_date
        ).join(Encounter, IPDAdmission.encounter_id == Encounter.id).filter(
            Encounter.admission_date.isnot(None)
        ).order_by(IPDAdmission.patient_id, Encounter.admission_date).all()

        total_admissions = len(admissions)
        readmission_count = 0
        
        patient_history = {}
        for patient_id, admission_date, discharge_date in admissions:
            if patient_id in patient_history:
                prev_discharge = patient_history[patient_id]
                if prev_discharge and (admission_date - prev_discharge).days <= 30:
                    readmission_count += 1
            
            patient_history[patient_id] = discharge_date

        return {
            'total_admissions': total_admissions,
            'readmission_count': readmission_count,
            'readmission_rate': round((readmission_count / total_admissions * 100), 1) if total_admissions > 1 else 0
        }

    @staticmethod
    def get_recovery_metrics() -> Dict:
        """
        Analyze discharge types as a proxy for clinical outcomes.
        """
        results = db.session.query(
            IPDAdmission.discharge_type,
            func.count(IPDAdmission.id).label('count')
        ).filter(
            IPDAdmission.discharge_type.isnot(None)
        ).group_by(IPDAdmission.discharge_type).all()

        total = sum(r.count for r in results)

        return {
            'total_discharges': total,
            'distribution': [
                {
                    'type': r.discharge_type,
                    'count': r.count,
                    'percentage': round((r.count / total * 100), 1) if total > 0 else 0
                }
                for r in results
            ]
        }
