"""
Patient API Routes
REST endpoints for patient management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import ValidationError
from uuid import UUID, uuid4
import math
import json

from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.auth.decorators import require_role
from app.patients.models import Patient
from app.patients.services import PatientService
from app.patients.uhid_service import (
    regenerate_uhid as regenerate_uhid_service,
    peek_next_uhid,
    VALID_ZONE_NAMES,
    get_valid_hospital_codes,
    get_hospital_catalog,
    invalidate_hospital_catalog_cache,
)
from app.reminders.models import SystemSetting
from app.patients.schemas import (
    PatientCreateSchema,
    PatientUpdateSchema,
    PatientSearchSchema,
    PatientResponseSchema,
    PatientSearchResultSchema
)


# Create Blueprint
patients_bp = Blueprint('patients', __name__, url_prefix='/api/patients')


@patients_bp.route('', methods=['GET'])
@jwt_required()
def list_patients():
    """
    List/search patients
    Query params: q (search), page, per_page, sort_by, sort_order
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        query = request.args.get('q', '')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Build filters
        bsc_status_param = request.args.get('bsc_status')
        filters = {
            'sort_by': sort_by,
            'sort_order': sort_order
        }
        if bsc_status_param is not None:
            filters['bsc_status'] = bsc_status_param.lower() == 'true'
        is_onco_param = request.args.get('is_onco')
        if is_onco_param is not None:
            filters['is_onco'] = is_onco_param.lower() == 'true'
        is_contacted_param = request.args.get('is_contacted')
        if is_contacted_param is not None:
            filters['is_contacted'] = is_contacted_param.lower() == 'true'
        if request.args.get('geographic_cluster'):
            filters['geographic_cluster'] = request.args.get('geographic_cluster')

        # Calculate offset
        offset = (page - 1) * per_page

        # Search patients
        patients, total = PatientService.search_patients(
            query=query if query else None,
            limit=per_page,
            offset=offset,
            filters=filters
        )

        # Calculate total pages
        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'patients': patients,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/zones/boundaries', methods=['GET'])
@jwt_required()
def zone_boundaries():
    """GBA 5-corporation boundaries (GeoJSON) + colors for the map overlay."""
    from app.patients import zone_service
    return jsonify({
        'boundaries': zone_service.get_boundaries(),
        'colors': zone_service.ZONE_COLORS,
    }), 200


@patients_bp.route('/zones/detect', methods=['POST'])
@jwt_required()
def zone_detect():
    """Detect a patient's GBA zone from lat/long (point-in-polygon).

    Body: {"lat": <float>, "lng": <float>}.
    Returns {"zone": "North"|...|null}. null = outside all GBA corporations.
    """
    from app.patients import zone_service
    data = request.get_json() or {}
    lat, lng = data.get('lat'), data.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng are required'}), 400
    return jsonify({'zone': zone_service.detect_zone(lat, lng)}), 200


@patients_bp.route('/<uuid:patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    """Get patient by ID"""
    try:
        current_user_id = get_jwt_identity()

        patient = PatientService.get_patient_by_id(patient_id)

        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Track access for recent patients
        PatientService.track_patient_access(UUID(current_user_id), patient_id)

        return jsonify(patient), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/uhid/preview', methods=['GET'])
@jwt_required()
def preview_uhid():
    """
    Read-only peek at the next UHID for a (zone, hospital) combination.

    Used by the patient registration form to show a live "probable UHID"
    preview card as the user picks zone and hospital. The counter is NOT
    advanced — concurrent registrations can still consume the same number,
    so callers should label the value as an estimate.

    Query params:
        zone      (required) — one of VALID_ZONE_NAMES
        hospital  (required) — must resolve via get_valid_hospital_codes()

    Returns:
        200: { homecare_code, next_uhid, full_display, year, zone_code, is_preview }
        400: missing / invalid params
    """
    try:
        zone = request.args.get('zone')
        hospital = request.args.get('hospital')

        if not zone:
            return jsonify({'error': 'missing_zone', 'message': 'zone query param is required'}), 400
        if zone not in VALID_ZONE_NAMES:
            return jsonify({
                'error': 'invalid_zone',
                'message': f'zone must be one of: {", ".join(VALID_ZONE_NAMES)}',
            }), 400
        if not hospital:
            return jsonify({'error': 'missing_hospital', 'message': 'hospital query param is required'}), 400
        valid_hospital_codes = get_valid_hospital_codes()
        if hospital not in valid_hospital_codes:
            return jsonify({
                'error': 'invalid_hospital',
                'message': f'hospital must be one of: {", ".join(valid_hospital_codes)}',
            }), 400

        preview = peek_next_uhid(zone, hospital)
        if preview is None:
            return jsonify({'error': 'preview_failed', 'message': 'Could not build UHID preview'}), 400

        return jsonify(preview), 200

    except Exception as e:
        return jsonify({'error': 'server_error', 'message': str(e)}), 500


@patients_bp.route('', methods=['POST'])
@jwt_required()
def create_patient():
    """Create a new patient"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate data
        try:
            patient_data = PatientCreateSchema(**data)
        except ValidationError as e:
            # Format validation errors properly for JSON
            errors = []
            for error in e.errors():
                errors.append({
                    'field': str(error.get('loc', ['unknown'])[0]) if error.get('loc') else 'unknown',
                    'message': str(error.get('msg', 'Validation error')),
                    'type': str(error.get('type', 'unknown'))
                })
            return jsonify({
                'error': 'validation_failed',
                'message': 'Invalid patient data',
                'details': errors
            }), 400
        except Exception as e:
            return jsonify({
                'error': 'validation_error',
                'message': str(e)
            }), 400

        # Check for duplicates (ABHA address, or Name + DOB + Phone)
        duplicate = None
        if not patient_data.ignore_duplicate:
            duplicate = PatientService.check_duplicate(
                abha_address=patient_data.abha_address,
                full_name=patient_data.full_name,
                date_of_birth=patient_data.date_of_birth,
                phone_number=patient_data.phone_number
            )

        if duplicate:
            return jsonify({
                'error': 'Duplicate patient found',
                'duplicate': duplicate
            }), 409

        # Create patient
        patient = PatientService.create_patient(
            data=patient_data,
            created_by=UUID(current_user_id)
        )

        return jsonify({'patient': patient}), 201

    except Exception as e:
        return jsonify({
            'error': 'server_error',
            'message': str(e)
        }), 500


@patients_bp.route('/<uuid:patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    """Update a patient"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate data
        try:
            patient_data = PatientUpdateSchema(**data)
        except ValidationError as e:
            return jsonify({'error': 'Validation error', 'details': e.errors()}), 400

        # Update patient
        patient = PatientService.update_patient(
            patient_id=patient_id,
            data=patient_data,
            updated_by=UUID(current_user_id)
        )

        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        return jsonify(patient), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/<uuid:patient_id>/regenerate-uhid', methods=['POST'])
@require_role('admin')
def regenerate_patient_uhid(patient_id):
    """
    Admin-only: regenerate a patient's UHID using the current (year, zone) counter.

    The old UHID is recorded in `uhid_history` so the patient remains searchable
    by either their current or any previous UHID. The old sequence number is
    permanently abandoned (gap in the old zone/year sequence) and never reused.

    Body (optional): { "reason": "..." }
    """
    try:
        current_user_id = get_jwt_identity()
        body = request.get_json(silent=True) or {}
        reason = (body.get('reason') or '').strip() or None

        patient = Patient.query.get(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        if not patient.is_bangalore_resident or not patient.geographic_cluster:
            return jsonify({
                'error': 'cannot_regenerate_uhid',
                'message': 'UHID can only be generated for Bangalore-resident patients with a zone set.',
            }), 400

        try:
            new_uhid = regenerate_uhid_service(
                patient=patient,
                replaced_by=UUID(current_user_id),
                reason=reason,
            )
        except ValueError as ve:
            db.session.rollback()
            return jsonify({'error': 'invalid_request', 'message': str(ve)}), 400

        try:
            db.session.commit()
        except IntegrityError as ie:
            db.session.rollback()
            return jsonify({
                'error': 'uhid_collision',
                'message': 'UHID collision while regenerating. Please retry.',
                'detail': str(ie.orig) if hasattr(ie, 'orig') else str(ie),
            }), 409

        return jsonify({
            'message': 'UHID regenerated',
            'patient': PatientService.get_patient_by_id(patient_id),
            'new_uhid': new_uhid,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500


@patients_bp.route('/<uuid:patient_id>/submissions', methods=['GET'])
@jwt_required()
def get_patient_submissions(patient_id):
    """Get all form submissions for a patient"""
    try:
        current_user_id = get_jwt_identity()

        # Check if patient exists
        patient = PatientService.get_patient_by_id(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)

        # Get submissions
        submissions, total = PatientService.get_patient_submissions(
            patient_id=patient_id,
            page=page,
            per_page=per_page
        )

        # Calculate total pages
        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'submissions': submissions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/recent', methods=['GET'])
@jwt_required()
def get_recent_patients():
    """Get recently accessed patients for current user"""
    try:
        current_user_id = get_jwt_identity()
        limit = min(int(request.args.get('limit', 10)), 50)

        recent_patients = PatientService.get_recent_patients(
            user_id=UUID(current_user_id),
            limit=limit
        )

        return jsonify({
            'patients': recent_patients,
            'count': len(recent_patients)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/search', methods=['POST'])
@jwt_required()
def advanced_search():
    """Advanced patient search with filters"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate search parameters
        try:
            search_params = PatientSearchSchema(**data)
        except ValidationError as e:
            return jsonify({'error': 'Validation error', 'details': e.errors()}), 400

        # Build filters dict
        filters = {
            'gender': search_params.gender,
            'age_min': search_params.age_min,
            'age_max': search_params.age_max,
            'city': search_params.city,
            'state': search_params.state,
            'has_abha': search_params.has_abha,
            'has_submissions': search_params.has_submissions,
            'bsc_status': search_params.bsc_status,
            'is_onco': search_params.is_onco,
            'is_contacted': search_params.is_contacted,
            'geographic_cluster': search_params.geographic_cluster,
            'created_after': search_params.created_after,
            'created_before': search_params.created_before,
            'sort_by': search_params.sort_by,
            'sort_order': search_params.sort_order
        }

        # Remove None values
        filters = {k: v for k, v in filters.items() if v is not None}

        # Calculate offset
        offset = (search_params.page - 1) * search_params.per_page

        # Search patients
        patients, total = PatientService.search_patients(
            query=search_params.query,
            limit=search_params.per_page,
            offset=offset,
            filters=filters
        )

        # Calculate total pages
        total_pages = math.ceil(total / search_params.per_page) if total > 0 else 0

        return jsonify({
            'patients': patients,
            'total': total,
            'page': search_params.page,
            'per_page': search_params.per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/duplicate-check', methods=['POST'])
@jwt_required()
def check_duplicate():
    """Check if a patient with the same ABHA address or Name+DOB+Phone exists"""
    try:
        data = request.get_json() or {}

        abha_address = data.get('abha_address')
        full_name = data.get('full_name')
        date_of_birth_str = data.get('date_of_birth')
        phone_number = data.get('phone_number')

        from datetime import date as date_type
        date_of_birth = None
        if date_of_birth_str:
            try:
                date_of_birth = date_type.fromisoformat(date_of_birth_str)
            except ValueError:
                pass

        duplicate = PatientService.check_duplicate(
            abha_address=abha_address,
            full_name=full_name,
            date_of_birth=date_of_birth,
            phone_number=phone_number
        )

        if duplicate:
            return jsonify({
                'duplicate_found': True,
                'patient': duplicate
            }), 200
        else:
            return jsonify({
                'duplicate_found': False
            }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@patients_bp.route('/<uuid:patient_id>/timeline', methods=['GET'])
@jwt_required()
def get_patient_timeline(patient_id):
    """Get patient timeline with submissions and key events"""
    try:
        current_user_id = get_jwt_identity()

        # Check if patient exists
        patient = PatientService.get_patient_by_id(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Get all submissions
        submissions, total = PatientService.get_patient_submissions(
            patient_id=patient_id,
            page=1,
            per_page=1000  # Get all for timeline
        )

        # Build timeline events
        timeline = []

        # Add patient creation event
        timeline.append({
            'type': 'patient_created',
            'date': patient['created_at'],
            'description': 'Patient registered',
            'data': {
                'full_name': patient['full_name']
            }
        })

        # Add submission events
        for submission in submissions:
            timeline.append({
                'type': 'form_submission',
                'date': submission['created_at'],
                'description': f"Submitted {submission['form_name']}",
                'data': {
                    'form_id': submission['form_id'],
                    'form_name': submission['form_name'],
                    'risk_score': submission['risk_score'],
                    'risk_category': submission['risk_category'],
                    'submitted_by': submission['submitted_by_name']
                }
            })

        # Sort timeline by date (most recent first)
        timeline.sort(key=lambda x: x['date'], reverse=True)

        return jsonify({
            'patient': patient,
            'timeline': timeline,
            'total_events': len(timeline)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Default options (fallback when no DB config exists) ─────────────────────

DEFAULT_DIAGNOSIS_OPTIONS = [
    'Breast cancer', 'Oral cancer', 'Cervical cancer', 'Lung cancer',
    'Colorectal cancers', 'Stomach cancer', 'GEJ carcinoma', 'ALL',
    'Neuroblastoma', 'Ewings sarcoma', 'Renal Cell Carcinoma',
    'Prostate cancer', 'Melanoma', 'Liver cancer', 'Gallbladder cancer',
    'Bladder cancer', 'Penile cancer', 'Pancreatic cancer', 'Other',
]

DEFAULT_REFERRAL_PARTNERS = [
    'Kidwai Memorial Institute of Oncology',
    'KC General Hospital',
    'Doctor Outside',
    'Self-Referral',
    'Other',
]


def _get_config_list(key, defaults):
    """Get a JSON list from system_settings, or return defaults."""
    setting = db.session.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting and setting.value:
        try:
            return json.loads(setting.value)
        except (json.JSONDecodeError, TypeError):
            pass
    return defaults


def _set_config_list(key, items, description=''):
    """Upsert a JSON list into system_settings."""
    setting = db.session.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = json.dumps(items)
    else:
        setting = SystemSetting(id=uuid4(), key=key, value=json.dumps(items), description=description)
        db.session.add(setting)
    db.session.commit()


# ─── Diagnosis Options Config ────────────────────────────────────────────────

@patients_bp.route('/config/diagnosis-options', methods=['GET'])
@jwt_required()
def get_diagnosis_options():
    """Get available diagnosis options."""
    options = _get_config_list('diagnosis_options', DEFAULT_DIAGNOSIS_OPTIONS)
    return jsonify({'options': options}), 200


@patients_bp.route('/config/diagnosis-options', methods=['PUT'])
@jwt_required()
def update_diagnosis_options():
    """Replace the full diagnosis options list."""
    data = request.get_json() or {}
    options = data.get('options')
    if not isinstance(options, list) or len(options) == 0:
        return jsonify({'error': 'options must be a non-empty array'}), 400
    _set_config_list('diagnosis_options', options, 'Diagnosis dropdown options')
    return jsonify({'options': options}), 200


@patients_bp.route('/config/diagnosis-options', methods=['POST'])
@jwt_required()
def add_diagnosis_option():
    """Add a single diagnosis option."""
    data = request.get_json() or {}
    new_option = (data.get('option') or '').strip()
    if not new_option:
        return jsonify({'error': 'option is required'}), 400
    options = _get_config_list('diagnosis_options', DEFAULT_DIAGNOSIS_OPTIONS)
    if new_option in options:
        return jsonify({'error': 'Option already exists'}), 409
    # Insert before "Other" if it exists, else append
    if 'Other' in options:
        idx = options.index('Other')
        options.insert(idx, new_option)
    else:
        options.append(new_option)
    _set_config_list('diagnosis_options', options, 'Diagnosis dropdown options')
    return jsonify({'options': options}), 201


@patients_bp.route('/config/diagnosis-options', methods=['DELETE'])
@jwt_required()
def delete_diagnosis_option():
    """Remove a single diagnosis option."""
    data = request.get_json() or {}
    option = (data.get('option') or '').strip()
    if not option:
        return jsonify({'error': 'option is required'}), 400
    options = _get_config_list('diagnosis_options', DEFAULT_DIAGNOSIS_OPTIONS)
    if option not in options:
        return jsonify({'error': 'Option not found'}), 404
    options.remove(option)
    _set_config_list('diagnosis_options', options, 'Diagnosis dropdown options')
    return jsonify({'options': options}), 200


# ─── Referral Partners Config ────────────────────────────────────────────────

@patients_bp.route('/config/referral-partners', methods=['GET'])
@jwt_required()
def get_referral_partners():
    """Get available referral partner options."""
    options = _get_config_list('referral_partners', DEFAULT_REFERRAL_PARTNERS)
    return jsonify({'options': options}), 200


@patients_bp.route('/config/referral-partners', methods=['PUT'])
@jwt_required()
def update_referral_partners():
    """Replace the full referral partners list."""
    data = request.get_json() or {}
    options = data.get('options')
    if not isinstance(options, list) or len(options) == 0:
        return jsonify({'error': 'options must be a non-empty array'}), 400
    _set_config_list('referral_partners', options, 'Referral partner options')
    return jsonify({'options': options}), 200


@patients_bp.route('/config/referral-partners', methods=['POST'])
@jwt_required()
def add_referral_partner():
    """Add a single referral partner."""
    data = request.get_json() or {}
    new_option = (data.get('option') or '').strip()
    if not new_option:
        return jsonify({'error': 'option is required'}), 400
    options = _get_config_list('referral_partners', DEFAULT_REFERRAL_PARTNERS)
    if new_option in options:
        return jsonify({'error': 'Partner already exists'}), 409
    if 'Other' in options:
        idx = options.index('Other')
        options.insert(idx, new_option)
    else:
        options.append(new_option)
    _set_config_list('referral_partners', options, 'Referral partner options')
    return jsonify({'options': options}), 201


@patients_bp.route('/config/referral-partners', methods=['DELETE'])
@jwt_required()
def delete_referral_partner():
    """Remove a single referral partner."""
    data = request.get_json() or {}
    option = (data.get('option') or '').strip()
    if not option:
        return jsonify({'error': 'option is required'}), 400
    options = _get_config_list('referral_partners', DEFAULT_REFERRAL_PARTNERS)
    if option not in options:
        return jsonify({'error': 'Partner not found'}), 404
    options.remove(option)
    _set_config_list('referral_partners', options, 'Referral partner options')
    return jsonify({'options': options}), 200


# ─── Hospital Options Config (DB-backed master list) ─────────────────────────
# Shape per entry: {code, name, homecare_prefix, is_default, is_active, lat?, lng?}
# Read path: GET uses app.patients.uhid_service.get_hospital_catalog(). Writes
# go through the helpers below. `code` and `homecare_prefix` are IMMUTABLE once
# set — historical PDFs/records reference the prefix, so reassigning would
# silently invalidate the meaning of every prior record.

def _hospital_options_list(include_inactive=False):
    """Read the catalog as a list (ordered, default-first, then by code)."""
    catalog = get_hospital_catalog(include_inactive=include_inactive)
    items = list(catalog.values())
    items.sort(key=lambda e: (not e.get('is_default', False), e['code']))
    return items


def _write_hospital_options(items):
    """Persist the catalog and invalidate the request-scoped cache."""
    setting = db.session.query(SystemSetting).filter(
        SystemSetting.key == 'hospital_options'
    ).first()
    value = json.dumps(items)
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(
            id=uuid4(), key='hospital_options', value=value,
            description='Hospital master list for linked_hospital / base_hospital',
        )
        db.session.add(setting)
    db.session.commit()
    invalidate_hospital_catalog_cache()


def _normalize_hospital_entry(raw, existing=None):
    """Validate and normalize a hospital dict. Raises ValueError on bad input."""
    code = (raw.get('code') or '').strip().upper()
    if not code or not code.isascii() or not all(c.isalnum() for c in code):
        raise ValueError('code must be alphanumeric, 2-10 chars')
    if not (2 <= len(code) <= 10):
        raise ValueError('code must be 2-10 chars')
    name = (raw.get('name') or '').strip()
    if not name:
        raise ValueError('name is required')
    prefix = (raw.get('homecare_prefix') or '').strip().upper()
    if not prefix:
        prefix = f'KAGBA{code}'  # auto-derive default
    if not (5 <= len(prefix) <= 20):
        raise ValueError('homecare_prefix must be 5-20 chars')
    entry = {
        'code': code,
        'name': name,
        'homecare_prefix': prefix,
        'is_default': bool(raw.get('is_default', False)),
        'is_active': bool(raw.get('is_active', True)),
    }
    lat = raw.get('lat')
    lng = raw.get('lng')
    if lat is not None:
        try:
            entry['lat'] = float(lat)
        except (TypeError, ValueError):
            raise ValueError('lat must be a number')
    if lng is not None:
        try:
            entry['lng'] = float(lng)
        except (TypeError, ValueError):
            raise ValueError('lng must be a number')
    # Immutability enforcement
    if existing is not None:
        if entry['code'] != existing['code']:
            raise ValueError(f'code is immutable (was {existing["code"]})')
        if entry['homecare_prefix'] != existing['homecare_prefix']:
            raise ValueError(
                f'homecare_prefix is immutable for existing code {code} '
                f'(was {existing["homecare_prefix"]})'
            )
    return entry


@patients_bp.route('/config/hospital-options', methods=['GET'])
@jwt_required()
def get_hospital_options():
    """Return the hospital master list (active only by default)."""
    include_inactive = request.args.get('include_inactive', '').lower() in ('1', 'true', 'yes')
    options = _hospital_options_list(include_inactive=include_inactive)
    return jsonify({'options': options}), 200


@patients_bp.route('/config/hospital-options', methods=['POST'])
@jwt_required()
def add_hospital_option():
    """Add a single hospital."""
    data = request.get_json() or {}
    try:
        entry = _normalize_hospital_entry(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    # Always persist the full list (seed on first write).
    items = _hospital_options_list(include_inactive=True)
    if any(it['code'] == entry['code'] for it in items):
        return jsonify({'error': f'hospital code {entry["code"]} already exists'}), 409
    # New entry can't claim default unless no default exists yet.
    if entry['is_default'] and any(it.get('is_default') for it in items):
        entry['is_default'] = False
    items.append(entry)
    _write_hospital_options(items)
    return jsonify({'options': _hospital_options_list(), 'added': entry}), 201


@patients_bp.route('/config/hospital-options', methods=['PUT'])
@jwt_required()
def update_hospital_options():
    """
    Replace the catalog. Mutable: name, is_active, is_default, lat, lng.
    Immutable for existing codes: code, homecare_prefix.
    """
    data = request.get_json() or {}
    raw_items = data.get('options')
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return jsonify({'error': 'options must be a non-empty array'}), 400

    existing_by_code = {it['code']: it for it in _hospital_options_list(include_inactive=True)}
    validated = []
    try:
        for raw in raw_items:
            code = (raw.get('code') or '').strip().upper()
            existing = existing_by_code.get(code)
            validated.append(_normalize_hospital_entry(raw, existing=existing))
    except ValueError as e:
        return jsonify({'error': str(e)}), 422

    # Enforce: at most one is_default.
    defaults = [e for e in validated if e.get('is_default')]
    if len(defaults) > 1:
        return jsonify({'error': 'only one hospital may have is_default=true'}), 422
    # Duplicate code check.
    codes = [e['code'] for e in validated]
    if len(set(codes)) != len(codes):
        return jsonify({'error': 'duplicate codes in payload'}), 422

    _write_hospital_options(validated)
    return jsonify({'options': _hospital_options_list()}), 200


@patients_bp.route('/config/hospital-options', methods=['DELETE'])
@jwt_required()
def delete_hospital_option():
    """
    Soft-delete (is_active=false) when any patient/vehicle references the code.
    Hard-delete only when zero references exist.
    Pass ?force=1 to always soft-delete (skip hard path even if refs are zero).
    """
    data = request.get_json() or {}
    code = (data.get('code') or '').strip().upper()
    if not code:
        return jsonify({'error': 'code is required'}), 400

    items = _hospital_options_list(include_inactive=True)
    target_idx = next((i for i, it in enumerate(items) if it['code'] == code), None)
    if target_idx is None:
        return jsonify({'error': f'hospital {code} not found'}), 404

    # Count live references.
    from app.patients.models import Patient
    from app.saranam.models.vehicle import Vehicle
    patient_count = db.session.query(Patient).filter_by(linked_hospital=code).count()
    vehicle_count = db.session.query(Vehicle).filter_by(base_hospital=code).count()
    force = request.args.get('force', '').lower() in ('1', 'true', 'yes')

    if patient_count == 0 and vehicle_count == 0 and not force:
        # Hard delete — fully remove the entry.
        items.pop(target_idx)
        _write_hospital_options(items)
        return jsonify({'deleted': code, 'mode': 'hard'}), 200

    if items[target_idx].get('is_default'):
        return jsonify({
            'error': 'cannot_delete_default',
            'message': 'Set another hospital as default before deleting this one.',
        }), 409

    # Soft delete.
    items[target_idx]['is_active'] = False
    _write_hospital_options(items)
    return jsonify({
        'deleted': code,
        'mode': 'soft',
        'patient_count': patient_count,
        'vehicle_count': vehicle_count,
    }), 200


@patients_bp.route('/<uuid:patient_id>/pps', methods=['POST'])
@jwt_required()
def record_patient_pps(patient_id):
    """
    Record a standalone (patient-level) PPS score — not tied to a visit.

    The meeting directive (§2, 2026-04-14) made PPS a universal patient-level
    concept so it can be updated from anywhere (PpsCard on the overview page,
    a phone follow-up, etc). This route writes a fresh pps_scores row with
    visit_id=NULL, then calls the priority sync to update
    patients.latest_pps_score + patients.clinical_complexity.

    Body: { pps_score: 0-100 (multiple of 10), notes?: str, ambulation?: str,
            activity_level?: str, self_care?: str, intake?: str,
            consciousness_level?: str, estimated_survival_days?: int }

    Returns: { pps: {...new row...}, priority: {latest_pps_score, clinical_complexity} }
    """
    from app.saranam.models.pps_score import PpsScore
    from app.patients.priority_service import sync_patient_priority_from_pps

    data = request.get_json() or {}
    score = data.get('pps_score')
    try:
        score = int(score) if score is not None else None
    except (TypeError, ValueError):
        return jsonify({'error': 'pps_score must be an integer 0-100'}), 400
    if score is None or not (0 <= score <= 100):
        return jsonify({'error': 'pps_score must be 0-100'}), 400

    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    user_id = get_jwt_identity()
    row = PpsScore(
        patient_id=patient_id,
        visit_id=None,  # standalone entry
        pps_score=score,
        ambulation=data.get('ambulation'),
        activity_level=data.get('activity_level'),
        self_care=data.get('self_care'),
        intake=data.get('intake'),
        consciousness_level=data.get('consciousness_level'),
        estimated_survival_days=data.get('estimated_survival_days'),
        notes=data.get('notes'),
        recorded_by=user_id,
    )
    db.session.add(row)
    db.session.commit()

    priority = sync_patient_priority_from_pps(patient_id)

    return jsonify({
        'pps': row.to_dict(),
        'priority': priority,
    }), 201


@patients_bp.route('/<uuid:patient_id>/full-history', methods=['GET'])
@jwt_required()
def get_patient_full_history(patient_id):
    """Get comprehensive patient history from ALL modules."""
    try:
        from app.patients.models import Patient
        from app.saranam.models.patient_visit import PatientVisit, parse_vitals_temperature
        from app.saranam.models.nursing_assessment import NursingAssessment
        from app.saranam.models.doctor_assessment import DoctorAssessment
        from app.saranam.models.psychological_assessment import PsychologicalAssessment
        from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
        from app.saranam.models.esas_score import EsasScore
        from app.saranam.models.pps_score import PpsScore
        from app.saranam.models.plan_of_care import PlanOfCare
        from app.encounters.models import Encounter
        from app.opd.models import OPDPrescription, OPDLabOrder
        from app.ipd.models import IPDAdmission, VitalsRecord
        from app.observations.models import Observation
        from app.diagnoses.models import Diagnosis
        from app.submissions.models import FormSubmission
        from app.inventory.models import DispensingRecord

        patient = Patient.query.get(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        events = []

        # 1. Patient registration
        # Use registration_date (real-world date patient was registered,
        # which may be well before it was entered into the system) rather
        # than created_at (system entry timestamp). Fall back to created_at
        # for older records that predate the registration_date column.
        reg_date = patient.registration_date or patient.created_at
        events.append({
            'type': 'patient_registered',
            'date': reg_date.isoformat() if reg_date else None,
            'sort_created_at': patient.created_at.isoformat() if patient.created_at else '',
            'title': 'Patient Registered',
            'icon': 'user',
            'data': {
                'source': patient.source_system,
                'bsc_status': patient.bsc_status,
                'is_onco': patient.is_onco,
            }
        })

        # 2. Saranam visits + assessments
        visits = PatientVisit.query.filter_by(patient_id=patient_id).order_by(PatientVisit.visit_date.desc()).all()
        for v in visits:
            visit_data = {
                'visit_id': str(v.id),
                'visit_number': v.visit_number,
                'visit_type': v.visit_type,
                'visit_location': v.visit_location,
                'status': v.status,
                'vitals': {},
                'assessments': {},
                'prescription': None,
            }

            # Vitals
            if v.vitals_pr or v.vitals_bp_systolic or v.vitals_spo2:
                visit_data['vitals'] = {
                    'pr': v.vitals_pr, 'bp_systolic': v.vitals_bp_systolic,
                    'bp_diastolic': v.vitals_bp_diastolic, 'rr': v.vitals_rr,
                    'spo2': float(v.vitals_spo2) if v.vitals_spo2 else None,
                    'temperature': parse_vitals_temperature(v.vitals_temperature),
                    'grbs': float(v.vitals_grbs) if v.vitals_grbs else None,
                }

            # Assessments — return full data from each
            nursing = NursingAssessment.query.filter_by(visit_id=v.id).first()
            if nursing:
                visit_data['assessments']['nursing'] = nursing.to_dict()
            doctor = DoctorAssessment.query.filter_by(visit_id=v.id).first()
            if doctor:
                visit_data['assessments']['doctor'] = doctor.to_dict()
            psych = PsychologicalAssessment.query.filter_by(visit_id=v.id).first()
            if psych:
                visit_data['assessments']['psychological'] = psych.to_dict()
            physio = PhysiotherapyAssessment.query.filter_by(visit_id=v.id).first()
            if physio:
                visit_data['assessments']['physiotherapy'] = physio.to_dict()
            esas = EsasScore.query.filter_by(visit_id=v.id).first()
            if esas:
                visit_data['assessments']['esas'] = esas.to_dict()
            pps = PpsScore.query.filter_by(visit_id=v.id).first()
            if pps:
                visit_data['assessments']['pps'] = pps.to_dict()

            try:
                from app.teleconsult.services.orchestrator import SessionOrchestrator
                tele_doc = SessionOrchestrator.get_documentation_by_visit(v.id)
                if tele_doc:
                    visit_data['assessments']['teleconsult'] = tele_doc
            except Exception as e:
                pass

            care_plan = PlanOfCare.query.filter_by(visit_id=v.id).first()
            if care_plan:
                visit_data['prescription'] = {
                    'pharmacological': care_plan.intervention_pharmacological,
                    'non_pharmacological': care_plan.intervention_non_pharmacological,
                    'medications': care_plan.medications or [],
                    'follow_up_notes': care_plan.follow_up_notes,
                }

            visit_data['summary'] = v.visit_summary
            visit_data['advice_pharmacological'] = v.advice_pharmacological
            visit_data['follow_up_advice'] = v.follow_up_advice

            if v.visit_type == 'initial':
                type_label = 'Initial Assessment'
                icon_type = 'stethoscope'
            elif v.visit_type == 'teleconsult':
                type_label = f'Teleconsultation #{v.visit_number}'
                icon_type = 'video'
            else:
                type_label = f'Home Visit #{v.visit_number}'
                icon_type = 'home'

            events.append({
                'type': 'saranam_visit',
                'date': v.visit_date.isoformat() if v.visit_date else v.created_at.isoformat(),
                'sort_created_at': v.created_at.isoformat() if v.created_at else '',
                'title': type_label,
                'icon': icon_type,
                'data': visit_data,
            })


        # 3. Encounters (OPD, IPD, Homecare, Teleconsultation)
        encounters = Encounter.query.filter_by(patient_id=patient_id).order_by(Encounter.created_at.desc()).all()
        for enc in encounters:
            enc_data = {
                'encounter_id': str(enc.id),
                'encounter_type': enc.encounter_type,
                'status': enc.status,
                'chief_complaint': enc.chief_complaint,
                'provider_name': enc.provider.full_name if enc.provider else None,
                'start_time': enc.start_time.isoformat() if enc.start_time else None,
                'end_time': enc.end_time.isoformat() if enc.end_time else None,
                'notes': enc.post_appointment_notes,
            }

            # Diagnoses for this encounter
            diagnoses = Diagnosis.query.filter_by(encounter_id=enc.id).all()
            if diagnoses:
                enc_data['diagnoses'] = [{
                    'text': d.diagnosis_text, 'type': d.diagnosis_type,
                    'severity': d.severity, 'icd10': d.icd10_code,
                } for d in diagnoses]

            # Prescription
            rx = OPDPrescription.query.filter_by(encounter_id=enc.id).first()
            if rx:
                enc_data['prescription'] = {
                    'status': rx.status.value if rx.status else None,
                    'items': [{'name': i.medicine_name, 'dosage': i.dosage,
                              'frequency': i.frequency, 'duration': i.duration,
                              'quantity': i.quantity} for i in (rx.items or [])],
                }

            # Lab orders
            lab = OPDLabOrder.query.filter_by(encounter_id=enc.id).first()
            if lab:
                enc_data['lab_orders'] = {
                    'status': lab.status.value if lab.status else None,
                    'items': [{'test': i.test_name, 'urgency': i.urgency.value if i.urgency else None,
                              'result': i.result} for i in (lab.items or [])],
                }

            icon_map = {'OPD': 'stethoscope', 'IPD': 'bed', 'HOME_CARE': 'home',
                       'Teleconsultation': 'video', 'Emergency': 'alert'}
            enc_type = enc.encounter_type or 'Visit'
            events.append({
                'type': 'encounter',
                'date': enc.start_time.isoformat() if enc.start_time else enc.created_at.isoformat(),
                'sort_created_at': enc.created_at.isoformat() if enc.created_at else '',
                'title': f'{enc_type} Visit',
                'icon': icon_map.get(enc_type, 'clipboard'),
                'data': enc_data,
            })

        # 4. IPD Admissions
        admissions = IPDAdmission.query.filter_by(patient_id=patient_id).order_by(IPDAdmission.created_at.desc()).all()
        for adm in admissions:
            adm_data = {
                'admission_id': str(adm.id),
                'admission_type': adm.admission_type,
                'admission_diagnosis': adm.admission_diagnosis,
                'discharge_type': adm.discharge_type,
                'discharge_diagnosis': adm.discharge_diagnosis,
                'discharge_summary': adm.discharge_summary,
                'doctor_notes': adm.doctor_notes,
            }
            events.append({
                'type': 'ipd_admission',
                'date': adm.created_at.isoformat(),
                'sort_created_at': adm.created_at.isoformat() if adm.created_at else '',
                'title': f'IPD Admission ({adm.admission_type or ""})',
                'icon': 'bed',
                'data': adm_data,
            })

        # 5. Dispensing records
        dispensings = DispensingRecord.query.filter_by(patient_id=patient_id).order_by(DispensingRecord.dispensed_at.desc().nullslast()).all()
        for disp in dispensings:
            med_name = ''
            if disp.medicine:
                med_name = disp.medicine.medicine_name or disp.medicine.generic_name or ''
            events.append({
                'type': 'dispensing',
                'date': disp.dispensed_at.isoformat() if disp.dispensed_at else disp.created_at.isoformat(),
                'sort_created_at': disp.created_at.isoformat() if disp.created_at else '',
                'title': f'Medicine Dispensed: {med_name}',
                'icon': 'pill',
                'data': {
                    'medicine_name': med_name,
                    'quantity': disp.dispensed_quantity,
                    'dosage': disp.dosage,
                    'frequency': disp.frequency,
                    'status': disp.status,
                },
            })

        # 6. Form submissions
        submissions = FormSubmission.query.filter_by(patient_id=patient_id).order_by(FormSubmission.created_at.desc()).all()
        for sub in submissions:
            form_name = sub.form.title if sub.form else 'Unknown Form'
            events.append({
                'type': 'form_submission',
                'date': sub.submitted_at.isoformat() if sub.submitted_at else sub.created_at.isoformat(),
                'sort_created_at': sub.created_at.isoformat() if sub.created_at else '',
                'title': f'Form: {form_name}',
                'icon': 'file',
                'data': {
                    'form_name': form_name,
                    'status': sub.submission_status,
                    'answer_count': len(sub.answers.all()) if sub.answers else 0,
                },
            })

        # Sort all events chronologically (oldest first).
        #
        # IMPORTANT: `date` has inconsistent precision across event types —
        # e.g. patient_registered uses a full timestamp (patient.created_at)
        # while saranam_visit uses a date-only value (visit_date, always
        # midnight). Comparing full `date` strings directly is unreliable:
        # a same-day visit's "00:00:00" can sort before registration's real
        # "11:13:44" time, even though registration happened first.
        #
        # To avoid this, use only the calendar-day portion of `date` (first
        # 10 chars, YYYY-MM-DD) as the primary key, and always break ties
        # with `sort_created_at` (full precision, present on every event
        # type) rather than relying on `date`'s precision to be consistent.
        events.sort(key=lambda x: ((x.get('date') or '')[:10], x.get('sort_created_at') or ''))

        # Drop the internal sort key before returning to the client
        for e in events:
            e.pop('sort_created_at', None)

        return jsonify({
            'events': events,
            'total': len(events),
            'summary': {
                'saranam_visits': len([e for e in events if e['type'] == 'saranam_visit']),
                'encounters': len([e for e in events if e['type'] == 'encounter']),
                'ipd_admissions': len([e for e in events if e['type'] == 'ipd_admission']),
                'dispensings': len([e for e in events if e['type'] == 'dispensing']),
                'forms': len([e for e in events if e['type'] == 'form_submission']),
            }
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@patients_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'patients'}), 200
