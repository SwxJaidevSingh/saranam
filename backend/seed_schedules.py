#!/usr/bin/env python
"""
Seed service schedules for testing
"""

from app import create_app
from app.extensions import db
from app.services.models import Service, ServiceSchedule
from datetime import time
import uuid

app = create_app()

def seed_schedules():
    with app.app_context():
        # Get all services
        services = Service.query.filter_by(is_active=True).all()

        if not services:
            print("No active services found. Please run seed_services.py first.")
            return

        print(f"Found {len(services)} active services")

        # Create schedules for each service
        for service in services:
            print(f"\nCreating schedule for service: {service.name}")

            # Check if schedule already exists
            existing_schedules = ServiceSchedule.query.filter_by(
                service_id=service.id
            ).first()

            if existing_schedules:
                print(f"  Schedule already exists for {service.name}")
                continue

            # Create schedules for Monday to Saturday (0-5)
            for day in range(6):  # Monday=0, Saturday=5
                schedule = ServiceSchedule(
                    id=str(uuid.uuid4()),
                    service_id=service.id,
                    day_of_week=day,
                    start_time=time(9, 0),  # 9:00 AM
                    end_time=time(18, 0),    # 6:00 PM
                    max_capacity=5,          # 5 bookings per slot
                    buffer_minutes=0,        # No buffer between slots
                    break_times=[
                        {"start": "12:00", "end": "13:00"}  # Lunch break
                    ],
                    is_active=True
                )
                db.session.add(schedule)
                print(f"  Added schedule for {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}")

        try:
            db.session.commit()
            print("\n✅ Service schedules seeded successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error seeding schedules: {str(e)}")

if __name__ == '__main__':
    seed_schedules()