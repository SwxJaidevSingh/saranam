"""
Cohort API Routes
REST API endpoints for patient cohort management.
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from app.cohorts.services import CohortService
from app.cohorts.models import PatientCohort, CohortMember
from app.models import Patient
from app.auth.decorators import require_auth, get_current_user
from app.extensions import db

cohorts_bp = Blueprint('cohorts', __name__)


@cohorts_bp.route('', methods=['POST'])
@require_auth
def create_cohort(current_user):
    """
    Create a new patient cohort.

    Request Body:
    {
        "name": "Diabetic patients >40",
        "description": "Patients with diabetes over 40 years old",
        "criteria": {
            "age": {"min": 40},
            "diagnoses": ["diabetes"]
        },
        "auto_update": true,
        "update_frequency": "daily"
    }

    Returns:
    - 201: Cohort created successfully
    - 400: Invalid request
    - 500: Server error
    """
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Cohort name is required'}), 400

        if not data.get('criteria'):
            return jsonify({'error': 'Criteria is required'}), 400

        cohort = CohortService.create_cohort(
            name=data['name'],
            description=data.get('description', ''),
            criteria=data['criteria'],
            owner_id=str(current_user.id),
            auto_update=data.get('auto_update', True),
            update_frequency=data.get('update_frequency', 'daily')
        )

        return jsonify({
            'message': 'Cohort created successfully',
            'cohort': cohort.to_dict()
        }), 201

    except Exception as e:
        print(f"Error creating cohort: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('', methods=['GET'])
@require_auth
def list_cohorts(current_user):
    """
    List all cohorts accessible by the current user.

    Query Parameters:
    - is_active (optional): Filter by active status

    Returns:
    - 200: List of cohorts
    - 500: Server error
    """
    try:
        is_active = request.args.get('is_active', 'true').lower() == 'true'

        # Get cohorts owned by user or shared with user
        query = PatientCohort.query.filter(
            or_(
                PatientCohort.owner_id == current_user.id,
                PatientCohort.is_shared == True
            )
        )

        if is_active is not None:
            query = query.filter(PatientCohort.is_active == is_active)

        cohorts = query.order_by(PatientCohort.created_at.desc()).all()

        return jsonify({
            'cohorts': [cohort.to_dict() for cohort in cohorts],
            'total': len(cohorts)
        }), 200

    except Exception as e:
        print(f"Error listing cohorts: {e}")
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>', methods=['GET'])
@require_auth
def get_cohort(current_user, cohort_id):
    """
    Get detailed information about a specific cohort.

    Returns:
    - 200: Cohort details
    - 404: Cohort not found
    - 403: Access denied
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check access
        if cohort.owner_id != current_user.id and not cohort.is_shared:
            return jsonify({'error': 'Access denied'}), 403

        # Get summary statistics
        summary = CohortService.get_cohort_summary(str(cohort_id))

        # Get recent activities
        activities = CohortService.get_cohort_activities(str(cohort_id), limit=20)

        return jsonify({
            'cohort': cohort.to_dict(),
            'summary': summary,
            'activities': activities
        }), 200

    except Exception as e:
        print(f"Error getting cohort: {e}")
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>', methods=['PUT'])
@require_auth
def update_cohort(current_user, cohort_id):
    """
    Update a cohort.

    Request Body:
    {
        "name": "Updated name",
        "description": "Updated description",
        "criteria": {...},
        "is_active": true
    }

    Returns:
    - 200: Cohort updated successfully
    - 404: Cohort not found
    - 403: Access denied
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check ownership
        if cohort.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can update this cohort'}), 403

        data = request.get_json()

        # Update fields
        if 'name' in data:
            cohort.name = data['name']
        if 'description' in data:
            cohort.description = data['description']
        if 'criteria' in data:
            cohort.criteria = data['criteria']
            # Recalculate members if criteria changed
            CohortService.recalculate_members(str(cohort_id), str(current_user.id))
        if 'is_active' in data:
            cohort.is_active = data['is_active']
        if 'auto_update' in data:
            cohort.auto_update = data['auto_update']
        if 'update_frequency' in data:
            cohort.update_frequency = data['update_frequency']

        db.session.commit()

        # Log activity
        CohortService._log_activity(
            cohort_id=str(cohort_id),
            activity_type='updated',
            details={'updated_fields': list(data.keys())},
            performed_by=str(current_user.id)
        )

        return jsonify({
            'message': 'Cohort updated successfully',
            'cohort': cohort.to_dict()
        }), 200

    except Exception as e:
        print(f"Error updating cohort: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>/patients', methods=['GET'])
@require_auth
def get_cohort_patients(current_user, cohort_id):
    """
    Get list of patients in a cohort.

    Query Parameters:
    - page (optional): Page number (default: 1)
    - per_page (optional): Items per page (default: 50)
    - still_qualifies (optional): Filter by qualification status

    Returns:
    - 200: List of patients
    - 404: Cohort not found
    - 403: Access denied
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check access
        if cohort.owner_id != current_user.id and not cohort.is_shared:
            return jsonify({'error': 'Access denied'}), 403

        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        # Build query
        query = db.session.query(CohortMember, Patient).join(
            Patient, CohortMember.patient_id == Patient.id
        ).filter(CohortMember.cohort_id == str(cohort_id))

        # Filter by qualification status if specified
        still_qualifies = request.args.get('still_qualifies')
        if still_qualifies is not None:
            query = query.filter(CohortMember.still_qualifies == (still_qualifies.lower() == 'true'))

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        patients_data = []
        for member, patient in pagination.items:
            patient_dict = {
                'id': str(patient.id),
                'first_name': patient.first_name,
                'last_name': patient.last_name,
                'email': patient.email,
                'phone': patient.phone,
                'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else None,
                'gender': patient.gender,
                'joined_at': member.joined_at.isoformat(),
                'still_qualifies': member.still_qualifies,
                'snapshot_data': member.snapshot_data
            }
            patients_data.append(patient_dict)

        return jsonify({
            'patients': patients_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200

    except Exception as e:
        print(f"Error getting cohort patients: {e}")
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>/recalculate', methods=['POST'])
@require_auth
def recalculate_cohort(current_user, cohort_id):
    """
    Manually recalculate cohort membership.

    Returns:
    - 200: Recalculation successful
    - 404: Cohort not found
    - 403: Access denied
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check ownership
        if cohort.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can recalculate this cohort'}), 403

        member_count = CohortService.recalculate_members(str(cohort_id), str(current_user.id))

        return jsonify({
            'message': 'Cohort recalculated successfully',
            'member_count': member_count
        }), 200

    except Exception as e:
        print(f"Error recalculating cohort: {e}")
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>/outcomes', methods=['GET'])
@require_auth
def get_cohort_outcomes(current_user, cohort_id):
    """
    Get outcome trends for a cohort.

    Query Parameters:
    - metric_name: Name of the metric
    - days (optional): Number of days to look back (default: 90)

    Returns:
    - 200: Outcome trends
    - 404: Cohort not found
    - 403: Access denied
    - 400: Missing metric_name
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check access
        if cohort.owner_id != current_user.id and not cohort.is_shared:
            return jsonify({'error': 'Access denied'}), 403

        metric_name = request.args.get('metric_name')
        if not metric_name:
            return jsonify({'error': 'metric_name is required'}), 400

        days = int(request.args.get('days', 90))

        trends = CohortService.get_outcome_trends(str(cohort_id), metric_name, days)

        return jsonify({
            'metric_name': metric_name,
            'trends': trends
        }), 200

    except Exception as e:
        print(f"Error getting cohort outcomes: {e}")
        return jsonify({'error': str(e)}), 500


@cohorts_bp.route('/<uuid:cohort_id>', methods=['DELETE'])
@require_auth
def delete_cohort(current_user, cohort_id):
    """
    Delete a cohort (soft delete by setting is_active=False).

    Returns:
    - 200: Cohort deleted successfully
    - 404: Cohort not found
    - 403: Access denied
    - 500: Server error
    """
    try:
        cohort = PatientCohort.query.get(str(cohort_id))

        if not cohort:
            return jsonify({'error': 'Cohort not found'}), 404

        # Check ownership
        if cohort.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can delete this cohort'}), 403

        # Soft delete
        cohort.is_active = False
        db.session.commit()

        # Log activity
        CohortService._log_activity(
            cohort_id=str(cohort_id),
            activity_type='deleted',
            details={},
            performed_by=str(current_user.id)
        )

        return jsonify({
            'message': 'Cohort deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting cohort: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
