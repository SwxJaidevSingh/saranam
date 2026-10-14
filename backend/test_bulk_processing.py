import os
import sys
from app import create_app
from app.extensions import db
from app.bulk_imports.services.bulk_appointment_service import BulkAppointmentService
from app.common.models import User

app = create_app()

with app.app_context():
    user = User.query.first()
    if not user:
        print("No user found in DB. Test cannot proceed without a test user.")
        sys.exit(1)
        
    print(f"Using user {user.id}")
    svc = BulkAppointmentService(user_id=user.id, llm_provider='openai')

    print("\n--- BASE APPOINTMENTS TEST ---")
    file_path = "/Users/farzanmanzer/CV Health/cv-raman-health/features/bulk-appointments-ai/examples/sample-appointments.csv"
    try:
        session = svc.process_file_upload(file_path, "sample-appointments.csv", "csv")
        print(f"Session Created: {session.id}")
        session = svc.extract_appointments(session.id)
        print(f"Extracted Appts: {len(session.import_items)}")
        
        session = svc.validate_appointments(session.id)
        print(f"Valid: {session.valid_count}, Conflicts: {session.conflict_count}, Errs: {len(session.validation_summary['errors'])}")
    except Exception as e:
        print(f"Error testing base appointments: {e}")

    print("\n--- SERVICE BOOKINGS TEST ---")
    file_path = "/Users/farzanmanzer/CV Health/cv-raman-health/features/bulk-appointments-ai/examples/sample-service-bookings.csv"
    try:
        session = svc.process_file_upload(file_path, "sample-service-bookings.csv", "csv")
        print(f"Session Created: {session.id}")
        session = svc.extract_appointments(session.id)
        print(f"Extracted Appts: {len(session.import_items)}")
        
        session = svc.validate_appointments(session.id)
        print(f"Valid: {session.valid_count}, Conflicts: {session.conflict_count}, Errs: {len(session.validation_summary['errors'])}")
    except Exception as e:
        print(f"Error testing service bookings: {e}")

