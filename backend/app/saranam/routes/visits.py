"""Visit routes for Saranam module."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID

from app.saranam import saranam_bp
from app.saranam.services.visit_service import VisitService


@saranam_bp.route('/patients/<uuid:patient_id>/initial-visit', methods=['GET'])
@jwt_required()
def get_initial_visit(patient_id):
    """Get the initial (baseline) visit for a patient."""
    try:
        visit = VisitService.get_initial_visit(patient_id)
        if not visit:
            return jsonify({'error': 'No initial visit found'}), 404
        return jsonify(visit), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/patients/<uuid:patient_id>/visits', methods=['GET'])
@jwt_required()
def list_visits(patient_id):
    """List follow-up visits for a patient (excludes initial visit)."""
    try:
        visits = VisitService.get_patient_visits(patient_id, include_initial=False)
        return jsonify({'visits': visits, 'total': len(visits)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/patients/<uuid:patient_id>/visits', methods=['POST'])
@jwt_required()
def create_visit(patient_id):
    """Create a new visit for a patient."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        visit = VisitService.create_visit(
            patient_id=patient_id,
            data=data,
            created_by=UUID(current_user_id)
        )

        return jsonify({'visit': visit}), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/visits/<uuid:visit_id>', methods=['GET'])
@jwt_required()
def get_visit(visit_id):
    """Get a single visit."""
    try:
        visit = VisitService.get_visit(visit_id)
        if not visit:
            return jsonify({'error': 'Visit not found'}), 404
        return jsonify(visit), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@saranam_bp.route('/visits/<uuid:visit_id>', methods=['PUT'])
@jwt_required()
def update_visit(visit_id):
    """Update a visit."""
    try:
        data = request.get_json()
        visit = VisitService.update_visit(visit_id, data)
        if not visit:
            return jsonify({'error': 'Visit not found'}), 404
        return jsonify(visit), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
