from typing import Dict, List
from sqlalchemy import func
from app.analytics.models import PatientRiskAssessment, PatientLocation
from app.models import Patient
from app.extensions import db

class RiskAnalyticsService:
    """Analytics for patient risk stratification"""

    @staticmethod
    def get_risk_distribution() -> Dict:
        """
        Get distribution of patients across risk levels
        """
        total_patients = db.session.query(func.count(Patient.id)).filter(
            Patient.is_active == True
        ).scalar() or 0

        # Get latest risk assessment per patient
        subquery = db.session.query(
            PatientRiskAssessment.patient_id,
            func.max(PatientRiskAssessment.assessment_date).label('max_date')
        ).group_by(PatientRiskAssessment.patient_id).subquery()

        latest_assessments = db.session.query(
            PatientRiskAssessment.risk_level,
            func.count(PatientRiskAssessment.id).label('count')
        ).join(
            subquery,
            (PatientRiskAssessment.patient_id == subquery.c.patient_id) &
            (PatientRiskAssessment.assessment_date == subquery.c.max_date)
        ).group_by(
            PatientRiskAssessment.risk_level
        ).all()

        distribution = {}
        # Pre-fill with standard levels
        for level in ['Low', 'Moderate', 'High', 'Critical']:
            distribution[level] = {'count': 0, 'percentage': 0}

        for risk_level, count in latest_assessments:
            if risk_level:
                distribution[risk_level] = {
                    'count': count,
                    'percentage': round((count / total_patients) * 100, 2) if total_patients > 0 else 0
                }

        return distribution

    @staticmethod
    def get_risk_by_location() -> List[Dict]:
        """
        Get risk distribution by geographic location
        """
        data = db.session.query(
            PatientLocation.district,
            PatientRiskAssessment.risk_level,
            func.count(func.distinct(PatientRiskAssessment.patient_id)).label('count')
        ).join(
            PatientLocation,
            PatientLocation.patient_id == PatientRiskAssessment.patient_id
        ).filter(
            PatientLocation.district.isnot(None),
            PatientRiskAssessment.risk_level.isnot(None)
        ).group_by(
            PatientLocation.district,
            PatientRiskAssessment.risk_level
        ).all()

        # Group by location
        location_risk = {}
        for district, risk_level, count in data:
            if district not in location_risk:
                location_risk[district] = {'location': district, 'risk_breakdown': {'Low': 0, 'Moderate': 0, 'High':0, 'Critical': 0}}
            location_risk[district]['risk_breakdown'][risk_level] = count

        return list(location_risk.values())

    @staticmethod
    def get_high_risk_patients(limit: int = 50) -> List[Dict]:
        """
        Get list of high and critical risk patients
        """
        high_risk = db.session.query(
            Patient,
            PatientRiskAssessment
        ).join(
            PatientRiskAssessment,
            PatientRiskAssessment.patient_id == Patient.id
        ).filter(
            PatientRiskAssessment.risk_level.in_(['High', 'Critical']),
            Patient.is_active == True
        ).order_by(
            func.coalesce(PatientRiskAssessment.risk_score, 0).desc()
        ).limit(limit).all()

        return [
            {
                'patient_id': str(patient.id),
                'patient_name': patient.full_name,
                'risk_score': float(assessment.risk_score) if assessment.risk_score else 0,
                'risk_level': assessment.risk_level,
                'assessment_date': assessment.assessment_date.isoformat() if assessment.assessment_date else None,
                'contributing_factors': assessment.contributing_factors
            }
            for patient, assessment in high_risk
        ]

    @staticmethod
    def get_risk_trends(months: int = 6) -> List[Dict]:
        """
        Get risk level trends over time
        """
        from datetime import datetime, timedelta

        start_date = datetime.now() - timedelta(days=months * 30)

        trends = db.session.query(
            func.date_trunc('month', PatientRiskAssessment.assessment_date).label('month'),
            PatientRiskAssessment.risk_level,
            func.count(PatientRiskAssessment.id).label('count')
        ).filter(
            PatientRiskAssessment.assessment_date >= start_date,
            PatientRiskAssessment.risk_level.isnot(None)
        ).group_by(
            func.date_trunc('month', PatientRiskAssessment.assessment_date),
            PatientRiskAssessment.risk_level
        ).order_by('month').all()

        return [
            {
                'month': month.strftime('%Y-%m') if month else '',
                'risk_level': risk_level,
                'count': count
            }
            for month, risk_level, count in trends
        ]
