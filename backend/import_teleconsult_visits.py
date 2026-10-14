#!/usr/bin/env python3
"""
Import Teleconsult Visits from Excel (.xlsx) into the Database.

This script reads an Excel file containing teleconsultation records, resolves
the patient (by UHID, Phone, MRN, or Patient ID), and populates:
  1. `patient_visits`: Visit record with visit_type='teleconsult' and sequential visit_number.
  2. `tele_sessions`: Teleconsult session details (channel, timings, provider, status).
  3. `teleconsult_documentation`: Form SOP entries (who answered, severity, reason, symptoms, advice, notes).
  4. (Optional) Updates patient flags (bsc_status, is_onco) if present.

Usage:
    # 1. Generate an Excel template with sample rows:
    cmd /c python import_teleconsult_visits.py --generate-template teleconsult_template.xlsx

    # 2. Test run (Dry run, no DB changes):
    cmd /c python import_teleconsult_visits.py --file your_data.xlsx --dry-run

    # 3. Real import:
    cmd /c python import_teleconsult_visits.py --file your_data.xlsx --admin-email admin@saranam.in
"""

import argparse
import os
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import uuid

import pandas as pd

from app import create_app
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.teleconsult.models.tele_session import (
    TeleSession,
    STATUS_COMPLETED,
    STATUS_SCHEDULED,
    CHANNEL_VOICE,
    CHANNEL_VIDEO,
    VENDOR_MOCK,
)
from app.teleconsult.models.teleconsult_documentation import TeleconsultDocumentation
from app.providers.models import HealthcareProvider
from app.common.models import User


# ---------------------------------------------------------------------------
# Helpers for Column Matching & Value Cleaning
# ---------------------------------------------------------------------------

def _clean_str(val: Any) -> Optional[str]:
    """Strip string and convert pandas NaN / empty string to None."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s.endswith(".0"):
        # Strip trailing .0 commonly added by pandas for integer-like numeric cells
        s = s[:-2]
    return s if s else None


def _clean_phone(val: Any) -> Optional[str]:
    """Extract standard digits from a phone field."""
    raw = _clean_str(val)
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    # If standard 10-digit Indian mobile with leading 91, keep 10 digits
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if digits else None


def _parse_date(val: Any) -> date:
    """Parse date or datetime to date object; defaults to today if invalid/missing."""
    if pd.isna(val) or val is None:
        return date.today()
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val
    try:
        return pd.to_datetime(val).date()
    except Exception:
        return date.today()


def _parse_time(val: Any) -> Optional[str]:
    """Extract HH:MM format from time or string."""
    if pd.isna(val) or not val:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%H:%M")
    s = str(val).strip()
    match = re.search(r"(\d{1,2}:\d{2})", s)
    return match.group(1) if match else None


def _parse_bool(val: Any) -> Optional[bool]:
    """Parse boolean flag from yes/no/true/false."""
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip().lower()
    if s in ("1", "true", "yes", "y", "t", "bsc", "onco"):
        return True
    if s in ("0", "false", "no", "n", "f", "non_bsc", "non_onco"):
        return False
    return None


def _clean_column_name(col: str) -> str:
    """Normalize column header for flexible lookup."""
    return re.sub(r"[^a-z0-9]", "", str(col).lower())


class RowAccessor:
    """Case-insensitive, symbol-agnostic Excel row getter."""

    def __init__(self, row: pd.Series):
        self.data = {}
        for k, v in row.items():
            self.data[_clean_column_name(k)] = v

    def get(self, *aliases: str, default: Any = None) -> Any:
        for alias in aliases:
            norm = _clean_column_name(alias)
            if norm in self.data and not pd.isna(self.data[norm]):
                val = self.data[norm]
                if isinstance(val, str) and not val.strip():
                    continue
                return val
        return default


# ---------------------------------------------------------------------------
# Patient & Provider Resolution
# ---------------------------------------------------------------------------

def find_patient(acc: RowAccessor) -> Optional[Patient]:
    """Find patient by UUID, Homecare UHID (Patient.uhid), Hospital UHID, MRN, Phone, or Name."""
    # 1. By ID
    patient_id_raw = _clean_str(acc.get("patient_id", "patientuuid", "id"))
    if patient_id_raw:
        try:
            pid = uuid.UUID(patient_id_raw)
            p = Patient.query.get(pid)
            if p:
                return p
        except ValueError:
            pass

    # 2. By Homecare UHID (in database stored as Patient.uhid, e.g. '2026010001')
    homecare_uhid = _clean_str(acc.get("homecareuhid", "homecare_uhid", "uhid", "patient_uhid"))
    if homecare_uhid:
        p = Patient.query.filter(Patient.uhid == homecare_uhid).first()
        if p:
            return p
        if homecare_uhid.isdigit():
            p = Patient.query.filter(Patient.uhid == homecare_uhid.zfill(10)).first()
            if p:
                return p

    # 3. By Hospital UHID (in database stored as Patient.hospital_uhid)
    hosp_uhid = _clean_str(acc.get("hospitaluhid", "hospital_uhid"))
    if hosp_uhid:
        p = Patient.query.filter(Patient.hospital_uhid == hosp_uhid).first()
        if p:
            return p

    # 4. By MRN
    mrn = _clean_str(acc.get("mrn", "patient_mrn", "hospital_mrn"))
    if mrn:
        p = Patient.query.filter(
            (Patient.mrn == mrn) | (Patient.hospital_mrn == mrn)
        ).first()
        if p:
            return p

    # 5. By Phone
    phone = _clean_phone(acc.get("phone", "phone_number", "mobile", "contact_number"))
    if phone:
        p = Patient.query.filter(
            (Patient.phone == phone) | (Patient.phone_number == phone)
        ).first()
        if p:
            return p

    # 6. By First & Last Name or Patient Name
    first_name = _clean_str(acc.get("firstname", "first_name"))
    last_name = _clean_str(acc.get("lastname", "last_name"))
    name = _clean_str(acc.get("patient_name", "name", "full_name"))
    target_name = None
    if first_name:
        target_name = f"{first_name} {last_name}".strip() if last_name else first_name
    elif name:
        target_name = name.strip()

    if target_name:
        matches = Patient.query.filter(Patient.full_name.ilike(target_name)).all()
        if len(matches) == 1:
            return matches[0]

    return None


def find_provider(acc: RowAccessor) -> Optional[HealthcareProvider]:
    """Find doctor/provider by ID or Name."""
    prov_id = _clean_str(acc.get("provider_id", "doctor_id"))
    if prov_id:
        try:
            prov = HealthcareProvider.query.get(uuid.UUID(prov_id))
            if prov:
                return prov
        except ValueError:
            pass

    prov_name = _clean_str(acc.get("provider_name", "doctor_name", "provider", "doctor", "staff_name"))
    if prov_name:
        # Strip common titles like 'Dr.', 'Dr '
        cleaned = re.sub(r"^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+", "", prov_name, flags=re.IGNORECASE).strip()
        prov = HealthcareProvider.query.filter(
            (HealthcareProvider.full_name.ilike(f"%{cleaned}%"))
        ).first()
        if prov:
            return prov

    return None


# ---------------------------------------------------------------------------
# Import Row Processor
# ---------------------------------------------------------------------------

def process_teleconsult_row(
    row: pd.Series,
    call_seq: int = 1,
    created_by_user_id: Optional[uuid.UUID] = None,
    dry_run: bool = False,
) -> Tuple[str, str]:
    """
    Process a single row from the Excel file and create:
      - PatientVisit (visit_type='teleconsult')
      - TeleSession
      - TeleconsultDocumentation
    """
    acc = RowAccessor(row)

    # 1. Resolve Patient
    patient = find_patient(acc)
    if not patient:
        ident = (
            acc.get("homecareuhid")
            or acc.get("hospitaluhid")
            or acc.get("uhid")
            or acc.get("phone")
            or acc.get("firstname")
            or acc.get("patient_name")
            or "Unknown"
        )
        return "skipped_patient_not_found", f"Could not match patient ({ident})"

    # 2. Resolve Provider (optional)
    provider = find_provider(acc)

    # 3. Extract Visit Date & Time
    visit_date = _parse_date(acc.get("dateofcontact", "visit_date", "date", "consult_date", "session_date"))
    time_str = _parse_time(acc.get("visit_time", "time", "consult_time"))
    if time_str:
        try:
            hours, mins = [int(x) for x in time_str.split(":")[:2]]
            visit_datetime = datetime.combine(visit_date, datetime.min.time()).replace(hour=hours, minute=mins)
        except Exception:
            visit_datetime = datetime.combine(visit_date, datetime.min.time()).replace(hour=10, minute=0)
    else:
        # For multiple calls on the same day, space them out starting at 09:30 AM
        base_minutes = 9 * 60 + 30 + (call_seq - 1) * 30
        call_hour = min(base_minutes // 60, 18)
        call_min = base_minutes % 60
        visit_datetime = datetime.combine(visit_date, datetime.min.time()).replace(hour=call_hour, minute=call_min)

    # 4. Teleconsult Channel, Direction & Status
    channel_raw = _clean_str(acc.get("typeofcall", "channel", "call_type", "consult_type", "type", "mode")) or "voice"
    channel = CHANNEL_VIDEO if "video" in channel_raw.lower() else CHANNEL_VOICE

    direction_raw = _clean_str(acc.get("incomingoutgoingcall", "direction", "call_direction")) or "outbound"
    direction = "inbound" if "incom" in direction_raw.lower() or "inbound" in direction_raw.lower() else "outbound"

    consult_type = _clean_str(acc.get("typeofconsultation", "consultation_type"))

    status_raw = _clean_str(acc.get("status", "session_status")) or STATUS_COMPLETED
    status_lower = status_raw.lower()
    if "sched" in status_lower:
        session_status = STATUS_SCHEDULED
        visit_status = "scheduled"
    elif "cancel" in status_lower:
        session_status = "cancelled"
        visit_status = "cancelled"
    else:
        session_status = STATUS_COMPLETED
        visit_status = "completed"

    duration_min = acc.get("duration_minutes", "duration", "call_duration_minutes", default=15)
    try:
        duration_seconds = int(float(duration_min) * 60)
    except (ValueError, TypeError):
        duration_seconds = 900

    # 5. Documentation Form Fields
    who_answered_raw = _clean_str(acc.get("who_answered", "answered_by")) or "patient"
    wa_lower = who_answered_raw.lower()
    if "caregiver" in wa_lower:
        who_answered = "primary_caregiver"
        other_rel = None
    elif "other" in wa_lower:
        who_answered = "other"
        other_rel = _clean_str(acc.get("other_relationship", "relationship"))
    else:
        who_answered = "patient"
        other_rel = None

    severity_raw = _clean_str(acc.get("severity", "priority", "urgency")) or "low"
    sev_lower = severity_raw.lower()
    if "crit" in sev_lower or "emerg" in sev_lower:
        severity = "critical"
    elif "high" in sev_lower or "urgent" in sev_lower:
        severity = "high"
    elif "med" in sev_lower:
        severity = "medium"
    else:
        severity = "low"

    reason = _clean_str(acc.get("calltype", "reason", "chief_complaint", "complaint", "purpose"))
    symptoms = _clean_str(acc.get("signandsymptoms", "signsandsymptoms", "symptoms", "symptom_details", "clinical_findings"))
    advice = _clean_str(acc.get("advicegiven", "advice", "prescription", "recommendations", "plan"))
    notes_raw = _clean_str(acc.get("notes", "remarks", "documentation_notes", "summary"))
    
    notes_parts = []
    if consult_type:
        notes_parts.append(f"Consultation Type: {consult_type}")
    if notes_raw:
        notes_parts.append(notes_raw)
    notes = " | ".join(notes_parts) if notes_parts else None

    # Deterministic vendor_session_id to permit multiple calls on same date while preventing re-import duplicates
    ident_slug = patient.uhid or str(patient.id)[:8]
    vendor_session_id = f"import_phonecall_{ident_slug}_{visit_date}_{call_seq}"

    existing_session = TeleSession.query.filter_by(
        vendor_session_id=vendor_session_id
    ).first()

    if existing_session and existing_session.documentation:
        return "skipped_duplicate", f"Call #{call_seq} already exists for patient {patient.full_name} on {visit_date}"

    if dry_run:
        return "would_create", f"Ready to create teleconsult visit #{call_seq} for {patient.full_name} (UHID: {patient.uhid or 'N/A'}) on {visit_date} at {visit_datetime.strftime('%H:%M')} [{direction}]"

    # -----------------------------------------------------------------------
    # DB Creation: 1. PatientVisit
    # -----------------------------------------------------------------------
    visit_number = PatientVisit.next_visit_number(patient.id)

    visit = PatientVisit(
        patient_id=patient.id,
        visit_number=visit_number,
        visit_type="teleconsult",
        visit_date=visit_date,
        visit_location=channel,
        status=visit_status,
        created_by=created_by_user_id,
    )

    db.session.add(visit)
    db.session.flush()  # Populates visit.id

    # -----------------------------------------------------------------------
    # DB Creation: 2. TeleSession
    # -----------------------------------------------------------------------
    ended_at = visit_datetime + timedelta(seconds=duration_seconds)

    session = TeleSession(
        patient_id=patient.id,
        provider_id=provider.id if provider else None,
        linked_visit_id=visit.id,
        channel=channel,
        direction=direction,
        vendor_session_id=vendor_session_id,
        provider_vendor=VENDOR_MOCK,
        status=session_status,
        started_at=visit_datetime,
        ended_at=ended_at,
        duration_seconds=duration_seconds,
        notes=notes,
        created_by=created_by_user_id,
    )
    db.session.add(session)
    db.session.flush()  # Populates session.id

    # -----------------------------------------------------------------------
    # DB Creation: 3. TeleconsultDocumentation
    # -----------------------------------------------------------------------
    doc = TeleconsultDocumentation(
        session_id=session.id,
        who_answered=who_answered,
        other_relationship=other_rel,
        severity=severity,
        reason=reason,
        symptoms=symptoms,
        advice=advice,
        notes=notes,
    )
    db.session.add(doc)

    # -----------------------------------------------------------------------
    # Optional: Update Patient Tags (BSC Status & Oncology Status)
    # -----------------------------------------------------------------------
    bsc = _parse_bool(acc.get("bsc_status", "bsc"))
    if bsc is not None:
        patient.bsc_status = bsc

    is_onco = _parse_bool(acc.get("is_onco", "onco", "oncology"))
    if is_onco is not None:
        patient.is_onco = is_onco

    return "created", f"Created Teleconsult #{visit_number} for {patient.full_name} ({channel}, {severity}) on {visit_date}"


# ---------------------------------------------------------------------------
# Template Generator
# ---------------------------------------------------------------------------

def generate_template_excel(output_path: str):
    """Generate a ready-to-use template Excel workbook with sample data."""
    sample_data = [
        {
            "UHID": "2026010001",
            "Phone": "9876543210",
            "Patient Name": "Ramesh Kumar",
            "Doctor Name": "Dr. Sarah",
            "Visit Date": date.today().strftime("%Y-%m-%d"),
            "Visit Time": "10:30",
            "Channel": "voice",
            "Status": "completed",
            "Duration Minutes": 15,
            "Who Answered": "patient",
            "Other Relationship": "",
            "Severity": "low",
            "Reason": "Routine palliative follow up call",
            "Symptoms": "Mild nausea managed with ondansetron",
            "Advice": "Continue current medications, stay hydrated",
            "Notes": "Patient is in good spirits, caregiver supportive",
            "BSC Status": "Yes",
            "Is Onco": "Yes",
            "Pulse": 76,
            "BP Systolic": 120,
            "BP Diastolic": 80,
            "SpO2": 98,
        },
        {
            "UHID": "2026010002",
            "Phone": "9123456780",
            "Patient Name": "Sunita Devi",
            "Doctor Name": "Dr. Sarah",
            "Visit Date": date.today().strftime("%Y-%m-%d"),
            "Visit Time": "11:15",
            "Channel": "video",
            "Status": "completed",
            "Duration Minutes": 20,
            "Who Answered": "primary_caregiver",
            "Other Relationship": "",
            "Severity": "medium",
            "Reason": "Pain escalation in lower back",
            "Symptoms": "VAS pain score 6/10, difficulty sleeping",
            "Advice": "Titrated morphine syrup from 5mg to 10mg q4h, review in 48h",
            "Notes": "Daughter answered the call, demonstrated dose administration",
            "BSC Status": "No",
            "Is Onco": "Yes",
            "Pulse": 84,
            "BP Systolic": 130,
            "BP Diastolic": 85,
            "SpO2": 96,
        },
    ]

    df = pd.DataFrame(sample_data)
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Teleconsults")

    print(f"Generated template file: {output_path}")
    print("Columns included:")
    for col in df.columns:
        print(f"  - {col}")


# ---------------------------------------------------------------------------
# Main CLI Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import teleconsult visits from an Excel file.")
    parser.add_argument("--file", "-f", help="Path to Excel (.xlsx) file")
    parser.add_argument("--sheet", "-s", default=0, help="Sheet name or index (default: first sheet)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate import without modifying database")
    parser.add_argument("--admin-email", help="Email of user to record as creator (optional)")
    parser.add_argument("--generate-template", help="Generate an empty sample Excel template at specified path")
    parser.add_argument("--limit", type=int, default=None, help="Limit to first N rows")
    args = parser.parse_args()

    # Template generation branch
    if args.generate_template:
        generate_template_excel(args.generate_template)
        return

    if not args.file:
        parser.error("Please provide an Excel file path with --file, or use --generate-template to make a template.")

    excel_path = Path(args.file)
    if not excel_path.exists():
        sys.exit(f"Error: File not found: {args.file}")

    app = create_app("development")
    with app.app_context():
        created_by_user_id = None
        if args.admin_email:
            user = User.query.filter_by(email=args.admin_email).first()
            if not user:
                print(f"Warning: Admin user '{args.admin_email}' not found. Leaving created_by as NULL.")
            else:
                created_by_user_id = user.id

        print(f"\n=======================================================")
        print(f"  TELECONSULT EXCEL IMPORT")
        print(f"=======================================================")
        print(f"File     : {excel_path.resolve()}")
        print(f"Mode     : {'DRY RUN (No changes saved)' if args.dry_run else 'LIVE IMPORT (Saving to DB)'}")
        if created_by_user_id:
            print(f"User     : {args.admin_email} ({created_by_user_id})")

        # Load Excel
        try:
            df = pd.read_excel(excel_path, sheet_name=args.sheet)
        except Exception as e:
            sys.exit(f"Failed to read Excel file: {e}")

        if args.limit:
            df = df.head(args.limit)

        total_rows = len(df)
        print(f"Total Rows to Process: {total_rows}\n")

        stats = {
            "created": 0,
            "would_create": 0,
            "skipped_duplicate": 0,
            "skipped_patient_not_found": 0,
            "errors": 0,
        }
        details = []

        from collections import defaultdict
        call_tracker = defaultdict(int)

        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-indexed + 1 for Excel header
            try:
                acc = RowAccessor(row)
                p = find_patient(acc)
                v_date = _parse_date(acc.get("dateofcontact", "visit_date", "date", "consult_date", "session_date"))
                key = (p.id if p else None, v_date)
                call_tracker[key] += 1
                call_seq = call_tracker[key]

                outcome, msg = process_teleconsult_row(
                    row=row,
                    call_seq=call_seq,
                    created_by_user_id=created_by_user_id,
                    dry_run=args.dry_run,
                )
                stats[outcome] = stats.get(outcome, 0) + 1
                details.append((row_num, outcome, msg))

                marker = "+" if outcome in ("created", "would_create") else ("~" if "skipped" in outcome else "!")
                print(f"  Row {row_num:3d} [{marker}] {outcome:<26s} : {msg}")

                if not args.dry_run and outcome == "created":
                    db.session.commit()

            except Exception as e:
                db.session.rollback()
                stats["errors"] += 1
                err_msg = f"Exception: {str(e)}"
                details.append((row_num, "error", err_msg))
                print(f"  Row {row_num:3d} [!] {'error':<26s} : {err_msg}")

        print(f"\n---------------- SUMMARY ----------------")
        for k, v in stats.items():
            if v > 0:
                print(f"  {k:<28s}: {v}")
        print(f"-----------------------------------------\n")

        if args.dry_run:
            print("Tip: Run without --dry-run to commit these records to the database.\n")


if __name__ == "__main__":
    main()
