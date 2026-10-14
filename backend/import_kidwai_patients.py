#!/usr/bin/env python3
"""
Import Kidwai home-visit patients from Excel into the DB.
Idempotent — re-running skips already-imported rows.

Usage:
    python import_kidwai_patients.py --admin-email admin@saranam.in --dry-run
    python import_kidwai_patients.py --admin-email admin@saranam.in
"""
import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from app import create_app
from app.extensions import db

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_EXCEL = str(Path.home() / 'Downloads' / 'Kidwai Home visit patients Line-list.xlsx')
DEFAULT_SHEET = 'Master Sheet'

# Zone name (Excel) → geographic_cluster value used in the app
ZONE_MAP = {
    'South':   'South',
    'East':    'East',
    'North':   'North',
    'West':    'West',
    'Central': 'Central',
}

# Zone name → 2-digit zone code used in UHIDs
ZONE_CODE_MAP = {
    'South':   '01',
    'East':    '02',
    'North':   '03',
    'West':    '04',
    'Central': '05',
}

# Homecare UHID prefix → linked_hospital code
# KAGBAKMIO → KMIO (from HOSPITAL_CATALOG)
HOMECARE_PREFIX_TO_HOSPITAL = {
    'KAGBAKMIO': 'KMIO',
    'KAGBAKCGH': 'KCGH',
}

# Fixed values for every imported patient
FIXED_IS_BANGALORE_RESIDENT = True
FIXED_IS_ONCO = True
FIXED_REFERRED_FROM = 'Kidwai'
FIXED_SOURCE_SYSTEM = 'kidwai_import'
FIXED_LINKED_HOSPITAL = 'KMIO'   # All rows in this sheet are Kidwai patients


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _phone_str(v) -> str | None:
    """Coerce a phone value (possibly float like 9008238328.0) to a clean digit string."""
    if pd.isna(v):
        return None
    s = str(v).strip()
    # Remove trailing .0 that pandas adds to numeric cells
    if s.endswith('.0'):
        s = s[:-2]
    digits = re.sub(r'\D', '', s)
    return digits if digits else None


def _normalize_gender(v) -> str | None:
    if pd.isna(v):
        return None
    g = str(v).strip().title()
    if g in ('Male', 'Female', 'Other'):
        return g
    return None


def _age_to_dob(age_val) -> date | None:
    """Convert an age (years) to an approximate date of birth."""
    if pd.isna(age_val):
        return None
    try:
        age = int(float(age_val))
        return date.today() - timedelta(days=age * 365)
    except (ValueError, TypeError):
        return None


def _parse_date(v) -> date | None:
    if pd.isna(v):
        return None
    if hasattr(v, 'date'):
        return v.date()
    try:
        return pd.to_datetime(v).date()
    except Exception:
        return None


def _hospital_uhid_str(v) -> str | None:
    """Coerce Hospital UHID (e.g. 20240020000.0) to a clean string."""
    if pd.isna(v):
        return None
    s = str(v).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return s if s else None


def _homecare_uhid_str(v) -> str | None:
    """Coerce Homecare UHID (e.g. 2026020001.0) to zero-padded 10-char string."""
    if pd.isna(v):
        return None
    s = str(v).strip()
    if s.endswith('.0'):
        s = s[:-2]
    # Should be exactly 10 digits: YYYYZZNNNNN → YYYY(2)NNNN(4)
    # Pad sequence portion if needed
    if len(s) == 10 and s.isdigit():
        return s
    # Try to reconstruct: first 4 = year, next 2 = zone, last 4 = seq
    digits = re.sub(r'\D', '', s)
    if len(digits) == 10:
        return digits
    return None


def _bump_uhid_counter(uhid: str):
    """
    Given a pre-existing UHID (YYYYZZNNNNN format, 10 digits),
    bump the uhid_counters table so new allocations don't collide.
    """
    if not uhid or len(uhid) != 10:
        return
    year = int(uhid[:4])
    zone_code = uhid[4:6]
    seq = int(uhid[6:])
    db.session.execute(db.text(
        "UPDATE uhid_counters "
        "SET last_sequence = GREATEST(last_sequence, :s) "
        "WHERE year = :y AND zone_code = :z"
    ), {'y': year, 'z': zone_code, 's': seq})


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

def already_imported(hospital_uhid: str | None, name: str, phone: str | None) -> bool:
    """
    Return True if this patient is already in the DB from a previous import run.
    Primary key: external_id (Hospital UHID) + source_system = kidwai_import.
    Fallback: full_name match + phone comparison (phone is encrypted so we decrypt).
    """
    from app.patients.models import Patient

    if hospital_uhid:
        hit = Patient.query.filter_by(
            external_id=hospital_uhid,
            source_system=FIXED_SOURCE_SYSTEM
        ).first()
        if hit:
            return True

    # Fallback: name + phone
    if phone:
        for p in Patient.query.filter_by(full_name=name).all():
            try:
                stored = p.get_phone()
                if stored and phone in stored:
                    return True
            except Exception:
                pass

    return False


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------

def build_schema_and_extras(row):
    """
    Map one Excel row to (PatientCreateSchema, extras_dict).
    extras_dict carries fields that need post-create handling:
      - preexisting_uhid: str | None
      - date_of_death: date | None
      - first_visit_date: date | None
    Raises ValueError for rows that are unimportable (e.g. missing name).
    """
    from app.patients.schemas import PatientCreateSchema

    name = str(row['Name ']).strip() if pd.notna(row['Name ']) else ''
    if not name:
        raise ValueError('Missing patient name')

    zone_raw = str(row['Zone']).strip() if pd.notna(row['Zone']) else ''
    geographic_cluster = ZONE_MAP.get(zone_raw)
    if not geographic_cluster:
        raise ValueError(f'Unknown zone: {zone_raw!r}')

    dob = _age_to_dob(row.get('Age'))
    gender = _normalize_gender(row.get('Gender'))
    diagnosis = str(row['Diagnosis']).strip() if pd.notna(row.get('Diagnosis')) else None
    phone = _phone_str(row.get('Mobile Number'))
    alt_phone = _phone_str(row.get('Mobile Number.1'))
    alt_phone_name = str(row['Relation with the patient.1']).strip()[:100] if pd.notna(row.get('Relation with the patient.1')) else None
    address = str(row['Address']).strip() if pd.notna(row.get('Address')) else None

    # BSC
    bsc_raw = str(row.get('BSC', '')).strip().lower() if pd.notna(row.get('BSC')) else ''
    bsc_status = True if bsc_raw == 'yes' else (False if bsc_raw == 'no' else None)

    # Hospital UHID → external_id
    hospital_uhid = _hospital_uhid_str(row.get('Hospital UHID '))

    # Homecare UHID (pre-existing)
    homecare_uhid = _homecare_uhid_str(row.get('Homecare UHID '))

    # linked_hospital from Homecare UHID Code column
    hc_code_raw = str(row.get('Homecare UHID Code', '')).strip() if pd.notna(row.get('Homecare UHID Code')) else ''
    linked_hospital = HOMECARE_PREFIX_TO_HOSPITAL.get(hc_code_raw, FIXED_LINKED_HOSPITAL)

    # External metadata
    external_metadata = {
        'source': 'kidwai_import',
        'base_location': str(row.get('Base location', '')).strip() if pd.notna(row.get('Base location')) else None,
        'location_pin_url': str(row.get('Location pin', '')).strip() if pd.notna(row.get('Location pin')) else None,
        'relation_primary': str(row.get('Relation with the patient', '')).strip() if pd.notna(row.get('Relation with the patient')) else None,
        'hospital_uhid': hospital_uhid,
    }
    # Remove None values
    external_metadata = {k: v for k, v in external_metadata.items() if v}

    schema = PatientCreateSchema(
        full_name=name,
        date_of_birth=dob,
        is_approximate_dob=True,   # all DOBs are estimated from age
        gender=gender,
        phone_number=phone,
        address_line1=address,
        diagnosis=diagnosis,
        referred_from=FIXED_REFERRED_FROM,
        is_bangalore_resident=FIXED_IS_BANGALORE_RESIDENT,
        geographic_cluster=geographic_cluster,
        linked_hospital=linked_hospital,
        bsc_status=bsc_status,
        is_onco=FIXED_IS_ONCO,
        alternative_phone=alt_phone,
        alternative_phone_name=alt_phone_name,
        external_metadata=external_metadata,
    )

    extras = {
        'hospital_uhid': hospital_uhid,
        'preexisting_uhid': homecare_uhid,
        'date_of_death': _parse_date(row.get('Date of death')),
        'place_of_death': str(row.get('Place of death', '')).strip() if pd.notna(row.get('Place of death')) else None,
        'first_visit_date': _parse_date(row.get('1st visit')),
        'registration_date': _parse_date(row.get('Date of registration')),
    }

    return schema, extras


# ---------------------------------------------------------------------------
# Per-row import
# ---------------------------------------------------------------------------

def uhid_already_exists(uhid: str) -> bool:
    """Check if a UHID is already taken in the DB."""
    from app.patients.models import Patient
    return Patient.query.filter_by(uhid=uhid).first() is not None


def import_row(row, admin_id, dry_run=False) -> str:
    """
    Import one row. Returns one of:
      'created', 'skipped_duplicate', 'would_create'
    Raises on unrecoverable errors.
    """
    from app.patients.models import Patient
    from app.patients.services import PatientService
    from app.saranam.models.patient_visit import PatientVisit

    name = str(row['Name ']).strip() if pd.notna(row['Name ']) else ''
    hospital_uhid = _hospital_uhid_str(row.get('Hospital UHID '))
    phone = _phone_str(row.get('Mobile Number'))

    if already_imported(hospital_uhid, name, phone):
        return 'skipped_duplicate'

    schema, extras = build_schema_and_extras(row)

    # If the preexisting UHID is already taken (duplicate in Excel data), drop it
    # and let the system generate a new one — log a warning.
    if extras['preexisting_uhid'] and uhid_already_exists(extras['preexisting_uhid']):
        print(f'  WARNING: UHID {extras["preexisting_uhid"]} already in DB — will assign new UHID to {name}')
        extras['preexisting_uhid'] = None

    # Bump UHID counter BEFORE create so the newly-minted UHID won't collide
    if extras['preexisting_uhid']:
        _bump_uhid_counter(extras['preexisting_uhid'])

    if dry_run:
        return 'would_create'

    # Create patient (PatientService.create_patient commits internally)
    patient_dict = PatientService.create_patient(schema, created_by=admin_id)
    patient = db.session.get(Patient, patient_dict['id'])

    # Stamp source system & external IDs
    patient.source_system = FIXED_SOURCE_SYSTEM
    if extras['hospital_uhid']:
        patient.external_id = extras['hospital_uhid']

    # Overwrite auto-generated UHID with preserved value
    if extras['preexisting_uhid']:
        patient.uhid = extras['preexisting_uhid']

    # Death
    if extras['date_of_death']:
        patient.is_deceased = True
        patient.date_of_death = extras['date_of_death']
        if extras['place_of_death']:
            meta = dict(patient.external_metadata or {})
            meta['place_of_death'] = extras['place_of_death']
            patient.external_metadata = meta

    # Registration date override
    if extras['registration_date']:
        patient.created_at = extras['registration_date']

    # Update initial visit date from "1st visit" column
    if extras['first_visit_date']:
        iv = PatientVisit.query.filter_by(
            patient_id=patient.id, visit_number=0
        ).first()
        if iv:
            iv.visit_date = extras['first_visit_date']
            iv.status = 'completed'

    db.session.commit()
    return 'created'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description='Import Kidwai home-visit patients from Excel.')
    ap.add_argument('--file', default=DEFAULT_EXCEL, help='Path to Excel file')
    ap.add_argument('--sheet', default=DEFAULT_SHEET, help='Sheet name')
    ap.add_argument('--dry-run', action='store_true', help='Simulate without writing to DB')
    ap.add_argument('--admin-email', required=True, help='Email of admin user (recorded as created_by)')
    ap.add_argument('--limit', type=int, default=None, help='Only process first N rows (for testing)')
    args = ap.parse_args()

    app = create_app('development')
    with app.app_context():
        from app.common.models import User

        admin = User.query.filter_by(email=args.admin_email).first()
        if not admin:
            sys.exit(f'ERROR: Admin user not found: {args.admin_email}')

        print(f'Loading Excel: {args.file}  sheet={args.sheet}')
        df = pd.read_excel(args.file, sheet_name=args.sheet)
        if args.limit:
            df = df.head(args.limit)
        print(f'Rows to process: {len(df)}')
        print(f'Mode: {"DRY RUN" if args.dry_run else "REAL IMPORT"}\n')

        stats = {'created': 0, 'skipped_duplicate': 0, 'would_create': 0, 'errors': 0}
        errors = []

        for idx, row in df.iterrows():
            try:
                outcome = import_row(row, admin.id, dry_run=args.dry_run)
                stats[outcome] += 1
                marker = '+' if outcome == 'created' else ('~' if outcome == 'would_create' else '.')
                print(f'  [{idx:03d}] {marker} {str(row.get("Name ", "?")):<30s}  {outcome}')
            except Exception as e:
                db.session.rollback()
                stats['errors'] += 1
                msg = f'ROW {idx} ({row.get("Name ", "?")}): {e}'
                errors.append(msg)
                print(f'  [{idx:03d}] ERROR: {msg}')

        if not args.dry_run:
            db.session.commit()
            print('\nCommitted.')

        print(f'\n=== Stats ===')
        for k, v in stats.items():
            print(f'  {k:<22s} {v}')

        if errors:
            print(f'\n=== Errors ===')
            for e in errors:
                print(f'  {e}')


if __name__ == '__main__':
    main()
