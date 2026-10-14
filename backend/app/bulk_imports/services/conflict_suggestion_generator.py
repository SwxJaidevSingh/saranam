"""
Conflict Suggestion Generator
Pure logic - generates alternative time slots for conflicts
"""

from datetime import datetime, date, time, timedelta
from typing import Dict, List, Optional
from uuid import UUID
import logging

from app.extensions import db
from app.providers.models import HealthcareProvider, ProviderSchedule
from app.encounters.models import Encounter
from app.providers.schedule_services import ProviderScheduleService

logger = logging.getLogger(__name__)


class AlternativeSuggestion:
    """Structured alternative suggestion"""
    def __init__(self, suggestion_type: str, date_value: date, time_value: time,
                 provider_id: UUID = None, provider_name: str = None, reason: str = None):
        self.type = suggestion_type  # 'same_day', 'next_day', 'alternative_provider'
        self.date = date_value
        self.time = time_value
        self.provider_id = provider_id
        self.provider_name = provider_name
        self.reason = reason

    def to_dict(self):
        return {
            'type': self.type,
            'date': self.date.isoformat(),
            'time': self.time.strftime('%H:%M'),
            'provider_id': str(self.provider_id) if self.provider_id else None,
            'provider_name': self.provider_name,
            'reason': self.reason
        }


class ConflictSuggestionGenerator:
    """Generates alternative suggestions for conflicting appointments"""

    @staticmethod
    def generate_suggestions(
        provider_id: UUID,
        requested_date: date,
        requested_time: time,
        duration_minutes: int,
        conflict_types: List[str],
        max_suggestions: int = 5
    ) -> List[AlternativeSuggestion]:
        """
        Generate alternative slot suggestions

        Args:
            provider_id: Provider UUID
            requested_date: Original requested date
            requested_time: Original requested time
            duration_minutes: Appointment duration
            conflict_types: List of conflict types encountered
            max_suggestions: Maximum number of suggestions to return

        Returns:
            List of alternative suggestions
        """
        suggestions = []

        # Get provider and schedule info
        provider = db.session.query(HealthcareProvider).get(provider_id)
        if not provider:
            return suggestions

        # Strategy 1: Same day, next available slot
        same_day_suggestions = ConflictSuggestionGenerator._find_same_day_slots(
            provider_id, requested_date, requested_time, duration_minutes
        )
        suggestions.extend(same_day_suggestions[:2])  # Top 2

        # Strategy 2: Next working day, same time
        if len(suggestions) < max_suggestions:
            next_day_suggestion = ConflictSuggestionGenerator._find_next_day_same_time(
                provider_id, requested_date, requested_time, duration_minutes
            )
            if next_day_suggestion:
                suggestions.append(next_day_suggestion)

        # Strategy 3: Same day, alternative provider (if applicable)
        if len(suggestions) < max_suggestions and provider.specialization:
            alt_provider_suggestions = ConflictSuggestionGenerator._find_alternative_providers(
                provider.specialization, requested_date, requested_time, duration_minutes, provider_id
            )
            suggestions.extend(alt_provider_suggestions[:2])  # Top 2

        return suggestions[:max_suggestions]

    @staticmethod
    def _find_same_day_slots(
        provider_id: UUID,
        target_date: date,
        requested_time: time,
        duration_minutes: int
    ) -> List[AlternativeSuggestion]:
        """Find available slots on the same day"""
        suggestions = []

        try:
            # Get available slots for the day
            availability_data = ProviderScheduleService.get_available_slots(
                provider_id=provider_id,
                date_str=target_date.isoformat(),
                duration=duration_minutes
            )

            if not availability_data.get('provider_works_today'):
                return suggestions

            slots = availability_data.get('slots', [])

            # Filter to slots after the requested time
            requested_datetime = datetime.combine(target_date, requested_time)

            for slot in slots:
                if not slot.get('is_available'):
                    continue

                slot_time_str = slot.get('start_time')
                slot_time = datetime.strptime(slot_time_str, '%H:%M:%S').time()
                slot_datetime = datetime.combine(target_date, slot_time)

                # Only suggest slots after the requested time
                if slot_datetime >= requested_datetime:
                    provider = db.session.query(HealthcareProvider).get(provider_id)
                    suggestion = AlternativeSuggestion(
                        suggestion_type='same_day',
                        date_value=target_date,
                        time_value=slot_time,
                        provider_id=provider_id,
                        provider_name=provider.full_name if provider else None,
                        reason=f'Next available slot today'
                    )
                    suggestions.append(suggestion)

                    # Only return first few
                    if len(suggestions) >= 2:
                        break

        except Exception as e:
            logger.error(f"Error finding same day slots: {str(e)}")

        return suggestions

    @staticmethod
    def _find_next_day_same_time(
        provider_id: UUID,
        current_date: date,
        requested_time: time,
        duration_minutes: int
    ) -> Optional[AlternativeSuggestion]:
        """Find same time on next working day"""
        try:
            # Get provider's schedule
            provider = db.session.query(HealthcareProvider).get(provider_id)
            if not provider:
                return None

            # Check next 14 days
            for days_ahead in range(1, 15):
                check_date = current_date + timedelta(days=days_ahead)
                day_of_week = check_date.weekday()

                # Check if provider works on this day
                schedule = db.session.query(ProviderSchedule).filter(
                    ProviderSchedule.provider_id == provider_id,
                    ProviderSchedule.day_of_week == day_of_week,
                    ProviderSchedule.is_active == True
                ).first()

                if not schedule:
                    continue

                # Check if time is within working hours
                appointment_end = (datetime.combine(date.today(), requested_time) +
                                   timedelta(minutes=duration_minutes)).time()

                if requested_time < schedule.start_time or appointment_end > schedule.end_time:
                    continue

                # Check if slot is available
                availability_data = ProviderScheduleService.get_available_slots(
                    provider_id=provider_id,
                    date_str=check_date.isoformat(),
                    duration=duration_minutes
                )

                slots = availability_data.get('slots', [])
                requested_time_str = requested_time.strftime('%H:%M:%S')

                for slot in slots:
                    if slot.get('start_time') == requested_time_str and slot.get('is_available'):
                        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                        return AlternativeSuggestion(
                            suggestion_type='next_day',
                            date_value=check_date,
                            time_value=requested_time,
                            provider_id=provider_id,
                            provider_name=provider.full_name,
                            reason=f'Same time, next {day_names[day_of_week]} ({check_date.strftime("%b %d")})'
                        )

        except Exception as e:
            logger.error(f"Error finding next day slot: {str(e)}")

        return None

    @staticmethod
    def _find_alternative_providers(
        specialization: str,
        target_date: date,
        requested_time: time,
        duration_minutes: int,
        exclude_provider_id: UUID
    ) -> List[AlternativeSuggestion]:
        """Find alternative providers with same specialization"""
        suggestions = []

        try:
            # Find providers with same specialization
            alt_providers = db.session.query(HealthcareProvider).filter(
                HealthcareProvider.specialization == specialization,
                HealthcareProvider.id != exclude_provider_id,
                HealthcareProvider.is_active == True,
                HealthcareProvider.accepts_new_patients == True
            ).limit(5).all()

            for provider in alt_providers:
                try:
                    # Check if provider is available at this time
                    availability_data = ProviderScheduleService.get_available_slots(
                        provider_id=provider.id,
                        date_str=target_date.isoformat(),
                        duration=duration_minutes
                    )

                    if not availability_data.get('provider_works_today'):
                        continue

                    slots = availability_data.get('slots', [])
                    requested_time_str = requested_time.strftime('%H:%M:%S')

                    for slot in slots:
                        if slot.get('start_time') == requested_time_str and slot.get('is_available'):
                            suggestion = AlternativeSuggestion(
                                suggestion_type='alternative_provider',
                                date_value=target_date,
                                time_value=requested_time,
                                provider_id=provider.id,
                                provider_name=provider.full_name,
                                reason=f'Same time with {provider.full_name} ({specialization})'
                            )
                            suggestions.append(suggestion)
                            break

                    if len(suggestions) >= 2:
                        break

                except Exception as e:
                    logger.error(f"Error checking provider {provider.id}: {str(e)}")
                    continue

        except Exception as e:
            logger.error(f"Error finding alternative providers: {str(e)}")

        return suggestions
