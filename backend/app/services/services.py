"""
Service business logic for healthcare services management
"""

from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, time, timedelta
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.services.models import (
    Service, ServiceProvider, ServiceSchedule, ServiceForm,
    ServiceType, ServiceStatus, FormType
)
from app.providers.models import HealthcareProvider
from app.forms.models import Form
from app.encounters.models import Encounter
import logging

logger = logging.getLogger(__name__)


class ServiceService:
    """Service layer for healthcare services management"""

    @staticmethod
    def _prepare_response(service: Service, include_stats: bool = True) -> dict:
        """Prepare service response with optional statistics"""
        data = service.to_dict(include_relationships=True)

        if include_stats:
            # Get appointment counts
            total_appointments = db.session.query(func.count(Encounter.id)).filter(
                Encounter.service_id == service.id
            ).scalar() or 0

            upcoming_appointments = db.session.query(func.count(Encounter.id)).filter(
                and_(
                    Encounter.service_id == service.id,
                    Encounter.start_time >= datetime.utcnow(),
                    Encounter.status.in_(['scheduled', 'confirmed'])
                )
            ).scalar() or 0

            data['stats'] = {
                'total_appointments': total_appointments,
                'upcoming_appointments': upcoming_appointments,
                'active_providers': len([p for p in service.providers if p.is_active]),
                'total_forms': len(service.service_forms)
            }

        return data

    @staticmethod
    def search_services(
        query: Optional[str] = None,
        service_type: Optional[str] = None,
        department: Optional[str] = None,
        is_active: Optional[bool] = True,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[dict], int]:
        """
        Search services with filters

        Args:
            query: Search term for name or description
            service_type: Filter by service type (IPD, OPD, etc.)
            department: Filter by department
            is_active: Filter by active status
            limit: Number of results to return
            offset: Number of results to skip

        Returns:
            Tuple of (services list, total count)
        """
        try:
            # Build base query
            base_query = db.session.query(Service)

            # Apply filters
            filters = []

            if is_active is not None:
                filters.append(Service.is_active == is_active)

            if query:
                search_filter = or_(
                    Service.name.ilike(f'%{query}%'),
                    Service.description.ilike(f'%{query}%'),
                    Service.department.ilike(f'%{query}%')
                )
                filters.append(search_filter)

            if service_type:
                try:
                    service_type_enum = ServiceType[service_type.upper()]
                    filters.append(Service.service_type == service_type_enum)
                except KeyError:
                    logger.warning(f"Invalid service type: {service_type}")

            if department:
                filters.append(Service.department.ilike(f'%{department}%'))

            if filters:
                base_query = base_query.filter(and_(*filters))

            # Get total count
            total_count = base_query.count()

            # Get paginated results with relationships
            services = base_query.options(
                joinedload(Service.providers).joinedload(ServiceProvider.provider),
                joinedload(Service.schedules),
                joinedload(Service.service_forms).joinedload(ServiceForm.form)
            ).order_by(
                Service.service_type,
                Service.name
            ).limit(limit).offset(offset).all()

            # Prepare response
            results = [ServiceService._prepare_response(s) for s in services]

            return results, total_count

        except Exception as e:
            logger.error(f"Error searching services: {str(e)}")
            return [], 0

    @staticmethod
    def get_service_by_id(service_id: str) -> Optional[dict]:
        """Get service by ID with all relationships"""
        try:
            service = db.session.query(Service).options(
                joinedload(Service.providers).joinedload(ServiceProvider.provider),
                joinedload(Service.schedules),
                joinedload(Service.service_forms).joinedload(ServiceForm.form)
            ).filter(Service.id == service_id).first()

            if not service:
                return None

            return ServiceService._prepare_response(service)

        except Exception as e:
            logger.error(f"Error getting service {service_id}: {str(e)}")
            return None

    @staticmethod
    def create_service(data: dict, created_by_id: str) -> Tuple[Optional[dict], str]:
        """
        Create a new service

        Args:
            data: Service data
            created_by_id: ID of user creating the service

        Returns:
            Tuple of (service dict or None, message)
        """
        try:
            # Validate required fields
            if not data.get('name'):
                return None, "Service name is required"

            if not data.get('service_type'):
                return None, "Service type is required"

            # Check for duplicate name
            existing = db.session.query(Service).filter(
                Service.name.ilike(data['name'])
            ).first()

            if existing:
                return None, f"Service with name '{data['name']}' already exists"

            # Create service
            service = Service(
                name=data['name'],
                service_type=ServiceType[data['service_type'].upper()],
                description=data.get('description'),
                department=data.get('department'),
                is_active=data.get('is_active', True),
                requires_admission=data.get('requires_admission', False),
                requires_referral=data.get('requires_referral', False),
                default_duration_minutes=data.get('default_duration_minutes', 30),
                max_daily_capacity=data.get('max_daily_capacity'),
                base_cost=data.get('base_cost'),
                cost_currency=data.get('cost_currency', 'INR'),
                settings=data.get('settings', {})
            )

            # Set form IDs if provided
            if data.get('default_form_id'):
                service.default_form_id = data['default_form_id']
            if data.get('intake_form_id'):
                service.intake_form_id = data['intake_form_id']
            if data.get('discharge_form_id'):
                service.discharge_form_id = data['discharge_form_id']

            db.session.add(service)
            db.session.commit()

            logger.info(f"Service created: {service.id} by user {created_by_id}")
            return ServiceService._prepare_response(service), "Service created successfully"

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating service: {str(e)}")
            return None, f"Failed to create service: {str(e)}"

    @staticmethod
    def update_service(service_id: str, data: dict, updated_by_id: str) -> Tuple[Optional[dict], str]:
        """Update service details"""
        try:
            service = db.session.query(Service).filter(Service.id == service_id).first()

            if not service:
                return None, "Service not found"

            # Update allowed fields
            updateable_fields = [
                'name', 'description', 'department', 'is_active',
                'requires_admission', 'requires_referral',
                'default_duration_minutes', 'max_daily_capacity',
                'base_cost', 'cost_currency', 'settings',
                'default_form_id', 'intake_form_id', 'discharge_form_id'
            ]

            for field in updateable_fields:
                if field in data:
                    if field == 'service_type':
                        # Don't allow changing service type after creation
                        continue
                    setattr(service, field, data[field])

            service.updated_at = datetime.utcnow()
            db.session.commit()

            logger.info(f"Service updated: {service_id} by user {updated_by_id}")
            return ServiceService._prepare_response(service), "Service updated successfully"

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating service {service_id}: {str(e)}")
            return None, f"Failed to update service: {str(e)}"

    @staticmethod
    def assign_provider_to_service(
        service_id: str,
        provider_id: str,
        is_primary: bool = False,
        settings: dict = None
    ) -> Tuple[bool, str]:
        """Assign a healthcare provider to a service"""
        try:
            # Check if service exists
            service = db.session.query(Service).filter(Service.id == service_id).first()
            if not service:
                return False, "Service not found"

            # Check if provider exists
            provider = db.session.query(HealthcareProvider).filter(
                HealthcareProvider.id == provider_id
            ).first()
            if not provider:
                return False, "Provider not found"

            # Check if already assigned
            existing = db.session.query(ServiceProvider).filter(
                and_(
                    ServiceProvider.service_id == service_id,
                    ServiceProvider.provider_id == provider_id
                )
            ).first()

            if existing:
                # Update existing assignment
                existing.is_active = True
                existing.is_primary = is_primary
                if settings:
                    existing.settings = settings
            else:
                # Create new assignment
                service_provider = ServiceProvider(
                    service_id=service_id,
                    provider_id=provider_id,
                    is_primary=is_primary,
                    is_active=True,
                    settings=settings or {}
                )
                db.session.add(service_provider)

            # If setting as primary, unset other primaries
            if is_primary:
                db.session.query(ServiceProvider).filter(
                    and_(
                        ServiceProvider.service_id == service_id,
                        ServiceProvider.provider_id != provider_id
                    )
                ).update({'is_primary': False})

            db.session.commit()
            return True, "Provider assigned to service successfully"

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error assigning provider to service: {str(e)}")
            return False, f"Failed to assign provider: {str(e)}"

    @staticmethod
    def get_service_providers(service_id: str) -> List[dict]:
        """Get all providers for a service"""
        try:
            providers = db.session.query(ServiceProvider).options(
                joinedload(ServiceProvider.provider)
            ).filter(
                and_(
                    ServiceProvider.service_id == service_id,
                    ServiceProvider.is_active == True
                )
            ).all()

            return [sp.to_dict() for sp in providers]

        except Exception as e:
            logger.error(f"Error getting service providers: {str(e)}")
            return []

    @staticmethod
    def create_service_schedule(service_id: str, schedule_data: dict) -> Tuple[bool, str]:
        """Create schedule for a service"""
        try:
            # Validate service exists
            service = db.session.query(Service).filter(Service.id == service_id).first()
            if not service:
                return False, "Service not found"

            # Create schedule
            schedule = ServiceSchedule(
                service_id=service_id,
                day_of_week=schedule_data['day_of_week'],
                start_time=time.fromisoformat(schedule_data['start_time']),
                end_time=time.fromisoformat(schedule_data['end_time']),
                max_capacity=schedule_data.get('max_capacity', 10),
                buffer_minutes=schedule_data.get('buffer_minutes', 0),
                break_times=schedule_data.get('break_times', []),
                is_active=schedule_data.get('is_active', True)
            )

            if schedule_data.get('effective_from'):
                schedule.effective_from = datetime.fromisoformat(schedule_data['effective_from'])
            if schedule_data.get('effective_until'):
                schedule.effective_until = datetime.fromisoformat(schedule_data['effective_until'])

            db.session.add(schedule)
            db.session.commit()

            return True, "Schedule created successfully"

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating service schedule: {str(e)}")
            return False, f"Failed to create schedule: {str(e)}"

    @staticmethod
    def get_service_availability(
        service_id: str,
        date: datetime,
        duration_minutes: int = None
    ) -> List[Dict[str, Any]]:
        """
        Get available time slots for a service on a specific date

        Args:
            service_id: Service ID
            date: Date to check availability
            duration_minutes: Duration of appointment (uses service default if not provided)

        Returns:
            List of available 30-minute time slots
        """
        try:
            # Get service
            service = db.session.query(Service).filter(Service.id == service_id).first()
            if not service:
                return []

            if not duration_minutes:
                duration_minutes = service.default_duration_minutes or 30

            # Get schedule for the day
            day_of_week = date.weekday()
            schedules = db.session.query(ServiceSchedule).filter(
                and_(
                    ServiceSchedule.service_id == service_id,
                    ServiceSchedule.day_of_week == day_of_week,
                    ServiceSchedule.is_active == True
                )
            ).all()

            if not schedules:
                return []

            available_slots = []

            # Fixed 30-minute slot interval
            SLOT_INTERVAL = 30

            for schedule in schedules:
                # Check if schedule is effective on this date
                if schedule.effective_from and date.date() < schedule.effective_from.date():
                    continue
                if schedule.effective_until and date.date() > schedule.effective_until.date():
                    continue

                # Generate 30-minute time slots
                current_time = datetime.combine(date.date(), schedule.start_time)
                end_time = datetime.combine(date.date(), schedule.end_time)

                # Generate all 30-minute slots within the schedule
                while current_time < end_time:
                    slot_end = current_time + timedelta(minutes=SLOT_INTERVAL)

                    # Ensure we don't exceed the schedule end time
                    if slot_end > end_time:
                        break

                    # Check if slot is in break time
                    is_break = False
                    for break_time in schedule.break_times or []:
                        break_start = time.fromisoformat(break_time['start'])
                        break_end = time.fromisoformat(break_time['end'])
                        # Check if the slot overlaps with break time
                        if (current_time.time() < break_end and slot_end.time() > break_start):
                            is_break = True
                            break

                    if not is_break:
                        # Check if any existing appointments overlap with this 30-minute slot
                        # An appointment blocks a slot if it overlaps with it in any way
                        existing_appointments = db.session.query(Encounter).filter(
                            and_(
                                Encounter.service_id == service_id,
                                Encounter.status.notin_(['cancelled', 'no-show']),
                                # Check for any overlap with the slot
                                Encounter.start_time < slot_end,
                                Encounter.end_time > current_time
                            )
                        ).all()

                        # Check capacity
                        is_available = len(existing_appointments) < schedule.max_capacity

                        # For slots where an appointment would extend beyond, check if user can book
                        # A slot is available if:
                        # 1. No appointments overlap with it AND
                        # 2. If booking duration extends beyond this slot, those slots are also free
                        can_book = True
                        if is_available and duration_minutes > SLOT_INTERVAL:
                            # Check if the full duration would be available
                            booking_end = current_time + timedelta(minutes=duration_minutes)
                            blocking_appointments = db.session.query(Encounter).filter(
                                and_(
                                    Encounter.service_id == service_id,
                                    Encounter.status.notin_(['cancelled', 'no-show']),
                                    Encounter.start_time < booking_end,
                                    Encounter.end_time > current_time
                                )
                            ).count()

                            can_book = blocking_appointments < schedule.max_capacity

                        available_slots.append({
                            'time': current_time.strftime('%H:%M'),  # Simple time format for frontend
                            'start_time': current_time.isoformat(),
                            'end_time': slot_end.isoformat(),
                            'available': is_available and can_book,
                            'available_capacity': schedule.max_capacity - len(existing_appointments) if is_available else 0,
                            'schedule_id': str(schedule.id)
                        })

                    # Always move to next 30-minute slot
                    current_time += timedelta(minutes=SLOT_INTERVAL)

            return available_slots

        except Exception as e:
            logger.error(f"Error getting service availability: {str(e)}")
            return []

    @staticmethod
    def assign_form_to_service(
        service_id: str,
        form_id: str,
        form_type: str,
        is_mandatory: bool = False,
        sequence_order: int = 0,
        conditions: dict = None
    ) -> Tuple[bool, str]:
        """Assign a form to a service"""
        try:
            # Validate service
            service = db.session.query(Service).filter(Service.id == service_id).first()
            if not service:
                return False, "Service not found"

            # Validate form
            form = db.session.query(Form).filter(Form.id == form_id).first()
            if not form:
                return False, "Form not found"

            # Check if already assigned
            existing = db.session.query(ServiceForm).filter(
                and_(
                    ServiceForm.service_id == service_id,
                    ServiceForm.form_id == form_id
                )
            ).first()

            if existing:
                # Update existing
                existing.form_type = FormType[form_type.upper()]
                existing.is_mandatory = is_mandatory
                existing.sequence_order = sequence_order
                existing.conditions = conditions or {}
            else:
                # Create new assignment
                service_form = ServiceForm(
                    service_id=service_id,
                    form_id=form_id,
                    form_type=FormType[form_type.upper()],
                    is_mandatory=is_mandatory,
                    sequence_order=sequence_order,
                    conditions=conditions or {}
                )
                db.session.add(service_form)

            db.session.commit()
            return True, "Form assigned to service successfully"

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error assigning form to service: {str(e)}")
            return False, f"Failed to assign form: {str(e)}"

    @staticmethod
    def get_service_forms(service_id: str, form_type: Optional[str] = None) -> List[dict]:
        """Get forms for a service, optionally filtered by type"""
        try:
            query = db.session.query(ServiceForm).options(
                joinedload(ServiceForm.form)
            ).filter(ServiceForm.service_id == service_id)

            if form_type:
                try:
                    form_type_enum = FormType[form_type.upper()]
                    query = query.filter(ServiceForm.form_type == form_type_enum)
                except KeyError:
                    logger.warning(f"Invalid form type: {form_type}")

            forms = query.order_by(ServiceForm.sequence_order).all()
            return [sf.to_dict() for sf in forms]

        except Exception as e:
            logger.error(f"Error getting service forms: {str(e)}")
            return []

    @staticmethod
    def get_services_by_type(service_type: str) -> List[dict]:
        """Get all active services of a specific type"""
        try:
            service_type_enum = ServiceType[service_type.upper()]
            services = db.session.query(Service).filter(
                and_(
                    Service.service_type == service_type_enum,
                    Service.is_active == True
                )
            ).order_by(Service.name).all()

            return [ServiceService._prepare_response(s, include_stats=False) for s in services]

        except KeyError:
            logger.warning(f"Invalid service type: {service_type}")
            return []
        except Exception as e:
            logger.error(f"Error getting services by type: {str(e)}")
            return []