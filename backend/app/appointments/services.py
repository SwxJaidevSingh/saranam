"""
Appointment Service Layer
Business logic for appointment booking, management, and conflict detection
"""

from sqlalchemy import and_, or_, func, desc, asc
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from uuid import UUID, uuid4

from app.extensions import db
from app.encounters.models import Encounter
from app.patients.models import Patient
from app.providers.models import HealthcareProvider


class AppointmentService:
    """Service class for appointment operations"""

    @staticmethod
    def _prepare_appointment_response(encounter: Encounter) -> dict:
        """Prepare appointment data for response"""
        return encounter.to_dict()

    @staticmethod
    def check_slot_availability(
        provider_id: UUID,
        start_time: datetime,
        duration: int,
        exclude_appointment_id: Optional[UUID] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a time slot is available for booking

        Returns:
            Tuple of (is_available, conflict_message)
        """
        end_time = start_time + timedelta(minutes=duration)

        # Build query for conflicting appointments
        # Overlap logic: (s1 < e2) AND (s2 < e1)
        conflict_query = db.session.query(Encounter).filter(
            and_(
                Encounter.provider_id == provider_id,
                Encounter.status.in_(['scheduled', 'confirmed', 'in-progress', 'checked_in', 'completed']),
                Encounter.start_time < end_time,
                Encounter.end_time > start_time
            )
        )

        # Exclude current appointment if rescheduling
        if exclude_appointment_id:
            conflict_query = conflict_query.filter(Encounter.id != exclude_appointment_id)

        conflicting_appointment = conflict_query.first()

        if conflicting_appointment:
            conflict_msg = f"Time slot conflicts with existing appointment at {conflicting_appointment.start_time.isoformat()}"
            return False, conflict_msg

        return True, None

    @staticmethod
    def list_appointments(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        provider_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        status: Optional[str] = None,
        encounter_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[dict], int]:
        """List appointments with filters"""
        # Base query
        query_obj = db.session.query(Encounter).options(
            joinedload(Encounter.provider),
            joinedload(Encounter.patient),
            joinedload(Encounter.service)
        ).filter(
            Encounter.appointment_type.isnot(None)  # Only get appointments (not regular encounters)
        )

        # Apply filters
        if from_date:
            from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query_obj = query_obj.filter(Encounter.start_time >= from_datetime)

        if to_date:
            to_datetime = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            if to_datetime.time() == datetime.min.time():
                # End of day
                to_datetime = to_datetime.replace(hour=23, minute=59, second=59, microsecond=999999)
            query_obj = query_obj.filter(Encounter.start_time <= to_datetime)

        if provider_id:
            query_obj = query_obj.filter(Encounter.provider_id == UUID(provider_id))

        if patient_id:
            query_obj = query_obj.filter(Encounter.patient_id == UUID(patient_id))

        if status:
            query_obj = query_obj.filter(Encounter.status == status)

        if encounter_type:
            query_obj = query_obj.filter(Encounter.encounter_type == encounter_type)

        # Get total count
        total = query_obj.count()

        # Apply sorting and pagination
        appointments = query_obj.order_by(desc(Encounter.start_time)).limit(limit).offset(offset).all()

        # Prepare response
        appointment_list = [AppointmentService._prepare_appointment_response(apt) for apt in appointments]

        return appointment_list, total

    @staticmethod
    def get_appointment_by_id(appointment_id: UUID) -> Optional[dict]:
        """Get appointment by ID"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def book_appointment(
        patient_id: UUID,
        provider_id: Optional[UUID],
        appointment_type: str,
        start_time: str,
        duration: Optional[int],
        chief_complaint: Optional[str],
        appointment_data: dict,
        booked_by_id: UUID
    ) -> dict:
        """
        Book a new appointment with conflict detection

        Args:
            patient_id: Patient UUID
            provider_id: Provider UUID (optional for some appointment types)
            appointment_type: Type of appointment
            start_time: Appointment start time (ISO format)
            duration: Duration in minutes
            chief_complaint: Reason for visit
            appointment_data: Additional appointment data
            booked_by_id: User ID who is booking

        Returns:
            Created appointment data

        Raises:
            ValueError: If slot is not available or validation fails
        """
        # Parse start time
        start_datetime = datetime.fromisoformat(start_time.replace('Z', '+00:00'))

        # Get provider to determine duration if not specified
        if provider_id and not duration:
            provider = db.session.query(HealthcareProvider).filter(
                HealthcareProvider.id == provider_id
            ).first()
            if provider:
                duration = provider.default_consultation_duration
            else:
                raise ValueError('Provider not found')
        elif not duration:
            duration = 30  # Default duration

        # Calculate end time
        end_datetime = start_datetime + timedelta(minutes=duration)

        # Check slot availability if provider is specified
        if provider_id:
            is_available, conflict_msg = AppointmentService.check_slot_availability(
                provider_id=provider_id,
                start_time=start_datetime,
                duration=duration
            )

            if not is_available:
                raise ValueError(conflict_msg)

        # Verify patient exists
        patient = db.session.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError('Patient not found')

        # Create appointment
        appointment = Encounter(
            id=uuid4(),
            patient_id=patient_id,
            provider_id=provider_id,
            encounter_type=appointment_data.get('encounter_type', 'OPD'),
            appointment_type=appointment_type,
            start_time=start_datetime,
            end_time=end_datetime,
            status='scheduled',
            chief_complaint=chief_complaint,
            booking_source=appointment_data.get('booking_source', 'staff'),
            booked_by=booked_by_id,
            created_by=booked_by_id,
            facility_hfr_id=appointment_data.get('facility_hfr_id'),
            pre_appointment_notes=appointment_data.get('notes'),
            reminder_preferences=appointment_data.get('reminder_preferences'),
            meeting_link=appointment_data.get('meeting_link') if appointment_type == 'teleconsultation' else None,
            meeting_password=appointment_data.get('meeting_password') if appointment_type == 'teleconsultation' else None
        )

        db.session.add(appointment)
        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def update_appointment(appointment_id: UUID, update_data: dict) -> Optional[dict]:
        """Update an existing appointment"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        # Update allowed fields
        if 'chief_complaint' in update_data:
            appointment.chief_complaint = update_data['chief_complaint']
        if 'pre_appointment_notes' in update_data:
            appointment.pre_appointment_notes = update_data['pre_appointment_notes']
        if 'post_appointment_notes' in update_data:
            appointment.post_appointment_notes = update_data['post_appointment_notes']
        if 'status' in update_data:
            appointment.status = update_data['status']
        if 'meeting_link' in update_data:
            appointment.meeting_link = update_data['meeting_link']
        if 'meeting_password' in update_data:
            appointment.meeting_password = update_data['meeting_password']

        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def reschedule_appointment(
        appointment_id: UUID,
        new_start_time: str,
        new_duration: Optional[int] = None,
        reason: Optional[str] = None
    ) -> Optional[dict]:
        """Reschedule an appointment to a new time slot"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        # Parse new start time
        new_start_datetime = datetime.fromisoformat(new_start_time.replace('Z', '+00:00'))

        # Use existing duration if not specified
        if not new_duration:
            current_duration = (appointment.end_time - appointment.start_time).total_seconds() / 60
            new_duration = int(current_duration)

        # Check new slot availability
        if appointment.provider_id:
            is_available, conflict_msg = AppointmentService.check_slot_availability(
                provider_id=appointment.provider_id,
                start_time=new_start_datetime,
                duration=new_duration,
                exclude_appointment_id=appointment_id
            )

            if not is_available:
                raise ValueError(conflict_msg)

        # Update appointment times
        appointment.start_time = new_start_datetime
        appointment.end_time = new_start_datetime + timedelta(minutes=new_duration)
        appointment.status = 'rescheduled'  # Add rescheduled to status enum if needed

        # Add rescheduling note
        if reason:
            current_notes = appointment.pre_appointment_notes or ''
            appointment.pre_appointment_notes = f"{current_notes}\n\nRescheduled: {reason}"

        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def cancel_appointment(
        appointment_id: UUID,
        cancelled_by_id: UUID,
        reason: Optional[str] = None
    ) -> Optional[dict]:
        """Cancel an appointment"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        appointment.status = 'cancelled'
        appointment.cancelled_by = cancelled_by_id
        appointment.cancelled_at = datetime.utcnow()
        appointment.cancellation_reason = reason

        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def check_in_appointment(appointment_id: UUID) -> Optional[dict]:
        """Mark patient as checked in"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        appointment.checked_in_at = datetime.utcnow()
        appointment.status = 'checked_in'  # or 'in-progress'

        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def complete_appointment(appointment_id: UUID, notes: Optional[str] = None) -> Optional[dict]:
        """Mark appointment as completed"""
        appointment = db.session.query(Encounter).filter(
            Encounter.id == appointment_id
        ).first()

        if not appointment:
            return None

        appointment.status = 'completed'
        appointment.checked_out_at = datetime.utcnow()
        
        # Ensure end_time is not before start_time
        now = datetime.utcnow()
        if appointment.start_time and now > appointment.start_time:
            appointment.end_time = now
        else:
            # For future appointments marked as completed, use the scheduled end time
            pass 

        if notes:
            appointment.post_appointment_notes = notes

        db.session.commit()

        return AppointmentService._prepare_appointment_response(appointment)

    @staticmethod
    def get_calendar_view(
        from_date: str,
        to_date: str,
        provider_id: Optional[str] = None,
        view_type: str = 'week'
    ) -> Dict:
        """Get calendar view of appointments"""
        from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        to_datetime = datetime.fromisoformat(to_date.replace('Z', '+00:00'))

        # Build query
        query_obj = db.session.query(Encounter).filter(
            and_(
                Encounter.appointment_type.isnot(None),
                Encounter.start_time >= from_datetime,
                Encounter.start_time <= to_datetime
            )
        )

        if provider_id:
            query_obj = query_obj.filter(Encounter.provider_id == UUID(provider_id))

        # Get appointments
        appointments = query_obj.order_by(asc(Encounter.start_time)).all()

        # Prepare calendar data
        calendar_data = {
            'from_date': from_date,
            'to_date': to_date,
            'view_type': view_type,
            'appointments': [apt.to_dict() for apt in appointments],
            'total_count': len(appointments)
        }

        return calendar_data

    @staticmethod
    def get_appointment_stats(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        provider_id: Optional[str] = None
    ) -> Dict:
        """Get appointment statistics for analytics"""
        # Base query
        query_obj = db.session.query(Encounter).filter(
            Encounter.appointment_type.isnot(None)
        )

        # Apply date filters
        if from_date:
            from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query_obj = query_obj.filter(Encounter.start_time >= from_datetime)

        if to_date:
            to_datetime = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query_obj = query_obj.filter(Encounter.start_time <= to_datetime)

        if provider_id:
            query_obj = query_obj.filter(Encounter.provider_id == UUID(provider_id))

        # Calculate stats
        total_appointments = query_obj.count()

        # Count by status
        status_counts = db.session.query(
            Encounter.status,
            func.count(Encounter.id).label('count')
        ).filter(
            Encounter.id.in_([e.id for e in query_obj.all()])
        ).group_by(Encounter.status).all()

        status_breakdown = {status: count for status, count in status_counts}

        # Count by appointment type
        type_counts = db.session.query(
            Encounter.appointment_type,
            func.count(Encounter.id).label('count')
        ).filter(
            Encounter.id.in_([e.id for e in query_obj.all()])
        ).group_by(Encounter.appointment_type).all()

        type_breakdown = {apt_type: count for apt_type, count in type_counts}

        # No-show rate
        no_shows = status_breakdown.get('no-show', 0)
        no_show_rate = (no_shows / total_appointments * 100) if total_appointments > 0 else 0

        return {
            'total_appointments': total_appointments,
            'status_breakdown': status_breakdown,
            'type_breakdown': type_breakdown,
            'no_show_count': no_shows,
            'no_show_rate': round(no_show_rate, 2),
            'from_date': from_date,
            'to_date': to_date
        }
