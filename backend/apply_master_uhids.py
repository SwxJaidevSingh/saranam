#!/usr/bin/env python3
"""
Apply the client master sheet's Home care UHID as authoritative.

Policy (confirmed by user):
  - Match patients by Hospital UHID (hospital_uhid OR external_id).
  - Assign every sheet Home care UHID to its patient (override existing,
    fill empty).
  - Any existing patient whose UHID gets reassigned to a sheet patient and
    who has NO replacement number in the sheet -> set to NULL (displaced).

Safety: single transaction, two-phase to satisfy the UNIQUE(uhid) constraint:
  Phase 1 — NULL the uhid of every patient that is changing OR being displaced.
  Phase 2 — assign each changing patient its sheet uhid.
Final state is verified to contain no duplicate uhids before commit.

Usage:
    python apply_master_uhids.py --dry-run
    python apply_master_uhids.py            # applies
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

import openpyxl

from app import create_app
from app.extensions import db
from sqlalchemy import or_

DEFAULT_EXCEL = str(Path.home() / 'Downloads' / 'Saranam_Data_Master.xlsx')
SHEET = 'Socio_demographic'
C_HOSP, C_HC, C_FN, C_LN = 4, 6, 7, 8


def s(v):
    if v in (None, ''):
        return None
    x = str(v).strip()
    return x[:-2] if x.endswith('.0') else (x or None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', default=DEFAULT_EXCEL)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    app = create_app('development')
    with app.app_context():
        from app.patients.models import Patient

        rows = [r for r in list(openpyxl.load_workbook(args.file, read_only=True, data_only=True)[SHEET]
                                .iter_rows(values_only=True))[1:]
                if any(c not in (None, '') for c in r)]
        allp = Patient.query.all()
        holder_by_uhid = {s(p.uhid): p for p in allp if s(p.uhid)}

        # changing: matched patients whose sheet uhid differs from current
        changing = {}          # patient_id -> target uhid
        target_name = {}
        for r in rows:
            hosp = s(r[C_HOSP]); newu = s(r[C_HC])
            if not hosp or not newu:
                continue
            p = Patient.query.filter(or_(Patient.hospital_uhid == hosp,
                                         Patient.external_id == hosp)).first()
            if not p:
                continue
            if s(p.uhid) != newu:
                changing[p.id] = newu
                target_name[p.id] = p.full_name

        # displaced: current holder of a target uhid, not itself changing
        displaced = set()
        for pid, target in changing.items():
            h = holder_by_uhid.get(target)
            if h and h.id not in changing:
                displaced.add(h.id)

        # safety: target uhids must be distinct
        tdups = {u: n for u, n in Counter(changing.values()).items() if n > 1}
        if tdups:
            sys.exit(f'ABORT: duplicate target uhids in sheet: {tdups}')

        by_id = {p.id: p for p in allp}
        print(f'Assignments (override+fill): {len(changing)}')
        print(f'Patients to be NULLed (displaced): {len(displaced)}')

        if args.dry_run:
            print('\n--- sample assignments ---')
            for pid, u in list(changing.items())[:15]:
                print(f'  {target_name[pid]:<24} {s(by_id[pid].uhid)} -> {u}')
            print('\n--- patients to NULL ---')
            for did in list(displaced):
                h = by_id[did]
                print(f'  {h.full_name:<24} (loses {s(h.uhid)})')
            print('\n(dry-run: nothing written)')
            return

        # ---- Phase 1: free numbers (null changing + displaced that hold a uhid) ----
        to_null = [pid for pid in (set(changing) | displaced) if s(by_id[pid].uhid)]
        for pid in to_null:
            by_id[pid].uhid = None
        db.session.flush()   # emit the NULLs before assigning

        # ---- Phase 2: assign sheet uhids ----
        for pid, u in changing.items():
            by_id[pid].uhid = u
        db.session.flush()

        # ---- verify no dup before commit ----
        final = Counter(s(p.uhid) for p in Patient.query.all() if s(p.uhid))
        dups = {u: n for u, n in final.items() if n > 1}
        if dups:
            db.session.rollback()
            sys.exit(f'ABORT (rolled back): duplicate uhids in final state: {dups}')

        db.session.commit()
        nn = sum(1 for p in Patient.query.all() if s(p.uhid))
        print(f'\nDONE. Assigned {len(changing)} uhids, NULLed {len(displaced)} displaced.')
        print(f'Patients with a uhid now: {nn}')


if __name__ == '__main__':
    main()
