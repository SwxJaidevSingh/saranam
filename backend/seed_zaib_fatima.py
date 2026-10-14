"""
Seed comprehensive demo data for patient "Zaib Fatima" — a high-complexity
palliative care case with:
  - Initial assessment with ALL 8 assessment types fully filled
  - 5 follow-up home-care visits with full assessments showing gradual improvement
  - 2 OPD encounters with vitals, prescriptions, and lab orders
  - Detailed prescriptions on every visit
  - Realistic vitals trajectory: serious baseline → gradual stabilization

Run:
    cd backend && source venv/bin/activate && python seed_zaib_fatima.py
"""

import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from app import create_app
from app.extensions import db
from app.common.models import User
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.encounters.models import Encounter
from app.diagnoses.models import Diagnosis
from app.opd.models import (
    OPDPrescription, OPDPrescriptionItem, OPDLabOrder, OPDLabOrderItem,
    PrescriptionStatus, LabOrderStatus, LabUrgency,
)
from app.ipd.models import VitalsRecord
from app.saranam.models import (
    PatientVisit, NursingAssessment, DoctorAssessment,
    PsychologicalAssessment, PhysiotherapyAssessment,
    EsasScore, PpsScore, PlanOfCare,
)
from app.saranam.models.procedures_record import ProceduresRecord

# ═══════════════════════════════════════════════════════════════
# CLINICAL NARRATIVE
# ═══════════════════════════════════════════════════════════════
# Zaib Fatima, 58F, diagnosed with Stage IV Ovarian Cancer with
# peritoneal carcinomatosis and bilateral pleural effusions.
# She presents with severe pain (8/10), significant ascites,
# poor appetite, anxiety, and functional decline (PPS 30%).
# Over 5 follow-up visits + 2 OPD visits, her symptoms
# gradually improve with aggressive palliative management.
# ═══════════════════════════════════════════════════════════════

TODAY = date.today()

# Vitals trajectory: serious → improving over time
#                        BP_sys, BP_dia, PR,  RR,  SpO2,  Temp,  GRBS
VITALS_TRAJECTORY = [
    # Visit 0: Initial — unstable, tachycardic, low SpO2
    (158, 96, 112, 28, 89.0, 38.2, 220),
    # Visit 1: Follow-up 1 — slightly better, still concerning
    (150, 92, 104, 26, 91.0, 37.8, 195),
    # Visit 2: Follow-up 2 — responding to treatment
    (144, 88, 96,  24, 93.0, 37.4, 175),
    # OPD Visit 1 — concurrent OPD review
    (140, 86, 92,  22, 94.0, 37.2, 160),
    # Visit 3: Follow-up 3 — good progress
    (136, 84, 88,  20, 95.0, 37.0, 145),
    # Visit 4: Follow-up 4 — nearing stable
    (130, 82, 82,  18, 96.0, 36.8, 130),
    # OPD Visit 2 — follow-up check
    (128, 80, 78,  18, 97.0, 36.6, 120),
    # Visit 5: Follow-up 5 — well-controlled
    (126, 78, 76,  16, 97.5, 36.5, 115),
]

# ESAS trajectory: high symptoms → gradual improvement
#            pain  tired naus  dep  anx  drows  appetite  wellbeing  breath
ESAS_TRAJECTORY = [
    (8, 9, 7, 8, 9, 6, 8, 9, 7),   # Initial: severe
    (7, 8, 6, 7, 8, 5, 7, 8, 6),   # FU1
    (6, 7, 5, 6, 6, 4, 6, 7, 5),   # FU2
    (5, 6, 4, 5, 5, 3, 5, 5, 4),   # FU3
    (4, 5, 3, 4, 4, 3, 4, 4, 3),   # FU4
    (3, 4, 2, 3, 3, 2, 3, 3, 2),   # FU5
]

# PPS trajectory: very low → improving
PPS_TRAJECTORY = [
    (30, "Totally bed bound", "As above", "Total care", "Reduced", "Full or drowsy +/- confusion"),
    (30, "Totally bed bound", "As above", "Total care", "Reduced", "Full or confusion"),
    (40, "Mainly in bed", "As above", "Mainly assistance", "Normal or reduced", "Full or drowsy"),
    (50, "Mainly sit/lie", "Unable to do any work", "Considerable assistance", "Normal or reduced", "Full or drowsy"),
    (50, "Mainly sit/lie", "Unable to do any work", "Considerable assistance", "Normal or reduced", "Full"),
    (60, "Reduced", "Unable hobby", "Occasional assistance", "Normal or reduced", "Full"),
]

# Visit dates
INITIAL_DATE = TODAY - timedelta(days=42)
VISIT_DATES = [
    INITIAL_DATE,                        # Visit 0: Initial
    INITIAL_DATE + timedelta(days=5),    # FU1
    INITIAL_DATE + timedelta(days=12),   # FU2
    INITIAL_DATE + timedelta(days=15),   # OPD1 (between FU2 and FU3)
    INITIAL_DATE + timedelta(days=19),   # FU3
    INITIAL_DATE + timedelta(days=26),   # FU4
    INITIAL_DATE + timedelta(days=30),   # OPD2
    INITIAL_DATE + timedelta(days=35),   # FU5
]


def seed():
    print("=" * 60)
    print("ZAIB FATIMA — COMPREHENSIVE SEED DATA")
    print("=" * 60)

    admin = User.query.filter_by(role='admin').first()
    if not admin:
        print("ERROR: No admin user found.")
        return

    # Check if patient already exists
    existing = Patient.query.filter_by(full_name="Zaib Fatima").first()
    if existing:
        print(f"Patient 'Zaib Fatima' already exists (id={existing.id}). Skipping.")
        return

    # Find providers
    doctor_user = User.query.filter_by(email="priya.sharma@saranam.org").first()
    nurse_user = User.query.filter_by(email="lakshmi.r@saranam.org").first()
    psych_user = User.query.filter_by(email="meera.k@saranam.org").first()
    physio_user = User.query.filter_by(email="rajesh.pt@saranam.org").first()

    doctor_provider = HealthcareProvider.query.filter_by(license_number="KMC-2015-001").first()

    uid_doc = doctor_user.id if doctor_user else admin.id
    uid_nurse = nurse_user.id if nurse_user else admin.id
    uid_psych = psych_user.id if psych_user else admin.id
    uid_physio = physio_user.id if physio_user else admin.id
    provider_id = doctor_provider.id if doctor_provider else None

    # ══════════════════════════════════════════════════════════
    # 1. CREATE PATIENT
    # ══════════════════════════════════════════════════════════
    patient = Patient(
        id=uuid4(),
        full_name="Zaib Fatima",
        date_of_birth=date(1968, 3, 15),
        gender="Female",
        is_bangalore_resident=True,
        geographic_cluster="South",
        diagnosis="Stage IV Ovarian Cancer with Peritoneal Carcinomatosis",
        referred_from="Kidwai Memorial Institute of Oncology",
        bsc_status=True,
        is_onco=True,
        clinical_complexity="high",
        source_system="cv_raman",
        is_active=True,
        created_by=admin.id,
    )
    patient.set_contact(json.dumps({"phone": "9876543210", "email": "zaib.fatima@example.com"}))
    patient.set_address("42, Jayanagar 9th Block, Bangalore 560069")
    db.session.add(patient)
    db.session.flush()
    pid = patient.id
    print(f"\n  + Patient created: Zaib Fatima (id={pid})")

    # ══════════════════════════════════════════════════════════
    # 2. INITIAL VISIT (Visit 0) — Full 8 assessments
    # ══════════════════════════════════════════════════════════
    v = VITALS_TRAJECTORY[0]
    initial = PatientVisit(
        id=uuid4(), patient_id=pid, visit_number=0, visit_type="initial",
        visit_date=VISIT_DATES[0], visit_location="home",
        vitals_pr=v[2], vitals_bp_systolic=v[0], vitals_bp_diastolic=v[1],
        vitals_rr=v[3], vitals_spo2=Decimal(str(v[4])),
        vitals_temperature=Decimal(str(v[5])), vitals_grbs=Decimal(str(v[6])),
        status="completed",
        team_members=[
            {"user_id": str(uid_doc), "role": "physician"},
            {"user_id": str(uid_nurse), "role": "nurse"},
            {"user_id": str(uid_psych), "role": "counselor"},
            {"user_id": str(uid_physio), "role": "physio"},
        ],
        visit_summary="Initial palliative care assessment. Patient is 58-year-old female with Stage IV Ovarian Cancer, peritoneal carcinomatosis, and bilateral pleural effusions. Significant pain (8/10), ascites causing abdominal distension, poor appetite, and severe anxiety about prognosis. Tachycardic, febrile, and hypoxic at presentation. BSC protocol initiated with aggressive symptom management.",
        advice_pharmacological="Start Morphine Sulfate 10mg Q4H for pain, Dexamethasone 8mg BD for inflammation/appetite, Metoclopramide 10mg TDS for nausea, Omeprazole 20mg OD for gastric protection, Lactulose 15ml BD for opioid-induced constipation, Amitriptyline 25mg HS for neuropathic pain and sleep.",
        advice_non_pharmacological="Position patient semi-recumbent for dyspnea relief. Relaxation breathing exercises. Cold compress for fever. Gentle massage for comfort. Family counseling on prognosis and care expectations.",
        follow_up_advice="Urgent follow-up in 5 days. Monitor for opioid side effects. Watch for signs of bowel obstruction. Call if pain >7/10 or SpO2 <88%.",
        next_visit_recommended=VISIT_DATES[1],
        next_visit_priority="high",
        created_by=uid_doc,
    )
    db.session.add(initial)
    db.session.flush()
    vid0 = initial.id

    # 1) Nursing Assessment
    db.session.add(NursingAssessment(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        consciousness="drowsy", orientation="partially oriented",
        demeanor="anxious", adl="totally dependent", built="thin", hygiene_general="fair",
        pain_score=8, pain_details="Severe diffuse abdominal pain radiating to lower back, constant, 8/10 VAS. Breakthrough pain episodes 3-4 times/day.",
        nausea_vomiting="Persistent nausea, vomiting 2-3 times daily, bilious in nature.",
        dyspnea="Dyspnea at rest, worsens on lying flat. Bilateral pleural effusions noted.",
        bowel="Constipated, no bowel movement in 3 days. Abdomen distended with ascites.",
        bladder="Using bedside commode with assistance. Adequate output, no retention.",
        wound_present=False,
        device_feeding_tube={"present": False},
        device_urinary_catheter={"present": False},
        device_tracheostomy={"present": False},
        device_stoma={"present": False},
        lymphedema_present=True, lymphedema_details="Bilateral lower limb edema, pitting type, grade 2. Due to hypoalbuminemia and peritoneal disease.",
        bed_sore_present=False, braden_scale_score=14,
        hygiene_environmental="fair", hygiene_oral="fair", hygiene_skin="fair",
        procedures_done="Vitals recorded. Pain assessment done. SpO2 monitoring. Positioning for comfort. Mouth care provided.",
        instructions_given="Family taught pain medication schedule. Explained when to give breakthrough dose. Taught positioning for dyspnea relief. Demonstrated mouth care technique.",
        future_plans="Daily pain reassessment. Consider subcutaneous morphine if oral intake deteriorates. Refer for therapeutic paracentesis if ascites worsens.",
        assessed_by=uid_nurse,
    ))

    # 2) Doctor Assessment
    db.session.add(DoctorAssessment(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        diagnosis="Stage IV Ovarian Cancer (High-grade serous carcinoma) with peritoneal carcinomatosis and bilateral malignant pleural effusions",
        hpe_report="High-grade serous papillary carcinoma of ovary, FIGO Stage IVB. CA-125: 1850 U/mL. CT scan shows bilateral ovarian masses, omental caking, moderate ascites, bilateral pleural effusions.",
        chief_complaints="Severe abdominal pain 8/10, abdominal distension, progressive breathlessness, nausea and vomiting, loss of appetite, weight loss of 8kg in 2 months, bilateral leg swelling, insomnia due to pain.",
        history_of_presenting_illness="58-year-old female diagnosed with Stage IV Ovarian Cancer 6 months ago at Kidwai Memorial Institute. Completed 4 cycles of Carboplatin-Paclitaxel but disease progressed. Now referred for palliative care. Symptoms worsening over last 3 weeks with increasing pain, ascites, and breathlessness. Unable to perform any daily activities.",
        comorbidities="Type 2 Diabetes Mellitus (on Metformin, HbA1c 8.2%), Hypertension (on Amlodipine 5mg), Hypothyroidism (on Levothyroxine 50mcg), Anemia of chronic disease (Hb 8.5g/dL)",
        medication_history="Carboplatin-Paclitaxel x4 cycles (discontinued due to progression), Metformin 500mg BD, Amlodipine 5mg OD, Levothyroxine 50mcg OD, Tramadol 50mg SOS (inadequate pain control), Pantoprazole 40mg OD",
        previous_investigations="CT Abdomen-Pelvis (3 weeks ago): Bilateral ovarian masses 8x6cm and 7x5cm, omental caking, moderate ascites, bilateral pleural effusions. CA-125: 1850 U/mL (was 320 before chemo). CBC: Hb 8.5, WBC 4200, Platelets 1.2L. LFT: Albumin 2.8g/dL, Total protein 5.2g/dL. RFT: Normal.",
        family_history="Mother had breast cancer, diagnosed at age 60, deceased. No known BRCA testing done.",
        diet="liquid", appetite="very poor",
        bowel="Constipated, 3 days since last bowel movement. Abdomen distended.",
        bladder="Normal frequency, no dysuria. Using bedside commode.",
        habits="Non-smoker, non-alcoholic. Previously active, now bed-bound.",
        exam_respiratory="Bilateral decreased air entry at bases. Stony dull percussion at bilateral bases. No wheeze. Respiratory rate 28/min.",
        exam_cardiovascular="Tachycardic, heart rate 112/min. No murmurs. JVP mildly elevated. Bilateral pedal edema grade 2.",
        exam_per_abdomen="Abdomen distended with tense ascites. Diffuse tenderness. Shifting dullness positive. No palpable organomegaly due to ascites. Bowel sounds sluggish.",
        exam_cns="Drowsy but arousable. GCS 14/15 (E3V5M6). No focal neurological deficits. Oriented to person and place, confused about date.",
        doctor_notes="Serious case. Stage IV Ovarian Cancer with multiple complications. BSC initiated. Priority: Pain management with strong opioids, managing nausea/vomiting, addressing dyspnea, nutritional support. Discussed prognosis honestly with family — estimated survival 3-6 months. Goals of care established: comfort-focused, no further chemotherapy, symptom management priority.",
        assessed_by=uid_doc,
    ))

    # 3) Psychological Assessment
    db.session.add(PsychologicalAssessment(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        patient_mood="Severely anxious and tearful. Expressing fear about death and leaving her family behind.",
        patient_sleep="Very poor sleep, waking 4-5 times due to pain and anxiety. Average 2-3 hours fragmented sleep.",
        patient_disease_concerns="Very worried about prognosis. Asking how much time she has left. Concerned about her 16-year-old son's future. Worried about being a burden to her husband and mother-in-law.",
        problems_physical=["severe pain", "breathlessness", "nausea", "weakness", "swelling", "poor appetite"],
        problems_emotional=["fear of death", "anxiety about family's future", "sadness", "feeling helpless", "loss of identity as caregiver"],
        problems_social=["social isolation due to bed-bound status", "financial concerns about treatment costs", "son's education expenses"],
        problems_practical=["unable to cook or do housework", "difficulty with personal hygiene", "caregiver fatigue for husband", "transport to hospital difficult"],
        problems_spiritual=["questioning why this happened", "finding it difficult to pray due to pain", "seeking meaning", "wants to see her son graduate"],
        distress_score=9,
        family_support_notes="Husband (Ahmad, 62) is primary caregiver — retired teacher, devoted but physically struggling with lifting/turning. Mother-in-law (82) helps with cooking but has her own health issues. Son (Tariq, 16) in 10th standard, very close to mother, showing signs of anticipatory grief. Extended family visits occasionally.",
        caregiver_mood="overwhelmed",
        caregiver_burden="Husband reports significant physical and emotional exhaustion. Not sleeping well. Lost 4kg in past month. Worried about managing pain medications correctly.",
        caregiver_concerns_about_patient="Worried that pain is not being adequately controlled. Anxious about what to do if breathing gets worse at night. Unsure how to talk to son about mother's prognosis.",
        caregiver_personal_concerns="Financial strain from stopping pension contributions. Own health deteriorating — knee pain, back strain from lifting. Feels guilty when he takes rest.",
        zarit_q1_stress=4, zarit_q2_time=3, zarit_q3_strain=4, zarit_q4_uncertain=4,
        zarit_total_score=15,
        remarks="High distress. Recommend weekly counseling sessions for patient and separate caregiver support. Consider family meeting to discuss goals of care. Refer to social worker for financial assistance assessment. Connect with local support group for son.",
        assessed_by=uid_psych,
    ))

    # 4) Physiotherapy Assessment
    db.session.add(PhysiotherapyAssessment(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        pain_vas_score=8, pain_area="Diffuse abdominal pain, bilateral lower back, bilateral lower limbs",
        pain_nature="Constant dull aching in abdomen, sharp shooting pain in lower back, heaviness and aching in both legs due to edema",
        obs_built="thin", obs_posture="Bed-bound, unable to sit up without assistance. Prefers left lateral position.",
        obs_swelling="Bilateral lower limb edema grade 2, pitting. Abdominal distension due to ascites.",
        obs_deformity="No skeletal deformity noted.",
        obs_wasting="Significant generalized muscle wasting, especially in bilateral thighs and calves. Temporal wasting noted.",
        palp_tenderness="Diffuse abdominal tenderness. Bilateral calf tenderness (non-DVT, edema-related).",
        palp_edema="Bilateral pitting edema extending to mid-thigh. Skin taut and shiny.",
        palp_scar="Old surgical scar — midline laparotomy from debulking surgery 5 months ago. Well-healed, non-tender.",
        exam_rom="Severely limited in all joints due to pain and weakness. Hip flexion 60 degrees bilateral, knee flexion 90 degrees bilateral. Shoulder ROM near full but fatigues quickly.",
        exam_mmt="Generalized grade 3/5 in upper limbs, grade 2/5 in lower limbs. Unable to lift legs against gravity.",
        exam_tone="Reduced tone globally. No spasticity.",
        exam_balance="Unable to assess standing balance — patient cannot stand. Sitting balance: fair with support, poor without.",
        exam_functional_status="Completely bed-bound. Cannot transfer without 2-person assist. Cannot sit unsupported for more than 2 minutes. Requires full assistance for all ADLs including feeding, bathing, toileting.",
        physio_notes="Severe functional decline. Goals: 1) Prevent pressure sores through positioning schedule, 2) Gentle passive ROM exercises to prevent contractures, 3) Breathing exercises for dyspnea management, 4) Teach family safe transfer techniques, 5) Gradual sitting tolerance as symptoms improve. Contraindicated: vigorous exercises, prone position, deep abdominal pressure.",
        assessed_by=uid_physio,
    ))

    # 5) ESAS Score
    e = ESAS_TRAJECTORY[0]
    total = sum(e)
    db.session.add(EsasScore(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        pain=e[0], tiredness=e[1], nausea=e[2], depression=e[3], anxiety=e[4],
        drowsiness=e[5], appetite=e[6], wellbeing=e[7], shortness_of_breath=e[8],
        total_score=total, recorded_by=uid_nurse,
    ))

    # 6) PPS Score
    p = PPS_TRAJECTORY[0]
    db.session.add(PpsScore(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        pps_score=p[0], ambulation=p[1], activity_level=p[2], self_care=p[3],
        intake=p[4], consciousness_level=p[5],
        estimated_survival_days=120,
        notes="Very low functional status. Bed-bound with total care needs. Prognosis guarded.",
        recorded_by=uid_doc,
    ))

    # 7) Plan of Care
    db.session.add(PlanOfCare(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        intervention_pharmacological="1. Start Morphine Sulfate IR 10mg Q4H for pain (titrate up as needed)\n2. Dexamethasone 8mg BD for appetite/inflammation\n3. Metoclopramide 10mg TDS before meals for nausea\n4. Omeprazole 20mg OD for gastric protection\n5. Lactulose 15ml BD for constipation\n6. Amitriptyline 25mg HS for neuropathic pain/sleep\n7. Continue Metformin 500mg BD, Amlodipine 5mg OD, Levothyroxine 50mcg OD",
        intervention_non_pharmacological="1. Semi-recumbent positioning for dyspnea\n2. Relaxation breathing exercises 3x/day\n3. Guided imagery and distraction techniques for pain\n4. Gentle massage to lower limbs for edema\n5. Mouth care every 4 hours\n6. 2-hourly position changes to prevent pressure sores\n7. Family counseling session weekly\n8. Nutritional counseling — small frequent meals, high protein supplements",
        medications=[
            {"name": "Morphine Sulfate IR", "dosage": "10mg", "frequency": "Every 4 hours", "route": "oral"},
            {"name": "Dexamethasone", "dosage": "8mg", "frequency": "Twice daily", "route": "oral"},
            {"name": "Metoclopramide", "dosage": "10mg", "frequency": "Thrice daily before meals", "route": "oral"},
            {"name": "Omeprazole", "dosage": "20mg", "frequency": "Once daily morning", "route": "oral"},
            {"name": "Lactulose Solution", "dosage": "15ml", "frequency": "Twice daily", "route": "oral"},
            {"name": "Amitriptyline", "dosage": "25mg", "frequency": "At bedtime", "route": "oral"},
            {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "route": "oral"},
            {"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "route": "oral"},
            {"name": "Levothyroxine", "dosage": "50mcg", "frequency": "Once daily empty stomach", "route": "oral"},
        ],
        created_by=uid_doc,
    ))

    # 8) Procedures Record
    db.session.add(ProceduresRecord(
        id=uuid4(), patient_id=pid, visit_id=vid0,
        nursing=["vitals_monitoring", "pain_assessment", "wound_care", "oral_care", "positioning", "spo2_monitoring"],
        physiotherapy=["passive_rom", "breathing_exercises", "positioning", "transfer_training_family"],
        counsellor=["initial_assessment", "distress_screening", "family_meeting", "goals_of_care_discussion"],
        notes="Comprehensive initial assessment completed by full team. All 8 assessments documented. Family oriented to care plan. Emergency contact numbers shared.",
        created_by=uid_doc,
    ))

    db.session.flush()
    print("  + Initial visit with all 8 assessments created")

    # ══════════════════════════════════════════════════════════
    # 3. FOLLOW-UP VISITS (5 visits)
    # ══════════════════════════════════════════════════════════
    fu_notes = [
        # FU1
        ("Pain partially controlled with morphine. Breakthrough pain reduced to 1-2 episodes/day. Nausea improving with metoclopramide. Fever responding to dexamethasone. Still very weak.",
         "Titrate Morphine to 15mg Q4H. Continue antiemetics. Add Bisacodyl 10mg HS if no bowel movement by tomorrow.",
         "Breathing exercises showing slight benefit. Able to sit propped up for 10 minutes. Continue passive ROM."),
        # FU2
        ("Significant pain improvement — now 6/10 at rest. Had first bowel movement in 5 days after laxatives. Appetite slightly better with dexamethasone. SpO2 improving.",
         "Continue current morphine dose. Reduce Dexamethasone to 4mg BD. Add nutritional supplement (Ensure 200ml BD). Consider tapering Metformin if intake remains poor.",
         "Patient able to sit at edge of bed with one-person assist for 5 minutes. Edema reducing slightly. Continue exercises and add gentle active-assisted movements for upper limbs."),
        # FU3
        ("Good progress. Pain 5/10, well-controlled on current morphine. Eating small meals. Sleeping 5-6 hours. Ascites stable. Family coping better after counseling.",
         "Continue medications. Add Paracetamol 500mg Q6H for additional analgesia. Reduce Morphine to 10mg Q4H if pain remains controlled.",
         "Standing transfers with 2-person assist achieved. Sitting tolerance 15 minutes. Upper limb strength improving to 4/5. Started gentle walking with walker — 5 steps."),
        # FU4
        ("Pain 4/10, good control. Eating 50% of meals. Sleeping well. Less anxious. Engaged in conversation, asking about son's school. Positive mood shift.",
         "Step down Morphine to 10mg Q6H. Continue Dexamethasone 4mg OD. Add Multivitamin tablet OD. Metformin dose reduced to 250mg BD as GRBS improving.",
         "Walking 10 steps with walker and one-person assist. Sitting balance improved. Can do self-care for upper body with setup assistance. ROM improving in all joints."),
        # FU5
        ("Excellent improvement. Pain 3/10. Eating 70% of meals. Sleeping through the night. Mood significantly better. Husband reports less caregiver burden. Son visited and patient was cheerful.",
         "Continue current medications at reduced doses. Morphine 10mg Q6H + SOS. Taper Dexamethasone to 2mg OD. Follow-up in 10 days.",
         "Walking 20 steps with walker independently. Can sit in chair for 30 minutes. Self-care improving. Discharge from intensive physio — continue home exercises."),
    ]

    fu_indices = [1, 2, 4, 5, 7]  # indices into VITALS_TRAJECTORY for FU visits
    fu_visit_date_indices = [1, 2, 4, 5, 7]  # indices into VISIT_DATES

    for fi in range(5):
        vi = fi + 1  # visit number
        vt = VITALS_TRAJECTORY[fu_indices[fi]]
        vd = VISIT_DATES[fu_visit_date_indices[fi]]
        summary, pharm_advice, physio_note = fu_notes[fi]
        e = ESAS_TRAJECTORY[fi + 1]
        p = PPS_TRAJECTORY[fi + 1]

        fv = PatientVisit(
            id=uuid4(), patient_id=pid, visit_number=vi, visit_type="follow_up",
            visit_date=vd, visit_location="home",
            vitals_pr=vt[2], vitals_bp_systolic=vt[0], vitals_bp_diastolic=vt[1],
            vitals_rr=vt[3], vitals_spo2=Decimal(str(vt[4])),
            vitals_temperature=Decimal(str(vt[5])), vitals_grbs=Decimal(str(vt[6])),
            status="completed",
            team_members=[
                {"user_id": str(uid_doc), "role": "physician"},
                {"user_id": str(uid_nurse), "role": "nurse"},
            ],
            visit_summary=f"Follow-up #{vi}. {summary}",
            advice_pharmacological=pharm_advice,
            advice_non_pharmacological="Continue positioning, breathing exercises, gentle mobility, family support.",
            follow_up_advice=f"Next follow-up in 7 days." if fi < 4 else "Follow-up in 10 days. Consider transition to monthly visits if stable.",
            next_visit_recommended=vd + timedelta(days=7),
            next_visit_priority="high" if fi < 2 else "medium",
            created_by=uid_doc,
        )
        db.session.add(fv)
        db.session.flush()
        fvid = fv.id

        # Nursing Assessment
        pain_scores = [7, 6, 5, 4, 3]
        adl_levels = ["totally dependent", "needs maximal assistance", "needs moderate assistance", "needs minimal assistance", "needs minimal assistance"]
        consciousness_levels = ["drowsy", "alert", "alert", "alert", "alert"]
        db.session.add(NursingAssessment(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            consciousness=consciousness_levels[fi], orientation="oriented" if fi > 0 else "partially oriented",
            demeanor="anxious" if fi < 2 else "cooperative" if fi < 4 else "calm",
            adl=adl_levels[fi], built="thin", hygiene_general="fair" if fi < 2 else "good",
            pain_score=pain_scores[fi],
            pain_details=f"Abdominal pain {pain_scores[fi]}/10, {'constant' if fi < 2 else 'intermittent'}. {'Breakthrough pain 1-2x/day.' if fi < 3 else 'No breakthrough pain.'}",
            nausea_vomiting=f"{'Nausea present but reduced.' if fi < 2 else 'Minimal nausea.' if fi < 4 else 'No nausea.'}",
            dyspnea=f"{'Dyspnea on exertion.' if fi < 2 else 'Mild dyspnea on activity.' if fi < 4 else 'No dyspnea at rest.'}",
            bowel=f"{'Constipation improving with laxatives.' if fi < 2 else 'Regular bowel movements.'}",
            bladder="Normal. Using bedside commode." if fi < 3 else "Normal. Using bathroom with assistance.",
            wound_present=False,
            lymphedema_present=True if fi < 4 else False,
            lymphedema_details=f"Bilateral lower limb edema {'grade 2' if fi < 2 else 'grade 1' if fi < 4 else 'resolving'}." if fi < 4 else None,
            bed_sore_present=False,
            braden_scale_score=14 + fi,
            hygiene_environmental="fair" if fi < 2 else "good",
            hygiene_oral="fair" if fi < 2 else "good",
            hygiene_skin="fair" if fi < 2 else "good",
            procedures_done=f"Vitals. Pain assessment. {'SpO2 monitoring.' if fi < 3 else ''} Position change counseling.",
            instructions_given=f"{'Medication schedule reinforced.' if fi < 2 else 'Family confident with medications.'} {'Emergency signs reviewed.' if fi < 3 else ''}",
            future_plans=f"Continue current plan. {'Reassess in 5 days.' if fi < 2 else 'Reassess in 7 days.'}",
            assessed_by=uid_nurse,
        ))

        # Doctor Assessment
        db.session.add(DoctorAssessment(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            diagnosis="Stage IV Ovarian Cancer — on palliative care",
            chief_complaints=f"Follow-up visit #{vi}. {'Pain and nausea management.' if fi < 2 else 'Symptom monitoring.' if fi < 4 else 'Routine follow-up.'}",
            comorbidities="DM2, HTN, Hypothyroidism, Anemia of chronic disease",
            doctor_notes=summary,
            diet="liquid" if fi < 1 else "soft" if fi < 3 else "normal",
            appetite="very poor" if fi < 1 else "poor" if fi < 2 else "reduced" if fi < 4 else "improving",
            assessed_by=uid_doc,
        ))

        # Psychological Assessment
        distress_scores = [8, 7, 5, 4, 3]
        moods = ["anxious and tearful", "worried but more engaged", "calmer, starting to accept", "hopeful, positive moments", "stable mood, enjoying family time"]
        db.session.add(PsychologicalAssessment(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            patient_mood=moods[fi],
            patient_sleep="poor, 3-4 hours" if fi < 1 else "improving, 4-5 hours" if fi < 2 else "adequate, 5-6 hours" if fi < 4 else "good, 6-7 hours",
            patient_disease_concerns=f"{'Still very worried about prognosis.' if fi < 2 else 'Coming to terms with illness. Focused on quality time with family.' if fi < 4 else 'Accepting. Focused on making memories with son.'}",
            distress_score=distress_scores[fi],
            family_support_notes=f"Family {'coping with difficulty' if fi < 2 else 'coping better' if fi < 4 else 'well-adapted to caregiving routine'}.",
            caregiver_mood="stressed" if fi < 2 else "coping" if fi < 4 else "supportive",
            caregiver_burden=f"Husband {'exhausted but learning' if fi < 2 else 'managing better with rest schedule' if fi < 4 else 'in good routine, less strained'}.",
            assessed_by=uid_psych,
        ))

        # Physiotherapy Assessment
        vas_scores = [7, 6, 5, 4, 3]
        func_statuses = [
            "Bed-bound, can sit propped up for 10 minutes",
            "Can sit at edge of bed with assist for 5 minutes, bed mobility improving",
            "Standing transfers with 2-person assist, walking 5 steps with walker",
            "Walking 10 steps with walker and 1-person assist, sitting 15 minutes",
            "Walking 20 steps with walker independently, sitting 30 minutes in chair",
        ]
        db.session.add(PhysiotherapyAssessment(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            pain_vas_score=vas_scores[fi],
            pain_area="Abdomen and lower back" if fi < 3 else "Mild lower back only",
            pain_nature="Dull aching, reducing" if fi < 2 else "Intermittent aching" if fi < 4 else "Mild, manageable",
            exam_functional_status=func_statuses[fi],
            exam_rom=f"{'Severely limited' if fi < 1 else 'Moderately limited' if fi < 3 else 'Mildly limited'} — improving.",
            exam_mmt=f"UL {'3/5' if fi < 2 else '4/5'}, LL {'2/5' if fi < 2 else '3/5' if fi < 4 else '3+/5'}",
            obs_built="thin",
            physio_notes=physio_note,
            assessed_by=uid_physio,
        ))

        # ESAS Score
        total_esas = sum(e)
        db.session.add(EsasScore(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            pain=e[0], tiredness=e[1], nausea=e[2], depression=e[3], anxiety=e[4],
            drowsiness=e[5], appetite=e[6], wellbeing=e[7], shortness_of_breath=e[8],
            total_score=total_esas, recorded_by=uid_nurse,
        ))

        # PPS Score
        db.session.add(PpsScore(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            pps_score=p[0], ambulation=p[1], activity_level=p[2], self_care=p[3],
            intake=p[4], consciousness_level=p[5],
            estimated_survival_days=120 + fi * 15,
            notes=f"PPS {'stable' if fi < 2 else 'improving'}. {'Bed-bound.' if fi < 2 else 'Mobility improving.' if fi < 4 else 'Significant functional improvement.'}",
            recorded_by=uid_doc,
        ))

        # Plan of Care
        db.session.add(PlanOfCare(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            intervention_pharmacological=pharm_advice,
            intervention_non_pharmacological="Continue comfort measures, positioning, breathing exercises, family support.",
            medications=[
                {"name": "Morphine Sulfate IR", "dosage": "15mg" if fi < 2 else "10mg", "frequency": "Q4H" if fi < 2 else "Q6H", "route": "oral"},
                {"name": "Dexamethasone", "dosage": "8mg" if fi < 1 else "4mg" if fi < 4 else "2mg", "frequency": "BD" if fi < 1 else "OD", "route": "oral"},
                {"name": "Metoclopramide", "dosage": "10mg", "frequency": "TDS", "route": "oral"},
                {"name": "Omeprazole", "dosage": "20mg", "frequency": "OD", "route": "oral"},
                {"name": "Lactulose Solution", "dosage": "15ml", "frequency": "BD", "route": "oral"},
                {"name": "Paracetamol", "dosage": "500mg", "frequency": "Q6H", "route": "oral"} if fi >= 2 else {"name": "Amitriptyline", "dosage": "25mg", "frequency": "HS", "route": "oral"},
            ],
            created_by=uid_doc,
        ))

        # Procedures Record
        db.session.add(ProceduresRecord(
            id=uuid4(), patient_id=pid, visit_id=fvid,
            nursing=["vitals_monitoring", "pain_assessment", "medication_review", "positioning"],
            physiotherapy=["passive_rom" if fi < 2 else "active_assisted_rom", "breathing_exercises", "mobility_training" if fi >= 2 else "positioning"],
            counsellor=["supportive_counseling", "coping_strategies", "family_support" if fi < 3 else "bereavement_preparation"],
            notes=f"Follow-up #{vi} completed. {'Condition critical but stable.' if fi < 1 else 'Gradual improvement noted.' if fi < 3 else 'Good progress. Patient and family coping well.'}",
            created_by=uid_doc,
        ))

        db.session.flush()
        print(f"  + Follow-up #{vi} ({vd}) — full assessments")

    # ══════════════════════════════════════════════════════════
    # 4. OPD ENCOUNTERS (2 visits with vitals + prescriptions)
    # ══════════════════════════════════════════════════════════
    opd_configs = [
        (3, VISIT_DATES[3], "Palliative care clinic review. Symptom assessment and medication adjustment."),
        (6, VISIT_DATES[6], "Follow-up OPD review. Vitals stable. Medication tapering discussed."),
    ]

    for opd_idx, (vt_idx, opd_date, complaint) in enumerate(opd_configs):
        vt = VITALS_TRAJECTORY[vt_idx]
        enc = Encounter(
            id=uuid4(), patient_id=pid,
            encounter_type="OPD",
            encounter_number=f"OPD-ZF-{uuid4().hex[:6].upper()}",
            start_time=datetime.combine(opd_date, datetime.min.time().replace(hour=10)),
            end_time=datetime.combine(opd_date, datetime.min.time().replace(hour=11)),
            status="completed",
            chief_complaint=complaint,
            provider_id=provider_id,
            appointment_type="consultation",
            booking_source="staff",
            created_by=admin.id,
        )
        db.session.add(enc)
        db.session.flush()

        # OPD VitalsRecord
        db.session.add(VitalsRecord(
            id=uuid4(), encounter_id=enc.id, patient_id=pid,
            recorded_at=datetime.combine(opd_date, datetime.min.time().replace(hour=10, minute=15)),
            recorded_by=uid_nurse,
            vitals_data={
                "bp_systolic": vt[0], "bp_diastolic": vt[1],
                "pulse": vt[2], "respiratory_rate": vt[3],
                "spo2": vt[4], "temperature": vt[5],
                "blood_sugar": vt[6], "weight": 52 + opd_idx * 2,
                "pain_score": 5 - opd_idx * 2,
            },
            assessment_data={
                "general_physical_exam": f"{'Thin, pallid, bilateral leg edema.' if opd_idx == 0 else 'Improved appearance, reduced edema.'}",
                "pain": f"{'Moderate abdominal pain 5/10.' if opd_idx == 0 else 'Mild pain 3/10, well-controlled.'}",
                "symptoms": f"{'Nausea present but controlled. Appetite poor.' if opd_idx == 0 else 'No nausea. Appetite improving.'}",
            },
            visit_summary=f"OPD visit #{opd_idx + 1}. {complaint}",
            is_critical=False,
        ))

        # OPD Prescription
        rx = OPDPrescription(
            id=uuid4(), encounter_id=enc.id, patient_id=pid,
            prescribed_by=provider_id,
            status=PrescriptionStatus.FINALIZED,
            notes=f"{'Titrate morphine up, add antiemetic, nutritional support.' if opd_idx == 0 else 'Stable on current regimen. Begin tapering steroids.'}",
        )
        db.session.add(rx)
        db.session.flush()

        if opd_idx == 0:
            items = [
                ("Morphine Sulfate IR", "15mg", "1", "0", "1", "Q4H", 14, "oral", "tablet", "Take with water. Breakthrough: 5mg SOS max 3x/day."),
                ("Dexamethasone", "4mg", "1", "0", "1", "BD", 14, "oral", "tablet", "Take after food."),
                ("Metoclopramide", "10mg", "1", "1", "1", "TDS", 14, "oral", "tablet", "Take 30 min before meals."),
                ("Omeprazole", "20mg", "1", "0", "0", "OD", 30, "oral", "capsule", "Take empty stomach, morning."),
                ("Lactulose Solution", "15ml", "1", "0", "1", "BD", 14, "oral", "syrup", "Can mix with water or juice."),
                ("Amitriptyline", "25mg", "0", "0", "1", "HS", 14, "oral", "tablet", "Take at bedtime. May cause drowsiness."),
            ]
        else:
            items = [
                ("Morphine Sulfate IR", "10mg", "1", "0", "1", "Q6H", 14, "oral", "tablet", "Reduced dose. SOS 5mg if pain >5/10."),
                ("Dexamethasone", "2mg", "1", "0", "0", "OD", 14, "oral", "tablet", "Tapering dose. After food."),
                ("Paracetamol", "500mg", "1", "1", "1", "Q6H", 14, "oral", "tablet", "Take after food. Max 4g/day."),
                ("Omeprazole", "20mg", "1", "0", "0", "OD", 30, "oral", "capsule", "Continue."),
                ("Lactulose Solution", "15ml", "0", "0", "1", "OD", 14, "oral", "syrup", "Reduced frequency."),
            ]

        for name, dose, morn, aft, night, freq, dur, route, form, instr in items:
            db.session.add(OPDPrescriptionItem(
                id=uuid4(), prescription_id=rx.id,
                medicine_name=name, dosage=dose,
                dosage_morning=morn, dosage_afternoon=aft, dosage_night=night,
                frequency=freq, duration=dur, duration_unit="days",
                quantity=dur * 3, route=route, dosage_form=form,
                instructions=instr,
            ))

        # OPD Lab Order
        lab = OPDLabOrder(
            id=uuid4(), encounter_id=enc.id, patient_id=pid,
            ordered_by=provider_id,
            status=LabOrderStatus.COMPLETED,
            notes="Routine labs for palliative care monitoring.",
        )
        db.session.add(lab)
        db.session.flush()

        lab_tests = [
            ("Complete Blood Count", LabUrgency.ROUTINE, "Hb 9.2, WBC 5100, Plt 1.5L" if opd_idx == 0 else "Hb 10.1, WBC 5800, Plt 1.8L"),
            ("Renal Function Test", LabUrgency.ROUTINE, "Creat 1.1, BUN 22, eGFR 62" if opd_idx == 0 else "Creat 0.9, BUN 18, eGFR 68"),
            ("Liver Function Test", LabUrgency.ROUTINE, "Alb 2.8, T.Prot 5.2, Bil 0.8" if opd_idx == 0 else "Alb 3.2, T.Prot 5.8, Bil 0.6"),
            ("CA-125", LabUrgency.ROUTINE, "1850 U/mL" if opd_idx == 0 else "1200 U/mL"),
            ("HbA1c", LabUrgency.ROUTINE, "8.2%" if opd_idx == 0 else "7.5%"),
        ]
        for test_name, urgency, result in lab_tests:
            db.session.add(OPDLabOrderItem(
                id=uuid4(), lab_order_id=lab.id,
                test_name=test_name, urgency=urgency,
                result=result, result_at=datetime.combine(opd_date + timedelta(days=1), datetime.min.time()),
            ))

        # Diagnosis
        db.session.add(Diagnosis(
            id=uuid4(), patient_id=pid, encounter_id=enc.id,
            diagnosis_text="Stage IV Ovarian Cancer with Peritoneal Carcinomatosis",
            diagnosis_type="primary", severity="severe", clinical_status="active",
            diagnosed_by=uid_doc,
        ))

        db.session.flush()
        print(f"  + OPD Visit #{opd_idx + 1} ({opd_date}) — vitals, prescription ({len(items)} meds), labs ({len(lab_tests)} tests)")

    # ══════════════════════════════════════════════════════════
    # COMMIT
    # ══════════════════════════════════════════════════════════
    db.session.commit()
    print("\n" + "=" * 60)
    print("SEED COMPLETE")
    print("=" * 60)
    print("Patient: Zaib Fatima")
    print("Visits: 1 initial + 5 follow-ups + 2 OPD = 8 total")
    print("Assessments: 8 types per visit (initial + follow-ups)")
    print("OPD: 2 encounters with vitals, prescriptions, lab orders")
    print("Vitals data points: 8 (showing improvement trajectory)")
    print("=" * 60)


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed()
