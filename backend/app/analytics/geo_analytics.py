from typing import Dict, List
import math
from sqlalchemy import func
from app.analytics.models import PatientLocation, NearbyHospital, PatientRiskAssessment
from app.models import Patient
from app.extensions import db

class GeoAnalyticsService:
    """Geospatial analytics and mapping services"""

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two points using Haversine formula (km)
        """
        R = 6371  # Earth's radius in kilometers

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    @staticmethod
    def get_patient_locations_with_risk() -> List[Dict]:
        """
        Get all patient locations with risk levels for mapping
        """
        # Get latest risk assessment per patient
        subquery = db.session.query(
            PatientRiskAssessment.patient_id,
            func.max(PatientRiskAssessment.assessment_date).label('max_date')
        ).group_by(PatientRiskAssessment.patient_id).subquery()

        risk_query = db.session.query(
            PatientRiskAssessment.patient_id,
            PatientRiskAssessment.risk_level
        ).join(
            subquery,
            (PatientRiskAssessment.patient_id == subquery.c.patient_id) &
            (PatientRiskAssessment.assessment_date == subquery.c.max_date)
        ).subquery()

        # Get patients with locations and risk
        patients = db.session.query(
            Patient.id,
            Patient.full_name,
            Patient.date_of_birth,
            Patient.gender,
            Patient.external_metadata,
            Patient.linked_hospital,
            Patient.geographic_cluster,
            Patient.latest_pps_score,
            Patient.bsc_status,
            PatientLocation.latitude,
            PatientLocation.longitude,
            PatientLocation.district,
            PatientLocation.address_full,
            risk_query.c.risk_level,
            Patient.is_deceased,
            Patient.is_active,
            Patient.registration_date,
            Patient.created_at
        ).outerjoin(
            PatientLocation,
            PatientLocation.patient_id == Patient.id
        ).outerjoin(
            risk_query,
            risk_query.c.patient_id == Patient.id
        ).all()

        data = []
        for p in patients:
            meta = p.external_metadata or {}
            lat = p.latitude
            lng = p.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            age = None
            if p.date_of_birth:
                from datetime import date
                today = date.today()
                age = today.year - p.date_of_birth.year - ((today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day))

            reg_date = p.registration_date or (p.created_at.date() if p.created_at else None)

            data.append({
                'patient_id': str(p.id),
                'patient_name': p.full_name,
                'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
                'age': age,
                'gender': p.gender or 'Unknown',
                'latitude': lat,
                'longitude': lng,
                'district': p.district or meta.get('location') or meta.get('base_location'),
                'risk_level': p.risk_level or 'Low',
                'linked_hospital': p.linked_hospital,
                'address': p.address_full or (meta.get('address') if isinstance(meta, dict) else None),
                'zone': p.geographic_cluster or 'Central',
                'pps_score': p.latest_pps_score,
                'bsc_status': 'BSC' if p.bsc_status is True else 'Non-BSC' if p.bsc_status is False else 'Not Yet Determined',
                'is_deceased': p.is_deceased,
                'is_active': p.is_active,
                'registration_date': reg_date.isoformat() if reg_date else None,
                'drive_distance_km': meta.get('drive_distance_km')
            })
        return data

    @staticmethod
    def get_nearest_hospitals(patient_id: str, limit: int = 5) -> List[Dict]:
        """
        Find nearest hospitals to a patient
        """
        # Get patient location
        location = db.session.query(PatientLocation).filter(
            PatientLocation.patient_id == patient_id
        ).first()

        if not location or not location.latitude or not location.longitude:
            return []

        # Get all hospitals
        hospitals = db.session.query(NearbyHospital).all()

        # Calculate distances
        hospital_distances = []
        for hospital in hospitals:
            if hospital.latitude and hospital.longitude:
                distance = GeoAnalyticsService.haversine_distance(
                    float(location.latitude),
                    float(location.longitude),
                    float(hospital.latitude),
                    float(hospital.longitude)
                )
                hospital_distances.append({
                    'hospital_id': str(hospital.id),
                    'name': hospital.name,
                    'hospital_type': hospital.hospital_type,
                    'address': hospital.address,
                    'phone': hospital.phone,
                    'website': hospital.website,
                    'latitude': float(hospital.latitude),
                    'longitude': float(hospital.longitude),
                    'distance_km': round(distance, 2)
                })

        # Sort by distance and return top N
        hospital_distances.sort(key=lambda x: x['distance_km'])
        return hospital_distances[:limit]

    @staticmethod
    def get_geographic_distribution() -> Dict:
        """
        Get patient distribution by geographic area
        """
        # Subquery for risk
        subquery = db.session.query(
            PatientRiskAssessment.patient_id,
            func.max(PatientRiskAssessment.assessment_date).label('max_date')
        ).group_by(PatientRiskAssessment.patient_id).subquery()

        risk_query = db.session.query(
            PatientRiskAssessment.patient_id,
            PatientRiskAssessment.risk_score
        ).join(
            subquery,
            (PatientRiskAssessment.patient_id == subquery.c.patient_id) &
            (PatientRiskAssessment.assessment_date == subquery.c.max_date)
        ).subquery()

        distribution = db.session.query(
            PatientLocation.district,
            func.count(func.distinct(PatientLocation.patient_id)).label('patient_count'),
            func.avg(risk_query.c.risk_score).label('avg_risk')
        ).join(
            Patient,
            Patient.id == PatientLocation.patient_id
        ).outerjoin(
            risk_query,
            risk_query.c.patient_id == Patient.id
        ).filter(
            PatientLocation.district.isnot(None),
            Patient.is_active == True
        ).group_by(
            PatientLocation.district
        ).all()

        return {
            district: {
                'patient_count': count,
                'district': district,
                'avg_risk': float(avg_risk) if avg_risk else 0
            }
            for district, count, avg_risk in distribution
        }
