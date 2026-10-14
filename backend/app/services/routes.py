"""
Service API routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.services import ServiceService
from app.auth.decorators import require_permission
from app.extensions import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

services_bp = Blueprint('services', __name__, url_prefix='/api/services')


@services_bp.route('', methods=['GET'])
@jwt_required()
def list_services():
    """
    List services with optional filters

    Query params:
    - query: Search term
    - service_type: Filter by type (IPD, OPD, PHYSIOTHERAPY, HOME_CARE)
    - department: Filter by department
    - is_active: Filter by active status
    - limit: Number of results (default: 20)
    - offset: Number to skip (default: 0)
    """
    try:
        params = request.args

        services, total = ServiceService.search_services(
            query=params.get('query'),
            service_type=params.get('service_type'),
            department=params.get('department'),
            is_active=params.get('is_active', 'true').lower() == 'true',
            limit=int(params.get('limit', 20)),
            offset=int(params.get('offset', 0))
        )

        return jsonify({
            'services': services,
            'total': total,
            'limit': int(params.get('limit', 20)),
            'offset': int(params.get('offset', 0))
        }), 200

    except Exception as e:
        logger.error(f"Error listing services: {str(e)}")
        return jsonify({'error': 'Failed to list services'}), 500


@services_bp.route('/<uuid:service_id>', methods=['GET'])
@jwt_required()
def get_service(service_id):
    """Get service by ID"""
    try:
        service = ServiceService.get_service_by_id(str(service_id))

        if not service:
            return jsonify({'error': 'Service not found'}), 404

        return jsonify(service), 200

    except Exception as e:
        logger.error(f"Error getting service: {str(e)}")
        return jsonify({'error': 'Failed to get service'}), 500


@services_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('services.create')
def create_service():
    """Create a new service"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        service, message = ServiceService.create_service(data, user_id)

        if not service:
            return jsonify({'error': message}), 400

        return jsonify({
            'service': service,
            'message': message
        }), 201

    except Exception as e:
        logger.error(f"Error creating service: {str(e)}")
        return jsonify({'error': 'Failed to create service'}), 500


@services_bp.route('/<uuid:service_id>', methods=['PUT'])
@jwt_required()
@require_permission('services.update')
def update_service(service_id):
    """Update service details"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        service, message = ServiceService.update_service(str(service_id), data, user_id)

        if not service:
            return jsonify({'error': message}), 400

        return jsonify({
            'service': service,
            'message': message
        }), 200

    except Exception as e:
        logger.error(f"Error updating service: {str(e)}")
        return jsonify({'error': 'Failed to update service'}), 500


@services_bp.route('/<uuid:service_id>/providers', methods=['GET'])
@jwt_required()
def get_service_providers(service_id):
    """Get all providers for a service"""
    try:
        providers = ServiceService.get_service_providers(str(service_id))
        return jsonify({'providers': providers}), 200

    except Exception as e:
        logger.error(f"Error getting service providers: {str(e)}")
        return jsonify({'error': 'Failed to get service providers'}), 500


@services_bp.route('/<uuid:service_id>/providers', methods=['POST'])
@jwt_required()
@require_permission('services.manage_providers')
def assign_provider_to_service(service_id):
    """Assign a provider to a service"""
    try:
        data = request.get_json()

        if not data.get('provider_id'):
            return jsonify({'error': 'Provider ID is required'}), 400

        success, message = ServiceService.assign_provider_to_service(
            str(service_id),
            data['provider_id'],
            data.get('is_primary', False),
            data.get('settings', {})
        )

        if not success:
            return jsonify({'error': message}), 400

        return jsonify({'message': message}), 200

    except Exception as e:
        logger.error(f"Error assigning provider: {str(e)}")
        return jsonify({'error': 'Failed to assign provider'}), 500


@services_bp.route('/<uuid:service_id>/forms', methods=['GET'])
@jwt_required()
def get_service_forms(service_id):
    """Get forms for a service"""
    try:
        form_type = request.args.get('form_type')
        forms = ServiceService.get_service_forms(str(service_id), form_type)
        return jsonify({'forms': forms}), 200

    except Exception as e:
        logger.error(f"Error getting service forms: {str(e)}")
        return jsonify({'error': 'Failed to get service forms'}), 500


@services_bp.route('/<uuid:service_id>/forms', methods=['POST'])
@jwt_required()
@require_permission('services.manage_forms')
def assign_form_to_service(service_id):
    """Assign a form to a service"""
    try:
        data = request.get_json()

        if not data.get('form_id'):
            return jsonify({'error': 'Form ID is required'}), 400
        if not data.get('form_type'):
            return jsonify({'error': 'Form type is required'}), 400

        success, message = ServiceService.assign_form_to_service(
            str(service_id),
            data['form_id'],
            data['form_type'],
            data.get('is_mandatory', False),
            data.get('sequence_order', 0),
            data.get('conditions', {})
        )

        if not success:
            return jsonify({'error': message}), 400

        return jsonify({'message': message}), 200

    except Exception as e:
        logger.error(f"Error assigning form: {str(e)}")
        return jsonify({'error': 'Failed to assign form'}), 500


@services_bp.route('/<uuid:service_id>/schedule', methods=['GET'])
@jwt_required()
def get_service_schedule(service_id):
    """Get schedule for a service"""
    # TODO: Implement schedule retrieval
    return jsonify({'message': 'Not implemented yet'}), 501


@services_bp.route('/<uuid:service_id>/schedule', methods=['POST'])
@jwt_required()
@require_permission('services.manage_schedule')
def create_service_schedule(service_id):
    """Create schedule for a service"""
    try:
        data = request.get_json()

        # Validate required fields
        required = ['day_of_week', 'start_time', 'end_time']
        for field in required:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        success, message = ServiceService.create_service_schedule(
            str(service_id),
            data
        )

        if not success:
            return jsonify({'error': message}), 400

        return jsonify({'message': message}), 201

    except Exception as e:
        logger.error(f"Error creating schedule: {str(e)}")
        return jsonify({'error': 'Failed to create schedule'}), 500


@services_bp.route('/<uuid:service_id>/availability', methods=['GET'])
@jwt_required()
def get_service_availability(service_id):
    """
    Get available slots for a service on a specific date

    Query params:
    - date: Date to check (ISO format)
    - duration: Duration in minutes (optional, uses service default)
    """
    try:
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'error': 'Date is required'}), 400

        try:
            date = datetime.fromisoformat(date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400

        duration = request.args.get('duration', type=int)

        slots = ServiceService.get_service_availability(
            str(service_id),
            date,
            duration
        )

        return jsonify({'slots': slots}), 200

    except Exception as e:
        logger.error(f"Error getting availability: {str(e)}")
        return jsonify({'error': 'Failed to get availability'}), 500


@services_bp.route('/<uuid:service_id>/book', methods=['POST'])
@jwt_required()
def book_service(service_id):
    """
    Book a service appointment

    This endpoint integrates with the appointment system to create
    a service-specific appointment
    """
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        # Validate required fields
        required = ['patient_id', 'start_time', 'provider_id']
        for field in required:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        # Add service_id to the booking data
        data['service_id'] = str(service_id)

        # Get service details
        service = ServiceService.get_service_by_id(str(service_id))
        if not service:
            return jsonify({'error': 'Service not found'}), 404

        # Set default duration if not provided
        if 'duration' not in data:
            data['duration'] = service.get('default_duration_minutes', 30)

        # Import AppointmentService to handle booking
        from app.appointments.services import AppointmentService
        from uuid import UUID

        # Extract and validate required fields
        try:
            # Prepare appointment data
            patient_id = UUID(data.get('patient_id'))
            provider_id = UUID(data.get('provider_id')) if data.get('provider_id') else None

            # Get start_time - expect it in ISO format
            start_time = data.get('start_time')
            if not start_time:
                return jsonify({'error': 'start_time is required'}), 400

            # Build appointment context
            appointment_data = {
                'service_id': str(service_id),
                'notes': data.get('notes'),
                'metadata': data.get('metadata', {}),
                'booking_source': 'service_booking',
                'service_type': service.get('service_type', 'OPD'),
                'service_name': service.get('name')
            }

            # Book the appointment with proper parameters
            appointment = AppointmentService.book_appointment(
                patient_id=patient_id,
                provider_id=provider_id,
                appointment_type=data.get('appointment_type', 'consultation'),
                start_time=start_time,
                duration=data.get('duration', service.get('default_duration_minutes', 30)),
                chief_complaint=data.get('chief_complaint'),
                appointment_data=appointment_data,
                booked_by_id=UUID(user_id)
            )

        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.error(f"Error processing appointment booking: {str(e)}")
            return jsonify({'error': 'Invalid booking data'}), 400

        return jsonify({
            'appointment': appointment,
            'message': f"Service '{service['name']}' booked successfully"
        }), 201

    except Exception as e:
        logger.error(f"Error booking service: {str(e)}")
        return jsonify({'error': 'Failed to book service'}), 500


@services_bp.route('/types', methods=['GET'])
@jwt_required()
def get_service_types():
    """Get all available service types"""
    try:
        from app.services.models import ServiceType

        types = [
            {
                'value': st.value,
                'name': st.name,
                'display': st.value
            }
            for st in ServiceType
        ]

        return jsonify({'types': types}), 200

    except Exception as e:
        logger.error(f"Error getting service types: {str(e)}")
        return jsonify({'error': 'Failed to get service types'}), 500


@services_bp.route('/by-type/<service_type>', methods=['GET'])
@jwt_required()
def get_services_by_type(service_type):
    """Get all active services of a specific type"""
    try:
        services = ServiceService.get_services_by_type(service_type)
        return jsonify({'services': services}), 200

    except Exception as e:
        logger.error(f"Error getting services by type: {str(e)}")
        return jsonify({'error': 'Failed to get services'}), 500


@services_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_services_stats():
    """Get overall statistics for services"""
    try:
        from app.services.models import Service, ServiceType
        from app.extensions import db
        from sqlalchemy import func

        # Get counts by type
        type_counts = db.session.query(
            Service.service_type,
            func.count(Service.id).label('count')
        ).filter(
            Service.is_active == True
        ).group_by(Service.service_type).all()

        stats = {
            'total_services': db.session.query(func.count(Service.id)).filter(
                Service.is_active == True
            ).scalar() or 0,
            'by_type': {
                st.value: next((c for t, c in type_counts if t == st), 0)
                for st in ServiceType
            }
        }

        return jsonify(stats), 200

    except Exception as e:
        logger.error(f"Error getting service stats: {str(e)}")
        return jsonify({'error': 'Failed to get statistics'}), 500


# Create a blueprint specifically for bookings
bookings_bp = Blueprint('bookings', __name__, url_prefix='/api/bookings')


@bookings_bp.route('/calendar', methods=['GET'])
@jwt_required()
def get_service_bookings_calendar():
    """
    Get all service bookings for calendar view

    Query params:
    - from_date: Start date (ISO format)
    - to_date: End date (ISO format)
    - service_type: Optional filter by service type
    - status: Optional filter by status
    """
    try:
        from app.encounters.models import Encounter
        from app.services.models import Service
        from app.patients.models import Patient
        from app.providers.models import HealthcareProvider
        from sqlalchemy import and_

        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        service_type = request.args.get('service_type')
        status = request.args.get('status')

        if not from_date or not to_date:
            return jsonify({'error': 'from_date and to_date are required'}), 400

        # Build query for service bookings
        query = db.session.query(Encounter).filter(
            and_(
                Encounter.service_id.isnot(None),  # Only service bookings
                Encounter.start_time >= from_date,
                Encounter.start_time <= to_date
            )
        )

        # Filter by status if provided
        if status:
            query = query.filter(Encounter.status == status)

        # Filter by service type if provided
        if service_type:
            query = query.join(Service).filter(Service.service_type == service_type)

        bookings = query.order_by(Encounter.start_time).all()

        # Format bookings for calendar
        formatted_bookings = []
        for booking in bookings:
            # Get service details
            service = db.session.query(Service).filter(Service.id == booking.service_id).first()
            service_info = {
                'id': str(service.id),
                'name': service.name,
                'type': service.service_type.value if service.service_type else None
            } if service else None

            # Get patient details
            patient = db.session.query(Patient).filter(Patient.id == booking.patient_id).first()
            patient_info = {
                'id': str(patient.id),
                'name': patient.full_name
            } if patient else None

            # Get provider details if available
            provider_info = None
            if booking.provider_id:
                provider = db.session.query(HealthcareProvider).filter(
                    HealthcareProvider.id == booking.provider_id
                ).first()
                provider_info = {
                    'id': str(provider.id),
                    'name': provider.full_name,
                    'specialization': provider.specialization
                } if provider else None

            formatted_bookings.append({
                'id': str(booking.id),
                'title': f"{patient_info['name'] if patient_info else 'Unknown'} - {service_info['name'] if service_info else 'Unknown'}",
                'patient': patient_info,
                'service': service_info,
                'provider': provider_info,
                'start_time': booking.start_time.isoformat() if booking.start_time else None,
                'end_time': booking.end_time.isoformat() if booking.end_time else None,
                'status': booking.status,
                'appointment_type': booking.appointment_type,
                'chief_complaint': booking.chief_complaint,
                'type': 'service'
            })

        return jsonify({
            'bookings': formatted_bookings,
            'total': len(formatted_bookings)
        }), 200

    except Exception as e:
        logger.error(f"Error getting service bookings calendar: {str(e)}")
        return jsonify({'error': 'Failed to get service bookings'}), 500


@bookings_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user_bookings():
    """
    Get all bookings for the current user

    This endpoint finds bookings (appointments with service_id) for the logged-in user
    by finding their associated patient record(s).
    """
    try:
        from app.encounters.models import Encounter
        from app.patients.models import Patient
        from app.common.models import User
        from app.services.models import Service
        from sqlalchemy import and_, or_, desc

        user_id = get_jwt_identity()

        # Get the user to find their email
        user = db.session.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Find patient records associated with this user
        # Method 1: Check by email match
        patients = db.session.query(Patient).filter(
            or_(
                Patient.email == user.email,
                Patient.created_by == user_id
            )
        ).all()

        if not patients:
            # No patient records found for this user
            return jsonify({
                'bookings': [],
                'total': 0,
                'message': 'No patient records found for this user'
            }), 200

        # Get patient IDs
        patient_ids = [str(patient.id) for patient in patients]

        # Get query parameters
        status = request.args.get('status')
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        # Build query for bookings (encounters with service_id)
        query = db.session.query(Encounter).filter(
            and_(
                Encounter.patient_id.in_(patient_ids),
                Encounter.service_id.isnot(None)  # Only service bookings
            )
        )

        # Filter by status if provided
        if status:
            query = query.filter(Encounter.status == status)

        # Order by start_time descending (most recent first)
        query = query.order_by(desc(Encounter.start_time))

        # Get total count
        total = query.count()

        # Apply pagination
        bookings = query.limit(limit).offset(offset).all()

        # Format bookings for response
        formatted_bookings = []
        for booking in bookings:
            # Get service details
            if booking.service_id:
                service = db.session.query(Service).filter(Service.id == booking.service_id).first()
                service_info = {
                    'id': str(service.id),
                    'name': service.name,
                    'type': service.service_type.value if service.service_type else None
                } if service else None
            else:
                service_info = None

            # Get provider details
            if booking.provider_id:
                from app.providers.models import HealthcareProvider
                provider = db.session.query(HealthcareProvider).filter(
                    HealthcareProvider.id == booking.provider_id
                ).first()
                provider_info = {
                    'id': str(provider.id),
                    'name': provider.full_name,
                    'specialization': provider.specialization
                } if provider else None
            else:
                provider_info = None

            # Get patient details
            patient = db.session.query(Patient).filter(Patient.id == booking.patient_id).first()
            patient_info = {
                'id': str(patient.id),
                'name': patient.full_name,
                'phone': patient.phone
            } if patient else None

            formatted_bookings.append({
                'id': str(booking.id),
                'confirmation_number': booking.encounter_number,
                'status': booking.status,
                'service': service_info,
                'provider': provider_info,
                'patient': patient_info,
                'start_time': booking.start_time.isoformat() if booking.start_time else None,
                'end_time': booking.end_time.isoformat() if booking.end_time else None,
                'chief_complaint': booking.chief_complaint,
                'appointment_type': booking.appointment_type,
                'service_status': booking.service_status.value if booking.service_status else None,
                'created_at': booking.created_at.isoformat() if booking.created_at else None,
                'metadata': booking.service_metadata or {}
            })

        return jsonify({
            'bookings': formatted_bookings,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        logger.error(f"Error getting user bookings: {str(e)}")
        return jsonify({'error': 'Failed to get user bookings'}), 500