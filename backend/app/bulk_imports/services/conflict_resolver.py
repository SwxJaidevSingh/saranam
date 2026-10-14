"""
Conflict Resolver Service
AI-powered appointment conflict resolution
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, time
from uuid import UUID

from app.extensions import db
from app.providers.models import HealthcareProvider
from app.providers.models import ProviderSchedule
from app.encounters.models import Encounter
from app.bulk_imports.models import BulkImportItem
from app.bulk_imports.services.llm_service import LLMService


logger = logging.getLogger(__name__)


class ConflictResolverService:
    """
    Service for resolving appointment scheduling conflicts using AI
    """

    def __init__(self, llm_provider: str = 'openai', llm_api_key: Optional[str] = None, llm_model: Optional[str] = None):
        """Initialize conflict resolver"""
        self.llm_service = LLMService(provider=llm_provider, api_key=llm_api_key, model_name=llm_model)

    def resolve_conflicts(
        self,
        items: List[BulkImportItem],
        auto_resolve: bool = True
    ) -> Dict[str, Any]:
        """
        Resolve conflicts for a list of import items

        Args:
            items: List of items with conflicts
            auto_resolve: Whether to auto-apply AI suggestions

        Returns:
            Resolution results
        """
        results = {
            'total_conflicts': len(items),
            'auto_resolved': 0,
            'manual_required': 0,
            'suggestions': []
        }

        for item in items:
            if not item.has_conflict:
                continue

            try:
                # Get AI suggestions
                suggestions = self._get_conflict_suggestions(item)

                if suggestions and suggestions.get('suggestions'):
                    # Store AI suggestions
                    item.ai_suggestions = suggestions

                    if auto_resolve and suggestions['suggestions']:
                        # Auto-accept best suggestion
                        best_suggestion = suggestions['suggestions'][0]
                        self._apply_suggestion(item, best_suggestion)
                        results['auto_resolved'] += 1
                    else:
                        results['manual_required'] += 1

                    results['suggestions'].append({
                        'item_id': str(item.id),
                        'row': item.row_number,
                        'suggestions': suggestions
                    })

            except Exception as e:
                logger.error(f"Error resolving conflict for item {item.id}: {str(e)}")
                results['manual_required'] += 1

        db.session.commit()
        return results

    def _get_conflict_suggestions(self, item: BulkImportItem) -> Dict:
        """
        Get AI-powered suggestions for resolving a conflict

        Args:
            item: Import item with conflict

        Returns:
            Suggestions dictionary
        """
        if not item.provider_id:
            return {'suggestions': [], 'recommendation': 'No provider assigned'}

        # Get provider's schedule
        provider = HealthcareProvider.query.get(item.provider_id)
        if not provider:
            return {'suggestions': [], 'recommendation': 'Provider not found'}

        # Get requested time
        data = item.extracted_data
        requested_date = self._parse_date(data.get('appointment_date'))
        requested_time = self._parse_time(data.get('appointment_time'))

        if not requested_date or not requested_time:
            return {'suggestions': [], 'recommendation': 'Invalid date/time'}

        requested_datetime = datetime.combine(requested_date, requested_time)
        duration = data.get('duration_minutes', 30)

        # Find available slots near requested time
        available_slots = self._find_available_slots(
            provider_id=item.provider_id,
            requested_datetime=requested_datetime,
            duration=duration,
            search_window_hours=48  # Search 48 hours around requested time
        )

        if not available_slots:
            return {
                'suggestions': [],
                'recommendation': 'No available slots found within 48 hours'
            }

        # Format suggestions for LLM
        conflict_info = {
            'requested_time': requested_datetime.isoformat(),
            'duration_minutes': duration,
            'provider_name': provider.full_name,
            'available_slots': [
                {
                    'datetime': slot['datetime'].isoformat(),
                    'time_diff_minutes': slot['time_diff_minutes']
                }
                for slot in available_slots[:10]  # Top 10 slots
            ]
        }

        # Get provider schedule context
        schedule_context = self._get_provider_schedule_context(provider, requested_date)

        # Use LLM to suggest best options
        try:
            ai_response = self.llm_service.suggest_conflict_resolution(
                conflict_details=conflict_info,
                provider_schedule=schedule_context
            )

            # Enhance with actual slot data
            enhanced_suggestions = []
            for i, ai_sug in enumerate(ai_response.get('suggestions', [])[:3]):
                if i < len(available_slots):
                    slot = available_slots[i]
                    enhanced_suggestions.append({
                        'datetime': slot['datetime'].isoformat(),
                        'date': slot['datetime'].date().isoformat(),
                        'time': slot['datetime'].time().strftime('%H:%M'),
                        'time_diff_minutes': slot['time_diff_minutes'],
                        'reason': ai_sug.get('reason', 'Closest available slot'),
                        'confidence': ai_sug.get('confidence', 0.8)
                    })

            return {
                'suggestions': enhanced_suggestions,
                'recommendation': ai_response.get('recommendation', 'Accept first suggestion')
            }

        except Exception as e:
            logger.error(f"LLM suggestion error: {str(e)}")
            # Fallback to simple suggestions
            return {
                'suggestions': [
                    {
                        'datetime': slot['datetime'].isoformat(),
                        'date': slot['datetime'].date().isoformat(),
                        'time': slot['datetime'].time().strftime('%H:%M'),
                        'time_diff_minutes': slot['time_diff_minutes'],
                        'reason': 'Closest available slot',
                        'confidence': 1.0 - (i * 0.1)
                    }
                    for i, slot in enumerate(available_slots[:3])
                ],
                'recommendation': 'Accept closest time slot'
            }

    def _find_available_slots(
        self,
        provider_id: UUID,
        requested_datetime: datetime,
        duration: int,
        search_window_hours: int = 48
    ) -> List[Dict]:
        """
        Find available appointment slots near requested time

        Args:
            provider_id: Provider ID
            requested_datetime: Requested appointment time
            duration: Appointment duration in minutes
            search_window_hours: Hours to search before/after

        Returns:
            List of available slots with time differences
        """
        available_slots = []

        # Search window
        search_start = requested_datetime - timedelta(hours=search_window_hours)
        search_end = requested_datetime + timedelta(hours=search_window_hours)

        # Get provider schedule
        provider = HealthcareProvider.query.get(provider_id)
        schedules = ProviderSchedule.query.filter_by(
            provider_id=provider_id,
            is_active=True
        ).all()

        if not schedules:
            # No schedule defined, can't suggest slots
            return []

        # Get existing appointments in search window
        existing_appointments = Encounter.query.filter(
            Encounter.provider_id == provider_id,
            Encounter.start_time >= search_start,
            Encounter.start_time <= search_end,
            Encounter.status.in_(['scheduled', 'confirmed', 'in-progress'])
        ).all()

        # Build occupied time ranges
        occupied_ranges = [
            (appt.start_time, appt.end_time)
            for appt in existing_appointments
        ]

        # Check each day in search window
        current_date = search_start.date()
        while current_date <= search_end.date():
            day_of_week = current_date.weekday()  # 0=Monday, 6=Sunday

            # Find schedule for this day
            day_schedule = next(
                (s for s in schedules if s.day_of_week == day_of_week),
                None
            )

            if not day_schedule:
                current_date += timedelta(days=1)
                continue

            # Generate slots for this day
            slot_time = datetime.combine(current_date, day_schedule.start_time)
            end_time = datetime.combine(current_date, day_schedule.end_time)

            while slot_time + timedelta(minutes=duration) <= end_time:
                # Skip if in break time
                if day_schedule.break_start_time and day_schedule.break_end_time:
                    if (day_schedule.break_start_time <= slot_time.time() < day_schedule.break_end_time):
                        slot_time += timedelta(minutes=day_schedule.slot_duration)
                        continue

                # Check if slot is available
                slot_end = slot_time + timedelta(minutes=duration)
                is_available = True

                for occupied_start, occupied_end in occupied_ranges:
                    # Check for overlap
                    if slot_time < occupied_end and slot_end > occupied_start:
                        is_available = False
                        break

                if is_available and slot_time >= datetime.now():
                    # Calculate time difference from requested time
                    time_diff = abs((slot_time - requested_datetime).total_seconds() / 60)

                    available_slots.append({
                        'datetime': slot_time,
                        'time_diff_minutes': int(time_diff)
                    })

                slot_time += timedelta(minutes=day_schedule.slot_duration)

            current_date += timedelta(days=1)

        # Sort by time difference (closest first)
        available_slots.sort(key=lambda x: x['time_diff_minutes'])

        return available_slots

    def _get_provider_schedule_context(
        self,
        provider: HealthcareProvider,
        date: datetime.date
    ) -> Dict:
        """Get provider schedule context for LLM"""
        schedules = ProviderSchedule.query.filter_by(
            provider_id=provider.id,
            is_active=True
        ).all()

        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        schedule_info = {}
        for schedule in schedules:
            day_name = days[schedule.day_of_week]
            schedule_info[day_name] = {
                'start_time': schedule.start_time.strftime('%H:%M'),
                'end_time': schedule.end_time.strftime('%H:%M'),
                'break': f"{schedule.break_start_time.strftime('%H:%M')}-{schedule.break_end_time.strftime('%H:%M')}"
                    if schedule.break_start_time else None
            }

        return {
            'provider_name': provider.full_name,
            'specialization': provider.specialization,
            'default_duration': provider.default_consultation_duration,
            'weekly_schedule': schedule_info
        }

    def _apply_suggestion(self, item: BulkImportItem, suggestion: Dict):
        """Apply AI suggestion to resolve conflict"""
        item.resolve_conflict(
            action='accepted_suggestion',
            resolution_data={
                'new_datetime': suggestion['datetime'],
                'new_date': suggestion['date'],
                'new_time': suggestion['time'],
                'reason': suggestion.get('reason'),
                'time_diff_minutes': suggestion.get('time_diff_minutes')
            }
        )

    def _parse_date(self, date_str: str) -> Optional[datetime.date]:
        """Parse date from string"""
        from dateutil import parser
        try:
            return parser.parse(date_str).date()
        except:
            return None

    def _parse_time(self, time_str: str) -> Optional[datetime.time]:
        """Parse time from string"""
        from dateutil import parser
        try:
            return parser.parse(time_str).time()
        except:
            return None

    def manually_resolve_conflict(
        self,
        item_id: UUID,
        resolution_action: str,
        resolution_data: Optional[Dict] = None
    ) -> BulkImportItem:
        """
        Manually resolve a conflict

        Args:
            item_id: Import item ID
            resolution_action: Action (accepted_suggestion, manual_override, skipped)
            resolution_data: Resolution data (new time, etc.)

        Returns:
            Updated item
        """
        item = BulkImportItem.query.get(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        item.resolve_conflict(resolution_action, resolution_data)
        db.session.commit()

        return item
