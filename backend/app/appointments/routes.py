"""
Appointment API Routes
REST endpoints for appointment booking and management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID
import math

from app.appointments.services import AppointmentService


# Create Blueprint
appointments_bp = Blueprint('appointments', __name__, url_prefix='/api/appointments')


@appointments_bp.route('', methods=['GET'])
@jwt_required()
def list_appointments():
    """
    List appointments with filters
    Query params: from_date, to_date, provider_id, patient_id, status, page, per_page
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        provider_id = request.args.get('provider_id')
        patient_id = request.args.get('patient_id')
        status = request.args.get('status')
        encounter_type = request.args.get('encounter_type')  # e.g. 'OPD', 'IPD', 'Physiotherapy'
        limit = request.args.get('limit', type=int)  # direct limit param
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        if limit:
            per_page = min(limit, 200)

        # Calculate offset
        offset = (page - 1) * per_page

        # Get appointments
        appointments, total = AppointmentService.list_appointments(
            from_date=from_date,
            to_date=to_date,
            provider_id=provider_id,
            patient_id=patient_id,
            status=status,
            encounter_type=encounter_type,
            limit=per_page,
            offset=offset
        )

        # Calculate total pages
        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'appointments': appointments,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>', methods=['GET'])
@jwt_required()
def get_appointment(appointment_id):
    """Get appointment by ID"""
    try:
        current_user_id = get_jwt_identity()

        appointment = AppointmentService.get_appointment_by_id(appointment_id)

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('', methods=['POST'])
@jwt_required()
def book_appointment():
    """
    Book a new appointment
    Body: patient_id, provider_id, appointment_type, start_time, duration, chief_complaint, etc.
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Book appointment with conflict detection
        appointment = AppointmentService.book_appointment(
            patient_id=UUID(data['patient_id']),
            provider_id=UUID(data.get('provider_id')) if data.get('provider_id') else None,
            appointment_type=data['appointment_type'],
            start_time=data['start_time'],
            duration=data.get('duration'),
            chief_complaint=data.get('chief_complaint'),
            appointment_data=data,
            booked_by_id=UUID(current_user_id)
        )

        return jsonify(appointment), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appointment_id):
    """Update an existing appointment"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        appointment = AppointmentService.update_appointment(
            appointment_id=appointment_id,
            update_data=data
        )

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>/reschedule', methods=['POST'])
@jwt_required()
def reschedule_appointment(appointment_id):
    """Reschedule an appointment to a new date/time"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        appointment = AppointmentService.reschedule_appointment(
            appointment_id=appointment_id,
            new_start_time=data['start_time'],
            new_duration=data.get('duration'),
            reason=data.get('reason')
        )

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_appointment(appointment_id):
    """Cancel an appointment"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        appointment = AppointmentService.cancel_appointment(
            appointment_id=appointment_id,
            cancelled_by_id=UUID(current_user_id),
            reason=data.get('reason')
        )

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>/check-in', methods=['POST'])
@jwt_required()
def check_in(appointment_id):
    """Mark patient as checked in for appointment"""
    try:
        current_user_id = get_jwt_identity()

        appointment = AppointmentService.check_in_appointment(appointment_id)

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/<uuid:appointment_id>/complete', methods=['POST'])
@jwt_required()
def complete_appointment(appointment_id):
    """Mark appointment as completed"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        appointment = AppointmentService.complete_appointment(
            appointment_id=appointment_id,
            notes=data.get('notes')
        )

        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404

        return jsonify(appointment), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/calendar', methods=['GET'])
@jwt_required()
def get_calendar_view():
    """
    Get calendar view of appointments
    Query params: from_date, to_date, provider_id (optional), view_type (day/week/month)
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        provider_id = request.args.get('provider_id')
        view_type = request.args.get('view_type', 'week')

        if not from_date or not to_date:
            return jsonify({'error': 'from_date and to_date are required'}), 400

        calendar_data = AppointmentService.get_calendar_view(
            from_date=from_date,
            to_date=to_date,
            provider_id=provider_id,
            view_type=view_type
        )

        return jsonify(calendar_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/slots', methods=['GET'])
@jwt_required()
def get_available_slots():
    """
    Get available appointment slots
    Query params: provider_id, date, duration (optional)
    """
    try:
        current_user_id = get_jwt_identity()

        provider_id = request.args.get('provider_id')
        date_str = request.args.get('date')
        duration = request.args.get('duration', type=int)

        if not provider_id or not date_str:
            return jsonify({'error': 'provider_id and date are required'}), 400

        # Import here to avoid circular dependency
        from app.providers.schedule_services import ProviderScheduleService

        availability_data = ProviderScheduleService.get_available_slots(
            provider_id=UUID(provider_id),
            date_str=date_str,
            duration=duration
        )

        return jsonify({
            'slots': availability_data['slots'],
            'provider_works_today': availability_data['provider_works_today'],
            'date': date_str
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@appointments_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_appointment_stats():
    """Get appointment statistics for analytics"""
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        provider_id = request.args.get('provider_id')

        stats = AppointmentService.get_appointment_stats(
            from_date=from_date,
            to_date=to_date,
            provider_id=provider_id
        )

        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
