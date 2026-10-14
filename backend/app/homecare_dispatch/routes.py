"""Homecare dispatch REST API (Patients Directory, Scheduling Board, Vehicles,
Completion Report, System Settings)."""
import logging
import os
from datetime import date, timedelta
from functools import wraps

from flask import Response, jsonify, request
from flask_jwt_extended import jwt_required

from app.auth.decorators import require_role
from app.homecare_dispatch import homecare_dispatch_bp as bp
from app.homecare_dispatch import logic, repository as repo, service
from app.homecare_dispatch.settings import load_settings, save_settings

logger = logging.getLogger(__name__)

# Roles with the frontend's manage_scheduling permission (everyone except viewers).
WRITE_ROLES = ('admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry')


def api_errors(f):
    """Map service exceptions to JSON responses."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except service.ConcurrentScheduleEdit as e:
            return jsonify({'error': str(e), 'code': 'concurrent_edit', 'db_count': e.db_count}), 409
        except LookupError as e:
            return jsonify({'error': str(e)}), 404
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.exception("Homecare dispatch request failed")
            return jsonify({'error': f'Unexpected error: {e}'}), 500
    return wrapper


def _date(value: str) -> date:
    d = logic._parse_date(value)
    if not d:
        raise ValueError(f"Invalid date: {value!r}. Use YYYY-MM-DD.")
    return d


def _body() -> dict:
    return request.get_json(silent=True) or {}


# ---------------------------------------------------------------------------
# System Settings
# ---------------------------------------------------------------------------

@bp.route('/settings', methods=['GET'])
@jwt_required()
@api_errors
def get_settings():
    return jsonify({'settings': load_settings()}), 200


@bp.route('/settings', methods=['PUT'])
@require_role(*WRITE_ROLES)
@api_errors
def put_settings():
    return jsonify({'settings': save_settings(_body()), 'message': 'Configurations saved successfully.'}), 200


# ---------------------------------------------------------------------------
# Patients Directory
# ---------------------------------------------------------------------------

@bp.route('/patients', methods=['GET'])
@jwt_required()
@api_errors
def get_patients_directory():
    return jsonify(service.patients_directory()), 200


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

@bp.route('/vehicles', methods=['GET'])
@jwt_required()
@api_errors
def list_vehicles():
    return jsonify({'vehicles': repo.fetch_vehicles(), 'options': service.vehicle_form_options()}), 200


@bp.route('/vehicles', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def create_vehicle():
    data = service.validate_vehicle(_body())
    vehicle_id = repo.create_vehicle(data)
    return jsonify({'id': vehicle_id, 'message': f"Vehicle '{data['name']}' successfully registered!"}), 201


@bp.route('/vehicles/<vehicle_id>', methods=['PUT'])
@require_role(*WRITE_ROLES)
@api_errors
def update_vehicle(vehicle_id):
    data = service.validate_vehicle(_body())
    repo.update_vehicle(vehicle_id, data)
    return jsonify({'message': f"Vehicle details for '{data['name']}' updated successfully!"}), 200


@bp.route('/vehicles/<vehicle_id>', methods=['DELETE'])
@require_role(*WRITE_ROLES)
@api_errors
def delete_vehicle(vehicle_id):
    vehicle = next((v for v in repo.fetch_vehicles() if v['id'] == vehicle_id), None)
    if not vehicle:
        raise LookupError('Vehicle not found.')
    repo.delete_vehicle(vehicle_id)
    return jsonify({'message': f"Vehicle '{vehicle['name']}' successfully deleted."}), 200


# ---------------------------------------------------------------------------
# Scheduling Board
# ---------------------------------------------------------------------------

@bp.route('/schedules', methods=['GET'])
@jwt_required()
@api_errors
def schedule_overview():
    start = logic._parse_date(request.args.get('start_date')) or date.today().replace(day=1)
    end = logic._parse_date(request.args.get('end_date')) or (start + timedelta(days=31))
    return jsonify({'schedules': service.overview(start, end)}), 200


@bp.route('/schedules/<schedule_date>/exists', methods=['GET'])
@jwt_required()
@api_errors
def schedule_exists(schedule_date):
    return jsonify({'exists': service.schedule_exists(_date(schedule_date))}), 200


@bp.route('/schedules/<schedule_date>', methods=['GET'])
@jwt_required()
@api_errors
def schedule_detail(schedule_date):
    return jsonify(service.schedule_detail(_date(schedule_date))), 200


@bp.route('/schedules/<schedule_date>/candidates', methods=['GET'])
@jwt_required()
@api_errors
def schedule_candidates(schedule_date):
    return jsonify(service.planning_candidates(_date(schedule_date))), 200


@bp.route('/schedules/<schedule_date>/auto-draft', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def schedule_auto_draft(schedule_date):
    return jsonify({'slots': service.auto_draft(_date(schedule_date), _body().get('slots', []))}), 200


@bp.route('/schedules/<schedule_date>/draft', methods=['PUT'])
@require_role(*WRITE_ROLES)
@api_errors
def save_schedule_draft(schedule_date):
    body = _body()
    service.save_draft(
        _date(schedule_date), body.get('slots', []),
        int(body.get('loaded_slot_count') or 0), body.get('loaded_max_updated'),
        force=bool(body.get('force')),
    )
    return jsonify({'message': 'Draft schedule changes saved successfully!'}), 200


@bp.route('/schedules/<schedule_date>/draft', methods=['DELETE'])
@require_role(*WRITE_ROLES)
@api_errors
def delete_schedule_draft(schedule_date):
    deleted = service.delete_draft(_date(schedule_date))
    return jsonify({'deleted': deleted,
                    'message': f'Draft schedule deleted successfully! ({deleted} patient reservation(s) released)'}), 200


@bp.route('/schedules/<schedule_date>/boundary-suggestions', methods=['POST'])
@jwt_required()
@api_errors
def schedule_boundary_suggestions(schedule_date):
    return jsonify({'suggestions': service.boundary_suggestions(_date(schedule_date), _body().get('slots', []))}), 200


@bp.route('/schedules/<schedule_date>/abnormal-check', methods=['GET'])
@jwt_required()
@api_errors
def schedule_abnormal_check(schedule_date):
    return jsonify({'abnormal_patients': service.abnormal_distance_check(_date(schedule_date))}), 200


@bp.route('/schedules/<schedule_date>/lock', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def lock_schedule(schedule_date):
    methods = service.lock_schedule(
        _date(schedule_date), bool(_body().get('round_trip', True)),
        os.environ.get('GOOGLE_MAPS_KEY', '').strip(),
    )
    return jsonify({'methods': methods,
                    'message': 'Schedule locked and distance optimization completed successfully!'}), 200


@bp.route('/schedules/<schedule_date>/slots/<slot_id>/status', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def set_slot_status(schedule_date, slot_id):
    result = service.set_visit_status(_date(schedule_date), slot_id, _body().get('status'))
    if result['status'] == 'completed':
        msg = f"Visit for {result['patient_name']} marked completed!"
    else:
        msg = f"Visit for {result['patient_name']} marked failed/unavailable."
    return jsonify({'message': msg}), 200


@bp.route('/schedules/<schedule_date>/slots/<slot_id>/replacements', methods=['GET'])
@jwt_required()
@api_errors
def slot_replacements(schedule_date, slot_id):
    return jsonify({'candidates': service.replacement_candidates(_date(schedule_date), slot_id)}), 200


@bp.route('/schedules/<schedule_date>/slots/<slot_id>/swap', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def swap_slot(schedule_date, slot_id):
    replacement = _body().get('replacement_patient_id')
    if not replacement:
        raise ValueError('replacement_patient_id is required.')
    name = service.swap_patient(_date(schedule_date), slot_id, replacement)
    return jsonify({'message': f'Successfully swapped with {name}!'}), 200


@bp.route('/schedules/<schedule_date>/vehicles/<vehicle_id>/extra-candidates', methods=['GET'])
@jwt_required()
@api_errors
def extra_candidates(schedule_date, vehicle_id):
    return jsonify({'candidates': service.extra_visit_candidates(_date(schedule_date), vehicle_id)}), 200


@bp.route('/schedules/<schedule_date>/vehicles/<vehicle_id>/extra-visit', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def add_extra_visit(schedule_date, vehicle_id):
    patient_id = _body().get('patient_id')
    if not patient_id:
        raise ValueError('patient_id is required.')
    name = service.add_extra_visit(_date(schedule_date), vehicle_id, patient_id)
    return jsonify({'message': f'{name} added to active run successfully!'}), 201


@bp.route('/schedules/<schedule_date>/vehicles/<vehicle_id>/last-odometer', methods=['GET'])
@jwt_required()
@api_errors
def last_odometer(schedule_date, vehicle_id):
    _date(schedule_date)
    return jsonify({'last_closing_kms': repo.fetch_last_closing_kms(vehicle_id)}), 200


@bp.route('/schedules/<schedule_date>/vehicles/<vehicle_id>/log', methods=['POST'])
@require_role(*WRITE_ROLES)
@api_errors
def submit_vehicle_log(schedule_date, vehicle_id):
    service.submit_vehicle_log(_date(schedule_date), vehicle_id, _body())
    return jsonify({'message': 'Daily vehicle log recorded successfully!'}), 201


# ---------------------------------------------------------------------------
# Completion Report
# ---------------------------------------------------------------------------

@bp.route('/reports/dates', methods=['GET'])
@jwt_required()
@api_errors
def report_dates():
    return jsonify({'dates': [d.isoformat() for d in repo.fetch_report_dates()]}), 200


@bp.route('/reports/<report_date>', methods=['GET'])
@jwt_required()
@api_errors
def report(report_date):
    _, metrics, vehicles = service.report_rows_and_metrics(_date(report_date))
    return jsonify(service._jsonable({
        'date': report_date,
        'metrics': metrics,
        'vehicles': [{'name': name, **info} for name, info in vehicles.items()],
    })), 200


@bp.route('/reports/<report_date>/csv', methods=['GET'])
@jwt_required()
@api_errors
def report_csv(report_date):
    from app.homecare_dispatch.report import generate_csv_data
    d = _date(report_date)
    rows, _, vehicles = service.report_rows_and_metrics(d)
    return Response(
        generate_csv_data(rows, vehicles), mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=saranam_dispatch_report_{d.isoformat()}.csv'},
    )


@bp.route('/reports/<report_date>/pdf', methods=['GET'])
@jwt_required()
@api_errors
def report_pdf(report_date):
    from app.homecare_dispatch.report import generate_pdf_report
    d = _date(report_date)
    _, metrics, vehicles = service.report_rows_and_metrics(d)
    return Response(
        generate_pdf_report(d, metrics, vehicles), mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=saranam_dispatch_report_{d.isoformat()}.pdf'},
    )
