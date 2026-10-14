"""
IPD Service Layer
Business logic for IPD admissions, bed management, vitals tracking, and discharge workflows
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, Integer, case
from app.ipd.models import Bed, IPDAdmission, BedAssignment, BedWaitingList, VitalsRecord
from app.encounters.models import Encounter
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.services.models import Service
from app.common.models import User


class BedManagementService:
    """Service for bed inventory and assignment management"""

    @staticmethod
    def get_available_beds(
        db: Session,
        bed_type: Optional[str] = None,
        facility_id: Optional[UUID] = None,
        ward_name: Optional[str] = None
    ) -> List[Bed]:
        """Get all available beds with optional filters"""
        query = db.query(Bed).filter(
            Bed.bed_status == 'available',
            Bed.is_active == True
        )

        if bed_type:
            query = query.filter(Bed.bed_type == bed_type)
        if facility_id:
            query = query.filter(Bed.facility_id == facility_id)
        if ward_name:
            query = query.filter(Bed.ward_name == ward_name)

        return query.all()

    @staticmethod
    def assign_bed(
        db: Session,
        bed_id: UUID,
        patient_id: UUID,
        admission_id: Optional[UUID] = None,
        encounter_id: Optional[UUID] = None,
        assigned_by: Optional[UUID] = None,
        notes: Optional[str] = None
    ) -> Tuple[BedAssignment, Bed]:
        """Assign a bed to a patient"""
        # Get the bed
        bed = db.query(Bed).filter(Bed.id == bed_id).first()
        if not bed:
            raise ValueError(f"Bed {bed_id} not found")

        if bed.bed_status != 'available':
            raise ValueError(f"Bed {bed.bed_number} is not available (status: {bed.bed_status})")

        # Create bed assignment
        assignment = BedAssignment(
            bed_id=bed_id,
            admission_id=admission_id,
            patient_id=patient_id,
            encounter_id=encounter_id,
            assigned_at=datetime.utcnow(),
            assigned_by=assigned_by,
            assignment_status='active',
            notes=notes
        )
        db.add(assignment)

        # Update bed status
        bed.bed_status = 'occupied'

        # Update encounter bed_number if encounter_id provided
        if encounter_id:
            encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
            if encounter:
                encounter.bed_number = bed.bed_number

        db.commit()
        db.refresh(assignment)
        db.refresh(bed)

        return assignment, bed

    @staticmethod
    def release_bed(
        db: Session,
        bed_id: UUID,
        notes: Optional[str] = None
    ) -> Bed:
        """Release a bed (mark as cleaning)"""
        bed = db.query(Bed).filter(Bed.id == bed_id).first()
        if not bed:
            raise ValueError(f"Bed {bed_id} not found")

        # Mark current assignment as completed
        active_assignment = db.query(BedAssignment).filter(
            BedAssignment.bed_id == bed_id,
            BedAssignment.assignment_status == 'active'
        ).first()

        if active_assignment:
            active_assignment.assignment_status = 'completed'
            active_assignment.released_at = datetime.utcnow()
            if notes:
                active_assignment.notes = (active_assignment.notes or '') + f"\n{notes}"

        # Update bed status to cleaning
        bed.bed_status = 'cleaning'

        db.commit()
        db.refresh(bed)

        return bed

    @staticmethod
    def transfer_bed(
        db: Session,
        current_bed_id: UUID,
        new_bed_id: UUID,
        patient_id: UUID,
        admission_id: Optional[UUID] = None,
        transfer_reason: str = "",
        assigned_by: Optional[UUID] = None
    ) -> Tuple[BedAssignment, BedAssignment]:
        """Transfer patient from one bed to another"""
        # Release current bed
        current_bed = db.query(Bed).filter(Bed.id == current_bed_id).first()
        if not current_bed:
            raise ValueError(f"Current bed {current_bed_id} not found")

        current_assignment = db.query(BedAssignment).filter(
            BedAssignment.bed_id == current_bed_id,
            BedAssignment.patient_id == patient_id,
            BedAssignment.assignment_status == 'active'
        ).first()

        if not current_assignment:
            raise ValueError(f"No active assignment found for patient in bed {current_bed.bed_number}")

        # Mark current assignment as transferred
        current_assignment.assignment_status = 'transferred'
        current_assignment.released_at = datetime.utcnow()
        current_assignment.transfer_reason = transfer_reason

        # Update current bed status
        current_bed.bed_status = 'cleaning'

        # Assign new bed
        new_assignment, new_bed = BedManagementService.assign_bed(
            db=db,
            bed_id=new_bed_id,
            patient_id=patient_id,
            admission_id=admission_id,
            encounter_id=current_assignment.encounter_id,
            assigned_by=assigned_by,
            notes=f"Transferred from bed {current_bed.bed_number}. Reason: {transfer_reason}"
        )

        return current_assignment, new_assignment

    @staticmethod
    def get_bed_occupancy_stats(db: Session) -> Dict[str, Any]:
        """Get bed occupancy statistics"""
        total_beds = db.query(func.count(Bed.id)).filter(Bed.is_active == True).scalar()
        occupied = db.query(func.count(Bed.id)).filter(
            Bed.bed_status == 'occupied',
            Bed.is_active == True
        ).scalar()
        available = db.query(func.count(Bed.id)).filter(
            Bed.bed_status == 'available',
            Bed.is_active == True
        ).scalar()
        cleaning = db.query(func.count(Bed.id)).filter(
            Bed.bed_status == 'cleaning',
            Bed.is_active == True
        ).scalar()
        maintenance = db.query(func.count(Bed.id)).filter(
            Bed.bed_status == 'maintenance',
            Bed.is_active == True
        ).scalar()

        occupancy_rate = (occupied / total_beds * 100) if total_beds > 0 else 0

        # Get stats by bed type
        bed_type_stats = db.query(
            Bed.bed_type,
            func.count(Bed.id).label('total'),
            func.sum(func.cast(Bed.bed_status == 'occupied', Integer)).label('occupied')
        ).filter(Bed.is_active == True).group_by(Bed.bed_type).all()

        type_breakdown = []
        for bed_type, total, occupied in bed_type_stats:
            type_breakdown.append({
                'bed_type': bed_type,
                'total': total,
                'occupied': occupied or 0,
                'available': total - (occupied or 0),
                'occupancy_rate': ((occupied or 0) / total * 100) if total > 0 else 0
            })

        return {
            'total_beds': total_beds,
            'occupied_beds': occupied,
            'available_beds': available,
            'cleaning_beds': cleaning,
            'maintenance_beds': maintenance,
            'bed_occupancy_rate': round(occupancy_rate, 2),
            'by_type': type_breakdown
        }


class AdmissionService:
    """Service for IPD admission management"""

    @staticmethod
    def admit_patient(
        db: Session,
        patient_id: UUID,
        admission_type: str,
        admitting_doctor_id: Optional[UUID] = None,
        encounter_id: Optional[UUID] = None,
        create_new_encounter: bool = True,
        chief_complaint: Optional[str] = None,
        admission_source: Optional[str] = None,
        admission_diagnosis: Optional[str] = None,
        admission_notes: Optional[str] = None,
        estimated_length_of_stay_days: Optional[int] = None,
        service_id: Optional[UUID] = None,
        bed_id: Optional[UUID] = None,
        assigned_by: Optional[UUID] = None,
        admission_form_id: Optional[UUID] = None,
        form_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[IPDAdmission, Encounter]:
        """Admit a patient to IPD"""
        from app.submissions.models import FormSubmission, FormAnswer

        # Verify patient exists
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")

        # Handle encounter
        if create_new_encounter or not encounter_id:
            # Create new encounter
            encounter = Encounter(
                patient_id=patient_id,
                encounter_type='IPD',
                status='in-progress',
                chief_complaint=chief_complaint,
                admission_date=datetime.utcnow(),
                provider_id=admitting_doctor_id,
                service_id=service_id,
                start_time=datetime.utcnow()
            )
            db.add(encounter)
            db.flush()  # Get encounter ID
        else:
            # Use existing encounter
            encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
            if not encounter:
                raise ValueError(f"Encounter {encounter_id} not found")
            # Update encounter for IPD
            encounter.encounter_type = 'IPD'
            encounter.admission_date = datetime.utcnow()
            encounter.status = 'in-progress'
            # Update service_id if provided
            if service_id:
                encounter.service_id = service_id

        # Create form submission if form data provided
        admission_form_submission_id = None
        if form_data and admission_form_id:
            form_submission = FormSubmission(
                form_id=admission_form_id,
                patient_id=patient_id,
                encounter_id=encounter.id,
                submitted_by=assigned_by,
                data=form_data,
                status='submitted'
            )
            db.add(form_submission)
            db.flush()
            admission_form_submission_id = form_submission.id

        # Create IPD admission
        admission = IPDAdmission(
            encounter_id=encounter.id,
            patient_id=patient_id,
            admission_type=admission_type,
            admission_source=admission_source,
            admitting_doctor_id=admitting_doctor_id,
            admission_diagnosis=admission_diagnosis,
            admission_notes=admission_notes,
            estimated_length_of_stay_days=estimated_length_of_stay_days,
            admission_form_submission_id=admission_form_submission_id
        )
        db.add(admission)
        db.flush()  # Get admission ID

        # Assign bed if provided
        if bed_id:
            BedManagementService.assign_bed(
                db=db,
                bed_id=bed_id,
                patient_id=patient_id,
                admission_id=admission.id,
                encounter_id=encounter.id,
                assigned_by=assigned_by
            )

        db.commit()
        db.refresh(admission)
        db.refresh(encounter)

        return admission, encounter

    @staticmethod
    def discharge_patient(
        db: Session,
        admission_id: UUID,
        discharge_type: str,
        discharge_diagnosis: Optional[str] = None,
        discharge_summary: Optional[str] = None,
        discharge_instructions: Optional[str] = None,
        doctor_notes: Optional[str] = None,
        billing_summary: Optional[Dict[str, Any]] = None,
        schedule_follow_up: bool = False,
        follow_up_days: Optional[int] = None,
        follow_up_service_id: Optional[UUID] = None,
        discharge_form_id: Optional[UUID] = None,
        form_data: Optional[Dict[str, Any]] = None,
        discharged_by: Optional[UUID] = None
    ) -> IPDAdmission:
        """Discharge a patient from IPD"""
        from app.submissions.models import FormSubmission

        admission = db.query(IPDAdmission).filter(IPDAdmission.id == admission_id).first()
        if not admission:
            raise ValueError(f"Admission {admission_id} not found")

        encounter = db.query(Encounter).filter(Encounter.id == admission.encounter_id).first()
        if not encounter:
            raise ValueError(f"Encounter {admission.encounter_id} not found")

        # Create form submission if form data provided
        discharge_form_submission_id = None
        if form_data and discharge_form_id:
            form_submission = FormSubmission(
                form_id=discharge_form_id,
                patient_id=admission.patient_id,
                encounter_id=encounter.id,
                submitted_by=discharged_by,
                data=form_data,
                status='submitted'
            )
            db.add(form_submission)
            db.flush()
            discharge_form_submission_id = form_submission.id

        # Update admission
        admission.discharge_type = discharge_type
        admission.discharge_diagnosis = discharge_diagnosis
        admission.discharge_summary = discharge_summary
        admission.discharge_instructions = discharge_instructions
        admission.doctor_notes = doctor_notes
        admission.billing_summary = billing_summary
        admission.discharge_form_submission_id = discharge_form_submission_id

        # Update encounter
        encounter.discharge_date = datetime.utcnow()
        encounter.status = 'completed'
        encounter.end_time = datetime.utcnow()

        # Release bed
        active_assignment = db.query(BedAssignment).filter(
            BedAssignment.admission_id == admission_id,
            BedAssignment.assignment_status == 'active'
        ).first()

        if active_assignment:
            BedManagementService.release_bed(
                db=db,
                bed_id=active_assignment.bed_id,
                notes="Patient discharged"
            )

        # Schedule follow-up if requested
        if schedule_follow_up and follow_up_days:
            follow_up_date = datetime.utcnow() + timedelta(days=follow_up_days)
            follow_up_encounter = Encounter(
                patient_id=admission.patient_id,
                encounter_type='FollowUp',
                status='scheduled',
                start_time=follow_up_date,
                service_id=follow_up_service_id,
                provider_id=admission.admitting_doctor_id,
                chief_complaint=f"Follow-up from IPD admission on {encounter.admission_date.strftime('%Y-%m-%d')}"
            )
            db.add(follow_up_encounter)
            db.flush()

            admission.follow_up_appointment_id = follow_up_encounter.id
            admission.next_appointment_date = follow_up_date

        db.commit()
        db.refresh(admission)

        return admission

    @staticmethod
    def get_active_admissions(db: Session) -> List[IPDAdmission]:
        """Get all active IPD admissions"""
        return db.query(IPDAdmission).join(Encounter).filter(
            Encounter.status == 'in-progress',
            Encounter.discharge_date.is_(None)
        ).all()

    @staticmethod
    def calculate_length_of_stay(admission_date: datetime, discharge_date: Optional[datetime] = None) -> int:
        """Calculate length of stay in days"""
        end_date = discharge_date or datetime.utcnow()
        delta = end_date - admission_date
        return delta.days


class VitalsTrackingService:
    """Service for vitals tracking and monitoring"""

    @staticmethod
    def record_vitals(
        db: Session,
        encounter_id: UUID,
        patient_id: UUID,
        vitals_data: Dict[str, Any],
        recorded_by: Optional[UUID] = None,
        recorded_at: Optional[datetime] = None,
        observation_notes: Optional[str] = None
    ) -> VitalsRecord:
        """Record patient vitals"""
        vitals = VitalsRecord(
            encounter_id=encounter_id,
            patient_id=patient_id,
            recorded_at=recorded_at or datetime.utcnow(),
            recorded_by=recorded_by,
            vitals_data=vitals_data,
            observation_notes=observation_notes
        )

        # Check for critical values
        vitals.is_critical = vitals.check_critical_values()

        db.add(vitals)
        db.commit()
        db.refresh(vitals)

        return vitals

    @staticmethod
    def get_vitals_history(
        db: Session,
        encounter_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[VitalsRecord]:
        """Get vitals history for a patient or encounter"""
        query = db.query(VitalsRecord).order_by(VitalsRecord.recorded_at.desc())

        if encounter_id:
            query = query.filter(VitalsRecord.encounter_id == encounter_id)
        elif patient_id:
            query = query.filter(VitalsRecord.patient_id == patient_id)
        else:
            raise ValueError("Either encounter_id or patient_id must be provided")

        return query.limit(limit).all()

    @staticmethod
    def get_critical_vitals(db: Session, hours: int = 24) -> List[VitalsRecord]:
        """Get all critical vitals within specified hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return db.query(VitalsRecord).filter(
            VitalsRecord.is_critical == True,
            VitalsRecord.recorded_at >= cutoff_time
        ).order_by(VitalsRecord.recorded_at.desc()).all()

    @staticmethod
    def get_vitals_trend(
        db: Session,
        encounter_id: UUID,
        vital_name: str
    ) -> List[Dict[str, Any]]:
        """Get trend data for a specific vital"""
        vitals_records = db.query(VitalsRecord).filter(
            VitalsRecord.encounter_id == encounter_id
        ).order_by(VitalsRecord.recorded_at.asc()).all()

        trend = []
        for record in vitals_records:
            if vital_name in record.vitals_data and record.vitals_data[vital_name] is not None:
                trend.append({
                    'timestamp': record.recorded_at.isoformat(),
                    'value': record.vitals_data[vital_name],
                    'is_critical': record.is_critical
                })

        return trend


class WaitingListService:
    """Service for bed waiting list management"""

    @staticmethod
    def add_to_waiting_list(
        db: Session,
        patient_id: UUID,
        requested_bed_type: str,
        priority: str,
        service_id: Optional[UUID] = None,
        requested_by: Optional[UUID] = None,
        notes: Optional[str] = None
    ) -> BedWaitingList:
        """Add patient to bed waiting list"""
        waiting_entry = BedWaitingList(
            patient_id=patient_id,
            service_id=service_id,
            requested_bed_type=requested_bed_type,
            priority=priority,
            requested_at=datetime.utcnow(),
            requested_by=requested_by,
            status='waiting',
            notes=notes
        )

        db.add(waiting_entry)
        db.commit()
        db.refresh(waiting_entry)

        return waiting_entry

    @staticmethod
    def assign_from_waiting_list(
        db: Session,
        waiting_list_id: UUID,
        bed_id: UUID,
        assigned_by: Optional[UUID] = None
    ) -> Tuple[BedWaitingList, BedAssignment]:
        """Assign bed to patient from waiting list"""
        waiting_entry = db.query(BedWaitingList).filter(
            BedWaitingList.id == waiting_list_id
        ).first()

        if not waiting_entry:
            raise ValueError(f"Waiting list entry {waiting_list_id} not found")

        if waiting_entry.status != 'waiting':
            raise ValueError(f"Waiting list entry is not in waiting status: {waiting_entry.status}")

        # Verify bed matches requested type
        bed = db.query(Bed).filter(Bed.id == bed_id).first()
        if bed.bed_type != waiting_entry.requested_bed_type:
            raise ValueError(f"Bed type mismatch: requested {waiting_entry.requested_bed_type}, got {bed.bed_type}")

        # Assign bed (this will be used when patient is actually admitted)
        waiting_entry.assigned_bed_id = bed_id
        waiting_entry.assigned_at = datetime.utcnow()
        waiting_entry.status = 'assigned'

        db.commit()
        db.refresh(waiting_entry)

        return waiting_entry, None  # Return None for assignment as it will be created during admission

    @staticmethod
    def get_waiting_list(
        db: Session,
        status: str = 'waiting',
        priority: Optional[str] = None,
        bed_type: Optional[str] = None
    ) -> List[BedWaitingList]:
        """Get waiting list with filters"""
        query = db.query(BedWaitingList).filter(
            BedWaitingList.status == status
        ).order_by(
            # Order by priority (emergency first) then by requested time
            func.case(
                (BedWaitingList.priority == 'emergency', 1),
                (BedWaitingList.priority == 'urgent', 2),
                (BedWaitingList.priority == 'routine', 3),
                else_=4
            ),
            BedWaitingList.requested_at.asc()
        )

        if priority:
            query = query.filter(BedWaitingList.priority == priority)
        if bed_type:
            query = query.filter(BedWaitingList.requested_bed_type == bed_type)

        return query.all()


class IPDDashboardService:
    """Service for IPD dashboard statistics"""

    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict[str, Any]:
        """Get comprehensive IPD dashboard statistics"""
        # Get bed stats
        bed_stats = BedManagementService.get_bed_occupancy_stats(db)

        # Get admission stats
        total_admissions = db.query(func.count(IPDAdmission.id)).scalar()
        active_admissions = db.query(func.count(IPDAdmission.id)).join(
            Encounter, IPDAdmission.encounter_id == Encounter.id
        ).filter(
            Encounter.status == 'in-progress',
            Encounter.discharge_date.is_(None)
        ).scalar()

        # Today's discharges
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_discharges = db.query(func.count(IPDAdmission.id)).join(
            Encounter, IPDAdmission.encounter_id == Encounter.id
        ).filter(
            Encounter.discharge_date >= today_start
        ).scalar()

        # Calculate average length of stay
        completed_admissions = db.query(IPDAdmission).join(
            Encounter, IPDAdmission.encounter_id == Encounter.id
        ).filter(
            Encounter.discharge_date.isnot(None),
            Encounter.admission_date.isnot(None)
        ).limit(100).all()  # Last 100 completed admissions

        total_los = 0
        los_count = 0
        for admission in completed_admissions:
            encounter = admission.encounter
            if encounter.admission_date and encounter.discharge_date:
                los = AdmissionService.calculate_length_of_stay(
                    encounter.admission_date,
                    encounter.discharge_date
                )
                total_los += los
                los_count += 1

        avg_los = (total_los / los_count) if los_count > 0 else 0

        # Waiting list count
        waiting_count = db.query(func.count(BedWaitingList.id)).filter(
            BedWaitingList.status == 'waiting'
        ).scalar()

        # Critical vitals count (last 24 hours)
        critical_vitals = VitalsTrackingService.get_critical_vitals(db, hours=24)

        return {
            'total_admissions': total_admissions,
            'active_admissions': active_admissions,
            'total_discharges_today': today_discharges,
            'total_beds': bed_stats['total_beds'],
            'occupied_beds': bed_stats['occupied_beds'],
            'available_beds': bed_stats['available_beds'],
            'cleaning_beds': bed_stats['cleaning_beds'],
            'maintenance_beds': bed_stats['maintenance_beds'],
            'bed_occupancy_rate': bed_stats['bed_occupancy_rate'],
            'average_length_of_stay': round(avg_los, 1),
            'waiting_list_count': waiting_count,
            'critical_vitals_count': len(critical_vitals),
            'bed_type_breakdown': bed_stats['by_type']
        }
