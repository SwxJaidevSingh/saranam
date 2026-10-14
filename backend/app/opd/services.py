"""OPD Service Layer — Business logic for OPD visit management."""

from datetime import datetime, date
from typing import Optional, List, Dict, Tuple
from uuid import UUID, uuid4
from sqlalchemy import and_, func, desc
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.encounters.models import Encounter
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.ipd.models import VitalsRecord
from app.diagnoses.models import Diagnosis
from app.opd.models import (
    OPDPrescription, OPDPrescriptionItem,
    OPDLabOrder, OPDLabOrderItem,
    PrescriptionStatus, LabOrderStatus, LabUrgency
)


# ---------------------------------------------------------------------------
# OPD Visit Service
# ---------------------------------------------------------------------------

class OPDVisitService:

    @staticmethod
    def create_visit(
        patient_id: UUID,
        provider_id: Optional[UUID],
        start_time: str,
        duration: Optional[int],
        chief_complaint: Optional[str],
        notes: Optional[str],
        booked_by_id: UUID
    ) -> dict:
        """Book a new OPD appointment / visit."""
        from datetime import timedelta

        # Normalize: datetime-local sends HH:MM without seconds; fromisoformat needs HH:MM:SS on Python < 3.11
        normalized = start_time.replace('Z', '+00:00')
        if 'T' in normalized and normalized.count(':') == 1:
            normalized += ':00'
        start_dt = datetime.fromisoformat(normalized)
        dur = duration or 30
        end_dt = start_dt + timedelta(minutes=dur)

        patient = db.session.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError('Patient not found')

        if provider_id:
            provider = db.session.query(HealthcareProvider).filter(
                HealthcareProvider.id == provider_id
            ).first()
            if not provider:
                raise ValueError('Provider not found')

        visit = Encounter(
            id=uuid4(),
            patient_id=patient_id,
            provider_id=provider_id,
            encounter_type='OPD',
            appointment_type='consultation',
            start_time=start_dt,
            end_time=end_dt,
            status='scheduled',
            chief_complaint=chief_complaint,
            pre_appointment_notes=notes,
            booking_source='opd_module',
            booked_by=booked_by_id,
            created_by=booked_by_id
        )

        db.session.add(visit)
        db.session.commit()

        return OPDVisitService._format_visit(visit)

    @staticmethod
    def get_visit(visit_id: UUID) -> Optional[dict]:
        """Get full OPD visit detail."""
        visit = db.session.query(Encounter).options(
            joinedload(Encounter.patient),
            joinedload(Encounter.provider)
        ).filter(
            Encounter.id == visit_id,
            Encounter.encounter_type == 'OPD'
        ).first()

        if not visit:
            return None

        data = OPDVisitService._format_visit(visit)

        # Attach vitals (as array for frontend compatibility)
        vitals = db.session.query(VitalsRecord).filter(
            VitalsRecord.encounter_id == visit_id
        ).order_by(desc(VitalsRecord.recorded_at)).first()
        data['vitals'] = [vitals.to_dict()] if vitals else []

        # Attach diagnoses
        diagnoses = db.session.query(Diagnosis).filter(
            Diagnosis.encounter_id == visit_id
        ).all()
        data['diagnoses'] = [d.to_dict() for d in diagnoses]

        # Attach prescription
        prescription = db.session.query(OPDPrescription).options(
            joinedload(OPDPrescription.items)
        ).filter(OPDPrescription.encounter_id == visit_id).first()
        data['prescription'] = prescription.to_dict() if prescription else None

        # Attach lab order
        lab_order = db.session.query(OPDLabOrder).options(
            joinedload(OPDLabOrder.items)
        ).filter(OPDLabOrder.encounter_id == visit_id).first()
        data['lab_order'] = lab_order.to_dict() if lab_order else None

        return data

    @staticmethod
    def list_visits(
        patient_id: Optional[str] = None,
        provider_id: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[dict], int]:
        """List OPD visits with filters."""
        query = db.session.query(Encounter).options(
            joinedload(Encounter.patient),
            joinedload(Encounter.provider)
        ).filter(Encounter.encounter_type == 'OPD')

        if patient_id:
            query = query.filter(Encounter.patient_id == UUID(patient_id))
        if provider_id:
            query = query.filter(Encounter.provider_id == UUID(provider_id))
        if status:
            query = query.filter(Encounter.status == status)
        if from_date:
            from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query = query.filter(Encounter.start_time >= from_dt)
        if to_date:
            to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query = query.filter(Encounter.start_time <= to_dt)

        total = query.count()
        visits = query.order_by(desc(Encounter.start_time)).limit(limit).offset(offset).all()

        return [OPDVisitService._format_visit(v) for v in visits], total

    @staticmethod
    def get_queue(queue_date: Optional[str] = None) -> List[dict]:
        """Get today's OPD queue grouped by status."""
        target_date = date.today()
        if queue_date:
            target_date = date.fromisoformat(queue_date)

        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())

        visits = db.session.query(Encounter).options(
            joinedload(Encounter.patient),
            joinedload(Encounter.provider)
        ).filter(
            Encounter.encounter_type == 'OPD',
            Encounter.start_time >= day_start,
            Encounter.start_time <= day_end
        ).order_by(Encounter.start_time).all()

        return [OPDVisitService._format_visit(v) for v in visits]

    @staticmethod
    def get_dashboard_stats() -> dict:
        """Get OPD dashboard statistics for today."""
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())

        def _count(status=None):
            q = db.session.query(func.count(Encounter.id)).filter(
                Encounter.encounter_type == 'OPD',
                Encounter.start_time >= today_start,
                Encounter.start_time <= today_end
            )
            if status:
                q = q.filter(Encounter.status == status)
            return q.scalar() or 0

        total_today = _count()
        scheduled = _count('scheduled')
        checked_in = _count('checked_in')
        in_consultation = _count('in_consultation')
        completed = _count('completed')
        no_show = _count('no_show')

        # Total all visits (not just today)
        total_all = db.session.query(func.count(Encounter.id)).filter(
            Encounter.encounter_type == 'OPD'
        ).scalar() or 0

        return {
            'today': {
                'total': total_today,
                'scheduled': scheduled,
                'checked_in': checked_in,
                'in_consultation': in_consultation,
                'completed': completed,
                'no_show': no_show,
            },
            'total_all_time': total_all,
            'date': date.today().isoformat()
        }

    @staticmethod
    def check_in(visit_id: UUID) -> Optional[dict]:
        """Check in patient — transitions scheduled → checked_in."""
        visit = OPDVisitService._get_encounter(visit_id)
        if not visit:
            return None

        if visit.status not in ('scheduled', 'confirmed'):
            raise ValueError(f'Cannot check in from status: {visit.status}')

        visit.status = 'checked_in'
        visit.checked_in_at = datetime.utcnow()
        db.session.commit()
        return OPDVisitService._format_visit(visit)

    @staticmethod
    def mark_no_show(visit_id: UUID) -> Optional[dict]:
        """Mark patient as no-show."""
        visit = OPDVisitService._get_encounter(visit_id)
        if not visit:
            return None

        if visit.status == 'completed':
            raise ValueError('Cannot mark completed visit as no-show')

        visit.status = 'no_show'
        db.session.commit()
        return OPDVisitService._format_visit(visit)

    @staticmethod
    def update_provider(visit_id: UUID, provider_id: UUID) -> Optional[dict]:
        """Reassign provider for an OPD visit."""
        visit = OPDVisitService._get_encounter(visit_id)
        if not visit:
            return None

        provider = db.session.query(HealthcareProvider).filter(
            HealthcareProvider.id == provider_id
        ).first()
        if not provider:
            raise ValueError('Provider not found')

        visit.provider_id = provider_id
        db.session.commit()
        return OPDVisitService._format_visit(visit)

    @staticmethod
    def complete_visit(
        visit_id: UUID,
        follow_up_required: bool = False,
        follow_up_date: Optional[str] = None,
        referral_service: Optional[str] = None,
        final_notes: Optional[str] = None
    ) -> Optional[dict]:
        """Complete an OPD visit."""
        visit = OPDVisitService._get_encounter(visit_id)
        if not visit:
            return None

        visit.status = 'completed'
        visit.checked_out_at = datetime.utcnow()
        visit.follow_up_required = follow_up_required

        if follow_up_date:
            visit.follow_up_scheduled_at = datetime.fromisoformat(follow_up_date.replace('Z', '+00:00'))

        if final_notes:
            visit.post_appointment_notes = final_notes

        if referral_service:
            existing_meta = visit.service_metadata or {}
            existing_meta['referral_service'] = referral_service
            visit.service_metadata = existing_meta

        db.session.commit()
        return OPDVisitService._format_visit(visit)

    @staticmethod
    def _get_encounter(visit_id: UUID) -> Optional[Encounter]:
        return db.session.query(Encounter).filter(
            Encounter.id == visit_id,
            Encounter.encounter_type == 'OPD'
        ).first()

    @staticmethod
    def _format_visit(visit: Encounter) -> dict:
        data = visit.to_dict()
        if visit.patient:
            data['patient_name'] = visit.patient.full_name
            data['patient_gender'] = visit.patient.gender
            data['patient_dob'] = visit.patient.date_of_birth.isoformat() if visit.patient.date_of_birth else None
        if visit.provider:
            data['provider_name'] = visit.provider.full_name
            data['provider_specialization'] = visit.provider.specialization
            data['provider_license_number'] = visit.provider.license_number
            data['provider_qualification'] = visit.provider.qualification
        return data


# ---------------------------------------------------------------------------
# Vitals Service
# ---------------------------------------------------------------------------

class OPDVitalsService:

    @staticmethod
    def save_vitals(
        visit_id: UUID,
        patient_id: UUID,
        vitals_data: dict,
        recorded_by_id: UUID,
        assessment_data: dict = None,
        visit_summary: str = None
    ) -> dict:
        """Save or update vitals + nursing assessment for an OPD visit."""
        # Auto-calculate BMI if weight and height provided
        weight = vitals_data.get('weight')
        height = vitals_data.get('height')
        if weight and height and height > 0:
            height_m = height / 100
            vitals_data['bmi'] = round(weight / (height_m ** 2), 1)

        # Check for critical values
        is_critical = OPDVitalsService._check_critical(vitals_data)

        # Auto-generate visit summary if not provided
        if visit_summary is None and assessment_data:
            visit_summary = OPDVitalsService._generate_visit_summary(vitals_data, assessment_data)

        # Upsert — one vitals record per visit
        existing = db.session.query(VitalsRecord).filter(
            VitalsRecord.encounter_id == visit_id
        ).first()

        if existing:
            existing.vitals_data = vitals_data
            existing.assessment_data = assessment_data
            existing.visit_summary = visit_summary
            existing.recorded_at = datetime.utcnow()
            existing.recorded_by = recorded_by_id
            existing.is_critical = is_critical
            record = existing
        else:
            record = VitalsRecord(
                id=uuid4(),
                encounter_id=visit_id,
                patient_id=patient_id,
                vitals_data=vitals_data,
                assessment_data=assessment_data,
                visit_summary=visit_summary,
                recorded_at=datetime.utcnow(),
                recorded_by=recorded_by_id,
                is_critical=is_critical
            )
            db.session.add(record)

        # Advance visit status to vitals_recorded
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if visit and visit.status == 'checked_in':
            visit.status = 'vitals_recorded'

        db.session.commit()
        return record.to_dict()

    @staticmethod
    def _generate_visit_summary(vitals: dict, assessment: dict) -> str:
        """Auto-generate a human-readable visit summary from assessment data."""
        parts = []
        gpe = assessment.get('general_physical_exam', {})
        if gpe:
            state = gpe.get('state_of_patient', '')
            orientation = gpe.get('orientation', '')
            adl = gpe.get('adl', '')
            if state:
                parts.append(f"Patient is {state}, {orientation}, ADL: {adl}")

        # Vitals summary
        bp_s = vitals.get('blood_pressure_systolic') or vitals.get('bp_systolic')
        bp_d = vitals.get('blood_pressure_diastolic') or vitals.get('bp_diastolic')
        pulse = vitals.get('pulse')
        spo2 = vitals.get('oxygen_saturation') or vitals.get('spo2')
        temp = vitals.get('temperature')
        grbs = vitals.get('grbs')
        v_parts = []
        if bp_s and bp_d:
            v_parts.append(f"BP {bp_s}/{bp_d}")
        if pulse:
            v_parts.append(f"PR {pulse}")
        if spo2:
            v_parts.append(f"SpO2 {spo2}%")
        if temp:
            v_parts.append(f"Temp {temp}")
        if grbs:
            v_parts.append(f"GRBS {grbs}")
        if v_parts:
            parts.append("Vitals: " + ", ".join(v_parts))

        pain = assessment.get('pain_assessment', {})
        if pain.get('score') is not None and pain['score'] > 0:
            parts.append(f"Pain score: {pain['score']}/10")
            if pain.get('description'):
                parts[-1] += f" ({pain['description']})"

        symptoms = assessment.get('symptom_assessment', {})
        active = []
        for key in ['nausea_vomiting', 'wound', 'dyspnea', 'lymphoedema', 'bed_sore']:
            val = symptoms.get(key, '')
            if val and val not in ('none', 'None', '', False):
                active.append(key.replace('_', ' ').title())
        if symptoms.get('feeding_tubes'):
            active.append('Feeding Tubes')
        if symptoms.get('urinary_catheter'):
            active.append('Urinary Catheter')
        if symptoms.get('tracheostomy'):
            active.append('Tracheostomy')
        if active:
            parts.append("Active symptoms: " + ", ".join(active))

        return ". ".join(parts) + "." if parts else ""

    @staticmethod
    def get_vitals(visit_id: UUID) -> Optional[dict]:
        record = db.session.query(VitalsRecord).filter(
            VitalsRecord.encounter_id == visit_id
        ).first()
        return record.to_dict() if record else None

    @staticmethod
    def _check_critical(vitals: dict) -> bool:
        thresholds = {
            'bp_systolic': (60, 180),
            'bp_diastolic': (40, 120),
            'temperature': (35.0, 40.0),
            'heart_rate': (40, 140),
            'spo2': (85, 100),
        }
        for key, (lo, hi) in thresholds.items():
            val = vitals.get(key)
            if val is not None:
                if val < lo or val > hi:
                    return True
        return False


# ---------------------------------------------------------------------------
# Doctor's Assessment Service
# ---------------------------------------------------------------------------

class OPDDoctorAssessmentService:

    @staticmethod
    def save_assessment(visit_id: UUID, assessment_data: dict) -> Optional[dict]:
        """Save doctor's clinical assessment (stored in encounter.service_metadata)."""
        visit = db.session.query(Encounter).filter(
            Encounter.id == visit_id,
            Encounter.encounter_type == 'OPD'
        ).first()
        if not visit:
            return None

        meta = visit.service_metadata or {}
        meta['doctor_assessment'] = assessment_data
        visit.service_metadata = meta
        # Force SQLAlchemy to detect JSONB change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(visit, 'service_metadata')

        # Advance status if needed
        if visit.status in ('checked_in', 'vitals_recorded'):
            visit.status = 'in_consultation'

        db.session.commit()
        return OPDVisitService._format_visit(visit)

    @staticmethod
    def get_assessment(visit_id: UUID) -> Optional[dict]:
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if not visit:
            return None
        meta = visit.service_metadata or {}
        return meta.get('doctor_assessment', {})


# ---------------------------------------------------------------------------
# Diagnosis Service
# ---------------------------------------------------------------------------

class OPDDiagnosisService:

    @staticmethod
    def save_diagnoses(
        visit_id: UUID,
        patient_id: UUID,
        diagnoses_data: List[dict],
        diagnosed_by_id: UUID
    ) -> List[dict]:
        """Replace all diagnoses for a visit."""
        # Delete existing diagnoses for this encounter
        db.session.query(Diagnosis).filter(
            Diagnosis.encounter_id == visit_id
        ).delete()

        saved = []
        for item in diagnoses_data:
            diagnosis = Diagnosis(
                id=uuid4(),
                encounter_id=visit_id,
                patient_id=patient_id,
                diagnosis_text=item['diagnosis_text'],
                icd10_code=item.get('icd10_code'),
                diagnosis_type=item.get('diagnosis_type', 'primary'),
                severity=item.get('severity'),
                clinical_status=item.get('clinical_status', 'active'),
                onset_date=item.get('onset_date') or None,
                notes=item.get('notes'),
                diagnosed_by=diagnosed_by_id
            )
            db.session.add(diagnosis)
            saved.append(diagnosis)

        # Advance status to in_consultation (from either checked_in or vitals_recorded)
        visit = db.session.query(Encounter).filter(Encounter.id == visit_id).first()
        if visit and visit.status in ('checked_in', 'vitals_recorded'):
            visit.status = 'in_consultation'

        db.session.commit()
        return [d.to_dict() for d in saved]

    @staticmethod
    def get_diagnoses(visit_id: UUID) -> List[dict]:
        diagnoses = db.session.query(Diagnosis).filter(
            Diagnosis.encounter_id == visit_id
        ).all()
        return [d.to_dict() for d in diagnoses]


# ---------------------------------------------------------------------------
# Prescription Service
# ---------------------------------------------------------------------------

class OPDPrescriptionService:

    @staticmethod
    def save_prescription(
        visit_id: UUID,
        patient_id: UUID,
        provider_id: UUID,
        items: List[dict],
        notes: Optional[str] = None,
        finalize: bool = False
    ) -> dict:
        """Create or replace prescription for a visit."""
        # Upsert prescription
        prescription = db.session.query(OPDPrescription).filter(
            OPDPrescription.encounter_id == visit_id
        ).first()

        if not prescription:
            prescription = OPDPrescription(
                id=uuid4(),
                encounter_id=visit_id,
                patient_id=patient_id,
                prescribed_by=provider_id,
                status=PrescriptionStatus.DRAFT,
                notes=notes
            )
            db.session.add(prescription)
            db.session.flush()
        else:
            prescription.notes = notes
            # Remove old items
            db.session.query(OPDPrescriptionItem).filter(
                OPDPrescriptionItem.prescription_id == prescription.id
            ).delete()

        # Add items
        for item in items:
            pi = OPDPrescriptionItem(
                id=uuid4(),
                prescription_id=prescription.id,
                medicine_id=UUID(item['medicine_id']) if item.get('medicine_id') else None,
                medicine_name=item['medicine_name'],
                dosage=item.get('dosage'),
                dosage_morning=item.get('dosage_morning'),
                dosage_afternoon=item.get('dosage_afternoon'),
                dosage_night=item.get('dosage_night'),
                dosage_6am=item.get('dosage_6am'),
                dosage_10am=item.get('dosage_10am'),
                dosage_2pm=item.get('dosage_2pm'),
                dosage_6pm=item.get('dosage_6pm'),
                dosage_10pm=item.get('dosage_10pm'),
                schedule_mode=item.get('schedule_mode', 'opioid'),
                custom_timings=item.get('custom_timings'),
                frequency=item.get('frequency'),
                sos=item.get('sos', False),
                duration=item.get('duration'),
                duration_unit=item.get('duration_unit', 'days'),
                quantity=item.get('quantity'),
                instructions=item.get('instructions'),
                route=item.get('route', 'oral'),
                medicine_type=item.get('medicine_type'),
                dosage_form=item.get('dosage_form'),
                warning_signs=item.get('warning_signs'),
            )
            db.session.add(pi)

        if finalize:
            prescription.status = PrescriptionStatus.FINALIZED

        db.session.commit()

        # Reload with items eagerly
        prescription = db.session.query(OPDPrescription).options(
            joinedload(OPDPrescription.items)
        ).filter(OPDPrescription.id == prescription.id).first()
        return prescription.to_dict()

    @staticmethod
    def get_prescription(visit_id: UUID) -> Optional[dict]:
        prescription = db.session.query(OPDPrescription).options(
            joinedload(OPDPrescription.items)
        ).filter(OPDPrescription.encounter_id == visit_id).first()
        return prescription.to_dict() if prescription else None

    @staticmethod
    def update_status(visit_id: UUID, status: str) -> Optional[dict]:
        prescription = db.session.query(OPDPrescription).filter(
            OPDPrescription.encounter_id == visit_id
        ).first()
        if not prescription:
            return None
        prescription.status = PrescriptionStatus(status)
        db.session.commit()
        return prescription.to_dict()


# ---------------------------------------------------------------------------
# Lab Order Service
# ---------------------------------------------------------------------------

class OPDLabOrderService:

    @staticmethod
    def save_lab_order(
        visit_id: UUID,
        patient_id: UUID,
        provider_id: UUID,
        items: List[dict],
        notes: Optional[str] = None
    ) -> dict:
        """Create or replace lab order for a visit."""
        # Upsert
        lab_order = db.session.query(OPDLabOrder).filter(
            OPDLabOrder.encounter_id == visit_id
        ).first()

        if not lab_order:
            lab_order = OPDLabOrder(
                id=uuid4(),
                encounter_id=visit_id,
                patient_id=patient_id,
                ordered_by=provider_id,
                status=LabOrderStatus.ORDERED,
                notes=notes
            )
            db.session.add(lab_order)
            db.session.flush()
        else:
            lab_order.notes = notes
            db.session.query(OPDLabOrderItem).filter(
                OPDLabOrderItem.lab_order_id == lab_order.id
            ).delete()

        for item in items:
            urgency_str = (item.get('urgency') or 'routine').lower()
            li = OPDLabOrderItem(
                id=uuid4(),
                lab_order_id=lab_order.id,
                test_name=item['test_name'],
                urgency=LabUrgency(urgency_str),
                notes=item.get('notes')
            )
            db.session.add(li)

        db.session.commit()

        # Reload with items eagerly
        lab_order = db.session.query(OPDLabOrder).options(
            joinedload(OPDLabOrder.items)
        ).filter(OPDLabOrder.id == lab_order.id).first()
        return lab_order.to_dict()

    @staticmethod
    def get_lab_order(visit_id: UUID) -> Optional[dict]:
        lab_order = db.session.query(OPDLabOrder).options(
            joinedload(OPDLabOrder.items)
        ).filter(OPDLabOrder.encounter_id == visit_id).first()
        return lab_order.to_dict() if lab_order else None
