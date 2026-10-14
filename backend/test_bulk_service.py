from app import create_app
from app.bulk_imports.services.bulk_appointment_service import BulkAppointmentService
from app.common.models import User

app = create_app()
with app.app_context():
    # Attempt to load the service to verify imports
    print("Imports successful!")
    # To test actual initialization, we need a test user. Let's just check if it imports cleanly first.
