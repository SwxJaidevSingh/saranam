"""Seed a realistic test patient with full baseline assessments.

Self-contained: creates the Patient row if missing, plus the initial
PatientVisit and all eight baseline assessment rows. Re-running upserts;
idempotent on UHID.

Clinical presentation: metastatic prostate cancer with bone pain — chosen
to be distinct from the existing Faisal (ALL) seed.

Usage:
    python backend/seed_test_patient.py

No AI summaries are written — those are tested via the UI.
"""
from datetime import date, datetime

from app import create_app
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.psychological_assessment import PsychologicalAssessment
from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.pps_score import PpsScore
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.procedures_record import ProceduresRecord


TEST_UHID = 'SARANAM-TEST-0001'


def upsert_visit_record(model, patient_id, visit_id, **fields):
    rec = model.query.filter_by(visit_id=visit_id).first()
    if rec is None:
        rec = model(patient_id=patient_id, visit_id=visit_id, **fields)
        db.session.add(rec)
    else:
        for k, v in fields.items():
            setattr(rec, k, v)
    return rec


def ensure_patient():
    p = Patient.query.filter_by(uhid=TEST_UHID).first()
    is_new = p is None
    if is_new:
        p = Patient(uhid=TEST_UHID)
        db.session.add(p)

    p.full_name = 'Rajesh Kumar (Test Patient)'
    p.date_of_birth = date(1962, 7, 14)  # ~63y at seed time
    p.gender = 'Male'
    p.linked_hospital = 'KMIO'
    p.hospital_uhid = 'KMIO-2026-TEST-0001'

    # Encrypted contact + address — use the helper so decryption works
    # through the same UI flows as real patients.
    p.set_contact('{"phone": "9845012345", "email": "rajesh.test@saranam.demo"}')
    p.set_address(
        '#214, 4th Cross, 8th Main, Jayanagar 4th Block, Bangalore - 560011, Karnataka'
    )

    p.alternative_phone = '9845067890'
    p.alternative_phone_name = 'Lakshmi Kumar (wife)'

    p.primary_caregiver_name = 'Lakshmi Kumar'
    p.primary_caregiver_relationship = 'Spouse'
    p.primary_caregiver_phone = '9845067890'
    p.decision_maker_name = 'Dr. Anitha Rao'
    p.decision_maker_designation = 'Treating Oncologist (KMIO)'
    p.decision_maker_phone = '9845098765'

    p.is_bangalore_resident = True
    p.geographic_cluster = 'South'

    p.diagnosis = 'Metastatic Carcinoma Prostate (CaP) — castration-resistant, bone metastases'
    p.referred_from = 'KMIO Oncology OPD'
    p.bsc_status = True
    p.is_onco = True
    p.source_system = 'cv_raman'
    p.is_active = True
    p.care_status = 'active'
    return p, is_new


def ensure_initial_visit(patient):
    v = PatientVisit.query.filter_by(patient_id=patient.id, visit_type='initial').first()
    if v is None:
        v = PatientVisit(
            patient_id=patient.id,
            visit_number=0,
            visit_type='initial',
            visit_date=date.today(),
            visit_location='home',
            team_members=[
                {'role': 'doctor',        'name': 'Dr. Anitha Rao'},
                {'role': 'nurse',         'name': 'Sister Mary Joseph'},
                {'role': 'physiotherapist', 'name': 'Pradeep N.'},
                {'role': 'counsellor',    'name': 'Kavitha S.'},
            ],
            vitals_pr=92,
            vitals_bp_systolic=128,
            vitals_bp_diastolic=82,
            vitals_rr=20,
            vitals_spo2=95,
            vitals_temperature=98.6,
            vitals_grbs=128,
            visit_summary=(
                'Baseline home-care assessment. 63 y/o male with metastatic CaP, '
                'bone pain (lumbar, pelvis, both hips) limiting mobility. '
                'Started on opioid analgesia plan. Caregiver education on bowel '
                'regimen, fall prevention, and pressure-area care.'
            ),
            status='completed',
        )
        db.session.add(v)
    return v


def seed_assessments(patient, visit):
    # Preserve any existing body-map annotations so the doctor form\'s
    # body-map doesn\'t get clobbered on re-seed.
    existing_doctor = DoctorAssessment.query.filter_by(visit_id=visit.id).first()
    existing_annotations = existing_doctor.body_map_annotations if existing_doctor else None

    upsert_visit_record(DoctorAssessment, patient.id, visit.id,
        diagnosis='Metastatic Carcinoma Prostate, castration-resistant, with osteoblastic bone metastases (lumbar spine, pelvis, both proximal femurs). On best supportive care.',
        chief_complaints='1) Severe low back pain (lumbar) radiating to both hips x 4 weeks. 2) Difficulty walking, requires support. 3) Urinary frequency and weak stream. 4) Generalised fatigue.',
        history_of_presenting_illness=(
            '63-year-old male, known case of CaP since 2024 (initial PSA 84 ng/mL, Gleason 8). '
            'Underwent bilateral orchidectomy + ADT; PSA initially fell to 6.2 then rose to 42. '
            'CT/Bone scan (Mar 2026) showed widespread osteoblastic lesions in lumbar spine, pelvis, '
            'and bilateral femoral necks. Now on enzalutamide, recently transitioned to BSC for '
            'symptom-focused care. Reports worsening low-back pain over the last 4 weeks (VAS 7/10), '
            'with bilateral hip ache on weight-bearing. Mobility limited to indoor ambulation with a '
            'walker; needs spousal support for transfers. Urinary frequency 8-10x/day, weak stream, '
            'no haematuria. Bowel constipation since starting opioids. Appetite fair, weight loss '
            '~4 kg over 2 months.'
        ),
        comorbidities='Type 2 Diabetes Mellitus (well-controlled, HbA1c 6.8%). Hypertension on Amlodipine.',
        medication_history=(
            'Tab Enzalutamide 160 mg OD. Tab Amlodipine 5 mg OD. Tab Metformin 500 mg BD. '
            'Tab Paracetamol 650 mg QID. Tab Tramadol 50 mg BD. Cap Omeprazole 20 mg OD. '
            'Syp Lactulose 15 ml HS.'
        ),
        previous_investigations=(
            'PSA (Apr 2026): 42 ng/mL. Bone scan (Mar 2026): widespread osteoblastic lesions. '
            'MRI lumbar spine (Mar 2026): L2-L4 metastatic deposits, no cord compression. '
            'CBC (Apr 2026): Hb 10.4, WBC 6,800, platelets 218k. LFT/RFT normal. HbA1c 6.8%.'
        ),
        family_history='Father — CaP (deceased age 78). No other significant family history.',
        diet='Normal mixed, diabetic-friendly',
        appetite='Fair',
        bowel='Constipation; passes motion every 3rd day on Lactulose.',
        bladder='Frequency 8-10x/day, weak stream, no dysuria/haematuria. No catheter.',
        habits='Non-smoker (quit 15 years ago), non-alcoholic.',
        exam_respiratory='RR 20/min. Bilateral air entry equal. No added sounds. SpO2 95% RA.',
        exam_cardiovascular='HR 92/min, regular. BP 128/82 mmHg. S1 S2 normal. No murmurs. No oedema.',
        exam_per_abdomen='Soft, non-tender. No organomegaly. Bladder not palpable. Bowel sounds normal.',
        exam_cns='Conscious, GCS 15/15. No focal deficit. Power 4/5 in both lower limbs, effort-limited by pain. Sensations intact. SLR negative bilaterally.',
        doctor_notes=(
            'Pain currently inadequately controlled on Tramadol — plan to step up to Morphine '
            '5 mg q4h PRN, titrate as needed. Continue laxative cover. Optimise diabetic control. '
            'Encourage gentle mobilisation. Family meeting planned for goals-of-care discussion.'
        ),
        body_map_annotations=existing_annotations or [],
    )

    upsert_visit_record(NursingAssessment, patient.id, visit.id,
        consciousness='Alert',
        orientation='Oriented x3',
        demeanor='Calm but fatigued',
        adl='Partial dependence (mobility, bathing)',
        built='Lean',
        hygiene_general='Good',
        pain_score=7,
        pain_details='Lumbar pain 7/10, bilateral hip 6/10, worse on weight-bearing and at night. Partial relief with Tramadol; spouse reports patient is restless at night.',
        nausea_vomiting='Occasional nausea after Tramadol dose; no vomiting.',
        dyspnea='None at rest. Mild on exertion (walking >10 m). mMRC 1.',
        bowel='Constipation, every 3rd day. On Lactulose.',
        bladder='Frequent voiding, weak stream. No incontinence.',
        wound_present=False,
        wound_size=None,
        wound_site=None,
        wound_fungative=False,
        wound_bleeding=False,
        wound_discharge=None,
        wound_odor=None,
        wound_maggot=False,
        lymphedema_present=False,
        bed_sore_present=False,
        braden_scale_score=19,
        hygiene_environmental='Adequate, clean home environment',
        hygiene_oral='Good',
        hygiene_skin='Normal',
        procedures_done='Vital signs, pain assessment, medication review, caregiver education on opioid use and bowel regimen.',
        instructions_given='Spouse educated on Morphine titration, escalation triggers (fever, severe breathlessness, fall, urinary retention), pressure-area care, fall prevention (clear floor, night light, walker use).',
        future_plans='Twice-weekly nursing visits for the first 2 weeks; reassess pain control at each visit. Anticipate transfusion need if Hb trends down.',
    )

    upsert_visit_record(PsychologicalAssessment, patient.id, visit.id,
        patient_mood='Quiet, withdrawn at times; engaged when prompted.',
        patient_sleep='Disturbed by pain — wakes 2-3x/night. Sleep onset normal.',
        patient_disease_concerns='Concerned about increasing dependency on wife. Has accepted disease progression; speaks openly about wanting to remain at home.',
        problems_physical='Pain, fatigue, urinary frequency, constipation',
        problems_emotional='Low mood, occasional tearfulness, worry about wife coping alone',
        problems_social='Reduced social contacts; misses temple visits and morning walks',
        problems_practical='Manageable financial situation (pensioner). Concerned about future medical expenses.',
        problems_spiritual='Strong Hindu faith, finds comfort in daily puja and bhajans. Has discussed end-of-life preferences with family priest.',
        distress_score=5,
        family_support_notes='Wife (Lakshmi, 60y) is primary caregiver, very devoted. Son lives in Mumbai, visits monthly; daughter married, in Bangalore, visits weekly.',
        caregiver_mood='Wife is coping but visibly tired; tearful when discussing prognosis.',
        caregiver_burden='Moderate — manages household, medications, transfers, and personal care. Reports back pain from helping with transfers.',
        caregiver_concerns_about_patient='Worries about pain at night, urinary issues, falls.',
        caregiver_personal_concerns='Own diabetic care has been neglected. No respite — son visits help is sporadic.',
        zarit_q1_stress=2,
        zarit_q2_time=3,
        zarit_q3_strain=3,
        zarit_q4_uncertain=2,
        zarit_total_score=10,
        remarks='Counsellor to follow up with wife next visit re: respite options and caregiver self-care. Patient receptive to advance-care-planning conversation.',
    )

    upsert_visit_record(PhysiotherapyAssessment, patient.id, visit.id,
        pain_vas_score=7,
        pain_area='Lumbar spine, bilateral hips, anterior thighs',
        pain_nature='Deep, aching, worse on weight-bearing, prolonged sitting, and at night',
        obs_built='Lean',
        obs_posture='Slightly stooped; antalgic gait favouring left side',
        obs_swelling='None',
        obs_deformity='None',
        obs_wasting='Mild bilateral quadriceps wasting',
        palp_tenderness='L3-L5 paraspinal tenderness, greater trochanter region bilaterally',
        palp_edema='None',
        palp_scar='Bilateral scrotal scar (post-orchidectomy)',
        exam_rom='Lumbar flexion 40% restricted (pain). Bilateral hip flexion 100° (pain at end-range). Knee ROM full.',
        exam_mmt='Lower limbs 4-/5 globally, effort-limited by pain. Upper limbs 5/5.',
        exam_tone='Normal',
        exam_balance='Static balance fair; dynamic balance impaired, uses walker for indoor mobility. Unable to stand from low chair without support.',
        exam_functional_status='Independent for upper-body ADLs. Needs assistance for transfers and lower-body dressing/bathing. Indoor ambulation with walker (limited to 10-15 m).',
        physio_notes='Plan: gentle active-assisted ROM, isometric quadriceps and gluteal strengthening (within pain limits), breathing exercises, energy-conservation training. Avoid resistance training over metastatic sites. Educate on safe transfer technique. Consider lumbar support for short walks.',
    )

    esas_total = 7 + 6 + 3 + 5 + 4 + 4 + 5 + 5 + 2
    upsert_visit_record(EsasScore, patient.id, visit.id,
        pain=7, tiredness=6, nausea=3, depression=5, anxiety=4,
        drowsiness=4, appetite=5, wellbeing=5, shortness_of_breath=2,
        total_score=esas_total,
    )

    upsert_visit_record(PpsScore, patient.id, visit.id,
        pps_score=60,
        ambulation='Reduced',
        activity_level='Unable to do normal work / hobby; significant disease',
        self_care='Occasional assistance required',
        intake='Normal or reduced',
        consciousness_level='Full',
        estimated_survival_days=180,
        notes='PPS 60% — patient ambulant indoors with walker, needs occasional assistance with self-care.',
    )

    upsert_visit_record(PlanOfCare, patient.id, visit.id,
        intervention_non_pharmacological=(
            'Energy conservation. Bedside ROM exercises BD. Pressure-area care q3h when bed-bound. '
            'Caregiver support and respite planning. Family meeting for goals-of-care.'
        ),
        intervention_pharmacological=(
            'Step up to Morphine 5 mg q4h PRN; titrate by 25% if inadequate after 24h. '
            'Continue Lactulose; add Bisacodyl if no bowel movement >72h. '
            'PRN Ondansetron for opioid-related nausea. Continue diabetic and HTN regimens.'
        ),
        medications=[
            {'name': 'Tab Enzalutamide', 'dose': '160 mg', 'frequency': 'OD',  'route': 'PO'},
            {'name': 'Tab Amlodipine',    'dose': '5 mg',   'frequency': 'OD',  'route': 'PO'},
            {'name': 'Tab Metformin',     'dose': '500 mg', 'frequency': 'BD',  'route': 'PO'},
            {'name': 'Tab Paracetamol',   'dose': '650 mg', 'frequency': 'QID', 'route': 'PO'},
            {'name': 'Tab Morphine IR',   'dose': '5 mg',   'frequency': 'q4h PRN', 'route': 'PO'},
            {'name': 'Cap Omeprazole',    'dose': '20 mg',  'frequency': 'OD',  'route': 'PO'},
            {'name': 'Syp Lactulose',     'dose': '15 ml',  'frequency': 'HS',  'route': 'PO'},
            {'name': 'Tab Ondansetron',   'dose': '4 mg',   'frequency': 'PRN (nausea)', 'route': 'PO'},
        ],
    )

    upsert_visit_record(ProceduresRecord, patient.id, visit.id,
        nursing='Vital signs, pain assessment, medication review, caregiver education.',
        physiotherapy='Bedside assessment, ROM and isometric strengthening introduced, transfer training, walker fitment.',
        counsellor='Initial counselling with patient and spouse; respite planning discussion scheduled.',
        notes='Goals-of-care family meeting planned for week 2.',
    )


def main():
    app = create_app('development')
    with app.app_context():
        p, is_new_patient = ensure_patient()
        db.session.flush()  # ensure p.id exists
        v = ensure_initial_visit(p)
        db.session.flush()
        seed_assessments(p, v)
        db.session.commit()
        action = 'Created' if is_new_patient else 'Updated'
        print(f'✅ {action} test patient {p.full_name} (UHID {p.uhid}, id {p.id})')
        print(f'   Initial visit {v.id} on {v.visit_date}, 8 baseline assessments seeded.')


if __name__ == '__main__':
    main()
