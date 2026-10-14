#!/usr/bin/env python3
"""
Import the Feb-2026 .. May-16-2026 line-list patients from Excel into the DB.

Idempotent — re-running skips rows already imported (matched on Hospital UHID
+ source_system). In-file duplicate Hospital UHIDs keep only the first row.

Usage:
    python import_linelist_patients.py --admin-email admin@cvraman.health --dry-run
    python import_linelist_patients.py --admin-email admin@cvraman.health --limit 3
    python import_linelist_patients.py --admin-email admin@cvraman.health
"""
import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import openpyxl

from app import create_app
from app.extensions import db

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_EXCEL = str(Path.home() / 'Downloads' / 'line list feb 2026 - may 16th 2026.xlsx')
DEFAULT_SHEET = 'Socio_demographic'

SOURCE_SYSTEM = 'linelist_import'
REFERRED_FROM = 'Kidwai'

# 0-based column indices in the Socio_demographic sheet
C_REG, C_FIRST_CONTACT = 0, 1
C_HOSP_UHID, C_HC_CODE, C_HC_UHID = 4, 5, 6
C_FNAME, C_LNAME, C_STATUS = 7, 8, 9
C_CATEGORY, C_DOB, C_AGE, C_GENDER = 12, 13, 14, 15
C_ADDRESS, C_LOCATION, C_PIN, C_ZONE, C_DIAGNOSIS = 16, 17, 18, 19, 20
C_CAREGIVER, C_DECISION_MAKER = 21, 22
C_CONTACT1, C_CONTACT2, C_COMORBID, C_LAST_FU = 23, 24, 25, 26
C_DOD, C_POD, C_POD_OTHER = 27, 28, 29

VALID_ZONES = {'South', 'East', 'North', 'West', 'Central'}

# Home care UHID code prefix -> linked_hospital
HOMECARE_PREFIX_TO_HOSPITAL = {'KAGBAKMIO': 'KMIO', 'KAGBAKCGH': 'KCGH'}

# Place of death (Excel) -> patients.place_of_death enum
POD_MAP = {
    'home': 'home',
    'hospital': 'hospital',
    'on the way': 'on_the_way',
}


# ---------------------------------------------------------------------------
# Cell coercion helpers
# ---------------------------------------------------------------------------

def _str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _digits(v):
    """Coerce a phone-ish value to a clean digit string."""
    if v is None:
        return None
    s = str(v).strip()
    if s.endswith('.0'):
        s = s[:-2]
    digits = re.sub(r'\D', '', s)
    return digits or None


def _uhid_str(v):
    """Coerce a numeric UHID cell (e.g. 20240020000.0) to a clean string."""
    if v is None:
        return None
    s = str(v).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return s or None


def _date(v):
    if v is None:
        return None
    if hasattr(v, 'date'):
        return v.date()
    return None


def _age_to_dob(v):
    """Approximate DOB from an age in years."""
    if v in (None, ''):
        return None
    try:
        return date.today() - timedelta(days=int(float(v)) * 365)
    except (ValueError, TypeError):
        return None


def _gender(v):
    g = (_str(v) or '').title()
    return g if g in ('Male', 'Female', 'Other') else None


def _split_relation(v):
    """'Mother - Gangubai' -> ('Mother', 'Gangubai'). Plain name -> (None, name)."""
    s = _str(v)
    if not s:
        return None, None
    if ' - ' in s:
        rel, _, name = s.partition(' - ')
        return (_str(rel) or None), (_str(name) or None)
    return None, s


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

def already_imported(hospital_uhid):
    """True if a patient with this Hospital UHID already exists in the DB.

    Matches the Hospital UHID against BOTH columns it can live in, across
    every source_system:
      - hospital_uhid column (normal UI registration, this script)
      - external_id column (the earlier kidwai_import stored it here and
        left hospital_uhid empty)
    """
    if not hospital_uhid:
        return False
    from app.patients.models import Patient
    return Patient.query.filter(
        db.or_(
            Patient.hospital_uhid == hospital_uhid,
            Patient.external_id == hospital_uhid,
        )
    ).first() is not None


def uhid_taken(uhid):
    from app.patients.models import Patient
    return bool(uhid) and Patient.query.filter_by(uhid=uhid).first() is not None


def _bump_uhid_counter(uhid):
    """Bump uhid_counters so freshly-minted UHIDs don't collide with a preserved one."""
    if not uhid or len(uhid) != 10 or not uhid.isdigit():
        return
    db.session.execute(db.text(
        "UPDATE uhid_counters SET last_sequence = GREATEST(last_sequence, :s) "
        "WHERE year = :y AND zone_code = :z"
    ), {'y': int(uhid[:4]), 'z': uhid[4:6], 's': int(uhid[6:])})


# ---------------------------------------------------------------------------
# Row -> schema
# ---------------------------------------------------------------------------

def build_schema_and_extras(row):
    """Map one Excel row to (PatientCreateSchema, extras). Raises ValueError if unimportable."""
    from app.patients.schemas import PatientCreateSchema

    name = ' '.join(p for p in (_str(row[C_FNAME]), _str(row[C_LNAME])) if p)
    if not name:
        raise ValueError('Missing patient name')

    zone = _str(row[C_ZONE])
    is_blr = zone in VALID_ZONES
    geographic_cluster = zone if is_blr else None

    hc_code = _str(row[C_HC_CODE]) or ''
    linked_hospital = HOMECARE_PREFIX_TO_HOSPITAL.get(hc_code, 'KMIO') if is_blr else None

    # DOB: explicit column wins, else approximate from age
    dob = _date(row[C_DOB])
    approx = False
    if dob is None:
        dob = _age_to_dob(row[C_AGE])
        approx = dob is not None

    # Category -> BSC / onco
    category = (_str(row[C_CATEGORY]) or '').lower()
    if 'n-bsc' in category:
        bsc_status = False
    elif 'bsc' in category:
        bsc_status = True
    else:
        bsc_status = None
    is_onco = True if 'onco' in category else None

    pc_rel, pc_name = _split_relation(row[C_CAREGIVER])
    dm_rel, dm_name = _split_relation(row[C_DECISION_MAKER])

    diagnosis = _str(row[C_DIAGNOSIS])
    if diagnosis:
        diagnosis = diagnosis[:100]

    hospital_uhid = _uhid_str(row[C_HOSP_UHID])

    meta = {
        'source': SOURCE_SYSTEM,
        'hospital_uhid': hospital_uhid,
        'location': _str(row[C_LOCATION]),
        'location_pin': _str(row[C_PIN]),
        'comorbidities': _str(row[C_COMORBID]),
        'last_follow_up': row[C_LAST_FU].date().isoformat() if _date(row[C_LAST_FU]) else None,
    }
    meta = {k: v for k, v in meta.items() if v}

    schema = PatientCreateSchema(
        full_name=name,
        date_of_birth=dob,
        is_approximate_dob=approx,
        gender=_gender(row[C_GENDER]),
        phone_number=_digits(row[C_CONTACT1]),
        address_line1=_str(row[C_ADDRESS]),
        diagnosis=diagnosis,
        referred_from=REFERRED_FROM,
        is_bangalore_resident=is_blr,
        geographic_cluster=geographic_cluster,
        linked_hospital=linked_hospital,
        hospital_uhid=hospital_uhid,
        bsc_status=bsc_status,
        is_onco=is_onco,
        alternative_phone=_digits(row[C_CONTACT2]),
        primary_caregiver_name=pc_name,
        primary_caregiver_relationship=(pc_rel or None) and pc_rel[:50],
        primary_caregiver_phone=_digits(row[C_CONTACT2]),
        decision_maker_name=dm_name,
        decision_maker_designation=(dm_rel or None) and dm_rel[:50],
        external_metadata=meta,
    )

    extras = {
        'hospital_uhid': hospital_uhid,
        'preexisting_uhid': _uhid_str(row[C_HC_UHID]),
        'status': (_str(row[C_STATUS]) or '').lower(),
        'date_of_death': _date(row[C_DOD]),
        'place_of_death': POD_MAP.get((_str(row[C_POD]) or '').lower()),
        'registration_date': _date(row[C_REG]),
        'first_contact_date': _date(row[C_FIRST_CONTACT]),
    }
    return schema, extras


# ---------------------------------------------------------------------------
# Per-row import
# ---------------------------------------------------------------------------

def import_row(row, admin_id, dry_run, seen_uhids):
    """Import one row. Returns an outcome string."""
    from app.patients.models import Patient
    from app.patients.services import PatientService
    from app.saranam.models.patient_visit import PatientVisit

    hospital_uhid = _uhid_str(row[C_HOSP_UHID])

    if hospital_uhid and hospital_uhid in seen_uhids:
        return 'skipped_dup_in_file'
    if hospital_uhid:
        seen_uhids.add(hospital_uhid)

    if already_imported(hospital_uhid):
        return 'skipped_already_imported'

    schema, extras = build_schema_and_extras(row)

    # A pre-existing Home care UHID that's already taken -> drop, let system mint one
    uhid = extras['preexisting_uhid']
    if uhid and uhid_taken(uhid):
        print(f'    WARNING: UHID {uhid} already in DB — system will mint a new one')
        uhid = None
    if uhid:
        _bump_uhid_counter(uhid)

    if dry_run:
        return 'would_create'

    patient_dict = PatientService.create_patient(schema, created_by=admin_id)
    patient = db.session.get(Patient, patient_dict['id'])

    patient.source_system = SOURCE_SYSTEM
    if extras['hospital_uhid']:
        patient.external_id = extras['hospital_uhid']
    if uhid:
        patient.uhid = uhid

    if extras['status'] == 'deceased' or extras['date_of_death']:
        patient.is_deceased = True
        patient.care_status = 'inactive'
        patient.date_of_death = extras['date_of_death']
        if extras['place_of_death']:
            patient.place_of_death = extras['place_of_death']

    if extras['registration_date']:
        patient.created_at = extras['registration_date']

    if extras['first_contact_date']:
        iv = PatientVisit.query.filter_by(patient_id=patient.id, visit_number=0).first()
        if iv:
            iv.visit_date = extras['first_contact_date']

    db.session.commit()
    return 'created'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description='Import line-list patients from Excel.')
    ap.add_argument('--file', default=DEFAULT_EXCEL)
    ap.add_argument('--sheet', default=DEFAULT_SHEET)
    ap.add_argument('--dry-run', action='store_true', help='Simulate, write nothing')
    ap.add_argument('--admin-email', required=True, help='created_by user email')
    ap.add_argument('--limit', type=int, default=None, help='Process only first N rows')
    args = ap.parse_args()

    app = create_app('development')
    with app.app_context():
        from app.common.models import User

        admin = User.query.filter_by(email=args.admin_email).first()
        if not admin:
            sys.exit(f'ERROR: admin user not found: {args.admin_email}')

        wb = openpyxl.load_workbook(args.file, read_only=True, data_only=True)
        ws = wb[args.sheet]
        rows = [r for r in list(ws.iter_rows(values_only=True))[1:]
                if any(c not in (None, '') for c in r)]
        if args.limit:
            rows = rows[:args.limit]

        print(f'File:  {args.file}  sheet={args.sheet}')
        print(f'Rows:  {len(rows)}   Mode: {"DRY RUN" if args.dry_run else "REAL IMPORT"}\n')

        stats = {'created': 0, 'would_create': 0, 'skipped_already_imported': 0,
                 'skipped_dup_in_file': 0, 'errors': 0}
        errors = []
        seen_uhids = set()

        for idx, row in enumerate(rows):
            name = ' '.join(p for p in (_str(row[C_FNAME]), _str(row[C_LNAME])) if p) or '?'
            try:
                outcome = import_row(row, admin.id, args.dry_run, seen_uhids)
                stats[outcome] += 1
                marker = {'created': '+', 'would_create': '~'}.get(outcome, '.')
                print(f'  [{idx:03d}] {marker} {name:<32s} {outcome}')
            except Exception as e:
                db.session.rollback()
                stats['errors'] += 1
                msg = f'ROW {idx} ({name}): {e}'
                errors.append(msg)
                print(f'  [{idx:03d}] ERROR: {msg}')

        print('\n=== Stats ===')
        for k, v in stats.items():
            print(f'  {k:<26s} {v}')
        if errors:
            print('\n=== Errors ===')
            for e in errors:
                print(f'  {e}')


if __name__ == '__main__':
    main()
