from typing import Dict, List
from sqlalchemy import func, case
from datetime import datetime, timedelta
from app.models import Encounter, HealthcareProvider, ProviderSchedule
from app.extensions import db

class ProviderAnalyticsService:
    @staticmethod
    def get_provider_utilization() -> List[Dict]:
        """
        Calculate utilization rates for each provider.
        Utilization = (Booked Hours / Available Hours)
        """
        # Get all providers
        providers = HealthcareProvider.query.filter(HealthcareProvider.is_active == True).all()
        
        results = []
        for provider in providers:
            # Calculate weekly available hours from schedule
            schedules = ProviderSchedule.query.filter_by(provider_id=provider.id, is_active=True).all()
            total_available_minutes = 0
            for s in schedules:
                if s.start_time and s.end_time:
                    # Simple calculation of hours between start and end
                    start = datetime.combine(datetime.today(), s.start_time)
                    end = datetime.combine(datetime.today(), s.end_time)
                    duration = (end - start).seconds / 60
                    total_available_minutes += duration
            
            # Calculate booked minutes in the last 7 days
            last_week = datetime.utcnow() - timedelta(days=7)
            booked_encounters = Encounter.query.filter(
                Encounter.provider_id == provider.id,
                Encounter.start_time >= last_week,
                Encounter.status.in_(['scheduled', 'in-progress', 'completed'])
            ).all()
            
            total_booked_minutes = 0
            for enc in booked_encounters:
                # Use default duration if end_time is not set
                if enc.end_time and enc.start_time:
                    duration = (enc.end_time - enc.start_time).seconds / 60
                else:
                    duration = provider.default_consultation_duration or 30
                total_booked_minutes += duration
            
            # Weekly calculation (adjusting availability to 1 week)
            utilization = (total_booked_minutes / total_available_minutes * 100) if total_available_minutes > 0 else 0
            
            results.append({
                'provider_id': str(provider.id),
                'provider_name': provider.full_name,
                'specialization': provider.specialization,
                'utilization_rate': round(utilization, 1),
                'total_booked_hours': round(total_booked_minutes / 60, 1),
                'total_available_hours': round(total_available_minutes / 60, 1)
            })
            
        return sorted(results, key=lambda x: x['utilization_rate'], reverse=True)

    @staticmethod
    def get_no_show_metrics() -> Dict:
        """
        Calculate appointment no-show rates.
        """
        total_appointments = db.session.query(func.count(Encounter.id)).filter(
            Encounter.status.in_(['completed', 'no-show'])
        ).scalar() or 0
        
        no_shows = db.session.query(func.count(Encounter.id)).filter(
            Encounter.status == 'no-show'
        ).scalar() or 0
        
        # Breakdown by provider
        provider_no_shows = db.session.query(
            HealthcareProvider.full_name,
            func.count(Encounter.id).label('no_show_count')
        ).join(Encounter, Encounter.provider_id == HealthcareProvider.id).filter(
            Encounter.status == 'no-show'
        ).group_by(HealthcareProvider.full_name).all()

        return {
            'total_no_shows': no_shows,
            'no_show_rate': round((no_shows / total_appointments * 100), 1) if total_appointments > 0 else 0,
            'by_provider': [
                {'name': r.full_name, 'count': r.no_show_count}
                for r in provider_no_shows
            ]
        }

    @staticmethod
    def get_average_wait_times() -> List[Dict]:
        """
        Calculate average wait times (check-in to start_time).
        """
        # Filter encounters that have both checked_in_at and start_time
        # In OPD context, wait time is often checked_in_at versus actual start
        wait_times = db.session.query(
            HealthcareProvider.full_name,
            func.avg(
                func.extract('epoch', Encounter.start_time) - 
                func.extract('epoch', Encounter.checked_in_at)
            ).label('avg_wait_seconds')
        ).join(Encounter, Encounter.provider_id == HealthcareProvider.id).filter(
            Encounter.checked_in_at != None,
            Encounter.start_time >= Encounter.checked_in_at
        ).group_by(HealthcareProvider.full_name).all()

        return [
            {
                'provider_name': r.full_name,
                'avg_wait_minutes': round(max(0, r.avg_wait_seconds / 60), 1)
            }
            for r in wait_times
        ]
