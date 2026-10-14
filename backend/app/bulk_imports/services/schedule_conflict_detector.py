"""
Schedule and Conflict Detection Engine
Pure logic - no LLM, deterministic conflict detection
"""

from datetime import datetime, date, time, timedelta
from typing import Dict, List, Tuple, Optional
from uuid import UUID
import logging

from app.extensions import db
from app.providers.models import HealthcareProvider, ProviderSchedule
from app.encounters.models import Encounter
from app.patients.models import Patient

logger = logging.getLogger(__name__)


class ConflictType:
    """Enum for conflict types"""
    PROVIDER_TIME_OVERLAP = 'PROVIDER_TIME_OVERLAP'
    PATIENT_DOUBLE_BOOKING = 'PATIENT_DOUBLE_BOOKING'
    BREAK_TIME_OVERLAP = 'BREAK_TIME_OVERLAP'
    SLOT_FULL = 'SLOT_FULL'
    INVALID_TIME_SLOT = 'INVALID_TIME_SLOT'
    DUPLICATE = 'DUPLICATE'
    OUTSIDE_HOURS = 'OUTSIDE_HOURS'
    PROVIDER_NOT_WORKING = 'PROVIDER_NOT_WORKING'


class ConflictSeverity:
    """Enum for conflict severity"""
    HIGH = 'HIGH'      # Cannot auto-resolve
    MEDIUM = 'MEDIUM'  # Can suggest alternatives
    LOW = 'LOW'        # Can auto-resolve


class Conflict:
    """Structured conflict object"""
    def __init__(self, conflict_type: str, severity: str, message: str, details: Dict = None):
        self.type = conflict_type
        self.severity = severity
        self.message = message
        self.details = details or {}

    def to_dict(self):
        return {
            'type': self.type,
            'severity': self.severity,
            'message': self.message,
            'details': self.details
        }


class ProviderScheduleValidator:
    """Validates appointments against provider schedules"""

    @staticmethod
    def validate_provider_schedule(
        provider_id: UUID,
        appointment_date: date,
        appointment_time: time,
        duration_minutes: int
    ) -> Tuple[bool, Optional[Conflict], Optional[ProviderSchedule]]:
        """
        Validate appointment against provider's schedule

        Returns:
            (is_valid, conflict, schedule)
        """
        # Get day of week (0=Monday, 6=Sunday)
        day_of_week = appointment_date.weekday()

        # Get provider's schedule for this day
        schedule = db.session.query(ProviderSchedule).filter(
            ProviderSchedule.provider_id == provider_id,
            ProviderSchedule.day_of_week == day_of_week,
            ProviderSchedule.is_active == True
        ).first()

        if not schedule:
            conflict = Conflict(
                conflict_type=ConflictType.PROVIDER_NOT_WORKING,
                severity=ConflictSeverity.HIGH,
                message=f"Provider does not work on {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day_of_week]}",
                details={'day_of_week': day_of_week}
            )
            return False, conflict, None

        # Check if time is within working hours
        appointment_end_time = (datetime.combine(date.today(), appointment_time) +
                                timedelta(minutes=duration_minutes)).time()

        if appointment_time < schedule.start_time or appointment_end_time > schedule.end_time:
            conflict = Conflict(
                conflict_type=ConflictType.OUTSIDE_HOURS,
                severity=ConflictSeverity.HIGH,
                message=f"Appointment time outside working hours ({schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')})",
                details={
                    'working_hours': {
                        'start': schedule.start_time.strftime('%H:%M'),
                        'end': schedule.end_time.strftime('%H:%M')
                    },
                    'requested': {
                        'start': appointment_time.strftime('%H:%M'),
                        'end': appointment_end_time.strftime('%H:%M')
                    }
                }
            )
            return False, conflict, schedule

        # Check slot alignment
        is_valid_slot, slot_conflict = ProviderScheduleValidator._check_slot_alignment(
            schedule, appointment_time
        )

        if not is_valid_slot:
            return False, slot_conflict, schedule

        # Check break time overlap
        if schedule.break_start_time and schedule.break_end_time:
            overlaps_break, break_conflict = ProviderScheduleValidator._check_break_overlap(
                schedule, appointment_time, appointment_end_time
            )

            if overlaps_break:
                return False, break_conflict, schedule

        return True, None, schedule

    @staticmethod
    def _check_slot_alignment(schedule: ProviderSchedule, appointment_time: time) -> Tuple[bool, Optional[Conflict]]:
        """Check if appointment time aligns with provider's slot boundaries"""
        # Calculate all valid slot times
        current_time = datetime.combine(date.today(), schedule.start_time)
        end_time = datetime.combine(date.today(), schedule.end_time)
        slot_duration = timedelta(minutes=schedule.slot_duration)

        valid_slots = []
        while current_time < end_time:
            valid_slots.append(current_time.time())
            current_time += slot_duration

        if appointment_time in valid_slots:
            return True, None

        # Find nearest slot
        appointment_dt = datetime.combine(date.today(), appointment_time)
        nearest_slot = min(
            [datetime.combine(date.today(), s) for s in valid_slots],
            key=lambda x: abs((x - appointment_dt).total_seconds())
        )

        conflict = Conflict(
            conflict_type=ConflictType.INVALID_TIME_SLOT,
            severity=ConflictSeverity.MEDIUM,
            message=f"Time {appointment_time.strftime('%H:%M')} doesn't align with slot boundaries (every {schedule.slot_duration} mins)",
            details={
                'requested_time': appointment_time.strftime('%H:%M'),
                'nearest_slot': nearest_slot.time().strftime('%H:%M'),
                'slot_duration': schedule.slot_duration,
                'valid_slots': [s.strftime('%H:%M') for s in valid_slots[:10]]  # First 10 slots
            }
        )

        return False, conflict

    @staticmethod
    def _check_break_overlap(schedule: ProviderSchedule, start_time: time, end_time: time) -> Tuple[bool, Optional[Conflict]]:
        """Check if appointment overlaps with break time"""
        break_start = schedule.break_start_time
        break_end = schedule.break_end_time

        # Check overlap
        if not (end_time <= break_start or start_time >= break_end):
            conflict = Conflict(
                conflict_type=ConflictType.BREAK_TIME_OVERLAP,
                severity=ConflictSeverity.MEDIUM,
                message=f"Appointment overlaps with provider's break ({break_start.strftime('%H:%M')}-{break_end.strftime('%H:%M')})",
                details={
                    'break_time': {
                        'start': break_start.strftime('%H:%M'),
                        'end': break_end.strftime('%H:%M')
                    },
                    'appointment_time': {
                        'start': start_time.strftime('%H:%M'),
                        'end': end_time.strftime('%H:%M')
                    }
                }
            )
            return True, conflict

        return False, None


class AppointmentConflictDetector:
    """Detects scheduling conflicts with existing appointments"""

    @staticmethod
    def detect_provider_conflicts(
        provider_id: UUID,
        appointment_date: date,
        appointment_time: time,
        duration_minutes: int,
        exclude_encounter_id: Optional[UUID] = None
    ) -> List[Conflict]:
        """
        Detect conflicts with provider's existing appointments

        Returns:
            List of conflicts
        """
        conflicts = []

        # Build datetime
        start_datetime = datetime.combine(appointment_date, appointment_time)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)

        # Query existing appointments
        query = db.session.query(Encounter).filter(
            Encounter.provider_id == provider_id,
            Encounter.start_time >= datetime.combine(appointment_date, time.min),
            Encounter.start_time < datetime.combine(appointment_date + timedelta(days=1), time.min),
            Encounter.status.in_(['scheduled', 'confirmed', 'in-progress'])
        )

        if exclude_encounter_id:
            query = query.filter(Encounter.id != exclude_encounter_id)

        existing_appointments = query.all()

        # Check for time overlaps
        for existing in existing_appointments:
            existing_end = existing.end_time or (existing.start_time + timedelta(minutes=30))

            # Check overlap
            if not (end_datetime <= existing.start_time or start_datetime >= existing_end):
                # Get patient name
                patient_name = "Unknown"
                if existing.patient:
                    patient_name = existing.patient.full_name

                conflict = Conflict(
                    conflict_type=ConflictType.PROVIDER_TIME_OVERLAP,
                    severity=ConflictSeverity.HIGH,
                    message=f"Provider already has appointment with {patient_name}",
                    details={
                        'existing_appointment_id': str(existing.id),
                        'existing_patient': patient_name,
                        'existing_time': {
                            'start': existing.start_time.strftime('%Y-%m-%d %H:%M'),
                            'end': existing_end.strftime('%Y-%m-%d %H:%M')
                        },
                        'requested_time': {
                            'start': start_datetime.strftime('%Y-%m-%d %H:%M'),
                            'end': end_datetime.strftime('%Y-%m-%d %H:%M')
                        }
                    }
                )
                conflicts.append(conflict)

        return conflicts

    @staticmethod
    def detect_patient_conflicts(
        patient_id: UUID,
        appointment_date: date,
        appointment_time: time,
        duration_minutes: int,
        exclude_encounter_id: Optional[UUID] = None
    ) -> List[Conflict]:
        """
        Detect conflicts with patient's existing appointments

        Returns:
            List of conflicts
        """
        conflicts = []

        # Build datetime
        start_datetime = datetime.combine(appointment_date, appointment_time)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)

        # Query existing appointments
        query = db.session.query(Encounter).filter(
            Encounter.patient_id == patient_id,
            Encounter.start_time >= datetime.combine(appointment_date, time.min),
            Encounter.start_time < datetime.combine(appointment_date + timedelta(days=1), time.min),
            Encounter.status.in_(['scheduled', 'confirmed'])
        )

        if exclude_encounter_id:
            query = query.filter(Encounter.id != exclude_encounter_id)

        existing_appointments = query.all()

        # Check for overlaps
        for existing in existing_appointments:
            existing_end = existing.end_time or (existing.start_time + timedelta(minutes=30))

            if not (end_datetime <= existing.start_time or start_datetime >= existing_end):
                provider_name = "Unknown"
                if existing.provider:
                    provider_name = existing.provider.full_name

                conflict = Conflict(
                    conflict_type=ConflictType.PATIENT_DOUBLE_BOOKING,
                    severity=ConflictSeverity.HIGH,
                    message=f"Patient already has appointment with {provider_name}",
                    details={
                        'existing_appointment_id': str(existing.id),
                        'existing_provider': provider_name,
                        'existing_time': {
                            'start': existing.start_time.strftime('%Y-%m-%d %H:%M'),
                            'end': existing_end.strftime('%Y-%m-%d %H:%M')
                        }
                    }
                )
                conflicts.append(conflict)

        return conflicts

    @staticmethod
    def detect_duplicate_appointment(
        patient_id: UUID,
        provider_id: UUID,
        appointment_date: date,
        appointment_time: time,
        exclude_encounter_id: Optional[UUID] = None
    ) -> Optional[Conflict]:
        """
        Detect exact duplicate appointment

        Returns:
            Conflict if duplicate exists, None otherwise
        """
        start_datetime = datetime.combine(appointment_date, appointment_time)

        query = db.session.query(Encounter).filter(
            Encounter.patient_id == patient_id,
            Encounter.provider_id == provider_id,
            Encounter.start_time == start_datetime,
            Encounter.status.in_(['scheduled', 'confirmed'])
        )

        if exclude_encounter_id:
            query = query.filter(Encounter.id != exclude_encounter_id)

        duplicate = query.first()

        if duplicate:
            return Conflict(
                conflict_type=ConflictType.DUPLICATE,
                severity=ConflictSeverity.LOW,
                message=f"Identical appointment already exists (ID: {duplicate.id})",
                details={'duplicate_appointment_id': str(duplicate.id)}
            )

        return None

    @staticmethod
    def detect_slot_capacity_conflict(
        provider_id: UUID,
        schedule: ProviderSchedule,
        appointment_date: date,
        appointment_time: time
    ) -> Optional[Conflict]:
        """
        Detect if time slot is at full capacity

        Returns:
            Conflict if slot is full, None otherwise
        """
        if schedule.max_appointments_per_slot <= 1:
            return None  # Single appointment per slot, handled by time overlap check

        start_datetime = datetime.combine(appointment_date, appointment_time)

        # Count appointments at this exact time
        count = db.session.query(Encounter).filter(
            Encounter.provider_id == provider_id,
            Encounter.start_time == start_datetime,
            Encounter.status.in_(['scheduled', 'confirmed', 'in-progress'])
        ).count()

        if count >= schedule.max_appointments_per_slot:
            return Conflict(
                conflict_type=ConflictType.SLOT_FULL,
                severity=ConflictSeverity.MEDIUM,
                message=f"Time slot full ({count}/{schedule.max_appointments_per_slot})",
                details={
                    'current_count': count,
                    'max_capacity': schedule.max_appointments_per_slot
                }
            )

        return None
