"""
ReportService: Standalone engine for customizable analytics reports.
Handles dataset schemas, column selection, hospital distance resolution,
live preview generation, and direct streaming of Excel (.xlsx) and CSV files.
"""
import io
import math
import csv
import logging
from datetime import datetime, date
from typing import Dict, List, Any, Optional

from sqlalchemy import or_, and_, func
from app.extensions import db
from app.patients.models import Patient
from app.analytics.models import NearbyHospital
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.bereavement_assessment import BereavementAssessment
from app.analytics.analgesics import get_medication_pain_step

logger = logging.getLogger(__name__)

# Standard Hospital GPS Coordinates Catalog
DEFAULT_HOSPITALS = {
    'KMIO': {
        'code': 'KMIO',
        'name': 'Kidwai Memorial Institute of Oncology',
        'short_name': 'Kidwai',
        'lat': 12.9337,
        'lng': 77.5713,
    },
    'KCGH': {
        'code': 'KCGH',
        'name': 'KC General Hospital',
        'short_name': 'KC General',
        'lat': 13.0067,
        'lng': 77.5747,
    },
    'KIMS': {
        'code': 'KIMS',
        'name': 'Kempegowda Institute of Medical Sciences',
        'short_name': 'KIMS',
        'lat': 12.9565,
        'lng': 77.5743,
    },
    'SJMCH': {
        'code': 'SJMCH',
        'name': "St. John's Medical College Hospital",
        'short_name': "St. John's",
        'lat': 12.9332,
        'lng': 77.6244,
    },
    'BBH': {
        'code': 'BBH',
        'name': 'Bangalore Baptist Hospital',
        'short_name': 'Baptist',
        'lat': 13.0282,
        'lng': 77.5896,
    }
}


class ReportService:
    """Service providing dataset schemas, queries, and file generators."""

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate straight-line distance in kilometers using the Haversine formula."""
        R = 6371.0  # Earth's radius in kilometers
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2.0) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(d_lon / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 1)

    @staticmethod
    def resolve_coordinates(meta_dict: Any) -> tuple:
        """
        Extract latitude and longitude floating point numbers from Patient.external_metadata JSONB.
        Supports multiple key patterns ('latitude'/'longitude', 'gps_latitude'/'gps_longitude',
        'lat'/'lng', 'gps': {'lat', 'lng'}, 'location': {'lat', 'lng'}).
        """
        p_lat = None
        p_lng = None

        if not isinstance(meta_dict, dict):
            return p_lat, p_lng

        lat_keys = ['latitude', 'gps_latitude', 'lat', 'patient_latitude', 'geo_latitude']
        lng_keys = ['longitude', 'gps_longitude', 'lng', 'lon', 'patient_longitude', 'geo_longitude']

        for k in lat_keys:
            val = meta_dict.get(k)
            if val is not None and str(val).strip() != '':
                try:
                    p_lat = float(val)
                    break
                except (ValueError, TypeError):
                    pass

        for k in lng_keys:
            val = meta_dict.get(k)
            if val is not None and str(val).strip() != '':
                try:
                    p_lng = float(val)
                    break
                except (ValueError, TypeError):
                    pass

        # Check nested structures in external_metadata
        if p_lat is None or p_lng is None:
            for nested_key in ['gps', 'location', 'coordinates', 'geo']:
                nested = meta_dict.get(nested_key)
                if isinstance(nested, dict):
                    n_lat = nested.get('lat') or nested.get('latitude')
                    n_lng = nested.get('lng') or nested.get('longitude') or nested.get('lon')
                    try:
                        if n_lat is not None and n_lng is not None:
                            return float(n_lat), float(n_lng)
                    except (ValueError, TypeError):
                        pass

        return p_lat, p_lng

    @classmethod
    def get_registered_hospitals(cls) -> Dict[str, Dict[str, Any]]:
        """Return merged dictionary of default and database-registered hospitals."""
        hospitals = dict(DEFAULT_HOSPITALS)
        try:
            db_hospitals = NearbyHospital.query.all()
            for h in db_hospitals:
                if h.latitude and h.longitude:
                    code = (h.name[:4].upper() if len(h.name) >= 4 else h.name.upper()).replace(' ', '')
                    if code not in hospitals:
                        hospitals[code] = {
                            'code': code,
                            'name': h.name,
                            'short_name': h.name.split()[0],
                            'lat': float(h.latitude),
                            'lng': float(h.longitude)
                        }
        except Exception as e:
            logger.warning("Could not load NearbyHospital table: %s", e)
        return hospitals

    @classmethod
    def get_dataset_schemas(cls) -> Dict[str, Any]:
        """Return all available datasets with categorized columns and filter configurations."""
        hospitals = cls.get_registered_hospitals()
        hospital_options = [
            {'code': k, 'name': v['name'], 'short_name': v['short_name'], 'lat': v['lat'], 'lng': v['lng']}
            for k, v in hospitals.items()
        ]

        # Build column list with all registered hospitals in Geospatial & Location category
        patient_columns = [
            {'id': 'uhid', 'label': 'UHID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
            {'id': 'hospital_uhid', 'label': 'Hospital UHID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
            {'id': 'full_name', 'label': 'Patient Name', 'category': 'Demographics', 'default': True, 'type': 'string'},
            {'id': 'age', 'label': 'Age', 'category': 'Demographics', 'default': True, 'type': 'number'},
            {'id': 'gender', 'label': 'Gender', 'category': 'Demographics', 'default': True, 'type': 'string'},
            {'id': 'date_of_birth', 'label': 'Date of Birth', 'category': 'Demographics', 'default': False, 'type': 'date'},
            {'id': 'is_bangalore_resident', 'label': 'Bangalore Resident', 'category': 'Demographics', 'default': False, 'type': 'boolean'},
            {'id': 'geographic_cluster', 'label': 'Zone / Cluster', 'category': 'Geospatial & Location', 'default': True, 'type': 'string'},
            {'id': 'address', 'label': 'Address', 'category': 'Geospatial & Location', 'default': True, 'type': 'string'},
            {'id': 'base_location', 'label': 'Base Location', 'category': 'Geospatial & Location', 'default': False, 'type': 'string'},
            {'id': 'latitude', 'label': 'Latitude', 'category': 'Geospatial & Location', 'default': False, 'type': 'number'},
            {'id': 'longitude', 'label': 'Longitude', 'category': 'Geospatial & Location', 'default': False, 'type': 'number'},
            {'id': 'location_pin_url', 'label': 'Maps Pin URL', 'category': 'Geospatial & Location', 'default': False, 'type': 'string'},
            {'id': 'distance_kmio', 'label': 'Distance to Kidwai (KMIO) (km)', 'category': 'Geospatial & Location', 'default': True, 'type': 'number'},
            {'id': 'distance_kcgh', 'label': 'Distance to KC General (KCGH) (km)', 'category': 'Geospatial & Location', 'default': True, 'type': 'number'},
            {'id': 'religion', 'label': 'Religion', 'category': 'Demographics', 'default': False, 'type': 'string'},
            {'id': 'marital_status', 'label': 'Marital Status', 'category': 'Demographics', 'default': False, 'type': 'string'},
            {'id': 'occupation', 'label': 'Occupation', 'category': 'Demographics', 'default': False, 'type': 'string'},
            {'id': 'educational_status', 'label': 'Educational Status', 'category': 'Demographics', 'default': False, 'type': 'string'},
            {'id': 'preferred_language', 'label': 'Preferred Language', 'category': 'Demographics', 'default': False, 'type': 'string'},
        ]
        # Add dynamic columns for other registered hospitals (KIMS, St. John's, Baptist, etc.)
        for h_code, h_data in hospitals.items():
            if h_code not in ('KMIO', 'KCGH'):
                patient_columns.append({
                    'id': f'distance_{h_code.lower()}',
                    'label': f'Distance to {h_data["short_name"]} (km)',
                    'category': 'Geospatial & Location',
                    'default': False,
                    'type': 'number'
                })
        patient_columns.extend([
            {'id': 'distance_linked', 'label': 'Distance to Linked Hospital (km)', 'category': 'Geospatial & Location', 'default': False, 'type': 'number'},
            {'id': 'nearest_hospital', 'label': 'Nearest Hospital Name', 'category': 'Geospatial & Location', 'default': False, 'type': 'string'},
            {'id': 'nearest_hospital_dist', 'label': 'Nearest Hospital Distance (km)', 'category': 'Geospatial & Location', 'default': False, 'type': 'number'},
            {'id': 'linked_hospital', 'label': 'Linked Primary Hospital', 'category': 'Clinical Status', 'default': True, 'type': 'string'},
            {'id': 'care_status', 'label': 'Care Status', 'category': 'Clinical Status', 'default': True, 'type': 'string'},
            {'id': 'clinical_complexity', 'label': 'Complexity Tier', 'category': 'Clinical Status', 'default': True, 'type': 'string'},
            {'id': 'latest_pps_score', 'label': 'Latest PPS Score (%)', 'category': 'Clinical Status', 'default': True, 'type': 'number'},
            {'id': 'diagnosis', 'label': 'Primary Diagnosis', 'category': 'Clinical Status', 'default': True, 'type': 'string'},
            {'id': 'bsc_status', 'label': 'BSC Status', 'category': 'Clinical Status', 'default': False, 'type': 'string'},
            {'id': 'is_onco', 'label': 'Oncology Patient', 'category': 'Clinical Status', 'default': False, 'type': 'boolean'},
            {'id': 'primary_caregiver_name', 'label': 'Caregiver Name', 'category': 'Care Team & Contact', 'default': False, 'type': 'string'},
            {'id': 'primary_caregiver_phone', 'label': 'Caregiver Phone', 'category': 'Care Team & Contact', 'default': False, 'type': 'string'},
            {'id': 'origin_type', 'label': 'Referral Origin', 'category': 'Care Team & Contact', 'default': False, 'type': 'string'},
            {'id': 'referred_from', 'label': 'Referred From', 'category': 'Care Team & Contact', 'default': False, 'type': 'string'},
            {'id': 'is_deceased', 'label': 'Is Deceased', 'category': 'Outcomes', 'default': True, 'type': 'boolean'},
            {'id': 'date_of_death', 'label': 'Date of Death', 'category': 'Outcomes', 'default': False, 'type': 'date'},
            {'id': 'place_of_death', 'label': 'Place of Death', 'category': 'Outcomes', 'default': False, 'type': 'string'},
            {'id': 'registration_date', 'label': 'Registration Date', 'category': 'Metadata', 'default': True, 'type': 'date'},
            {'id': 'created_at', 'label': 'System Created At', 'category': 'Metadata', 'default': False, 'type': 'date'},
        ])

        datasets = [
            {
                'id': 'patients',
                'name': 'Patient Demographics & Status',
                'description': 'Patient records, clinical complexity, care status, and geospatial hospital distances',
                'date_fields': [
                    {'id': 'registration_date', 'label': 'Registration Date (Default)'},
                    {'id': 'created_at', 'label': 'System Created Date'},
                    {'id': 'date_of_death', 'label': 'Date of Death (Deceased Only)'}
                ],
                'default_date_field': 'registration_date',
                'columns': patient_columns
            },
            {
                'id': 'visits',
                'name': 'Visits & Encounters',
                'description': 'Home care and clinical visits conducted, healthcare teams, and visit outcomes',
                'date_fields': [
                    {'id': 'visit_date', 'label': 'Visit Date (Default)'},
                    {'id': 'created_at', 'label': 'Record Created Date'}
                ],
                'default_date_field': 'visit_date',
                'columns': [
                    {'id': 'visit_id', 'label': 'Visit ID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
                    {'id': 'uhid', 'label': 'Patient UHID', 'category': 'Patient Info', 'default': True, 'type': 'string'},
                    {'id': 'patient_name', 'label': 'Patient Name', 'category': 'Patient Info', 'default': True, 'type': 'string'},
                    {'id': 'visit_date', 'label': 'Visit Date', 'category': 'Visit Details', 'default': True, 'type': 'date'},
                    {'id': 'visit_type', 'label': 'Visit Type', 'category': 'Visit Details', 'default': True, 'type': 'string'},
                    {'id': 'status', 'label': 'Status', 'category': 'Visit Details', 'default': True, 'type': 'string'},
                    {'id': 'cluster', 'label': 'Zone / Cluster', 'category': 'Visit Details', 'default': True, 'type': 'string'},
                    {'id': 'distance_kmio', 'label': 'Patient Dist to Kidwai (km)', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'distance_kcgh', 'label': 'Patient Dist to KCGH (km)', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'latitude', 'label': 'Latitude', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'longitude', 'label': 'Longitude', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'pain_score', 'label': 'Recorded Pain Score', 'category': 'Clinical', 'default': True, 'type': 'number'},
                    {'id': 'doctor_name', 'label': 'Doctor', 'category': 'Team', 'default': True, 'type': 'string'},
                    {'id': 'nurse_name', 'label': 'Nurse', 'category': 'Team', 'default': True, 'type': 'string'},
                    {'id': 'social_worker_name', 'label': 'Social Worker', 'category': 'Team', 'default': False, 'type': 'string'},
                    {'id': 'driver_name', 'label': 'Driver', 'category': 'Team', 'default': False, 'type': 'string'},
                    {'id': 'notes', 'label': 'Visit Notes', 'category': 'Clinical', 'default': False, 'type': 'string'},
                ]
            },
            {
                'id': 'vitals',
                'name': 'Clinical Vitals & ESAS Scores',
                'description': 'Palliative assessments, Edmonton Symptom Assessment System (ESAS), PPS functional scores, and vital signs',
                'date_fields': [
                    {'id': 'assessment_date', 'label': 'Assessment Date (Default)'},
                ],
                'default_date_field': 'assessment_date',
                'columns': [
                    {'id': 'uhid', 'label': 'Patient UHID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
                    {'id': 'patient_name', 'label': 'Patient Name', 'category': 'Patient Info', 'default': True, 'type': 'string'},
                    {'id': 'assessment_date', 'label': 'Assessment Date', 'category': 'Clinical Assessment', 'default': True, 'type': 'date'},
                    {'id': 'pain_score', 'label': 'Pain Score (0-10)', 'category': 'Symptoms & Scores', 'default': True, 'type': 'number'},
                    {'id': 'pps_score', 'label': 'PPS Score (%)', 'category': 'Symptoms & Scores', 'default': True, 'type': 'number'},
                    {'id': 'blood_pressure', 'label': 'Blood Pressure', 'category': 'Vital Signs', 'default': True, 'type': 'string'},
                    {'id': 'heart_rate', 'label': 'Heart Rate (bpm)', 'category': 'Vital Signs', 'default': True, 'type': 'number'},
                    {'id': 'respiratory_rate', 'label': 'Respiratory Rate', 'category': 'Vital Signs', 'default': False, 'type': 'number'},
                    {'id': 'spo2', 'label': 'SpO2 (%)', 'category': 'Vital Signs', 'default': True, 'type': 'number'},
                    {'id': 'temperature', 'label': 'Temperature (°F)', 'category': 'Vital Signs', 'default': False, 'type': 'number'},
                    {'id': 'blood_sugar', 'label': 'Blood Sugar (mg/dL)', 'category': 'Vital Signs', 'default': False, 'type': 'number'},
                    {'id': 'esas_total', 'label': 'ESAS Total Score', 'category': 'Symptoms & Scores', 'default': True, 'type': 'number'},
                    {'id': 'esas_pain', 'label': 'ESAS Pain', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_tiredness', 'label': 'ESAS Tiredness', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_nausea', 'label': 'ESAS Nausea', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_depression', 'label': 'ESAS Depression', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_anxiety', 'label': 'ESAS Anxiety', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_drowsiness', 'label': 'ESAS Drowsiness', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_appetite', 'label': 'ESAS Appetite', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_wellbeing', 'label': 'ESAS Well-being', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                    {'id': 'esas_sob', 'label': 'ESAS Shortness of Breath', 'category': 'Symptoms & Scores', 'default': False, 'type': 'number'},
                ]
            },
            {
                'id': 'prescriptions',
                'name': 'Prescriptions & WHO Pain Ladder',
                'description': 'Active medication regimens, analgesics classification (Step 1/2/3), and dosages',
                'date_fields': [
                    {'id': 'prescription_date', 'label': 'Prescription Date (Default)'},
                ],
                'default_date_field': 'prescription_date',
                'columns': [
                    {'id': 'uhid', 'label': 'Patient UHID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
                    {'id': 'patient_name', 'label': 'Patient Name', 'category': 'Patient Info', 'default': True, 'type': 'string'},
                    {'id': 'prescription_date', 'label': 'Prescription Date', 'category': 'Prescription Info', 'default': True, 'type': 'date'},
                    {'id': 'medication_name', 'label': 'Medication Name', 'category': 'Medication Details', 'default': True, 'type': 'string'},
                    {'id': 'dosage', 'label': 'Dosage / Strength', 'category': 'Medication Details', 'default': True, 'type': 'string'},
                    {'id': 'frequency', 'label': 'Frequency', 'category': 'Medication Details', 'default': True, 'type': 'string'},
                    {'id': 'route', 'label': 'Route', 'category': 'Medication Details', 'default': False, 'type': 'string'},
                    {'id': 'pain_ladder_step', 'label': 'WHO Pain Ladder Step', 'category': 'Pain Management', 'default': True, 'type': 'string'},
                    {'id': 'is_opioid', 'label': 'Is Opioid', 'category': 'Pain Management', 'default': True, 'type': 'boolean'},
                    {'id': 'instructions', 'label': 'Instructions', 'category': 'Medication Details', 'default': False, 'type': 'string'},
                ]
            },
            {
                'id': 'bereavement',
                'name': 'Deceased & Bereavement Outcomes',
                'description': 'Palliative mortality outcomes, place of death (home vs hospital), length of palliative care, and bereavement follow-ups',
                'date_fields': [
                    {'id': 'date_of_death', 'label': 'Date of Death (Default)'},
                    {'id': 'registration_date', 'label': 'Registration Date'}
                ],
                'default_date_field': 'date_of_death',
                'columns': [
                    {'id': 'uhid', 'label': 'Patient UHID', 'category': 'Identifiers', 'default': True, 'type': 'string'},
                    {'id': 'patient_name', 'label': 'Patient Name', 'category': 'Patient Info', 'default': True, 'type': 'string'},
                    {'id': 'gender', 'label': 'Gender', 'category': 'Demographics', 'default': True, 'type': 'string'},
                    {'id': 'age', 'label': 'Age', 'category': 'Demographics', 'default': True, 'type': 'number'},
                    {'id': 'date_of_death', 'label': 'Date of Death', 'category': 'Mortality Outcomes', 'default': True, 'type': 'date'},
                    {'id': 'place_of_death', 'label': 'Place of Death', 'category': 'Mortality Outcomes', 'default': True, 'type': 'string'},
                    {'id': 'place_of_death_remarks', 'label': 'Place of Death Remarks', 'category': 'Mortality Outcomes', 'default': False, 'type': 'string'},
                    {'id': 'days_in_care', 'label': 'Days Enrolled in Care', 'category': 'Program Metrics', 'default': True, 'type': 'number'},
                    {'id': 'total_visits', 'label': 'Total Home Visits Received', 'category': 'Program Metrics', 'default': True, 'type': 'number'},
                    {'id': 'distance_kmio', 'label': 'Distance to Kidwai (km)', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'distance_kcgh', 'label': 'Distance to KCGH (km)', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'latitude', 'label': 'Latitude', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'longitude', 'label': 'Longitude', 'category': 'Geospatial', 'default': False, 'type': 'number'},
                    {'id': 'bereavement_visit_done', 'label': 'Bereavement Visit Completed', 'category': 'Program Metrics', 'default': True, 'type': 'boolean'},
                    {'id': 'registration_date', 'label': 'Registration Date', 'category': 'Metadata', 'default': False, 'type': 'date'},
                ]
            }
        ]

        return {
            'datasets': datasets,
            'hospitals': hospital_options
        }

    # -------------------------------------------------------------------------
    # Core Data Extraction Helper
    # -------------------------------------------------------------------------
    @classmethod
    def fetch_data_records(
        cls,
        dataset: str,
        date_field: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        selected_columns: Optional[List[str]] = None,
        custom_hospital_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch and normalize records based on dataset, filters, and custom parameters."""
        filters = filters or {}
        registered_hospitals = cls.get_registered_hospitals()
        records: List[Dict[str, Any]] = []

        start_d: Optional[date] = None
        end_d: Optional[date] = None
        if start_date:
            try:
                start_d = datetime.strptime(start_date.split('T')[0], '%Y-%m-%d').date()
            except Exception:
                pass
        if end_date:
            try:
                end_d = datetime.strptime(end_date.split('T')[0], '%Y-%m-%d').date()
            except Exception:
                pass

        if dataset == 'patients':
            query = db.session.query(Patient)

            # Date Filtering
            date_col = date_field or 'registration_date'
            if date_col == 'created_at':
                if start_d:
                    query = query.filter(Patient.created_at >= datetime.combine(start_d, datetime.min.time()))
                if end_d:
                    query = query.filter(Patient.created_at <= datetime.combine(end_d, datetime.max.time()))
            elif date_col == 'date_of_death':
                query = query.filter(Patient.is_deceased.is_(True))
                if start_d:
                    query = query.filter(Patient.date_of_death >= start_d)
                if end_d:
                    query = query.filter(Patient.date_of_death <= end_d)
            else:  # default: registration_date
                if start_d:
                    query = query.filter(
                        or_(
                            Patient.registration_date >= start_d,
                            and_(Patient.registration_date.is_(None), Patient.created_at >= datetime.combine(start_d, datetime.min.time()))
                        )
                    )
                if end_d:
                    query = query.filter(
                        or_(
                            Patient.registration_date <= end_d,
                            and_(Patient.registration_date.is_(None), Patient.created_at <= datetime.combine(end_d, datetime.max.time()))
                        )
                    )

            # Additional Filters
            care_status = filters.get('care_status')
            if care_status and care_status != 'all':
                if care_status == 'deceased':
                    query = query.filter(Patient.is_deceased.is_(True))
                elif care_status == 'alive':
                    query = query.filter(Patient.is_deceased.is_(False))
                elif care_status in ('active', 'inactive'):
                    query = query.filter(Patient.care_status == care_status, Patient.is_deceased.is_(False))

            cluster = filters.get('cluster')
            if cluster and cluster != 'all':
                query = query.filter(Patient.geographic_cluster == cluster)

            linked_hosp = filters.get('linked_hospital')
            if linked_hosp and linked_hosp != 'all':
                query = query.filter(Patient.linked_hospital == linked_hosp)

            results = query.order_by(Patient.registration_date.desc().nullslast(), Patient.created_at.desc()).all()

            for p in results:
                meta = p.external_metadata if isinstance(p.external_metadata, dict) else {}
                p_lat, p_lng = cls.resolve_coordinates(meta)

                # Distance resolution: Check stored drive_distance_km first
                stored_drive_dist = meta.get('drive_distance_km')
                try:
                    stored_drive_dist = float(stored_drive_dist) if stored_drive_dist is not None else None
                except (ValueError, TypeError):
                    stored_drive_dist = None

                # Kidwai distance
                dist_kmio = None
                if p.linked_hospital == 'KMIO' and stored_drive_dist is not None:
                    dist_kmio = stored_drive_dist
                elif p_lat and p_lng and 'KMIO' in registered_hospitals:
                    h = registered_hospitals['KMIO']
                    dist_kmio = cls.haversine_distance(p_lat, p_lng, h['lat'], h['lng'])

                # KCGH distance
                dist_kcgh = None
                if p.linked_hospital == 'KCGH' and stored_drive_dist is not None:
                    dist_kcgh = stored_drive_dist
                elif p_lat and p_lng and 'KCGH' in registered_hospitals:
                    h = registered_hospitals['KCGH']
                    dist_kcgh = cls.haversine_distance(p_lat, p_lng, h['lat'], h['lng'])

                # Linked hospital distance
                dist_linked = None
                if stored_drive_dist is not None:
                    dist_linked = stored_drive_dist
                elif p.linked_hospital and p.linked_hospital in registered_hospitals and p_lat and p_lng:
                    h = registered_hospitals[p.linked_hospital]
                    dist_linked = cls.haversine_distance(p_lat, p_lng, h['lat'], h['lng'])

                # Nearest hospital among catalog
                nearest_hosp_name = None
                nearest_dist = None
                if p_lat and p_lng:
                    min_dist = float('inf')
                    for h_code, h_data in registered_hospitals.items():
                        d = cls.haversine_distance(p_lat, p_lng, h_data['lat'], h_data['lng'])
                        if d < min_dist:
                            min_dist = d
                            nearest_hosp_name = h_data['short_name']
                            nearest_dist = d

                # Age calculation
                age = None
                if p.date_of_birth:
                    today = date.today()
                    age = today.year - p.date_of_birth.year - (
                        (today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day)
                    )

                # Address resolution: external_metadata -> decrypted address
                decrypted_addr = None
                try:
                    if hasattr(p, 'get_address') and p.address_encrypted:
                        decrypted_addr = p.get_address()
                except Exception:
                    pass

                patient_addr = (
                    meta.get('base_location')
                    or meta.get('address')
                    or meta.get('location')
                    or decrypted_addr
                    or meta.get('district')
                    or meta.get('city')
                    or 'N/A'
                )

                rec = {
                    'uhid': p.uhid or 'N/A',
                    'hospital_uhid': p.hospital_uhid or meta.get('hospital_uhid') or 'N/A',
                    'full_name': p.full_name or 'N/A',
                    'age': age if age is not None else 'N/A',
                    'gender': p.gender or 'N/A',
                    'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else 'N/A',
                    'is_bangalore_resident': 'Yes' if p.is_bangalore_resident else 'No',
                    'geographic_cluster': p.geographic_cluster or 'Unassigned',
                    'address': patient_addr,
                    'district': patient_addr,
                    'base_location': meta.get('base_location') or 'N/A',
                    'latitude': round(p_lat, 6) if p_lat is not None else 'N/A',
                    'longitude': round(p_lng, 6) if p_lng is not None else 'N/A',
                    'location_pin_url': meta.get('location_pin_url') or 'N/A',
                    'distance_kmio': dist_kmio if dist_kmio is not None else 'N/A',
                    'distance_kcgh': dist_kcgh if dist_kcgh is not None else 'N/A',
                    'distance_linked': dist_linked if dist_linked is not None else 'N/A',
                    'nearest_hospital': nearest_hosp_name or 'N/A',
                    'nearest_hospital_dist': nearest_dist if nearest_dist is not None else 'N/A',
                    'linked_hospital': p.linked_hospital or 'KMIO',
                    'care_status': 'Deceased' if p.is_deceased else (p.care_status.capitalize() if p.care_status else 'Active'),
                    'clinical_complexity': (p.clinical_complexity or 'Not Determined').capitalize(),
                    'latest_pps_score': p.latest_pps_score if p.latest_pps_score is not None else 'N/A',
                    'diagnosis': p.diagnosis or 'N/A',
                    'bsc_status': 'BSC' if p.bsc_status is True else ('Non-BSC' if p.bsc_status is False else 'Not Determined'),
                    'is_onco': 'Yes' if p.is_onco is True else ('No' if p.is_onco is False else 'N/A'),
                    'primary_caregiver_name': p.primary_caregiver_name or meta.get('relation_primary') or 'N/A',
                    'primary_caregiver_phone': p.primary_caregiver_phone or 'N/A',
                    'religion': meta.get('religion') or 'N/A',
                    'marital_status': meta.get('marital_status') or 'N/A',
                    'occupation': meta.get('occupation') or 'N/A',
                    'educational_status': meta.get('educational_status') or 'N/A',
                    'preferred_language': meta.get('preferred_language') or 'N/A',
                    'origin_type': (p.origin_type or 'N/A').capitalize(),
                    'referred_from': p.referred_from or 'N/A',
                    'is_deceased': 'Yes' if p.is_deceased else 'No',
                    'date_of_death': p.date_of_death.isoformat() if p.date_of_death else 'N/A',
                    'place_of_death': (p.place_of_death or 'N/A').capitalize(),
                    'registration_date': p.registration_date.isoformat() if p.registration_date else (p.created_at.date().isoformat() if p.created_at else 'N/A'),
                    'created_at': p.created_at.date().isoformat() if p.created_at else 'N/A'
                }

                # Populate distances for all registered hospitals (e.g. distance_kims, distance_sjmch, distance_bbh)
                for h_code, h_data in registered_hospitals.items():
                    col_id = f'distance_{h_code.lower()}'
                    if col_id not in rec:
                        rec[col_id] = (
                            cls.haversine_distance(p_lat, p_lng, h_data['lat'], h_data['lng'])
                            if p_lat and p_lng else 'N/A'
                        )

                records.append(rec)

        elif dataset == 'visits':
            query = db.session.query(
                PatientVisit,
                Patient.full_name,
                Patient.uhid,
                Patient.geographic_cluster,
                Patient.external_metadata
            ).join(
                Patient, PatientVisit.patient_id == Patient.id
            )

            date_col = date_field or 'visit_date'
            if date_col == 'created_at':
                if start_d:
                    query = query.filter(func.date(PatientVisit.created_at) >= start_d)
                if end_d:
                    query = query.filter(func.date(PatientVisit.created_at) <= end_d)
            else:
                if start_d:
                    query = query.filter(
                        or_(
                            PatientVisit.visit_date >= start_d,
                            and_(PatientVisit.visit_date.is_(None), func.date(PatientVisit.created_at) >= start_d)
                        )
                    )
                if end_d:
                    query = query.filter(
                        or_(
                            PatientVisit.visit_date <= end_d,
                            and_(PatientVisit.visit_date.is_(None), func.date(PatientVisit.created_at) <= end_d)
                        )
                    )

            results = query.order_by(PatientVisit.visit_date.desc()).all()
            for v, p_name, uhid, p_cluster, p_meta in results:
                meta = p_meta if isinstance(p_meta, dict) else {}
                p_lat, p_lng = cls.resolve_coordinates(meta)

                dist_kmio = (
                    cls.haversine_distance(p_lat, p_lng, registered_hospitals['KMIO']['lat'], registered_hospitals['KMIO']['lng'])
                    if p_lat and p_lng and 'KMIO' in registered_hospitals else 'N/A'
                )
                dist_kcgh = (
                    cls.haversine_distance(p_lat, p_lng, registered_hospitals['KCGH']['lat'], registered_hospitals['KCGH']['lng'])
                    if p_lat and p_lng and 'KCGH' in registered_hospitals else 'N/A'
                )

                # Extract team member names safely from team_members JSONB
                team_data = getattr(v, 'team_members', None)
                doctor_name = 'N/A'
                nurse_name = 'N/A'
                social_worker_name = 'N/A'
                driver_name = 'N/A'

                if isinstance(team_data, dict):
                    doctor_name = team_data.get('doctor') or 'N/A'
                    nurse_name = team_data.get('nurse') or 'N/A'
                    social_worker_name = team_data.get('social_worker') or 'N/A'
                    driver_name = team_data.get('driver') or 'N/A'
                elif isinstance(team_data, list):
                    for member in team_data:
                        if isinstance(member, dict):
                            role = (member.get('role') or '').lower()
                            name = member.get('name') or member.get('full_name') or 'N/A'
                            if 'doc' in role or 'physician' in role:
                                doctor_name = name
                            elif 'nurse' in role:
                                nurse_name = name
                            elif 'social' in role or 'counsel' in role:
                                social_worker_name = name
                            elif 'driver' in role:
                                driver_name = name

                # Blood pressure format
                bp = 'N/A'
                if v.vitals_bp_systolic and v.vitals_bp_diastolic:
                    bp = f"{v.vitals_bp_systolic}/{v.vitals_bp_diastolic}"
                elif v.vitals_bp_systolic:
                    bp = str(v.vitals_bp_systolic)

                records.append({
                    'visit_id': str(v.id)[:8],
                    'uhid': uhid or 'N/A',
                    'patient_name': p_name or 'N/A',
                    'visit_date': v.visit_date.isoformat() if v.visit_date else 'N/A',
                    'visit_type': (v.visit_type or 'Follow Up').replace('_', ' ').title(),
                    'status': (v.status or 'Completed').capitalize(),
                    'cluster': p_cluster or 'N/A',
                    'latitude': round(p_lat, 6) if p_lat is not None else 'N/A',
                    'longitude': round(p_lng, 6) if p_lng is not None else 'N/A',
                    'distance_kmio': dist_kmio,
                    'distance_kcgh': dist_kcgh,
                    'pain_score': 'N/A',
                    'doctor_name': doctor_name,
                    'nurse_name': nurse_name,
                    'social_worker_name': social_worker_name,
                    'driver_name': driver_name,
                    'notes': v.visit_summary or getattr(v, 'follow_up_advice', 'N/A') or 'N/A'
                })

        elif dataset == 'vitals':
            from app.saranam.models.esas_score import EsasScore

            query = db.session.query(
                PatientVisit,
                Patient.full_name,
                Patient.uhid,
                Patient.latest_pps_score,
                NursingAssessment.pain_score.label('na_pain_score'),
                EsasScore
            ).join(
                Patient, PatientVisit.patient_id == Patient.id
            ).outerjoin(
                NursingAssessment, NursingAssessment.visit_id == PatientVisit.id
            ).outerjoin(
                EsasScore, EsasScore.visit_id == PatientVisit.id
            )

            if start_d:
                query = query.filter(
                    or_(
                        PatientVisit.visit_date >= start_d,
                        and_(PatientVisit.visit_date.is_(None), func.date(PatientVisit.created_at) >= start_d)
                    )
                )
            if end_d:
                query = query.filter(
                    or_(
                        PatientVisit.visit_date <= end_d,
                        and_(PatientVisit.visit_date.is_(None), func.date(PatientVisit.created_at) <= end_d)
                    )
                )

            results = query.order_by(PatientVisit.visit_date.desc()).all()
            for v, p_name, uhid, pps, na_pain, esas in results:
                bp = 'N/A'
                if v.vitals_bp_systolic and v.vitals_bp_diastolic:
                    bp = f"{v.vitals_bp_systolic}/{v.vitals_bp_diastolic}"
                elif v.vitals_bp_systolic:
                    bp = str(v.vitals_bp_systolic)

                pain_val = na_pain if na_pain is not None else (esas.pain if esas and esas.pain is not None else 'N/A')

                records.append({
                    'uhid': uhid or 'N/A',
                    'patient_name': p_name or 'N/A',
                    'assessment_date': v.visit_date.isoformat() if v.visit_date else 'N/A',
                    'pain_score': pain_val,
                    'pps_score': pps if pps is not None else 'N/A',
                    'blood_pressure': bp,
                    'heart_rate': v.vitals_pr if v.vitals_pr is not None else 'N/A',
                    'respiratory_rate': v.vitals_rr if v.vitals_rr is not None else 'N/A',
                    'spo2': float(v.vitals_spo2) if v.vitals_spo2 is not None else 'N/A',
                    'temperature': str(v.vitals_temperature) if v.vitals_temperature else 'N/A',
                    'blood_sugar': float(v.vitals_grbs) if v.vitals_grbs is not None else 'N/A',
                    'esas_total': esas.total_score if esas and esas.total_score is not None else 'N/A',
                    'esas_pain': esas.pain if esas and esas.pain is not None else 'N/A',
                    'esas_tiredness': esas.tiredness if esas and esas.tiredness is not None else 'N/A',
                    'esas_nausea': esas.nausea if esas and esas.nausea is not None else 'N/A',
                    'esas_depression': esas.depression if esas and esas.depression is not None else 'N/A',
                    'esas_anxiety': esas.anxiety if esas and esas.anxiety is not None else 'N/A',
                    'esas_drowsiness': esas.drowsiness if esas and esas.drowsiness is not None else 'N/A',
                    'esas_appetite': esas.appetite if esas and esas.appetite is not None else 'N/A',
                    'esas_wellbeing': esas.wellbeing if esas and esas.wellbeing is not None else 'N/A',
                    'esas_sob': esas.shortness_of_breath if esas and esas.shortness_of_breath is not None else 'N/A'
                })

        elif dataset == 'prescriptions':
            query = db.session.query(
                PlanOfCare,
                Patient.full_name,
                Patient.uhid
            ).join(
                Patient, PlanOfCare.patient_id == Patient.id
            )

            if start_d:
                query = query.filter(func.date(PlanOfCare.created_at) >= start_d)
            if end_d:
                query = query.filter(func.date(PlanOfCare.created_at) <= end_d)

            results = query.order_by(PlanOfCare.created_at.desc()).all()
            for poc, p_name, uhid in results:
                meds = poc.medications if isinstance(poc.medications, list) else []
                for med in meds:
                    if not isinstance(med, dict):
                        continue
                    med_name = med.get('name') or med.get('medication_name') or 'N/A'
                    step = get_medication_pain_step(med_name, med.get('schedule_mode'))
                    step_label = (
                        "Step 1 (Non-Opioid)" if step == 1 else
                        "Step 2 (Weak Opioid)" if step == 2 else
                        "Step 3 (Strong Opioid)" if step == 3 else "Non-Analgesic"
                    )
                    records.append({
                        'uhid': uhid or 'N/A',
                        'patient_name': p_name or 'N/A',
                        'prescription_date': poc.created_at.date().isoformat() if poc.created_at else 'N/A',
                        'medication_name': med_name,
                        'dosage': med.get('dosage') or med.get('dose') or 'N/A',
                        'frequency': med.get('frequency') or 'N/A',
                        'route': med.get('route') or 'Oral',
                        'pain_ladder_step': step_label,
                        'is_opioid': 'Yes' if step in (2, 3) else 'No',
                        'instructions': med.get('instructions') or med.get('remarks') or 'N/A'
                    })

        elif dataset == 'bereavement':
            query = db.session.query(Patient).filter(
                Patient.is_deceased.is_(True)
            )

            if start_d:
                query = query.filter(
                    or_(
                        Patient.date_of_death >= start_d,
                        and_(Patient.date_of_death.is_(None), Patient.registration_date >= start_d)
                    )
                )
            if end_d:
                query = query.filter(
                    or_(
                        Patient.date_of_death <= end_d,
                        and_(Patient.date_of_death.is_(None), Patient.registration_date <= end_d)
                    )
                )

            results = query.order_by(Patient.date_of_death.desc().nullslast()).all()
            for p in results:
                meta = p.external_metadata if isinstance(p.external_metadata, dict) else {}
                p_lat, p_lng = cls.resolve_coordinates(meta)

                dist_kmio = (
                    cls.haversine_distance(p_lat, p_lng, registered_hospitals['KMIO']['lat'], registered_hospitals['KMIO']['lng'])
                    if p_lat and p_lng and 'KMIO' in registered_hospitals else 'N/A'
                )
                dist_kcgh = (
                    cls.haversine_distance(p_lat, p_lng, registered_hospitals['KCGH']['lat'], registered_hospitals['KCGH']['lng'])
                    if p_lat and p_lng and 'KCGH' in registered_hospitals else 'N/A'
                )

                age = None
                if p.date_of_birth:
                    ref_date = p.date_of_death or date.today()
                    age = ref_date.year - p.date_of_birth.year - (
                        (ref_date.month, ref_date.day) < (p.date_of_birth.month, p.date_of_birth.day)
                    )

                days_in_care = 'N/A'
                reg_date = p.registration_date or (p.created_at.date() if p.created_at else None)
                if reg_date and p.date_of_death:
                    days_in_care = max(0, (p.date_of_death - reg_date).days)

                # Total completed visits
                v_count = PatientVisit.query.filter_by(patient_id=p.id).count()

                # Bereavement assessment status
                has_bereavement = BereavementAssessment.query.filter_by(patient_id=p.id).first() is not None

                records.append({
                    'uhid': p.uhid or 'N/A',
                    'patient_name': p.full_name or 'N/A',
                    'gender': p.gender or 'N/A',
                    'age': age if age is not None else 'N/A',
                    'date_of_death': p.date_of_death.isoformat() if p.date_of_death else 'N/A',
                    'place_of_death': (p.place_of_death or 'N/A').capitalize(),
                    'place_of_death_remarks': p.place_of_death_remarks or 'N/A',
                    'days_in_care': days_in_care,
                    'total_visits': v_count,
                    'distance_kmio': dist_kmio,
                    'distance_kcgh': dist_kcgh,
                    'latitude': round(p_lat, 6) if p_lat is not None else 'N/A',
                    'longitude': round(p_lng, 6) if p_lng is not None else 'N/A',
                    'bereavement_visit_done': 'Yes' if has_bereavement else 'No',
                    'registration_date': reg_date.isoformat() if reg_date else 'N/A',
                })

        return records

    # -------------------------------------------------------------------------
    # Preview & Visualization Generator
    # -------------------------------------------------------------------------
    @classmethod
    def generate_preview(
        cls,
        dataset: str,
        date_field: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
        custom_hospital_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate first 10 rows and dynamic visual aggregations based on selected columns."""
        records = cls.fetch_data_records(
            dataset=dataset,
            date_field=date_field,
            start_date=start_date,
            end_date=end_date,
            filters=filters,
            selected_columns=columns,
            custom_hospital_code=custom_hospital_code
        )

        total_count = len(records)
        selected_cols = columns or []
        if not selected_cols and records:
            selected_cols = list(records[0].keys())

        # Filter preview rows to only the requested columns
        preview_rows = []
        for r in records[:10]:
            filtered_row = {col: r.get(col, 'N/A') for col in selected_cols}
            preview_rows.append(filtered_row)

        # Dynamic Visualization Builder
        vis_data = cls._build_visualization_stats(records, selected_cols)

        return {
            'total_count': total_count,
            'columns': selected_cols,
            'preview_rows': preview_rows,
            'visualization': vis_data
        }

    @staticmethod
    def _build_visualization_stats(records: List[Dict[str, Any]], columns: List[str]) -> Dict[str, Any]:
        """Build instant UI metrics and chart distributions based on chosen columns."""
        if not records:
            return {'type': 'empty', 'metrics': {}, 'chart_data': []}

        # Check if distance columns are selected
        distance_cols = [c for c in columns if 'distance' in c.lower()]
        if distance_cols:
            primary_dist_col = distance_cols[0]
            dist_values = []
            for r in records:
                val = r.get(primary_dist_col)
                if isinstance(val, (int, float)):
                    dist_values.append(val)

            avg_dist = round(sum(dist_values) / len(dist_values), 1) if dist_values else 0

            # Distance distribution buckets
            buckets = [
                {'range': '< 5 km', 'count': 0},
                {'range': '5 - 15 km', 'count': 0},
                {'range': '15 - 30 km', 'count': 0},
                {'range': '> 30 km', 'count': 0},
            ]
            for d in dist_values:
                if d < 5.0:
                    buckets[0]['count'] += 1
                elif d < 15.0:
                    buckets[1]['count'] += 1
                elif d <= 30.0:
                    buckets[2]['count'] += 1
                else:
                    buckets[3]['count'] += 1

            return {
                'type': 'distance',
                'title': f'Distance Distribution ({primary_dist_col.replace("_", " ").title()})',
                'metrics': {
                    'Total Records': len(records),
                    'With Distance Data': len(dist_values),
                    'Average Distance': f'{avg_dist} km',
                    'Max Distance': f'{round(max(dist_values), 1)} km' if dist_values else 'N/A'
                },
                'chart_data': buckets
            }

        # Check if a categorical column is selected for distribution
        categorical_candidates = ['geographic_cluster', 'gender', 'care_status', 'clinical_complexity', 'pain_ladder_step', 'place_of_death', 'visit_type', 'status']
        for cat in categorical_candidates:
            if cat in columns:
                counts: Dict[str, int] = {}
                for r in records:
                    val = str(r.get(cat, 'Unknown'))
                    if val != 'N/A':
                        counts[val] = counts.get(val, 0) + 1

                chart_data = [{'range': k, 'count': v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:6]]
                return {
                    'type': 'categorical',
                    'title': f'Distribution by {cat.replace("_", " ").title()}',
                    'metrics': {
                        'Total Records': len(records),
                        'Distinct Categories': len(counts),
                        'Top Category': chart_data[0]['range'] if chart_data else 'N/A',
                        'Top Category Count': chart_data[0]['count'] if chart_data else 0
                    },
                    'chart_data': chart_data
                }

        # Fallback to general count metric
        return {
            'type': 'summary',
            'title': 'Report Overview',
            'metrics': {
                'Total Records Found': len(records),
                'Selected Columns': len(columns)
            },
            'chart_data': []
        }

    # -------------------------------------------------------------------------
    # CSV & Excel File Exporters
    # -------------------------------------------------------------------------
    @classmethod
    def export_csv(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        column_labels: Dict[str, str]
    ) -> str:
        """Export records as RFC-4180 compliant CSV string."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        headers = [column_labels.get(col, col.replace('_', ' ').title()) for col in columns]
        writer.writerow(headers)

        # Data Rows
        for r in records:
            row = [r.get(col, '') for col in columns]
            writer.writerow(row)

        return output.getvalue()

    @classmethod
    def export_xlsx(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        column_labels: Dict[str, str],
        sheet_title: str = "Report"
    ) -> bytes:
        """Export records as styled Microsoft Excel (.xlsx) spreadsheet bytes."""
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sheet_title[:30]

        # Professional Medical Blue Header Style
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        headers = [column_labels.get(col, col.replace('_', ' ').title()) for col in columns]
        ws.append(headers)

        # Style header row
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        ws.row_dimensions[1].height = 28

        # Style & write data rows
        row_font = Font(name="Calibri", size=10)
        alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for row_idx, r in enumerate(records, start=2):
            row_data = [r.get(col, '') for col in columns]
            ws.append(row_data)

            is_alt = (row_idx % 2 == 0)
            for col_idx in range(1, len(columns) + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.font = row_font
                cell.border = thin_border
                if is_alt:
                    cell.fill = alt_fill

        # Auto-adjust column widths
        for col_idx, col in enumerate(columns, start=1):
            col_letter = get_column_letter(col_idx)
            max_len = len(str(headers[col_idx - 1]))
            for r in records[:50]:  # sample first 50 rows for speed
                val_len = len(str(r.get(col, '')))
                if val_len > max_len:
                    max_len = val_len
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 45)

        # Freeze the header row
        ws.freeze_panes = "A2"

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
