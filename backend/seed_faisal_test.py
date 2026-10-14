"""Seed test clinical data for Faisal Manzer (test patient).

Multi-symptom palliative-oncology presentation across all assessment forms.
No AI summaries written — those are tested manually via the UI.
"""
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


def upsert(model, patient_id, visit_id, **fields):
    rec = model.query.filter_by(visit_id=visit_id).first()
    if rec is None:
        rec = model(patient_id=patient_id, visit_id=visit_id, **fields)
        db.session.add(rec)
    else:
        for k, v in fields.items():
            setattr(rec, k, v)
    return rec


def main():
    app = create_app('development')
    with app.app_context():
        p = Patient.query.filter(Patient.full_name.ilike('%Faisal Manzer%')).first()
        v = PatientVisit.query.filter_by(patient_id=p.id, visit_type='initial').first()
        print(f'Seeding for {p.full_name} ({p.id}) visit {v.id}')

        # ── Doctor (preserve any existing body_map_annotations) ──
        existing_doctor = DoctorAssessment.query.filter_by(visit_id=v.id).first()
        existing_annotations = existing_doctor.body_map_annotations if existing_doctor else None
        upsert(DoctorAssessment, p.id, v.id,
            diagnosis='Acute Lymphoblastic Leukemia (ALL), refractory to induction chemotherapy. Currently on best supportive care.',
            chief_complaints='1) Severe lower back pain since 2 weeks. 2) Bone pain in both hips and knees. 3) Generalized fatigue and weakness. 4) Painful mouth ulcers (mucositis). 5) Intermittent low-grade fever.',
            history_of_presenting_illness='28-year-old male, diagnosed with ALL 8 months ago, completed 2 cycles of induction chemo at Kidwai with poor response. Disease progressed; transferred to palliative care 3 weeks ago. Reports worsening lower-back pain over the past 2 weeks, now 7/10 on VAS, radiating to both buttocks. Bone pain in hips bilaterally and both knees, worse with weight-bearing. Severe fatigue limiting ambulation; spends most of the day in bed. Mouth ulcers developed 1 week ago, painful with eating. Low-grade fever (max 100.4°F) on and off for 5 days. Reduced oral intake, anorexia.',
            comorbidities='No prior comorbidities. Anaemia (Hb 7.8 g/dL) and thrombocytopenia (platelet 38,000) secondary to underlying disease.',
            medication_history='Tab Paracetamol 650 mg PRN. Tab Tramadol 50 mg BD. Cap Omeprazole 20 mg OD. Tab Ondansetron 4 mg PRN. Mouthwash Chlorhexidine TDS.',
            previous_investigations='Bone marrow biopsy (Kidwai, 2025-08): blast cells 78%. Latest CBC (2026-04-25): Hb 7.8, WBC 28,000 (blasts 65%), platelet 38,000. LFT/RFT within normal limits.',
            family_history='Father — diabetic. No family history of malignancy.',
            diet='Soft, semi-solid',
            appetite='Reduced',
            bowel='Constipation; passing motion every 3rd day. On Lactulose syrup 15 ml HS.',
            bladder='Normal frequency. No dysuria or haematuria.',
            habits='Non-smoker, non-alcoholic.',
            exam_respiratory='RR 22/min. Bilateral air entry equal. Mild crepitations at right base. SpO2 94% on room air.',
            exam_cardiovascular='HR 96/min, regular. BP 102/68 mmHg. S1 S2 normal. No murmurs. Mild pedal oedema bilaterally.',
            exam_per_abdomen='Soft, mild splenomegaly (3 cm below costal margin). No tenderness. Bowel sounds normal.',
            exam_cns='Conscious, oriented. GCS 15/15. No focal neurological deficits. Power 4/5 in lower limbs (effort-limited by pain). Sensations intact.',
            doctor_notes='Patient is symptomatic with significant pain burden. Plan: optimize analgesia (consider opioid escalation), supportive transfusions PRN, oral care for mucositis, mobilisation as tolerated. Discuss goals of care with family.',
            body_map_annotations=existing_annotations or [],
        )

        # ── Nursing ──
        upsert(NursingAssessment, p.id, v.id,
            consciousness='Alert',
            orientation='Oriented x3',
            demeanor='Anxious',
            adl='Partial dependence',
            built='Cachectic',
            hygiene_general='Fair',
            pain_score=7,
            pain_details='Severe lower-back pain (7/10), bilateral hip and knee bone pain (6/10). Worse on movement; partial relief with Tramadol. No nocturnal exacerbation.',
            nausea_vomiting='Intermittent nausea after meals (2-3 episodes/day). Vomiting once yesterday, non-projectile, non-bilious.',
            dyspnea='Mild on exertion (climbing stairs); none at rest. mMRC grade 2.',
            bowel='Constipated - every 3rd day. On Lactulose.',
            bladder='Normal',
            wound_present=True,
            wound_size='Multiple oral ulcers, largest ~1 cm on buccal mucosa',
            wound_site='Oral cavity - buccal mucosa, tongue lateral borders',
            wound_fungative=False,
            wound_bleeding=False,
            wound_discharge=None,
            wound_odor=None,
            wound_maggot=False,
            lymphedema_present=False,
            bed_sore_present=False,
            braden_scale_score=16,
            hygiene_environmental='Adequate',
            hygiene_oral='Poor',
            hygiene_skin='Dry',
            procedures_done='Vital signs monitoring, oral care, repositioning every 2 hours, range-of-motion exercises (passive).',
            instructions_given='Caregiver educated on oral-care protocol, fall prevention, importance of small frequent meals, when to escalate (fever >101F, severe bleeding, breathlessness at rest).',
            future_plans='Daily nursing visits for next 7 days, then taper based on stability. Plan transfusion support if Hb drops <7.',
        )

        # ── Psychological ──
        upsert(PsychologicalAssessment, p.id, v.id,
            patient_mood='Anxious, low mood',
            patient_sleep='Disturbed — wakes 3–4 times due to pain. Sleep onset delayed by ~1 hour.',
            patient_disease_concerns='Worried about disease progression and dependency on family. Asks about life expectancy.',
            problems_physical='Severe pain, fatigue, mouth ulcers, anorexia',
            problems_emotional='Fear, anxiety, episodes of tearfulness, sense of hopelessness',
            problems_social='Worried about being a burden on parents; reduced social contact since illness',
            problems_practical='Financial strain — family has spent significant savings on prior chemo',
            problems_spiritual='Questioning the meaning of suffering; finds some comfort in prayer',
            distress_score=7,
            family_support_notes='Mother and elder sister are primary caregivers, very involved. Father works in another city, visits weekends.',
            caregiver_mood='Mother is exhausted and tearful. Sister coping but anxious.',
            caregiver_burden='Moderate to high — primary caregiver (mother) reports sleep deprivation and difficulty managing patient\'s pain at night.',
            caregiver_concerns_about_patient='Worried about patient\'s mood, refusing food, frequent crying spells.',
            caregiver_personal_concerns='Own health neglected, has not seen own physician in 6 months. Some financial anxiety.',
            zarit_q1_stress=3,
            zarit_q2_time=3,
            zarit_q3_strain=4,
            zarit_q4_uncertain=3,
            zarit_total_score=13,
            remarks='Counselling session scheduled with mother for next visit. Patient receptive to talking about end-of-life concerns. Refer for spiritual care.',
        )

        # ── Physiotherapy ──
        upsert(PhysiotherapyAssessment, p.id, v.id,
            pain_vas_score=7,
            pain_area='Lower back (lumbar region), bilateral hips, both knees, both thighs',
            pain_nature='Deep, aching, worse on weight-bearing and prolonged sitting',
            obs_built='Cachectic',
            obs_posture='Stooped, guarded — protective posture due to back pain',
            obs_swelling='Mild bilateral pedal oedema',
            obs_deformity='None',
            obs_wasting='Generalized muscle wasting, prominent in quadriceps and gluteals',
            palp_tenderness='Lumbar paraspinal muscles bilaterally; greater trochanter region bilaterally',
            palp_edema='Pitting oedema grade 1+ at both ankles',
            palp_scar='None',
            exam_rom='Lumbar flexion: 50% restricted (pain). Bilateral hip flexion 90° (limited by pain). Knee ROM full but painful at end-range.',
            exam_mmt='Lower limbs 3+/5 globally. Upper limbs 4/5. Reduced grip strength bilaterally.',
            exam_tone='Normal',
            exam_balance='Impaired — needs support for sit-to-stand. Not able to stand independently for >30 seconds.',
            exam_functional_status='Partially dependent for transfers. Wheelchair-bound for outdoor mobility. Indoor mobility with caregiver support and walker.',
            physio_notes='Plan: gentle active-assisted ROM exercises bedside, breathing exercises, energy-conservation training. Avoid resistive exercises given thrombocytopenia. Educate on safe transfers and fall prevention.',
        )

        # ── ESAS-R ──
        esas_total = 7 + 9 + 5 + 4 + 6 + 5 + 8 + 7 + 4
        upsert(EsasScore, p.id, v.id,
            pain=7, tiredness=9, nausea=5, depression=4, anxiety=6,
            drowsiness=5, appetite=8, wellbeing=7, shortness_of_breath=4,
            total_score=esas_total,
        )

        # ── PPS ──
        upsert(PpsScore, p.id, v.id,
            pps_score=50,
            ambulation='Mainly sit/lie',
            activity_level='Considerable disease, unable to do most activity',
            self_care='Considerable assistance required',
            intake='Reduced',
            consciousness_level='Full',
            estimated_survival_days=90,
            notes='PPS 50% — patient mostly bed/chair-bound, needs considerable assistance with self-care. Reduced oral intake.',
        )

        # ── Plan of Care ──
        upsert(PlanOfCare, p.id, v.id,
            intervention_non_pharmacological='Daily oral care with Chlorhexidine rinse. Pressure-area care every 2 hours. Soft diet, small frequent meals. Energy conservation. Bedside ROM exercises. Counselling for patient and mother. Spiritual care referral.',
            intervention_pharmacological='Step-up analgesia plan if pain not controlled in 48 hours. PRN Ondansetron for nausea. Continue Lactulose. Consider Morphine 2.5 mg q4h PRN if Tramadol inadequate.',
            medications=[
                {'name': 'Tab Paracetamol', 'dose': '650 mg', 'frequency': 'QID', 'route': 'PO'},
                {'name': 'Tab Tramadol', 'dose': '50 mg', 'frequency': 'BD', 'route': 'PO'},
                {'name': 'Cap Omeprazole', 'dose': '20 mg', 'frequency': 'OD', 'route': 'PO'},
                {'name': 'Tab Ondansetron', 'dose': '4 mg', 'frequency': 'PRN (nausea)', 'route': 'PO'},
                {'name': 'Syp Lactulose', 'dose': '15 ml', 'frequency': 'HS', 'route': 'PO'},
                {'name': 'Chlorhexidine mouthwash', 'dose': '10 ml', 'frequency': 'TDS', 'route': 'Oral rinse'},
            ],
        )

        # ── Procedures ──
        upsert(ProceduresRecord, p.id, v.id,
            nursing='Vital signs, oral care, pressure-area care, repositioning, medication administration',
            physiotherapy='Bedside ROM exercises (passive/active-assisted), breathing exercises, transfer training',
            counsellor='Initial counselling completed with patient. Caregiver counselling scheduled.',
            notes='Family meeting planned for next week to discuss goals of care and advance directives.',
        )

        db.session.commit()
        print('✅ Seeded all 8 assessments. No AI summaries written.')


if __name__ == '__main__':
    main()
