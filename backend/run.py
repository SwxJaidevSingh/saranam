"""Flask application entry point."""
import os
from flask_migrate import init, migrate, upgrade
from app import create_app
from app.extensions import db
from app.common.models import User
from app.forms.models import Form
from app.submissions.models import Submission

# Create application
app = create_app(os.environ.get('FLASK_ENV', 'development'))


@app.cli.command()
def init_db():
    """Initialize the database."""
    with app.app_context():
        db.create_all()
        print("Database initialized!")


@app.cli.command()
def seed_db():
    """Seed the database with initial data."""
    with app.app_context():
        # Check if admin exists
        admin = User.query.filter_by(email='admin@cvraman.health').first()
        if not admin:
            # Create admin user
            admin = User(
                email='admin@cvraman.health',
                full_name='System Administrator',
                role='admin'
            )
            admin.set_password('Admin@123')
            db.session.add(admin)

            # Create data entry user
            data_entry = User(
                email='dataentry@cvraman.health',
                full_name='Data Entry User',
                role='data_entry'
            )
            data_entry.set_password('DataEntry@123')
            db.session.add(data_entry)

            # Create viewer user
            viewer = User(
                email='viewer@cvraman.health',
                full_name='Viewer User',
                role='viewer'
            )
            viewer.set_password('Viewer@123')
            db.session.add(viewer)

            db.session.commit()
            print("Default users created:")
            print("  Admin: admin@cvraman.health / Admin@123")
            print("  Data Entry: dataentry@cvraman.health / DataEntry@123")
            print("  Viewer: viewer@cvraman.health / Viewer@123")

            # Create sample form
            sample_form = Form(
                name='Patient Registration Form',
                description='Basic patient registration and assessment form',
                schema={
                    'fields': [
                        {
                            'id': 'patient_name',
                            'type': 'text',
                            'label': 'Patient Name',
                            'required': True,
                            'validation': {'maxLength': 100}
                        },
                        {
                            'id': 'age',
                            'type': 'number',
                            'label': 'Age',
                            'required': True,
                            'validation': {'min': 0, 'max': 150}
                        },
                        {
                            'id': 'gender',
                            'type': 'select',
                            'label': 'Gender',
                            'required': True,
                            'options': ['Male', 'Female', 'Other']
                        },
                        {
                            'id': 'visit_date',
                            'type': 'date',
                            'label': 'Visit Date',
                            'required': True
                        },
                        {
                            'id': 'blood_pressure',
                            'type': 'number',
                            'label': 'Blood Pressure (Systolic)',
                            'required': False,
                            'validation': {'min': 60, 'max': 200}
                        },
                        {
                            'id': 'temperature',
                            'type': 'number',
                            'label': 'Temperature (°F)',
                            'required': False,
                            'validation': {'min': 35, 'max': 42}
                        },
                        {
                            'id': 'symptoms',
                            'type': 'textarea',
                            'label': 'Symptoms Description',
                            'required': False
                        }
                    ]
                },
                created_by=admin.id
            )
            db.session.add(sample_form)
            db.session.commit()
            print("Sample form created!")
        else:
            print("Database already seeded!")


@app.cli.command()
def reset_db():
    """Reset the database (WARNING: Deletes all data)."""
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Database reset complete!")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)