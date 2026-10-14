"""
Provider Schedule Service Layer
Business logic for provider schedule and slot availability management
"""

from sqlalchemy import and_, or_
from datetime import datetime, date, time, timedelta
from typing import Optional, List, Dict
from uuid import UUID

from app.extensions import db
from app.providers.models import HealthcareProvider, ProviderSchedule
from app.encounters.models import Encounter


def _parse_time(time_str: str) -> time:
    """Safely parse time string that might be HH:MM or HH:MM:SS"""
    if not time_str:
        return None
    try:
        return datetime.strptime(time_str, '%H:%M:%S').time()
    except ValueError:
        return datetime.strptime(time_str, '%H:%M').time()


class ProviderScheduleService:
    """Service class for provider schedule operations"""

    @staticmethod
    def _prepare_schedule_response(schedule: ProviderSchedule) -> dict:
        """Prepare schedule data for response"""
        return {
            'id': str(schedule.id),
            'provider_id': str(schedule.provider_id),
            'day_of_week': schedule.day_of_week,
            'day_name': schedule.get_day_name(),
            'start_time': schedule.start_time.isoformat() if schedule.start_time else None,
            'end_time': schedule.end_time.isoformat() if schedule.end_time else None,
            'slot_duration': schedule.slot_duration,
            'max_appointments_per_slot': schedule.max_appointments_per_slot,
            'break_start_time': schedule.break_start_time.isoformat() if schedule.break_start_time else None,
            'break_end_time': schedule.break_end_time.isoformat() if schedule.break_end_time else None,
            'is_active': schedule.is_active,
            'notes': schedule.notes,
            'created_at': schedule.created_at.isoformat() if schedule.created_at else None,
            'updated_at': schedule.updated_at.isoformat() if schedule.updated_at else None
        }

    @staticmethod
    def get_provider_schedule(provider_id: UUID) -> List[dict]:
        """Get provider's complete weekly schedule"""
        schedules = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.is_active == True
        ).order_by(ProviderSchedule.day_of_week).all()

        return [ProviderScheduleService._prepare_schedule_response(s) for s in schedules]

    @staticmethod
    def create_or_update_schedule(provider_id: UUID, schedule_data: dict) -> dict:
        """Create or update a schedule entry for a provider"""
        day_of_week = schedule_data.get('day_of_week')
        if day_of_week is None or day_of_week < 0 or day_of_week > 6:
            raise ValueError('day_of_week must be between 0 (Monday) and 6 (Sunday)')

        # Check if schedule already exists for this day
        existing_schedule = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.day_of_week == day_of_week
        ).first()

        if existing_schedule:
            # Update existing schedule
            existing_schedule.start_time = _parse_time(schedule_data['start_time'])
            existing_schedule.end_time = _parse_time(schedule_data['end_time'])
            existing_schedule.slot_duration = schedule_data.get('slot_duration', 30)
            existing_schedule.max_appointments_per_slot = schedule_data.get('max_appointments_per_slot', 1)
            existing_schedule.is_active = schedule_data.get('is_active', True)
            existing_schedule.notes = schedule_data.get('notes')

            if schedule_data.get('break_start_time'):
                existing_schedule.break_start_time = _parse_time(schedule_data['break_start_time'])
            if schedule_data.get('break_end_time'):
                existing_schedule.break_end_time = _parse_time(schedule_data['break_end_time'])

            db.session.commit()
            return ProviderScheduleService._prepare_schedule_response(existing_schedule)

        else:
            # Create new schedule
            schedule = ProviderSchedule(
                provider_id=provider_id,
                day_of_week=day_of_week,
                start_time=_parse_time(schedule_data['start_time']),
                end_time=_parse_time(schedule_data['end_time']),
                slot_duration=schedule_data.get('slot_duration', 30),
                max_appointments_per_slot=schedule_data.get('max_appointments_per_slot', 1),
                is_active=schedule_data.get('is_active', True),
                notes=schedule_data.get('notes')
            )

            if schedule_data.get('break_start_time'):
                schedule.break_start_time = _parse_time(schedule_data['break_start_time'])
            if schedule_data.get('break_end_time'):
                schedule.break_end_time = _parse_time(schedule_data['break_end_time'])

            db.session.add(schedule)
            db.session.commit()

            return ProviderScheduleService._prepare_schedule_response(schedule)

    @staticmethod
    def create_bulk_schedule(provider_id: UUID, schedules_data: List[dict]) -> List[dict]:
        """Create or update multiple schedule entries at once"""
        results = []
        for schedule_data in schedules_data:
            try:
                schedule = ProviderScheduleService.create_or_update_schedule(
                    provider_id=provider_id,
                    schedule_data=schedule_data
                )
                results.append(schedule)
            except Exception as e:
                # Log error but continue with other schedules
                print(f"Error creating schedule for day {schedule_data.get('day_of_week')}: {str(e)}")

        return results

    @staticmethod
    def update_day_schedule(provider_id: UUID, day_of_week: int, schedule_data: dict) -> Optional[dict]:
        """Update schedule for a specific day"""
        schedule = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.day_of_week == day_of_week
        ).first()

        if not schedule:
            return None

        # Update fields
        if 'start_time' in schedule_data:
            schedule.start_time = _parse_time(schedule_data['start_time'])
        if 'end_time' in schedule_data:
            schedule.end_time = _parse_time(schedule_data['end_time'])
        if 'slot_duration' in schedule_data:
            schedule.slot_duration = schedule_data['slot_duration']
        if 'max_appointments_per_slot' in schedule_data:
            schedule.max_appointments_per_slot = schedule_data['max_appointments_per_slot']
        if 'is_active' in schedule_data:
            schedule.is_active = schedule_data['is_active']
        if 'notes' in schedule_data:
            schedule.notes = schedule_data['notes']

        if 'break_start_time' in schedule_data:
            if schedule_data['break_start_time']:
                schedule.break_start_time = _parse_time(schedule_data['break_start_time'])
            else:
                schedule.break_start_time = None

        if 'break_end_time' in schedule_data:
            if schedule_data['break_end_time']:
                schedule.break_end_time = _parse_time(schedule_data['break_end_time'])
            else:
                schedule.break_end_time = None

        db.session.commit()

        return ProviderScheduleService._prepare_schedule_response(schedule)

    @staticmethod
    def delete_day_schedule(provider_id: UUID, day_of_week: int) -> bool:
        """Delete (deactivate) schedule for a specific day"""
        schedule = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.day_of_week == day_of_week
        ).first()

        if not schedule:
            return False

        # Soft delete by deactivating
        schedule.is_active = False
        db.session.commit()

        return True

    @staticmethod
    def get_available_slots(
        provider_id: UUID,
        date_str: str,
        duration: Optional[int] = None
    ) -> List[dict]:
        """
        Get available time slots for a provider on a specific date

        Args:
            provider_id: Provider UUID
            date_str: Date in ISO format (YYYY-MM-DD)
            duration: Appointment duration in minutes (uses provider default if not specified)

        Returns:
            Dict containing:
                - provider_works_today (bool)
                - slots (List of available time slots)
        """
        # Parse date
        target_date = datetime.fromisoformat(date_str).date()
        day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday

        # Get provider
        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == provider_id
        ).first()

        if not provider:
            raise ValueError('Provider not found')

        # Use provider's default duration if not specified
        if duration is None:
            duration = provider.default_consultation_duration

        # Get provider's schedule for this day
        schedule = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.day_of_week == day_of_week,
            ProviderSchedule.is_active == True
        ).first()

        if not schedule:
            # No schedule for this day
            return {
                'provider_works_today': False,
                'slots': []
            }

        # Get existing appointments for this date
        start_of_day = datetime.combine(target_date, time.min)
        end_of_day = datetime.combine(target_date, time.max)

        existing_appointments = db.session.query(Encounter).filter(
            and_(
                Encounter.provider_id == provider_id,
                Encounter.start_time >= start_of_day,
                Encounter.start_time <= end_of_day,
                Encounter.status.in_(['scheduled', 'confirmed', 'in-progress'])
            )
        ).all()

        # Generate all possible slots
        slots = []
        current_time = datetime.combine(target_date, schedule.start_time)
        end_time = datetime.combine(target_date, schedule.end_time)
        now = datetime.now()

        # Break times
        break_start = datetime.combine(target_date, schedule.break_start_time) if schedule.break_start_time else None
        break_end = datetime.combine(target_date, schedule.break_end_time) if schedule.break_end_time else None

        while current_time + timedelta(minutes=duration) <= end_time:
            slot_end = current_time + timedelta(minutes=duration)

            # Check if slot overlaps with break time
            overlaps_break = False
            if break_start and break_end:
                if not (slot_end <= break_start or current_time >= break_end):
                    overlaps_break = True
                    
            if overlaps_break:
                # Set current time to break end to fast-forward past the break
                current_time = break_end
                continue

            # Check if slot is already booked
            slot_available = True
            booked_count = 0

            for appointment in existing_appointments:
                apt_end = appointment.end_time or (appointment.start_time + timedelta(minutes=duration))

                # Check for overlap
                if not (slot_end <= appointment.start_time or current_time >= apt_end):
                    booked_count += 1

            # Check if slot has capacity
            if booked_count >= schedule.max_appointments_per_slot:
                slot_available = False

            # If the slot is in the past (for today), it's not available
            if current_time < now:
                slot_available = False

            # Add slot to results
            slots.append({
                'start_time': current_time.time().isoformat(),
                'end_time': slot_end.time().isoformat(),
                'is_available': slot_available,
                'booked_count': booked_count,
                'capacity': schedule.max_appointments_per_slot
            })

            # Move to next slot
            current_time += timedelta(minutes=schedule.slot_duration)

        return {
            'provider_works_today': True,
            'slots': slots
        }

    @staticmethod
    def get_availability_range(
        provider_id: UUID,
        from_date: str,
        to_date: str,
        duration: Optional[int] = None
    ) -> Dict:
        """Get available slots for a date range"""
        start_date = datetime.fromisoformat(from_date).date()
        end_date = datetime.fromisoformat(to_date).date()

        # Limit to 30 days maximum
        if (end_date - start_date).days > 30:
            raise ValueError('Date range cannot exceed 30 days')

        availability = {}
        current_date = start_date

        while current_date <= end_date:
            date_str = current_date.isoformat()
            try:
                availability_data = ProviderScheduleService.get_available_slots(
                    provider_id=provider_id,
                    date_str=date_str,
                    duration=duration
                )
                slots = availability_data['slots']
                provider_works = availability_data['provider_works_today']
                
                availability[date_str] = {
                    'provider_works_today': provider_works,
                    'slots': slots,
                    'total_slots': len(slots),
                    'available_slots': len([s for s in slots if s['is_available']])
                }
            except Exception as e:
                availability[date_str] = {
                    'slots': [],
                    'error': str(e)
                }

            current_date += timedelta(days=1)

        return availability
