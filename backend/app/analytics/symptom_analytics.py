from typing import Dict, List
from sqlalchemy import func, case
from app.analytics.models import PatientSymptom, PatientLocation
from app.models import Patient
from app.extensions import db

class SymptomAnalyticsService:
    """Analytics service for symptom tracking and analysis"""

    @staticmethod
    def get_symptom_prevalence() -> List[Dict]:
        """
        Calculate prevalence of each symptom type
        """
        total_patients = db.session.query(func.count(Patient.id)).scalar() or 0

        # Get symptom counts with severity breakdown
        symptom_data = db.session.query(
            PatientSymptom.symptom_type,
            PatientSymptom.severity,
            func.count(func.distinct(PatientSymptom.patient_id)).label('patient_count')
        ).filter(
            PatientSymptom.severity != 'None'
        ).group_by(
            PatientSymptom.symptom_type,
            PatientSymptom.severity
        ).all()

        # Aggregate by symptom type
        symptom_prevalence = {}
        for symptom_type, severity, count in symptom_data:
            if symptom_type not in symptom_prevalence:
                symptom_prevalence[symptom_type] = {
                    'symptom_type': symptom_type,
                    'total_count': 0,
                    'percentage': 0,
                    'severity_breakdown': {'Mild': 0, 'Moderate': 0, 'Severe': 0}
                }

            symptom_prevalence[symptom_type]['total_count'] += count
            if severity in symptom_prevalence[symptom_type]['severity_breakdown']:
                symptom_prevalence[symptom_type]['severity_breakdown'][severity] = count

        # Calculate percentages
        result = []
        for symptom_type, data in symptom_prevalence.items():
            data['percentage'] = round((data['total_count'] / total_patients) * 100, 2) if total_patients > 0 else 0
            result.append(data)

        return sorted(result, key=lambda x: x['total_count'], reverse=True)

    @staticmethod
    def get_symptom_by_location() -> Dict:
        """
        Get symptom prevalence by geographic location
        """
        # Join symptoms with patient locations
        data = db.session.query(
            PatientLocation.district,
            PatientSymptom.symptom_type,
            func.count(func.distinct(PatientSymptom.patient_id)).label('count')
        ).join(
            PatientSymptom,
            PatientSymptom.patient_id == PatientLocation.patient_id
        ).filter(
            PatientSymptom.severity != 'None',
            PatientLocation.district.isnot(None)
        ).group_by(
            PatientLocation.district,
            PatientSymptom.symptom_type
        ).all()

        # Build matrix structure
        matrix = {}
        for district, symptom_type, count in data:
            if district not in matrix:
                matrix[district] = {}
            matrix[district][symptom_type] = count

        return matrix

    @staticmethod
    def get_symptom_trends(days: int = 30) -> List[Dict]:
        """
        Get symptom trends over time
        """
        from datetime import datetime, timedelta

        start_date = datetime.now() - timedelta(days=days)

        trends = db.session.query(
            func.date_trunc('day', PatientSymptom.recorded_at).label('date'),
            PatientSymptom.symptom_type,
            func.count(PatientSymptom.id).label('count')
        ).filter(
            PatientSymptom.recorded_at >= start_date,
            PatientSymptom.severity != 'None'
        ).group_by(
            func.date_trunc('day', PatientSymptom.recorded_at),
            PatientSymptom.symptom_type
        ).order_by('date').all()

        return [
            {
                'date': date.isoformat() if hasattr(date, 'isoformat') else str(date),
                'symptom_type': symptom_type,
                'count': count
            }
            for date, symptom_type, count in trends
        ]

    @staticmethod
    def get_symptom_cooccurrence() -> List[Dict]:
        """
        Identify symptoms that commonly occur together
        """
        # Self-join to find symptom pairs
        s1 = db.aliased(PatientSymptom)
        s2 = db.aliased(PatientSymptom)

        pairs = db.session.query(
            s1.symptom_type.label('symptom_1'),
            s2.symptom_type.label('symptom_2'),
            func.count(func.distinct(s1.patient_id)).label('count')
        ).join(
            s2,
            s1.patient_id == s2.patient_id
        ).filter(
            s1.symptom_type < s2.symptom_type,  # Avoid duplicates
            s1.severity != 'None',
            s2.severity != 'None'
        ).group_by(
            s1.symptom_type,
            s2.symptom_type
        ).having(
            func.count(func.distinct(s1.patient_id)) >= 5  # At least 5 co-occurrences
        ).all()

        return [
            {
                'symptom_1': s1,
                'symptom_2': s2,
                'count': count
            }
            for s1, s2, count in pairs
        ]
