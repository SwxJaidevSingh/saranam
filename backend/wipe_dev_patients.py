#!/usr/bin/env python3
"""
Wipe all patient-linked data from the DB. Idempotent. Use --dry-run first.

Usage:
    python wipe_dev_patients.py --dry-run   # see what would run
    python wipe_dev_patients.py             # actually wipe
"""
import argparse
from app import create_app
from app.extensions import db

# Ordered by dependency — leaves first, anchor last
WIPE_SQL = [
    # Leaf tables (no children)
    "DELETE FROM form_answers;",
    "DELETE FROM submission_risk_scores;",
    "DELETE FROM opd_prescription_items;",
    "DELETE FROM opd_lab_order_items;",
    "DELETE FROM appointment_reminders;",
    "DELETE FROM consent_access_log;",
    "DELETE FROM recent_patients;",
    # Assessments & visit children
    "DELETE FROM nursing_assessments;",
    "DELETE FROM doctor_assessments;",
    "DELETE FROM psychological_assessments;",
    "DELETE FROM physiotherapy_assessments;",
    "DELETE FROM esas_scores;",
    "DELETE FROM pps_scores;",
    "DELETE FROM procedures_records;",
    # Encounter children
    "DELETE FROM opd_prescriptions;",
    "DELETE FROM opd_lab_orders;",
    "DELETE FROM observations;",
    "DELETE FROM diagnoses;",
    "DELETE FROM bed_assignments;",
    "DELETE FROM bed_waiting_list;",
    "DELETE FROM vitals_records;",
    "DELETE FROM call_sops;",
    "DELETE FROM call_schedules;",
    "DELETE FROM patient_locations;",
    "DELETE FROM patient_symptoms;",
    "DELETE FROM patient_risk_assessments;",
    # Delete patient-assigned slots (patient_id is NOT NULL constrained — can't null out)
    "DELETE FROM schedule_slots WHERE patient_id IS NOT NULL;",
    # Pharmacy / stock
    "DELETE FROM dispensing_records;",
    "DELETE FROM stock_movements;",
    # Clinical / care
    "DELETE FROM clinical_documentation;",
    "DELETE FROM plans_of_care;",
    "DELETE FROM phone_follow_ups;",
    # Cohorts
    "DELETE FROM cohort_members;",
    # Contacts & consents
    "DELETE FROM patient_contacts;",
    "DELETE FROM patient_consents;",
    # Scheduling meta
    "DELETE FROM patient_scheduling_meta;",
    # Direct patient children
    "DELETE FROM patient_visits;",
    "DELETE FROM encounters;",
    "DELETE FROM form_submissions;",
    "DELETE FROM ipd_admissions;",
    "DELETE FROM consent_artifacts;",
    "DELETE FROM patient_caregivers;",
    "DELETE FROM uhid_history;",
    # Anchor
    "DELETE FROM patients;",
    # Bulk import sessions left over from dev
    "DELETE FROM bulk_import_items;",
    # Null out FK in healthcare_providers before dropping sessions (providers are kept)
    "UPDATE healthcare_providers SET bulk_import_session_id = NULL WHERE bulk_import_session_id IS NOT NULL;",
    "DELETE FROM bulk_import_sessions;",
    # Audit / logs — clear to start fresh
    "DELETE FROM audit_logs;",
    "DELETE FROM schedule_audit_log;",
    "DELETE FROM reminder_logs;",
    # Reset current-year UHID counter sequences
    "UPDATE uhid_counters SET last_sequence = 0 WHERE year = EXTRACT(YEAR FROM NOW());",
]

VERIFY_SQL = [
    "SELECT 'patients' AS table_name, COUNT(*) AS count FROM patients",
    "SELECT 'patient_visits' AS table_name, COUNT(*) AS count FROM patient_visits",
    "SELECT 'form_submissions' AS table_name, COUNT(*) AS count FROM form_submissions",
    "SELECT 'uhid_history' AS table_name, COUNT(*) AS count FROM uhid_history",
    "SELECT 'users (preserved)' AS table_name, COUNT(*) AS count FROM users",
    "SELECT 'forms (preserved)' AS table_name, COUNT(*) AS count FROM forms",
]

TABLE_EXISTS_SQL = """
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = :t
"""


def table_exists(name):
    result = db.session.execute(db.text(TABLE_EXISTS_SQL), {'t': name}).first()
    return result is not None


def main():
    ap = argparse.ArgumentParser(description='Wipe all patient-linked dev data from the DB.')
    ap.add_argument('--dry-run', action='store_true', help='Print statements without executing')
    args = ap.parse_args()

    app = create_app('development')
    with app.app_context():
        if args.dry_run:
            print('DRY RUN — statements that would execute:\n')
            for s in WIPE_SQL:
                print(f'  {s}')
            print('\nNo changes made.')
            return

        print('=== Starting wipe ===\n')
        skipped = []
        for s in WIPE_SQL:
            # Skip tables that don't exist (optional audit tables, etc.)
            words = s.split()
            # Extract table name from "DELETE FROM <table>;" or "UPDATE <table> ..."
            if words[0].upper() == 'DELETE':
                tbl = words[2].rstrip(';')
            elif words[0].upper() == 'UPDATE':
                tbl = words[1]
            else:
                tbl = None

            if tbl and not table_exists(tbl):
                print(f'  SKIP (table not found): {tbl}')
                skipped.append(tbl)
                continue

            try:
                result = db.session.execute(db.text(s))
                rc = getattr(result, 'rowcount', None)
                print(f'  OK  {s:<70s}  rows={rc}')
            except Exception as e:
                db.session.rollback()
                print(f'\nERROR on: {s}')
                print(f'  {e}')
                print('\nRolled back. No changes committed.')
                return

        db.session.commit()
        print('\n=== Wipe committed ===')

        if skipped:
            print(f'  Tables skipped (not found): {skipped}')

        print('\n=== Post-wipe verification ===\n')
        for s in VERIFY_SQL:
            try:
                row = db.session.execute(db.text(s)).first()
                print(f'  {row[0]:<30s}  count={row[1]}')
            except Exception as e:
                print(f'  (could not verify) {s}: {e}')


if __name__ == '__main__':
    main()
