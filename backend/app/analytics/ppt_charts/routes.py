"""
Dedicated Flask Blueprint for PPT Charts.
Completely decoupled from legacy analytics routes and services.
Imports models and schemas directly from core domain modules (patients, visits, etc.).
"""

from flask import Blueprint, request, jsonify
from app.auth.decorators import require_auth
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)
from .monthly_registrations import get_monthly_registration_data
from .age_category import get_age_category_data
from .gender_profile import get_gender_profile_data
from .zone_categorization import get_zone_categorization_data
from .distance_distribution import get_distance_distribution_data
from .zone_seen_categorization import get_zone_seen_data
from .distance_seen_distribution import get_distance_seen_distribution_data
from .visits_categorization import get_visits_categorization_data
from .visit_type_analysis import get_visit_type_analysis_data
from .responsiveness_analysis import get_responsiveness_analysis_data
from .homecare_decline import get_homecare_decline_data
from .phone_call_distribution import get_phone_call_distribution_data
from .phone_call_trend import get_phone_call_trend_data
from .consultation_breakup import get_consultation_breakup_data
from .consultation_monthly_trend import get_consultation_monthly_trend_data
from .consultation_split import get_consultation_split_data
from .clinical_procedures_trend import get_clinical_procedures_trend_data
from .pps_analysis import get_pps_analysis_data
from .patient_category import get_patient_category_data
from .cancer_category import get_cancer_category_data
from .place_of_death import get_place_of_death_data
from .monthly_deaths import get_monthly_deaths_data
from .vehicle_distance import get_vehicle_distance_data
from .homecare_visits import get_homecare_visits_data
from .homecare_days import get_homecare_days_data
from .mortality_overview import get_mortality_overview_data




ppt_charts_bp = Blueprint('ppt_charts', __name__)


@ppt_charts_bp.route('/overview-stats', methods=['GET'])
@require_auth
def get_overview_stats(current_user):
    """
    Get overview statistics:
    - total_patients: registered active patients
    - total_vehicles: number of home-care vehicles
    - total_distance: total distance covered (kms)
    - total_homecare_days: total home-care days (unique non-teleconsult visit dates)
    - total_homecare_visits: total home-care visits
    Supports optional status, complexity, and date filters.
    """
    try:
        from sqlalchemy import func
        from app.extensions import db
        from app.saranam.models.patient_visit import PatientVisit
        from app.saranam.models.vehicle import Vehicle
        from app.saranam.models.vehicle_log import VehicleLog

        filters = parse_filter_params(request.args)
        status = filters.get('status')
        complexity = filters.get('complexity')
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')

        # 1. Total Registered Patients
        query = Patient.query.filter(Patient.is_active.is_(True))
        query = apply_patient_filters(
            query,
            status=status,
            complexity=complexity
        )
        query = apply_date_range_filter(
            query,
            Patient.registration_date,
            start_date=start_date,
            end_date=end_date
        )
        total_patients = query.count()

        # 2. Number of Home-care Vehicles
        vehicle_count = db.session.query(Vehicle).filter(Vehicle.is_active.is_(True)).count()
        if vehicle_count == 0:
            vehicle_count = db.session.query(Vehicle).count()

        # 3. Total Distance Covered (reusing get_vehicle_distance_data for exact parity with chart)
        dist_res = get_vehicle_distance_data(request.args)
        total_distance = dist_res.get('grand_total', 0)

        # 4. Total Home-Care Days (reusing get_homecare_days_data for exact parity with chart)
        days_res = get_homecare_days_data(request.args)
        total_homecare_days = days_res.get('total', 0)

        # 5. Total Home-Care Visits (reusing get_homecare_visits_data for exact parity with chart)
        visits_res = get_homecare_visits_data(request.args)
        total_homecare_visits = visits_res.get('total', 0)

        # 6. Patients seen at least once (unique patient_id with home-care visits)
        seen_query = (
            db.session.query(
                Patient.id,
                Patient.date_of_birth
            )
            .join(PatientVisit, PatientVisit.patient_id == Patient.id)
            .filter(
                Patient.is_active.is_(True),
                func.coalesce(func.lower(PatientVisit.visit_type), '') != 'teleconsult',
                PatientVisit.visit_date.isnot(None)
            )
        )
        if status or complexity:
            seen_query = apply_patient_filters(seen_query, status=status, complexity=complexity)
        if start_date or end_date:
            seen_query = apply_date_range_filter(seen_query, PatientVisit.visit_date, start_date=start_date, end_date=end_date)
        
        seen_patients = seen_query.distinct(Patient.id).all()
        patients_seen = len(seen_patients)

        # 7. Average Home-Care Visits (Total Home-Care Visits / Patients seen at least once)
        if patients_seen > 0:
            avg_homecare_visits = round(total_homecare_visits / patients_seen, 2)
        else:
            avg_homecare_visits = 0.0

        # 8. Children | Adults | Older Adults breakdown among patients seen
        from datetime import date as _dt_date
        today_date = _dt_date.today()
        children_cnt = 0
        adults_cnt = 0
        older_adults_cnt = 0

        for sp in seen_patients:
            dob = sp.date_of_birth
            if not dob:
                continue
            if isinstance(dob, str):
                try:
                    from datetime import datetime as _dt_datetime
                    dob = _dt_datetime.strptime(dob[:10], '%Y-%m-%d').date()
                except Exception:
                    continue
            age = today_date.year - dob.year - ((today_date.month, today_date.day) < (dob.month, dob.day))
            if age <= 19:
                children_cnt += 1
            elif 20 <= age <= 59:
                adults_cnt += 1
            else:
                older_adults_cnt += 1

        age_breakdown_str = f"{children_cnt} | {adults_cnt} | {older_adults_cnt}"

        # 9. Consultations & Clinical Procedures summary metrics
        try:
            consult_res = get_consultation_breakup_data(request.args)
            home_consultations = consult_res.get('homecare_count', 0)
            phone_consultations = consult_res.get('phone_count', 0)
        except Exception:
            home_consultations = 0
            phone_consultations = 0

        try:
            proc_res = get_clinical_procedures_trend_data(request.args)
            clinical_procedures_home = proc_res.get('grand_total', 0)
        except Exception:
            clinical_procedures_home = 0

        # 10. Mortality summary metrics
        try:
            mortality_res = get_mortality_overview_data(request.args)
            number_of_deaths = mortality_res.get('number_of_deaths', 0)
            deaths_before_first_visit = mortality_res.get('deaths_before_first_visit', 0)
            avg_days_regn_to_death = mortality_res.get('avg_days_regn_to_death', 0)
            deaths_at_home_pct = mortality_res.get('deaths_at_home_pct', 0)
        except Exception:
            number_of_deaths = 0
            deaths_before_first_visit = 0
            avg_days_regn_to_death = 0
            deaths_at_home_pct = 0

        return jsonify({
            'success': True,
            'total_patients': total_patients,
            'total_vehicles': vehicle_count,
            'total_distance': total_distance,
            'total_homecare_days': total_homecare_days,
            'total_homecare_visits': total_homecare_visits,
            'patients_seen': patients_seen,
            'avg_homecare_visits': avg_homecare_visits,
            'age_breakdown': {
                'children': children_cnt,
                'adults': adults_cnt,
                'older_adults': older_adults_cnt,
                'display': age_breakdown_str,
            },
            'home_consultations': home_consultations,
            'phone_consultations': phone_consultations,
            'clinical_procedures_home': clinical_procedures_home,
            'number_of_deaths': number_of_deaths,
            'deaths_before_first_visit': deaths_before_first_visit,
            'avg_days_regn_to_death': avg_days_regn_to_death,
            'deaths_at_home_pct': deaths_at_home_pct,
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/monthly-registrations', methods=['GET'])
@require_auth
def get_monthly_registrations(current_user):
    """
    Get trend of monthly patient registrations.
    """
    try:
        result = get_monthly_registration_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/age-category', methods=['GET'])
@require_auth
def get_age_category(current_user):
    """
    Get distribution of patients by age categories.
    """
    try:
        result = get_age_category_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/gender-profile', methods=['GET'])
@require_auth
def get_gender_profile(current_user):
    """
    Get distribution of patients by gender.
    """
    try:
        result = get_gender_profile_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/zone-categorization', methods=['GET'])
@require_auth
def get_zone_categorization(current_user):
    """
    Get zone-wise categorization of registered patients.
    """
    try:
        result = get_zone_categorization_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/distance-distribution', methods=['GET'])
@require_auth
def get_distance_distribution(current_user):
    """
    Get distance distribution of registered patients from Kidwai Hospital.
    """
    try:
        result = get_distance_distribution_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/zone-seen', methods=['GET'])
@require_auth
def get_zone_seen(current_user):
    """
    Get zone-wise categorization of patients seen (who received a visit).
    """
    try:
        result = get_zone_seen_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/distance-seen', methods=['GET'])
@require_auth
def get_distance_seen(current_user):
    """
    Get distance distribution of patients seen from Kidwai Hospital.
    """
    try:
        result = get_distance_seen_distribution_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/visits-categorization', methods=['GET'])
@require_auth
def get_visits_categorization(current_user):
    """
    Get categorization of patients by number of visits received,
    split across Alive and Deceased cohorts.
    """
    try:
        result = get_visits_categorization_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/visit-type-analysis', methods=['GET'])
@require_auth
def get_visit_type_analysis(current_user):
    """
    Get analysis of home visits by type (First, Follow-up, Bereavement) grouped by month.
    """
    try:
        result = get_visit_type_analysis_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/responsiveness-analysis', methods=['GET'])
@require_auth
def get_responsiveness_analysis(current_user):
    """
    Get responsiveness analysis: average calendar days from patient registration to first visit.
    """
    try:
        result = get_responsiveness_analysis_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/homecare-decline', methods=['GET'])
@require_auth
def get_homecare_decline(current_user):
    """
    Get monthly trend of Homecare Decline %.
    """
    try:
        result = get_homecare_decline_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/phone-call-distribution', methods=['GET'])
@require_auth
def get_phone_call_distribution(current_user):
    """
    Get incoming vs outgoing phone call consultations breakdown.
    """
    try:
        result = get_phone_call_distribution_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/phone-call-trend', methods=['GET'])
@require_auth
def get_phone_call_trend(current_user):
    """
    Get monthly volume trend of phone call consultations.
    """
    try:
        result = get_phone_call_trend_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/consultation-breakup', methods=['GET'])
@require_auth
def get_consultation_breakup(current_user):
    """
    Get breakup of consultations into Home care vs Phone call consultations.
    """
    try:
        result = get_consultation_breakup_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/consultation-monthly-trend', methods=['GET'])
@require_auth
def get_consultation_monthly_trend(current_user):
    """
    Get monthwise trend of consultations (Home care, Phone care, Total).
    """
    try:
        result = get_consultation_monthly_trend_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/consultation-split', methods=['GET'])
@require_auth
def get_consultation_split(current_user):
    """
    Get split of consultations across provider roles (Physiotherapist, Counsellor, Nurse, Doctor),
    stacked by Homecare vs. Phonecall consultations.
    """
    try:
        result = get_consultation_split_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/clinical-procedures-trend', methods=['GET'])
@require_auth
def get_clinical_procedures_trend(current_user):
    """
    Get monthwise trend of at-home clinical procedures (Nurse, Counsellor, Physio, Doctor).
    """
    try:
        result = get_clinical_procedures_trend_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/pps-analysis', methods=['GET'])
@require_auth
def get_pps_analysis(current_user):
    """
    Get distribution of patients by Palliative Performance Scale (PPS: High, Medium, Low).
    """
    try:
        result = get_pps_analysis_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/patient-category', methods=['GET'])
@require_auth
def get_patient_category(current_user):
    """
    Get distribution of patients by Patient Category (BSC Onco, N-BSC Onco, N-BSC Non Onco).
    """
    try:
        result = get_patient_category_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/cancer-category', methods=['GET'])
@require_auth
def get_cancer_category(current_user):
    """
    Get cancer category bifurcation (Digestive, Gynaecological, Head & Neck, Breast, etc.)
    using the Patient diagnosis field.
    """
    try:
        result = get_cancer_category_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/place-of-death', methods=['GET'])
@require_auth
def get_place_of_death(current_user):
    """
    Get distribution of deceased patients by Place of Death
    (Home, Hospital, On The Way, Others).
    """
    try:
        result = get_place_of_death_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/monthly-deaths', methods=['GET'])
@require_auth
def get_monthly_deaths(current_user):
    """
    Get monthwise trend of deaths using Patient.date_of_death.
    """
    try:
        result = get_monthly_deaths_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/vehicle-distance', methods=['GET'])
@require_auth
def get_vehicle_distance(current_user):
    """
    Get monthwise distance travelled per vehicle from vehicle_logs table.
    """
    try:
        result = get_vehicle_distance_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/homecare-visits', methods=['GET'])
@require_auth
def get_homecare_visits(current_user):
    """
    Get monthwise homecare visits trend where visit_type != 'teleconsult' using patient_visits.visit_date.
    """
    try:
        result = get_homecare_visits_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ppt_charts_bp.route('/homecare-days', methods=['GET'])
@require_auth
def get_homecare_days(current_user):
    """
    Get monthwise homecare days count (distinct visit dates) from patient_visits table.
    """
    try:
        result = get_homecare_days_data(request.args)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500



