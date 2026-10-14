#!/usr/bin/env python
"""
Seed predefined provider specializations and departments
"""

from app import create_app
from app.extensions import db
from app.providers.models import ProviderSpecialization, ProviderDepartment
from app.providers.constants import PREDEFINED_SPECIALIZATIONS, PREDEFINED_DEPARTMENTS


def seed_provider_options():
    """Seed predefined specializations and departments"""
    app = create_app('development')

    with app.app_context():
        print("\n" + "="*60)
        print("Seeding Provider Options")
        print("="*60)

        # Seed specializations
        print(f"\nSeeding {len(PREDEFINED_SPECIALIZATIONS)} specializations...")
        spec_count = 0
        for spec in PREDEFINED_SPECIALIZATIONS:
            existing = ProviderSpecialization.query.filter_by(name=spec).first()
            if not existing:
                specialization = ProviderSpecialization(
                    name=spec,
                    is_predefined=True,
                    is_active=True
                )
                db.session.add(specialization)
                spec_count += 1
            else:
                # Ensure it's marked as predefined and active
                if not existing.is_predefined or not existing.is_active:
                    existing.is_predefined = True
                    existing.is_active = True

        print(f"✅ Added {spec_count} new specializations")

        # Seed departments
        print(f"\nSeeding {len(PREDEFINED_DEPARTMENTS)} departments...")
        dept_count = 0
        for dept in PREDEFINED_DEPARTMENTS:
            existing = ProviderDepartment.query.filter_by(name=dept).first()
            if not existing:
                department = ProviderDepartment(
                    name=dept,
                    is_predefined=True,
                    is_active=True
                )
                db.session.add(department)
                dept_count += 1
            else:
                # Ensure it's marked as predefined and active
                if not existing.is_predefined or not existing.is_active:
                    existing.is_predefined = True
                    existing.is_active = True

        print(f"✅ Added {dept_count} new departments")

        # Commit all changes
        db.session.commit()

        # Summary
        total_specs = ProviderSpecialization.query.filter_by(is_active=True).count()
        total_depts = ProviderDepartment.query.filter_by(is_active=True).count()

        print("\n" + "="*60)
        print("Seeding Complete!")
        print("="*60)
        print(f"Total Active Specializations: {total_specs}")
        print(f"Total Active Departments: {total_depts}")
        print("="*60 + "\n")


if __name__ == '__main__':
    seed_provider_options()
