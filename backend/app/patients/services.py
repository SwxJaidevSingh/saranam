"""
Patient Service Layer
Business logic for patient management operations
"""

from sqlalchemy import or_, and_, func, desc, asc
from datetime import date, datetime
from typing import Optional, List, Dict, Tuple
from uuid import UUID
import math

from app.extensions import db
from app.patients.models import Patient, UhidHistory
from app.submissions.models import FormSubmission
from app.patients.schemas import (
    PatientCreateSchema,
    PatientUpdateSchema,
    PatientSearchSchema
)


class PatientService:
    """Service class for patient operations"""

    @staticmethod
    def _calculate_age(date_of_birth: date) -> Optional[int]:
        """Calculate age from date of birth"""
        if not date_of_birth:
            return None
        today = date.today()
        age = today.year - date_of_birth.year
        if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
            age -= 1
        return age

    @staticmethod
    def _prepare_patient_response(patient: Patient, include_stats: bool = True, stats_by_id: Optional[Dict] = None) -> dict:
        """
        Prepare patient data for response. Decrypts encrypted fields and
        calculates derived fields.

        Args:
            patient: SQLAlchemy Patient instance.
            include_stats: Whether to include submission_count/last_submission.
            stats_by_id: Optional precomputed stats dict keyed by patient.id, for
                the list endpoint's batch path. When provided, avoids the
                per-patient submission subquery (N+1). When None and
                include_stats=True, falls back to a single per-patient query
                (used by single-patient detail endpoints).
        """
        from app.patients.uhid_service import get_homecare_code

        data = {
            'id': patient.id,
            'uhid': patient.uhid,
            'linked_hospital': patient.linked_hospital,
            'homecare_code': get_homecare_code(patient.linked_hospital),
            'hospital_uhid': patient.hospital_uhid,
            'full_name': patient.full_name,
            'date_of_birth': patient.date_of_birth,
            'age': PatientService._calculate_age(patient.date_of_birth) if patient.date_of_birth else None,
            'gender': patient.gender,
            'phone_number': patient.get_phone() if patient.contact_encrypted else None,
            'phone': patient.get_phone() if patient.contact_encrypted else None,
            'contact': patient.get_contact() if patient.contact_encrypted else None,
            'address': patient.get_address() if patient.address_encrypted else None,
            'abha_id': patient.get_abha_id() if patient.abha_id_encrypted else None,
            'abha_address': patient.abha_address,
            'has_abha': patient.abha_id_encrypted is not None,
            'is_active': patient.is_active,
            'registration_date': patient.registration_date,
            'created_at': patient.created_at,
            'updated_at': patient.updated_at,
            'created_by': patient.created_by,
            'external_metadata': patient.external_metadata,
            'latitude': (patient.external_metadata or {}).get('latitude'),
            'longitude': (patient.external_metadata or {}).get('longitude'),
            'city': (patient.external_metadata or {}).get('city'),
            'drive_distance_km': (patient.external_metadata or {}).get('drive_distance_km'),
            'diagnosis': patient.diagnosis,
            'referred_from': patient.referred_from,
            # Multi-tenant ownership + structured referral origin (Hospital Portal).
            'organization_id': str(patient.organization_id) if patient.organization_id else None,
            'origin_type': patient.origin_type,
            'origin_source_code': patient.origin_source_code,
            'origin_organization_id': str(patient.origin_organization_id) if patient.origin_organization_id else None,
            'origin_source_name': patient.origin_source_name,
            'origin_referral_date': patient.origin_referral_date.isoformat() if patient.origin_referral_date else None,
            'origin_notes': patient.origin_notes,
            'is_approximate_dob': patient.is_approximate_dob,
            'is_bangalore_resident': patient.is_bangalore_resident,
            'geographic_cluster': patient.geographic_cluster,
            'bsc_status': patient.bsc_status,
            'is_onco': patient.is_onco,
            'clinical_complexity': patient.clinical_complexity,
            'latest_pps_score': patient.latest_pps_score,
            'patient_priority': patient.patient_priority,
            'alternative_phone': patient.alternative_phone,
            'alternative_phone_name': patient.alternative_phone_name,
            'primary_caregiver_name': patient.primary_caregiver_name,
            'primary_caregiver_relationship': patient.primary_caregiver_relationship,
            'primary_caregiver_phone': patient.primary_caregiver_phone,
            'decision_maker_name': patient.decision_maker_name,
            'decision_maker_designation': patient.decision_maker_designation,
            'decision_maker_phone': patient.decision_maker_phone,
            'is_deceased': patient.is_deceased,
            'date_of_death': patient.date_of_death.isoformat() if patient.date_of_death else None,
            'care_status': patient.care_status,
            'is_contacted': patient.is_contacted if patient.is_contacted is not None else True,
            'home_care_decline_reason': patient.home_care_decline_reason,
            'place_of_death': patient.place_of_death,
            'place_of_death_remarks': patient.place_of_death_remarks,
            'educational_status': patient.educational_status,
            'occupation': patient.occupation,
            'religion': patient.religion,
            'marital_status': patient.marital_status,
            'preferred_language': patient.preferred_language,
            'barriers_to_communication': patient.barriers_to_communication,
            'no_of_children': patient.no_of_children,
            'source_of_information': patient.source_of_information,
            'family_chart': patient.family_chart,
            'genogram': patient.genogram,
        }


        # Add submission statistics if requested.
        # Fast path: caller precomputed stats_by_id (batch query over all ids).
        # Slow path: per-row subquery — only used by single-patient endpoints.
        if include_stats:
            if stats_by_id is not None:
                count, last_submission = stats_by_id.get(patient.id, (0, None))
                data['submission_count'] = count
                data['last_submission'] = last_submission
            else:
                submission_stats = db.session.query(
                    func.count(FormSubmission.id).label('count'),
                    func.max(FormSubmission.created_at).label('last_submission')
                ).filter(
                    FormSubmission.patient_id == patient.id
                ).first()

                data['submission_count'] = submission_stats.count if submission_stats else 0
                data['last_submission'] = submission_stats.last_submission if submission_stats else None

        return data

    @staticmethod
    def search_patients(
        query: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        filters: Optional[Dict] = None
    ) -> Tuple[List[dict], int]:
        """
        Search patients with optional filters

        Args:
            query: Search string (searches name, abha_address)
            limit: Number of results to return
            offset: Number of results to skip
            filters: Additional filters (gender, etc.)

        Returns:
            Tuple of (list of patients, total count)
        """
        # Base query
        base_query = Patient.query.filter(Patient.is_active == True)

        # Apply search query
        if query and len(query) >= 2:
            search_pattern = f"%{query}%"
            # Strip non-digits for UHID prefix matching (UHIDs are pure digits)
            digits_only = ''.join(c for c in query if c.isdigit())
            uhid_pattern = f"{digits_only}%" if digits_only else None

            # Subquery: patient ids whose old UHID (in history) matches the digits
            old_uhid_patient_ids = None
            if uhid_pattern:
                old_uhid_patient_ids = (
                    db.session.query(UhidHistory.patient_id)
                    .filter(UhidHistory.old_uhid.like(uhid_pattern))
                    .subquery()
                )

            search_clauses = [
                Patient.full_name.ilike(search_pattern),
                Patient.abha_address.ilike(search_pattern),
                Patient.hospital_uhid.ilike(search_pattern),
            ]
            if uhid_pattern:
                search_clauses.append(Patient.uhid.like(uhid_pattern))
                search_clauses.append(Patient.id.in_(db.session.query(old_uhid_patient_ids.c.patient_id)))

            base_query = base_query.filter(or_(*search_clauses))

        # Apply filters
        if filters:
            if filters.get('gender'):
                base_query = base_query.filter(Patient.gender == filters['gender'])

            # Age filters (approximate based on date_of_birth)
            if filters.get('age_min') or filters.get('age_max'):
                today = date.today()

                if filters.get('age_max'):
                    min_dob = date(today.year - filters['age_max'], today.month, today.day)
                    base_query = base_query.filter(Patient.date_of_birth >= min_dob)

                if filters.get('age_min'):
                    max_dob = date(today.year - filters['age_min'], today.month, today.day)
                    base_query = base_query.filter(Patient.date_of_birth <= max_dob)

            # Date filters
            if filters.get('created_after'):
                base_query = base_query.filter(Patient.created_at >= filters['created_after'])

            if filters.get('created_before'):
                base_query = base_query.filter(Patient.created_at <= filters['created_before'])

            # Has ABHA filter
            if filters.get('has_abha') is not None:
                if filters['has_abha']:
                    base_query = base_query.filter(Patient.abha_id_encrypted.isnot(None))
                else:
                    base_query = base_query.filter(Patient.abha_id_encrypted.is_(None))

            # Has submissions filter
            if filters.get('has_submissions'):
                base_query = base_query.join(FormSubmission).group_by(Patient.id)

            # BSC status filter
            if 'bsc_status' in filters and filters['bsc_status'] is not None:
                base_query = base_query.filter(Patient.bsc_status == filters['bsc_status'])

            # Onco status filter
            if 'is_onco' in filters and filters['is_onco'] is not None:
                base_query = base_query.filter(Patient.is_onco == filters['is_onco'])

            # Contacted status filter
            if 'is_contacted' in filters and filters['is_contacted'] is not None:
                if filters['is_contacted']:
                    base_query = base_query.filter(or_(Patient.is_contacted == True, Patient.is_contacted.is_(None)))
                else:
                    base_query = base_query.filter(Patient.is_contacted == False)

            # Geographic cluster filter
            if filters.get('geographic_cluster'):
                base_query = base_query.filter(Patient.geographic_cluster == filters['geographic_cluster'])

        # Get total count before pagination
        total = base_query.count()

        # Apply sorting
        sort_by = filters.get('sort_by', 'created_at') if filters else 'created_at'
        sort_order = filters.get('sort_order', 'desc') if filters else 'desc'

        sort_column = getattr(Patient, sort_by, Patient.created_at)
        if sort_order == 'desc':
            base_query = base_query.order_by(desc(sort_column))
        else:
            base_query = base_query.order_by(asc(sort_column))

        # Apply pagination
        patients = base_query.limit(limit).offset(offset).all()

        # Precompute submission stats for the whole page in ONE query
        # instead of one subquery per row. Fixes the N+1 that cost ~1-2s
        # on a 500-row search.
        patient_ids = [p.id for p in patients]
        stats_by_id: Dict = {}
        if patient_ids:
            stats_rows = db.session.query(
                FormSubmission.patient_id,
                func.count(FormSubmission.id).label('count'),
                func.max(FormSubmission.created_at).label('last_submission'),
            ).filter(
                FormSubmission.patient_id.in_(patient_ids)
            ).group_by(FormSubmission.patient_id).all()
            stats_by_id = {r.patient_id: (r.count, r.last_submission) for r in stats_rows}

        patient_list = [
            PatientService._prepare_patient_response(p, include_stats=True, stats_by_id=stats_by_id)
            for p in patients
        ]

        return patient_list, total

    @staticmethod
    def get_patient_by_id(patient_id: UUID) -> Optional[dict]:
        """
        Get patient by ID

        Args:
            patient_id: UUID of the patient

        Returns:
            Patient data dict or None if not found
        """
        patient = Patient.query.get(patient_id)
        if not patient:
            return None

        return PatientService._prepare_patient_response(patient, include_stats=True)

    @staticmethod
    def _default_org_id():
        """Resolve the internal CVRAMAN organization id (default patient owner).

        Cached per-process; CVRAMAN is seeded by the multi-tenant migration and
        its id is stable. Raises if missing (migration not yet applied).
        """
        cached = getattr(PatientService, '_cvraman_org_id', None)
        if cached is not None:
            return cached
        from app.organizations.models import Organization
        org = Organization.query.filter_by(code='CVRAMAN').first()
        if not org:
            raise ValueError(
                "Default organization 'CVRAMAN' not found — apply the "
                "multi-tenant migration before creating patients.")
        PatientService._cvraman_org_id = org.id
        return org.id

    @staticmethod
    def create_patient(data: PatientCreateSchema, created_by: UUID,
                       organization_id: Optional[UUID] = None) -> dict:
        """
        Create a new patient

        Args:
            data: PatientCreateSchema with validated data
            created_by: UUID of user creating the patient
            organization_id: owning tenant org. Portal passes the caller's
                active org; main app / bulk / submissions pass None → defaults
                to the internal CVRAMAN org (organization_id is NOT NULL).

        Returns:
            Created patient data dict
        """
        # Create patient instance.
        # UHID is intentionally NOT assigned here — it's generated when the
        # care team marks the Initial Assessment as complete (see
        # VisitService.update_visit). Pre-baseline patients have uhid=NULL.
        # Multi-tenant ownership: force a concrete org (never from client input).
        from datetime import date as date_type

        org_id = organization_id or PatientService._default_org_id()
        is_contacted_val = data.is_contacted if data.is_contacted is not None else True
        if not is_contacted_val:
            care_status_val = 'inactive'
            decline_reason_val = 'Not contacted'
        else:
            care_status_val = data.care_status or 'active'
            decline_reason_val = data.home_care_decline_reason

        patient = Patient(
            full_name=data.full_name,
            date_of_birth=data.date_of_birth,
            registration_date=data.registration_date or date_type.today(),
            gender=data.gender,
            abha_address=data.abha_address,
            is_active=True,
            created_by=created_by,
            organization_id=org_id,
            diagnosis=data.diagnosis,
            referred_from=data.referred_from,
            is_approximate_dob=data.is_approximate_dob,
            is_bangalore_resident=data.is_bangalore_resident,
            geographic_cluster=data.geographic_cluster if data.is_bangalore_resident else None,
            linked_hospital=data.linked_hospital if data.is_bangalore_resident else None,
            hospital_uhid=(data.hospital_uhid or '').strip() or None,
            bsc_status=data.bsc_status,
            is_onco=data.is_onco,
            clinical_complexity=data.clinical_complexity,
            patient_priority=data.patient_priority,
            alternative_phone=data.alternative_phone,
            alternative_phone_name=data.alternative_phone_name,
            primary_caregiver_name=data.primary_caregiver_name,
            primary_caregiver_relationship=data.primary_caregiver_relationship,
            primary_caregiver_phone=data.primary_caregiver_phone,
            decision_maker_name=data.decision_maker_name,
            decision_maker_designation=data.decision_maker_designation,
            decision_maker_phone=data.decision_maker_phone,
            is_contacted=is_contacted_val,
            home_care_decline_reason=decline_reason_val,
            care_status=care_status_val,
            place_of_death=data.place_of_death,
            place_of_death_remarks=data.place_of_death_remarks,
            educational_status=data.educational_status,
            occupation=data.occupation,
            religion=data.religion,
            marital_status=data.marital_status,
            preferred_language=data.preferred_language,
            barriers_to_communication=data.barriers_to_communication,
            no_of_children=data.no_of_children,
            source_of_information=data.source_of_information,
            family_chart=data.family_chart,
            genogram=data.genogram,
        )


        # Set encrypted fields using model methods
        if data.abha_id:
            patient.set_abha_id(data.abha_id)

        # Combine contact info (phone and email)
        contact_parts = []
        if data.phone_number:
            contact_parts.append(f"Phone: {data.phone_number}")
        if data.email:
            contact_parts.append(f"Email: {data.email}")
        if contact_parts:
            patient.set_contact("; ".join(contact_parts))

        # Combine address info
        address_parts = []
        if data.address_line1:
            address_parts.append(data.address_line1)
        if data.address_line2:
            address_parts.append(data.address_line2)
        if data.city:
            address_parts.append(data.city)
        if data.state:
            address_parts.append(data.state)
        if data.postal_code:
            address_parts.append(data.postal_code)
        if data.country:
            address_parts.append(data.country)
        if address_parts:
            patient.set_address(", ".join(address_parts))

        # Save external_metadata (lat/lng, city, etc.) if provided
        meta = {}
        if hasattr(data, 'external_metadata') and data.external_metadata:
            meta = data.external_metadata
        # Also store city in metadata for quick access
        if data.city and 'city' not in meta:
            meta['city'] = data.city
        if meta:
            patient.external_metadata = meta

        # Save to database
        db.session.add(patient)
        db.session.commit()

        # Auto-create initial visit for Saranam baseline assessments
        try:
            from app.saranam.models.patient_visit import PatientVisit
            from datetime import date as date_type
            initial_visit = PatientVisit(
                patient_id=patient.id,
                visit_number=0,
                visit_type='initial',
                visit_date=date_type.today(),
                visit_location='opd',
                status='in_progress',
                created_by=created_by,
            )
            db.session.add(initial_visit)
            db.session.commit()
        except Exception:
            pass  # Non-critical — visit can be created manually later

        # Return patient data
        return PatientService._prepare_patient_response(patient, include_stats=False)

    @staticmethod
    def update_patient(patient_id: UUID, data: PatientUpdateSchema, updated_by: UUID) -> Optional[dict]:
        """
        Update an existing patient

        Args:
            patient_id: UUID of the patient to update
            data: PatientUpdateSchema with validated update data
            updated_by: UUID of user updating the patient

        Returns:
            Updated patient data dict or None if not found
        """
        patient = Patient.query.get(patient_id)
        if not patient:
            return None

        # Update basic fields
        if data.full_name is not None:
            patient.full_name = data.full_name
        if data.date_of_birth is not None:
            patient.date_of_birth = data.date_of_birth
        if data.gender is not None:
            patient.gender = data.gender
        if data.abha_address is not None:
            patient.abha_address = data.abha_address

        # Update encrypted fields
        if data.abha_id is not None:
            if data.abha_id:
                patient.set_abha_id(data.abha_id)
            else:
                patient.abha_id_encrypted = None

        # Update contact info
        if data.phone_number is not None or data.email is not None:
            contact_parts = []
            if data.phone_number:
                contact_parts.append(f"Phone: {data.phone_number}")
            if data.email:
                contact_parts.append(f"Email: {data.email}")
            if contact_parts:
                patient.set_contact("; ".join(contact_parts))

        # Update diagnosis & referral
        if data.diagnosis is not None:
            patient.diagnosis = data.diagnosis
        if data.referred_from is not None:
            patient.referred_from = data.referred_from
        if data.is_approximate_dob is not None:
            patient.is_approximate_dob = data.is_approximate_dob

        # Update Bangalore zone clustering.
        # NOTE: UHID is intentionally NOT regenerated when zone or residency changes.
        # Once minted at creation time, a UHID is immutable. The only supported way
        # to change a UHID is the admin-only POST /api/patients/<id>/regenerate-uhid
        # route, which logs the change in uhid_history.
        #
        # Editing linked_hospital is similarly decoupled from UHID regeneration —
        # only the displayed Homecare Code prefix updates. This is intentional so
        # admins can correct a wrong hospital selection without burning a sequence
        # number for every small correction.
        if data.is_bangalore_resident is not None:
            patient.is_bangalore_resident = data.is_bangalore_resident
            if not data.is_bangalore_resident:
                patient.geographic_cluster = None
                patient.linked_hospital = None
        if data.geographic_cluster is not None and patient.is_bangalore_resident:
            patient.geographic_cluster = data.geographic_cluster
        if data.linked_hospital is not None and patient.is_bangalore_resident:
            patient.linked_hospital = data.linked_hospital

        # Update BSC status and onco
        if data.bsc_status is not None:
            patient.bsc_status = data.bsc_status
        if data.is_onco is not None:
            patient.is_onco = data.is_onco
        if data.clinical_complexity is not None:
            patient.clinical_complexity = data.clinical_complexity
        if data.patient_priority is not None:
            patient.patient_priority = data.patient_priority
        if data.alternative_phone is not None:
            patient.alternative_phone = data.alternative_phone
        if data.alternative_phone_name is not None:
            patient.alternative_phone_name = data.alternative_phone_name
        if data.hospital_uhid is not None:
            patient.hospital_uhid = data.hospital_uhid.strip() or None
        # Care Circle (primary caregiver + decision maker, captured at baseline)
        if data.primary_caregiver_name is not None:
            patient.primary_caregiver_name = data.primary_caregiver_name.strip() or None
        if data.primary_caregiver_relationship is not None:
            patient.primary_caregiver_relationship = data.primary_caregiver_relationship.strip() or None
        if data.primary_caregiver_phone is not None:
            patient.primary_caregiver_phone = data.primary_caregiver_phone.strip() or None
        if data.decision_maker_name is not None:
            patient.decision_maker_name = data.decision_maker_name.strip() or None
        if data.decision_maker_designation is not None:
            patient.decision_maker_designation = data.decision_maker_designation.strip() or None
        if data.decision_maker_phone is not None:
            patient.decision_maker_phone = data.decision_maker_phone.strip() or None
        if data.educational_status is not None:
            patient.educational_status = data.educational_status.strip() or None
        if data.occupation is not None:
            patient.occupation = data.occupation.strip() or None
        if data.religion is not None:
            patient.religion = data.religion.strip() or None
        if data.marital_status is not None:
            patient.marital_status = data.marital_status.strip() or None
        if data.preferred_language is not None:
            patient.preferred_language = data.preferred_language.strip() or None
        if data.barriers_to_communication is not None:
            patient.barriers_to_communication = data.barriers_to_communication.strip() or None
        if data.no_of_children is not None:
            patient.no_of_children = data.no_of_children
        if data.source_of_information is not None:
            patient.source_of_information = data.source_of_information.strip() or None
        if data.family_chart is not None:
            patient.family_chart = data.family_chart
        if data.genogram is not None:
            patient.genogram = data.genogram

        if data.registration_date is not None:
            patient.registration_date = data.registration_date

        # Palliative outcome — set from the last visit form when team learns of death.
        # Three-state status (§3, 2026-04-14): care_status auto-demotes to
        # 'inactive' when is_deceased flips true, so the scheduler pool drops
        # the patient the moment death is recorded.
        if data.is_deceased is not None:
            patient.is_deceased = data.is_deceased
            if data.is_deceased:
                patient.care_status = 'inactive'
        if data.date_of_death is not None:
            patient.date_of_death = data.date_of_death
        if data.is_contacted is not None:
            patient.is_contacted = data.is_contacted
            if not data.is_contacted:
                patient.care_status = 'inactive'
                patient.home_care_decline_reason = 'Not contacted'
            else:
                # If they transition to contacted, clear 'Not contacted' state
                if patient.home_care_decline_reason == 'Not contacted':
                    patient.care_status = 'active'
                    patient.home_care_decline_reason = None

        if data.care_status is not None:
            patient.care_status = data.care_status
            if data.care_status == 'active':
                patient.home_care_decline_reason = None

        if data.home_care_decline_reason is not None:
            patient.home_care_decline_reason = data.home_care_decline_reason or None

        if data.place_of_death is not None:
            patient.place_of_death = data.place_of_death or None
        if data.place_of_death_remarks is not None:
            patient.place_of_death_remarks = (data.place_of_death_remarks or '').strip() or None

        # Update address
        if any([data.address_line1, data.address_line2, data.city, data.state, data.postal_code, data.country]):
            address_parts = []
            if data.address_line1:
                address_parts.append(data.address_line1)
            if data.address_line2:
                address_parts.append(data.address_line2)
            if data.city:
                address_parts.append(data.city)
            if data.state:
                address_parts.append(data.state)
            if data.postal_code:
                address_parts.append(data.postal_code)
            if data.country:
                address_parts.append(data.country)
            if address_parts:
                patient.set_address(", ".join(address_parts))

        # Update external metadata if provided (merge keys)
        if hasattr(data, 'external_metadata') and data.external_metadata is not None:
            meta = dict(patient.external_metadata or {})
            meta.update(data.external_metadata)
            patient.external_metadata = meta

        # Update metadata
        patient.updated_at = datetime.utcnow()

        # Save changes
        db.session.commit()

        return PatientService._prepare_patient_response(patient, include_stats=True)

    @staticmethod
    def get_patient_submissions(patient_id: UUID, page: int = 1, per_page: int = 20) -> Tuple[List[dict], int]:
        """
        Get all form submissions for a patient

        Args:
            patient_id: UUID of the patient
            page: Page number (1-indexed)
            per_page: Results per page

        Returns:
            Tuple of (list of submissions, total count)
        """
        offset = (page - 1) * per_page

        query = FormSubmission.query.filter(
            FormSubmission.patient_id == patient_id
        ).order_by(desc(FormSubmission.created_at))

        total = query.count()
        submissions = query.limit(per_page).offset(offset).all()

        submission_list = [
            {
                'id': s.id,
                'form_id': s.form_id,
                'form_name': s.form.name if s.form else None,
                'risk_score': None,  # TODO: Calculate from form answers if needed
                'risk_category': None,  # TODO: Derive from risk_score if needed
                'submitted_by': s.submitted_by,
                'submitted_by_name': s.submitted_by_user.full_name if s.submitted_by_user else None,
                'created_at': s.created_at,
                'updated_at': s.updated_at
            }
            for s in submissions
        ]

        return submission_list, total

    @staticmethod
    def get_recent_patients(user_id: UUID, limit: int = 10) -> List[dict]:
        """
        Get recently accessed patients for a user

        Args:
            user_id: UUID of the user
            limit: Number of recent patients to return

        Returns:
            List of recent patient data
        """
        # Query recent_patients table
        from sqlalchemy import text

        query = text("""
            SELECT p.*, rp.last_accessed, rp.access_count
            FROM patients p
            JOIN recent_patients rp ON rp.patient_id = p.id
            WHERE rp.user_id = :user_id
            ORDER BY rp.last_accessed DESC
            LIMIT :limit
        """)

        result = db.session.execute(query, {'user_id': str(user_id), 'limit': limit})

        recent_patients = []
        for row in result:
            patient = Patient.query.get(row.id)
            if patient:
                patient_data = PatientService._prepare_patient_response(patient, include_stats=False)
                patient_data['last_accessed'] = row.last_accessed
                patient_data['access_count'] = row.access_count
                recent_patients.append(patient_data)

        return recent_patients

    @staticmethod
    def track_patient_access(user_id: UUID, patient_id: UUID) -> None:
        """
        Track patient access for recent patients feature

        Args:
            user_id: UUID of the user accessing the patient
            patient_id: UUID of the patient being accessed
        """
        from sqlalchemy import text

        # Upsert into recent_patients table
        query = text("""
            INSERT INTO recent_patients (user_id, patient_id, last_accessed, access_count)
            VALUES (:user_id, :patient_id, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (user_id, patient_id)
            DO UPDATE SET
                last_accessed = CURRENT_TIMESTAMP,
                access_count = recent_patients.access_count + 1
        """)

        db.session.execute(query, {'user_id': str(user_id), 'patient_id': str(patient_id)})
        db.session.commit()

    @staticmethod
    def check_duplicate(
        abha_address: Optional[str] = None,
        full_name: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        phone_number: Optional[str] = None
    ) -> Optional[dict]:
        """
        Check if a patient with the same ABHA address, or same Name + DOB + Phone exists

        Args:
            abha_address: ABHA address to check
            full_name: Patient's full name
            date_of_birth: Patient's date of birth
            phone_number: Patient's phone number

        Returns:
            Patient data if duplicate found, None otherwise
        """
        if abha_address:
            patient = Patient.query.filter(Patient.abha_address == abha_address).first()
            if patient:
                return PatientService._prepare_patient_response(patient, include_stats=False)

        # A duplicate is also identified if at least 2 out of [Name, DOB, Phone] match
        demo_provided = [full_name, date_of_birth, phone_number]
        if len([d for d in demo_provided if d is not None]) >= 2:
            # Query candidate list: patients matching either Name or DOB in SQL
            query = Patient.query
            filters = []
            if full_name:
                filters.append(func.lower(Patient.full_name) == func.lower(full_name.strip()))
            if date_of_birth:
                filters.append(Patient.date_of_birth == date_of_birth)

            if filters:
                from sqlalchemy import or_
                candidates = query.filter(or_(*filters)).all()
            else:
                candidates = []

            # Normalize input phone number to compare digits only
            input_phone_digits = None
            if phone_number:
                input_phone_digits = ''.join(c for c in phone_number if c.isdigit())
                if input_phone_digits.startswith('91') and len(input_phone_digits) > 10:
                    input_phone_digits = input_phone_digits[2:]

            for candidate in candidates:
                matches = 0

                # 1. Check Name Match
                if full_name and candidate.full_name:
                    if candidate.full_name.strip().lower() == full_name.strip().lower():
                        matches += 1

                # 2. Check DOB Match
                if date_of_birth and candidate.date_of_birth:
                    if candidate.date_of_birth == date_of_birth:
                        matches += 1

                # 3. Check Phone Match
                if phone_number:
                    stored_phone = candidate.get_phone()
                    if stored_phone:
                        stored_phone_digits = ''.join(c for c in stored_phone if c.isdigit())
                        if stored_phone_digits.startswith('91') and len(stored_phone_digits) > 10:
                            stored_phone_digits = stored_phone_digits[2:]
                        if input_phone_digits == stored_phone_digits:
                            matches += 1

                if matches >= 2:
                    return PatientService._prepare_patient_response(candidate, include_stats=False)

        return None
