"""
Cohort Service
Business logic for patient cohort management and analysis.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import and_, or_, func, extract
from app.extensions import db
from app.cohorts.models import PatientCohort, CohortMember, CohortActivity, CohortOutcome
from app.models import Patient, FormSubmission


class CohortService:
    """Service for managing patient cohorts."""

    @staticmethod
    def create_cohort(name: str, description: str, criteria: Dict, owner_id: str,
                     auto_update: bool = True, update_frequency: str = 'daily') -> PatientCohort:
        """
        Create a new patient cohort.

        Args:
            name: Cohort name
            description: Cohort description
            criteria: JSONB criteria for patient matching
            owner_id: UUID of the user creating the cohort
            auto_update: Whether to auto-update membership
            update_frequency: How often to update (daily, weekly, manual)

        Returns:
            Created PatientCohort instance
        """
        cohort = PatientCohort(
            name=name,
            description=description,
            criteria=criteria,
            owner_id=owner_id,
            auto_update=auto_update,
            update_frequency=update_frequency,
            is_active=True
        )

        db.session.add(cohort)
        db.session.commit()

        # Log activity
        CohortService._log_activity(
            cohort_id=cohort.id,
            activity_type='created',
            details={'criteria': criteria},
            performed_by=owner_id
        )

        # Initial membership calculation
        CohortService.recalculate_members(cohort.id, owner_id)

        return cohort

    @staticmethod
    def recalculate_members(cohort_id: str, user_id: str) -> int:
        """
        Recalculate cohort membership based on criteria.

        Args:
            cohort_id: UUID of the cohort
            user_id: UUID of user performing the action

        Returns:
            Number of patients in cohort after recalculation
        """
        cohort = PatientCohort.query.get(cohort_id)
        if not cohort:
            raise ValueError("Cohort not found")

        # Build query based on criteria
        query = CohortService._build_patient_query(cohort.criteria)

        # Get matching patients
        matching_patients = query.all()

        # Get existing members
        existing_member_ids = {
            m.patient_id for m in CohortMember.query.filter_by(cohort_id=cohort_id).all()
        }
        matching_patient_ids = {p.id for p in matching_patients}

        # Patients to add
        new_patient_ids = matching_patient_ids - existing_member_ids

        # Patients to remove (or mark as no longer qualifying)
        removed_patient_ids = existing_member_ids - matching_patient_ids

        # Add new members
        for patient_id in new_patient_ids:
            patient = Patient.query.get(patient_id)
            snapshot = CohortService._create_patient_snapshot(patient)

            member = CohortMember(
                cohort_id=cohort_id,
                patient_id=patient_id,
                snapshot_data=snapshot,
                still_qualifies=True
            )
            db.session.add(member)

        # Update removed members
        for patient_id in removed_patient_ids:
            member = CohortMember.query.filter_by(
                cohort_id=cohort_id,
                patient_id=patient_id
            ).first()
            if member:
                member.still_qualifies = False
                member.last_checked_at = datetime.utcnow()

        # Update cohort metadata
        cohort.member_count = len(matching_patient_ids)
        cohort.last_calculated_at = datetime.utcnow()
        cohort.updated_at = datetime.utcnow()

        db.session.commit()

        # Log activity
        CohortService._log_activity(
            cohort_id=cohort_id,
            activity_type='recalculated',
            details={
                'member_count': cohort.member_count,
                'added': len(new_patient_ids),
                'removed': len(removed_patient_ids)
            },
            performed_by=user_id
        )

        return cohort.member_count

    @staticmethod
    def _build_patient_query(criteria: Dict):
        """
        Build SQLAlchemy query from criteria.

        Supported criteria:
        - age: {min: int, max: int}
        - gender: str or List[str]
        - location: str
        - last_visit: {days_ago: int, operator: 'gt'|'lt'}
        - diagnoses: List[str]
        - forms_completed: {min: int, max: int}

        Args:
            criteria: Dictionary of criteria

        Returns:
            SQLAlchemy query object
        """
        query = Patient.query.filter(Patient.is_active == True)

        # Age filter
        if 'age' in criteria:
            age_criteria = criteria['age']
            today = datetime.utcnow().date()

            if 'min' in age_criteria:
                max_dob = today.replace(year=today.year - age_criteria['min'])
                query = query.filter(Patient.date_of_birth <= max_dob)

            if 'max' in age_criteria:
                min_dob = today.replace(year=today.year - age_criteria['max'])
                query = query.filter(Patient.date_of_birth >= min_dob)

        # Gender filter
        if 'gender' in criteria:
            gender = criteria['gender']
            if isinstance(gender, list):
                query = query.filter(Patient.gender.in_(gender))
            else:
                query = query.filter(Patient.gender == gender)

        # Location filter
        if 'location' in criteria:
            location = criteria['location']
            query = query.filter(
                or_(
                    Patient.city.ilike(f'%{location}%'),
                    Patient.state.ilike(f'%{location}%'),
                    Patient.country.ilike(f'%{location}%')
                )
            )

        # Last visit filter (based on form submissions)
        if 'last_visit' in criteria:
            visit_criteria = criteria['last_visit']
            days_ago = visit_criteria.get('days_ago', 90)
            operator = visit_criteria.get('operator', 'gt')  # 'gt' or 'lt'
            threshold_date = datetime.utcnow() - timedelta(days=days_ago)

            # Subquery for patients with recent submissions
            recent_submissions = db.session.query(
                FormSubmission.patient_id
            ).filter(
                FormSubmission.created_at >= threshold_date
            ).subquery()

            if operator == 'gt':  # Haven't visited in X days
                query = query.filter(~Patient.id.in_(db.session.query(recent_submissions)))
            else:  # Visited in last X days
                query = query.filter(Patient.id.in_(db.session.query(recent_submissions)))

        # Forms completed filter
        if 'forms_completed' in criteria:
            form_criteria = criteria['forms_completed']
            min_forms = form_criteria.get('min', 0)
            max_forms = form_criteria.get('max', 999999)

            # Subquery to count forms per patient
            form_counts = db.session.query(
                FormSubmission.patient_id,
                func.count(FormSubmission.id).label('form_count')
            ).group_by(FormSubmission.patient_id).subquery()

            query = query.join(form_counts, Patient.id == form_counts.c.patient_id)
            query = query.filter(
                and_(
                    form_counts.c.form_count >= min_forms,
                    form_counts.c.form_count <= max_forms
                )
            )

        return query

    @staticmethod
    def _create_patient_snapshot(patient: Patient) -> Dict:
        """
        Create a snapshot of patient data.

        Args:
            patient: Patient instance

        Returns:
            Dictionary with snapshot data
        """
        return {
            'age': patient.age if hasattr(patient, 'age') else None,
            'gender': patient.gender,
            'location': f"{patient.city}, {patient.state}" if patient.city and patient.state else None,
            'phone': patient.phone,
            'email': patient.email,
            'snapshotted_at': datetime.utcnow().isoformat()
        }

    @staticmethod
    def get_cohort_summary(cohort_id: str) -> Dict:
        """
        Get summary statistics for a cohort.

        Args:
            cohort_id: UUID of the cohort

        Returns:
            Dictionary with summary statistics
        """
        cohort = PatientCohort.query.get(cohort_id)
        if not cohort:
            raise ValueError("Cohort not found")

        # Get member demographics
        members = db.session.query(CohortMember, Patient).join(
            Patient, CohortMember.patient_id == Patient.id
        ).filter(
            CohortMember.cohort_id == cohort_id,
            CohortMember.still_qualifies == True
        ).all()

        # Calculate demographics
        total_members = len(members)
        gender_distribution = {}
        age_distribution = {'0-18': 0, '19-35': 0, '36-60': 0, '60+': 0}

        for member, patient in members:
            # Gender
            gender = patient.gender or 'Unknown'
            gender_distribution[gender] = gender_distribution.get(gender, 0) + 1

            # Age
            if hasattr(patient, 'age') and patient.age is not None:
                age = patient.age
            elif patient.date_of_birth:
                age = (datetime.utcnow().date() - patient.date_of_birth).days // 365
            else:
                continue

            if age <= 18:
                age_distribution['0-18'] += 1
            elif age <= 35:
                age_distribution['19-35'] += 1
            elif age <= 60:
                age_distribution['36-60'] += 1
            else:
                age_distribution['60+'] += 1

        return {
            'cohort_id': str(cohort.id),
            'name': cohort.name,
            'description': cohort.description,
            'total_members': total_members,
            'gender_distribution': gender_distribution,
            'age_distribution': age_distribution,
            'last_calculated_at': cohort.last_calculated_at.isoformat() if cohort.last_calculated_at else None,
            'created_at': cohort.created_at.isoformat()
        }

    @staticmethod
    def track_outcome(cohort_id: str, metric_name: str, metric_value: float,
                     metric_metadata: Optional[Dict] = None) -> CohortOutcome:
        """
        Track an outcome metric for a cohort.

        Args:
            cohort_id: UUID of the cohort
            metric_name: Name of the metric (e.g., 'avg_hba1c')
            metric_value: Value of the metric
            metric_metadata: Additional metadata

        Returns:
            Created CohortOutcome instance
        """
        outcome = CohortOutcome(
            cohort_id=cohort_id,
            metric_name=metric_name,
            metric_value=metric_value,
            metric_metadata=metric_metadata or {},
            recorded_at=datetime.utcnow()
        )

        db.session.add(outcome)
        db.session.commit()

        return outcome

    @staticmethod
    def get_outcome_trends(cohort_id: str, metric_name: str, days: int = 90) -> List[Dict]:
        """
        Get outcome trends for a specific metric.

        Args:
            cohort_id: UUID of the cohort
            metric_name: Name of the metric
            days: Number of days to look back

        Returns:
            List of outcome data points
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        outcomes = CohortOutcome.query.filter(
            CohortOutcome.cohort_id == cohort_id,
            CohortOutcome.metric_name == metric_name,
            CohortOutcome.recorded_at >= cutoff_date
        ).order_by(CohortOutcome.recorded_at).all()

        return [outcome.to_dict() for outcome in outcomes]

    @staticmethod
    def _log_activity(cohort_id: str, activity_type: str, details: Dict, performed_by: str):
        """
        Log an activity for a cohort.

        Args:
            cohort_id: UUID of the cohort
            activity_type: Type of activity
            details: Activity details
            performed_by: UUID of user performing the action
        """
        activity = CohortActivity(
            cohort_id=cohort_id,
            activity_type=activity_type,
            details=details,
            performed_by=performed_by
        )

        db.session.add(activity)
        db.session.commit()

    @staticmethod
    def get_cohort_activities(cohort_id: str, limit: int = 50) -> List[Dict]:
        """
        Get recent activities for a cohort.

        Args:
            cohort_id: UUID of the cohort
            limit: Maximum number of activities to return

        Returns:
            List of activity dictionaries
        """
        activities = CohortActivity.query.filter_by(
            cohort_id=cohort_id
        ).order_by(
            CohortActivity.created_at.desc()
        ).limit(limit).all()

        return [activity.to_dict() for activity in activities]
