"""
Analytics API Routes
Provides endpoints for dashboard metrics and analytics.
"""
from flask import Blueprint, request, jsonify
from app.analytics.services import AnalyticsService
from app.analytics.deaths_analytics import DeathsAnalyticsService
from app.auth.decorators import require_auth
import logging

logger = logging.getLogger(__name__)

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard(current_user):
    """
    Get dashboard metrics.
    
    Query Parameters:
    - start_date (optional): Filter start date (YYYY-MM-DD)
    - end_date (optional): Filter end date (YYYY-MM-DD)
    - filters (optional): JSON string of additional filters
    
    Returns:
    - 200: Dashboard metrics
    - 500: Error
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        filters_str = request.args.get('filters')
        
        filters = None
        if filters_str:
            import json
            filters = json.loads(filters_str)
        
        data = AnalyticsService.get_dashboard_metrics(
            start_date=start_date,
            end_date=end_date,
            filters=filters
        )
        
        return jsonify(data), 200
        
    except Exception as e:
        print(f"Error in get_dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/prescriptions', methods=['GET'])
@require_auth
def get_prescription_analytics(current_user):
    """Prescription PDF metrics: total downloads, downloads per user, and the
    number of patients that have at least one issued prescription."""
    try:
        from app.extensions import db
        from sqlalchemy import func
        from app.saranam.models.prescription_version import (
            PrescriptionVersion, PrescriptionPdfDownload,
        )
        from app.common.models import User
        from app.analytics.donor_metrics import parse_date_range

        # Parse date range query params
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date')
        )

        download_query = db.session.query(func.count(PrescriptionPdfDownload.id))
        if start_d:
            download_query = download_query.filter(PrescriptionPdfDownload.created_at >= start_d)
        if end_d:
            download_query = download_query.filter(PrescriptionPdfDownload.created_at <= end_d)
        total_downloads = download_query.scalar() or 0

        version_query = db.session.query(func.count(PrescriptionVersion.id))
        if start_d:
            version_query = version_query.filter(PrescriptionVersion.created_at >= start_d)
        if end_d:
            version_query = version_query.filter(PrescriptionVersion.created_at <= end_d)
        total_versions = version_query.scalar() or 0

        patients_rx_query = db.session.query(
            func.count(func.distinct(PrescriptionVersion.patient_id))
        )
        if start_d:
            patients_rx_query = patients_rx_query.filter(PrescriptionVersion.created_at >= start_d)
        if end_d:
            patients_rx_query = patients_rx_query.filter(PrescriptionVersion.created_at <= end_d)
        patients_with_rx = patients_rx_query.scalar() or 0

        rows_query = (
            db.session.query(
                PrescriptionPdfDownload.downloaded_by,
                User.full_name,
                func.count(PrescriptionPdfDownload.id).label('cnt'),
            )
            .outerjoin(User, User.id == PrescriptionPdfDownload.downloaded_by)
        )
        if start_d:
            rows_query = rows_query.filter(PrescriptionPdfDownload.created_at >= start_d)
        if end_d:
            rows_query = rows_query.filter(PrescriptionPdfDownload.created_at <= end_d)

        rows = (
            rows_query
            .group_by(PrescriptionPdfDownload.downloaded_by, User.full_name)
            .order_by(func.count(PrescriptionPdfDownload.id).desc())
            .all()
        )
        downloads_by_user = [
            {'user_id': str(uid) if uid else None,
             'name': name or 'Unknown',
             'downloads': int(cnt)}
            for uid, name, cnt in rows
        ]

        return jsonify({
            'total_downloads': int(total_downloads),
            'total_versions': int(total_versions),
            'patients_with_prescription': int(patients_with_rx),
            'downloads_by_user': downloads_by_user,
        }), 200
    except Exception as e:
        logger.exception('prescription analytics failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/deaths/impact', methods=['GET'])
@require_auth
def get_deaths_impact(current_user):
    """
    Palliative outcome KPIs for the dashboard.

    Query Parameters:
    - window_days (optional, default 30): rolling window for death count.

    Returns a dict with deaths_in_window, avg_visits_before_death, and a
    supporting list of deceased_patients.
    """
    try:
        window_days = int(request.args.get('window_days', 30))
        patient_status = request.args.get('patient_status')
        initial_visit_status = request.args.get('initial_visit_status')
        if window_days <= 0 or window_days > 3650:
            return jsonify({'error': 'window_days must be between 1 and 3650'}), 400
        data = DeathsAnalyticsService.get_deaths_impact(
            window_days=window_days, 
            patient_status=patient_status, 
            initial_visit_status=initial_visit_status
        )
        return jsonify(data), 200
    except Exception as e:
        logger.exception('Error in get_deaths_impact')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/patients/demographics', methods=['GET'])
@require_auth
def get_patient_demographics(current_user):
    """
    Get detailed patient demographics.
    
    Returns:
    - 200: Demographics data
    - 500: Error
    """
    try:
        age_dist = AnalyticsService._get_age_distribution()
        gender_dist = AnalyticsService._get_gender_distribution()
        
        return jsonify({
            'age_distribution': age_dist,
            'gender_distribution': gender_dist
        }), 200
        
    except Exception as e:
        print(f"Error in get_patient_demographics: {e}")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/trends/registration', methods=['GET'])
@require_auth
def get_registration_trends(current_user):
    """
    Get patient registration trends.
    
    Query Parameters:
    - months (optional): Number of months to include (default: 12)
    
    Returns:
    - 200: Registration trend data
    - 500: Error
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        months_param = request.args.get('months')
        patient_status = request.args.get('patient_status')
        months = int(months_param) if months_param else (None if (start_date or end_date) else 12)
        trends = AnalyticsService._get_registration_trends(
            start_date=start_date,
            end_date=end_date,
            months=months,
            patient_status=patient_status
        )
        
        return jsonify({
            'trends': trends
        }), 200
        
    except Exception as e:
        print(f"Error in get_registration_trends: {e}")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/forms', methods=['GET'])
@require_auth
def get_form_analytics(current_user):
    """
    Get comprehensive form analytics.

    Query Parameters:
    - start_date (optional): Filter start date (YYYY-MM-DD)
    - end_date (optional): Filter end date (YYYY-MM-DD)

    Returns:
    - 200: Form analytics data
    - 500: Error
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        data = AnalyticsService.get_form_analytics(
            start_date=start_date,
            end_date=end_date
        )

        return jsonify(data), 200

    except Exception as e:
        print(f"Error in get_form_analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

from app.analytics.symptom_analytics import SymptomAnalyticsService
from app.analytics.risk_analytics import RiskAnalyticsService
from app.analytics.geo_analytics import GeoAnalyticsService

# SYMPTOM ANALYTICS

@analytics_bp.route('/symptoms/prevalence', methods=['GET'])
@require_auth
def get_symptom_prevalence(current_user):
    """Get symptom prevalence across all patients"""
    data = SymptomAnalyticsService.get_symptom_prevalence()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/symptoms/by-location', methods=['GET'])
@require_auth
def get_symptom_by_location(current_user):
    """Get symptom distribution by geographic location"""
    data = SymptomAnalyticsService.get_symptom_by_location()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/symptoms/trends', methods=['GET'])
@require_auth
def get_symptom_trends(current_user):
    """Get symptom trends over time"""
    days = request.args.get('days', 30, type=int)
    data = SymptomAnalyticsService.get_symptom_trends(days)
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/symptoms/cooccurrence', methods=['GET'])
@require_auth
def get_symptom_cooccurrence(current_user):
    """Get commonly co-occurring symptoms"""
    data = SymptomAnalyticsService.get_symptom_cooccurrence()
    return jsonify({'success': True, 'data': data}), 200

# RISK STRATIFICATION ANALYTICS

@analytics_bp.route('/risk/distribution', methods=['GET'])
@require_auth
def get_risk_distribution(current_user):
    """Get patient distribution across risk levels"""
    data = RiskAnalyticsService.get_risk_distribution()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/risk/by-location', methods=['GET'])
@require_auth
def get_risk_by_location(current_user):
    """Get risk distribution by location"""
    data = RiskAnalyticsService.get_risk_by_location()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/risk/high-risk-patients', methods=['GET'])
@require_auth
def get_high_risk_patients(current_user):
    """Get list of high and critical risk patients"""
    limit = request.args.get('limit', 50, type=int)
    data = RiskAnalyticsService.get_high_risk_patients(limit)
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/risk/trends', methods=['GET'])
@require_auth
def get_risk_trends(current_user):
    """Get risk level trends over time"""
    months = request.args.get('months', 6, type=int)
    data = RiskAnalyticsService.get_risk_trends(months)
    return jsonify({'success': True, 'data': data}), 200

# GEOSPATIAL ANALYTICS

@analytics_bp.route('/geo/patient-locations', methods=['GET'])
@require_auth
def get_patient_locations(current_user):
    """Get all patient locations with risk levels for mapping"""
    data = GeoAnalyticsService.get_patient_locations_with_risk()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/geo/nearest-hospitals/<patient_id>', methods=['GET'])
@require_auth
def get_nearest_hospitals(current_user, patient_id):
    """Get nearest hospitals to a patient"""
    limit = request.args.get('limit', 5, type=int)
    data = GeoAnalyticsService.get_nearest_hospitals(patient_id, limit)
    return jsonify({'success': True, 'data': data}), 200


@analytics_bp.route('/geo/hospitals', methods=['GET'])
@require_auth
def get_all_hospitals(current_user):
    """Get all referral hospitals"""
    try:
        from app.extensions import db
        from app.analytics.models import NearbyHospital
        hospitals = NearbyHospital.query.all()
        
        # If database table is empty, auto-seed with standard mock hospitals
        if not hospitals:
            default_hospitals = [
                {
                    "name": "Kidwai Memorial Institute of Oncology",
                    "hospital_type": "Government Oncology Hub",
                    "latitude": 12.9432,
                    "longitude": 77.5971,
                    "address": "Dr. M.H. Marigowda Road, Hombegowda Nagar, Bengaluru"
                },
                {
                    "name": "St. John's Medical College Hospital",
                    "hospital_type": "Tertiary Referral Care",
                    "latitude": 12.9332,
                    "longitude": 77.6244,
                    "address": "Sarjapur Road, Koramangala, Bengaluru"
                },
                {
                    "name": "Bangalore Baptist Hospital",
                    "hospital_type": "North Referral Center",
                    "latitude": 13.0282,
                    "longitude": 77.5896,
                    "address": "Bellary Rd, Hebbal, Bengaluru"
                }
            ]
            for dh in default_hospitals:
                h = NearbyHospital(
                    name=dh["name"],
                    hospital_type=dh["hospital_type"],
                    latitude=dh["latitude"],
                    longitude=dh["longitude"],
                    address=dh["address"]
                )
                db.session.add(h)
            db.session.commit()
            hospitals = NearbyHospital.query.all()

        data = [
            {
                'hospital_id': str(h.id),
                'name': h.name,
                'hospital_type': h.hospital_type,
                'address': h.address,
                'phone': h.phone,
                'website': h.website,
                'latitude': float(h.latitude) if h.latitude is not None else None,
                'longitude': float(h.longitude) if h.longitude is not None else None,
            }
            for h in hospitals
        ]
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.exception('Error in get_all_hospitals')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/geo/patient-vitals', methods=['GET'])
@require_auth
def get_patient_vitals_locations(current_user):
    """Get latest vitals and coordinates for all active patients"""
    try:
        from app.extensions import db
        from app.analytics.models import PatientLocation
        from app.saranam.models.patient_visit import PatientVisit
        from app.patients.models import Patient
        from sqlalchemy import and_, func
        from app.analytics.services import AnalyticsService

        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')

        # Subquery for latest completed/in_progress visit per patient
        latest_sq = (
            db.session.query(
                PatientVisit.patient_id,
                func.max(PatientVisit.visit_number).label('max_num')
            )
            .filter(PatientVisit.status.in_(['completed', 'in_progress']))
            .group_by(PatientVisit.patient_id)
            .subquery()
        )

        query = (
            db.session.query(
                Patient.id,
                Patient.full_name,
                Patient.external_metadata,
                PatientLocation.latitude,
                PatientLocation.longitude,
                PatientLocation.district,
                PatientLocation.address_full,
                Patient.gender,
                Patient.geographic_cluster,
                Patient.bsc_status,
                PatientVisit.vitals_bp_systolic,
                PatientVisit.vitals_bp_diastolic,
                PatientVisit.vitals_pr,
                PatientVisit.vitals_spo2,
                PatientVisit.vitals_temperature,
                PatientVisit.vitals_rr,
                PatientVisit.vitals_grbs
            )
            .outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id)
            .join(latest_sq, latest_sq.c.patient_id == Patient.id)
            .join(
                PatientVisit,
                and_(
                    PatientVisit.patient_id == Patient.id,
                    PatientVisit.visit_number == latest_sq.c.max_num
                )
            )
            .filter(
                Patient.is_active == True
            )
        )

        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status, age_group)
        results = query.all()

        data = []
        for r in results:
            def _coerce_val(val):
                if val is None:
                    return None
                try:
                    return float(val)
                except:
                    return None

            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'address': r.address_full if r.address_full else (meta.get('address') or r.district or meta.get('location') or meta.get('base_location')),
                'gender': r.gender or 'Unknown',
                'zone': r.geographic_cluster or 'Central',
                'bsc_status': r.bsc_status,
                'vitals': {
                    'bp_systolic': _coerce_val(r.vitals_bp_systolic),
                    'bp_diastolic': _coerce_val(r.vitals_bp_diastolic),
                    'pr': _coerce_val(r.vitals_pr),
                    'spo2': _coerce_val(r.vitals_spo2),
                    'temperature': _coerce_val(r.vitals_temperature),
                    'rr': _coerce_val(r.vitals_rr),
                    'grbs': _coerce_val(r.vitals_grbs)
                }
            })

        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.exception('Error in get_patient_vitals_locations')
        return jsonify({'error': str(e)}), 500
    

@analytics_bp.route('/geo/patient-diagnoses', methods=['GET'])
@require_auth
def get_patient_diagnoses(current_user):
    """Get patient diagnoses coordinates and stats"""
    try:
        from app.extensions import db
        from app.analytics.models import PatientLocation
        from app.patients.models import Patient
        from app.saranam.models.doctor_assessment import DoctorAssessment
        from sqlalchemy import and_, func

        # Subquery to find the latest DoctorAssessment per patient
        latest_doc_sq = (
            db.session.query(
                DoctorAssessment.patient_id,
                func.max(DoctorAssessment.created_at).label('max_created')
            )
            .group_by(DoctorAssessment.patient_id)
            .subquery()
        )

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        sd = AnalyticsService._parse_datetime(start_date)
        ed = AnalyticsService._parse_datetime(end_date)

        # Query active patients with coordinates, Patient.diagnosis, and latest DoctorAssessment.diagnosis
        q = (
            db.session.query(
                Patient.id,
                Patient.full_name,
                Patient.external_metadata,
                PatientLocation.latitude,
                PatientLocation.longitude,
                PatientLocation.district,
                Patient.diagnosis.label('patient_diag'),
                DoctorAssessment.diagnosis.label('doc_diag')
            )
            .outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id)
            .outerjoin(latest_doc_sq, latest_doc_sq.c.patient_id == Patient.id)
            .outerjoin(
                DoctorAssessment,
                and_(
                    DoctorAssessment.patient_id == Patient.id,
                    DoctorAssessment.created_at == latest_doc_sq.c.max_created
                )
            )
            .filter(
                Patient.is_active == True
            )
        )
        if sd:
            q = q.filter(Patient.created_at >= sd)
        if ed:
            q = q.filter(Patient.created_at <= ed)

        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status, age_group)

        results = q.all()

        data = []
        diagnoses_counts = {}

        for r in results:
            diag = r.doc_diag or r.patient_diag or 'Not Specified'
            if diag != 'Not Specified':
                diag = " ".join(diag.split()).title()
            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'diagnosis': diag
            })
            diagnoses_counts[diag] = diagnoses_counts.get(diag, 0) + 1

        # Format stats for chart
        stats = []
        sorted_diags = sorted(diagnoses_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Calculate active total (excluding placeholders) for correct percentage weighting
        valid_total = sum(count for name, count in sorted_diags if name not in ['Not Specified', 'None', 'Null', ''])

        for name, count in sorted_diags:
            if name in ['Not Specified', 'None', 'Null', '']:
                continue
            pct = round((count / valid_total) * 100, 1) if valid_total else 0
            stats.append({'name': name, 'count': count, 'percentage': pct})

        return jsonify({'success': True, 'data': data, 'stats': stats}), 200
    except Exception as e:
        logger.exception('Error in get_patient_diagnoses')
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/geo/patient-complexity', methods=['GET'])
@require_auth
def get_patient_complexity(current_user):
    """Get patient clinical complexity distribution"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        stats = AnalyticsService._get_complexity_distribution(start_date, end_date, patient_status, age_group)

        return jsonify({
            "success": True,
            "stats": stats
        }), 200

    except Exception as e:
        logger.exception("Error getting patient complexity")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route('/geo/patient-bsc', methods=['GET'])
@require_auth
def get_patient_bsc(current_user):
    """Get BSC status distribution"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        stats = AnalyticsService._get_bsc_distribution(start_date, end_date, patient_status, age_group)

        return jsonify({
            "success": True,
            "stats": stats
        }), 200

    except Exception as e:
        logger.exception("Error getting patient BSC distribution")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route('/visits/home-by-month', methods=['GET'])
@require_auth
def get_home_visits_by_month(current_user):
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status')
        age_group = request.args.get('age_group')
        return jsonify({
            "success": True,
            "data": AnalyticsService._get_home_visits_by_month(start_date, end_date, patient_status, age_group)
        }), 200

    except Exception as e:
        logger.exception("Error fetching home visits by month")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route("/visits/type-by-month", methods=["GET"])
@require_auth
def get_visit_type_by_month(current_user):
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status')
        age_group = request.args.get('age_group')
        return jsonify({
            "success": True,
            "data": AnalyticsService._get_visit_type_by_month(start_date, end_date, patient_status, age_group)
        }), 200

    except Exception as e:
        logger.exception("Error fetching visit type analytics")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route("/visits/average-by-month", methods=["GET"])
@require_auth
def get_average_visits_by_month(current_user):
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status')
        age_group = request.args.get('age_group')
        return jsonify({
            "success": True,
            "data": AnalyticsService._get_average_visits_by_month(start_date, end_date, patient_status, age_group)
        }), 200

    except Exception as e:
        logger.exception("Error fetching average visits by month")
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/visits/frequency-distribution", methods=["GET"])
@require_auth
def get_visit_frequency_distribution(current_user):
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status')
        age_group = request.args.get('age_group')
        return jsonify({
            "success": True,
            "data": AnalyticsService._get_visit_frequency_distribution(start_date, end_date, patient_status, age_group)
        }), 200

    except Exception as e:
        logger.exception("Error fetching visit frequency distribution")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route("/patients/time-to-first-visit", methods=["GET"])
@require_auth
def get_time_to_first_visit(current_user):
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status')
        age_group = request.args.get('age_group')
        period = request.args.get('period', 'monthly')
        return jsonify({
            "success": True,
            "data": AnalyticsService._get_average_time_to_first_visit(start_date, end_date, patient_status, age_group, period)
        }), 200

    except Exception as e:
        logger.exception("Error fetching time to first visit")
        return jsonify({"error": str(e)}), 500
    
@analytics_bp.route('/geo/patient-complaints', methods=['GET'])
@require_auth
def get_patient_complaints(current_user):
    """Get patient chief complaints coordinates and stats"""
    try:
        from app.extensions import db
        from app.analytics.models import PatientLocation
        from app.patients.models import Patient
        from app.encounters.models import Encounter
        from app.saranam.models.doctor_assessment import DoctorAssessment
        from sqlalchemy import and_, func

        # Subquery for latest encounter start_time per patient
        latest_enc_sq = (
            db.session.query(
                Encounter.patient_id,
                func.max(Encounter.start_time).label('max_date')
            )
            .group_by(Encounter.patient_id)
            .subquery()
        )

        # Subquery for latest DoctorAssessment created_at per patient
        latest_doc_sq = (
            db.session.query(
                DoctorAssessment.patient_id,
                func.max(DoctorAssessment.created_at).label('max_created')
            )
            .group_by(DoctorAssessment.patient_id)
            .subquery()
        )

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        sd = AnalyticsService._parse_datetime(start_date)
        ed = AnalyticsService._parse_datetime(end_date)

        # Query active patients with coordinates, latest Encounter chief complaint, and latest DoctorAssessment chief complaints
        q = (
            db.session.query(
                Patient.id,
                Patient.full_name,
                Patient.external_metadata,
                PatientLocation.latitude,
                PatientLocation.longitude,
                PatientLocation.district,
                Encounter.chief_complaint.label('enc_complaint'),
                DoctorAssessment.chief_complaints.label('doc_complaint')
            )
            .outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id)
            .outerjoin(latest_enc_sq, latest_enc_sq.c.patient_id == Patient.id)
            .outerjoin(
                Encounter,
                and_(
                    Encounter.patient_id == Patient.id,
                    Encounter.start_time == latest_enc_sq.c.max_date
                )
            )
            .outerjoin(latest_doc_sq, latest_doc_sq.c.patient_id == Patient.id)
            .outerjoin(
                DoctorAssessment,
                and_(
                    DoctorAssessment.patient_id == Patient.id,
                    DoctorAssessment.created_at == latest_doc_sq.c.max_created
                )
            )
            .filter(
                Patient.is_active == True
            )
        )
        if sd:
            q = q.filter(Patient.created_at >= sd)
        if ed:
            q = q.filter(Patient.created_at <= ed)

        q = AnalyticsService.apply_patient_filters(q, Patient, patient_status, age_group)

        results = q.all()

        data = []
        complaints_counts = {}

        for r in results:
            complaint = r.doc_complaint or r.enc_complaint or 'No Complaint Recorded'
            if complaint != 'No Complaint Recorded':
                complaint = " ".join(complaint.split()).title()
            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'chief_complaint': complaint
            })
            complaints_counts[complaint] = complaints_counts.get(complaint, 0) + 1

        # Format stats for chart
        stats = []
        sorted_complaints = sorted(complaints_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Calculate active total (excluding placeholders) for correct percentage weighting
        valid_total = sum(count for name, count in sorted_complaints if name not in ['No Complaint Recorded', 'None', 'Null', 'Not Specified', ''])

        for name, count in sorted_complaints:
            if name in ['No Complaint Recorded', 'None', 'Null', 'Not Specified', '']:
                continue
            pct = round((count / valid_total) * 100, 1) if valid_total else 0
            stats.append({'name': name, 'count': count, 'percentage': pct})

        return jsonify({'success': True, 'data': data, 'stats': stats}), 200
    except Exception as e:
        logger.exception('Error in get_patient_complaints')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/geo/distribution', methods=['GET'])
@require_auth
def get_geographic_distribution(current_user):
    """Get patient distribution by geographic area"""
    data = GeoAnalyticsService.get_geographic_distribution()
    return jsonify({'success': True, 'data': data}), 200

from app.analytics.vitals_analytics import VitalsAnalyticsService
from app.analytics.provider_analytics import ProviderAnalyticsService
from app.analytics.clinical_analytics import ClinicalAnalyticsService
from app.analytics.operational_analytics import OperationalAnalyticsService

# PROVIDER & SCHEDULING OPTIMIZATION

@analytics_bp.route('/optimization/utilization', methods=['GET'])
@require_auth
def get_provider_utilization(current_user):
    """Get utilization rates for providers"""
    data = ProviderAnalyticsService.get_provider_utilization()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/optimization/no-shows', methods=['GET'])
@require_auth
def get_no_shows(current_user):
    """Get no-show metrics"""
    data = ProviderAnalyticsService.get_no_show_metrics()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/optimization/wait-times', methods=['GET'])
@require_auth
def get_wait_times(current_user):
    """Get average wait times"""
    data = ProviderAnalyticsService.get_average_wait_times()
    return jsonify({'success': True, 'data': data}), 200

# CLINICAL OUTCOMES & QUALITY

@analytics_bp.route('/clinical/los', methods=['GET'])
@require_auth
def get_los_metrics(current_user):
    """Get length of stay metrics"""
    data = ClinicalAnalyticsService.get_length_of_stay_metrics()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/clinical/readmissions', methods=['GET'])
@require_auth
def get_readmission_rates(current_user):
    """Get readmission rate metrics"""
    data = ClinicalAnalyticsService.get_readmission_rates()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/clinical/recovery', methods=['GET'])
@require_auth
def get_recovery_metrics(current_user):
    """Get recovery/discharge metrics"""
    data = ClinicalAnalyticsService.get_recovery_metrics()
    return jsonify({'success': True, 'data': data}), 200

# OPERATIONAL & FINANCIAL

@analytics_bp.route('/operational/occupancy', methods=['GET'])
@require_auth
def get_occupancy_metrics(current_user):
    """Get bed occupancy metrics"""
    data = OperationalAnalyticsService.get_bed_occupancy_metrics()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/operational/financial-summary', methods=['GET'])
@require_auth
def get_financial_summary(current_user):
    """Get financial summary metrics"""
    data = OperationalAnalyticsService.get_financial_summary()
    return jsonify({'success': True, 'data': data}), 200

@analytics_bp.route('/operational/turnover', methods=['GET'])
@require_auth
def get_turnover_rate(current_user):
    """Get bed turnover rate"""
    days = request.args.get('days', 30, type=int)
    data = OperationalAnalyticsService.get_bed_turnover_rate(days)
    return jsonify({'success': True, 'data': data}), 200

# ADVANCED FORM ANALYTICS

from app.analytics.advanced_form_service import AdvancedFormAnalyticsService

@analytics_bp.route('/forms/advanced/<form_id>/overview', methods=['GET'])
@require_auth
def get_advanced_form_overview(current_user, form_id):
    """Get high-level statistics for a specific form"""
    try:
        data = AdvancedFormAnalyticsService.get_form_overview(form_id)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting form advanced overview: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/forms/advanced/<form_id>/fields/<field_id>/distribution', methods=['GET'])
@require_auth
def get_advanced_field_distribution(current_user, form_id, field_id):
    """Get value distribution for a specific field"""
    try:
        field_type = request.args.get('field_type', 'text')
        data = AdvancedFormAnalyticsService.get_field_distribution(form_id, field_id, field_type)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting field distribution: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/forms/advanced/<form_id>/funnel', methods=['GET'])
@require_auth
def get_advanced_dropoff_funnel(current_user, form_id):
    """Get field drop-off funnel for a specific form"""
    try:
        data = AdvancedFormAnalyticsService.get_dropoff_funnel(form_id)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting field dropoff funnel: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/forms/advanced/<form_id>/heatmap', methods=['GET'])
@require_auth
def get_advanced_usage_heatmap(current_user, form_id):
    """Get usage heatmap (day vs hour) for a specific form"""
    try:
        data = AdvancedFormAnalyticsService.get_usage_heatmap(form_id)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting usage heatmap: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# VITALS ANALYTICS

@analytics_bp.route('/vitals/summary', methods=['GET'])
@require_auth
def get_vitals_summary(current_user):
    """Get population-level vitals improvement summary"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        data = VitalsAnalyticsService.get_vitals_summary(start_date, end_date, patient_status, age_group)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting vitals summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@analytics_bp.route('/vitals/distribution', methods=['GET'])
@require_auth
def get_vitals_distribution(current_user):
    """Get distribution of latest vital values across patients"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        patient_status = request.args.get('patient_status', 'all')
        age_group = request.args.get('age_group', 'all')
        data = VitalsAnalyticsService.get_vitals_distribution(start_date, end_date, patient_status, age_group)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting vitals distribution: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@analytics_bp.route('/vitals/correlation', methods=['GET'])
@require_auth
def get_vitals_correlation(current_user):
    """Correlate vitals changes with ESAS/PPS score changes"""
    try:
        score_type = request.args.get('score_type', 'esas')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        data = VitalsAnalyticsService.get_vitals_correlation(score_type, start_date, end_date)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting vitals correlation: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@analytics_bp.route('/vitals/top-movers', methods=['GET'])
@require_auth
def get_vitals_top_movers(current_user):
    """Get patients with most improved or deteriorated vitals"""
    try:
        direction = request.args.get('direction', 'improved')
        limit = request.args.get('limit', 10, type=int)
        data = VitalsAnalyticsService.get_top_movers(direction, limit)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Error getting vitals top movers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════
# Donor / Stakeholder Dashboard — Theory of Change-aligned headline metrics
# Plan: docs/Saranam/plans/analytics/PLAN.md (§4.A, §5 Phase 1)
# ═══════════════════════════════════════════════════════════════════════
from app.analytics.donor_metrics import (
    DonorMetricsService,
    parse_period,
    parse_date_range,
)


@analytics_bp.route('/donor/overview', methods=['GET'])
@require_auth
def donor_overview(current_user):
    """Top-line StatCards for the donor dashboard with previous-period delta.

    Query params: start_date, end_date (YYYY-MM-DD; defaults to last 12 months).
    """
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        return jsonify(DonorMetricsService.overview(start_d, end_d)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_overview failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/visits-timeline', methods=['GET'])
@require_auth
def donor_visits_timeline(current_user):
    """Bucketed visit counts split by visit_location (home/opd/ipd/phone).

    Query params: start_date, end_date, period (daily|monthly|quarterly|yearly).
    """
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        return jsonify(DonorMetricsService.visits_timeline(start_d, end_d, period)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_visits_timeline failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/deaths-timeline', methods=['GET'])
@require_auth
def donor_deaths_timeline(current_user):
    """Bucketed death counts (raw, no spike suppression).

    Per 2026-05-02 client direction: data-entry spikes are left visible.
    """
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        return jsonify(
            DonorMetricsService.deaths_timeline(start_d, end_d, period)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_deaths_timeline failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/consultations-mix', methods=['GET'])
@require_auth
def donor_consultations_mix(current_user):
    """Team-role role-encounter counts across visits in the period."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        return jsonify(DonorMetricsService.consultations_mix(start_d, end_d)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_consultations_mix failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/distance-timeline', methods=['GET'])
@require_auth
def donor_distance_timeline(current_user):
    """Estimated KMs covered per ISO-week from approved weekly schedules."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        return jsonify(DonorMetricsService.distance_timeline(start_d, end_d)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_distance_timeline failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/opioid-usage', methods=['GET'])
@require_auth
def donor_opioid_usage(current_user):
    """Opioid / morphine usage — distinct-patient count + dispensation timeline."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        return jsonify(
            DonorMetricsService.opioid_usage(start_d, end_d, period)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_opioid_usage failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/telemedicine-timeline', methods=['GET'])
@require_auth
def donor_telemedicine_timeline(current_user):
    """Bucketed teleconsult session counts (video + voice)."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        return jsonify(
            DonorMetricsService.telemedicine_timeline(start_d, end_d, period)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_telemedicine_timeline failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/telemedicine/summary', methods=['GET'])
@require_auth
def telemedicine_summary(current_user):
    """Comprehensive teleconsultation analytics (summary, breakdowns, timeline)."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        patient_status = request.args.get('patient_status')
        return jsonify(
            DonorMetricsService.telemedicine_summary(start_d, end_d, period, patient_status)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('telemedicine_summary failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/multidisciplinary', methods=['GET'])
@require_auth
def donor_multidisciplinary(current_user):
    """Avg distinct team-roles per home visit + multi-disciplinary visit %."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        return jsonify(
            DonorMetricsService.multidisciplinary_participation(start_d, end_d)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_multidisciplinary failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/followups', methods=['GET'])
@require_auth
def donor_followups(current_user):
    """Patients who received follow-up visits + timeline of follow-up volume."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        period = parse_period(request.args.get('period'))
        return jsonify(
            DonorMetricsService.followups(start_d, end_d, period)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_followups failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/place-of-death-by-zone', methods=['GET'])
@require_auth
def donor_place_of_death_by_zone(current_user):
    """Deceased patient counts grouped by (geographic zone, place_of_death)."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        return jsonify(
            DonorMetricsService.place_of_death_by_zone(start_d, end_d)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_place_of_death_by_zone failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/loss-to-followup', methods=['GET'])
@require_auth
def donor_loss_to_followup(current_user):
    """Active alive patients with no completed visit in N+ days.

    Query params: threshold_days (default 60), limit (default 50), start_date, end_date.
    """
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        threshold = int(request.args.get('threshold_days', 60))
        limit = int(request.args.get('limit', 50))
        return jsonify(
            DonorMetricsService.loss_to_followup(threshold, limit, start_d, end_d)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_loss_to_followup failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/vehicle-utilization', methods=['GET'])
@require_auth
def donor_vehicle_utilization(current_user):
    """Per-vehicle weekly slot count + utilization % vs target."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        target = int(request.args.get('target_slots_per_week', 25))
        return jsonify(
            DonorMetricsService.vehicle_utilization(start_d, end_d, target)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_vehicle_utilization failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/enrollment-to-death', methods=['GET'])
@require_auth
def donor_enrollment_to_death(current_user):
    """Distribution of days from enrollment to death — flags late-referral patterns."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        start_event = request.args.get('start_event', 'registration')
        age_group = request.args.get('age_group')
        return jsonify(
            DonorMetricsService.enrollment_to_death(start_d, end_d, start_event, age_group)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_enrollment_to_death failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/donor/registration-to-first-visit', methods=['GET'])
@require_auth
def donor_registration_to_first_visit(current_user):
    """Time from patient registration to first completed visit, measured in
    home-care days (per 2026-05-13 client meeting). Default target 8 HC days.

    Query params:
        start_date, end_date         — window for the cohort (first-visit date)
        target_homecare_days (int)   — override the 8-day target
    """
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        target = int(request.args.get('target_homecare_days', 8))
        if target < 1 or target > 365:
            return jsonify({'error': 'target_homecare_days must be 1..365'}), 400
        return jsonify(
            DonorMetricsService.registration_to_first_visit(start_d, end_d, target)
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('donor_registration_to_first_visit failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/pain-ladder', methods=['GET'])
@require_auth
def get_pain_ladder_analytics(current_user):
    """
    Get correlation between patient ESAS pain scores and prescribed WHO pain ladder medication steps.
    """
    try:
        from app.extensions import db
        from app.saranam.models.nursing_assessment import NursingAssessment
        from app.saranam.models.plan_of_care import PlanOfCare
        from app.analytics.analgesics import get_medication_pain_step
        from app.analytics.donor_metrics import parse_date_range
        from app.patients.models import Patient

        # Parse query params
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date')
        )
        patient_status = request.args.get('patient_status', 'all')

        from app.saranam.models.patient_visit import PatientVisit

        # Query Nursing Assessment pain scores joined with PatientVisit to get the manually entered visit_date
        query = db.session.query(
            NursingAssessment.patient_id,
            PatientVisit.visit_date,
            NursingAssessment.assessed_at,
            NursingAssessment.pain_score,
            PlanOfCare.medications
        ).join(
            PlanOfCare, NursingAssessment.visit_id == PlanOfCare.visit_id
        ).join(
            PatientVisit, NursingAssessment.visit_id == PatientVisit.id
        ).join(
            Patient, NursingAssessment.patient_id == Patient.id
        ).filter(
            NursingAssessment.pain_score.isnot(None)
        )

        if start_d:
            query = query.filter(PatientVisit.visit_date >= start_d)
        if end_d:
            query = query.filter(PatientVisit.visit_date <= end_d)

        # Apply patient filters (status & age)
        age_group = request.args.get('age_group', 'all')
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status, age_group)

        results = query.all()

        # De-duplicate patient records: group by patient_id and select only the latest visit_date
        from collections import defaultdict
        patient_records = defaultdict(list)
        for row in results:
            patient_records[row.patient_id].append(row)

        de_duplicated_results = []
        for pid, records in patient_records.items():
            # Sort primarily by visit_date descending, falling back to assessed_at descending
            records.sort(key=lambda r: (r.visit_date, r.assessed_at), reverse=True)
            de_duplicated_results.append(records[0])

        matrix = {
            "Mild (1-3)": {"step1": 0, "step2": 0, "step3": 0, "no_analgesic": 0},
            "Moderate (4-6)": {"step1": 0, "step2": 0, "step3": 0, "no_analgesic": 0},
            "Severe (7-10)": {"step1": 0, "step2": 0, "step3": 0, "no_analgesic": 0},
        }

        med_details = {
            "Mild (1-3)": {
                "paracetamol": 0,
                "ibuprofen": 0,
                "diclofenac": 0,
                "others": 0
            },
            "Moderate (4-6)": {
                "tramadol": 0,
                "codeine": 0,
                "tapentadol": 0,
                "others": 0
            },
            "Severe (7-10)": {
                "morphine": 0,
                "fentanyl": 0,
                "oxycodone": 0,
                "buprenorphine": 0,
                "others": 0
            }
        }

        others_breakdown = {
            "Mild (1-3)": {},
            "Moderate (4-6)": {},
            "Severe (7-10)": {}
        }

        for row in de_duplicated_results:
            pain = row.pain_score
            meds = row.medications
            if pain is None or pain == 0:
                continue
            
            if 1 <= pain <= 3:
                tier = "Mild (1-3)"
            elif 4 <= pain <= 6:
                tier = "Moderate (4-6)"
            elif 7 <= pain <= 10:
                tier = "Severe (7-10)"
            else:
                continue

            max_step = 0
            med_steps = {}
            if meds and isinstance(meds, list):
                for med in meds:
                    med_name = med.get("name")
                    schedule_mode = med.get("schedule_mode")
                    if med_name:
                        name_clean = med_name.lower().strip()
                        step = get_medication_pain_step(
                            med_name=med_name,
                            schedule_mode=schedule_mode
                        )
                        med_steps[name_clean] = step
                        if step > max_step:
                            max_step = step

            if max_step == 3:
                matrix[tier]["step3"] += 1
                for name, step in med_steps.items():
                    if step == 3:
                        if any(x in name for x in ["morphine", "mst", "m-eslon", "oramorph", "sevredol", "kapanol"]):
                            med_details["Severe (7-10)"]["morphine"] += 1
                        elif any(x in name for x in ["fentanyl", "duragesic", "matrifen", "durogesic"]):
                            med_details["Severe (7-10)"]["fentanyl"] += 1
                        elif any(x in name for x in ["oxycodone", "oxynorm", "oxycontin", "endone", "targin"]):
                            med_details["Severe (7-10)"]["oxycodone"] += 1
                        elif any(x in name for x in ["buprenorphine", "subutex", "suboxone", "transtec", "butrans"]):
                            med_details["Severe (7-10)"]["buprenorphine"] += 1
                        else:
                            med_details["Severe (7-10)"]["others"] += 1
                            others_breakdown["Severe (7-10)"][name] = others_breakdown["Severe (7-10)"].get(name, 0) + 1

            elif max_step == 2:
                matrix[tier]["step2"] += 1
                for name, step in med_steps.items():
                    if step == 2:
                        if any(x in name for x in ["tramadol", "ultram", "ultracet", "tramacet", "contramal", "tramal", "tramazac"]):
                            med_details["Moderate (4-6)"]["tramadol"] += 1
                        elif any(x in name for x in ["codeine", "co-codamol", "solpadeine", "tylenol 3", "tylenol #3"]):
                            med_details["Moderate (4-6)"]["codeine"] += 1
                        elif any(x in name for x in ["tapentadol", "nucynta", "palexia"]):
                            med_details["Moderate (4-6)"]["tapentadol"] += 1
                        else:
                            med_details["Moderate (4-6)"]["others"] += 1
                            others_breakdown["Moderate (4-6)"][name] = others_breakdown["Moderate (4-6)"].get(name, 0) + 1

            elif max_step == 1:
                matrix[tier]["step1"] += 1
                for name, step in med_steps.items():
                    if step == 1:
                        if any(x in name for x in ["paracetamol", "pcm", "dolo", "calpol", "crocin", "panadol", "tylenol", "metacin", "febrinil", "pacimol", "acetaminophen", "apap"]):
                            med_details["Mild (1-3)"]["paracetamol"] += 1
                        elif any(x in name for x in ["ibuprofen", "advil", "motrin", "brufen", "combiflam"]):
                            med_details["Mild (1-3)"]["ibuprofen"] += 1
                        elif any(x in name for x in ["diclofenac", "dynapar", "voltaren", "voveran", "diclomol"]):
                            med_details["Mild (1-3)"]["diclofenac"] += 1
                        else:
                            med_details["Mild (1-3)"]["others"] += 1
                            others_breakdown["Mild (1-3)"][name] = others_breakdown["Mild (1-3)"].get(name, 0) + 1
            else:
                matrix[tier]["no_analgesic"] += 1

        chart_data = [
            {
                "pain_tier": tier,
                "No Analgesic": data["no_analgesic"],
                "Step 1 (Non-Opioid)": data["step1"],
                "Step 2 (Weak Opioid)": data["step2"],
                "Step 3 (Strong Opioid)": data["step3"]
            }
            for tier, data in matrix.items()
        ]

        return jsonify({
            'success': True, 
            'data': chart_data, 
            'med_details': med_details,
            'others_breakdown': others_breakdown
        }), 200

    except Exception as e:
        logger.exception('pain ladder analytics failed')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/patients/beneficiaries', methods=['GET'])
@require_auth
def get_patient_beneficiaries(current_user):
    """Calculates patient + family member beneficiary metrics from family_chart and genogram."""
    try:
        start_d, end_d = parse_date_range(
            request.args.get('start_date'), request.args.get('end_date'))
        living_status = request.args.get('living_status')
        patient_status = request.args.get('patient_status')
        period = request.args.get('period', 'monthly')
        
        from app.analytics.family_analytics import FamilyAnalyticsService
        data = FamilyAnalyticsService.get_beneficiary_stats(
            start_d, end_d, living_status=living_status, patient_status=patient_status, period=period)
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('get_patient_beneficiaries failed')
        return jsonify({'error': str(e)}), 500


# Mount self-contained Custom Report module routes
from app.analytics.report import register_report_routes
register_report_routes(analytics_bp)
