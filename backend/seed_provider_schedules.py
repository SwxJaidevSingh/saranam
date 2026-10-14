"""
Seed Provider Schedules
Creates default schedules for all active providers
"""
import sys
from datetime import time
from app import create_app
from app.extensions import db
from app.providers.models import HealthcareProvider, ProviderSchedule

def seed_provider_schedules():
    """Add default schedules to all providers without schedules"""
    app = create_app()

    with app.app_context():
        # Get all active providers
        providers = HealthcareProvider.query.filter_by(is_active=True).all()

        print(f"Found {len(providers)} active providers")

        # Default schedule: Monday to Friday, 9 AM to 5 PM
        default_schedule = [
            # Monday
            {
                'day_of_week': 0,  # Monday
                'start_time': time(9, 0),
                'end_time': time(17, 0),
                'is_active': True
            },
            # Tuesday
            {
                'day_of_week': 1,  # Tuesday
                'start_time': time(9, 0),
                'end_time': time(17, 0),
                'is_active': True
            },
            # Wednesday
            {
                'day_of_week': 2,  # Wednesday
                'start_time': time(9, 0),
                'end_time': time(17, 0),
                'is_active': True
            },
            # Thursday
            {
                'day_of_week': 3,  # Thursday
                'start_time': time(9, 0),
                'end_time': time(17, 0),
                'is_active': True
            },
            # Friday
            {
                'day_of_week': 4,  # Friday
                'start_time': time(9, 0),
                'end_time': time(17, 0),
                'is_active': True
            }
        ]

        for provider in providers:
            # Check if provider already has schedules
            existing_schedules = ProviderSchedule.query.filter_by(
                provider_id=provider.id
            ).count()

            if existing_schedules > 0:
                print(f"Provider {provider.full_name} already has {existing_schedules} schedule(s), skipping")
                continue

            # Create schedules for this provider
            print(f"Creating default schedule for {provider.full_name}...")

            for schedule_data in default_schedule:
                schedule = ProviderSchedule(
                    provider_id=provider.id,
                    day_of_week=schedule_data['day_of_week'],
                    start_time=schedule_data['start_time'],
                    end_time=schedule_data['end_time'],
                    is_active=schedule_data['is_active']
                )
                db.session.add(schedule)

            db.session.commit()
            print(f"✓ Created schedule for {provider.full_name}")

        print("\nSchedule seeding complete!")

if __name__ == '__main__':
    seed_provider_schedules()
