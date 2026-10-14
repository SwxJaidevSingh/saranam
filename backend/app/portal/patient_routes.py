"""Org-scoped patient routes — the primary Wave 1 slice.

Every handler resolves a TenantContext via @portal_auth and goes through the
central scoping guards (app.portal.scoping). Demographic create/update reuses
the existing PatientService so portal and main app stay consistent; the portal
layers org ownership + structured origin on top.
"""
import math
from uuid import UUID

from flask import jsonify, request
from pydantic import ValidationError

from app.extensions import db
from app.patients.models import Patient
from app.patients.services import PatientService
from app.patients.schemas import PatientCreateSchema, PatientUpdateSchema
from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.schemas import PatientOriginSchema
from app.portal.scoping import (
    scoped_patient_query,
    get_scoped_patient_or_404,
)


# Roles permitted to write patients (create/edit/origin). Platform admins
# bypass role checks inside @portal_auth.
WRITE_ROLES = ('org_data_entry', 'org_admin', 'platform_admin')


def _format_validation_errors(e: ValidationError):
    """Mirror app/patients/routes.py create_patient error shaping."""
    errors = []
    for error in e.errors():
        errors.append({
            'field': str(error.get('loc', ['unknown'])[0]) if error.get('loc') else 'unknown',
            'message': str(error.get('msg', 'Validation error')),
            'type': str(error.get('type', 'unknown')),
        })
    return errors


def _apply_origin(patient: Patient, origin: PatientOriginSchema):
    """Copy validated origin fields onto the patient model (no commit)."""
    patient.origin_type = origin.origin_type
    patient.origin_source_code = origin.source_code
    patient.origin_organization_id = origin.organization_id
    patient.origin_source_name = origin.source_name
    patient.origin_referral_date = origin.referral_date
    patient.origin_notes = origin.notes


@portal_bp.route('/patients', methods=['GET'])
@portal_auth()
def list_patients(tenant_ctx):
    """List patients within the caller's org (god view = all orgs).

    Supports `q` search + pagination, consistent with the main patients list.
    Search mirrors PatientService.search_patients (name / abha_address /
    uhid-prefix) but applied to the org-scoped query so isolation is preserved.
    """
    q = request.args.get('q', '').strip()
    page = max(int(request.args.get('page', 1)), 1)
    per_page = min(int(request.args.get('per_page', 20)), 100)
    sort_order = request.args.get('sort_order', 'desc')
    sort_by = request.args.get('sort_by', 'created_at')

    # Start from the org-scoped query — this is the isolation boundary.
    query = scoped_patient_query(tenant_ctx).filter(Patient.is_active == True)  # noqa: E712

    if q and len(q) >= 2:
        from sqlalchemy import or_
        pattern = f"%{q}%"
        digits_only = ''.join(c for c in q if c.isdigit())
        clauses = [
            Patient.full_name.ilike(pattern),
            Patient.abha_address.ilike(pattern),
        ]
        if digits_only:
            clauses.append(Patient.uhid.like(f"{digits_only}%"))
        query = query.filter(or_(*clauses))

    total = query.count()

    sort_column = getattr(Patient, sort_by, Patient.created_at)
    if sort_order == 'asc':
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    offset = (page - 1) * per_page
    patients = query.limit(per_page).offset(offset).all()

    items = [
        PatientService._prepare_patient_response(p, include_stats=False)
        for p in patients
    ]
    total_pages = math.ceil(total / per_page) if total > 0 else 0

    return jsonify({
        'patients': items,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    }), 200


@portal_bp.route('/patients/<uuid:patient_id>', methods=['GET'])
@portal_auth()
def get_patient(patient_id, tenant_ctx):
    """Fetch one patient WITHIN scope. Out-of-scope → 404 (never leak existence)."""
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    return jsonify(PatientService._prepare_patient_response(patient, include_stats=True)), 200


@portal_bp.route('/patients', methods=['POST'])
@portal_auth(*WRITE_ROLES)
def create_patient(tenant_ctx):
    """Create a patient owned by the caller's org, with required structured origin.

    Reuses PatientService.create_patient for the demographic write, then stamps
    organization_id (server-side, from context) and the structured origin.
    `origin_type` is REQUIRED.
    """
    data = request.get_json() or {}

    # Validate demographics with the EXISTING patient create schema.
    try:
        patient_data = PatientCreateSchema(**data)
    except ValidationError as e:
        return jsonify({
            'error': 'validation_failed',
            'message': 'Invalid patient data',
            'details': _format_validation_errors(e),
        }), 400

    # Validate the required structured origin.
    try:
        origin = PatientOriginSchema(**(data.get('origin') or data))
    except ValidationError as e:
        return jsonify({
            'error': 'validation_failed',
            'message': 'Invalid or missing origin',
            'details': _format_validation_errors(e),
        }), 400

    # Duplicate check mirrors the main route.
    duplicate = None
    if not patient_data.ignore_duplicate:
        duplicate = PatientService.check_duplicate(
            abha_address=patient_data.abha_address,
            full_name=patient_data.full_name,
            date_of_birth=patient_data.date_of_birth,
            phone_number=patient_data.phone_number
        )
    if duplicate:
        return jsonify({'error': 'Duplicate patient found', 'duplicate': duplicate}), 409

    # A patient must belong to a concrete org. A platform admin in unscoped
    # god view (no X-Org-Id) must pick an org before creating.
    if tenant_ctx.active_org_id is None:
        return jsonify({
            'error': 'org_required',
            'message': 'Select an organization (X-Org-Id) before creating a patient.',
        }), 400

    try:
        # Demographic create via the shared service, with org ownership forced
        # server-side (never from client input). create_patient stamps
        # organization_id before its commit, satisfying the NOT NULL column.
        created = PatientService.create_patient(
            data=patient_data,
            created_by=UUID(tenant_ctx.user_id),
            organization_id=tenant_ctx.active_org_id,
        )
        # Apply the structured origin on the created row, then commit.
        patient = Patient.query.get(created['id'])
        _apply_origin(patient, origin)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    return jsonify({
        'patient': PatientService._prepare_patient_response(patient, include_stats=False),
    }), 201


@portal_bp.route('/patients/<uuid:patient_id>', methods=['PUT'])
@portal_auth(*WRITE_ROLES)
def update_patient(patient_id, tenant_ctx):
    """Update demographic + origin fields, within scope.

    Rejects/ignores any attempt to change organization_id or clinical fields:
    organization_id is never read from input, and the update path runs through
    PatientUpdateSchema which only carries demographic/intake fields. Out-of-
    scope patients → 404.
    """
    # Scope gate FIRST — confirm the patient is visible to this caller.
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    data = request.get_json() or {}

    try:
        patient_data = PatientUpdateSchema(**data)
    except ValidationError as e:
        return jsonify({
            'error': 'validation_failed',
            'message': 'Invalid patient data',
            'details': _format_validation_errors(e),
        }), 400

    # Optional origin update bundled in the same PUT.
    origin = None
    if 'origin' in data and data.get('origin') is not None:
        try:
            origin = PatientOriginSchema(**data['origin'])
        except ValidationError as e:
            return jsonify({
                'error': 'validation_failed',
                'message': 'Invalid origin',
                'details': _format_validation_errors(e),
            }), 400

    try:
        # Demographic update via the shared service. organization_id is NOT a
        # field on PatientUpdateSchema, so it can never be changed here.
        PatientService.update_patient(
            patient_id=patient.id,
            data=patient_data,
            updated_by=UUID(tenant_ctx.user_id),
        )
        if origin is not None:
            patient = Patient.query.get(patient.id)
            _apply_origin(patient, origin)
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    # Re-fetch through scope to return a fresh, in-scope view.
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    return jsonify(PatientService._prepare_patient_response(patient, include_stats=True)), 200


@portal_bp.route('/patients/<uuid:patient_id>/origin', methods=['PUT'])
@portal_auth(*WRITE_ROLES)
def update_patient_origin(patient_id, tenant_ctx):
    """Set/update ONLY the structured origin, within scope.

    Fields: origin_type (required), source_code, organization_id (referrer),
    source_name, referral_date, notes. Out-of-scope patients → 404.
    """
    patient = get_scoped_patient_or_404(patient_id, tenant_ctx)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    data = request.get_json() or {}
    try:
        origin = PatientOriginSchema(**data)
    except ValidationError as e:
        return jsonify({
            'error': 'validation_failed',
            'message': 'Invalid origin',
            'details': _format_validation_errors(e),
        }), 400

    try:
        _apply_origin(patient, origin)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'server_error', 'message': str(e)}), 500

    return jsonify(PatientService._prepare_patient_response(patient, include_stats=False)), 200
