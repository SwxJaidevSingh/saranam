#!/usr/bin/env python
"""
Seed script to initialize healthcare services in the database
"""

from app import create_app
from app.extensions import db
from app.services.models import Service, ServiceType
from app.services.services import ServiceService
import sys


def seed_services():
    """Create initial healthcare services"""

    # Define the services to create
    services_data = [
        {
            'name': 'In-Patient Department (IPD)',
            'service_type': 'IPD',
            'description': 'Comprehensive in-patient care services including admission, bed allocation, daily monitoring, nursing care, and discharge planning.',
            'department': 'In-Patient Services',
            'is_active': True,
            'requires_admission': True,
            'requires_referral': False,
            'default_duration_minutes': 1440,  # 24 hours (daily care)
            'max_daily_capacity': 100,  # Max beds/patients
            'base_cost': 5000.00,
            'settings': {
                'requires_bed': True,
                'requires_24x7_monitoring': True,
                'min_stay_hours': 24,
                'requires_discharge_summary': True,
                'requires_consent': True
            }
        },
        {
            'name': 'Out-Patient Department (OPD)',
            'service_type': 'OPD',
            'description': 'General consultation and treatment services for walk-in and appointment-based patients. Includes diagnosis, prescription, and follow-up care.',
            'department': 'Out-Patient Services',
            'is_active': True,
            'requires_admission': False,
            'requires_referral': False,
            'default_duration_minutes': 30,  # Standard consultation
            'max_daily_capacity': 200,  # Max consultations per day
            'base_cost': 500.00,
            'settings': {
                'allows_walk_in': True,
                'requires_registration': True,
                'follow_up_days': 7,
                'prescription_enabled': True
            }
        },
        {
            'name': 'Physiotherapy',
            'service_type': 'PHYSIOTHERAPY',
            'description': 'Physical therapy and rehabilitation services including assessment, treatment planning, therapeutic exercises, manual therapy, and progress monitoring.',
            'department': 'Rehabilitation Services',
            'is_active': True,
            'requires_admission': False,
            'requires_referral': True,
            'default_duration_minutes': 45,  # Standard session
            'max_daily_capacity': 50,  # Max sessions per day
            'base_cost': 800.00,
            'settings': {
                'requires_assessment': True,
                'sessions_per_week': 3,
                'min_sessions': 6,
                'max_sessions': 24,
                'equipment_required': ['Exercise mat', 'Resistance bands', 'Parallel bars'],
                'requires_progress_tracking': True
            }
        },
        {
            'name': 'Home Care Services',
            'service_type': 'HOME_CARE',
            'description': 'Comprehensive home healthcare services including nursing care, medical procedures, medication administration, and health monitoring at patient\'s residence.',
            'department': 'Home Healthcare',
            'is_active': True,
            'requires_admission': False,
            'requires_referral': False,
            'default_duration_minutes': 120,  # Standard home visit
            'max_daily_capacity': 30,  # Max home visits per day
            'base_cost': 1500.00,
            'settings': {
                'requires_address': True,
                'requires_caregiver_present': True,
                'services_offered': ['Nursing care', 'Wound dressing', 'Injection', 'Sample collection', 'Vital monitoring'],
                'equipment_provided': ['BP monitor', 'Glucometer', 'Pulse oximeter'],
                'emergency_support': True,
                'min_distance_km': 0,
                'max_distance_km': 50
            }
        }
    ]

    created_services = []
    errors = []

    for service_data in services_data:
        try:
            # Check if service already exists
            existing = db.session.query(Service).filter(
                Service.name == service_data['name']
            ).first()

            if existing:
                print(f"Service '{service_data['name']}' already exists. Skipping...")
                continue

            # Create the service
            service = Service(
                name=service_data['name'],
                service_type=ServiceType[service_data['service_type']],
                description=service_data['description'],
                department=service_data['department'],
                is_active=service_data['is_active'],
                requires_admission=service_data['requires_admission'],
                requires_referral=service_data['requires_referral'],
                default_duration_minutes=service_data['default_duration_minutes'],
                max_daily_capacity=service_data['max_daily_capacity'],
                base_cost=service_data['base_cost'],
                cost_currency='INR',
                settings=service_data['settings']
            )

            db.session.add(service)
            created_services.append(service_data['name'])
            print(f"✓ Created service: {service_data['name']}")

        except Exception as e:
            errors.append(f"Error creating {service_data['name']}: {str(e)}")
            print(f"✗ Failed to create {service_data['name']}: {str(e)}")

    # Commit all services
    if created_services:
        try:
            db.session.commit()
            print(f"\n✓ Successfully created {len(created_services)} services")
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Failed to commit services: {str(e)}")
            return False

    # Create default schedules for each service (Monday-Saturday, 9 AM - 6 PM)
    print("\nCreating default schedules...")

    services = db.session.query(Service).filter(
        Service.service_type.in_([ServiceType.OPD, ServiceType.PHYSIOTHERAPY])
    ).all()

    for service in services:
        # Create schedule for Monday to Saturday
        for day in range(6):  # 0-5 (Monday to Saturday)
            try:
                from app.services.models import ServiceSchedule
                from datetime import time

                schedule = ServiceSchedule(
                    service_id=service.id,
                    day_of_week=day,
                    start_time=time(9, 0),  # 9:00 AM
                    end_time=time(18, 0),   # 6:00 PM
                    max_capacity=service.max_daily_capacity // 10 if service.max_daily_capacity else 10,
                    buffer_minutes=5,
                    break_times=[
                        {'start': '13:00', 'end': '14:00'}  # Lunch break
                    ],
                    is_active=True
                )
                db.session.add(schedule)

            except Exception as e:
                print(f"Failed to create schedule for {service.name} on day {day}: {str(e)}")

    # IPD and Home Care have 24x7 availability
    services_24x7 = db.session.query(Service).filter(
        Service.service_type.in_([ServiceType.IPD, ServiceType.HOME_CARE])
    ).all()

    for service in services_24x7:
        # Create schedule for all days
        for day in range(7):  # 0-6 (Monday to Sunday)
            try:
                from app.services.models import ServiceSchedule
                from datetime import time

                schedule = ServiceSchedule(
                    service_id=service.id,
                    day_of_week=day,
                    start_time=time(0, 0),   # Midnight
                    end_time=time(23, 59),   # 11:59 PM
                    max_capacity=service.max_daily_capacity if service.max_daily_capacity else 50,
                    buffer_minutes=0,
                    break_times=[],
                    is_active=True
                )
                db.session.add(schedule)

            except Exception as e:
                print(f"Failed to create 24x7 schedule for {service.name}: {str(e)}")

    try:
        db.session.commit()
        print("✓ Default schedules created successfully")
    except Exception as e:
        db.session.rollback()
        print(f"✗ Failed to create schedules: {str(e)}")

    # Print summary
    print("\n" + "="*50)
    print("SEED SERVICES SUMMARY")
    print("="*50)

    if created_services:
        print(f"✓ Created {len(created_services)} services:")
        for name in created_services:
            print(f"  - {name}")

    if errors:
        print(f"\n✗ {len(errors)} errors occurred:")
        for error in errors:
            print(f"  - {error}")

    # Display all services
    print("\n" + "="*50)
    print("ALL ACTIVE SERVICES IN DATABASE")
    print("="*50)

    all_services = db.session.query(Service).filter(Service.is_active == True).all()
    for service in all_services:
        print(f"\n{service.service_type.value}: {service.name}")
        print(f"  Department: {service.department}")
        print(f"  Duration: {service.default_duration_minutes} minutes")
        print(f"  Capacity: {service.max_daily_capacity} per day")
        print(f"  Base Cost: ₹{service.base_cost}")
        if service.requires_admission:
            print(f"  ⚠ Requires Admission")
        if service.requires_referral:
            print(f"  ⚠ Requires Referral")

    return True


def main():
    """Main function"""
    app = create_app('development')

    with app.app_context():
        print("Seeding services...")
        success = seed_services()

        if success:
            print("\n✅ Service seeding completed successfully!")
            return 0
        else:
            print("\n❌ Service seeding failed!")
            return 1


if __name__ == '__main__':
    sys.exit(main())