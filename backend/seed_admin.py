#!/usr/bin/env python
"""
Create an admin user for testing
"""

from app import create_app
from app.extensions import db
from app.common.models import User


def create_admin_user():
    """Create admin user if not exists"""
    app = create_app('development')

    with app.app_context():
        # Check if admin exists
        admin = db.session.query(User).filter(
            User.email == 'admin@cvraman.health'
        ).first()

        if not admin:
            # Create admin user
            admin = User(
                email='admin@cvraman.health',
                full_name='System Administrator',
                role='admin',
                is_active=True
            )
            admin.set_password('Admin@123')  # Use the set_password method
            db.session.add(admin)
            db.session.commit()
            print("✅ Admin user created successfully!")
            print("Email: admin@cvraman.health")
            print("Password: Admin@123")
        else:
            print("Admin user already exists!")
            # Update password in case it's different
            admin.set_password('Admin@123')  # Use the set_password method
            db.session.commit()
            print("✅ Admin password reset to: Admin@123")


if __name__ == '__main__':
    create_admin_user()