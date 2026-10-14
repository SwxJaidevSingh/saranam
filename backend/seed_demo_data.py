"""
Comprehensive demo data seed script for Saranam palliative care platform.

Run from the backend directory:
    cd backend && source venv/bin/activate && python seed_demo_data.py

This script ONLY ADDS new records — it never deletes existing data.
It checks for existing records before creating to allow safe re-runs.
"""

import json
import random
from datetime import date, datetime, timedelta
from uuid import uuid4
from decimal import Decimal

from app import create_app
from app.extensions import db
from app.common.models import User
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.encounters.models import Encounter
from app.diagnoses.models import Diagnosis
from app.inventory.models import (
    MedicineMaster, InventoryLocation, InventoryStock, MedicineBatch,
    Supplier, PurchaseOrder, PurchaseOrderItem,
    DosageForm, DrugSchedule, LocationType, POStatus, StockStatus, BatchStatus,
)
from app.opd.models import OPDPrescription, OPDPrescriptionItem, PrescriptionStatus
from app.ipd.models import IPDAdmission, Bed, BedAssignment
from app.saranam.models import (
    PatientVisit, NursingAssessment, DoctorAssessment,
    PsychologicalAssessment, PhysiotherapyAssessment,
    EsasScore, PpsScore, PlanOfCare,
    GeographicCluster, Vehicle, WeeklySchedule, ScheduleDay,
    ScheduleSlot, ScheduleTeamAssignment, PatientSchedulingMeta,
)

# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

providers_data = [
    {"name": "Dr. Priya Sharma", "spec": "Palliative Medicine", "dept": "Palliative Care", "qual": "MBBS, MD Palliative", "email": "priya.sharma@saranam.org", "phone": "9845001001", "license": "KMC-2015-001", "exp": 10},
    {"name": "Nurse Lakshmi R", "spec": "Nursing", "dept": "Palliative Care", "qual": "BSc Nursing", "email": "lakshmi.r@saranam.org", "phone": "9845001002", "license": "KNC-2018-042", "exp": 6},
    {"name": "Meera Krishnan", "spec": "Psychology", "dept": "Palliative Care", "qual": "MSc Psychology, RCI", "email": "meera.k@saranam.org", "phone": "9845001003", "license": "RCI-2019-103", "exp": 5},
    {"name": "Rajesh PT", "spec": "Physiotherapy", "dept": "Palliative Care", "qual": "BPT, MPT Neuro", "email": "rajesh.pt@saranam.org", "phone": "9845001004", "license": "IAP-2017-089", "exp": 7},
    {"name": "Sunil Kumar", "spec": "Social Work", "dept": "Palliative Care", "qual": "MSW", "email": "sunil.k@saranam.org", "phone": "9845001005", "license": "NSW-2020-056", "exp": 4},
]

medicines_data = [
    {"name": "Morphine Sulfate IR", "generic": "Morphine Sulfate", "brand": "Morcontin", "form": "Tablet", "strength": "10mg", "category": "Analgesic-Opioid", "drug_class": "H", "controlled": True, "route": "oral"},
    {"name": "Paracetamol", "generic": "Acetaminophen", "brand": "Crocin", "form": "Tablet", "strength": "500mg", "category": "Analgesic-Antipyretic", "drug_class": "G", "controlled": False, "route": "oral"},
    {"name": "Metoclopramide", "generic": "Metoclopramide HCl", "brand": "Perinorm", "form": "Tablet", "strength": "10mg", "category": "Antiemetic", "drug_class": "H", "controlled": False, "route": "oral"},
    {"name": "Dexamethasone", "generic": "Dexamethasone", "brand": "Decdan", "form": "Tablet", "strength": "4mg", "category": "Corticosteroid", "drug_class": "H", "controlled": False, "route": "oral"},
    {"name": "Lactulose Solution", "generic": "Lactulose", "brand": "Duphalac", "form": "Syrup", "strength": "10g/15ml", "category": "Laxative", "drug_class": "G", "controlled": False, "route": "oral"},
    {"name": "Amitriptyline", "generic": "Amitriptyline HCl", "brand": "Tryptomer", "form": "Tablet", "strength": "25mg", "category": "Antidepressant-TCA", "drug_class": "H", "controlled": False, "route": "oral"},
    {"name": "Diclofenac Sodium", "generic": "Diclofenac", "brand": "Voveran", "form": "Tablet", "strength": "50mg", "category": "NSAID", "drug_class": "H", "controlled": False, "route": "oral"},
    {"name": "Omeprazole", "generic": "Omeprazole", "brand": "Omez", "form": "Capsule", "strength": "20mg", "category": "PPI", "drug_class": "H", "controlled": False, "route": "oral"},
    {"name": "Haloperidol", "generic": "Haloperidol", "brand": "Serenace", "form": "Tablet", "strength": "1.5mg", "category": "Antipsychotic", "drug_class": "H", "controlled": True, "route": "oral"},
    {"name": "Bisacodyl", "generic": "Bisacodyl", "brand": "Dulcolax", "form": "Tablet", "strength": "5mg", "category": "Laxative", "drug_class": "G", "controlled": False, "route": "oral"},
]

patients_data = [
    {"name": "Manjulamma B", "dob": "1958-03-15", "gender": "Female", "bsc": True, "is_onco": True, "zone": "North", "complexity": "high", "phone": "9876100001", "address": "45 Rajajinagar, Bangalore 560010", "pin": "560010",
     "visits": 4, "opd": True, "ipd": False, "diagnosis": "Stage IV Breast Cancer"},
    {"name": "Ramesh Gowda", "dob": "1954-08-22", "gender": "Male", "bsc": True, "is_onco": True, "zone": "South", "complexity": "high", "phone": "9876100002", "address": "123 Jayanagar 4th Block, Bangalore 560041", "pin": "560041",
     "visits": 3, "opd": False, "ipd": True, "diagnosis": "Advanced Lung Cancer with Brain Mets"},
    {"name": "Lakshmi Devi N", "dob": "1971-11-05", "gender": "Female", "bsc": True, "is_onco": True, "zone": "East", "complexity": "medium", "phone": "9876100003", "address": "78 Indiranagar, Bangalore 560038", "pin": "560038",
     "visits": 2, "opd": False, "ipd": False, "diagnosis": "Cervical Cancer Stage III"},
    {"name": "Suresh Patil", "dob": "1961-06-30", "gender": "Male", "bsc": False, "is_onco": True, "zone": "West", "complexity": "medium", "phone": "9876100004", "address": "56 Rajajinagar, Bangalore 560055", "pin": "560055",
     "visits": 3, "opd": True, "ipd": False, "diagnosis": "Head and Neck Cancer"},
    {"name": "Anita Rao", "dob": "1978-02-14", "gender": "Female", "bsc": False, "is_onco": False, "zone": "Central", "complexity": "low", "phone": "9876100005", "address": "90 Shivajinagar, Bangalore 560001", "pin": "560001",
     "visits": 2, "opd": False, "ipd": False, "diagnosis": "Chronic Heart Failure - Palliative"},
    {"name": "Venkatesh K", "dob": "1948-09-11", "gender": "Male", "bsc": True, "is_onco": True, "zone": "North", "complexity": "high", "phone": "9876100006", "address": "34 Malleswaram, Bangalore 560003", "pin": "560003",
     "visits": 5, "opd": True, "ipd": True, "diagnosis": "Gastric Cancer Stage IV"},
    {"name": "Padma Hegde", "dob": "1964-04-20", "gender": "Female", "bsc": False, "is_onco": True, "zone": "East", "complexity": "medium", "phone": "9876100007", "address": "12 Whitefield, Bangalore 560066", "pin": "560066",
     "visits": 2, "opd": False, "ipd": False, "diagnosis": "Ovarian Cancer Stage II"},
    {"name": "Krishnamurthy S", "dob": "1956-12-01", "gender": "Male", "bsc": True, "is_onco": False, "zone": "South", "complexity": "high", "phone": "9876100008", "address": "67 Banashankari, Bangalore 560070", "pin": "560070",
     "visits": 3, "opd": True, "ipd": False, "diagnosis": "End-stage Renal Disease - Palliative"},
    {"name": "Savitri Kumari", "dob": "1968-07-18", "gender": "Female", "bsc": False, "is_onco": False, "zone": "West", "complexity": "low", "phone": "9876100009", "address": "89 Vijayanagar, Bangalore 560040", "pin": "560040",
     "visits": 1, "opd": False, "ipd": False, "diagnosis": "Advanced COPD - Palliative"},
    {"name": "Nagesh Reddy", "dob": "1951-01-25", "gender": "Male", "bsc": False, "is_onco": True, "zone": "Central", "complexity": "medium", "phone": "9876100010", "address": "23 Basavanagudi, Bangalore 560004", "pin": "560004",
     "visits": 2, "opd": False, "ipd": False, "diagnosis": "Colorectal Cancer Post-surgery"},
]

# Mapping for schedule team roles
SPEC_TO_ROLE = {
    "Palliative Medicine": "physician",
    "Nursing": "nurse",
    "Psychology": "counselor",
    "Physiotherapy": "physio",
    "Social Work": "social_worker",
}

DOSAGE_FORM_MAP = {
    "Tablet": DosageForm.TABLET,
    "Capsule": DosageForm.CAPSULE,
    "Syrup": DosageForm.SYRUP,
}

DRUG_SCHEDULE_MAP = {
    "H": DrugSchedule.H,
    "G": DrugSchedule.G,
}

# Cluster colors
CLUSTER_COLORS = {
    "North": "#EF4444",
    "South": "#3B82F6",
    "East": "#10B981",
    "West": "#F59E0B",
    "Central": "#8B5CF6",
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_or_create_cluster(zone_name):
    """Find or create a geographic cluster by zone name."""
    cluster = GeographicCluster.query.filter_by(name=zone_name).first()
    if not cluster:
        cluster = GeographicCluster(
            id=uuid4(),
            name=zone_name,
            color_hex=CLUSTER_COLORS.get(zone_name, "#3B82F6"),
            pin_codes=[],
            sort_order=list(CLUSTER_COLORS.keys()).index(zone_name) if zone_name in CLUSTER_COLORS else 0,
            is_active=True,
        )
        db.session.add(cluster)
        db.session.flush()
        print(f"  + Created cluster: {zone_name}")
    return cluster


def random_vitals(base_bp_sys=120, base_bp_dia=80, variation=10):
    """Generate random but realistic vitals with slight variation."""
    return {
        "pr": random.randint(60, 100),
        "bp_sys": base_bp_sys + random.randint(-variation, variation),
        "bp_dia": base_bp_dia + random.randint(-variation // 2, variation // 2),
        "rr": random.randint(14, 22),
        "spo2": round(random.uniform(94.0, 99.0), 1),
        "temp": round(random.uniform(97.5, 99.5), 1),
        "grbs": round(random.uniform(90.0, 140.0), 1),
    }


def make_esas(is_bsc, visit_index=0, total_visits=1):
    """Generate ESAS scores. BSC patients have higher scores; trending down over visits."""
    base_high = 6 if is_bsc else 3
    base_low = 2 if is_bsc else 1
    # Improvement factor: scores decrease slightly with later visits
    improvement = min(visit_index, 3)
    scores = {}
    for sym in ["pain", "tiredness", "nausea", "depression", "anxiety",
                "drowsiness", "appetite", "wellbeing", "shortness_of_breath"]:
        raw = random.randint(base_low, base_high + 2) - improvement
        scores[sym] = max(0, min(10, raw))
    scores["total_score"] = sum(scores.values())
    return scores


def make_pps(is_bsc, visit_index=0):
    """Generate PPS score. BSC patients lower; trending may improve."""
    if is_bsc:
        base = random.choice([30, 40, 50])
    else:
        base = random.choice([50, 60, 70, 80])
    # Slight improvement over visits
    score = min(100, base + visit_index * 5)
    # Round to nearest 10
    score = round(score / 10) * 10

    pps_lookup = {
        100: ("Full", "Normal activity", "Full", "Normal", "Full"),
        90: ("Full", "Normal activity", "Full", "Normal", "Full"),
        80: ("Full", "Normal activity with effort", "Full", "Normal or reduced", "Full"),
        70: ("Reduced", "Unable normal job", "Full", "Normal or reduced", "Full"),
        60: ("Reduced", "Unable hobby", "Occasional assistance", "Normal or reduced", "Full or confusion"),
        50: ("Mainly sit/lie", "Unable to do any work", "Considerable assistance", "Normal or reduced", "Full or drowsy"),
        40: ("Mainly in bed", "As above", "Mainly assistance", "Normal or reduced", "Full or drowsy +/- confusion"),
        30: ("Totally bed bound", "As above", "Total care", "Reduced", "Full or drowsy +/- confusion"),
        20: ("Totally bed bound", "As above", "Total care", "Minimal sips", "Full or drowsy +/- confusion"),
        10: ("Totally bed bound", "As above", "Total care", "Mouth care only", "Drowsy or coma"),
        0: ("Death", "", "", "", ""),
    }
    lookup = pps_lookup.get(score, pps_lookup[50])
    return {
        "pps_score": score,
        "ambulation": lookup[0],
        "activity_level": lookup[1],
        "self_care": lookup[2],
        "intake": lookup[3],
        "consciousness_level": lookup[4],
    }


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

def seed():
    print("=" * 60)
    print("SARANAM DEMO DATA SEED")
    print("=" * 60)

    # Counters
    counts = {
        "providers": 0,
        "medicines": 0,
        "patients": 0,
        "visits": 0,
        "assessments": 0,
        "opd_encounters": 0,
        "ipd_admissions": 0,
        "schedules": 0,
    }

    # Find admin user
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        print("ERROR: No admin user found. Please create one first.")
        return
    print(f"Using admin user: {admin.email} ({admin.id})")

    # ------------------------------------------------------------------
    # 1. PROVIDERS
    # ------------------------------------------------------------------
    print("\n--- Creating Providers ---")
    created_providers = []
    for pd in providers_data:
        existing_user = User.query.filter_by(email=pd["email"]).first()
        if existing_user:
            # Check if provider already exists
            existing_provider = HealthcareProvider.query.filter_by(user_id=existing_user.id).first()
            if existing_provider:
                print(f"  ~ Skipping (exists): {pd['name']}")
                created_providers.append(existing_provider)
                continue
            user = existing_user
        else:
            user = User(
                id=uuid4(),
                email=pd["email"],
                full_name=pd["name"],
                role="data_entry",
                is_active=True,
                is_approved=True,
            )
            user.set_password("demo123")
            db.session.add(user)
            db.session.flush()

        # Check if provider with this license already exists
        existing_provider = HealthcareProvider.query.filter_by(license_number=pd["license"]).first()
        if existing_provider:
            print(f"  ~ Skipping provider (license exists): {pd['name']}")
            created_providers.append(existing_provider)
            continue

        provider = HealthcareProvider(
            id=uuid4(),
            user_id=user.id,
            full_name=pd["name"],
            specialization=pd["spec"],
            department=pd["dept"],
            qualification=pd["qual"],
            license_number=pd["license"],
            years_of_experience=pd["exp"],
            is_active=True,
            created_by=admin.id,
        )
        provider.set_email(pd["email"])
        provider.set_phone(pd["phone"])
        db.session.add(provider)
        db.session.flush()
        created_providers.append(provider)
        counts["providers"] += 1
        print(f"  + Created provider: {pd['name']}")

    db.session.commit()
    print(f"  Providers committed: {counts['providers']}")

    # ------------------------------------------------------------------
    # 2. MEDICINES + INVENTORY
    # ------------------------------------------------------------------
    print("\n--- Creating Medicines & Inventory ---")

    # Find or create pharmacy location
    pharmacy = InventoryLocation.query.filter_by(location_name="Main Pharmacy").first()
    if not pharmacy:
        pharmacy = InventoryLocation(
            id=uuid4(),
            location_code="PHARM-001",
            location_name="Main Pharmacy",
            location_type=LocationType.PHARMACY,
            is_active=True,
        )
        db.session.add(pharmacy)
        db.session.flush()
        print("  + Created location: Main Pharmacy")

    created_medicines = []
    for md in medicines_data:
        existing = MedicineMaster.query.filter_by(medicine_name=md["name"]).first()
        if existing:
            print(f"  ~ Skipping medicine (exists): {md['name']}")
            created_medicines.append(existing)
            continue

        med = MedicineMaster(
            id=uuid4(),
            medicine_code=f"MED{random.randint(100000, 999999)}",
            medicine_name=md["name"],
            generic_name=md["generic"],
            brand_name=md["brand"],
            dosage_form=DOSAGE_FORM_MAP.get(md["form"]),
            strength=md["strength"],
            therapeutic_category=md["category"],
            drug_class=DRUG_SCHEDULE_MAP.get(md["drug_class"]),
            controlled_substance=md["controlled"],
            is_active=True,
            created_by=admin.id,
        )
        db.session.add(med)
        db.session.flush()

        # Create inventory stock
        stock_qty = random.randint(50, 500)
        stock = InventoryStock(
            id=uuid4(),
            medicine_id=med.id,
            location_id=pharmacy.id,
            current_stock=Decimal(stock_qty),
            par_level=Decimal(100),
            reorder_level=Decimal(50),
            stock_status=StockStatus.OPTIMAL,
            unit_cost=Decimal(str(round(random.uniform(5.0, 200.0), 2))),
        )
        db.session.add(stock)

        # Create batch
        batch = MedicineBatch(
            id=uuid4(),
            medicine_id=med.id,
            location_id=pharmacy.id,
            batch_number=f"B{random.randint(10000, 99999)}",
            manufacture_date=date(2025, 6, 1),
            expiry_date=date(2027, 12, 31),
            received_date=date(2025, 12, 1),
            initial_quantity=Decimal(stock_qty),
            current_quantity=Decimal(stock_qty),
            status=BatchStatus.ACTIVE,
        )
        db.session.add(batch)

        created_medicines.append(med)
        counts["medicines"] += 1
        print(f"  + Created medicine: {md['name']} (stock: {stock_qty})")

    db.session.flush()

    # Create supplier
    supplier = Supplier.query.filter_by(supplier_name="Bengaluru Medical Supplies").first()
    if not supplier:
        supplier = Supplier(
            id=uuid4(),
            supplier_code="SUP-BMS-001",
            supplier_name="Bengaluru Medical Supplies",
            company_name="Bengaluru Medical Supplies Pvt Ltd",
            supplier_type="distributor",
            city="Bangalore",
            state="Karnataka",
            pincode="560001",
            country="India",
            phone="9800000001",
            email="orders@bmspharma.in",
            payment_terms="Net 30",
            is_active=True,
            created_by=admin.id,
        )
        db.session.add(supplier)
        db.session.flush()
        print("  + Created supplier: Bengaluru Medical Supplies")

    # Create purchase order
    existing_po = PurchaseOrder.query.filter_by(po_number="PO-DEMO-001").first()
    if not existing_po:
        po = PurchaseOrder(
            id=uuid4(),
            po_number="PO-DEMO-001",
            po_date=date(2025, 12, 1),
            supplier_id=supplier.id,
            expected_delivery_date=date(2025, 12, 10),
            actual_delivery_date=date(2025, 12, 8),
            delivery_location_id=pharmacy.id,
            status=POStatus.RECEIVED,
            subtotal=Decimal("25000.00"),
            tax_amount=Decimal("4500.00"),
            total_amount=Decimal("29500.00"),
            created_by=admin.id,
        )
        db.session.add(po)
        db.session.flush()

        # Add 5 PO items (first 5 medicines)
        for i, med in enumerate(created_medicines[:5]):
            qty = random.randint(50, 200)
            unit_price = round(random.uniform(10.0, 100.0), 2)
            po_item = PurchaseOrderItem(
                id=uuid4(),
                purchase_order_id=po.id,
                medicine_id=med.id,
                ordered_quantity=Decimal(qty),
                received_quantity=Decimal(qty),
                unit_price=Decimal(str(unit_price)),
                total_amount=Decimal(str(round(qty * unit_price, 2))),
                receipt_status="received",
            )
            db.session.add(po_item)
        print("  + Created PO-DEMO-001 with 5 items")

    db.session.commit()
    print(f"  Medicines committed: {counts['medicines']}")

    # ------------------------------------------------------------------
    # 3. PATIENTS, VISITS, ASSESSMENTS
    # ------------------------------------------------------------------
    print("\n--- Creating Patients, Visits & Assessments ---")
    today = date.today()
    created_patient_objects = []

    for pdata in patients_data:
        # Check if patient already exists
        existing_patient = Patient.query.filter_by(full_name=pdata["name"]).first()
        if existing_patient:
            print(f"  ~ Skipping patient (exists): {pdata['name']}")
            created_patient_objects.append(existing_patient)
            continue

        # --- Patient record ---
        patient = Patient(
            id=uuid4(),
            full_name=pdata["name"],
            date_of_birth=date.fromisoformat(pdata["dob"]),
            gender=pdata["gender"],
            is_bangalore_resident=True,
            geographic_cluster=pdata["zone"],
            bsc_status=pdata["bsc"],
            is_onco=pdata.get("is_onco", True),
            clinical_complexity=pdata["complexity"],
            source_system="cv_raman",
            is_active=True,
            created_by=admin.id,
        )
        patient.set_contact(json.dumps({"phone": pdata["phone"], "email": f"{pdata['name'].split()[0].lower()}@example.com"}))
        patient.set_address(pdata["address"])
        db.session.add(patient)
        db.session.flush()
        counts["patients"] += 1
        print(f"\n  + Patient: {pdata['name']}")

        # --- PatientSchedulingMeta ---
        cluster = get_or_create_cluster(pdata["zone"])
        sched_meta = PatientSchedulingMeta(
            id=uuid4(),
            patient_id=patient.id,
            cluster_id=cluster.id,
            complexity=pdata["complexity"],
            care_status="bsc" if pdata["bsc"] else "n_bsc",
            is_onco=pdata.get("is_onco", True),
            recommended_frequency_days=7 if pdata["bsc"] else 14,
            scheduling_active=True,
        )
        db.session.add(sched_meta)
        db.session.flush()

        # Determine visit dates: initial ~4 weeks ago, follow-ups spread across last 3-4 weeks
        num_follow_ups = pdata["visits"]  # visits field = number of follow-ups
        total_visits = 1 + num_follow_ups  # initial + follow-ups
        initial_date = today - timedelta(days=28 + random.randint(0, 7))
        follow_up_dates = []
        if num_follow_ups > 0:
            interval = max(3, 21 // num_follow_ups)
            for i in range(num_follow_ups):
                fd = initial_date + timedelta(days=(i + 1) * interval + random.randint(-1, 1))
                if fd >= today:
                    fd = today - timedelta(days=random.randint(1, 3))
                follow_up_dates.append(fd)

        # Pick provider for this patient
        doctor = created_providers[0]  # Dr. Priya
        nurse = created_providers[1]   # Nurse Lakshmi
        nurse_user = User.query.filter_by(email="lakshmi.r@saranam.org").first()
        doctor_user = User.query.filter_by(email="priya.sharma@saranam.org").first()
        psych_user = User.query.filter_by(email="meera.k@saranam.org").first()
        physio_user = User.query.filter_by(email="rajesh.pt@saranam.org").first()

        # Base vitals for this patient
        base_bp_sys = random.randint(110, 140)
        base_bp_dia = random.randint(70, 90)

        # ---- INITIAL VISIT (visit_number=0) ----
        vitals = random_vitals(base_bp_sys, base_bp_dia)
        initial_visit = PatientVisit(
            id=uuid4(),
            patient_id=patient.id,
            visit_number=0,
            visit_type="initial",
            visit_date=initial_date,
            visit_location="home",
            vitals_pr=vitals["pr"],
            vitals_bp_systolic=vitals["bp_sys"],
            vitals_bp_diastolic=vitals["bp_dia"],
            vitals_rr=vitals["rr"],
            vitals_spo2=Decimal(str(vitals["spo2"])),
            vitals_temperature=Decimal(str(vitals["temp"])),
            vitals_grbs=Decimal(str(vitals["grbs"])),
            status="completed",
            visit_summary=f"Initial assessment for {pdata['diagnosis']}. Patient is {'BSC' if pdata['bsc'] else 'non-BSC'} with {pdata['complexity']} complexity.",
            created_by=admin.id,
        )
        db.session.add(initial_visit)
        db.session.flush()
        counts["visits"] += 1

        # -- All assessments for initial visit --
        # Nursing Assessment
        adl_val = "needs assistance" if pdata["bsc"] else random.choice(["independent", "needs assistance"])
        na = NursingAssessment(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            consciousness="alert",
            orientation="oriented",
            adl=adl_val,
            pain_score=random.randint(2, 8),
            hygiene_general="good",
            demeanor=random.choice(["cooperative", "anxious", "calm"]),
            built=random.choice(["average", "thin", "obese"]),
            assessed_by=nurse_user.id if nurse_user else admin.id,
        )
        db.session.add(na)
        counts["assessments"] += 1

        # Doctor Assessment
        comorbidities = random.choice(["Hypertension", "Hypertension, Diabetes Mellitus", "Hypertension"])
        da = DoctorAssessment(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            chief_complaints=f"Presenting with {pdata['diagnosis']}. Pain and symptom management needed.",
            diagnosis=pdata["diagnosis"],
            comorbidities=comorbidities,
            medication_history="On regular medications for comorbidities.",
            doctor_notes=f"Initial assessment done. {pdata['complexity'].capitalize()} complexity case. {'BSC protocol initiated.' if pdata['bsc'] else 'Regular follow-up planned.'}",
            diet=random.choice(["normal", "soft", "liquid"]),
            appetite=random.choice(["good", "poor", "reduced"]),
            assessed_by=doctor_user.id if doctor_user else admin.id,
        )
        db.session.add(da)
        counts["assessments"] += 1

        # Psychological Assessment
        mood_options = ["anxious", "hopeful", "depressed", "calm", "worried"]
        pa = PsychologicalAssessment(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            patient_mood=random.choice(mood_options),
            distress_score=random.randint(3, 7),
            family_support_notes=random.choice([
                "Good family support system. Spouse is primary caregiver.",
                "Limited family support. Daughter visits twice a week.",
                "Excellent family support. Joint family living together.",
                "Moderate support. Son manages care with help of neighbors.",
            ]),
            patient_sleep=random.choice(["disturbed", "adequate", "poor"]),
            caregiver_mood=random.choice(["stressed", "coping", "supportive", "overwhelmed"]),
            assessed_by=psych_user.id if psych_user else admin.id,
        )
        db.session.add(pa)
        counts["assessments"] += 1

        # Physiotherapy Assessment
        func_status = "bed-bound" if pdata["bsc"] and pdata["complexity"] == "high" else random.choice(["ambulatory", "ambulatory with aid", "wheelchair-bound"])
        pta = PhysiotherapyAssessment(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            pain_vas_score=random.randint(3, 7),
            pain_area=random.choice(["lower back", "bilateral lower limbs", "neck and shoulders", "chest wall"]),
            pain_nature=random.choice(["dull aching", "sharp", "burning", "throbbing"]),
            exam_functional_status=func_status,
            obs_built=random.choice(["average", "thin"]),
            physio_notes="Initial physiotherapy assessment completed. Exercises and mobility plan to be started.",
            assessed_by=physio_user.id if physio_user else admin.id,
        )
        db.session.add(pta)
        counts["assessments"] += 1

        # ESAS Score
        esas_data = make_esas(pdata["bsc"], visit_index=0, total_visits=total_visits)
        esas = EsasScore(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            pain=esas_data["pain"],
            tiredness=esas_data["tiredness"],
            nausea=esas_data["nausea"],
            depression=esas_data["depression"],
            anxiety=esas_data["anxiety"],
            drowsiness=esas_data["drowsiness"],
            appetite=esas_data["appetite"],
            wellbeing=esas_data["wellbeing"],
            shortness_of_breath=esas_data["shortness_of_breath"],
            total_score=esas_data["total_score"],
            recorded_by=nurse_user.id if nurse_user else admin.id,
        )
        db.session.add(esas)
        counts["assessments"] += 1

        # PPS Score
        pps_data = make_pps(pdata["bsc"], visit_index=0)
        pps = PpsScore(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            pps_score=pps_data["pps_score"],
            ambulation=pps_data["ambulation"],
            activity_level=pps_data["activity_level"],
            self_care=pps_data["self_care"],
            intake=pps_data["intake"],
            consciousness_level=pps_data["consciousness_level"],
            recorded_by=doctor_user.id if doctor_user else admin.id,
        )
        db.session.add(pps)
        counts["assessments"] += 1

        # Plan of Care
        meds_for_plan = random.sample(medicines_data, min(3, len(medicines_data)))
        med_list = []
        for m in meds_for_plan:
            med_list.append({
                "name": m["name"],
                "dosage": m["strength"],
                "frequency": random.choice(["Once daily", "Twice daily", "Thrice daily", "SOS"]),
                "route": m["route"],
            })
        poc = PlanOfCare(
            id=uuid4(),
            patient_id=patient.id,
            visit_id=initial_visit.id,
            intervention_pharmacological=f"Start {meds_for_plan[0]['name']} {meds_for_plan[0]['strength']} for symptom control.",
            intervention_non_pharmacological="Counseling, relaxation techniques, and family education on care.",
            medications=med_list,
            created_by=doctor_user.id if doctor_user else admin.id,
        )
        db.session.add(poc)
        counts["assessments"] += 1

        # ---- FOLLOW-UP VISITS ----
        for vi, fdate in enumerate(follow_up_dates):
            visit_num = vi + 1
            fv_vitals = random_vitals(base_bp_sys, base_bp_dia, variation=8)
            fv = PatientVisit(
                id=uuid4(),
                patient_id=patient.id,
                visit_number=visit_num,
                visit_type="follow_up",
                visit_date=fdate,
                visit_location="home",
                vitals_pr=fv_vitals["pr"],
                vitals_bp_systolic=fv_vitals["bp_sys"],
                vitals_bp_diastolic=fv_vitals["bp_dia"],
                vitals_rr=fv_vitals["rr"],
                vitals_spo2=Decimal(str(fv_vitals["spo2"])),
                vitals_temperature=Decimal(str(fv_vitals["temp"])),
                vitals_grbs=Decimal(str(fv_vitals["grbs"])),
                status="completed",
                visit_summary=f"Follow-up visit #{visit_num}. {'Stable condition.' if random.random() > 0.3 else 'Slight symptom change noted.'}",
                created_by=admin.id,
            )
            db.session.add(fv)
            db.session.flush()
            counts["visits"] += 1

            # Doctor assessment on every follow-up
            da_fu = DoctorAssessment(
                id=uuid4(),
                patient_id=patient.id,
                visit_id=fv.id,
                chief_complaints=f"Follow-up for {pdata['diagnosis']}.",
                diagnosis=pdata["diagnosis"],
                comorbidities=comorbidities,
                doctor_notes=random.choice([
                    "Patient stable. Continue current medications.",
                    "Pain slightly improved. Adjust morphine dose.",
                    "Nausea persists. Added antiemetic.",
                    "Good response to treatment. Family coping well.",
                    "Appetite decreased. Nutritional supplementation advised.",
                ]),
                assessed_by=doctor_user.id if doctor_user else admin.id,
            )
            db.session.add(da_fu)
            counts["assessments"] += 1

            # ESAS on some follow-ups (alternate visits)
            if vi % 2 == 0 or vi == len(follow_up_dates) - 1:
                esas_fu_data = make_esas(pdata["bsc"], visit_index=vi + 1, total_visits=total_visits)
                esas_fu = EsasScore(
                    id=uuid4(),
                    patient_id=patient.id,
                    visit_id=fv.id,
                    pain=esas_fu_data["pain"],
                    tiredness=esas_fu_data["tiredness"],
                    nausea=esas_fu_data["nausea"],
                    depression=esas_fu_data["depression"],
                    anxiety=esas_fu_data["anxiety"],
                    drowsiness=esas_fu_data["drowsiness"],
                    appetite=esas_fu_data["appetite"],
                    wellbeing=esas_fu_data["wellbeing"],
                    shortness_of_breath=esas_fu_data["shortness_of_breath"],
                    total_score=esas_fu_data["total_score"],
                    recorded_by=nurse_user.id if nurse_user else admin.id,
                )
                db.session.add(esas_fu)
                counts["assessments"] += 1

            # PPS on some follow-ups
            if vi % 2 == 1 or vi == len(follow_up_dates) - 1:
                pps_fu_data = make_pps(pdata["bsc"], visit_index=vi + 1)
                pps_fu = PpsScore(
                    id=uuid4(),
                    patient_id=patient.id,
                    visit_id=fv.id,
                    pps_score=pps_fu_data["pps_score"],
                    ambulation=pps_fu_data["ambulation"],
                    activity_level=pps_fu_data["activity_level"],
                    self_care=pps_fu_data["self_care"],
                    intake=pps_fu_data["intake"],
                    consciousness_level=pps_fu_data["consciousness_level"],
                    recorded_by=doctor_user.id if doctor_user else admin.id,
                )
                db.session.add(pps_fu)
                counts["assessments"] += 1

            # Plan of care on some follow-ups
            if vi == 0 or vi == len(follow_up_dates) - 1:
                fu_meds = random.sample(medicines_data, min(2, len(medicines_data)))
                fu_med_list = [{"name": m["name"], "dosage": m["strength"],
                                "frequency": random.choice(["Once daily", "Twice daily", "SOS"]),
                                "route": m["route"]} for m in fu_meds]
                poc_fu = PlanOfCare(
                    id=uuid4(),
                    patient_id=patient.id,
                    visit_id=fv.id,
                    intervention_pharmacological=random.choice([
                        "Continue current medications. Review in next visit.",
                        "Titrate morphine dose up. Add laxative prophylaxis.",
                        "Step-down corticosteroid. Maintain analgesics.",
                    ]),
                    medications=fu_med_list,
                    created_by=doctor_user.id if doctor_user else admin.id,
                )
                db.session.add(poc_fu)
                counts["assessments"] += 1

        # ---- OPD ENCOUNTER ----
        if pdata["opd"]:
            enc_opd = Encounter(
                id=uuid4(),
                patient_id=patient.id,
                encounter_type="OPD",
                encounter_number=f"OPD-DEMO-{pdata['name'][:3].upper()}-{random.randint(1000,9999)}",
                start_time=datetime.combine(today - timedelta(days=random.randint(5, 20)), datetime.min.time().replace(hour=10)),
                end_time=datetime.combine(today - timedelta(days=random.randint(5, 20)), datetime.min.time().replace(hour=11)),
                status="completed",
                chief_complaint=pdata["diagnosis"],
                provider_id=doctor.id,
                appointment_type="consultation",
                booking_source="staff",
                created_by=admin.id,
            )
            db.session.add(enc_opd)
            db.session.flush()

            # OPD Prescription
            rx = OPDPrescription(
                id=uuid4(),
                encounter_id=enc_opd.id,
                patient_id=patient.id,
                prescribed_by=doctor.id,
                status=PrescriptionStatus.FINALIZED,
                notes=f"Prescription for {pdata['diagnosis']} management.",
            )
            db.session.add(rx)
            db.session.flush()

            # Add 2-3 prescription items
            rx_meds = random.sample(created_medicines, min(3, len(created_medicines)))
            for rm in rx_meds:
                rx_item = OPDPrescriptionItem(
                    id=uuid4(),
                    prescription_id=rx.id,
                    medicine_id=rm.id,
                    medicine_name=rm.medicine_name,
                    dosage=rm.strength,
                    frequency=random.choice(["Once daily", "Twice daily", "Thrice daily"]),
                    duration=random.choice([7, 14, 30]),
                    duration_unit="days",
                    quantity=random.randint(10, 60),
                    route="oral",
                    instructions=random.choice(["Take after food", "Take before food", "Take with water"]),
                )
                db.session.add(rx_item)

            # Diagnosis record
            diag = Diagnosis(
                id=uuid4(),
                patient_id=patient.id,
                encounter_id=enc_opd.id,
                diagnosis_text=pdata["diagnosis"],
                diagnosis_type="primary",
                severity="severe" if pdata["complexity"] == "high" else "moderate",
                clinical_status="active",
                diagnosed_by=doctor_user.id if doctor_user else admin.id,
            )
            db.session.add(diag)

            counts["opd_encounters"] += 1
            print(f"    + OPD encounter created")

        # ---- IPD ENCOUNTER ----
        if pdata["ipd"]:
            admit_date = datetime.combine(today - timedelta(days=random.randint(10, 25)), datetime.min.time().replace(hour=14))
            discharge_date = admit_date + timedelta(days=random.randint(3, 7))

            enc_ipd = Encounter(
                id=uuid4(),
                patient_id=patient.id,
                encounter_type="IPD",
                encounter_number=f"IPD-DEMO-{pdata['name'][:3].upper()}-{random.randint(1000,9999)}",
                start_time=admit_date,
                end_time=discharge_date,
                admission_date=admit_date,
                discharge_date=discharge_date,
                status="completed",
                chief_complaint=pdata["diagnosis"],
                provider_id=doctor.id,
                appointment_type="consultation",
                created_by=admin.id,
            )
            db.session.add(enc_ipd)
            db.session.flush()

            # IPD Admission
            ipd_adm = IPDAdmission(
                id=uuid4(),
                encounter_id=enc_ipd.id,
                patient_id=patient.id,
                admission_type="elective",
                admission_source="opd",
                admitting_doctor_id=doctor.id,
                admission_diagnosis=pdata["diagnosis"],
                admission_notes=f"Admitted for symptom management. {pdata['diagnosis']}.",
                estimated_length_of_stay_days=5,
                discharge_type="normal",
                discharge_diagnosis=pdata["diagnosis"],
                discharge_summary=f"Patient managed conservatively. Symptoms controlled. Discharged with follow-up plan.",
                discharge_instructions="Continue medications as prescribed. Follow up in 1 week.",
            )
            db.session.add(ipd_adm)
            db.session.flush()

            # Create a bed if needed and assign
            bed_num = f"PC-{random.randint(101, 120)}"
            bed = Bed.query.filter_by(bed_number=bed_num).first()
            if not bed:
                bed = Bed(
                    id=uuid4(),
                    bed_number=bed_num,
                    ward_name="Palliative Care Ward",
                    bed_type="general",
                    bed_status="available",
                    is_active=True,
                )
                db.session.add(bed)
                db.session.flush()

            bed_assign = BedAssignment(
                id=uuid4(),
                bed_id=bed.id,
                admission_id=ipd_adm.id,
                patient_id=patient.id,
                encounter_id=enc_ipd.id,
                assigned_at=admit_date,
                released_at=discharge_date,
                assignment_status="completed",
                assigned_by=admin.id,
            )
            db.session.add(bed_assign)

            counts["ipd_admissions"] += 1
            print(f"    + IPD admission created")

        # Commit per patient
        db.session.commit()
        created_patient_objects.append(patient)
        print(f"    Committed patient: {pdata['name']} ({1 + len(follow_up_dates)} visits)")

    # ------------------------------------------------------------------
    # 4. SCHEDULES
    # ------------------------------------------------------------------
    print("\n--- Creating Schedules ---")

    # Get or create vehicle
    vehicle = Vehicle.query.first()
    if not vehicle:
        vehicle = Vehicle(
            id=uuid4(),
            name="Saranam Mobile Unit 1",
            registration_number="KA-01-AB-1234",
            vehicle_type="ambulance",
            capacity=6,
            is_active=True,
        )
        db.session.add(vehicle)
        db.session.flush()
        print("  + Created vehicle: Saranam Mobile Unit 1")

    # Helper to get Monday of a given week offset
    def get_week_monday(offset_weeks=0):
        d = today + timedelta(weeks=offset_weeks)
        return d - timedelta(days=d.weekday())

    schedule_configs = [
        {"label": "Last week (archived)", "offset": -1, "status": "archived"},
        {"label": "This week (in_progress)", "offset": 0, "status": "in_progress"},
        {"label": "Next week (draft)", "offset": 1, "status": "draft"},
    ]

    for sc in schedule_configs:
        monday = get_week_monday(sc["offset"])
        friday = monday + timedelta(days=4)
        saturday = monday + timedelta(days=5)

        # Check if schedule already exists for this week + vehicle
        existing_sched = WeeklySchedule.query.filter_by(
            week_start_date=monday,
            vehicle_id=vehicle.id,
            status=sc["status"],
        ).first()
        if existing_sched:
            print(f"  ~ Skipping schedule (exists): {sc['label']}")
            continue

        ws = WeeklySchedule(
            id=uuid4(),
            week_start_date=monday,
            week_end_date=saturday,
            vehicle_id=vehicle.id,
            status=sc["status"],
            created_by=admin.id,
        )
        if sc["status"] in ("in_progress", "archived"):
            ws.submitted_at = datetime.combine(monday - timedelta(days=2), datetime.min.time().replace(hour=16))
            ws.approved_at = datetime.combine(monday - timedelta(days=1), datetime.min.time().replace(hour=10))
        db.session.add(ws)
        db.session.flush()

        # Create days (Mon-Sat)
        for day_offset in range(6):
            day_date = monday + timedelta(days=day_offset)
            sd = ScheduleDay(
                id=uuid4(),
                weekly_schedule_id=ws.id,
                date=day_date,
                day_of_week=DAY_NAMES[day_offset],
            )
            db.session.add(sd)
            db.session.flush()

            # Team assignments for each day (use created providers)
            for prov in created_providers[:3]:  # doctor, nurse, counselor
                ta = ScheduleTeamAssignment(
                    id=uuid4(),
                    schedule_day_id=sd.id,
                    provider_id=prov.id,
                    role=SPEC_TO_ROLE.get(prov.specialization, "nurse"),
                )
                db.session.add(ta)

            # Add 2-3 patients per day for in_progress schedule
            if sc["status"] == "in_progress" and created_patient_objects:
                patients_for_day = random.sample(
                    created_patient_objects,
                    min(random.randint(2, 3), len(created_patient_objects))
                )
                for slot_idx, pat in enumerate(patients_for_day):
                    slot_status = "completed" if day_date < today else ("scheduled" if day_date > today else "in_progress")
                    ss = ScheduleSlot(
                        id=uuid4(),
                        schedule_day_id=sd.id,
                        patient_id=pat.id,
                        slot_order=slot_idx + 1,
                        status=slot_status,
                    )
                    db.session.add(ss)

            # Add patients to archived schedule too
            if sc["status"] == "archived" and created_patient_objects:
                patients_for_day = random.sample(
                    created_patient_objects,
                    min(random.randint(2, 3), len(created_patient_objects))
                )
                for slot_idx, pat in enumerate(patients_for_day):
                    ss = ScheduleSlot(
                        id=uuid4(),
                        schedule_day_id=sd.id,
                        patient_id=pat.id,
                        slot_order=slot_idx + 1,
                        status="completed",
                    )
                    db.session.add(ss)

        counts["schedules"] += 1
        print(f"  + Created schedule: {sc['label']} ({monday.isoformat()} to {saturday.isoformat()})")

    db.session.commit()
    print(f"  Schedules committed: {counts['schedules']}")

    # ------------------------------------------------------------------
    # SUMMARY
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("=== DEMO DATA SEED COMPLETE ===")
    print("=" * 60)
    print(f"Providers: {counts['providers']} created")
    print(f"Medicines: {counts['medicines']} created")
    print(f"Patients: {counts['patients']} created")
    print(f"Visits: {counts['visits']} created (initial + follow-ups)")
    print(f"Assessments: {counts['assessments']} created")
    print(f"OPD Encounters: {counts['opd_encounters']} created")
    print(f"IPD Admissions: {counts['ipd_admissions']} created")
    print(f"Schedules: {counts['schedules']} created")
    print("=" * 60)


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed()
