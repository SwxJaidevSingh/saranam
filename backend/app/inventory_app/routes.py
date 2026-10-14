"""Inventory REST API: Dashboard, Medicine Catalog, Stock Management, Dispense,
Returns & Recalls, Error Reporting, Reports and Admin.

As in the Saranam Streamlit inventory app, every page is open to any logged-in
user and only Admin needs the admin role.
"""
import logging
from datetime import date
from functools import wraps

from flask import Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.auth.decorators import require_role
from app.inventory_app import inventory_app_bp as bp
from app.inventory_app import repository as repo, service
from app.inventory_app.schema import ensure_schema

logger = logging.getLogger(__name__)


@bp.before_request
def _schema_ready():
    ensure_schema()


def api_errors(f):
    """Map service exceptions to JSON responses."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except LookupError as e:
            return jsonify({'error': str(e)}), 404
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.exception("Inventory request failed")
            return jsonify({'error': f'Unexpected error: {e}'}), 500
    return wrapper


def _user():
    user_id = get_jwt_identity()
    return user_id, repo.user_email(user_id)


def _body() -> dict:
    return request.get_json(silent=True) or {}


def _ok(payload, status=200):
    # Keep key order: table columns and source lists are shown in the order they were built.
    body = current_app.json.dumps(service.jsonable(payload), sort_keys=False)
    return Response(body, status=status, mimetype='application/json')


# ---------------------------------------------------------------------------
# Prescription medicine search (used by OPD, Plan of Care and visit prescriptions)
# ---------------------------------------------------------------------------

@bp.route('/medicines/search', methods=['GET'])
@jwt_required()
@api_errors
def search_medicines():
    limit = min(request.args.get('limit', 20, type=int), 100)
    return _ok(repo.search_medicines_for_prescriptions(request.args.get('q', ''), limit))


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@bp.route('/dashboard', methods=['GET'])
@jwt_required()
@api_errors
def dashboard():
    return _ok(service.dashboard())


# ---------------------------------------------------------------------------
# Medicine Catalog
# ---------------------------------------------------------------------------

@bp.route('/catalog', methods=['GET'])
@jwt_required()
@api_errors
def catalog():
    return _ok(service.catalog(request.args.get('q', '')))


@bp.route('/catalog/medicines', methods=['POST'])
@jwt_required()
@api_errors
def add_medicine():
    user_id, email = _user()
    return _ok({'message': service.add_medicine(user_id, email, _body())}, 201)


@bp.route('/catalog/medicines/<medicine_id>/meta', methods=['PUT'])
@jwt_required()
@api_errors
def save_medicine_meta(medicine_id):
    _, email = _user()
    return _ok({'message': service.save_medicine_meta(email, medicine_id, _body())})


@bp.route('/catalog/categories', methods=['POST'])
@jwt_required()
@api_errors
def add_category():
    _, email = _user()
    return _ok({'message': service.add_category(email, _body().get('name') or '')}, 201)


# ---------------------------------------------------------------------------
# Stock Management
# ---------------------------------------------------------------------------

@bp.route('/stock', methods=['GET'])
@jwt_required()
@api_errors
def current_stock():
    return _ok(service.current_stock())


@bp.route('/stock/<stock_id>/reorder-level', methods=['PUT'])
@jwt_required()
@api_errors
def set_reorder_level(stock_id):
    _, email = _user()
    body = _body()
    try:
        level = int(body.get('level'))
    except (TypeError, ValueError):
        raise ValueError('Enter a reorder level.')
    return _ok({'message': service.set_reorder_level(email, stock_id, str(body.get('source') or ''), level)})


@bp.route('/stock/receive-options', methods=['GET'])
@jwt_required()
@api_errors
def receive_options():
    return _ok(service.receive_options())


@bp.route('/stock/receive', methods=['POST'])
@jwt_required()
@api_errors
def receive_stock():
    user_id, email = _user()
    return _ok({'message': service.receive_stock(user_id, email, _body())}, 201)


@bp.route('/stock/movements', methods=['GET'])
@jwt_required()
@api_errors
def movements():
    return _ok({'movements': repo.movement_log()})


# ---------------------------------------------------------------------------
# Dispense
# ---------------------------------------------------------------------------

@bp.route('/dispense/patients', methods=['GET'])
@jwt_required()
@api_errors
def dispense_patients():
    return _ok({'patients': service.dispense_patients()})


@bp.route('/dispense/patients/<patient_id>', methods=['GET'])
@jwt_required()
@api_errors
def dispense_context(patient_id):
    return _ok(service.dispense_context(patient_id))


@bp.route('/dispense', methods=['POST'])
@jwt_required()
@api_errors
def dispense():
    user_id, email = _user()
    body = _body()
    message = service.dispense(user_id, email, str(body.get('patient_id') or ''), body.get('lines') or [],
                               bool(body.get('acknowledged')))
    return _ok({'message': message}, 201)


# ---------------------------------------------------------------------------
# Returns & Recalls
# ---------------------------------------------------------------------------

@bp.route('/returns', methods=['GET'])
@jwt_required()
@api_errors
def returns_log():
    return _ok({'records': repo.returns_log(request.args.get('type', 'All')),
                'medicines': service.medicine_options()})


@bp.route('/returns', methods=['POST'])
@jwt_required()
@api_errors
def report_return():
    user_id, email = _user()
    return _ok({'message': service.report_return_recall(user_id, email, _body())}, 201)


# ---------------------------------------------------------------------------
# Medication Error Reporting
# ---------------------------------------------------------------------------

@bp.route('/errors', methods=['GET'])
@jwt_required()
@api_errors
def errors_log():
    return _ok({'records': repo.errors_log(request.args.get('status', 'All')), **service.error_form_options()})


@bp.route('/errors', methods=['POST'])
@jwt_required()
@api_errors
def report_error():
    _, email = _user()
    return _ok({'message': service.report_error(email, _body())}, 201)


@bp.route('/errors/<int:error_id>/status', methods=['PUT'])
@jwt_required()
@api_errors
def update_error_status(error_id):
    _, email = _user()
    return _ok({'message': service.update_error_status(email, error_id, _body().get('status'))})


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@bp.route('/reports/<slug>', methods=['GET'])
@jwt_required()
@api_errors
def report(slug):
    if slug not in service.REPORT_SLUGS:
        raise LookupError('Unknown report.')
    payload = {'rows': service.report_rows(slug, request.args)}
    if slug == 'stock_inventory':
        payload['categories'] = [c['name'] for c in repo.categories()]
    return _ok(payload)


@bp.route('/reports/<slug>/csv', methods=['GET'])
@jwt_required()
@api_errors
def report_csv(slug):
    if slug not in service.REPORT_SLUGS or slug == 'error_summary':
        raise LookupError('Unknown report.')
    rows = service.jsonable(service.report_rows(slug, request.args))
    return Response(
        service.to_csv(rows), mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={slug}_{date.today().isoformat()}.csv'},
    )


# ---------------------------------------------------------------------------
# Admin (admin role only)
# ---------------------------------------------------------------------------

@bp.route('/admin/users', methods=['GET'])
@require_role('admin')
@api_errors
def admin_users():
    return _ok({'users': repo.users()})


@bp.route('/admin/patients', methods=['GET'])
@require_role('admin')
@api_errors
def admin_patients():
    return _ok({'patients': service.jsonable(repo.patients(include_deceased=True))})


@bp.route('/admin/patients/<patient_id>/allergies', methods=['PUT'])
@require_role('admin')
@api_errors
def admin_save_allergies(patient_id):
    _, email = _user()
    return _ok({'message': service.save_allergies(email, patient_id, _body().get('allergies'))})


@bp.route('/admin/emergency-meds', methods=['GET'])
@require_role('admin')
@api_errors
def admin_emergency_meds():
    return _ok({'emergency_meds': repo.emergency_meds_admin(), 'medicines': service.medicine_options()})


@bp.route('/admin/emergency-meds', methods=['POST'])
@require_role('admin')
@api_errors
def admin_add_emergency_med():
    _, email = _user()
    return _ok({'message': service.add_emergency_med(email, _body())}, 201)
