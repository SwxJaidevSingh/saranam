"""
Provider Schedule API Routes
REST endpoints for provider schedule and availability management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID

from app.providers.schedule_services import ProviderScheduleService


# Create Blueprint
schedule_bp = Blueprint('provider_schedules', __name__, url_prefix='/api/providers')


@schedule_bp.route('/<uuid:provider_id>/schedule', methods=['GET'])
@jwt_required()
def get_provider_schedule(provider_id):
    """Get provider's weekly schedule"""
    try:
        current_user_id = get_jwt_identity()

        schedules = ProviderScheduleService.get_provider_schedule(provider_id)

        return jsonify({'schedules': schedules}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/schedule', methods=['POST'])
@jwt_required()
def create_schedule(provider_id):
    """Create or update provider schedule for a specific day"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        schedule = ProviderScheduleService.create_or_update_schedule(
            provider_id=provider_id,
            schedule_data=data
        )

        return jsonify(schedule), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/schedule/bulk', methods=['POST'])
@jwt_required()
def create_bulk_schedule(provider_id):
    """Create or update multiple schedule entries at once"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        schedules = data.get('schedules', [])
        if not schedules:
            return jsonify({'error': 'No schedules provided'}), 400

        results = ProviderScheduleService.create_bulk_schedule(
            provider_id=provider_id,
            schedules_data=schedules
        )

        return jsonify({'schedules': results}), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/schedule/<int:day_of_week>', methods=['PUT'])
@jwt_required()
def update_day_schedule(provider_id, day_of_week):
    """Update schedule for a specific day of week"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        schedule = ProviderScheduleService.update_day_schedule(
            provider_id=provider_id,
            day_of_week=day_of_week,
            schedule_data=data
        )

        if not schedule:
            return jsonify({'error': 'Schedule not found'}), 404

        return jsonify(schedule), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/schedule/<int:day_of_week>', methods=['DELETE'])
@jwt_required()
def delete_day_schedule(provider_id, day_of_week):
    """Delete schedule for a specific day of week"""
    try:
        current_user_id = get_jwt_identity()

        success = ProviderScheduleService.delete_day_schedule(
            provider_id=provider_id,
            day_of_week=day_of_week
        )

        if not success:
            return jsonify({'error': 'Schedule not found'}), 404

        return jsonify({'message': 'Schedule deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/availability', methods=['GET'])
@jwt_required()
def get_provider_availability(provider_id):
    """
    Get available time slots for a provider
    Query params: date (required), duration (optional, defaults to provider's default)
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'error': 'Date parameter is required'}), 400

        duration = request.args.get('duration', type=int)

        # Get available slots
        slots = ProviderScheduleService.get_available_slots(
            provider_id=provider_id,
            date_str=date_str,
            duration=duration
        )

        return jsonify({'slots': slots, 'date': date_str}), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/availability/range', methods=['GET'])
@jwt_required()
def get_availability_range(provider_id):
    """
    Get available slots for a date range
    Query params: from_date, to_date, duration (optional)
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')

        if not from_date or not to_date:
            return jsonify({'error': 'from_date and to_date parameters are required'}), 400

        duration = request.args.get('duration', type=int)

        # Get available slots for date range
        availability = ProviderScheduleService.get_availability_range(
            provider_id=provider_id,
            from_date=from_date,
            to_date=to_date,
            duration=duration
        )

        return jsonify(availability), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/<uuid:provider_id>/block-time', methods=['POST'])
@jwt_required()
def block_time(provider_id):
    """Block time off for a provider (vacation, meeting, etc.)"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # This will create a "blocked" appointment in the future
        # For now, return not implemented
        return jsonify({'message': 'Block time feature coming soon'}), 501

    except Exception as e:
        return jsonify({'error': str(e)}), 500
