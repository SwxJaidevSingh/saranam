"""Test database connection and verify seeded data."""
from app import create_app
from app.extensions import db
from app.common.models import User
from app.forms.models import Form

app = create_app()

with app.app_context():
    print("Testing database connection...")

    # Check users
    users = User.query.all()
    print(f"\nFound {len(users)} users in database:")
    for u in users:
        print(f"  - {u.email} ({u.role})")

    # Check forms
    forms = Form.query.all()
    print(f"\nFound {len(forms)} forms in database:")
    for f in forms:
        print(f"  - {f.name}")

    print("\n✅ Database connection successful!")