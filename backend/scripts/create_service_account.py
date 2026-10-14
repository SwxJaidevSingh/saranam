"""
Script to create a service account for Health Screening integration.

This script creates a dedicated service account user with an API key
for the Health Screening system to authenticate with CV Raman.

Usage:
    python scripts/create_service_account.py
"""
import sys
import os
import secrets

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.extensions import db
from app.common.models import User


def generate_api_key():
    """Generate a secure random API key."""
    return f"cvr_{''.join(secrets.token_urlsafe(32))}"


def create_service_account():
    """Create the Health Screening service account."""
    app = create_app()

    with app.app_context():
        # Check if service account already exists
        email = 'healthscreening_sync@system'
        existing = User.query.filter_by(email=email).first()

        if existing:
            print(f"\n❌ Service account already exists: {email}")
            print(f"User ID: {existing.id}")
            print(f"Role: {existing.role}")
            print(f"Active: {existing.is_active}")

            # Ask if user wants to regenerate API key
            response = input("\nRegenerate API key for this account? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("Aborted.")
                return

            user = existing
            print("\nRegenerating API key...")
        else:
            # Create new service account
            user = User(
                email=email,
                full_name='Health Screening Sync Service',
                role='data_entry',  # Has permissions to submit forms and create patients
                is_active=True,
                is_approved=True  # Pre-approved service account
            )

            # Set a secure password (not used for API key auth, but required by model)
            secure_password = secrets.token_urlsafe(32)
            user.set_password(secure_password)

            print(f"\n✅ Creating new service account: {email}")

        # Generate and set API key
        api_key = generate_api_key()
        user.set_api_key(api_key)

        # Save to database
        if not existing:
            db.session.add(user)

        db.session.commit()

        # Print results
        print("\n" + "="*70)
        print("✅ SERVICE ACCOUNT CREATED SUCCESSFULLY")
        print("="*70)
        print(f"\nEmail:    {user.email}")
        print(f"User ID:  {user.id}")
        print(f"Role:     {user.role}")
        print(f"Active:   {user.is_active}")
        print(f"\n🔑 API KEY (SAVE THIS - IT WON'T BE SHOWN AGAIN):")
        print("-" * 70)
        print(f"{api_key}")
        print("-" * 70)

        print("\n📝 CONFIGURATION INSTRUCTIONS:")
        print("-" * 70)
        print("\n1. Add to offlineappmiddleware .env file:")
        print(f"\n   CV_RAMAN_API_URL=http://localhost:5002")
        print(f"   CV_RAMAN_API_KEY={api_key}")
        print(f"   CV_RAMAN_SYNC_ENABLED=true")

        print("\n2. Test authentication:")
        print(f"\n   curl -X POST http://localhost:5002/api/external/auth/token \\")
        print(f"        -H 'X-API-Key: {api_key}'")

        print("\n3. Use the returned JWT token for subsequent API calls:")
        print(f"\n   curl -X GET http://localhost:5002/api/external/forms \\")
        print(f"        -H 'Authorization: Bearer <token>'")

        print("\n" + "="*70)
        print("\n✅ Setup complete! The service account is ready to use.")
        print("="*70 + "\n")


if __name__ == '__main__':
    try:
        create_service_account()
    except Exception as e:
        print(f"\n❌ Error creating service account: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
