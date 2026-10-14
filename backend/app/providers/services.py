"""
Provider Service Layer
Business logic for healthcare provider management operations
"""

from sqlalchemy import or_, and_, func, desc, asc
from datetime import datetime, date
from typing import Optional, List, Dict, Tuple
from uuid import UUID

from app.extensions import db
from app.providers.models import HealthcareProvider, ProviderSchedule, ProviderSpecialization, ProviderDepartment
from app.encounters.models import Encounter


class ProviderService:
    """Service class for healthcare provider operations"""

    @staticmethod
    def _prepare_provider_response(provider: HealthcareProvider, include_stats: bool = True) -> dict:
        """
        Prepare provider data for response
        Decrypts encrypted fields and calculates derived fields
        """
        data = {
            'id': str(provider.id),
            'hpr_id': provider.hpr_id,
            'user_id': str(provider.user_id) if provider.user_id else None,
            'full_name': provider.full_name,
            'email': provider.get_email() if provider.email_encrypted else None,
            'phone': provider.get_phone() if provider.phone_encrypted else None,
            'specialization': provider.specialization,
            'department': provider.department,
            'license_number': provider.license_number,
            'qualification': provider.qualification,
            'designation': provider.designation,
            'signature_image': provider.signature_image,
            'facility_hfr_id': provider.facility_hfr_id,
            'bio': provider.bio,
            'years_of_experience': provider.years_of_experience,
            'default_consultation_duration': provider.default_consultation_duration,
            'accepts_new_patients': provider.accepts_new_patients,
            'is_active': provider.is_active,
            'created_at': provider.created_at.isoformat() if provider.created_at else None,
            'updated_at': provider.updated_at.isoformat() if provider.updated_at else None
        }

        # Add appointment statistics if requested
        if include_stats:
            today = datetime.utcnow().date()

            # Count total appointments
            total_appointments = db.session.query(func.count(Encounter.id)).filter(
                Encounter.provider_id == provider.id
            ).scalar() or 0

            # Count upcoming appointments
            upcoming_appointments = db.session.query(func.count(Encounter.id)).filter(
                and_(
                    Encounter.provider_id == provider.id,
                    Encounter.start_time >= datetime.utcnow(),
                    Encounter.status.in_(['scheduled', 'confirmed'])
                )
            ).scalar() or 0

            # Get next appointment
            next_appointment = db.session.query(Encounter).filter(
                and_(
                    Encounter.provider_id == provider.id,
                    Encounter.start_time >= datetime.utcnow(),
                    Encounter.status.in_(['scheduled', 'confirmed'])
                )
            ).order_by(asc(Encounter.start_time)).first()

            data['stats'] = {
                'total_appointments': total_appointments,
                'upcoming_appointments': upcoming_appointments,
                'next_appointment': next_appointment.start_time.isoformat() if next_appointment else None
            }

        return data

    @staticmethod
    def search_providers(
        query: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        filters: Optional[Dict] = None
    ) -> Tuple[List[dict], int]:
        """
        Search providers with filters

        Args:
            query: Search query (name, specialization)
            limit: Maximum results to return
            offset: Number of results to skip
            filters: Additional filters (specialization, department, is_active, sort_by, sort_order)

        Returns:
            Tuple of (providers list, total count)
        """
        filters = filters or {}

        # Base query
        query_obj = db.session.query(HealthcareProvider)

        # Apply search filter
        if query:
            search_filter = or_(
                HealthcareProvider.full_name.ilike(f'%{query}%'),
                HealthcareProvider.specialization.ilike(f'%{query}%'),
                HealthcareProvider.hpr_id.ilike(f'%{query}%')
            )
            query_obj = query_obj.filter(search_filter)

        # Apply specialization filter
        if filters.get('specialization'):
            query_obj = query_obj.filter(HealthcareProvider.specialization == filters['specialization'])

        # Apply department filter
        if filters.get('department'):
            query_obj = query_obj.filter(HealthcareProvider.department == filters['department'])

        # Apply is_active filter
        if 'is_active' in filters:
            query_obj = query_obj.filter(HealthcareProvider.is_active == filters['is_active'])

        # Get total count before pagination
        total = query_obj.count()

        # Apply sorting
        sort_by = filters.get('sort_by', 'full_name')
        sort_order = filters.get('sort_order', 'asc')

        sort_column = getattr(HealthcareProvider, sort_by, HealthcareProvider.full_name)
        if sort_order == 'desc':
            query_obj = query_obj.order_by(desc(sort_column))
        else:
            query_obj = query_obj.order_by(asc(sort_column))

        # Apply pagination
        providers = query_obj.limit(limit).offset(offset).all()

        # Prepare response
        provider_list = [
            ProviderService._prepare_provider_response(provider, include_stats=False)
            for provider in providers
        ]

        return provider_list, total

    @staticmethod
    def get_provider_by_id(provider_id: UUID) -> Optional[dict]:
        """Get provider by ID with full details"""
        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == provider_id
        ).first()

        if not provider:
            return None

        return ProviderService._prepare_provider_response(provider, include_stats=True)

    @staticmethod
    def create_provider(data: dict, created_by_id: UUID) -> dict:
        """
        Create a new healthcare provider

        Args:
            data: Provider data
            created_by_id: ID of user creating the provider

        Returns:
            Created provider data
        """
        # Create provider instance
        provider = HealthcareProvider(
            hpr_id=data.get('hpr_id') or None,
            user_id=UUID(data['user_id']) if data.get('user_id') else None,
            full_name=data['full_name'],
            specialization=data.get('specialization'),
            department=data.get('department'),
            license_number=data.get('license_number') or None,
            qualification=data.get('qualification'),
            designation=data.get('designation'),
            signature_image=data.get('signature_image'),
            facility_hfr_id=data.get('facility_hfr_id'),
            bio=data.get('bio'),
            years_of_experience=data.get('years_of_experience'),
            default_consultation_duration=data.get('default_consultation_duration', 30),
            accepts_new_patients=data.get('accepts_new_patients', True),
            is_active=data.get('is_active', True),
            created_by=created_by_id
        )

        # Set encrypted fields
        if data.get('email'):
            provider.set_email(data['email'])
        if data.get('phone'):
            provider.set_phone(data['phone'])

        # Save to database
        db.session.add(provider)
        db.session.commit()

        # Initialize default schedule for Monday - Friday (0-4)
        try:
            from app.providers.schedule_services import ProviderScheduleService
            default_schedules = []
            for day_idx in range(5):
                default_schedules.append({
                    'day_of_week': day_idx,
                    'start_time': '09:00:00',
                    'end_time': '17:00:00',
                    'slot_duration': 30,
                    'max_appointments_per_slot': 1,
                    'is_active': True
                })
            ProviderScheduleService.create_bulk_schedule(provider.id, default_schedules)
        except Exception as e:
            import logging
            logging.error(f"Failed to create default schedule for provider {provider.id}: {str(e)}")

        return ProviderService._prepare_provider_response(provider, include_stats=False)

    @staticmethod
    def update_provider(provider_id: UUID, data: dict) -> Optional[dict]:
        """
        Update an existing provider

        Args:
            provider_id: Provider ID
            data: Updated provider data

        Returns:
            Updated provider data or None if not found
        """
        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == provider_id
        ).first()

        if not provider:
            return None

        # Update fields
        if 'full_name' in data:
            provider.full_name = data['full_name']
        if 'hpr_id' in data:
            provider.hpr_id = data['hpr_id'] or None
        if 'user_id' in data:
            provider.user_id = UUID(data['user_id']) if data['user_id'] else None
        if 'specialization' in data:
            provider.specialization = data['specialization']
        if 'department' in data:
            provider.department = data['department']
        if 'license_number' in data:
            provider.license_number = data['license_number'] or None
        if 'qualification' in data:
            provider.qualification = data['qualification']
        if 'designation' in data:
            provider.designation = data['designation']
        if 'signature_image' in data:
            provider.signature_image = data['signature_image']
        if 'facility_hfr_id' in data:
            provider.facility_hfr_id = data['facility_hfr_id']
        if 'bio' in data:
            provider.bio = data['bio']
        if 'years_of_experience' in data:
            provider.years_of_experience = data['years_of_experience']
        if 'default_consultation_duration' in data:
            provider.default_consultation_duration = data['default_consultation_duration']
        if 'accepts_new_patients' in data:
            provider.accepts_new_patients = data['accepts_new_patients']
        if 'is_active' in data:
            provider.is_active = data['is_active']

        # Update encrypted fields
        if 'email' in data:
            provider.set_email(data['email'])
        if 'phone' in data:
            provider.set_phone(data['phone'])

        # Save changes
        db.session.commit()

        return ProviderService._prepare_provider_response(provider, include_stats=False)

    @staticmethod
    def deactivate_provider(provider_id: UUID) -> bool:
        """
        Deactivate a provider (soft delete)

        Args:
            provider_id: Provider ID

        Returns:
            True if successful, False if not found
        """
        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == provider_id
        ).first()

        if not provider:
            return False

        provider.is_active = False
        db.session.commit()

        return True

    @staticmethod
    def get_provider_appointments(
        provider_id: UUID,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[dict], int]:
        """
        Get provider's appointments with filters

        Args:
            provider_id: Provider ID
            from_date: Start date filter (ISO format)
            to_date: End date filter (ISO format)
            status: Status filter
            limit: Maximum results
            offset: Skip results

        Returns:
            Tuple of (appointments list, total count)
        """
        # Base query
        query_obj = db.session.query(Encounter).filter(
            Encounter.provider_id == provider_id
        )

        # Apply date filters
        if from_date:
            from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query_obj = query_obj.filter(Encounter.start_time >= from_datetime)

        if to_date:
            to_datetime = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query_obj = query_obj.filter(Encounter.start_time <= to_datetime)

        # Apply status filter
        if status:
            query_obj = query_obj.filter(Encounter.status == status)

        # Get total count
        total = query_obj.count()

        # Apply sorting and pagination
        appointments = query_obj.order_by(desc(Encounter.start_time)).limit(limit).offset(offset).all()

        # Prepare response
        appointment_list = [apt.to_dict() for apt in appointments]

        return appointment_list, total

    @staticmethod
    def get_all_specializations() -> List[str]:
        """Get list of all active specializations (predefined + custom)"""
        results = db.session.query(ProviderSpecialization.name).filter(
            ProviderSpecialization.is_active == True
        ).order_by(ProviderSpecialization.name).all()

        return [r[0] for r in results]

    @staticmethod
    def get_all_departments() -> List[str]:
        """Get list of all active departments (predefined + custom)"""
        results = db.session.query(ProviderDepartment.name).filter(
            ProviderDepartment.is_active == True
        ).order_by(ProviderDepartment.name).all()

        return [r[0] for r in results]

    @staticmethod
    def add_custom_specialization(name: str, created_by_id: UUID) -> dict:
        """Add a custom specialization"""
        # Check if already exists (case-insensitive)
        existing = db.session.query(ProviderSpecialization).filter(
            func.lower(ProviderSpecialization.name) == func.lower(name)
        ).first()

        if existing:
            if not existing.is_active:
                # Reactivate if it was deactivated
                existing.is_active = True
                db.session.commit()
                return existing.to_dict()
            raise ValueError(f"Specialization '{name}' already exists")

        # Create new specialization
        specialization = ProviderSpecialization(
            name=name.strip(),
            is_predefined=False,
            is_active=True,
            created_by=created_by_id
        )
        db.session.add(specialization)
        db.session.commit()

        return specialization.to_dict()

    @staticmethod
    def deactivate_specialization(name: str) -> bool:
        """Deactivate a specialization (soft delete)"""
        spec = db.session.query(ProviderSpecialization).filter(
            func.lower(ProviderSpecialization.name) == func.lower(name)
        ).first()

        if not spec:
            raise ValueError(f"Specialization '{name}' not found")

        spec.is_active = False
        db.session.commit()
        return True

    @staticmethod
    def add_custom_department(name: str, created_by_id: UUID) -> dict:
        """Add a custom department"""
        # Check if already exists (case-insensitive)
        existing = db.session.query(ProviderDepartment).filter(
            func.lower(ProviderDepartment.name) == func.lower(name)
        ).first()

        if existing:
            if not existing.is_active:
                # Reactivate if it was deactivated
                existing.is_active = True
                db.session.commit()
                return existing.to_dict()
            raise ValueError(f"Department '{name}' already exists")

        # Create new department
        department = ProviderDepartment(
            name=name.strip(),
            is_predefined=False,
            is_active=True,
            created_by=created_by_id
        )
        db.session.add(department)
        db.session.commit()

        return department.to_dict()

    @staticmethod
    def quick_create_provider(
        full_name: str,
        specialization: Optional[str],
        phone: Optional[str],
        email: Optional[str],
        created_by_id: UUID,
        bulk_import_session_id: Optional[UUID] = None
    ) -> dict:
        """
        Quick create provider for bulk import flow
        Creates a minimal provider with optional schedule

        Args:
            full_name: Provider's full name (required)
            specialization: Provider's specialization (optional)
            phone: Provider's phone (optional)
            email: Provider's email (optional)
            created_by_id: ID of user creating the provider
            bulk_import_session_id: ID of bulk import session (optional)

        Returns:
            Created provider data
        """
        # Validate required field
        if not full_name or not full_name.strip():
            raise ValueError("Provider name is required")

        # Create provider instance
        provider = HealthcareProvider(
            full_name=full_name.strip(),
            specialization=specialization.strip() if specialization else None,
            default_consultation_duration=30,
            accepts_new_patients=True,
            is_active=True,
            created_from_bulk_import=True,
            bulk_import_session_id=bulk_import_session_id,
            created_by=created_by_id
        )

        # Set encrypted fields if provided
        if email and email.strip():
            provider.set_email(email.strip())
        if phone and phone.strip():
            provider.set_phone(phone.strip())

        # Save to database
        db.session.add(provider)
        db.session.commit()

        # Initialize default schedule for Monday - Friday (0-4)
        try:
            from app.providers.schedule_services import ProviderScheduleService
            default_schedules = []
            for day_idx in range(5):
                default_schedules.append({
                    'day_of_week': day_idx,
                    'start_time': '09:00:00',
                    'end_time': '17:00:00',
                    'slot_duration': 30,
                    'max_appointments_per_slot': 1,
                    'is_active': True
                })
            ProviderScheduleService.create_bulk_schedule(provider.id, default_schedules)
        except Exception as e:
            import logging
            logging.error(f"Failed to create default schedule for quick provider {provider.id}: {str(e)}")

        return ProviderService._prepare_provider_response(provider, include_stats=False)

    @staticmethod
    def get_or_create_unknown_provider(created_by_id: UUID) -> dict:
        """
        Get or create the "Unknown Provider" placeholder
        This provider acts as a fallback for bulk imports with missing providers

        Args:
            created_by_id: ID of user requesting the placeholder

        Returns:
            Unknown provider data
        """
        # Try to find existing Unknown Provider
        unknown_provider = db.session.query(HealthcareProvider).filter(
            and_(
                HealthcareProvider.is_placeholder == True,
                HealthcareProvider.is_active == True
            )
        ).first()

        if unknown_provider:
            return ProviderService._prepare_provider_response(unknown_provider, include_stats=False)

        # Create new Unknown Provider
        unknown_provider = HealthcareProvider(
            full_name="Unknown Provider",
            specialization="General",
            default_consultation_duration=30,
            accepts_new_patients=True,
            is_active=True,
            is_placeholder=True,
            created_from_bulk_import=False,
            created_by=created_by_id
        )

        # Save to database
        db.session.add(unknown_provider)
        db.session.commit()

        # Initialize default schedule for Monday - Friday (0-4)
        try:
            from app.providers.schedule_services import ProviderScheduleService
            default_schedules = []
            for day_idx in range(5):
                default_schedules.append({
                    'day_of_week': day_idx,
                    'start_time': '09:00:00',
                    'end_time': '17:00:00',
                    'slot_duration': 30,
                    'max_appointments_per_slot': 1,
                    'is_active': True
                })
            ProviderScheduleService.create_bulk_schedule(unknown_provider.id, default_schedules)
        except Exception as e:
            import logging
            logging.error(f"Failed to create default schedule for unknown provider {unknown_provider.id}: {str(e)}")

        return ProviderService._prepare_provider_response(unknown_provider, include_stats=False)
