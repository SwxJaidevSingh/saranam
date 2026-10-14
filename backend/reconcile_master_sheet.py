#!/usr/bin/env python3
"""
Reconcile the DB against the client master sheet (Saranam_Data_Master.xlsx).

Scope (confirmed): three fields + insert missing patients.
  - geographic_cluster   <- Zone            (safe: no unique constraint)
  - clinical_complexity  <- Patient Priority (safe)
  - uhid                 <- Home care UHID   (GATED: --apply-uhid only; see below)
  - INSERT patients present in the sheet but absent from the DB.

Matching key: Hospital UHID (patients.hospital_uhid OR patients.external_id).

UHID re-numbering is gated behind --apply-uhid because the sheet's UHID space
collides with 46 existing patients (20 not in the sheet + 26 with a blank sheet
UHID). Running without --apply-uhid reports those conflicts and changes nothing
to uhid.

Usage:
    python reconcile_master_sheet.py --admin-email admin@cvraman.health --dry-run
    python reconcile_master_sheet.py --admin-email admin@cvraman.health        # zone+priority+inserts
"""
import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import openpyxl

from app import create_app
from app.extensions import db

DEFAULT_EXCEL = str(Path.home() / 'Downloads' / 'Saranam_Data_Master.xlsx')
SHEET = 'Socio_demographic'
SOURCE_SYSTEM = 'master_reconcile'
REFERRED_FROM = 'Kidwai'

# 0-based column indices in the master sheet (note Age Category/PPS/Priority
# shift these vs the earlier line-list).
C_REG, C_FC = 0, 1
C_HOSP, C_HCCODE, C_HC = 4, 5, 6
C_FN, C_LN, C_STATUS = 7, 8, 9
C_CAT, C_DOB, C_AGE, C_GENDER = 12, 13, 14, 16
C_ADDR, C_LOC, C_PIN, C_ZONE, C_DX = 17, 18, 19, 20, 21
C_PRIO, C_PC, C_DM = 23, 24, 25
C_C1, C_C2, C_COMORB, C_LASTFU, C_DOD, C_POD = 26, 27, 28, 29, 30, 31

VALID_ZONES = {'South', 'East', 'North', 'West', 'Central'}
PRIO_MAP = {'high': 'high', 'medium': 'medium', 'low': 'low'}
POD_MAP = {'home': 'home', 'hospital': 'hospital', 'on the way': 'on_the_way'}
HOMECARE_PREFIX = {'KAGBAKMIO': 'KMIO', 'KAGBAKCGH': 'KCGH'}


def s(v):
    if v in (None, ''):
        return None
    x = str(v).strip()
    return x[:-2] if x.endswith('.0') else (x or None)


def digits(v):
    x = s(v)
    if not x:
        return None
    d = re.sub(r'\D', '', x)
    return d or None


def low(v):
    x = s(v)
    return re.sub(r'\s+', ' ', x.lower()) if x else None


def zone_of(v):
    x = s(v)
    if not x:
        return None
    x = x.title()
    return x if x in VALID_ZONES else None


def dt(v):
    return v.date() if hasattr(v, 'date') else None


def age_to_dob(v):
    x = s(v)
    if not x:
        return None
    try:
        return date.today() - timedelta(days=int(float(x)) * 365)
    except (ValueError, TypeError):
        return None


def split_rel(v):
    x = s(v)
    if not x:
        return None, None
    if ' - ' in x:
        a, _, b = x.partition(' - ')
        return (s(a), s(b))
    return None, x


def find_patient(hosp):
    from app.patients.models import Patient
    return Patient.query.filter(
        db.or_(Patient.hospital_uhid == hosp, Patient.external_id == hosp)
    ).first()


def build_insert_schema(row):
    """Full PatientCreateSchema for a sheet row not in the DB."""
    from app.patients.schemas import PatientCreateSchema
    name = ' '.join(p for p in (s(row[C_FN]), s(row[C_LN])) if p)
    if not name:
        raise ValueError('missing name')
    zone = zone_of(row[C_ZONE])
    is_blr = zone is not None
    hc_code = s(row[C_HCCODE]) or ''
    linked = HOMECARE_PREFIX.get(hc_code, 'KMIO') if is_blr else None
    dob = dt(row[C_DOB]); approx = False
    if dob is None:
        dob = age_to_dob(row[C_AGE]); approx = dob is not None
    cat = (s(row[C_CAT]) or '').lower()
    bsc = False if 'n-bsc' in cat else (True if 'bsc' in cat else None)
    onco = True if 'onco' in cat else None
    pc_rel, pc_name = split_rel(row[C_PC])
    dm_rel, dm_name = split_rel(row[C_DM])
    dx = s(row[C_DX])
    prio = PRIO_MAP.get((s(row[C_PRIO]) or '').lower())
    schema = PatientCreateSchema(
        full_name=name, date_of_birth=dob, is_approximate_dob=approx,
        gender=(s(row[C_GENDER]) or '').title() or None,
        phone_number=digits(row[C_C1]), address_line1=s(row[C_ADDR]),
        diagnosis=dx[:100] if dx else None, referred_from=REFERRED_FROM,
        is_bangalore_resident=is_blr, geographic_cluster=zone, linked_hospital=linked,
        hospital_uhid=s(row[C_HOSP]), bsc_status=bsc, is_onco=onco,
        clinical_complexity=prio,
        alternative_phone=digits(row[C_C2]),
        primary_caregiver_name=pc_name,
        primary_caregiver_relationship=(pc_rel or None) and pc_rel[:50],
        primary_caregiver_phone=digits(row[C_C2]),
        decision_maker_name=dm_name,
        decision_maker_designation=(dm_rel or None) and dm_rel[:50],
        external_metadata={'source': SOURCE_SYSTEM, 'hospital_uhid': s(row[C_HOSP])},
    )
    extras = dict(uhid=s(row[C_HC]), hosp=s(row[C_HOSP]),
                  status=(s(row[C_STATUS]) or '').lower(),
                  dod=dt(row[C_DOD]), pod=POD_MAP.get((s(row[C_POD]) or '').lower()),
                  reg=dt(row[C_REG]), fc=dt(row[C_FC]))
    return schema, extras


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', default=DEFAULT_EXCEL)
    ap.add_argument('--admin-email', required=True)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--apply-uhid', action='store_true',
                    help='Also apply the UHID re-numbering (requires a resolved conflict policy)')
    args = ap.parse_args()

    app = create_app('development')
    with app.app_context():
        from app.common.models import User
        from app.patients.models import Patient
        from app.patients.services import PatientService
        from app.saranam.models.patient_visit import PatientVisit

        admin = User.query.filter_by(email=args.admin_email).first()
        if not admin:
            sys.exit(f'admin not found: {args.admin_email}')

        rows = [r for r in list(openpyxl.load_workbook(args.file, read_only=True, data_only=True)[SHEET]
                                .iter_rows(values_only=True))[1:]
                if any(c not in (None, '') for c in r)]

        zone_upd, prio_upd, uhid_upd, inserts = [], [], [], []
        for r in rows:
            hosp = s(r[C_HOSP])
            if not hosp:
                continue
            p = find_patient(hosp)
            if not p:
                inserts.append(r)
                continue
            z = zone_of(r[C_ZONE])
            if z and (p.geographic_cluster or '').strip().lower() != z.lower():
                zone_upd.append((p, z))
            pr = PRIO_MAP.get((s(r[C_PRIO]) or '').lower())
            if pr and p.clinical_complexity != pr:
                prio_upd.append((p, pr))
            u = s(r[C_HC])
            if u and s(p.uhid) != u:
                uhid_upd.append((p, u))

        mode = 'DRY RUN' if args.dry_run else 'APPLY'
        print(f'Mode: {mode}   sheet rows: {len(rows)}')
        print(f'  zone updates     : {len(zone_upd)}')
        print(f'  priority updates : {len(prio_upd)}')
        print(f'  inserts          : {len(inserts)}')
        print(f'  uhid changes     : {len(uhid_upd)}  (applied: {args.apply_uhid})')

        if args.dry_run:
            print('\n[zone]')
            for p, z in zone_upd[:60]:
                print(f'  {p.full_name:<24} {p.geographic_cluster} -> {z}')
            print('\n[priority]')
            for p, pr in prio_upd[:80]:
                print(f'  {p.full_name:<24} {p.clinical_complexity} -> {pr}')
            print('\n[inserts]')
            for r in inserts:
                print(f"  {' '.join(x for x in (s(r[C_FN]), s(r[C_LN])) if x)}  hosp={s(r[C_HOSP])}")
            return

        # ---- APPLY: zone + priority ----
        for p, z in zone_upd:
            p.geographic_cluster = z
        for p, pr in prio_upd:
            p.clinical_complexity = pr
        db.session.commit()
        print(f'\nApplied {len(zone_upd)} zone + {len(prio_upd)} priority updates.')

        # ---- APPLY: inserts ----
        created = 0
        for r in inserts:
            hosp = s(r[C_HOSP])
            if find_patient(hosp):
                continue  # idempotent
            schema, ex = build_insert_schema(r)
            pd = PatientService.create_patient(schema, created_by=admin.id)
            p = db.session.get(Patient, pd['id'])
            p.source_system = SOURCE_SYSTEM
            if ex['hosp']:
                p.external_id = ex['hosp']
            if ex['uhid'] and not Patient.query.filter_by(uhid=ex['uhid']).first():
                p.uhid = ex['uhid']
            if ex['status'] == 'deceased' or ex['dod']:
                p.is_deceased = True
                p.care_status = 'inactive'
                p.date_of_death = ex['dod']
                if ex['pod']:
                    p.place_of_death = ex['pod']
            if ex['reg']:
                p.created_at = ex['reg']
            if ex['fc']:
                iv = PatientVisit.query.filter_by(patient_id=p.id, visit_number=0).first()
                if iv:
                    iv.visit_date = ex['fc']
            db.session.commit()
            created += 1
            print(f"  + inserted {p.full_name} ({hosp})")
        print(f'Inserted {created} new patients.')

        if args.apply_uhid:
            print('\nUHID re-numbering not yet implemented — needs a resolved conflict policy.')


if __name__ == '__main__':
    main()
